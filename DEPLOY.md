# 腾讯云 CloudBase（云开发）部署指南

面向中国大陆用户，腾讯云 CloudBase 无需科学上网，且内置 CDN 加速。

---

## 🚀 部署步骤

### 第一步：推送代码

```bash
git add .
git commit -m "chore: 适配 CloudBase PostgreSQL 部署"
git push
```

### 第二步：创建 CloudBase 应用

1. 打开你之前买的链接，进入 **云开发 CloudBase** 控制台
2. 点 **新建应用** → **从代码仓库创建**
3. 授权 GitHub → 选择 `character-analysis-system` 仓库
4. 框架选择 **Next.js**（自动识别）

### 第三步：创建 PostgreSQL 数据库

在 CloudBase 控制台：
1. **云数据库** → **新建数据库**
2. 选择 **PostgreSQL**
3. 创建成功后，记录数据库连接信息（**内网地址**、端口、用户名、密码、数据库名）

> 如果 CloudBase 控制台没有 PostgreSQL 选项，可以直接购买 **TencentDB for PostgreSQL**，然后在环境变量里配置连接。

### 第四步：配置环境变量

在 CloudBase 应用 → **环境变量** 中添加：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://user:密码@内网地址:5432/数据库名?sslmode=disable` |
| `JWT_SECRET` | 生产密钥 | 用 `openssl rand -hex 32` 生成 |
| `AI_API_KEY` | AI API 密钥 | `sk-xxx...` |
| `AI_API_URL` | AI API 地址 | `https://apihub.agnes-ai.com/v1/chat/completions` |
| `AI_MODEL` | AI 模型名 | `agnes-2.0-flash` |

### 第五步：部署

点 **部署**，等待构建完成。

### 第六步：数据库初始化

部署成功后，在 CloudBase **云函数** → **终端** 中运行：

```bash
npx prisma db push
node prisma/seed.js
```

或在本地运行（需要先设置 `DATABASE_URL` 环境变量指向 CloudBase 数据库）：

```bash
export DATABASE_URL="postgresql://..."
npx prisma db push
node prisma/seed.js
```

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
| **头像上传** | ❌ 暂停 | CloudBase 云函数无持久磁盘，需要用 COS 对象存储替代 |
| **AI 视频生成** | ❌ 暂停 | 需要异步任务架构改造 |

> 头像上传和视频生成在 CloudBase 上也和 Vercel 一样受 serverless 限制。但 CloudBase 有 **COS 云存储** 可以替代本地文件上传，后续可以恢复。

---

## 🔧 可选：恢复头像上传（用腾讯云 COS）

CloudBase 自带 **云存储（COS）** 能力，支持文件上传：

1. 在 `upload-portrait/route.ts` 中将 `writeFile` 替换为 COS SDK
2. CloudBase 云函数内可直接调用 `cloudbase.storage` 上传文件
3. 示例：
```typescript
// 替换 fs.writeFile 为
const app = cloudbase.init({ env: "your-env-id" });
const storage = app.storage();
await storage.uploadFile({
  cloudPath: `portraits/${filename}`,
  fileContent: buffer,
});
```

---

## 🌐 自定义域名

CloudBase 应用默认分配 `*.tcloudbaseapp.com` 域名：
- 国内访问速度不错
- 绑定自己的域名需要 **ICP 备案**

---

## ❓ 说明

**Q: CloudBase 免费版够用吗？**
A: 看你购买时的套餐。CloudBase 按量计费，个人使用通常免费额度够用。

**Q: PostgreSQL 怎么选？**
A: CloudBase 内置支持 PostgreSQL（云数据库 TencentDB），创建后自动获得内网连接地址。云函数和数据库在同一环境，用内网连接速度最快且不耗流量。

**Q: 数据会丢吗？**
A: TencentDB for PostgreSQL 有自动备份，不会丢数据。
