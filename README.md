# SLPM — Smart Liquid Project Manager

> 液态毛玻璃风格 · 智能任务与项目管理  


SLPM 是一个全栈项目管理系统，前端基于高保真 Liquid Glass 交互原型改造，后端采用 Node.js + Express + Prisma + PostgreSQL，支持多工作区、RBAC 职能角色（PM/Dev/QA/PO）、产品线（Product→Workspace→Task 三层）、甘特图与燃尽图、任务评论/活动流、文件上传与版本管理、AI 智能建议（流式 SSE）、WebSocket 实时推送（通知 + 在线状态）、看板拖拽、日程冲突预警、忘记密码等完整生产特性。

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 19 · TypeScript · Vite 6 · Tailwind CSS v4 · Framer Motion |
| 前端数据 | TanStack Query + axios · socket.io-client |
| 前端路由 | React Router v6 |
| 后端 | Node.js · Express · TypeScript · socket.io |
| ORM | Prisma 5 · PostgreSQL 16（14 个迁移） |
| 认证 | 邮箱密码 + bcrypt + JWT · 忘记密码（重置 token） |
| AI | OpenAI 兼容 chat/completions（流式 SSE） |
| 文件存储 | multer 本地磁盘 · workspace 隔离 · 头像上传 |
| 实时推送 | socket.io（JWT 认证 + workspace 房间 + 在线状态） |
| 测试 | Playwright E2E 冒烟（3 用例） |

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
| P2-1 | 职能角色（PM/Dev/QA） · 角色化导航与着陆页 · 默认任务筛选 |
| P2-2 | 角色只读行为 · PM 截止日预警 + 成员负荷真实化 |
| P3 | 产品线（Product→Workspace→Task 三层） · 产品版本管理 · 产品经理跨项目需求/人力视图 · PO 角色 |
| P4-1 | 演示残留清理（假数据全部真实化） · 超级管理员初始化 · 演示数据种子 · 成员站内信 · 跨模块搜索+⌘K · 真实头像上传 |
| P4-2 | 看板拖拽改阶段 · 任务预估工时 + 进度燃尽图 · 日程冲突预警 · 通知偏好 · 产品路线图/需求池/跨项目指派/Release Notes · 忘记密码 · 在线状态绿点 · Playwright E2E |
| P5-1 | 安全与健壮性增强：限流/上传校验/错误边界/分页/共享枚举 |
| P6 | 标签库（CRUD+颜色+筛选）· 任务清单 Checklist（完成度汇总）· 审计日志（系统级操作记录）· 任务批量操作 · 任务详情独立路由 · 评论编辑删除 · 筛选 URL 持久化 · 通知排序+类型筛选 · 日程导出 ICS · 知识库 Markdown 渲染 · 文件视图切换 · 看板 WIP 限制 · 统一头像组件 |

---

## 快速启动

### 前提
- Node.js ≥ 20 · PostgreSQL 16（运行中）
- 创建数据库 `slpm`

### 后端

```bash
cd slpm-server
cp .env.example .env          # 编辑 .env 填入数据库密码 + AI_ENCRYPTION_KEY
npm install
npx prisma migrate deploy
npm run dev                   # → http://localhost:8080
```

### 前端

```bash
cd slpm-src
cp .env.example .env          # VITE_API_BASE_URL=/api（开发走 vite proxy）
npm install
npm run dev                   # → http://localhost:3000
```

浏览器打开 `http://localhost:3000` → 注册 → 自动登录 → 开始使用。

> **超级管理员自动初始化**：后端启动时若不存在 system_admin 会自动创建（默认 `admin@slpm.local` + 随机密码打印在控制台；可在 `.env` 预设 `INITIAL_ADMIN_EMAIL/INITIAL_ADMIN_PASSWORD`）。
>
> **首个注册用户**自动成为系统管理员，并自动获得「演示项目」教程数据（四阶段示例任务/里程碑/日程/知识库文章/欢迎通知）。存量库补演示数据：`cd slpm-server && npm run seed:demo`。

### E2E 测试（可选）

```bash
cd 项目根目录
npm install                 # 首次
npx playwright install chromium   # 首次：下载浏览器
npm run test:e2e            # 3 个冒烟用例（需前后端已启动）
```


## 项目结构

