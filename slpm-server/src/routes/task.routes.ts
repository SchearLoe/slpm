import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/workspace.js';
import { ApiError } from '../middleware/error.js';
import { notifyMentions, notifyAssignment } from '../lib/notify.js';
import { writeAudit } from '../lib/audit.js';

const router = Router();

// P9 安全（H2/H4）：校验一组任务 id 是否全部属于当前工作区（防跨租户通过 parentId/blockIds
// 建立引用从而窃取其它工作区任务标题/状态）。返回通过校验的合法 id 列表。
async function assertTasksInWorkspace(ids: string[], workspaceId: string): Promise<void> {
  if (ids.length === 0) return;
  const found = await prisma.task.findMany({
    where: { id: { in: ids }, workspaceId },
    select: { id: true },
  });
  if (found.length !== new Set(ids).size) {
    throw new ApiError(400, '依赖或父任务不存在，或不在当前工作区');
  }
}

// P9 安全（H4）：校验指派人是否当前工作区成员（防向非成员滥发通知 / 拉取其展示资料）。
// assigneeId 为 null 表示取消指派（合法）；self 永远合法。
async function assertAssigneeInWorkspace(assigneeId: string | null, workspaceId: string, selfId: string): Promise<void> {
  if (!assigneeId || assigneeId === selfId) return;
  const m = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: assigneeId } },
    select: { userId: true },
  });
  if (!m) throw new ApiError(400, '目标负责人不是当前工作区成员');
}

// P9 安全（M1）：判断当前用户能否销毁该任务（创建者本人 或 工作区 admin/pm）。
function canDestroyTask(ownerId: string, wsRole: string, userId: string): boolean {
  return ownerId === userId || wsRole === 'admin' || wsRole === 'pm';
}

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
  estimatedHours: '预估工时', // P4-2
};

// 任务查询条件校验（列表过滤 + 分页）
const listQuerySchema = z.object({
  status: z
    .enum(['进行中', '已完成', '待处理', '已延期'])
    .optional(),
  phase: z
    .enum(['需求评审', '产品设计', '开发实现', '测试验证'])
    .optional(),
  assignedToMe: z.enum(['true', 'false']).optional(),
  // P6-A：按标签筛选（精确匹配 tags 数组中包含该值的任务）
  tag: z.string().max(30).optional(),
  // P6-D：批量操作前的列表 id 过滤（取指定 id 集合，用于批量预览）
  ids: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(100),
});

// 标准化优先级（来自共享常量）
import { PRIORITY_MAP as STD_PRIORITY_MAP } from '../lib/constants.js';

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
    // P6-A：按标签筛选（PG 数组 has 操作符）
    if (parsed.data.tag) where.tags = { has: parsed.data.tag };
    // P6-D：按 id 集合筛选（逗号分隔）
    if (parsed.data.ids) {
      const idArr = parsed.data.ids.split(',').map((s) => s.trim()).filter(Boolean);
      if (idArr.length > 0) where.id = { in: idArr };
    }

    // P1-6：可选加载依赖关系
    const withDeps = req.query.withDeps === 'true';
    const { page, pageSize } = parsed.data;
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        take: pageSize,
        skip: (page - 1) * pageSize,
        include: {
          assignee: { select: { id: true, name: true, avatar: true, role: true } },
          ...(withDeps ? {
            parent: { select: { id: true, title: true, status: true } },
            children: { select: { id: true, title: true, status: true } },
            blockedBy: { include: { dependsOnTask: { select: { id: true, title: true, status: true } } } },
            blocks: { include: { task: { select: { id: true, title: true, status: true } } } },
          } : {}),
        },
      }),
      prisma.task.count({ where }),
    ]);

    res.json({ tasks, total, page, pageSize, hasMore: page * pageSize < total });
  }),
);

