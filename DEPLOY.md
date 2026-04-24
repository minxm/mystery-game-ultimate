# 部署指南

## 快速部署到 Vercel

### 方法 1：使用 Vercel CLI（推荐）

1. **登录 Vercel**
```bash
vercel login
```
这会打开浏览器，使用你的 GitHub/GitLab/Bitbucket 账号登录

2. **部署项目**
```bash
cd D:\workspace\mystery-game-ultimate
vercel
```

按照提示操作：
- Set up and deploy? → Yes
- Which scope? → 选择你的账号
- Link to existing project? → No
- What's your project's name? → mystery-game（或其他名称）
- In which directory is your code located? → ./
- Want to override the settings? → No

3. **设置环境变量**

部署完成后，需要添加环境变量：

```bash
vercel env add OPENAI_API_KEY
```

然后输入你的 API Key：
```
sk-8QX459b787add3bd1e20854be5327cbd2a1a83125aatJzuL
```

选择环境：
- Production → Yes
- Preview → Yes  
- Development → Yes

4. **重新部署以应用环境变量**
```bash
vercel --prod
```

完成！你会得到一个类似 `https://mystery-game-xxx.vercel.app` 的 URL

---

### 方法 2：使用 Vercel 网页界面（最简单）

1. **访问 Vercel 网站**
   - 打开 https://vercel.com
   - 使用 GitHub/GitLab/Bitbucket 账号登录

2. **导入项目**
   - 点击 "Add New..." → "Project"
   - 选择 "Import Git Repository"
   - 如果项目不在 Git 托管平台，选择 "Import Third-Party Git Repository"

3. **配置项目**
   - Project Name: `mystery-game`
   - Framework Preset: Next.js（自动检测）
   - Root Directory: `./`
   - Build Command: `npm run build`（自动填充）
   - Output Directory: `.next`（自动填充）

4. **添加环境变量**
   在 "Environment Variables" 部分：
   - Name: `OPENAI_API_KEY`
   - Value: `sk-8QX459b787add3bd1e20854be5327cbd2a1a83125aatJzuL`
   - 勾选 Production, Preview, Development

5. **点击 Deploy**
   等待几分钟，部署完成后会得到一个 URL

---

### 方法 3：先推送到 GitHub，再连接 Vercel

1. **创建 GitHub 仓库**
   - 访问 https://github.com/new
   - 创建一个新仓库（可以是私有的）

2. **推送代码到 GitHub**
```bash
cd D:\workspace\mystery-game-ultimate
git remote add origin https://github.com/你的用户名/仓库名.git
git branch -M main
git push -u origin main
```

3. **在 Vercel 导入 GitHub 仓库**
   - 访问 https://vercel.com/new
   - 选择你刚创建的 GitHub 仓库
   - 添加环境变量 `OPENAI_API_KEY`
   - 点击 Deploy

---

## 环境变量说明

必需的环境变量：
- `OPENAI_API_KEY`: 第三方 API 密钥
  - 值: `sk-8QX459b787add3bd1e20854be5327cbd2a1a83125aatJzuL`
  - 用于: AI 生成案件、嫌疑人对话、推理评分

---

## 部署后验证

部署完成后，访问你的 URL 并测试：
1. ✅ 首页加载正常
2. ✅ 点击"生成案件"能成功生成
3. ✅ 审问嫌疑人能正常对话
4. ✅ 提交推理能正常评分

---

## 常见问题

### Q: 部署后 API 调用失败？
A: 检查环境变量是否正确设置。在 Vercel 项目设置中：
   Settings → Environment Variables → 确认 `OPENAI_API_KEY` 存在

### Q: 如何更新部署？
A: 
- 方法 1: 运行 `vercel --prod`
- 方法 2: 推送代码到 GitHub（如果连接了 GitHub，会自动部署）

### Q: 如何查看部署日志？
A: 在 Vercel 项目页面 → Deployments → 点击具体部署 → 查看 Logs

### Q: 如何自定义域名？
A: Vercel 项目设置 → Domains → 添加你的域名

---

## 技术支持

如有问题，请查看：
- Vercel 文档: https://vercel.com/docs
- Next.js 文档: https://nextjs.org/docs