```
D:\VibeCode\xmgl\
├── slpm-src\         # 前端 SPA
│   ├── src/
│   │   ├── components/     # 布局 · 看板 · 甘特图 · 弹窗 · UI 组件
│   │   ├── context/        # Auth · App 全局状态
│   │   ├── lib/            # api · queries · socket · aggregations · roleConfig · seed
│   │   ├── pages/          # 10 页面路由（任务/总览/日程/文件/协作/AI/知识库/设置/产品管理/重置密码）
│   │   └── types/          # TypeScript 类型定义
│   ├── vite.config.ts
│   └── package.json
├── slpm-server\      # 后端 API
│   ├── src/
│   │   ├── config/         # 环境变量
│   │   ├── middleware/     # auth · workspace · product · admin · error
│   │   ├── routes/         # auth · task · schedule · file · ai · workspace ·
│   │   │                   # notification · settings · article · product ·
│   │   │                   # product-version · product-dashboard
│   │   └── lib/            # prisma · jwt · crypto · notify · ws · seed
│   ├── prisma/
│   │   ├── schema.prisma   # 数据模型
│   │   └── migrations/     # 13 个迁移
│   └── package.json
├── e2e\               # Playwright 冒烟测试
├── playwright.config.ts
├── 全栈项目启动指南.md
└── README.md
```


