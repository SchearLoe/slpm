import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/workspace.js';
import { ApiError } from '../middleware/error.js';
import { notifyMentions, notifyAssignment } from '../lib/notify.js';

const router = Router();

// P1-1：任务变更字段的中文标签，用于活动流 detail 文案
const FIELD_LABELS: Record<string, string> = {
  title: '标题',
  description: '描述',
  phase: '阶段',
  priority: '优先级',
  status: '状态',
  deadline: '截止时间',
  tags: '标签',
  assigneeId: '负责人',
  productVersionId: '产品版本', // P3
};

// 任务查询条件校验（列表过滤）
const listQuerySchema = z.object({
  status: z
    .enum(['进行中', '已完成', '待处理', '已延期'])
    .optional(),
  phase: z
    .enum(['需求评审', '产品设计', '开发实现', '测试验证'])
    .optional(),
  assignedToMe: z.enum(['true', 'false']).optional(),
});

// 标准化优先级：原 demo 里混杂 '高优先级'/'紧急' 等杂质值，统一收敛
const PRIORITY_MAP: Record<string, string> = {
  高: '高',
  高优先级: '高',
  紧急: '高',
  中: '中',
  低: '低',
};

// ---- GET /api/tasks ----
router.get(
  '/',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ApiError(400, '查询参数错误', parsed.error.flatten());

    // P1-2：按工作区隔离（替代原 ownerId 过滤）
    const where: Record<string, unknown> = { workspaceId: req.workspace!.id };
    if (parsed.data.status) where.status = parsed.data.status;
    if (parsed.data.phase) where.phase = parsed.data.phase;
    if (parsed.data.assignedToMe === 'true') where.assigneeId = req.user!.sub;

    // P1-6：可选加载依赖关系
    const withDeps = req.query.withDeps === 'true';
    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        assignee: { select: { id: true, name: true, avatar: true, role: true } },
        ...(withDeps ? {
          parent: { select: { id: true, title: true, status: true } },
          children: { select: { id: true, title: true, status: true } },
          blockedBy: { include: { dependsOnTask: { select: { id: true, title: true, status: true } } } },
          blocks: { include: { task: { select: { id: true, title: true, status: true } } } },
        } : {}),
      },
    });

    res.json({ tasks });
  }),
);

// ---- POST /api/tasks ----
const createSchema = z.object({
  title: z.string().min(1, '标题必填').max(200),
  description: z.string().max(2000).optional().default(''),
  phase: z.enum(['需求评审', '产品设计', '开发实现', '测试验证']).optional().default('需求评审'),
  priority: z.string().optional().default('中'),
  status: z.enum(['进行中', '已完成', '待处理', '已延期']).optional().default('进行中'),
  deadline: z.string().datetime().optional().nullable(),
    // P1-6：甘特图 + 依赖
    startDate: z.string().datetime().optional().nullable(),
    milestone: z.boolean().optional().default(false),
    parentId: z.string().optional().nullable(),
    blockIds: z.array(z.string()).optional().default([]),
    tags: z.array(z.string()).optional().default([]),
    assigneeId: z.string().optional().nullable(),
    // P3：所属产品版本（可选）
    productVersionId: z.string().optional().nullable(),
});

router.post(
  '/',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());
    const d = parsed.data;

    const task = await prisma.task.create({
      data: {
        title: d.title,
        description: d.description,
        phase: d.phase,
        priority: PRIORITY_MAP[d.priority] ?? '中',
        status: d.status,
        deadline: d.deadline ? new Date(d.deadline) : null,
        startDate: d.startDate ? new Date(d.startDate) : null,
        milestone: d.milestone,
        parentId: d.parentId ?? null,
        tags: d.tags,
        assigneeId: d.assigneeId ?? req.user!.sub, // 默认指派给自己
        ownerId: req.user!.sub, // 创建者（保留，用于活动流 actor 等）
        workspaceId: req.workspace!.id, // P1-2：归属当前工作区
        productVersionId: d.productVersionId ?? null, // P3：归属产品版本（可选）
      },
      include: { assignee: { select: { id: true, name: true, avatar: true, role: true } } },
    });

    // P1-6：写入阻塞依赖
    if (d.blockIds.length > 0) {
      await prisma.taskDependency.createMany({
        data: d.blockIds.map((depId) => ({
          taskId: task.id,
          dependsOnTaskId: depId,
        })),
        skipDuplicates: true,
      }).catch(() => {});
    }

    // P1-1：写「创建任务」活动（失败仅丢日志，不影响主流程）
    await prisma.taskActivity
      .create({ data: { taskId: task.id, actorId: req.user!.sub, action: '创建任务' } })
      .catch(() => {});

    // P1-4：新建任务指派给了别人 → 通知该负责人（异步）
    notifyAssignment(task.id, req.workspace!.id, req.user!.sub, null, task.assigneeId ?? null).catch(() => {});

    res.status(201).json({ task });
  }),
);

