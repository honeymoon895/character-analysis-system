# Zeabur 部署指南

面向中国大陆用户，Zeabur 提供国内 CDN 加速，无需科学上网即可访问。

---

## 🚀 快速部署

### 第一步：注册 Zeabur

1. 访问 https://zeabur.com 注册（支持 GitHub / 邮箱注册）
2. 登录后进入 Dashboard

### 第二步：推送代码到 GitHub

```bash
# 在项目目录执行
git add .
git commit -m "chore: 适配 Zeabur 部署"
git push
```

### 第三步：在 Zeabur 创建项目

1. 点 **Create Project** → **Git Repository**
2. 授权 GitHub → 选择 `character-analysis-system`
3. Zeabur 会自动识别为 **Next.js** 项目

### 第四步：添加 PostgreSQL 数据库

1. 在 Zeabur 项目页面，点 **➕ New Service**
2. 选择 **Database** → **PostgreSQL**
3. 部署完成后，PostgreSQL 会自动生成 `DATABASE_URL` 环境变量
4. Zeabur 会自动注入到你的 Next.js 应用中
5. 等待数据库状态变为 **READY**

### 第五步：配置环境变量

在 Zeabur 项目 → **Environment Variables** 添加：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `JWT_SECRET` | 生产密钥，生成随机串 | `openssl rand -hex 32` 生成 |
| `AI_API_KEY` | AI API 密钥 | `sk-xxx...` |
| `AI_API_URL` | AI API 地址 | `https://apihub.agnes-ai.com/v1/chat/completions` |
| `AI_MODEL` | AI 模型名 | `agnes-2.0-flash` |

> `DATABASE_URL` 由 Zeabur PostgreSQL 服务自动提供，无需手动添加。

### 第六步：部署

点击 **Deploy**，等待构建完成。

### 第七步：数据库初始化

部署成功后，在 Zeabur 项目页面：

1. 进入 **Terminal**
2. 运行：
```bash
npx prisma db push
node prisma/seed.js
```

> Zeabur 会自动注入数据库连接串，所以无需手动设置 `DATABASE_URL`。

---

## ✅ 功能状态

| 功能 | 状态 | 说明 |
|------|------|------|
| 人物分析（AI） | ✅ 正常 | |
| 模拟对话 | ✅ 正常 | |
| AI 性格画像生成 | ✅ 正常 | |
| 自我认知（日记分析） | ✅ 正常 | |
| 用户注册 / 登录 / 个人中心 | ✅ 正常 | |
| 数据导出 | ✅ 正常 | |
| **头像上传** | ❌ 已暂停 | 需要云存储，参见下方恢复方案 |
| **AI 视频生成** | ❌ 已暂停 | 需要异步任务架构改造 |

---

## 🌐 自定义域名（推荐）

绑定额外域名后，Zeabur 会自动接入国内 CDN：

1. 项目页面 → **Custom Domains**
2. 输入你的域名（如 `analysis.example.com`）
3. 去 DNS 服务商添加 CNAME 记录到 Zeabur
4. 如需 ICP 备案，Zeabur 提供备案引导

---

## 🔧 后续恢复方案

### 恢复文件上传（使用 S3 兼容存储）

Zeabur 市场有 MinIO 服务，或使用外部 OSS：

```bash
npm install @aws-sdk/client-s3
```

然后在 `upload-portrait/route.ts` 中将 `writeFile` 替换为 S3 `PutObjectCommand`。

### 恢复视频生成

与 Vercel 一样需要异步化改造（创建任务 → 轮询 → 返回结果）。

---

## ❓ 常见问题

**Q: 中国用户需要备案吗？**
A: Zeabur 国内节点需要绑定已备案域名。如果用 Zeabur 分配的 `.zeabur.app` 域名，不需要备案但速度一般。

**Q: 免费版够用吗？**
A: Zeabur 免费版有流量和构建时长限制，个人使用没问题。生产环境建议付费套餐。

**Q: 数据库数据会丢失吗？**
A: Zeabur PostgreSQL 服务有持久化存储，重启不会丢数据。建议定期备份。
