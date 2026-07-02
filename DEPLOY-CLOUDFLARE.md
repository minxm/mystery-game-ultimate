# Cloudflare Pages / Workers 部署指南

本项目使用 [@opennextjs/cloudflare](https://opennext.js.org/cloudflare) 将 Next.js 部署到 **Cloudflare Workers**（含静态资源，等同于 Cloudflare 全栈托管方案）。

## 前置要求

- Node.js 20+
- Cloudflare 账号
- 硅基流动 API Key（[cloud.siliconflow.cn](https://cloud.siliconflow.cn)）
- （推荐）Supabase 项目（登录、云同步、排行榜、案件生成队列）

---

## 快速部署

### 方法 1：CLI 一键部署（推荐）

```bash
cd D:\workspace\mystery-game-ultimate

# 登录 Cloudflare
npx wrangler login

# 配置环境变量（见下方「环境变量」章节）
# 本地可先复制 .env.local.example -> .env.local

# 构建并部署
npm run deploy
```

部署成功后，终端会输出 Workers 地址，形如：`https://mystery-game.<account>.workers.dev`

---

### 方法 2：Cloudflare Dashboard 连接 Git

1. 将代码推送到 GitHub / GitLab
2. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create**
3. 选择 **Connect to Git**，导入仓库
4. 构建设置：
   - **Build command**: `npm run deploy` 或 `npx opennextjs-cloudflare build && npx opennextjs-cloudflare deploy`
   - **Node.js version**: 20 或 22
5. 在 **Settings → Variables and Secrets** 添加环境变量（见下表）
6. 保存并触发首次部署

> Git 集成时若 `deploy` 脚本需要 API Token，请在 Cloudflare 中配置 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。

---

### 方法 3：Supabase + Cloudflare 一键配置

```powershell
# Windows
.\scripts\setup-supabase-cloudflare.ps1

# Git Bash / macOS / Linux
bash scripts/setup-supabase-cloudflare.sh
```

脚本会引导填写 Supabase Keys、写入 `.env.local`，并同步 Cloudflare Workers 密钥。

---

## 环境变量

在 Cloudflare Dashboard → Workers → **mystery-game** → **Settings → Variables and Secrets** 配置：

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `SILICONFLOW_API_KEY` | ✅ | 硅基流动 API Key |
| `NEXT_PUBLIC_SUPABASE_URL` | 推荐 | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 推荐 | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 推荐 | 服务端密钥（勾选 Encrypt） |
| `AI_GENERATE_IMAGES` | 可选 | 默认 `true`（wrangler.jsonc 已设） |
| `ADMIN_USER_IDS` | 生产 | 监控页管理员 UUID，逗号分隔 |
| `INVENTORY_REFILL_SECRET` | 可选 | 库存补货 Cron Bearer Token |

`CLOUDFLARE=true` 已在 `wrangler.jsonc` 的 `vars` 中配置，用于识别 Cloudflare 运行时。

### CLI 设置密钥示例

```bash
echo "your-key" | npx wrangler secret put SILICONFLOW_API_KEY
echo "your-service-role" | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

---

## Supabase Auth 回调

在 Supabase → Authentication → URL Configuration：

- **Site URL**: `https://mystery-game.<account>.workers.dev`（或自定义域名）
- **Redirect URLs**:
  - `https://mystery-game.<account>.workers.dev/auth/callback`
  - `http://localhost:3000/auth/callback`（本地开发）

数据库迁移：在 SQL Editor 执行 `supabase/migrations/000_combined_all.sql`

---

## 本地开发

```bash
# 日常开发（Next.js dev server）
npm run dev

# 在 Workers 运行时本地预览（更接近生产环境）
npm run preview
```

本地 Wrangler 变量写在 `.dev.vars`（已 gitignore，勿提交密钥）。

---

## 可选：R2 增量缓存

Next.js 增量缓存可绑定 R2 桶以提升性能：

1. 在 Cloudflare 创建 R2 桶，例如 `mystery-game-cache`
2. 编辑 `wrangler.jsonc`，取消 `r2_buckets` 注释并填入 `bucket_name`
3. 重新部署

---

## 验证部署

- ✅ 首页加载正常
- ✅ 生成案件（异步 worker + 轮询）
- ✅ 审问嫌疑人
- ✅ 提交推理
- ✅ 登录 / 云同步（若已配置 Supabase）

---

## 常见问题

### Q: 案件生成超时？

生产环境依赖 `/api/generate-case/worker` 后台路由 + Supabase 任务队列。**务必配置 Supabase**（含 `SUPABASE_SERVICE_ROLE_KEY`），否则多实例间任务状态无法共享。

### Q: 如何更新部署？

```bash
npm run deploy
```

Git 集成项目：合并到主分支后自动部署。

### Q: 如何绑定自定义域名？

Cloudflare Dashboard → Workers → mystery-game → **Settings → Domains & Routes** → Add custom domain

### Q: 与 Netlify 的区别？

| 能力 | Netlify（旧） | Cloudflare（现） |
|------|--------------|------------------|
| Next.js 托管 | `@netlify/plugin-nextjs` | `@opennextjs/cloudflare` |
| 后台案件生成 | Background Function | `/api/generate-case/worker` |
| 任务状态 | Netlify Blobs | Supabase Postgres |
| 部署命令 | `netlify deploy --prod` | `npm run deploy` |

---

## 参考链接

- [OpenNext Cloudflare 文档](https://opennext.js.org/cloudflare)
- [Next.js on Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
