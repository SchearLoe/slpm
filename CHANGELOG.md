# 更新日志

本文件记录 SLPM（Smart Liquid Project Manager）项目的所有功能演进。按日期倒序排列。

---

## 2026-08-05

### P4-2（续）：产品线深化 —— 路线图 + 需求池 + 跨项目指派 + Release Notes

**数据模型（1 迁移）**
- ProductVersion 加 `releaseNotes String @default("")`（发布说明）

**后端**
- `product-version.routes.ts`：create/update/GET 均支持 `releaseNotes`
- `product-dashboard.routes.ts`：新增 `PATCH /api/products/:id/tasks/:taskId` 产品级任务更新——跨项目指派负责人（目标必须是产品内成员，否则 400）/ 调整版本 / 状态 / 阶段 / 优先级；权限 = 产品级 po/admin 或任务所属工作区成员；指派变更走 notifyAssignment 通知

**前端**
- `ProductManagementPage.tsx` 从 3 Tab 扩展为 **5 Tab**：
  - **需求池（Backlog）**：未关联版本的需求列表，每条可「分配版本 / 指派负责人」下拉（真实 API）
  - **路线图（Roadmap）**：按版本开始/发布日期排布的横向时间轴（自动窗口缩放、状态着色、点击版本条查看需求）
  - 版本管理：版本卡片展示「📝 发布说明」（多行）
  - 任务详情弹窗：产品经理可跨项目指派负责人 / 分配版本 / 改状态（三个下拉，真实 API）
- `queries.ts`：新增 useUpdateProductTask

**验证**：前后端 tsc 零错误；API 冒烟通过（跨项目指派/排期到版本/非法指派 400 拦截）；浏览器 E2E 通过（5 Tab 渲染、需求池排期、路线图时间轴、发布说明展示）。测试数据已清理。

### P4-2：看板拖拽 + 任务工时/燃尽图 + 日程冲突预警 + 通知偏好

**数据模型（1 迁移，1 新字段 + 3 设置字段）**
- Task 加 `estimatedHours Float?`（预估工时，小时）
- UserSettings 加 `notifyMention` / `notifyAssign` / `notifyDeadline`（通知偏好，默认全开）

**后端**
- `task.routes.ts`：create/update 支持 `estimatedHours`（0-10000，可空）；活动流 FIELD_LABELS 加「预估工时」
- `settings.routes.ts`：GET/PUT 支持通知偏好三字段（upsert 兼容旧记录）
- `notify.ts`：`filterBySetting()` —— 发通知前按收件人的 UserSettings 过滤（关闭 @提及/指派通知的成员不打扰；记录缺失视为开启）
- `schedule.routes.ts`：`findConflicts()` —— 创建/编辑日程时检测同工作区时间重叠（同主办或参会人姓名交集，排除自身），响应带 `conflicts[]`

**前端**
- `TaskGroupList.tsx`：**看板拖拽改阶段**（HTML5 drag & drop，拖到目标阶段组即 PATCH phase，拖拽中高亮 + 源卡半透明）；阶段组头显示**预估工时小计**（如 `12h`）；任务行显示单任务工时
- `NewTaskModal.tsx` / `EditTaskModal.tsx`：预估工时输入（number，step 0.5）
- `ProjectOverviewPage.tsx`：新增**进度燃尽图**（健康 tab，SVG 曲线：按截止日期排序的剩余任务曲线 vs 理想直线，已完成/未完成/理想进度图例）
- `ScheduleManagementPage.tsx`：创建/编辑日程后若有冲突 → toast 预警（显示首个冲突日程）
- `SettingsCenterPage.tsx`：通知偏好三开关真实持久化（乐观更新 + 失败提示），其余偏好标注本地

**验证**：前后端 tsc 零错误；API 冒烟通过（工时创建/更新、通知偏好持久化、日程冲突创建/编辑检测含自身排除）；浏览器 E2E 通过（工时显示与组小计、燃尽图空态与曲线、设置页开关→后端闭环）。拖拽交互代码已实现（IAB 无法合成 HTML5 DnD 手势，逻辑审查 + 后端 PATCH 验证）。测试数据已清理。

### P4-1：演示残留清理 + 系统初始化（超级管理员 / 种子数据）