// ---- PATCH /api/tasks/:id ----
const updateSchema = createSchema.partial();

router.patch(
  '/:id',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());
    const d = parsed.data;

    const data: Record<string, unknown> = {};
    if (d.title !== undefined) data.title = d.title;
    if (d.description !== undefined) data.description = d.description;
    if (d.phase !== undefined) data.phase = d.phase;
    if (d.priority !== undefined) data.priority = PRIORITY_MAP[d.priority] ?? '中';
    if (d.status !== undefined) data.status = d.status;
    if (d.deadline !== undefined) data.deadline = d.deadline ? new Date(d.deadline) : null;
    if (d.startDate !== undefined) data.startDate = d.startDate ? new Date(d.startDate) : null;
    if (d.milestone !== undefined) data.milestone = d.milestone;
    if (d.parentId !== undefined) data.parentId = d.parentId;
    if (d.tags !== undefined) data.tags = d.tags;
    if (d.assigneeId !== undefined) data.assigneeId = d.assigneeId;
    // P3：产品版本（可空）
    if (d.productVersionId !== undefined) data.productVersionId = d.productVersionId;

    // P1-1：读旧值用于活动流变更文案（仅当有字段变化时）
    const changedKeys = Object.keys(data);
    let before: Record<string, unknown> | null = null;
    if (changedKeys.length > 0) {
      // P1-2：按工作区过滤（替代原 ownerId）
      before = await prisma.task.findFirst({
        where: { id: req.params.id, workspaceId: req.workspace!.id },
        select: { title: true, description: true, phase: true, priority: true, status: true, deadline: true, tags: true, assigneeId: true },
      });
    }

    const task = await prisma.task.update({
      where: { id: req.params.id, workspaceId: req.workspace!.id }, // P1-2：工作区内任务
      data,
      include: { assignee: { select: { id: true, name: true, avatar: true, role: true } } },
    });

    // P1-1：对每个实际变更字段生成一条活动记录
    if (before) {
      const changes: string[] = [];
      for (const key of changedKeys) {
        const label = FIELD_LABELS[key];
        if (!label) continue;
        const oldVal = formatFieldValue(key, (before as Record<string, unknown>)[key]);
        const newVal = formatFieldValue(key, data[key]);
        if (oldVal !== newVal) changes.push(`${label}：${oldVal} → ${newVal}`);
      }
      if (changes.length > 0) {
        await prisma.taskActivity
          .create({
            data: { taskId: task.id, actorId: req.user!.sub, action: '更新字段', detail: changes.join('，') },
          })
          .catch(() => {});
      }

      // P1-4：指派变更 → 通知新负责人（异步，失败不影响编辑）
      if (changedKeys.includes('assigneeId')) {
        const oldAssignee = (before as Record<string, unknown>).assigneeId as string | null;
        notifyAssignment(task.id, req.workspace!.id, req.user!.sub, oldAssignee, task.assigneeId ?? null).catch(() => {});
      }
    }

    // P1-6：同步阻塞依赖（先删后建，简单实现）
    if (d.blockIds !== undefined) {
      await prisma.taskDependency.deleteMany({ where: { taskId: task.id } }).catch(() => {});
      if (d.blockIds.length > 0) {
        await prisma.taskDependency.createMany({
          data: d.blockIds.map((depId) => ({ taskId: task.id, dependsOnTaskId: depId })),
          skipDuplicates: true,
        }).catch(() => {});
      }
    }

    res.json({ task });
  }),
);

