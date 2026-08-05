import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';

/**
 * P6-C：审计日志查询路由。
 *
 * - 全局视图（跨工作区）：仅 system_admin 可见，无 workspaceId 过滤；
 * - 工作区视图：工作区 admin/pm 可见，仅限当前工作区。
 */

const router = Router();

const listSchema = z.object({
  action: z.string().max(60).optional(),
  actorId: z.string().max(60).optional(),
  workspaceId: z.string().max(60).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
});

// ---- GET /api/audit?scope=global|workspace ----
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) throw new ApiError(400, '查询参数错误', parsed.error.flatten());
    const d = parsed.data;
    const scope = req.query.scope === 'global' ? 'global' : 'workspace';
    // JWT 不含 role，需查库判断是否系统管理员
    const me = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { role: true },
    });
    const isSystemAdmin = me?.role === 'system_admin';

    const where: Record<string, unknown> = {};
    if (scope === 'global') {
      if (!isSystemAdmin) throw new ApiError(403, '仅系统管理员可查看全局审计日志');
    } else {
      // 工作区视图：需 X-Workspace-Id + admin/pm 角色
      if (!req.headers['x-workspace-id']) throw new ApiError(403, '工作区视图需指定工作区');
      // 手动校验成员角色（避免引入重复中间件链）
      const membership = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: req.headers['x-workspace-id'] as string, userId: req.user!.sub } },
        select: { role: true },
      });
      if (!membership) throw new ApiError(403, '你不是该工作区的成员');
      if (membership.role !== 'admin' && membership.role !== 'pm') {
        throw new ApiError(403, '需要 admin/pm 权限查看工作区审计日志');
      }
      where.workspaceId = req.headers['x-workspace-id'];
    }

    if (d.action) where.action = d.action;
    if (d.actorId) where.actorId = d.actorId;
    if (d.workspaceId) where.workspaceId = d.workspaceId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: d.pageSize,
        skip: (d.page - 1) * d.pageSize,
        include: {
          actor: { select: { id: true, name: true, avatar: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total, page: d.page, pageSize: d.pageSize, hasMore: d.page * d.pageSize < total });
  }),
);

export default router;