**后端**
- `auth.routes.ts`：新增 `PATCH /api/auth/me`（更新显示名称/职位）+ `POST /api/auth/avatar`（multer 头像上传，2MB 限制，存 `uploads/avatars/`）+ `GET /api/auth/avatar/:file`（静态访问，防路径穿越）
- 新增 `lib/seed.ts`：
  - `ensureSystemAdmin()` —— 服务启动时若不存在 system_admin 自动创建（优先读 .env 的 `INITIAL_ADMIN_EMAIL/INITIAL_ADMIN_PASSWORD`，未配置则随机生成密码打印到控制台供安装人员使用）
  - `seedDemoForUser()` —— 首个用户注册时自动创建「演示项目」工作区（示例任务覆盖四阶段 + 里程碑 + 甘特起始日、示例日程、知识库文章、欢迎通知），作为新装教程指引
  - `seedDemoManual()` —— `npm run seed:demo` 手动为存量库创建演示账号（demo@slpm.local / demo1234）
- `notification.routes.ts`：新增 `POST /api/notifications/send`（成员间真实站内信，需工作区上下文，收件人必须是成员，WebSocket 实时推送）
- `server.ts`：启动引导改为 async bootstrap（先 ensureSystemAdmin 再监听端口）

**前端（纯前端假数据全部去除）**
- `TopBar.tsx`：**站内信假弹窗删除**；搜索升级为**跨模块搜索**（任务/文件/知识库文章/成员，分组展示，点击跳转对应模块）；**⌘K / Ctrl+K 聚焦搜索框**（真实快捷键）；快捷菜单「预约日程」改为真实跳转
- `Sidebar.tsx`：个人资料「保存」接真实 API（PATCH /auth/me + refreshUser）；**真实头像上传**（预览 + POST /auth/avatar）；侧栏头像显示真实图片
- `AIAnalyticsPage.tsx` 全面真实化：
  - 默认建议/风险改为**规则推导**（延期任务→高风险、3 天内截止→中风险、评审积压/负荷不均→建议；AI 重算后仍用真实 LLM 输出）
  - KPI 改为真实聚合（完成率/进行中/延期/瓶颈阶段），删除「演示」标注
  - 吞吐趋势 = **按任务创建日期分桶的真实计数**（7d 每日 / 30d 每 3 天 / Q2 按周）
  - 「导出」= **真实 CSV 下载**（带 BOM 支持 Excel 中文）
  - 「创建跟进任务」= 真实创建任务；「发送协同提醒」= 真实站内信
- `ProjectOverviewPage.tsx`：删除假 KPI「研发代码提交」改为「进行中任务」；风险清单改为**真实任务自动识别**（延期/临期，点击创建真实跟进任务）；删除「订阅进度」假按钮与演示标注
- `TaskManagementPage.tsx`：删除硬编码 **CoverFlowDeck 假卡片墙**（及 DocPreviewModal），替换为 `RecentFilesPanel`（真实文件列表 + 空态引导）
- `TeamCollaborationPage.tsx`：发消息 = **真实站内信**（POST /notifications/send）；负荷饱和度改为真实归一化计算（在办数相对最高者），删除 ×10% 演示公式
- `SettingsCenterPage.tsx`：账号页真实头像上传 + 资料真保存（从真实用户初始化）；删除假会话/设备列表、假通知渠道切换（标注站内信已启用/其他未接入）；「清理缓存」= 真实清 TanStack 缓存、「立即同步」= 真实全量重拉、「导出」= 真实任务 CSV；删除假「AI 模型与推理」面板；「清空本地演示数据」改为「清除本地数据并退出」（真实 localStorage.clear + logout）
- `AISmartDetailPanel.tsx`：「标记延期」= 真实调 API 更新状态
- `types/index.ts`：删除 CardDeckItem 假类型；TaskItem 加 createdAt（吞吐聚合用）

**验证**：前后端 tsc 零错误；API 冒烟通过（资料更新/头像上传/静态访问/非法类型 400/路径穿越 400/站内信）；浏览器 E2E 通过（跨模块搜索、AI 页真实化、最近归档面板、无任何演示残留）；测试数据已清理。

### P3：产品线 + 版本管理 + 产品经理跨项目视图

**数据模型（2 迁移，2 新表 + 3 新字段）**
- 新增 `Product` 模型（id / name / slug / description / **ownerId** 产品负责人，创建者自动拥有产品级管理权）
- 新增 `ProductVersion` 模型（productId / name / description / status[planning|in_progress|released|archived] / startDate / releaseDate / order；`@@unique([productId, name])` 防重名）
- Workspace 加 `productId`（可空外键，兼容独立工作区；onDelete: SetNull）
- Task 加 `productVersionId`（可空外键，任务可关联产品版本；onDelete: SetNull）

