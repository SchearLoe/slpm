# SLPM — Smart Liquid Project Manager

> 液态毛玻璃风格 · 智能任务与项目管理  


SLPM 是一个全栈项目管理系统，前端基于高保真 Liquid Glass 交互原型改造，后端采用 Node.js + Express + Prisma + PostgreSQL，支持多工作区、RBAC 权限、甘特图、任务评论/活动流、文件上传与版本管理、AI 智能建议、WebSocket 实时推送等完整生产特性。

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 19 · TypeScript · Vite 6 · Tailwind CSS v4 · Framer Motion |
| 前端数据 | TanStack Query + axios · socket.io-client |
| 前端路由 | React Router v6 |
| 后端 | Node.js · Express · TypeScript · socket.io |
| ORM | Prisma 5 · PostgreSQL 16 |
| 认证 | 邮箱密码 + bcrypt + JWT |
| AI | OpenAI 兼容 chat/completions（流式 SSE） |
| 文件存储 | multer 本地磁盘 · workspace 隔离 |
| 实时推送 | socket.io（JWT 认证 + workspace 房间） |

---

## 功能矩阵

### 第一期：地基 + 核心闭环
- 用户注册/登录（邮箱密码 + JWT）· 登录态持久化
- 路由守卫 + URL 持久化（React Router）
- 任务 CRUD · 真实持久化（刷新不丢）
- 日程 CRUD · 任意月份导航 · 月/周/日三视图
- 主题三件套持久化（accentColor / glassBlur / enableConfetti）

### 第二期：P0 → P1-6
| 期数 | 内容 |
|------|------|
| P0 | 设置持久化 · 总览/分析页真实数据聚合 · 演示数据标注 |
| P1-1 | 任务评论 + 活动流 · @提及解析 · 级联删除 |
| P1-2 | 多工作区 + RBAC（管理员/成员） · 工作区隔离 |
| P1-3 | 真实文件上传（multer + 本地磁盘） · 下载鉴权 |
| P1-4 | 真实 AI · system_admin 全局配置 · OpenAI 代理 |
| P1-5 | 文件预览（图片/PDF） · AI 流式 SSE · Token 统计 |
| P1-6 | 甘特图（数据驱动） · 任务依赖（父子/阻塞） · WebSocket 实时推送 · 文件版本历史 |

---

## 快速启动

### 前提
- Node.js ≥ 20 · PostgreSQL 16（运行中）
- 创建数据库 `wenxibuddy`

### 后端

```bash
cd wenxibuddy-server
cp .env.example .env          # 编辑 .env 填入数据库密码 + AI_ENCRYPTION_KEY
npm install
npx prisma migrate deploy
npm run dev                   # → http://localhost:8080
```

### 前端

```bash
cd wenxibuddy-src
cp .env.example .env          # VITE_API_BASE_URL=/api（开发走 vite proxy）
npm install
npm run dev                   # → http://localhost:3000
```

浏览器打开 `http://localhost:3000` → 注册 → 自动登录 → 开始使用。

> 第一个注册的用户自动成为系统管理员（system_admin），可在设置页配置 AI。


## 项目结构

```
D:\VibeCode\xmgl\
├── wenxibuddy-src\         # 前端 SPA
│   ├── src/
│   │   ├── components/     # 布局 · 看板 · 弹窗 · UI 组件
│   │   ├── context/        # Auth · App 全局状态
│   │   ├── lib/            # api · queries · socket · aggregations
│   │   ├── pages/          # 8 页面路由
│   │   └── types/          # TypeScript 类型定义
│   ├── vite.config.ts
│   └── package.json
├── wenxibuddy-server\      # 后端 API
│   ├── src/
│   │   ├── config/         # 环境变量
│   │   ├── middleware/     # auth · workspace · admin · error
│   │   ├── routes/         # auth · task · schedule · file · ai · workspace · comment · notification · settings
│   │   └── lib/            # prisma · jwt · crypto · notify · ws
│   ├── prisma/
│   │   ├── schema.prisma   # 数据模型
│   │   └── migrations/     # 迁移历史
│   └── package.json
├── 全栈项目启动指南.md
└── README.md
```


