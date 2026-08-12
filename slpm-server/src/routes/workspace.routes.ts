import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, requireAuth } from '../middleware/auth.js';
import { requireAdmin, requireWorkspace } from '../middleware/workspace.js';
import { getOnlineUsersList } from '../lib/ws.js';
import { ApiError } from '../middleware/error.js';
import { writeAudit } from '../lib/audit.js';

const router = Router();

// P2-1：职能角色枚举（P3 新增 po=产品经理）
const WS_ROLES = ['admin', 'pm', 'dev', 'qa', 'po'] as const;
type WsRole = (typeof WS_ROLES)[number];

// 辅助：生成 URL 友好的 slug（cuid 兜底保证唯一）
function makeSlug(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
  return base || `ws_${Date.now()}`;
}

// ============ 工作区 ============

// GET /api/workspaces —— 当前用户的所有工作区（含每条的 role 与产品线归属）
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: req.user!.sub },
      include: { workspace: { select: { id: true, name: true, slug: true, productId: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const workspaces = memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      productId: m.workspace.productId, // P3：产品线归属（可空）
      role: m.role as WsRole,
    }));
    res.json({ workspaces });
  }),
);

// POST /api/workspaces —— 新建工作区，创建者自动 admin
const createWsSchema = z.object({
  name: z.string().min(1, '工作区名称必填').max(60),
  productId: z.string().optional().nullable(), // P3：可选归属产品线
});
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = createWsSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());

    // P9 安全（H1）：若指定 productId，必须校验调用者对该产品线有写权限，
    // 否则任意用户可把工作区挂到他人产品线下、自身变 admin，进而通过产品级
    // 视图越权读取/修改该产品所有项目的数据（租户隔离被绕过）。
    // 合法路径：system_admin，或产品负责人，或该产品下某项目的 po/admin。
    let productId: string | null = parsed.data.productId ?? null;
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          ownerId: true,
          workspaces: { select: { id: true } },
        },
      });
      if (!product) throw new ApiError(404, '指定的产品线不存在');

      // role 不在 JWT 里，单独取一次（requireAuth 已确认用户存在）
      const me = await prisma.user.findUnique({
        where: { id: req.user!.sub },
        select: { role: true },
      });
      const isSystemAdmin = me?.role === 'system_admin';
      const isOwner = product.ownerId === req.user!.sub;
      let canManage = isSystemAdmin || isOwner;
      if (!canManage && product.workspaces.length > 0) {
        const myMembership = await prisma.workspaceMember.findFirst({
          where: {
            userId: req.user!.sub,
            workspaceId: { in: product.workspaces.map((w) => w.id) },
            role: { in: ['po', 'admin'] },
          },
          select: { id: true },
        });
        canManage = !!myMembership;
      }
      if (!canManage) {
        throw new ApiError(403, '无权将工作区挂到该产品线下（需产品负责人或产品下项目的 PO/管理员）');
      }
    }

    const slug = `${makeSlug(parsed.data.name)}_${Date.now().toString(36)}`;
    const workspace = await prisma.workspace.create({
      data: {
        name: parsed.data.name,
        slug,
        productId,
        members: {
          create: { userId: req.user!.sub, role: 'admin' },
        },
      },
      select: { id: true, name: true, slug: true, productId: true },
    });
    res.status(201).json({
      workspace: { ...workspace, role: 'admin' as WsRole },
    });
  }),
);

// ============ 成员管理 ============

// GET /api/workspaces/:id/members —— 成员列表
router.get(
  '/:id/members',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: req.workspace!.id },
      include: { user: { select: { id: true, name: true, avatar: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.user.name,
        avatar: m.user.avatar,
        email: m.user.email,
        role: m.role as WsRole,
      })),
    });
  }),
);

// GET /api/workspaces/:id/online —— P4-2：当前在线成员 userId 列表（WebSocket presence）
router.get(
  '/:id/online',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const onlineIds = getOnlineUsersList();
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: req.workspace!.id, userId: { in: onlineIds } },
      select: { userId: true },
    });
    res.json({ online: members.map((m) => m.userId) });
  }),
);

// POST /api/workspaces/:id/members —— 邀请成员（按 email 查找已注册用户），仅 admin
const inviteSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  role: z.enum(WS_ROLES).optional().default('dev'),
});
router.post(
  '/:id/members',
  requireAuth,
  requireWorkspace,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());

    const target = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!target) throw new ApiError(404, '该邮箱用户未注册');

    const membership = await prisma.workspaceMember
      .create({
        data: {
          workspaceId: req.workspace!.id,
          userId: target.id,
          role: parsed.data.role,
        },
        include: { user: { select: { id: true, name: true, avatar: true, email: true } } },
      })
      .catch((e: { code?: string }) => {
        if (e.code === 'P2002') throw new ApiError(409, '该用户已是工作区成员');
        throw e;
      });

    res.status(201).json({
      member: {
        id: membership.id,
        userId: membership.userId,
        name: membership.user.name,
        avatar: membership.user.avatar,
        email: membership.user.email,
        role: membership.role as WsRole,
      },
    });

    // P6-C：审计（邀请成员）
    writeAudit(
      { actorId: req.user!.sub, action: 'member_invite', target: `邀请 ${parsed.data.email} 加入工作区（角色 ${parsed.data.role}）`, workspaceId: req.workspace!.id },
      req,
    ).catch(() => {});
  }),
);

// PATCH /api/workspaces/:id/members/:userId —— 改成员角色，仅 admin
const updateRoleSchema = z.object({
  role: z.enum(WS_ROLES),
});
router.patch(
  '/:id/members/:userId',
  requireAuth,
  requireWorkspace,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());

    const membership = await prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId: req.workspace!.id, userId: req.params.userId } },
      data: { role: parsed.data.role },
    });
    res.json({ member: { userId: membership.userId, role: membership.role as WsRole } });

    // P6-C：审计（改成员角色）
    writeAudit(
      { actorId: req.user!.sub, action: 'role_change', target: `成员 ${req.params.userId} 角色改为 ${parsed.data.role}`, workspaceId: req.workspace!.id },
      req,
    ).catch(() => {});
  }),
);

// DELETE /api/workspaces/:id/members/:userId —— 移除成员，仅 admin
router.delete(
  '/:id/members/:userId',
  requireAuth,
  requireWorkspace,
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (req.params.userId === req.user!.sub) {
      throw new ApiError(400, '不能移除自己，如需退出请使用「退出工作区」');
    }
    await prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId: req.workspace!.id, userId: req.params.userId } },
    });
    res.json({ ok: true });

    // P6-C：审计（移除成员）
    writeAudit(
      { actorId: req.user!.sub, action: 'member_remove', target: `移除成员 ${req.params.userId}`, workspaceId: req.workspace!.id },
      req,
    ).catch(() => {});
  }),
);

export default router;