**后端**
- 新建 `middleware/product.ts`：`requireProductAccess`（从 URL `:id` 取产品，校验用户至少是产品下任一工作区成员，注入 `req.product{productId, workspaceIds, role}`；产品负责人/任一关联工作区 po/admin 拥有写权限）+ `requireProductRole`
- 新建 `routes/product.routes.ts`：`GET /products`（用户可访问产品列表，含工作区/版本计数与最高角色）、`POST /products`（system_admin 或任一工作区 admin）、`GET/PATCH /products/:id`、`POST /products/:id/workspaces`（关联项目，需 po/admin + 目标工作区 admin，防重复归属）、`DELETE /products/:id/workspaces/:wsId`（取消关联）
- 新建 `routes/product-version.routes.ts`：版本 CRUD（`GET/POST /products/:id/versions`、`PATCH/DELETE /products/:id/versions/:vid`，重名 409，列表附任务数）
- 新建 `routes/product-dashboard.routes.ts`：跨工作区聚合（po/admin 看全产品数据，其他角色只看自己所属工作区）——`GET /products/:id/tasks`（status/phase/workspaceId/versionId/assignedToMe 筛选 + 附所属项目/版本）、`GET /products/:id/members`（跨区成员去重取最高角色 + 任务计数/延期数）、`GET /products/:id/stats`（KPI 按工作区分列 + 版本分布）
- `workspace.routes.ts`：WS_ROLES 加 `'po'`；workspaces 列表与创建支持 `productId`
- `task.routes.ts`：create/update 支持 `productVersionId`；活动流 FIELD_LABELS 加「产品版本」
- `auth.routes.ts`：`/auth/me` 的 workspaces 返回 `productId`（前端据此判断任务表单是否显示版本选择器）

**前端**
- `types/index.ts`：WsRole 加 `'po'`；NavTab 加 `'product'`；新增 Product / ProductDetail / ProductVersion / ProductTaskItem / ProductMemberSummary / ProductStats 类型
- `roleConfig.ts`：新增 po 角色（产品经理，着陆页 `product`，navOrder 产品管理置顶）
- 新建 `pages/ProductManagementPage.tsx` 三 Tab：
  - **需求总览**：跨项目 KPI 卡（总数/完成率/延期/里程碑）+ 按项目分列完成进度 + 跨项目需求列表（项目/版本/状态/阶段筛选，点击查看详情并可"在工作区打开"）
  - **版本管理**：纵向时间线（状态徽章/起止日期/需求数/完成进度条），新建/编辑/删除版本，点击查看版本内需求
  - **团队视图**：跨项目成员负荷柱状图（已完成/进行中分段色 + 角色徽章 + 所属项目徽章）
- `Sidebar.tsx`：产品线选择器（localStorage 持久化）+ 新建产品线入口；po/admin 时「产品管理」导航置顶显示
- `AppContext.tsx`：products / currentProduct / setCurrentProduct 状态（产品列表来自 `/products`）
- `queries.ts`：新增 11 个 hooks（useProducts / useCreateProduct / useUpdateProduct / useProductDetail / useLinkWorkspace / useUnlinkWorkspace / useProductVersions / useCreateProductVersion / useUpdateProductVersion / useDeleteProductVersion / useProductTasks / useProductMembers / useProductStats）
- `api.ts`：新增 productStore（`slpm_product`）
- `NewTaskModal.tsx` / `EditTaskModal.tsx`：当前工作区归属产品线且存在版本时显示「所属版本」下拉
- `App.tsx`：注册 `/product` 路由 + Tab 映射 + 页面标题

**验证**：API 全流程冒烟测试通过（建产品 → 关联项目 → 建版本 → 跨区建带版本任务 → 聚合统计 → 越权 403）；浏览器 E2E 通过（三 Tab 渲染、版本创建中文正常、任务表单版本选择器、版本统计闭环）；前后端 tsc 零错误。12 个迁移全部应用。

### P1-6：甘特图 + 任务依赖 + WebSocket 实时推送 + 文件版本历史