## API 端点

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/api/auth/register` | 否 | 注册（首个用户自动 system_admin + 演示项目种子） |
| POST | `/api/auth/login` | 否 | 登录 |
| GET | `/api/auth/me` | JWT | 取当前用户 |
| PATCH | `/api/auth/me` | JWT | 更新资料（名称/职位） |
| POST | `/api/auth/avatar` | JWT | 上传头像（2MB，PNG/JPEG/WebP/GIF） |
| GET | `/api/auth/avatar/:file` | 否 | 头像静态访问（防路径穿越） |
| POST | `/api/auth/forgot-password` | 否 | 忘记密码（15 分钟重置 token，防枚举） |
| POST | `/api/auth/reset-password` | 否 | 重置密码 |
| GET | `/api/workspaces` | JWT | 工作区列表（含 role 与产品线归属） |
| POST | `/api/workspaces` | JWT | 新建工作区（可指定产品线） |
| GET | `/api/workspaces/:id/members` | JWT+WS | 工作区成员 |
| POST | `/api/workspaces/:id/members` | JWT+WS+admin | 邀请成员 |
| PATCH | `/api/workspaces/:id/members/:userId` | JWT+WS+admin | 改角色（admin/pm/dev/qa/po） |
| DELETE | `/api/workspaces/:id/members/:userId` | JWT+WS+admin | 移除成员 |
| GET | `/api/workspaces/:id/online` | JWT+WS | 在线成员 userId 列表 |
| GET | `/api/tasks` | JWT+WS | 任务列表（status/phase/assignedToMe/withDeps 筛选） |
| POST | `/api/tasks` | JWT+WS | 新建任务（含版本/预估工时） |
| PATCH | `/api/tasks/:id` | JWT+WS | 编辑任务 |
| PATCH | `/api/tasks/:id/complete` | JWT+WS | 完成任务 |
| DELETE | `/api/tasks/:id` | JWT+WS | 删除任务 |
| GET | `/api/tasks/:taskId/comments` | JWT+WS | 评论列表 |
| POST | `/api/tasks/:taskId/comments` | JWT+WS | 发表评论（@姓名 解析 + 通知） |
| GET | `/api/tasks/:taskId/activity` | JWT+WS | 活动流 |
| GET | `/api/schedules?month=YYYY-MM` | JWT+WS | 日程列表 |
| POST | `/api/schedules` | JWT+WS | 新建日程（响应含冲突预警） |
| PUT | `/api/schedules/:id` | JWT+WS | 编辑日程（响应含冲突预警） |
| DELETE | `/api/schedules/:id` | JWT+WS | 删除日程 |
| GET | `/api/files` | JWT+WS | 文件列表 |
| POST | `/api/files` | JWT+WS | 上传文件（20MB，同名自动归档版本） |
| GET | `/api/files/:id/download` | JWT+WS | 下载文件 |
| GET | `/api/files/:id/preview` | JWT+WS | 内联预览（图片/PDF） |
| PATCH | `/api/files/:id` | JWT+WS | 重命名 |
| GET | `/api/files/:id/versions` | JWT+WS | 版本历史 |
| POST | `/api/files/:id/restore/:versionId` | JWT+WS | 恢复版本 |
| DELETE | `/api/files/:id` | JWT+WS | 删除文件（DB + 磁盘） |
| GET | `/api/ai/config` | JWT+admin | AI 配置（Key 掩码） |
| PUT | `/api/ai/config` | JWT+admin | 更新 AI 配置（AES-256-GCM 加密） |
| POST | `/api/ai/test` | JWT+admin | AI 连通性测试 |
| POST | `/api/ai/suggest` | JWT+WS | 任务建议 |
| POST | `/api/ai/suggest/stream` | JWT+WS | 流式任务建议（SSE） |
| GET | `/api/ai/usage` | JWT+admin | Token 用量统计（近 30 天） |
| GET | `/api/settings` | JWT | 取设置（主题 + 通知偏好） |
| PUT | `/api/settings` | JWT | 更新设置 |
| GET | `/api/notifications` | JWT | 通知列表（最近 50 条） |
| GET | `/api/notifications/unread-count` | JWT | 未读数 |
| PATCH | `/api/notifications/:id/read` | JWT | 已读 |
| POST | `/api/notifications/read-all` | JWT | 全部已读 |
| DELETE | `/api/notifications/read` | JWT | 清除已读 |
| POST | `/api/notifications/send` | JWT+WS | 成员站内信（WebSocket 推送） |
| GET | `/api/products` | JWT | 产品线列表（含计数与最高角色） |
| POST | `/api/products` | JWT+admin | 新建产品线 |
| GET | `/api/products/:id` | JWT+PROD | 产品详情（含关联项目） |
| PATCH | `/api/products/:id` | JWT+PROD+po/admin | 更新产品 |
| POST | `/api/products/:id/workspaces` | JWT+PROD+po/admin | 关联项目到产品线 |
| DELETE | `/api/products/:id/workspaces/:wsId` | JWT+PROD+po/admin | 取消关联 |
| GET | `/api/products/:id/versions` | JWT+PROD | 版本列表（含 Release Notes） |
| POST | `/api/products/:id/versions` | JWT+PROD+po/admin | 创建版本 |
| PATCH | `/api/products/:id/versions/:vid` | JWT+PROD+po/admin | 更新版本 |
| DELETE | `/api/products/:id/versions/:vid` | JWT+PROD+po/admin | 删除版本 |
| GET | `/api/products/:id/tasks` | JWT+PROD | 跨项目任务（项目/版本/状态/阶段筛选） |
| GET | `/api/products/:id/members` | JWT+PROD | 跨项目成员负荷 |
| GET | `/api/products/:id/stats` | JWT+PROD | 跨项目 KPI（按项目/版本分列） |
| PATCH | `/api/products/:id/tasks/:taskId` | JWT+PROD | 产品级任务更新（跨项目指派/版本/状态） |
| GET | `/api/tasks/:id` | JWT+WS | 单个任务详情（含依赖关系，P6-E1） |
| POST | `/api/tasks/batch` | JWT+WS | 批量操作（改状态/优先级/指派/阶段/删除，P6-D） |
| GET | `/api/tasks/:taskId/checklist` | JWT+WS | 任务清单子项（P6-B） |
| POST | `/api/tasks/:taskId/checklist` | JWT+WS | 添加清单项 |
| PATCH | `/api/tasks/:taskId/checklist/:itemId` | JWT+WS | 更新清单项（内容/完成/排序） |
| DELETE | `/api/tasks/:taskId/checklist/:itemId` | JWT+WS | 删除清单项 |
| PATCH | `/api/tasks/:taskId/comments/:commentId` | JWT+WS | 编辑评论（仅作者，P6-E2） |
| DELETE | `/api/tasks/:taskId/comments/:commentId` | JWT+WS | 删除评论（作者或 admin/pm） |
| GET | `/api/tags` | JWT+WS | 工作区标签库（P6-A） |
| POST | `/api/tags` | JWT+WS | 新建标签（名称+颜色） |
| PATCH | `/api/tags/:id` | JWT+WS | 重命名/改色（级联更新任务 tags） |
| DELETE | `/api/tags/:id` | JWT+WS | 删除标签（级联移除任务 tags） |
| GET | `/api/audit?scope=global\|workspace` | JWT | 审计日志（全局仅 system_admin，工作区需 admin/pm，P6-C） |

> JWT = Bearer token · WS = X-Workspace-Id header · PROD = 产品级访问（用户至少是产品下任一项目成员） · admin = 系统管理员 · po/admin = 产品负责人或产品下任一项目 po/admin


## 数据库 Schema

```
User ────────── 用户（邮箱/密码/角色 system_admin|成员/头像 avatar）
  ├─ UserSettings    主题偏好 + 通知偏好（mention/assign/deadline）
  ├─ WorkspaceMember 工作区成员关系（admin|pm|dev|qa|po）
  ├─ ownedProducts   创建的产品线（产品负责人）
  ├─ Task            创建/被指派的任务
  ├─ ScheduleEvent   日程
  ├─ TaskComment     评论
  ├─ TaskActivity    活动记录
  ├─ FileRecord      上传的文件
  ├─ Notification    站内通知
  └─ AiUsageRecord   Token 用量