// ---- GET /api/tasks/:id —— P6-E1 单个任务详情（含依赖关系）----
router.get(
  '/:id',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const task = await prisma.task.findFirst({
      where: { id: req.params.id, workspaceId: req.workspace!.id },
      include: {
        assignee: { select: { id: true, name: true, avatar: true, role: true } },
        parent: { select: { id: true, title: true, status: true } },
        children: { select: { id: true, title: true, status: true } },
        blockedBy: { include: { dependsOnTask: { select: { id: true, title: true, status: true } } } },
        blocks: { include: { task: { select: { id: true, title: true, status: true } } } },
        productVersion: { select: { id: true, name: true, status: true } },
      },
    });
    if (!task) throw new ApiError(404, '任务不存在');
    res.json({ task });
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
    // P4-2：预估工时（小时）
    estimatedHours: z.number().min(0).max(10000).optional().nullable(),
});

router.post(
  '/',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());
    const d = parsed.data;

    // P9 安全（H2）：父任务与阻塞依赖必须属于当前工作区，防跨租户引用窃取任务标题/状态。
    if (d.parentId) await assertTasksInWorkspace([d.parentId], req.workspace!.id);
    if (d.blockIds.length > 0) await assertTasksInWorkspace(d.blockIds, req.workspace!.id);
    // P9 安全（H4）：指派人必须是当前工作区成员（默认指派给自己除外）。
    const assigneeId = d.assigneeId ?? req.user!.sub;
    await assertAssigneeInWorkspace(assigneeId, req.workspace!.id, req.user!.sub);

    const task = await prisma.task.create({
      data: {
        title: d.title,
        description: d.description,
        phase: d.phase,
        priority: STD_PRIORITY_MAP[d.priority] ?? '中',
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
        estimatedHours: d.estimatedHours ?? null, // P4-2：预估工时（可选）
      },
      include: { assignee: { select: { id: true, name: true, avatar: true, role: true } } },
    });

    // P1-6：写入阻塞依赖（P9：上面已校验全部属于当前工作区，错误不再静默吞掉）
    if (d.blockIds.length > 0) {
      await prisma.taskDependency.createMany({
        data: d.blockIds.map((depId) => ({
          taskId: task.id,
          dependsOnTaskId: depId,
        })),
        skipDuplicates: true,
      });
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

    // P9 安全（H2）：父任务 / 阻塞依赖更新前校验工作区归属
    if (d.parentId !== undefined && d.parentId) {
      await assertTasksInWorkspace([d.parentId], req.workspace!.id);
    }
    if (d.blockIds !== undefined) {
      await assertTasksInWorkspace(d.blockIds, req.workspace!.id);
    }
    // P9 安全（H4）：指派人变更需校验工作区成员身份
    if (d.assigneeId !== undefined) {
      await assertAssigneeInWorkspace(d.assigneeId, req.workspace!.id, req.user!.sub);
    }

    const data: Record<string, unknown> = {};
    if (d.title !== undefined) data.title = d.title;
    if (d.description !== undefined) data.description = d.description;
    if (d.phase !== undefined) data.phase = d.phase;
    if (d.priority !== undefined) data.priority = STD_PRIORITY_MAP[d.priority] ?? '中';
    if (d.status !== undefined) data.status = d.status;
    if (d.deadline !== undefined) data.deadline = d.deadline ? new Date(d.deadline) : null;
    if (d.startDate !== undefined) data.startDate = d.startDate ? new Date(d.startDate) : null;
    if (d.milestone !== undefined) data.milestone = d.milestone;
    if (d.parentId !== undefined) data.parentId = d.parentId;
    if (d.tags !== undefined) data.tags = d.tags;
    if (d.assigneeId !== undefined) data.assigneeId = d.assigneeId;
    // P3：产品版本（可空）
    if (d.productVersionId !== undefined) data.productVersionId = d.productVersionId;
    // P4-2：预估工时（可空）
    if (d.estimatedHours !== undefined) data.estimatedHours = d.estimatedHours;

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

    // P1-6：同步阻塞依赖（先删后建；P9：依赖 id 已在上方校验工作区归属，错误不再静默吞掉）
    if (d.blockIds !== undefined) {
      await prisma.taskDependency.deleteMany({ where: { taskId: task.id } });
      if (d.blockIds.length > 0) {
        await prisma.taskDependency.createMany({
          data: d.blockIds.map((depId) => ({ taskId: task.id, dependsOnTaskId: depId })),
          skipDuplicates: true,
        });
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
// P9 安全（M1）：销毁鉴权 —— 仅创建者本人或工作区 admin/pm 可删，防普通成员误删/恶意清空他人任务。
router.delete(
  '/:id',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const existing = await prisma.task.findFirst({
      where: { id: req.params.id, workspaceId: req.workspace!.id },
      select: { id: true, ownerId: true, title: true },
    });
    if (!existing) throw new ApiError(404, '任务不存在');
    if (!canDestroyTask(existing.ownerId, req.workspace!.role, req.user!.sub)) {
      throw new ApiError(403, '仅任务创建者或管理员/项目经理可删除任务');
    }
    await prisma.task.delete({ where: { id: existing.id } });
    res.json({ ok: true });

    // P9 安全（H5）：任务删除审计
    writeAudit(
      { actorId: req.user!.sub, action: 'task_delete', target: `删除任务「${existing.title}」`, workspaceId: req.workspace!.id },
      req,
    ).catch(() => {});
  }),
);

// ---- POST /api/tasks/batch —— P6-D 批量操作（改状态/优先级/指派/删除）----
const batchSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, '至少选择一个任务').max(200, '一次最多操作 200 个'),
  action: z.enum(['setStatus', 'setPriority', 'setAssignee', 'setPhase', 'delete']),
  // 各动作的载荷（仅对应 action 必填）
  status: z.enum(['进行中', '已完成', '待处理', '已延期']).optional(),
  priority: z.string().optional(),
  assigneeId: z.string().nullable().optional(),
  phase: z.enum(['需求评审', '产品设计', '开发实现', '测试验证']).optional(),
});

