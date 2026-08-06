import { Router } from 'express';
import { Request } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, requireAuth } from '../middleware/auth.js';
import { requireProductAccess, requireProductRole } from '../middleware/product.js';
import { ApiError } from '../middleware/error.js';
import { notifyAssignment } from '../lib/notify.js';
import { ROLE_RANK } from '../lib/constants.js';

const router = Router();

/**
 * P3：产品线跨工作区聚合视图。
 *
 * 数据范围（产品经理语义）：
 *  - 用户在产品下任一工作区是 po/admin → 聚合产品下【所有】工作区的数据；
 *  - 其他角色（pm/dev/qa）→ 仅聚合自己所属的工作区。
 */

// 查询范围：po/admin 看全产品，其他人只看自己的工作区
async function scopeWorkspaceIds(req: Request) {
  const isManager = req.product!.role === 'po' || req.product!.role === 'admin';
  if (!isManager) return req.product!.workspaceIds;
  const all = await prisma.workspace.findMany({
    where: { productId: req.product!.productId },
    select: { id: true },
  });
  return all.map((w) => w.id);
}

// ---- PATCH /api/products/:id/tasks/:taskId ----
// P4-2：产品级任务更新（跨项目指派负责人 / 调整版本 / 状态 / 阶段）。
// 权限：产品级 po/admin，或任务所属工作区成员（限本人任务可见范围）。
const updateProductTaskSchema = z.object({
  assigneeId: z.string().optional().nullable(),
  status: z.enum(['进行中', '已完成', '待处理', '已延期']).optional(),
  phase: z.enum(['需求评审', '产品设计', '开发实现', '测试验证']).optional(),
  priority: z.string().optional(),
  productVersionId: z.string().optional().nullable(),
});
router.patch(
  '/:id/tasks/:taskId',
  requireAuth,
  requireProductAccess,
  asyncHandler(async (req, res) => {
    const parsed = updateProductTaskSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());
    const d = parsed.data;

    // 任务必须属于产品下的工作区
    const task = await prisma.task.findFirst({
      where: {
        id: req.params.taskId,
        workspace: { productId: req.product!.productId },
      },
      include: { workspace: { select: { id: true } } },
    });
    if (!task) throw new ApiError(404, '任务不存在或不属于该产品线');

    // 权限：产品级 po/admin，或任务所属工作区成员
    const isManager = req.product!.role === 'po' || req.product!.role === 'admin';
    if (!isManager && !req.product!.workspaceIds.includes(task.workspace.id)) {
      throw new ApiError(403, '无权修改该任务');
    }

    // 跨项目指派：目标负责人必须是产品下任一工作区的成员
    if (d.assigneeId) {
      const inProduct = await prisma.workspaceMember.findFirst({
        where: { userId: d.assigneeId, workspace: { productId: req.product!.productId } },
        select: { id: true },
      });
      if (!inProduct) throw new ApiError(400, '目标负责人不在该产品线的任何项目中');
    }

    const data: Record<string, unknown> = {};
    if (d.assigneeId !== undefined) data.assigneeId = d.assigneeId;
    if (d.status !== undefined) data.status = d.status;
    if (d.phase !== undefined) data.phase = d.phase;
    if (d.priority !== undefined) data.priority = d.priority;
    if (d.productVersionId !== undefined) data.productVersionId = d.productVersionId;

    const updated = await prisma.task.update({
      where: { id: task.id },
      data,
      include: {
        assignee: { select: { id: true, name: true, avatar: true, role: true } },
        workspace: { select: { id: true, name: true } },
        productVersion: { select: { id: true, name: true, status: true } },
      },
    });

    // 指派变更 → 通知新负责人（异步）
    if (d.assigneeId !== undefined && d.assigneeId !== task.assigneeId) {
      notifyAssignment(updated.id, task.workspace.id, req.user!.sub, task.assigneeId, updated.assigneeId ?? null).catch(() => {});
    }

    res.json({ task: updated });
  }),
);

// GET /api/products/:id/tasks —— 跨工作区任务列表（含所属项目/版本）
const tasksQuerySchema = z.object({
  status: z.enum(['进行中', '已完成', '待处理', '已延期']).optional(),
  phase: z.enum(['需求评审', '产品设计', '开发实现', '测试验证']).optional(),
  workspaceId: z.string().optional(),
  versionId: z.string().optional(),
  assignedToMe: z.enum(['true', 'false']).optional(),
});
router.get(
  '/:id/tasks',
  requireAuth,
  requireProductAccess,
  asyncHandler(async (req, res) => {
    const parsed = tasksQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ApiError(400, '查询参数错误', parsed.error.flatten());

    const workspaceIds = await scopeWorkspaceIds(req);
    const where: Record<string, unknown> = { workspaceId: { in: workspaceIds } };
    if (parsed.data.status) where.status = parsed.data.status;
    if (parsed.data.phase) where.phase = parsed.data.phase;
    if (parsed.data.workspaceId) where.workspaceId = parsed.data.workspaceId;
    if (parsed.data.versionId) where.productVersionId = parsed.data.versionId;
    if (parsed.data.assignedToMe === 'true') where.assigneeId = req.user!.sub;

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        assignee: { select: { id: true, name: true, avatar: true, role: true } },
        workspace: { select: { id: true, name: true } },
        productVersion: { select: { id: true, name: true, status: true } },
      },
    });
    res.json({ tasks });
  }),
);

