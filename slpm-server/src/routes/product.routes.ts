import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, requireAuth } from '../middleware/auth.js';
import { requireProductAccess, requireProductRole } from '../middleware/product.js';
import { ApiError } from '../middleware/error.js';
import { ROLE_RANK } from '../lib/constants.js';
import { writeAudit } from '../lib/audit.js';

const router = Router();

// 辅助：生成 URL 友好的 slug（cuid 兜底保证唯一）
function makeSlug(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
  return base || `prod_${Date.now()}`;
}

/**
 * P3：产品线 CRUD。
 * 层级：Product（产品线）→ Workspace（项目）→ Task。
 * 访问控制：产品级操作走 requireProductAccess（用户至少是产品下任一工作区成员）。
 */

// GET /api/products —— 当前用户可访问的产品列表
// （用户所属工作区归属的产品，去重；含工作区数/版本数/用户在该产品下的最高角色）
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: req.user!.sub },
      select: {
        role: true,
        workspace: {
          select: { product: { select: { id: true, name: true, slug: true, description: true } } },
        },
      },
    });

    // 聚合：productId → { product, roles[] }
    const byProduct = new Map<string, { product: { id: string; name: string; slug: string; description: string }; roles: string[] }>();
    for (const m of memberships) {
      const p = m.workspace.product;
      if (!p) continue;
      const entry = byProduct.get(p.id) ?? { product: p, roles: [] };
      entry.roles.push(m.role);
      byProduct.set(p.id, entry);
    }

    // 批量统计工作区数 / 版本数
    const ids = [...byProduct.keys()];
    const [wsCounts, versionCounts] = await Promise.all([
      prisma.workspace.groupBy({ by: ['productId'], where: { productId: { in: ids } }, _count: { _all: true } }),
      prisma.productVersion.groupBy({ by: ['productId'], where: { productId: { in: ids } }, _count: { _all: true } }),
    ]);
    const wsCountMap = new Map(wsCounts.map((r) => [r.productId, r._count._all]));
    const versionCountMap = new Map(versionCounts.map((r) => [r.productId, r._count._all]));

    const products = [...byProduct.values()].map(({ product, roles }) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      workspaceCount: wsCountMap.get(product.id) ?? 0,
      versionCount: versionCountMap.get(product.id) ?? 0,
      role: roles.reduce((best, r) => ((ROLE_RANK[r] ?? 0) > (ROLE_RANK[best] ?? 0) ? r : best)),
    }));
    res.json({ products });
  }),
);

// POST /api/products —— 新建产品线（系统管理员，或任一工作区的 admin）
const createSchema = z.object({
  name: z.string().min(1, '产品名称必填').max(60),
  description: z.string().max(500).optional().default(''),
});
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());

    // 权限：system_admin 或任一工作区 admin
    const [user, adminMemberships] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user!.sub }, select: { role: true } }),
      prisma.workspaceMember.findFirst({ where: { userId: req.user!.sub, role: 'admin' }, select: { id: true } }),
    ]);
    if (user?.role !== 'system_admin' && !adminMemberships) {
      throw new ApiError(403, '需要系统管理员或任一工作区管理员权限');
    }

    const slug = `${makeSlug(parsed.data.name)}_${Date.now().toString(36)}`;
    const product = await prisma.product.create({
      data: { name: parsed.data.name, slug, description: parsed.data.description, ownerId: req.user!.sub },
    });
    res.status(201).json({ product: { ...product, workspaceCount: 0, versionCount: 0, role: 'admin' } });

    // P9 安全（H5）：产品线创建审计
    writeAudit(
      { actorId: req.user!.sub, action: 'product_create', target: `创建产品线「${parsed.data.name}」` },
      req,
    ).catch(() => {});
  }),
);

