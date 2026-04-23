# AI 剧本杀 - 沉浸式推理游戏平台

一个基于 AI 的剧本杀自动生成器，提供电影级的推理游戏体验。

## 功能特性

- 🎭 **AI 生成案件** - 每个案件都是独一无二的推理故事
- 🖼️ **图文结合** - AI 生成角色肖像、案发现场等图片
- 💬 **智能审问** - 与嫌疑人进行真实的 AI 对话
- 🎯 **智能评分** - 专业的推理评估系统
- 🎬 **真相回放** - 动态展示案件真相
- 📊 **数据统计** - 记录你的侦探生涯

## 技术栈

- **框架**: Next.js 14 + TypeScript
- **样式**: Tailwind CSS
- **动画**: Framer Motion
- **AI**: OpenAI API (GPT-4 + DALL-E 3)
- **状态管理**: Zustand
- **存储**: LocalStorage

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env.local` 文件：

```env
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. 运行开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

### 4. 构建生产版本

```bash
npm run build
npm start
```

## 项目结构

```
mystery-game-ultimate/
├── app/                      # Next.js 应用目录
│   ├── api/                  # API 路由
│   │   ├── generate-case/    # 案件生成
│   │   ├── interrogate/      # 审问对话
│   │   └── evaluate/         # 推理评分
│   ├── case/[id]/           # 案件详情页
│   ├── investigate/[id]/    # 调查页面
│   ├── interrogate/[id]/    # 审问页面
│   ├── result/[id]/         # 结果页面
│   ├── layout.tsx           # 根布局
│   ├── page.tsx             # 首页
│   └── globals.css          # 全局样式
├── components/              # React 组件
│   └── ParticleBackground.tsx
├── lib/                     # 工具库
│   ├── types.ts            # TypeScript 类型定义
│   ├── constants.ts        # 常量配置
│   ├── ai.ts               # AI 集成
│   └── utils.ts            # 工具函数
├── public/                 # 静态资源
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## 游戏流程

1. **选择难度** - 简单/中等/困难/专家
2. **生成案件** - AI 自动生成完整案件（30秒内）
3. **查看案情** - 了解受害者和案发现场
4. **开始调查** - 收集证据、审问嫌疑人、分析时间线
5. **提交推理** - 输入你的推理结论
6. **获得评分** - AI 智能评分并展示真相
7. **真相回放** - 观看案件真相动画

## 核心功能

### 案件生成系统

- 随机场景、死法、诡计组合
- 三名嫌疑人，全部合理可疑
- 多层误导，真凶不易识破
- 逻辑闭环，经得起推敲

### 审问系统

- 每个嫌疑人都是独立 AI Agent
- 根据性格和秘密回答问题
- 真凶会撒谎和回避
- 被证据击破后会改口

### 评分系统

- 凶手身份（40分）
- 作案手法（30分）
- 动机分析（20分）
- 逻辑链条（10分）

## 自定义配置

### 修改案件生成参数

编辑 `lib/constants.ts`：

```typescript
export const SETTINGS = ['雪山旅馆', '豪华别墅', ...];
export const DEATH_METHODS = ['神秘中毒', '触电身亡', ...];
export const TRICKS = ['时间差诡计', '监控伪造', ...];
```

### 调整 AI 模型

编辑 `lib/ai.ts`：

```typescript
const completion = await openai.chat.completions.create({
  model: 'gpt-4-turbo-preview', // 修改模型
  temperature: 0.9, // 调整创造性
});
```

## 注意事项

- 需要有效的 OpenAI API Key
- 图片生成需要 DALL-E 3 权限
- 建议使用 GPT-4 以获得最佳案件质量
- 首次生成案件可能需要 30-60 秒

## 性能优化

- 使用 Next.js 14 App Router
- 图片懒加载
- API 路由缓存
- LocalStorage 数据持久化

## 浏览器支持

- Chrome (推荐)
- Firefox
- Safari
- Edge

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题，请提交 Issue。
