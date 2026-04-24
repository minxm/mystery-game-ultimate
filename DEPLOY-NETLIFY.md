# Netlify 部署指南

## 快速部署

### 方法 1：使用部署脚本（推荐）

在 Git Bash 中运行：

```bash
cd D:\workspace\mystery-game-ultimate
bash deploy-netlify.sh
```

按照提示操作即可。

---

### 方法 2：手动执行命令

**步骤 1：登录 Netlify**
```bash
cd D:\workspace\mystery-game-ultimate
netlify login
```
会打开浏览器，使用 GitHub/GitLab/Email 登录

**步骤 2：初始化并部署**
```bash
netlify init
```

按照提示操作：
- Create & configure a new site → **Yes**
- Team → 选择你的团队
- Site name → `mystery-game`（或留空自动生成）
- Build command → `npm run build`
- Directory to deploy → `.next`

**步骤 3：添加环境变量**
```bash
netlify env:set OPENAI_API_KEY "sk-8QX459b787add3bd1e20854be5327cbd2a1a83125aatJzuL"
```

**步骤 4：生产部署**
```bash
netlify deploy --prod
```

完成！你会得到一个 URL，类似：`https://mystery-game.netlify.app`

---

### 方法 3：使用 Netlify 网页界面

**步骤 1：推送代码到 GitHub**

```bash
# 创建 GitHub 仓库（在 https://github.com/new）
# 然后运行：
git remote add origin https://github.com/你的用户名/mystery-game-ultimate.git
git branch -M main
git push -u origin main
```

**步骤 2：在 Netlify 导入仓库**

1. 访问 https://app.netlify.com
2. 点击 "Add new site" → "Import an existing project"
3. 选择 GitHub，授权并选择你的仓库
4. 配置构建设置：
   - Build command: `npm run build`
   - Publish directory: `.next`
5. 添加环境变量：
   - Key: `OPENAI_API_KEY`
   - Value: `sk-8QX459b787add3bd1e20854be5327cbd2a1a83125aatJzuL`
6. 点击 "Deploy site"

---

## 验证部署

部署完成后，访问你的 Netlify URL 并测试：
- ✅ 首页加载正常
- ✅ 生成案件功能正常
- ✅ 审问嫌疑人功能正常
- ✅ 提交推理功能正常

---

## 常见问题

### Q: 部署后 API 调用失败？
A: 检查环境变量是否正确设置：
```bash
netlify env:list
```

### Q: 如何更新部署？
A: 运行：
```bash
netlify deploy --prod
```

### Q: 如何查看部署日志？
A: 访问 Netlify 控制台 → 选择你的站点 → Deploys → 查看日志

### Q: 如何绑定自定义域名？
A: Netlify 控制台 → Domain settings → Add custom domain

---

## 技术支持

- Netlify 文档: https://docs.netlify.com
- Next.js on Netlify: https://docs.netlify.com/frameworks/next-js/
