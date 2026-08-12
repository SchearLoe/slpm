/**
 * 种子脚本：以 SLPM 项目本身为蓝本，填充产品线 / 工作区 / 人员 / 任务等演示数据。
 *
 * 用法： npm run seed:projects
 *
 * 幂等：以 Product.slug = 'slpm-platform' 为标志，已存在则整体跳过。
 * 所有演示账号密码统一为 demo1234（方便切换视角查看）。
 */
import { prisma } from '../src/lib/prisma.js';
import { logger } from '../src/lib/logger.js';

// ─── 时间工具 ───────────────────────────────────────────────
const NOW = Date.now();
const DAY = 24 * 3600 * 1000;
const daysAgo = (n: number) => new Date(NOW - n * DAY);
const daysAhead = (n: number) => new Date(NOW + n * DAY);

// ─── 演示人员 ───────────────────────────────────────────────
interface DemoUser {
  name: string;
  email: string;
  jobTitle: string;
  systemRole: 'system_admin' | '成员';
  wsRole: 'admin' | 'member';
  avatarColor: string;
}

const TEAM: DemoUser[] = [
  { name: '张三', email: 'zhangsan@slpm.local', jobTitle: '产品负责人', systemRole: 'system_admin', wsRole: 'admin', avatarColor: 'emerald' },
  { name: '李四', email: 'lisi@slpm.local', jobTitle: '前端工程师', systemRole: '成员', wsRole: 'member', avatarColor: 'cyan' },
  { name: '王五', email: 'wangwu@slpm.local', jobTitle: '后端工程师', systemRole: '成员', wsRole: 'member', avatarColor: 'purple' },
  { name: '赵六', email: 'zhaoliu@slpm.local', jobTitle: 'UI/UX 设计师', systemRole: '成员', wsRole: 'member', avatarColor: 'cyan' },
  { name: '孙七', email: 'sunqi@slpm.local', jobTitle: '测试工程师', systemRole: '成员', wsRole: 'member', avatarColor: 'purple' },
  { name: '周八', email: 'zhouba@slpm.local', jobTitle: 'DevOps 工程师', systemRole: '成员', wsRole: 'member', avatarColor: 'emerald' },
];

const DEMO_PASSWORD = 'demo1234';

