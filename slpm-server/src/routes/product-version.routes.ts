import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, requireAuth } from '../middleware/auth.js';
import { requireProductAccess, requireProductRole } from '../middleware/product.js';
import { ApiError } from '../middleware/error.js';
import { writeAudit } from '../lib/audit.js';

const router = Router();

// P3：产品版本管理（ProductVersion）。
// 状态机：planning（规划中）→ in_progress（开发中）→ released（已发布）→ archived（已归档）

const VERSION_STATUS = ['planning', 'in_progress', 'released', 'archived'] as const;

// GET /api/products/:id/versions —— 版本列表（按 order 升序，附任务数）
router.get(
  '/:id/versions',
  requireAuth,
  requireProductAccess,
  asyncHandler(async (req, res) => {
    const versions = await prisma.productVersion.findMany({
      where: { productId: req.product!.productId },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { tasks: true } } },
    });
    res.json({
      versions: versions.map((v) => ({
        id: v.id,
        name: v.name,
        description: v.description,
        releaseNotes: v.releaseNotes,
        status: v.status,
        startDate: v.startDate,
        releaseDate: v.releaseDate,
        order: v.order,
        taskCount: v._count.tasks,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      })),
    });
  }),
);

// POST /api/products/:id/versions —— 创建版本（po/admin）
const createVersionSchema = z.object({
  name: z.string().min(1, '版本号必填').max(40),
  description: z.string().max(500).optional().default(''),
  releaseNotes: z.string().max(5000).optional().default(''),
  status: z.enum(VERSION_STATUS).optional().default('planning'),
  startDate: z.string().datetime().optional().nullable(),
  releaseDate: z.string().datetime().optional().nullable(),
  order: z.number().int().min(0).optional(),
});
router.post(
  '/:id/versions',
  requireAuth,
  requireProductAccess,
  requireProductRole('po', 'admin'),
  asyncHandler(async (req, res) => {
    const parsed = createVersionSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());
    const d = parsed.data;

    // 同产品内版本号唯一（重名 409）
    const version = await prisma.productVersion
      .create({
        data: {
          productId: req.product!.productId,
          name: d.name,
          description: d.description,
          releaseNotes: d.releaseNotes,
          status: d.status,
          startDate: d.startDate ? new Date(d.startDate) : null,
          releaseDate: d.releaseDate ? new Date(d.releaseDate) : null,
          order: d.order ?? 0,
        },
        include: { _count: { select: { tasks: true } } },
      })
      .catch((e: { code?: string }) => {
        if (e.code === 'P2002') throw new ApiError(409, '该产品下已存在同名版本');
        throw e;
      });

    res.status(201).json({ version: serialize(version) });

    // P9 安全（H5）：版本创建审计
    writeAudit(
      { actorId: req.user!.sub, action: 'version_create', target: `创建版本「${d.name}」`, workspaceId: null, metadata: { productId: req.product!.productId } },
      req,
    ).catch(() => {});
  }),
);

// PATCH /api/products/:id/versions/:vid —— 更新版本（po/admin）
const updateVersionSchema = z.object({
  name: z.string().min(1, '版本号必填').max(40).optional(),
  description: z.string().max(500).optional(),
  releaseNotes: z.string().max(5000).optional(),
  status: z.enum(VERSION_STATUS).optional(),
  startDate: z.string().datetime().optional().nullable(),
  releaseDate: z.string().datetime().optional().nullable(),
  order: z.number().int().min(0).optional(),
});
router.patch(
  '/:id/versions/:vid',
  requireAuth,
  requireProductAccess,
  requireProductRole('po', 'admin'),
  asyncHandler(async (req, res) => {
    const parsed = updateVersionSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());

    // 版本必须属于当前产品
    await prisma.productVersion.findFirstOrThrow({
      where: { id: req.params.vid, productId: req.product!.productId },
      select: { id: true },
    });

    const d = parsed.data;
    const data: Record<string, unknown> = {};
    if (d.name !== undefined) data.name = d.name;
    if (d.description !== undefined) data.description = d.description;
    if (d.releaseNotes !== undefined) data.releaseNotes = d.releaseNotes;
    if (d.status !== undefined) data.status = d.status;
    if (d.startDate !== undefined) data.startDate = d.startDate ? new Date(d.startDate) : null;
    if (d.releaseDate !== undefined) data.releaseDate = d.releaseDate ? new Date(d.releaseDate) : null;
    if (d.order !== undefined) data.order = d.order;

    const version = await prisma.productVersion
      .update({
        where: { id: req.params.vid },
        data,
        include: { _count: { select: { tasks: true } } },
      })
      .catch((e: { code?: string }) => {
        if (e.code === 'P2002') throw new ApiError(409, '该产品下已存在同名版本');
        throw e;
      });

    res.json({ version: serialize(version) });

    // P9 安全（H5）：版本更新审计
    writeAudit(
      { actorId: req.user!.sub, action: 'version_update', target: `更新版本「${serialize(version).name}」（字段：${Object.keys(data).join('/') || '无'}）`, workspaceId: null, metadata: { productId: req.product!.productId, versionId: req.params.vid } },
      req,
    ).catch(() => {});
  }),
);

// DELETE /api/products/:id/versions/:vid —— 删除版本（po/admin；任务解除关联）
router.delete(
  '/:id/versions/:vid',
  requireAuth,
  requireProductAccess,
  requireProductRole('po', 'admin'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.productVersion.findFirstOrThrow({
      where: { id: req.params.vid, productId: req.product!.productId },
      select: { id: true, name: true },
    });
    await prisma.productVersion.delete({ where: { id: req.params.vid } });
    res.json({ ok: true });

    // P9 安全（H5）：版本删除审计
    writeAudit(
      { actorId: req.user!.sub, action: 'version_delete', target: `删除版本「${existing.name}」`, workspaceId: null, metadata: { productId: req.product!.productId, versionId: req.params.vid } },
      req,
    ).catch(() => {});
  }),
);

// 序列化（含任务数）
function serialize(v: { id: string; name: string; description: string; releaseNotes: string; status: string; startDate: Date | null; releaseDate: Date | null; order: number; createdAt: Date; updatedAt: Date; _count: { tasks: number } }) {
  return {
    id: v.id,
    name: v.name,
    description: v.description,
    releaseNotes: v.releaseNotes,
    status: v.status,
    startDate: v.startDate,
    releaseDate: v.releaseDate,
    order: v.order,
    taskCount: v._count.tasks,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

export default router;
