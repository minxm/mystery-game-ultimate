# Supabase 集成指南

本项目支持 **Supabase 全栈后端**，与 Cloudflare Workers 前端部署配合使用。

## 架构

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Cloudflare │────▶│  Next.js + API   │────▶│  SiliconFlow AI │
│ Workers+CDN │     │  Worker Routes   │     │  案件/审问/评分  │
└─────────────┘     └────────┬─────────┘     └─────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        Supabase Auth   Supabase DB    Supabase Storage
        用户登录         案件/进度/排行    AI 图片缓存
              │              │
              └──────▶ Realtime ◀── 生成进度 + 在线人数
```

## 快速开始

### 1. 部署数据库

数据库 SQL 位于 `supabase/migrations/`，也可推送到独立仓库：

**[github.com/minxm/conan-ai-db](https://github.com/minxm/conan-ai-db)**

在 Supabase Dashboard → **SQL Editor** 执行（推荐合并版）：

```
supabase/migrations/000_combined_all.sql
```

或分步执行 `20250630000001_initial_schema.sql`、`20250630000002_storage.sql`、**`20250630000003_ai_service_layer.sql`**（AI 日志、案件库存、分享、社区）和 **`20250701000001_table_grants.sql`**（表级 GRANT，修复 `permission denied for table cases`）。

### 常见错误：`permission denied for table cases`

若 `/api/cases/save` 返回 500 且日志出现上述报错，说明 SQL 迁移创建的表缺少 PostgreSQL 表级权限。在 Supabase Dashboard → **SQL Editor** 执行：

```
supabase/migrations/20250701000001_table_grants.sql
```

同时确认 `.env.local` / Cloudflare Workers 环境变量中：

- `SUPABASE_SERVICE_ROLE_KEY` 使用的是 **service_role** 密钥（Project Settings → API → `service_role` secret）
- 不要误填 `anon` public key

### 2. 配置环境变量

**方式 A：一键脚本（推荐，Windows）**

```powershell
cd D:\workspace\mystery-game-ultimate
npm run setup:supabase
```

或 Git Bash：

```bash
bash scripts/setup-supabase-cloudflare.sh
```

脚本会引导你填写 Supabase Keys、写入 `.env.local`、同步 Cloudflare Workers 密钥。

**方式 B：手动配置**

复制 `.env.local.example` 并填写：

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Cloudflare 部署时，在 **Workers → Settings → Variables and Secrets** 添加相同变量。详见 [DEPLOY-CLOUDFLARE.md](./DEPLOY-CLOUDFLARE.md)。

### 3. 配置 Auth

Supabase Dashboard → Authentication → URL Configuration：

- Site URL: `https://your-domain.workers.dev`（或自定义域名）
- Redirect URLs: `https://your-domain.workers.dev/auth/callback`

启用 GitHub / Google / Email (Magic Link) / Phone (SMS) 提供商。

**手机号登录**：Dashboard → Authentication → Providers → Phone，配置 SMS 服务商（如 Twilio、MessageBird 或国内短信网关）。中国大陆号码会自动规范为 `+86` 格式。

常见错误 `phone_provider_disabled` / `Unsupported phone provider`：表示 Phone 提供商未启用或未绑定短信服务。按以下步骤操作：

1. Supabase Dashboard → **Authentication** → **Providers** → **Phone** → 打开 **Enable Phone provider**
2. 选择 **Twilio**（或 MessageBird / Vonage），填入 Account SID、Auth Token、Message Service SID
3. Twilio 试用账号需先在 Twilio 控制台验证目标手机号
4. 配置完成后重启本地 dev server；若暂不使用，可在 `.env.local` 设置 `NEXT_PUBLIC_ENABLE_PHONE_AUTH=false` 隐藏手机号登录入口

### 4. 推送 conan-ai-db 仓库

```bash
git clone https://github.com/minxm/conan-ai-db.git
cp -r supabase/* conan-ai-db/
cd conan-ai-db && git add . && git commit -m "Add initial schema" && git push
```

## 功能说明

| 功能 | 未配置 Supabase | 配置 Supabase |
|------|----------------|---------------|
| 游戏 | IndexedDB + localStorage | 同上 + 云同步 |
| 登录 | 匿名 | GitHub / Google / Magic Link / 手机验证码 |
| 案件生成队列 | Supabase Postgres / 内存 | Realtime 进度推送 |
| **案件库存** | 每次现场 AI 生成 | 预生成池，秒开体验 |
| AI 图片 | base64 存 IndexedDB | 上传 Storage，存 URL |
| **AI 调用日志** | 仅 console | `ai_call_logs` 表 + `/monitor` |
| 排行榜 | 不可用 | `/leaderboard` |
| **推理历史** | 不可用 | `/history` |
| **分享案件** | 不可用 | `/share/[token]` 小红书传播 |
| **评论/收藏/举报** | 不可用 | 结果页社交面板 |
| 在线人数 | 不显示 | 仅监控页（`/monitor`） |
| **签到/积分/邀请码** | 不可用 | 表已预留，待运营启用 |

## AI 服务层

所有 AI 调用（Qwen / GLM / DeepSeek / Kolors / bge-m3）统一经过 `lib/ai-service/`，自动写入 `ai_call_logs`：

- `operation`：case_framework / case_polish / chat_interrogate / evaluate / image_generate 等
- `latency_ms`、`prompt_tokens`、`completion_tokens`
- `status`：success / error / timeout

监控页：`/monitor`

- **不在浏览器传 secret**（避免泄漏）
- 生产环境配置 `ADMIN_USER_IDS`（Supabase 用户 UUID，逗号分隔），管理员登录后访问
- 数据通过 Server Component + Server Action 在服务端读取

## 案件库存（预生成）

Cron / 外部脚本调用补货 API，secret **仅存 Cloudflare Workers 密钥**，使用标准 Bearer 头：

```bash
# 查看库存（生产环境需 Bearer）
curl https://your-domain/api/inventory/refill \
  -H "Authorization: Bearer YOUR_INVENTORY_REFILL_SECRET"

# 触发补货
curl -X POST https://your-domain/api/inventory/refill \
  -H "Authorization: Bearer YOUR_INVENTORY_REFILL_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"maxPerRun": 2}'
```

> 切勿使用 `NEXT_PUBLIC_` 前缀，切勿在前端 fetch 中携带 secret。

玩家点击「开始推理」时，系统优先从 `case_inventory` 分配已生成案件，库存不足时才走 AI 现场生成。

```
玩家 → 开始游戏
         ↓
    库存有没有？
    ↙         ↘
  有           没有
  ↓             ↓
直接读取      调用 AI 生成
  ↓             ↓
开始游戏      存数据库
                ↓
              玩家进入
```

## 数据表

详见 `supabase/README.md`。