// GET /api/products/:id/members —— 跨工作区成员负荷聚合
router.get(
  '/:id/members',
  requireAuth,
  requireProductAccess,
  asyncHandler(async (req, res) => {
    const workspaceIds = await scopeWorkspaceIds(req);
    if (workspaceIds.length === 0) {
      return res.json({ members: [] });
    }

    // 产品下所有成员（含角色 + 所属工作区，跨区去重取最高角色）
    const memberships = await prisma.workspaceMember.findMany({
      where: { workspaceId: { in: workspaceIds } },
      include: {
        user: { select: { id: true, name: true, avatar: true, email: true } },
        workspace: { select: { id: true, name: true } },
      },
    });

    // 每个用户的任务计数（跨区聚合）
    const tasks = await prisma.task.findMany({
      where: { workspaceId: { in: workspaceIds } },
      select: { assigneeId: true, status: true, deadline: true },
    });
    const now = Date.now();
    const agg = new Map<string, { total: number; inProgress: number; completed: number; overdue: number }>();
    for (const t of tasks) {
      if (!t.assigneeId) continue;
      const a = agg.get(t.assigneeId) ?? { total: 0, inProgress: 0, completed: 0, overdue: 0 };
      a.total += 1;
      if (t.status === '进行中') a.inProgress += 1;
      if (t.status === '已完成') a.completed += 1;
      if (t.status === '已延期' || (t.status !== '已完成' && t.deadline && t.deadline.getTime() < now)) a.overdue += 1;
      agg.set(t.assigneeId, a);
    }

    // 按用户聚合成员记录（一个用户可能在多个工作区）
    const byUser = new Map<string, { user: (typeof memberships)[0]['user']; roles: string[]; workspaces: { id: string; name: string; role: string }[] }>();
    for (const m of memberships) {
      const entry = byUser.get(m.userId) ?? { user: m.user, roles: [], workspaces: [] };
      entry.roles.push(m.role);
      entry.workspaces.push({ id: m.workspace.id, name: m.workspace.name, role: m.role });
      byUser.set(m.userId, entry);
    }

    const members = [...byUser.values()].map(({ user, roles, workspaces }) => {
      const counts = agg.get(user.id) ?? { total: 0, inProgress: 0, completed: 0, overdue: 0 };
      return {
        userId: user.id,
        name: user.name,
        avatar: user.avatar,
        email: user.email,
        role: roles.reduce((best, r) => ((ROLE_RANK[r] ?? 0) > (ROLE_RANK[best] ?? 0) ? r : best)),
        workspaces,
        ...counts,
      };
    });
    res.json({ members });
  }),
);

// GET /api/products/:id/stats —— 跨工作区 KPI 聚合（按工作区分列 + 版本分布）
router.get(
  '/:id/stats',
  requireAuth,
  requireProductAccess,
  asyncHandler(async (req, res) => {
    const workspaceIds = await scopeWorkspaceIds(req);
    const where = workspaceIds.length > 0 ? { workspaceId: { in: workspaceIds } } : { workspaceId: { in: [] } };

    const [workspaces, tasks, versions] = await Promise.all([
      prisma.workspace.findMany({ where: { id: { in: workspaceIds } }, select: { id: true, name: true } }),
      prisma.task.findMany({
        where,
        select: { status: true, milestone: true, workspaceId: true, productVersionId: true, deadline: true },
      }),
      prisma.productVersion.findMany({
        where: { productId: req.product!.productId },
        select: { id: true, name: true, status: true, releaseDate: true },
        orderBy: [{ order: 'asc' }],
      }),
    ]);

    const now = Date.now();
    const byWs = new Map<string, { total: number; completed: number; inProgress: number; overdue: number; milestones: number; milestonesDone: number }>();
    const byVersion = new Map<string, { total: number; completed: number }>();
    let total = 0;
    let completed = 0;
    let inProgress = 0;
    let overdue = 0;
    let milestones = 0;
    let milestonesDone = 0;

    for (const t of tasks) {
      total += 1;
      const isCompleted = t.status === '已完成';
      const isOverdue = t.status === '已延期' || (!isCompleted && t.deadline && t.deadline.getTime() < now);
      if (isCompleted) completed += 1;
      if (t.status === '进行中') inProgress += 1;
      if (isOverdue) overdue += 1;
      if (t.milestone) {
        milestones += 1;
        if (isCompleted) milestonesDone += 1;
      }
      // 工作区维度
      if (t.workspaceId) {
        const w = byWs.get(t.workspaceId) ?? { total: 0, completed: 0, inProgress: 0, overdue: 0, milestones: 0, milestonesDone: 0 };
        w.total += 1;
        if (isCompleted) w.completed += 1;
        if (t.status === '进行中') w.inProgress += 1;
        if (isOverdue) w.overdue += 1;
        if (t.milestone) {
          w.milestones += 1;
          if (isCompleted) w.milestonesDone += 1;
        }
        byWs.set(t.workspaceId, w);
      }
      // 版本维度
      if (t.productVersionId) {
        const v = byVersion.get(t.productVersionId) ?? { total: 0, completed: 0 };
        v.total += 1;
        if (isCompleted) v.completed += 1;
        byVersion.set(t.productVersionId, v);
      }
    }

    res.json({
      stats: {
        total,
        completed,
        inProgress,
        overdue,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        milestones,
        milestonesDone,
        milestoneRate: milestones > 0 ? Math.round((milestonesDone / milestones) * 100) : 0,
        byWorkspace: workspaces.map((w) => {
          const c = byWs.get(w.id) ?? { total: 0, completed: 0, inProgress: 0, overdue: 0, milestones: 0, milestonesDone: 0 };
          return { id: w.id, name: w.name, ...c, completionRate: c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0 };
        }),
        byVersion: versions.map((v) => {
          const c = byVersion.get(v.id) ?? { total: 0, completed: 0 };
          return {
            id: v.id,
            name: v.name,
            status: v.status,
            releaseDate: v.releaseDate,
            total: c.total,
            completed: c.completed,
            completionRate: c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0,
          };
        }),
      },
    });
  }),
);

export default router;
