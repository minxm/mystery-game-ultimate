# conan-ai-db

Conan AI 侦探推理游戏的 Supabase 数据库仓库。

## 架构

| 组件 | 用途 |
|------|------|
| **Auth** | 用户登录（GitHub / Google / Magic Link） |
| **Postgres** | 案件、进度、评分、审问、生成队列、日志 |
| **Storage** | AI 生成图片缓存（`case-images` bucket） |
| **Realtime** | 案件生成进度推送、在线人数 Presence |

## 快速部署

### 1. 创建 Supabase 项目

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 新建项目，记录 **Project URL** 和 **API Keys**

### 2. 执行数据库迁移

在 Supabase Dashboard → **SQL Editor** 中依次执行：

```
supabase/migrations/20250630000001_initial_schema.sql
supabase/migrations/20250630000002_storage.sql
```

或使用 Supabase CLI：

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### 3. 配置 Auth 提供商

Dashboard → **Authentication** → **Providers**：

- 启用 **Email**（Magic Link）
- 可选：启用 **GitHub** / **Google**

Redirect URL 添加：

```
http://localhost:3000/auth/callback
https://<your-netlify-domain>/auth/callback
```

### 4. 环境变量（前端 Netlify）

在 Netlify 或 `.env.local` 中配置：

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # 仅服务端，勿暴露给客户端
```

### 5. Realtime

`case_generation_jobs` 表已加入 Realtime publication。  
在线人数使用 Supabase Presence（无需额外表）。

## 数据表

| 表名 | 说明 |
|------|------|
| `profiles` | 用户资料（自动从 auth.users 创建） |
| `user_stats` | 统计：完成数、均分、连胜 |
| `cases` | 案件 JSONB（含 AI 图片 URL） |
| `game_progress` | 调查进度 |
| `evaluations` | 评分记录（排行榜数据源） |
| `interrogations` | 审问对话 |
| `case_generation_jobs` | 生成任务队列 |
| `activity_logs` | 活动日志 |
| `leaderboard` | 排行榜视图 |

## 与主仓库的关系

本仓库 SQL 迁移同步自 [mystery-game-ultimate/supabase](../mystery-game-ultimate/supabase)。  
主仓库负责 Next.js 前端 + Netlify Functions 后台逻辑。
