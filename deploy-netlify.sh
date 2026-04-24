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
netlify env:set OPENAI_API_KEY "sk-8QX459b787add3bd1e20854be5327cbd2a1a83125aatJzuL"

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
