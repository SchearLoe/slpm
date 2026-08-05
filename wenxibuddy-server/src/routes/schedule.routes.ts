import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/workspace.js';
import { ApiError } from '../middleware/error.js';

const router = Router();

// ---- GET /api/schedules?month=YYYY-MM ----
// 按月拉取日程（修复原 demo "只能 5 月" 的问题，支持任意月份）
router.get(
  '/',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const month = z.string().regex(/^\d{4}-\d{2}$/).safeParse(req.query.month);
    if (!month.success) {
      throw new ApiError(400, '请提供 month 参数，格式 YYYY-MM');
    }

    const [year, mon] = month.data.split('-').map(Number);
    // 该月 1 日 00:00 ~ 下月 1 日 00:00（本地时区由服务端处理）
    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 1);

    const schedules = await prisma.scheduleEvent.findMany({
      where: {
        // P1-2：按工作区隔离（替代原 ownerId 过滤）
        workspaceId: req.workspace!.id,
        // 跨界落在区间内的日程都算（开始 < 下月初 且 结束 >= 本月初）
        AND: [{ startTime: { lt: end } }, { endTime: { gte: start } }],
      },
      orderBy: { startTime: 'asc' },
    });

    res.json({ schedules });
  }),
);

// ---- POST /api/schedules ----
const createSchema = z.object({
  title: z.string().min(1, '标题必填').max(200),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().max(200).optional().nullable(),
  priority: z.enum(['高', '中', '低']).optional().default('中'),
  attendees: z.array(z.string()).optional().default([]),
  status: z.enum(['待开始', '进行中', '已结束']).optional().default('待开始'),
});

router.post(
  '/',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());
    const d = parsed.data;

    if (new Date(d.endTime) <= new Date(d.startTime)) {
      throw new ApiError(400, '结束时间必须晚于开始时间');
    }

    const schedule = await prisma.scheduleEvent.create({
      data: {
        title: d.title,
        startTime: new Date(d.startTime),
        endTime: new Date(d.endTime),
        location: d.location ?? null,
        priority: d.priority,
        attendees: d.attendees,
        status: d.status,
        ownerId: req.user!.sub, // 创建者（保留）
        workspaceId: req.workspace!.id, // P1-2：归属当前工作区
      },
    });
    res.status(201).json({ schedule });
  }),
);

// ---- PUT /api/schedules/:id ----
router.put(
  '/:id',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.partial().safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());
    const d = parsed.data;

    const data: Record<string, unknown> = {};
    if (d.title !== undefined) data.title = d.title;
    if (d.startTime !== undefined) data.startTime = new Date(d.startTime);
    if (d.endTime !== undefined) data.endTime = new Date(d.endTime);
    if (d.location !== undefined) data.location = d.location;
    if (d.priority !== undefined) data.priority = d.priority;
    if (d.attendees !== undefined) data.attendees = d.attendees;
    if (d.status !== undefined) data.status = d.status;

    const schedule = await prisma.scheduleEvent.update({
      where: { id: req.params.id, workspaceId: req.workspace!.id }, // P1-2：工作区内日程
      data,
    });
    res.json({ schedule });
  }),
);

// ---- DELETE /api/schedules/:id ----
router.delete(
  '/:id',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    await prisma.scheduleEvent.delete({
      where: { id: req.params.id, workspaceId: req.workspace!.id },
    });
    res.json({ ok: true });
  }),
);

export default router;
