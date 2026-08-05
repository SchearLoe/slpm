import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/workspace.js';
import { ApiError } from '../middleware/error.js';

/**
 * P6-A：工作区级标签库。
 *
 * 任务通过 Task.tags String[] 引用标签名；本路由管理标签本身（名称 + 颜色）。
 * 重命名标签时会级联更新所有引用该名称的任务 tags 数组（同事务）。
 */

const router = Router();

const COLOR_KEYS = [
  'emerald',
  'cyan',
  'purple',
  'rose',
  'amber',
  'sky',
  'indigo',
  'teal',
  'slate',
] as const;

const createSchema = z.object({
  name: z.string().min(1, '标签名必填').max(30, '标签名过长'),
  color: z.enum(COLOR_KEYS).optional().default('emerald'),
});

// ---- GET /api/tags —— 当前工作区全部标签 ----
router.get(
  '/',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const tags = await prisma.tag.findMany({
      where: { workspaceId: req.workspace!.id },
      orderBy: [{ createdAt: 'asc' }],
    });
    res.json({ tags });
  }),
);

// ---- POST /api/tags ----
router.post(
  '/',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());
    const { name, color } = parsed.data;

    const tag = await prisma.tag.create({
      data: {
        name: name.trim(),
        color,
        workspaceId: req.workspace!.id,
        createdBy: req.user!.sub,
      },
    });
    res.status(201).json({ tag });
  }),
);

// ---- PATCH /api/tags/:id —— 重命名 / 改色（重命名级联更新任务 tags）----
router.patch(
  '/:id',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const parsed = z
      .object({
        name: z.string().min(1).max(30).optional(),
        color: z.enum(COLOR_KEYS).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());

    const existing = await prisma.tag.findFirst({
      where: { id: req.params.id, workspaceId: req.workspace!.id },
      select: { id: true, name: true },
    });
    if (!existing) throw new ApiError(404, '标签不存在');

    const data: { name?: string; color?: string } = {};
    if (parsed.data.color) data.color = parsed.data.color;
    const newName = parsed.data.name?.trim();

    await prisma.$transaction(async (tx) => {
      if (newName && newName !== existing.name) {
        // 重命名：把所有引用旧名的任务 tags 数组里的旧名替换为新名
        const tasks = await tx.task.findMany({
          where: { workspaceId: req.workspace!.id, tags: { has: existing.name } },
          select: { id: true, tags: true },
        });
        for (const t of tasks) {
          const next = t.tags.map((tag) => (tag === existing.name ? newName : tag));
          await tx.task.update({ where: { id: t.id }, data: { tags: next } });
        }
        data.name = newName;
      }
      await tx.tag.update({ where: { id: existing.id }, data });
    });

    const tag = await prisma.tag.findUniqueOrThrow({ where: { id: existing.id } });
    res.json({ tag });
  }),
);

// ---- DELETE /api/tags/:id —— 删除标签（级联从任务 tags 数组移除该名）----
router.delete(
  '/:id',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const existing = await prisma.tag.findFirst({
      where: { id: req.params.id, workspaceId: req.workspace!.id },
      select: { id: true, name: true },
    });
    if (!existing) throw new ApiError(404, '标签不存在');

    await prisma.$transaction(async (tx) => {
      // 从所有任务的 tags 数组里移除该标签名
      const tasks = await tx.task.findMany({
        where: { workspaceId: req.workspace!.id, tags: { has: existing.name } },
        select: { id: true, tags: true },
      });
      for (const t of tasks) {
        const next = t.tags.filter((tag) => tag !== existing.name);
        await tx.task.update({ where: { id: t.id }, data: { tags: next } });
      }
      await tx.tag.delete({ where: { id: existing.id } });
    });

    res.json({ ok: true });
  }),
);

export default router;