**数据模型（1 迁移，3 新字段 + 2 新表）**
- Task 加 `parentId`（自引用 FK，子任务层级）、`startDate`（甘特起日）、`milestone`（里程碑标记）
- Task 加反向关系 `children[]` / `blockedBy[]` / `blocks[]`
- 新增 `TaskDependency` 模型（taskId / dependsOnTaskId 阻塞依赖，唯一约束防重复）
- FileRecord 加 `currentVersion` + 反向 `versions[]`
- 新增 `FileVersion` 模型（fileId / version / originalName / mimeType / size / storagePath）

**后端**
- `task.routes.ts`：create/update schema 加 parentId / startDate / milestone / blockIds；GET 加 `?withDeps=true` 返回父子/阻塞关系
- `file.routes.ts`：上传同名文件自动归档旧版本（匹配规则：workspace + uploader + originalName）；新增 `GET /:id/versions` 版本历史 + `POST /:id/restore/:versionId` 回滚
- 新建 `lib/ws.ts`：socket.io 封装（JWT 认证、workspace 房间管理、emitToUser / emitToWorkspace）
- `server.ts`：`http.createServer(app)` 替代 `app.listen` + socket.io 挂载
- `lib/notify.ts`：通知创建后 emit WebSocket 事件（实时推送，替代轮询）

**前端**
- `ProjectTimeline.tsx` **完全重写**：从硬编码静态数组改为 useTasks() 数据驱动甘特图，自动缩放日期窗口，里程碑菱形标记 + 任务条
- `queries.ts`：加 useFileVersions / useRestoreFileVersion；useUnreadNotificationCount 移除 30s 轮询
- 新建 `lib/socket.ts`：socket.io-client 封装（connect / disconnect / onNotification）
- `AuthContext.tsx`：登录时连接 WebSocket + 收到通知时 invalidate queries
- `TaskManagementPage.tsx`：onSelectTask 改为 task.id 精确匹配

**新增 npm 包**：`socket.io`（后端）+ `socket.io-client`（前端）

### P1-5：文件预览 / 重命名 + AI 流式 + Token 统计 + 团队页增强

**数据模型**
- 新增 `AiUsageRecord` 模型（userId / workspaceId / endpoint / promptTokens / completionTokens / totalTokens）

**后端**
- `file.routes.ts`：加 `GET /:id/preview`（内联预览，Content-Disposition: inline + fs.createReadStream 管道）；加 `PATCH /:id`（重命名，更新 title 保留 originalName）
- `ai.routes.ts`：加 `POST /suggest/stream`（SSE 流式，stream_options: include_usage）；加 `GET /usage`（近 30 天聚合）；callChatCompletion 返回 usage；suggest/test 记录 AiUsageRecord
- 新增 `callChatCompletionStream` 辅助（fetch ReadableStream + SSE 解析 + client close abort）

**前端**
- `FileDocumentsPage.tsx`：预览弹窗按 mimeType 分支（image → img，pdf → iframe，else → 元数据）；重命名菜单项启用 + PATCH hook；blob URL lazy fetch
- `AISmartDetailPanel.tsx`：fetchAi 改用 streamAiSuggest（逐 token 按行切分增量渲染，AbortController 管理）
- `SettingsCenterPage.tsx`：假配额卡片替换为真实 AiUsageSummary（30 天总量 + 迷你柱图）
- `TeamCollaborationPage.tsx`：成员卡片"负荷饱和度"改为"已完成 N"

### P1-4：真实 AI 接入（系统级配置 + 任务智能建议）

**数据模型**
- 新增 `SystemConfig` 模型（全局单例，存 AI baseURL / 加密 Key / model / temperature）
- User.role 扩展 `system_admin` 值（首个注册用户自动获得）

**后端**
- 新建 `lib/crypto.ts`：AES-256-GCM 加密工具（AI_ENCRYPTION_KEY scrypt 派生）
- 新建 `middleware/admin.ts`：requireSystemAdmin（查 DB 校验 User.role）
- 新建 `routes/ai.routes.ts`：GET/PUT `/ai/config`（仅 system_admin，GET 返回掩码不暴露明文 key）；POST `/ai/test`（连通性测试）；POST `/ai/suggest`（OpenAI 兼容 chat/completions 代理，30s 超时，JSON 容错解析）
- `auth.routes.ts`：register 首用户自动 system_admin
- `config/env.ts`：加 `aiEncryptionKey`（强制 required）

**前端**
- `SettingsCenterPage.tsx`：AI 标签加「AI 服务配置（管理员）」卡片（baseURL / Key / model / 温度 + 保存 + 测试连通性），非管理员看提示
- `AISmartDetailPanel.tsx`：移除写死建议数组 + 假置信度 `(92-i*7)%`，改为点"查看建议详情"触发真实 useAiSuggest
- `AIAnalyticsPage.tsx`：「立即重算」从 setTimeout 假调用改为真实 AI

