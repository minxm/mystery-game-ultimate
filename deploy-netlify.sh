#!/bin/bash

echo "==================================="
echo "Netlify 部署脚本"
echo "==================================="
echo ""

# 步骤 1: 登录 Netlify
echo "步骤 1: 登录 Netlify..."
echo "运行: netlify login"
echo "这会打开浏览器，请使用你的账号登录"
echo ""
read -p "按回车键继续..."
netlify login

# 步骤 2: 初始化并部署
echo ""
echo "步骤 2: 初始化 Netlify 站点..."
netlify init

# 步骤 3: 添加环境变量
echo ""
echo "步骤 3: 添加环境变量..."
echo "请填入你的硅基流动 API Key（https://cloud.siliconflow.cn）"
read -p "SILICONFLOW_API_KEY: " SF_KEY
netlify env:set SILICONFLOW_API_KEY "$SF_KEY"

echo ""
echo "Supabase 配置（登录/云同步/排行榜，可选但推荐）"
echo "在 Supabase Dashboard -> Project Settings -> API 获取"
read -p "NEXT_PUBLIC_SUPABASE_URL: " SB_URL
read -p "NEXT_PUBLIC_SUPABASE_ANON_KEY: " SB_ANON
read -sp "SUPABASE_SERVICE_ROLE_KEY: " SB_SERVICE
echo ""
if [ -n "$SB_URL" ] && [ -n "$SB_ANON" ] && [ -n "$SB_SERVICE" ]; then
  netlify env:set NEXT_PUBLIC_SUPABASE_URL "$SB_URL"
  netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "$SB_ANON"
  netlify env:set SUPABASE_SERVICE_ROLE_KEY "$SB_SERVICE"
  echo "Supabase 环境变量已设置"
  echo "请在 Supabase SQL Editor 执行 supabase/migrations/000_combined_all.sql"
else
  echo "跳过 Supabase（可稍后运行 bash scripts/setup-supabase-netlify.sh）"
fi

# 步骤 4: 生产部署
echo ""
echo "步骤 4: 部署到生产环境..."
netlify deploy --prod

echo ""
echo "==================================="
echo "部署完成！"
echo "==================================="
echo ""
echo "你的网站 URL 会显示在上面的输出中"
echo "格式类似: https://mystery-game.netlify.app"