router.post(
  '/batch',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const parsed = batchSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());
    const d = parsed.data;
    const wsId = req.workspace!.id;
    const ids = d.ids;

    // 仅作用于当前工作区内的任务（防越权）
    const where = { id: { in: ids }, workspaceId: wsId };

    if (d.action === 'delete') {
      // P9 安全（M1）：批量删除属高危操作，仅 admin/pm 可执行（防普通成员一键清空 200 条）
      if (req.workspace!.role !== 'admin' && req.workspace!.role !== 'pm') {
        throw new ApiError(403, '批量删除任务需管理员或项目经理权限');
      }
      const r = await prisma.task.deleteMany({ where });
      // P9 安全（H5）：批量操作审计
      writeAudit(
        { actorId: req.user!.sub, action: 'batch_op', target: `批量删除 ${r.count} 个任务`, workspaceId: wsId, metadata: { action: 'delete', count: r.count } },
        req,
      ).catch(() => {});
      res.json({ ok: true, affected: r.count });
      return;
    }

    const data: Record<string, unknown> = {};
    if (d.action === 'setStatus' && d.status) data.status = d.status;
    else if (d.action === 'setPriority' && d.priority) data.priority = STD_PRIORITY_MAP[d.priority] ?? '中';
    else if (d.action === 'setAssignee' && d.assigneeId !== undefined) {
      if (d.assigneeId) {
        // 校验目标指派人是当前工作区成员
        const m = await prisma.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId: wsId, userId: d.assigneeId } },
          select: { userId: true },
        });
        if (!m) throw new ApiError(400, '目标负责人不是当前工作区成员');
      }
      data.assigneeId = d.assigneeId;
    } else if (d.action === 'setPhase' && d.phase) data.phase = d.phase;
    else throw new ApiError(400, '批量操作参数不完整');

    const r = await prisma.task.updateMany({ where, data });
    // P9 安全（H5）：批量操作审计（写类操作均留痕）
    const actionLabel = { setStatus: '改状态', setPriority: '改优先级', setAssignee: '改负责人', setPhase: '改阶段' }[d.action] ?? d.action;
    const detail = d.action === 'setStatus' ? d.status
      : d.action === 'setPriority' ? d.priority
      : d.action === 'setAssignee' ? (d.assigneeId ?? '取消指派')
      : d.action === 'setPhase' ? d.phase : '';
    writeAudit(
      { actorId: req.user!.sub, action: 'batch_op', target: `批量${actionLabel} ${r.count} 个任务（${detail ?? ''}）`, workspaceId: wsId, metadata: { action: d.action, count: r.count } },
      req,
    ).catch(() => {});
    res.json({ ok: true, affected: r.count });
  }),
);

