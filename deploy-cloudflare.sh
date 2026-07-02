#!/bin/bash

echo "==================================="
echo "Cloudflare 部署脚本"
echo "==================================="
echo ""

echo "步骤 1: 登录 Cloudflare..."
echo "运行: npx wrangler login"
echo ""
read -p "按回车键继续..."
npx wrangler login

echo ""
echo "步骤 2: 配置环境变量"
echo "请在 Cloudflare Dashboard 或使用 wrangler secret put 设置："
echo "  - SILICONFLOW_API_KEY"
echo "  - NEXT_PUBLIC_SUPABASE_URL"
echo "  - NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "  - SUPABASE_SERVICE_ROLE_KEY"
echo ""
read -p "环境变量已配置？按回车继续..."

echo ""
echo "步骤 3: 构建并部署..."
npm run deploy

echo ""
echo "==================================="
echo "部署完成！"
echo "==================================="
echo ""
echo "Workers URL 会显示在上面的输出中"
echo "格式类似: https://mystery-game.<account>.workers.dev"