// ---- PATCH /api/tasks/:id/complete ----
router.patch(
  '/:id/complete',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const task = await prisma.task.update({
      where: { id: req.params.id, workspaceId: req.workspace!.id },
      data: { status: '已完成' },
      include: { assignee: { select: { id: true, name: true, avatar: true, role: true } } },
    });
    // P1-1：写「完成任务」活动
    await prisma.taskActivity
      .create({ data: { taskId: task.id, actorId: req.user!.sub, action: '完成任务' } })
      .catch(() => {});
    res.json({ task });
  }),
);

// ---- DELETE /api/tasks/:id ----
router.delete(
  '/:id',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    await prisma.task.delete({ where: { id: req.params.id, workspaceId: req.workspace!.id } });
    res.json({ ok: true });
  }),
);

// ==================== P1-1：任务评论 / 活动流 ====================

// 把字段值规整为活动流文案用的字符串（deadline/数组/null 等）
function formatFieldValue(key: string, val: unknown): string {
  if (val === null || val === undefined || val === '') return '空';
  if (val instanceof Date) return val.toLocaleDateString('zh-CN');
  if (Array.isArray(val)) return val.length > 0 ? val.join('/') : '空';
  if (val instanceof Object) return JSON.stringify(val);
  return String(val);
}

// 从评论正文中解析 @姓名（中英文），用于 mentions 数组（为通知系统预留）
function parseMentions(body: string): string[] {
  const re = /@([\u4e00-\u9fa5A-Za-z0-9_]+)/g;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) set.add(m[1]);
  return [...set];
}

// GET /api/tasks/:taskId/comments —— 评论列表（按时间正序）
router.get(
  '/:taskId/comments',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    // 校验任务归属当前工作区：找不到则抛 P2025 → 由 errorHandler 转 404
    await prisma.task.findFirstOrThrow({
      where: { id: req.params.taskId, workspaceId: req.workspace!.id },
      select: { id: true },
    });
    const comments = await prisma.taskComment.findMany({
      where: { taskId: req.params.taskId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true, avatar: true, role: true } } },
    });
    res.json({ comments });
  }),
);

// POST /api/tasks/:taskId/comments —— 发表评论
const createCommentSchema = z.object({
  body: z.string().min(1, '评论内容不能为空').max(5000, '评论过长'),
});

router.post(
  '/:taskId/comments',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const parsed = createCommentSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());
    // 校验任务归属当前工作区
    await prisma.task.findFirstOrThrow({
      where: { id: req.params.taskId, workspaceId: req.workspace!.id },
      select: { id: true },
    });

    const mentions = parseMentions(parsed.data.body);
    const authorId = req.user!.sub;

    // 评论通过 GET /activity 的 kind:'comment' 条目进入活动流（带正文），
    // 无需再单独写一条「发表评论」活动记录，否则同一条评论会在活动流里重复出现。
    const comment = await prisma.taskComment.create({
      data: { taskId: req.params.taskId, authorId, body: parsed.data.body, mentions },
      include: { author: { select: { id: true, name: true, avatar: true, role: true } } },
    });

    // P1-4：给被 @ 的成员发站内信通知（异步，失败不影响评论）
    notifyMentions(comment.taskId, req.workspace!.id, authorId, mentions, comment.body).catch(() => {});

    res.status(201).json({ comment });
  }),
);

// GET /api/tasks/:taskId/activity —— 活动流（评论 + 变更，按时间倒序合并）
router.get(
  '/:taskId/activity',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    await prisma.task.findFirstOrThrow({
      where: { id: req.params.taskId, workspaceId: req.workspace!.id },
      select: { id: true },
    });

    const [comments, activities] = await Promise.all([
      prisma.taskComment.findMany({
        where: { taskId: req.params.taskId },
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { id: true, name: true, avatar: true } } },
      }),
      prisma.taskActivity.findMany({
        where: { taskId: req.params.taskId },
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, name: true, avatar: true } } },
      }),
    ]);

    // 合并为统一 shape，用 kind 区分渲染
    const feed = [
      ...comments.map((c) => ({
        id: c.id,
        taskId: c.taskId,
        kind: 'comment' as const,
        actor: c.author,
        action: '发表评论',
        body: c.body,
        createdAt: c.createdAt,
      })),
      ...activities.map((a) => ({
        id: a.id,
        taskId: a.taskId,
        kind: 'activity' as const,
        actor: a.actor,
        action: a.action,
        detail: a.detail,
        createdAt: a.createdAt,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    res.json({ activity: feed });
  }),
);

export default router;