// ==================== P6-B：任务清单（Checklist） ====================

const checklistItemSchema = z.object({
  content: z.string().min(1, '内容必填').max(500, '内容过长'),
  done: z.boolean().optional().default(false),
  order: z.number().int().optional(),
});

// GET /api/tasks/:taskId/checklist
router.get(
  '/:taskId/checklist',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    await prisma.task.findFirstOrThrow({
      where: { id: req.params.taskId, workspaceId: req.workspace!.id },
      select: { id: true },
    });
    const items = await prisma.taskChecklistItem.findMany({
      where: { taskId: req.params.taskId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ items });
  }),
);

// POST /api/tasks/:taskId/checklist
router.post(
  '/:taskId/checklist',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const parsed = checklistItemSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());
    await prisma.task.findFirstOrThrow({
      where: { id: req.params.taskId, workspaceId: req.workspace!.id },
      select: { id: true },
    });
    const item = await prisma.taskChecklistItem.create({
      data: {
        taskId: req.params.taskId,
        content: parsed.data.content,
        done: parsed.data.done,
        order: parsed.data.order ?? 0,
      },
    });
    res.status(201).json({ item });
  }),
);

// PATCH /api/tasks/:taskId/checklist/:itemId
router.patch(
  '/:taskId/checklist/:itemId',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const parsed = z
      .object({
        content: z.string().min(1).max(500).optional(),
        done: z.boolean().optional(),
        order: z.number().int().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());
    // P7 安全修复：校验 task 归属当前工作区（防跨工作区 IDOR）
    await prisma.task.findFirstOrThrow({
      where: { id: req.params.taskId, workspaceId: req.workspace!.id },
      select: { id: true },
    });
    const item = await prisma.taskChecklistItem.update({
      where: { id: req.params.itemId, taskId: req.params.taskId },
      data: parsed.data,
    });
    res.json({ item });
  }),
);

// DELETE /api/tasks/:taskId/checklist/:itemId
router.delete(
  '/:taskId/checklist/:itemId',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    // P7 安全修复：校验 task 归属当前工作区（防跨工作区 IDOR）
    await prisma.task.findFirstOrThrow({
      where: { id: req.params.taskId, workspaceId: req.workspace!.id },
      select: { id: true },
    });
    await prisma.taskChecklistItem.delete({
      where: { id: req.params.itemId, taskId: req.params.taskId },
    });
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

// ---- P6-E2：评论编辑 / 删除（仅作者本人）----

// PATCH /api/tasks/:taskId/comments/:commentId
router.patch(
  '/:taskId/comments/:commentId',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const parsed = z.object({ body: z.string().min(1, '评论内容不能为空').max(5000) }).safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());

    const existing = await prisma.taskComment.findFirst({
      where: { id: req.params.commentId, taskId: req.params.taskId },
      select: { id: true, authorId: true },
    });
    if (!existing) throw new ApiError(404, '评论不存在');
    if (existing.authorId !== req.user!.sub) throw new ApiError(403, '只能编辑自己的评论');

    const mentions = parseMentions(parsed.data.body);
    const comment = await prisma.taskComment.update({
      where: { id: existing.id },
      data: { body: parsed.data.body, mentions },
      include: { author: { select: { id: true, name: true, avatar: true, role: true } } },
    });
    res.json({ comment });
  }),
);

// DELETE /api/tasks/:taskId/comments/:commentId
router.delete(
  '/:taskId/comments/:commentId',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const existing = await prisma.taskComment.findFirst({
      where: { id: req.params.commentId, taskId: req.params.taskId },
      select: { id: true, authorId: true },
    });
    if (!existing) throw new ApiError(404, '评论不存在');
    // 作者本人可删，或工作区 admin/pm 可删他人评论（管理权限）
    const isAuthor = existing.authorId === req.user!.sub;
    const canModerate = req.workspace!.role === 'admin' || req.workspace!.role === 'pm';
    if (!isAuthor && !canModerate) throw new ApiError(403, '只能删除自己的评论（管理员可删除任何评论）');

    await prisma.taskComment.delete({ where: { id: existing.id } });
    res.json({ ok: true });
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