### P1-3：真实文件上传（multer + 本地磁盘）

**数据模型**
- 新增 `FileRecord` 模型（title / originalName / mimeType / size / storagePath / category / tags / uploaderId / workspaceId）

**后端**
- 安装 `multer@2.x` + `@types/multer`
- 新建 `routes/file.routes.ts`：multer diskStorage 上传（20MB 限制，存 `uploads/<workspaceId>/<uuid>.<ext>`）；GET 列表；GET `/id/download`（鉴权后 res.download）；DELETE（DB + 磁盘文件）
- `config/env.ts`：加 `uploadDir`（默认 uploads）
- `server.ts`：启动时 mkdirSync 建上传根目录
- `.gitignore`：加 `uploads/`

**前端**
- `FileDocumentsPage.tsx`：接真实 API，上传弹窗改为真实 `<input type=file>` + multipart FormData；下载改 blob 流；删除改真 API
- `AppContext.tsx`：移除 `initialFiles` 硬编码 + `files` state + `addFile` 死代码
- `TopBar.tsx`：快速文档改为跳转 `/files`

### P1-4（站内通知系统）

**数据模型**
- 新增 `Notification` 模型（userId / workspaceId / type: mention|assign|system / title / body / taskId / read）

**后端**
- 新建 `lib/notify.ts`：notifyMentions（评论 @某人）+ notifyAssignment（任务指派变更）
- 新建 `routes/notification.routes.ts`：GET 列表 / GET 未读数 / PATCH 已读 / POST 全部已读 / DELETE 清除已读
- `task.routes.ts`：评论 @提及 + 任务指派变更触发通知（fire-and-forget）

**前端**
- `TopBar.tsx`：铃铛按钮 + 未读红点 + NotificationsModal
- 新建 `NotificationsModal.tsx`：通知列表 + 点击跳转任务 + 全部已读 / 清除已读
- 30s 短轮询拉取未读数（P1-6 改为 WebSocket）

### P1-3（知识库持久化 + 团队成员真实化）

**数据模型**
- 新增 `KnowledgeArticle` 模型（title / content / category / authorId / workspaceId / views / favoritedBy）

**前端**
- `KnowledgeBasePage.tsx`：接真实 API（发布/列表/收藏/搜索/分类）
- `TeamCollaborationPage.tsx`：成员列表改用 useWorkspaceMembers（替代硬编码）；邀请/移除/改角色接真实 API；按 currentRole 禁用邀请按钮

---

## 2026-08-03

### P1-2：多工作区 + RBAC（管理员/成员两档）

**数据模型（2 迁移）**
- 新增 `Workspace` 模型（name / slug）+ `WorkspaceMember` 模型（workspaceId / userId / role: admin|member，唯一约束）
- Task / ScheduleEvent 加 `workspaceId`（先 nullable 迁移 → backfill 旧数据 → 再 NOT NULL 迁移）
- 新建 `prisma/db_scripts/backfill_workspaces.ts`：为 12 个旧用户各建默认工作区 + admin 成员记录，9 个任务 + 3 个日程归属，残留 NULL = 0

**后端**
- 新建 `middleware/workspace.ts`：requireWorkspace（读 `X-Workspace-Id` header + 校验成员资格 + 挂 `req.workspace = {id, role}`）+ requireRole(...roles) 工厂
- `task.routes.ts` / `schedule.routes.ts`：17 处 `ownerId` 过滤改 `workspaceId`，全部路由加 requireWorkspace
- 新建 `routes/workspace.routes.ts`：工作区 CRUD + 成员管理（邀请/改角色/移除，仅 admin）
- `auth.routes.ts`：register 事务建默认工作区 + admin 成员；publicUser 返回 workspaces 列表

**前端**
- `api.ts`：axios 拦截器自动注入 `X-Workspace-Id` + workspaceStore
- `AppContext.tsx`：移除硬编码工作区数组，改从 user.workspaces 派生 + currentRole 暴露
- `Sidebar.tsx`：switcher 改用 context，下拉显示真实工作区 + admin 标签
- `AuthContext.tsx`：加 refreshUser（新建工作区后刷新）
- `TeamCollaborationPage.tsx`：邀请按钮按 currentRole 禁用

