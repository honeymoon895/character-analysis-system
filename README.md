# ♟ 角色人物多维分析系统（Character Analysis System）

一个基于 **AI + 九维心理特征模型** 的角色分析系统，帮助你：

- **更好地了解自己**：通过自我探索日记，逐步生成属于你的多维性格档案；
- **更好地了解历史人物 / 公众人物**：输入姓名即可获得九维人格画像、行为模式、价值观、生平大事与主要成就；
- **理解身边的人**：支持自定义人物渐进式构建，把现实中重要的人“数字化、模型化”；
- **完善人性与减少内耗**：通过模拟对话、情景预演、反事实推演、内耗缓解与换位思考，把抽象性格变成可感知、可对话、可反思的体验。

> 项目原名：角色人物多维分析系统  
> 在线仓库：<https://github.com/honeymoon895/character-analysis-system>

---

## ✨ 核心功能

### 🔍 公众人物 / 历史人物解析
- 输入历史人物或公众人物姓名，例如：曹操、诸葛亮、李白、爱因斯坦、马云、Elon Musk
- AI 根据公开信息 / 综合知识输出九维心理特征评分与多维人物档案
- 包含雷达图、性格标签、行为模式、核心价值观、性格矛盾点、生平大事、主要成就

### ✍️ 自定义人物模式
- 通过多轮对话渐进式构建你身边的真实人物画像
- 可以按“关系”管理人物，例如：同事、伴侣、朋友、家人
- 后续有新的观察时，可继续“追加描述”，持续完善档案

### 🧠 自我认知模块
- 记录自己的日记或自我描述
- AI 自动分析九维心理特征、行为模式与核心价值观
- 完成 3 条日记后建立初步自我认知档案
- 支持一键导出个人自我认知数据（JSON）

### 📊 九维心理特征模型
系统采用九维人格分析模型：

| 维度 | 说明 |
|------|------|
| 开放性（OPENNESS） | 对新事物、新体验的开放程度 |
| 尽责性（CONSCIENTIOUSNESS） | 自律性、责任感与条理性 |
| 外向性（EXTRAVERSION） | 对外部世界的投入程度 |
| 宜人性（AGREEABLENESS） | 人际合作中的友善程度 |
| 情绪稳定性（NEUROTICISM） | 情绪稳定性和抗压能力 |
| 决断力（DECISIVENESS） | 决策速度与果断程度 |
| 风险偏好（RISK_TENDENCY） | 对风险与挑战的态度 |
| 共情能力（EMPATHY） | 理解他人情感的能力 |
| 领导力（LEADERSHIP） | 领导魅力与组织能力 |

### 🎨 AI 画像生成
- 根据人物性格分析结果自动生成人物形象 / 头像
- 支持上传自定义头像
- 无 API Key 或失败时自动回退到首字母头像

### 💬 心理模拟与对话
- **对话模拟**：以该人物口吻进行实时对话（微信风格聊天界面）
- **冷静分析**：输入一个行为或场景，AI 分析该人物可能反应的概率分布、心理机制、真实意图与行动建议
- **反事实模拟**：推演“如果当时没有……而是……，TA 会怎么想？”
- **情景预演**：选择日常、冲突、温馨或自定义场景，进入视频化情景生成流程

### 🧘 内耗缓解 & 换位思考
- 当你在人际关系中感到困惑或内耗时，提供性格归因提醒、行动建议
- 一键切换到“如果我是 TA……”的换位思考视角

### 🗂 人物库管理
- 登录注册、个人中心、全局头像同步
- 人物搜索、筛选（公众人物 / 自定义 / 关系）、排序
- 分析准确度反馈，帮助系统持续改进

---

## 🛠 技术栈

