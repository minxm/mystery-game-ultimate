# Supabase 集成指南

本项目支持 **Supabase 全栈后端**，与 Netlify 前端部署配合使用。

## 架构

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Netlify   │────▶│  Next.js + API   │────▶│  SiliconFlow AI │
│  CDN + SSR  │     │  Netlify Funcs   │     │  案件/审问/评分  │
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

在 Supabase Dashboard → SQL Editor 依次执行两个迁移文件。

### 2. 配置环境变量

复制 `.env.local.example` 并填写：

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Netlify 部署时，在 **Site settings → Environment variables** 添加相同变量。

### 3. 配置 Auth

Supabase Dashboard → Authentication → URL Configuration：

- Site URL: `https://your-domain.netlify.app`
- Redirect URLs: `https://your-domain.netlify.app/auth/callback`

启用 GitHub / Google / Email (Magic Link) 提供商。

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
| 登录 | 匿名 | GitHub / Google / Magic Link |
| 案件生成队列 | Netlify Blobs / 内存 | + Postgres 表 + Realtime |
| AI 图片 | base64 存 IndexedDB | 上传 Storage，存 URL |
| 排行榜 | 不可用 | `/leaderboard` |
| 在线人数 | 不显示 | Realtime Presence |

## 数据表

详见 `supabase/README.md`。