### P1-1：任务评论 + 活动流

**数据模型**
- 新增 `TaskComment` 模型（taskId / authorId / body / mentions）+ `TaskActivity` 模型（taskId / actorId / action / detail）
- 全部用 onDelete: Cascade（任务删除时级联清理）

**后端**
- `task.routes.ts`：create/update/complete 自动写活动记录；update 精确生成变更文案（如「优先级：中 → 高」）
- 新增 3 个 handler：GET/POST `/:taskId/comments`、GET `/:taskId/activity`（评论+变更合并，时间倒序）
- 评论 @姓名 解析 → mentions 数组（parseMentions 辅助）

**前端**
- `AISmartDetailPanel.tsx`：详情面板插入「活动流」+「评论」section，含 @姓名 高亮、相对时间、Enter 发送

### P0：设置持久化 + 总览/分析页真实数据改造

**后端**
- 新建 `routes/settings.routes.ts`：GET/PUT `/api/settings`（zod 校验 accentColor / glassBlur / enableConfetti，upsert 落库）
- `auth.routes.ts`：publicUser 返回 settings；login/me include settings
- `server.ts`：挂载 settings 路由

**前端**
- `AppContext.tsx`：三个 useState 初始值改读 user.settings；新增 updateSettings（乐观更新 + PUT 落库）；新增 applyThemeToDOM（解决"刷新后状态恢复但 UI 不变"）
- `SettingsCenterPage.tsx`：保存按钮改为真持久化
- `NewTaskModal.tsx` / `AISmartDetailPanel.tsx`：confetti 开关真正生效
- 新建 `lib/aggregations.ts`：computeOverview / computeFunnel / computeMemberLoad 纯函数
- `ProjectOverviewPage.tsx` / `AIAnalyticsPage.tsx`：改真实数据聚合，无数据源指标明确标注【演示】

---

## 2026-08-01

### 第一期：后端地基 + 认证 + 任务/日程核心闭环

**后端（从零搭建）**
- Node.js + Express + TypeScript + Prisma + PostgreSQL 16
- 数据模型：User / UserSettings / Task / ScheduleEvent
- 认证：邮箱密码 + bcrypt + JWT（register / login / me）
- 任务 CRUD：GET 列表（status/phase/assignedToMe 过滤）/ POST 新建 / PATCH 编辑 / PATCH complete / DELETE
- 日程 CRUD：GET 按月列表（修复原 demo "只能 5 月"问题）/ POST / PUT / DELETE
- 中间件：requireAuth（JWT Bearer）、asyncHandler、ApiError、errorHandler（Prisma P2025→404 / P2002→409）

**前端（从纯前端原型改造为全栈）**
- 新建 `lib/api.ts`：axios 实例 + 请求拦截器（Bearer token）+ 响应拦截器（401 跳登录）
- 新建 `context/AuthContext.tsx`：user / login / register / logout，token 存 localStorage，启动调 /auth/me 恢复会话
- 新建 `context/QueryProvider.tsx`：TanStack Query Provider
- 新建 `lib/queries.ts`：useTasks / useCreateTask / useUpdateTask / useCompleteTask / useDeleteTask + 日程 hooks
- 新建 `components/RequireAuth.tsx`：路由守卫（未登录跳 /login）
- `App.tsx`：useState<NavTab> → BrowserRouter + 8 个 Route
- `vite.config.ts`：加 /api proxy → 后端 8080
- 清理约 18 处硬编码 Brandon → currentUser
- 新建 `pages/LoginPage.tsx`：Liquid Glass 风格登录/注册页

---

## 2026-07-31

### 项目初始化

- 基于两个开源项目搭建：
  - [cuberfry68-coder/wenxibuddy](https://github.com/cuberfry68-coder/wenxibuddy)
  - [lllll081926i/wxbuddy](https://github.com/lllll081926i/wxbuddy)
- 保留原前端 Liquid Glass 设计系统（index.css + motion.ts + 组件库）
- 项目现状评估：8 页 UI 全部填满，但纯前端、零持久化、无后端、无用户系统
- 制定全栈改造计划：第一期地基 + 任务/日程闭环，后续迭代协作/工作区/AI/文件/通知
- `init` 迁移：User / UserSettings / Task / ScheduleEvent 四表

---

> 本 CHANGELOG 由各期开发过程实时记录，对应 `wenxibuddy-server/prisma/migrations/` 的 11 个迁移历史。