## API 端点

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/api/auth/register` | 否 | 注册 |
| POST | `/api/auth/login` | 否 | 登录 |
| GET | `/api/auth/me` | JWT | 取当前用户 |
| GET | `/api/workspaces` | JWT | 工作区列表 |
| POST | `/api/workspaces` | JWT | 新建工作区 |
| GET | `/api/workspaces/:id/members` | JWT+WS | 工作区成员 |
| POST | `/api/workspaces/:id/members` | JWT+WS+admin | 邀请成员 |
| PATCH | `/api/workspaces/:id/members/:userId` | JWT+WS+admin | 改角色 |
| DELETE | `/api/workspaces/:id/members/:userId` | JWT+WS+admin | 移除成员 |
| GET | `/api/tasks` | JWT+WS | 任务列表 |
| POST | `/api/tasks` | JWT+WS | 新建任务 |
| PATCH | `/api/tasks/:id` | JWT+WS | 编辑任务 |
| PATCH | `/api/tasks/:id/complete` | JWT+WS | 完成任务 |
| DELETE | `/api/tasks/:id` | JWT+WS | 删除任务 |
| GET | `/api/tasks/:taskId/comments` | JWT+WS | 评论列表 |
| POST | `/api/tasks/:taskId/comments` | JWT+WS | 发表评论 |
| GET | `/api/tasks/:taskId/activity` | JWT+WS | 活动流 |
| GET | `/api/schedules?month=YYYY-MM` | JWT+WS | 日程列表 |
| POST | `/api/schedules` | JWT+WS | 新建日程 |
| PUT | `/api/schedules/:id` | JWT+WS | 编辑日程 |
| DELETE | `/api/schedules/:id` | JWT+WS | 删除日程 |
| GET | `/api/files` | JWT+WS | 文件列表 |
| POST | `/api/files` | JWT+WS | 上传文件 |
| GET | `/api/files/:id/download` | JWT+WS | 下载文件 |
| GET | `/api/files/:id/preview` | JWT+WS | 内联预览 |
| PATCH | `/api/files/:id` | JWT+WS | 重命名 |
| GET | `/api/files/:id/versions` | JWT+WS | 版本历史 |
| POST | `/api/files/:id/restore/:versionId` | JWT+WS | 恢复版本 |
| GET | `/api/ai/config` | JWT+admin | AI 配置 |
| PUT | `/api/ai/config` | JWT+admin | 更新 AI 配置 |
| POST | `/api/ai/test` | JWT+admin | AI 连通性测试 |
| POST | `/api/ai/suggest` | JWT+WS | 任务建议 |
| POST | `/api/ai/suggest/stream` | JWT+WS | 流式任务建议 |
| GET | `/api/ai/usage` | JWT+admin | Token 用量统计 |
| GET | `/api/settings` | JWT | 取设置 |
| PUT | `/api/settings` | JWT | 更新设置 |
| GET | `/api/notifications` | JWT | 通知列表 |
| GET | `/api/notifications/unread-count` | JWT | 未读数 |
| PATCH | `/api/notifications/:id/read` | JWT | 已读 |
| POST | `/api/notifications/read-all` | JWT | 全部已读 |

> JWT = Bearer token · WS = X-Workspace-Id header · admin = 系统管理员


## 数据库 Schema

```
User ────────── 用户（邮箱/密码/角色 system_admin|成员）
  ├─ UserSettings    主题偏好
  ├─ WorkspaceMember 工作区成员关系（admin|member）
  ├─ Task            创建/被指派的任务
  ├─ ScheduleEvent   日程
  ├─ TaskComment     评论
  ├─ TaskActivity    活动记录
  ├─ FileRecord      上传的文件
  ├─ Notification    站内通知
  └─ AiUsageRecord   Token 用量

Workspace ──── 工作区（名称/slug）
  ├─ WorkspaceMember  成员
  ├─ Task             任务（含 parentId / milestone / startDate）
  ├─ TaskDependency   阻塞依赖
  ├─ ScheduleEvent    日程
  └─ FileRecord       文件（含 currentVersion + FileVersion）

SystemConfig ── 全局单例（AI baseURL/加密Key/model/temperature）
```


## 架构决策

| 决策 | 方案 |
|------|------|
| 工作区隔离 | `X-Workspace-Id` HTTP header（不进 JWT，切换无需重登录） |
| RBAC | WorkspaceMember.role = admin\|member；全局 system_admin 管理 AI 配置 |
| API 密钥安全 | AES-256-GCM 加密存储，前端只返回掩码 `••••abcd` |
| 文件存储 | multer diskStorage → `uploads/<workspaceId>/<uuid>.<ext>`，可平滑迁移 S3 |
| 实时推送 | socket.io · JWT 握手认证 · workspace 房间 · 通知创建即推送 |
| AI 代理 | 前端 → 后端 `/api/ai/*` → 外部 LLM，支持流式 SSE |


## 环境变量

### 后端（wenxibuddy-server/.env）

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wenxibuddy?schema=public"
JWT_SECRET="change-me-to-a-long-random-string"
JWT_EXPIRES_IN="7d"
PORT=8080
NODE_ENV=development
CLIENT_ORIGIN="http://localhost:3000"
AI_ENCRYPTION_KEY="change-me-to-another-random-string"
```

### 前端（wenxibuddy-src/.env）

```
VITE_API_BASE_URL=/api
```


## 常用命令

### 后端

```bash
npm run dev               # 开发模式（tsx watch 热重载）
npx prisma studio         # 可视化数据库
npx prisma migrate dev    # 改 schema 后生成迁移
```

### 前端

```bash
npm run dev               # 开发模式（:3000）
npm run build             # 生产构建
```

---

## 鸣谢

本项目的前端设计系统与交互原型衍生自以下两个优秀的开源项目，在此致以诚挚感谢：

- [cuberfry68-coder/wenxibuddy](https://github.com/cuberfry68-coder/wenxibuddy) — 原始 WenXiBuddy 设计灵感与概念原型
- [lllll081926i/wxbuddy](https://github.com/lllll081926i/wxbuddy) — Liquid Glass 高保真交互原型

SLPM 在这些基础上实现了完整的后端数据持久化、多工作区租户隔离、RBAC 权限、真实 AI 集成、WebSocket 实时推送和项目管理核心功能。