// GET /api/products/:id —— 产品详情（含关联工作区 + 当前用户在每个工作区的角色）
router.get(
  '/:id',
  requireAuth,
  requireProductAccess,
  asyncHandler(async (req, res) => {
    const [product, memberships, versionCount] = await Promise.all([
      prisma.product.findUniqueOrThrow({
        where: { id: req.product!.productId },
        include: { workspaces: { select: { id: true, name: true, slug: true, createdAt: true } } },
      }),
      prisma.workspaceMember.findMany({
        where: { userId: req.user!.sub, workspaceId: { in: req.product!.workspaceIds } },
        select: { workspaceId: true, role: true },
      }),
      prisma.productVersion.count({ where: { productId: req.product!.productId } }),
    ]);
    const roleByWs = new Map(memberships.map((m) => [m.workspaceId, m.role]));
    res.json({
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        versionCount,
        role: req.product!.role,
        workspaces: product.workspaces.map((w) => ({
          id: w.id,
          name: w.name,
          slug: w.slug,
          createdAt: w.createdAt,
          role: roleByWs.get(w.id) ?? null, // null = 不是我的工作区（别人关联进来的）
        })),
      },
    });
  }),
);

// PATCH /api/products/:id —— 更新名称/描述（po/admin）
const updateSchema = z.object({
  name: z.string().min(1, '产品名称必填').max(60).optional(),
  description: z.string().max(500).optional(),
});
router.patch(
  '/:id',
  requireAuth,
  requireProductAccess,
  requireProductRole('po', 'admin'),
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());
    const product = await prisma.product.update({
      where: { id: req.product!.productId },
      data: parsed.data,
    });
    res.json({ product });

    // P9 安全（H5）：产品线更新审计
    writeAudit(
      { actorId: req.user!.sub, action: 'product_update', target: `更新产品线「${product.name}」（字段：${Object.keys(parsed.data).join('/') || '无'}）` },
      req,
    ).catch(() => {});
  }),
);

// POST /api/products/:id/workspaces —— 关联工作区到产品（po/admin + 被关联工作区的 admin）
const linkWsSchema = z.object({
  workspaceId: z.string().min(1, '缺少工作区 id'),
});
router.post(
  '/:id/workspaces',
  requireAuth,
  requireProductAccess,
  requireProductRole('po', 'admin'),
  asyncHandler(async (req, res) => {
    const parsed = linkWsSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());

    // 目标工作区存在 + 当前用户是它的 admin（防止把别人的工作区塞进来）
    const target = await prisma.workspace.findUnique({
      where: { id: parsed.data.workspaceId },
      select: { id: true, name: true, productId: true },
    });
    if (!target) throw new ApiError(404, '目标工作区不存在');
    if (target.productId && target.productId !== req.product!.productId) {
      throw new ApiError(409, '该工作区已归属其他产品线');
    }
    const isTargetAdmin = await prisma.workspaceMember.findFirst({
      where: { workspaceId: target.id, userId: req.user!.sub, role: 'admin' },
      select: { id: true },
    });
    if (!isTargetAdmin) {
      throw new ApiError(403, '你必须是该工作区的管理员才能关联到产品线');
    }

    const workspace = await prisma.workspace.update({
      where: { id: target.id },
      data: { productId: req.product!.productId },
      select: { id: true, name: true, slug: true },
    });
    res.status(201).json({ workspace });
  }),
);

// DELETE /api/products/:id/workspaces/:wsId —— 取消关联（po/admin + 该工作区 admin）
router.delete(
  '/:id/workspaces/:wsId',
  requireAuth,
  requireProductAccess,
  requireProductRole('po', 'admin'),
  asyncHandler(async (req, res) => {
    const wsId = req.params.wsId;
    const target = await prisma.workspace.findUnique({ where: { id: wsId }, select: { id: true, productId: true } });
    if (!target || target.productId !== req.product!.productId) {
      throw new ApiError(404, '该工作区不属于此产品线');
    }
    const isTargetAdmin = await prisma.workspaceMember.findFirst({
      where: { workspaceId: wsId, userId: req.user!.sub, role: 'admin' },
      select: { id: true },
    });
    if (!isTargetAdmin) throw new ApiError(403, '你必须是该工作区的管理员才能取消关联');

    await prisma.workspace.update({
      where: { id: wsId },
      data: { productId: null },
    });
    res.json({ ok: true });
  }),
);

export default router;