async function main() {
  // ── 幂等检查 ──────────────────────────────────────────────
  const existing = await prisma.product.findUnique({ where: { slug: 'slpm-platform' } });
  if (existing) {
    logger.log('⚠️  演示产品线（slpm-platform）已存在，跳过种子。如需重建请先 db:reset。');
    return;
  }

  const bcrypt = (await import('bcryptjs')).default;
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  logger.log('🔐 已生成密码哈希（bcrypt rounds=12）');

  // ── 1. 创建团队账号 ───────────────────────────────────────
  const users: Record<string, { id: string; name: string }> = {};
  for (const m of TEAM) {
    const u = await prisma.user.create({
      data: {
        email: m.email,
        passwordHash,
        name: m.name,
        role: m.systemRole,
        jobTitle: m.jobTitle,
        settings: { create: { accentColor: m.avatarColor } },
      },
    });
    users[m.name] = { id: u.id, name: u.name };
    logger.log(`  👤 ${m.name.padEnd(4)} ${m.email.padEnd(24)} ${m.jobTitle}`);
  }

  // ── 2. 创建产品线 ─────────────────────────────────────────
  const product = await prisma.product.create({
    data: {
      name: 'SLPM 智能液态项目管理',
      slug: 'slpm-platform',
      description:
        '全栈 TypeScript 项目管理系统 —— React 19 + Vite 6 + Node.js + Express + Prisma + PostgreSQL。' +
        '液态玻璃（Liquid Glass）设计语言，支持多租户、产品线/版本、甘特图、看板、知识库、AI 建议等。',
      ownerId: users['张三'].id,
    },
  });

  // ── 3. 产品版本 ───────────────────────────────────────────
  const versions = {
    v1: await prisma.productVersion.create({
      data: {
        productId: product.id,
        name: 'v1.0.0',
        description: '初代发布：任务管理 + 用户认证 + 液态玻璃 UI',
        releaseNotes: '基础看板、四阶段流转（需求评审→产品设计→开发实现→测试验证）、JWT 登录、LiquidModal 组件库。',
        status: 'released',
        startDate: daysAgo(90),
        releaseDate: daysAgo(60),
        order: 1,
      },
    }),
    v15: await prisma.productVersion.create({
      data: {
        productId: product.id,
        name: 'v1.5.0',
        description: '产品线 & 甘特图：多产品线管理、版本规划、任务依赖',
        releaseNotes: 'Product→Workspace→Task 三级层次、甘特图视图、任务依赖关系、文件上传与版本管理、日程日历。',
        status: 'released',
        startDate: daysAgo(50),
        releaseDate: daysAgo(30),
        order: 2,
      },
    }),
    v2: await prisma.productVersion.create({
      data: {
        productId: product.id,
        name: 'v2.0.0',
        description: '安全加固 & 体验升级：标签库、审计日志、全局命令面板、三态设计',
        releaseNotes: '安全加固（限流/Helmet/JWT tokenVersion/上传校验）、全局命令面板 Cmd+K、加载/空/错误三态、ConfirmDialog、批量操作。',
        status: 'in_progress',
        startDate: daysAgo(20),
        order: 3,
      },
    }),
  };
  logger.log(`📦 产品线「${product.name}」+ 3 个版本已创建`);

  // ── 4. 工作区（关联产品线）────────────────────────────────
  const workspace = await prisma.workspace.create({
    data: {
      name: 'SLPM 核心研发',
      slug: 'slpm-core',
      productId: product.id,
      members: {
        create: TEAM.map((m) => ({ userId: users[m.name].id, role: m.wsRole })),
      },
    },
  });

  // ── 5. 标签库 ─────────────────────────────────────────────
  const tagDefs: { name: string; color: string }[] = [
    { name: '前端', color: 'cyan' },
    { name: '后端', color: 'purple' },
    { name: '安全', color: 'emerald' },
    { name: 'UX', color: 'cyan' },
    { name: '性能', color: 'emerald' },
    { name: '数据库', color: 'purple' },
    { name: 'AI', color: 'cyan' },
    { name: 'Bug', color: 'emerald' },
    { name: '架构', color: 'purple' },
    { name: '体验', color: 'cyan' },
  ];
  for (const t of tagDefs) {
    await prisma.tag.create({
      data: { name: t.name, color: t.color, workspaceId: workspace.id, createdBy: users['张三'].id },
    });
  }

  // ── 6. 任务定义 ───────────────────────────────────────────
  // 基于 SLPM 真实迭代历程（P1~P9）映射到四阶段
  interface TaskDef {
    title: string;
    phase: '需求评审' | '产品设计' | '开发实现' | '测试验证';
    priority: '高' | '中' | '低';
    status: '已完成' | '进行中' | '待处理' | '已延期';
    assignee: string;
    owner: string;
    version?: 'v1' | 'v15' | 'v2';
    tags: string[];
    description: string;
    start?: number; // daysAgo(n) or daysAhead(n) 由正负决定
    deadline: number;
    estimatedHours?: number;
    spentHours?: number;
    milestone?: boolean;
    checklist?: string[];
  }

  const taskDefs: TaskDef[] = [
    // ── 需求评审 ──────────────────────────────────
    {
      title: '需求收集：多租户与权限模型设计',
      phase: '需求评审', priority: '高', status: '已完成', assignee: '张三', owner: '张三', version: 'v1',
      tags: ['架构', '安全'], description: '设计 Workspace → WorkspaceMember 多租户隔离方案，区分系统角色（system_admin/成员）与工作区角色（admin/member）。',
      start: 88, deadline: -82, estimatedHours: 16, spentHours: 18,
    },
    {
      title: '需求收集：产品线 / 版本管理',
      phase: '需求评审', priority: '中', status: '已完成', assignee: '张三', owner: '张三', version: 'v15',
      tags: ['架构'], description: 'Product → ProductVersion 层次模型，支持版本状态流转（planning → in_progress → released → archived）。',
      start: 48, deadline: -44, estimatedHours: 12, spentHours: 10,
    },
    {
      title: '需求评审：安全加固方案（限流 / JWT / 上传校验）',
      phase: '需求评审', priority: '高', status: '已完成', assignee: '张三', owner: '张三', version: 'v2',
      tags: ['安全', '架构'], description: '梳理 P5-P9 安全需求：express-rate-limit 接口限流、Helmet 头部加固、JWT tokenVersion 会话吊销、multer + file-type 文件类型白名单。',
      start: 18, deadline: -14, estimatedHours: 20, spentHours: 22,
    },
    {
      title: '需求评审：AI 智能任务建议',
      phase: '需求评审', priority: '中', status: '进行中', assignee: '张三', owner: '张三', version: 'v2',
      tags: ['AI'], description: '对接大模型 API，根据任务标题/描述自动建议优先级、预估工时、标签。支持流式输出（SSE）和 Token 用量统计。',
      start: 5, deadline: 7, estimatedHours: 16,
    },

    // ── 产品设计 ──────────────────────────────────
    {
      title: '设计：液态玻璃（Liquid Glass）设计系统',
      phase: '产品设计', priority: '高', status: '已完成', assignee: '赵六', owner: '张三', version: 'v1',
      tags: ['UX', '前端'], description: '定义 LiquidModal、LiquidSelect、LiquidBtn 等核心组件，毛玻璃质感 + 弹簧动画 + 微光高亮线条。Tailwind CSS v4 原子类实现。',
      start: 85, deadline: -70, estimatedHours: 32, spentHours: 35,
    },
    {
      title: '设计：看板 / 甘特图 / 日历三视图',
      phase: '产品设计', priority: '高', status: '已完成', assignee: '赵六', owner: '张三', version: 'v15',
      tags: ['UX', '前端'], description: '任务列表看板按四阶段分列；甘特图按 startDate/deadline 自动排布 + 依赖箭头；日历视图展示日程事件。',
      start: 45, deadline: -35, estimatedHours: 24, spentHours: 26,
    },
    {
      title: '设计：全局命令面板交互（Cmd+K）',
      phase: '产品设计', priority: '中', status: '已完成', assignee: '赵六', owner: '张三', version: 'v2',
      tags: ['UX', '体验'], description: '快捷键唤出命令面板，支持搜索任务、快速导航、创建操作。Framer Motion 弹出动画 + 键盘上下选。',
      start: 16, deadline: -10, estimatedHours: 12, spentHours: 14,
    },
    {
      title: '设计：移动端响应式适配',
      phase: '产品设计', priority: '中', status: '进行中', assignee: '赵六', owner: '张三', version: 'v2',
      tags: ['UX', '前端'], description: 'TopBar / 侧边栏 / 看板在小屏幕下的折叠与抽屉式交互优化。断点 sm/md/lg 三级适配。',
      start: 3, deadline: 10, estimatedHours: 20,
    },

    // ── 开发实现 ──────────────────────────────────
    {
      title: '开发：用户认证与 JWT 会话管理',
      phase: '开发实现', priority: '高', status: '已完成', assignee: '王五', owner: '张三', version: 'v1',
      tags: ['后端', '安全'], description: 'Express + bcryptjs 注册/登录，JWT 签发与校验中间件。tokenVersion 支持一键吊销所有会话。',
      start: 82, deadline: -65, estimatedHours: 24, spentHours: 28,
    },
    {
      title: '开发：任务 CRUD + 四阶段流转',
      phase: '开发实现', priority: '高', status: '已完成', assignee: '王五', owner: '张三', version: 'v1',
      tags: ['后端', '数据库'], description: 'Prisma Task 模型，phase/priority/status 字段约定值，分页查询 + 按工作区隔离。',
      start: 80, deadline: -62, estimatedHours: 28, spentHours: 30,
    },
    {
      title: '开发：React 19 + Vite 6 前端架构',
      phase: '开发实现', priority: '高', status: '已完成', assignee: '李四', owner: '张三', version: 'v1',
      tags: ['前端', '架构'], description: '搭建 React 19 + Vite 6 + Tailwind v4 + Framer Motion 项目骨架，TanStack Query 数据层，React Router 路由。',
      start: 86, deadline: -68, estimatedHours: 32, spentHours: 30,
    },
    {
      title: '开发：LiquidModal / Select 等 UI 组件库',
      phase: '开发实现', priority: '高', status: '已完成', assignee: '李四', owner: '张三', version: 'v1',
      tags: ['前端', 'UX'], description: 'LiquidModal（max-h 滚动 + 弹簧动画）、LiquidSelect（毛玻璃下拉）、ConfirmDialog、TagPicker 等可复用组件。',
      start: 78, deadline: -60, estimatedHours: 36, spentHours: 40,
    },
    {
      title: '开发：文件上传与版本管理',
      phase: '开发实现', priority: '中', status: '已完成', assignee: '王五', owner: '张三', version: 'v15',
      tags: ['后端', '数据库'], description: 'multer 多文件上传 + file-type 魔数校验，按工作区分目录存储，FileVersion 版本链。',
      start: 42, deadline: -32, estimatedHours: 20, spentHours: 18,
    },
    {
      title: '开发：甘特图 + 任务依赖',
      phase: '开发实现', priority: '高', status: '已完成', assignee: '李四', owner: '张三', version: 'v15',
      tags: ['前端'], description: 'TaskDependency 阻塞关系建模，甘特图横向时间轴 + 依赖箭头 + 里程碑标记。',
      start: 40, deadline: -28, estimatedHours: 28, spentHours: 32,
    },
    {
      title: '开发：标签库 + 任务清单 + 审计日志',
      phase: '开发实现', priority: '中', status: '已完成', assignee: '王五', owner: '张三', version: 'v2',
      tags: ['后端', '数据库'], description: 'Tag 工作区级标签库（按名称关联）、TaskChecklistItem 子清单、AuditLog 系统操作审计。',
      start: 15, deadline: -8, estimatedHours: 24, spentHours: 26,
    },
    {
      title: '开发：限流 / Helmet / 上传校验安全加固',
      phase: '开发实现', priority: '高', status: '已完成', assignee: '王五', owner: '张三', version: 'v2',
      tags: ['安全', '后端'], description: 'express-rate-limit 登录/注册/API 限流，Helmet 安全头，multer 大小限制 + file-type 白名单，JWT tokenVersion。',
      start: 14, deadline: -6, estimatedHours: 20, spentHours: 22,
    },
    {
      title: '开发：全局命令面板（Cmd+K）',
      phase: '开发实现', priority: '中', status: '已完成', assignee: '李四', owner: '张三', version: 'v2',
      tags: ['前端', '体验'], description: '⌘K / Ctrl+K 全局唤出，Fuzzy Search 任务标题，键盘导航，快速跳转 + 创建入口。',
      start: 12, deadline: -4, estimatedHours: 16, spentHours: 18,
    },
    {
      title: '开发：加载 / 空 / 错误三态全面接入',
      phase: '开发实现', priority: '中', status: '已完成', assignee: '李四', owner: '张三', version: 'v2',
      tags: ['前端', '体验'], description: 'TanStack Query isLoading/isError/isFetching 统一封装，LiquidSpinner 加载态、LiquidEmpty 空态、ErrorBoundary 错误边界。',
      start: 10, deadline: -2, estimatedHours: 18, spentHours: 16,
    },
    {
      title: '开发：AI 智能建议后端接口',
      phase: '开发实现', priority: '中', status: '进行中', assignee: '王五', owner: '张三', version: 'v2',
      tags: ['AI', '后端'], description: '对接大模型 API（SystemConfig 加密存储 Key），/ai/suggest-stream SSE 流式返回，AiUsageRecord Token 计量。',
      start: 4, deadline: 9, estimatedHours: 24,
    },
    {
      title: '开发：看板拖拽排序',
      phase: '开发实现', priority: '中', status: '进行中', assignee: '李四', owner: '张三', version: 'v2',
      tags: ['前端', 'UX'], description: '看板列内拖拽调整顺序 + 跨列拖拽切换阶段，Framer Motion Reorder + 乐观更新。',
      start: 2, deadline: 12, estimatedHours: 20, checklist: ['调研 dnd-kit vs Reorder API', '实现列内拖拽', '实现跨列阶段切换', '乐观更新 + 失败回滚'],
    },
    {
      title: 'Bug 修复：弹窗高度溢出 + 表单紧凑化',
      phase: '开发实现', priority: '高', status: '已完成', assignee: '李四', owner: '张三', version: 'v2',
      tags: ['Bug', '前端'], description: 'LiquidModal 增加 max-h-[85vh] + overflow-y-auto，解决多字段弹窗标题被挤出可视区。NewTaskModal 截止时间/工时合并双列。',
      start: 1, deadline: 0, estimatedHours: 4, spentHours: 3,
    },

    // ── 测试验证 ──────────────────────────────────
    {
      title: '测试：认证与权限链路回归',
      phase: '测试验证', priority: '高', status: '已完成', assignee: '孙七', owner: '张三', version: 'v1',
      tags: ['安全'], description: '注册/登录/JWT 校验/权限隔离端到端验证，覆盖 tokenVersion 吊销场景。',
      start: 65, deadline: -58, estimatedHours: 12, spentHours: 14,
    },
    {
      title: '测试：核心业务链路回归测试',
      phase: '测试验证', priority: '高', status: '进行中', assignee: '孙七', owner: '张三', version: 'v2',
      tags: ['安全', '数据库'], description: 'v2.0 全功能回归：任务流转、标签库、批量操作、文件上传、日程、知识库。',
      start: 3, deadline: 6, estimatedHours: 20,
    },
    {
      title: '测试：安全渗透测试（XSS / CSRF / SSRF）',
      phase: '测试验证', priority: '高', status: '待处理', assignee: '孙七', owner: '张三', version: 'v2',
      tags: ['安全'], description: '使用 OWASP ZAP / Burp Suite 进行 Web 安全扫描，验证 Helmet 头、CORS、输入校验、文件上传防护。',
      deadline: 14, estimatedHours: 24,
    },
    {
      title: '测试：性能压测（并发 / 分页）',
      phase: '测试验证', priority: '中', status: '待处理', assignee: '周八', owner: '张三', version: 'v2',
      tags: ['性能', '后端'], description: '用 k6 / autocannon 对核心 API 压测，验证分页查询性能、限流阈值、数据库索引覆盖。',
      deadline: 16, estimatedHours: 16,
    },

    // ── 里程碑 ────────────────────────────────────
    {
      title: '🏁 里程碑：v1.0.0 初代发布',
      phase: '测试验证', priority: '高', status: '已完成', assignee: '张三', owner: '张三', version: 'v1',
      tags: ['架构'], description: 'SLPM 首个正式版本上线，覆盖任务管理核心闭环。',
      start: 62, deadline: -60, estimatedHours: 0, milestone: true,
    },
    {
      title: '🏁 里程碑：v1.5.0 产品线 & 甘特图',
      phase: '测试验证', priority: '高', status: '已完成', assignee: '张三', owner: '张三', version: 'v15',
      tags: ['架构'], description: '产品线/版本管理 + 甘特图 + 文件管理上线。',
      start: 32, deadline: -30, estimatedHours: 0, milestone: true,
    },
    {
      title: '🏁 里程碑：v2.0.0 安全加固 & 体验升级',
      phase: '测试验证', priority: '高', status: '进行中', assignee: '张三', owner: '张三', version: 'v2',
      tags: ['架构', '安全'], description: '安全加固 + 标签库 + 审计 + 命令面板 + 三态体验全面升级。目标：通过安全渗透测试后发布。',
      start: 10, deadline: 18, estimatedHours: 0, milestone: true,
    },
  ];

  // ── 7. 批量创建任务 ───────────────────────────────────────
  const createdTasks: Record<string, string> = {}; // title → taskId
  let taskCount = 0;
  for (const def of taskDefs) {
    const task = await prisma.task.create({
      data: {
        title: def.title,
        description: def.description,
        phase: def.phase,
        priority: def.priority,
        status: def.status,
        tags: def.tags,
        assigneeId: users[def.assignee].id,
        ownerId: users[def.owner].id,
        workspaceId: workspace.id,
        productVersionId: def.version ? versions[def.version].id : null,
        startDate: def.start !== undefined ? (def.start >= 0 ? daysAhead(def.start) : daysAgo(-def.start)) : null,
        deadline: def.deadline >= 0 ? daysAhead(def.deadline) : daysAgo(-def.deadline),
        estimatedHours: def.estimatedHours ?? null,
        spentHours: def.spentHours ?? 0,
        milestone: def.milestone ?? false,
      },
    });
    createdTasks[def.title] = task.id;
    taskCount++;

    // 里程碑 / 已完成任务记录完成活动
    if (def.status === '已完成') {
      await prisma.taskActivity.create({
        data: {
          taskId: task.id,
          actorId: users[def.assignee].id,
          action: '完成任务',
          detail: `${def.estimatedHours ?? 0}h 预估 / ${def.spentHours ?? 0}h 实际`,
        },
      });
    }
    // 创建活动（所有任务）
    await prisma.taskActivity.create({
      data: { taskId: task.id, actorId: users[def.owner].id, action: '创建任务', detail: `阶段：${def.phase}` },
    });

    // Checklist
    if (def.checklist) {
      await prisma.taskChecklistItem.createMany({
        data: def.checklist.map((content, i) => ({
          taskId: task.id,
          content,
          done: i < 1, // 第一项已完成
          order: i,
        })),
      });
    }
  }

  // ── 8. 任务依赖（甘特图阻塞关系）──────────────────────────
  const dep = (a: string, b: string) =>
    prisma.taskDependency.create({
      data: { taskId: createdTasks[a]!, dependsOnTaskId: createdTasks[b]! },
    });

  await dep('开发：用户认证与 JWT 会话管理', '需求收集：多租户与权限模型设计');
  await dep('开发：任务 CRUD + 四阶段流转', '需求收集：多租户与权限模型设计');
  await dep('开发：LiquidModal / Select 等 UI 组件库', '设计：液态玻璃（Liquid Glass）设计系统');
  await dep('开发：甘特图 + 任务依赖', '设计：看板 / 甘特图 / 日历三视图');
  await dep('开发：全局命令面板（Cmd+K）', '设计：全局命令面板交互（Cmd+K）');
  await dep('开发：AI 智能建议后端接口', '需求评审：AI 智能任务建议');
  await dep('测试：安全渗透测试（XSS / CSRF / SSRF）', '开发：限流 / Helmet / 上传校验安全加固');
  await dep('🏁 里程碑：v2.0.0 安全加固 & 体验升级', '测试：核心业务链路回归测试');

  // ── 9. 任务评论（含 @ 提及）──────────────────────────────
  const addComment = async (taskTitle: string, author: string, body: string, mentions: string[] = []) => {
    await prisma.taskComment.create({
      data: {
        taskId: createdTasks[taskTitle]!,
        authorId: users[author].id,
        body,
        mentions,
      },
    });
    // 评论活动
    await prisma.taskActivity.create({
      data: { taskId: createdTasks[taskTitle]!, actorId: users[author].id, action: '发表评论' },
    });
  };

  await addComment('开发：React 19 + Vite 6 前端架构', '赵六',
    '设计稿已出，@李四 可以开始搭建前端骨架了。Tailwind v4 的 @theme 配置参考知识库「液态玻璃设计语言」文档。', ['李四']);
  await addComment('开发：React 19 + Vite 6 前端架构', '李四', '收到！Vite 6 + React 19 已跑通 HMR，下午提交初版。');
  await addComment('开发：限流 / Helmet / 上传校验安全加固', '张三',
    '@王五 这块优先级提到最高，上线前必须完成。参考 P5 安全清单逐项过。', ['王五']);
  await addComment('开发：限流 / Helmet / 上传校验安全加固', '王五', '已完成 rate-limit + Helmet，file-type 白名单在校验中。');
  await addComment('Bug 修复：弹窗高度溢出 + 表单紧凑化', '张三',
    '反馈：点击新增任务后标题被挤出可视区。@李四 排查一下 LiquidModal 的高度约束。', ['李四']);
  await addComment('Bug 修复：弹窗高度溢出 + 表单紧凑化', '李四',
    '已修复：panel 加 max-h-[85vh] flex flex-col，内容区 overflow-y-auto。同时把截止时间/工时合并双列。');
  await addComment('测试：安全渗透测试（XSS / CSRF / SSRF）', '孙七',
    '需要 @王五 配合提供测试环境 + 测试账号，限流阈值调低方便验证。', ['王五']);
  await addComment('开发：看板拖拽排序', '李四', 'dnd-kit 和 Framer Reorder 都可以，我倾向 Reorder 更轻量。@赵六 拖拽动效有什么要求？', ['赵六']);

  // ── 10. 日程事件 ──────────────────────────────────────────
  const standup = daysAhead(1);
  standup.setHours(9, 30, 0, 0);
  const review = daysAhead(3);
  review.setHours(14, 0, 0, 0);
  const release = daysAhead(17);
  release.setHours(10, 0, 0, 0);
  const retro = daysAgo(2);
  retro.setHours(16, 0, 0, 0);

  await prisma.scheduleEvent.createMany({
    data: [
      {
        title: '每日站会', startTime: standup, endTime: new Date(standup.getTime() + 15 * 60 * 1000),
        location: '线上 / 飞书会议', priority: '中', attendees: TEAM.map((m) => m.name),
        status: '待开始', ownerId: users['张三'].id, workspaceId: workspace.id,
      },
      {
        title: 'v2.0 发布评审会', startTime: review, endTime: new Date(review.getTime() + 90 * 60 * 1000),
        location: '会议室 A', priority: '高', attendees: ['张三', '王五', '孙七', '周八'],
        status: '待开始', ownerId: users['张三'].id, workspaceId: workspace.id,
      },
      {
        title: 'v2.0.0 正式发布会', startTime: release, endTime: new Date(release.getTime() + 60 * 60 * 1000),
        location: '全员', priority: '高', attendees: TEAM.map((m) => m.name),
        status: '待开始', ownerId: users['张三'].id, workspaceId: workspace.id,
      },
      {
        title: 'v1.5 迭代回顾', startTime: retro, endTime: new Date(retro.getTime() + 60 * 60 * 1000),
        location: '会议室 B', priority: '中', attendees: TEAM.map((m) => m.name),
        status: '已结束', ownerId: users['张三'].id, workspaceId: workspace.id,
      },
    ],
  });

  // ── 11. 知识库文章 ────────────────────────────────────────
  await prisma.knowledgeArticle.createMany({
    data: [
      {
        title: 'SLPM 全栈技术架构',
        category: '技术架构',
        body: '## 技术栈\n\n- **前端**：React 19 + Vite 6 + Tailwind CSS v4 + Framer Motion + TanStack Query\n- **后端**：Node.js + Express + TypeScript + Prisma 5 + PostgreSQL 16\n- **认证**：JWT + bcryptjs（cost=12）+ tokenVersion 会话吊销\n- **文件**：multer + file-type 魔数校验，按工作区分目录\n- **AI**：大模型 API + SSE 流式 + AES-256-GCM Key 加密\n\n## 数据模型层次\n\n`Product → Workspace → Task`，Workspace 为多租户隔离边界。',
        authorId: users['王五'].id, workspaceId: workspace.id, views: 128, pinned: true,
      },
      {
        title: '液态玻璃设计语言规范',
        category: 'UI/UX 规范',
        body: '## 核心组件\n\n- **LiquidModal**：毛玻璃背景 + 顶部微光高亮线 + 弹簧动画，max-h-[85vh] 内部滚动\n- **LiquidSelect**：下拉浮层毛玻璃，选中态 emerald 描边\n- **LiquidBtn**：primary / ghost 两种变体，hover 微光\n\n## 动画规范\n\n弹簧刚度 360、阻尼 26，入场 blur(12px)→blur(0px) 过渡。',
        authorId: users['赵六'].id, workspaceId: workspace.id, views: 95, pinned: true,
      },
      {
        title: 'P1~P9 迭代开发流程',
        category: '团队流程',
        body: '## 迭代节奏\n\n每个 Phase（P1~P9）聚焦一个主题：\n\n- **P1-P2**：多租户 + 任务管理基础\n- **P3-P4**：产品线 / 版本 / 甘特图\n- **P5**：安全加固（限流 / 上传 / 错误边界）\n- **P6**：标签库 + 审计 + 批量操作\n- **P7-P8**：安全深化 + 命令面板\n- **P9**：三态体验 + 交互修复\n\n## 任务流转\n\n`需求评审 → 产品设计 → 开发实现 → 测试验证`',
        authorId: users['张三'].id, workspaceId: workspace.id, views: 76,
      },
      {
        title: '代码审查 & 质量保障清单',
        category: '质量保障',
        body: '## Code Review 必查项\n\n- [ ] 输入校验（zod schema 覆盖所有 body/query）\n- [ ] 权限检查（workspaceMember 校验）\n- [ ] SQL 注入防护（Prisma 参数化查询）\n- [ ] 文件上传校验（大小 + 类型白名单 + 魔数）\n- [ ] 敏感信息不落日志\n- [ ] 前端三态（loading / empty / error）覆盖\n\n## 测试要求\n\n核心链路（认证 / 任务流转 / 文件上传）必须有回归测试。',
        authorId: users['孙七'].id, workspaceId: workspace.id, views: 62,
      },
    ],
  });

  // ── 12. 通知（给每个成员发欢迎 + 分配通知）─────────────────
  for (const m of TEAM) {
    await prisma.notification.create({
      data: {
        userId: users[m.name].id,
        workspaceId: workspace.id,
        type: 'system',
        title: `欢迎加入「SLPM 核心研发」🎉`,
        body: `${m.name}，你已被添加为工作区${m.wsRole === 'admin' ? '管理员' : '成员'}。去看看你负责的任务吧！`,
        read: false,
      },
    });
  }
  // 给李四和王五发任务分配通知
  await prisma.notification.create({
    data: { userId: users['李四'].id, workspaceId: workspace.id, type: 'assign',
      title: '张三 给你分配了任务', body: '「开发：看板拖拽排序」', taskId: createdTasks['开发：看板拖拽排序'], read: false },
  });
  await prisma.notification.create({
    data: { userId: users['王五'].id, workspaceId: workspace.id, type: 'assign',
      title: '张三 给你分配了任务', body: '「开发：AI 智能建议后端接口」', taskId: createdTasks['开发：AI 智能建议后端接口'], read: false },
  });

  // ── 13. 审计日志 ──────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { actorId: users['张三'].id, workspaceId: workspace.id, action: 'product_create', target: product.name,
        metadata: { slug: product.slug }, ip: '127.0.0.1', userAgent: 'seed-script' },
      { actorId: users['张三'].id, workspaceId: workspace.id, action: 'member_invite', target: '李四 / 王五 / 赵六 / 孙七 / 周八',
        metadata: { count: 5 }, ip: '127.0.0.1', userAgent: 'seed-script' },
    ],
  });

  // ── 汇总 ──────────────────────────────────────────────────
  logger.log('');
  logger.log('════════════════════════════════════════════');
  logger.log(`✅ SLPM 演示数据种子完成！`);
  logger.log(`   👥 团队成员：${TEAM.length} 人（密码统一 ${DEMO_PASSWORD}）`);
  logger.log(`   📦 产品线：${product.name}（3 个版本）`);
  logger.log(`   🏗  工作区：${workspace.name}`);
  logger.log(`   📋 任务：${taskCount} 条（覆盖四阶段 + 里程碑 + 依赖 + 评论）`);
  logger.log(`   🏷  标签：${tagDefs.length} 个`);
  logger.log(`   📅 日程：4 条 ｜ 📝 知识库：4 篇 ｜ 🔔 通知：${TEAM.length + 2} 条`);
  logger.log(`   📋 测试账号：`);
  for (const m of TEAM) {
    logger.log(`      ${m.name.padEnd(4)} ${m.email.padEnd(24)} ${m.jobTitle}`);
  }
  logger.log('════════════════════════════════════════════');
}

main()
  .catch((e) => {
    logger.error('❌ 种子失败：', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