- [Next.js 16](https://nextjs.org/)（App Router）
- [React 19](https://react.dev/) + TypeScript
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Prisma](https://www.prisma.io/)（数据库 ORM，默认 PostgreSQL）
- [Zustand](https://zustand-demo.pmnd.rs/)（前端状态管理）
- [ECharts](https://echarts.apache.org/) / echarts-for-react（雷达图）
- 兼容 OpenAI 格式的 AI API（默认支持 Agnes / DeepSeek / OpenAI）

---

## 🚀 本地快速启动

### 1. 环境要求

- Node.js 20+
- npm
- PostgreSQL 数据库（也可以自行将 `prisma/schema.prisma` 的 provider 改为 `sqlite` 做本地体验）

### 2. 克隆并安装依赖

```bash
git clone https://github.com/honeymoon895/character-analysis-system.git
cd character-analysis-system
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，至少配置：

```bash
# PostgreSQL 连接串
DATABASE_URL="postgresql://user:password@localhost:5432/character_analysis?schema=public"

# 登录 JWT 密钥，生产环境请更换为随机字符串
JWT_SECRET="please-change-me-to-a-long-random-secret"

# AI 服务（不配置会使用内置模拟数据，配置后启用真实 AI 能力）
AI_API_KEY="sk-your-api-key"
AI_API_URL="https://apihub.agnes-ai.com/v1/chat/completions"
AI_MODEL="agnes-2.0-flash"
```

### 4. 初始化数据库

```bash
npx prisma db push
npm run seed
```

### 5. 启动开发服务器

```bash
npm run dev
```

打开 <http://localhost:3000>，注册账号后即可使用。

### 常用命令

```bash
npm run dev       # 启动开发环境
npm run build     # 生产构建
npm run start     # 启动生产服务
npm run lint      # ESLint 检查
npm run seed      # 初始化维度定义数据
```

---

## ⚙️ 环境变量说明

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `DATABASE_URL` | ✅ | Prisma 数据库连接串（当前代码默认使用 PostgreSQL） |
| `JWT_SECRET` | ✅ | 登录态加密密钥，生产环境请使用长随机字符串 |
| `AI_API_KEY` | 可选 | 兼容 OpenAI 格式的 AI API Key；不填则启用内置 mock 数据 |
| `AI_API_URL` | 可选 | AI Chat 接口地址，默认 `https://apihub.agnes-ai.com/v1/chat/completions` |
| `AI_MODEL` | 可选 | AI 对话模型，默认 `agnes-2.0-flash` |
| `AI_IMAGE_MODEL` | 可选 | 画像生成模型，默认 `agnes-image-2.1-flash` |
| `NEXT_PUBLIC_BASE_URL` | 可选 | 前端 API 请求基础地址，默认 `http://localhost:3000` |

---

## ☁️ 部署

- 国内部署推荐使用腾讯云 CloudBase，部署指南见 [DEPLOY.md](./DEPLOY.md)
- 当前代码已适配 PostgreSQL 数据库
- 云函数 / Serverless 环境下，本地文件上传和 AI 视频生成可能受到平台限制，详见 [DEPLOY.md](./DEPLOY.md) 中的“功能状态”

---

## 📁 项目结构

```text
src/
├── app/
│   ├── page.tsx                    # 首页：人物搜索 / 自定义构建 / 人物库
│   ├── character/[id]/page.tsx     # 人物详情：雷达图、画像、模拟、反馈
│   ├── simulate/[id]/page.tsx      # 人物对话模拟（聊天式）
│   ├── video/page.tsx              # AI 情景视频生成入口
│   ├── my-profile/page.tsx         # 自我认知模块
│   ├── profile/page.tsx            # 个人中心
│   ├── login/page.tsx              # 登录
│   ├── register/page.tsx           # 注册
│   └── api/                        # 后端 API 路由
├── components/                     # 前端组件
├── lib/                            # AI / 认证 / HTTP / 数据库工具
├── store/                          # Zustand 状态管理
public/                             # 静态资源
prisma/
├── schema.prisma                   # 数据库模型
└── seed.js                         # 维度定义初始化
```

---

## ⚠️ 免责声明

本项目中的 AI 分析结果仅供个人学习、自我反思与人际关系参考，**不代表对任何历史人物或真实个体的最终定论**。真实的人是复杂且多变的，请结合现实观察理性看待分析内容。

---

## 📄 License

目前项目为私有学习项目，代码仅供学习交流。开源协议 / 授权方式可根据你的后续需求补充。