Workspace ──── 工作区（名称/slug，可选归属产品线）
  ├─ WorkspaceMember  成员
  ├─ Task             任务（含 parentId / milestone / startDate / productVersionId / estimatedHours）
  ├─ TaskDependency   阻塞依赖
  ├─ TaskChecklistItem 任务清单子项（P6-B）
  ├─ ScheduleEvent    日程
  ├─ FileRecord       文件（含 currentVersion + FileVersion）
  └─ Tag              工作区标签库（P6-A：name + color）

AuditLog ────── 审计日志（P6-C：actorId + action + target + ip + metadata，系统级操作可空 workspaceId）

Product ──── 产品线（P3：多项目同属一条产品线）
  ├─ ownerId          产品负责人（自动拥有产品级管理权）
  ├─ Workspace[]      关联的项目（工作区）
  └─ ProductVersion[] 版本（planning→in_progress→released→archived + releaseNotes 发布说明）

SystemConfig ── 全局单例（AI baseURL/加密Key/model/temperature）
```


## 架构决策

| 决策 | 方案 |
|------|------|
| 工作区隔离 | `X-Workspace-Id` HTTP header（不进 JWT，切换无需重登录） |
| RBAC | WorkspaceMember.role = admin\|pm\|dev\|qa\|po；全局 system_admin 管理 AI 配置 |
| 产品层级 | Product（产品线）→ Workspace（项目）→ Task；产品级视图按"产品负责人/任一项目 po-admin"授权 |
| API 密钥安全 | AES-256-GCM 加密存储，前端只返回掩码 `••••abcd` |
| 文件存储 | multer diskStorage → `uploads/<workspaceId>/<uuid>.<ext>`，可平滑迁移 S3 |
| 实时推送 | socket.io · JWT 握手认证 · workspace 房间 · 通知创建即推送 · 在线状态 presence 广播 |
| AI 代理 | 前端 → 后端 `/api/ai/*` → 外部 LLM，支持流式 SSE |
| 看板交互 | HTML5 drag & drop 拖拽改阶段（无第三方库） |
| 通知过滤 | notify.ts 按收件人 UserSettings 偏好过滤（@提及/指派/截止） |
| 初始化 | 启动时 ensureSystemAdmin（.env 配置或随机密码打印）；首用户注册自动播种演示项目 |


## 环境变量

### 后端（slpm-server/.env）

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/slpm?schema=public"
JWT_SECRET="change-me-to-a-long-random-string"
JWT_EXPIRES_IN="7d"
PORT=8080
NODE_ENV=development
CLIENT_ORIGIN="http://localhost:3000"
AI_ENCRYPTION_KEY="change-me-to-another-random-string"
UPLOAD_DIR=uploads                    # 文件存储根目录（可选）
INITIAL_ADMIN_EMAIL=admin@slpm.local  # 超级管理员初始化（可选，未配置则随机密码打印到控制台）
INITIAL_ADMIN_PASSWORD=your-password  # 同上（可选）
```

### 前端（slpm-src/.env）

```
VITE_API_BASE_URL=/api        # 开发走 vite proxy；生产可指向后端域名
VITE_WS_URL=                  # WebSocket 地址（可选；开发直连 :8080，生产同源）
```


## 常用命令

### 后端

```bash
npm run dev               # 开发模式（tsx watch 热重载）
npm run build             # 编译到 dist/
npx prisma studio         # 可视化数据库
npx prisma migrate dev    # 改 schema 后生成迁移
npx prisma migrate deploy # 应用未执行的迁移（部署用）
npm run seed:demo         # 手动播种演示数据（demo@slpm.local / demo1234）
```

### 前端

```bash
npm run dev               # 开发模式（:3000）
npm run build             # 生产构建
```

### E2E（项目根目录）

```bash
npm run test:e2e          # Playwright 冒烟测试（需前后端已启动）
npm run test:e2e:headed   # 有头模式（可视化调试）
```

---

## 鸣谢

本项目的前端设计系统与交互原型衍生自以下两个优秀的开源项目，在此致以诚挚感谢：

- [cuberfry68-coder/slpm](https://github.com/cuberfry68-coder/slpm) — 原始 SLPM 设计灵感与概念原型
- [lllll081926i/wxbuddy](https://github.com/lllll081926i/wxbuddy) — Liquid Glass 高保真交互原型

SLPM 在这些基础上实现了完整的后端数据持久化、多工作区租户隔离、RBAC 权限、真实 AI 集成、WebSocket 实时推送和项目管理核心功能。
