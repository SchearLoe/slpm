import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/workspace.js';
import { ApiError } from '../middleware/error.js';
import { emitToUser } from '../lib/ws.js';

/**
 * P1-4 通知系统（站内信）—— 路由。
 *
 * 通知是【收件人维度】的资源：只看 userId，不绑定 X-Workspace-Id。
 * 原因：顶栏铃铛应汇总用户在所有工作区收到的消息，与当前正在浏览的工作区无关。
 * 因此这里只用 requireAuth，不用 requireWorkspace。
 */

const router = Router();

// 通知脱敏 shape（统一返回格式）
function shape(n: {
  id: string;
  type: string;
  title: string;
  body: string | null;
  taskId: string | null;
  read: boolean;
  createdAt: Date;
  workspaceId: string;
}) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    taskId: n.taskId,
    read: n.read,
    workspaceId: n.workspaceId,
    createdAt: n.createdAt.toISOString(),
  };
}

// ---- GET /api/notifications ---- 当前用户的通知列表（按时间倒序）
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.sub },
      orderBy: { createdAt: 'desc' },
      take: 50, // 顶栏铃铛只需最近 50 条，避免无界增长
    });
    res.json({ notifications: notifications.map(shape) });
  }),
);

// ---- GET /api/notifications/unread-count ---- 未读数（顶栏红点用，轻量）
router.get(
  '/unread-count',
  requireAuth,
  asyncHandler(async (req, res) => {
    const count = await prisma.notification.count({
      where: { userId: req.user!.sub, read: false },
    });
    res.json({ count });
  }),
);

// ---- PATCH /api/notifications/:id/read ---- 标记单条已读
router.patch(
  '/:id/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    const updated = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.sub },
      data: { read: true },
    });
    if (updated.count === 0) throw new ApiError(404, '通知不存在');
    res.json({ ok: true });
  }),
);

// ---- POST /api/notifications/read-all ---- 全部标为已读
router.post(
  '/read-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.sub, read: false },
      data: { read: true },
    });
    res.json({ ok: true });
  }),
);

// ---- DELETE /api/notifications/read ---- 清除所有已读通知
router.delete(
  '/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.notification.deleteMany({
      where: { userId: req.user!.sub, read: true },
    });
    res.json({ ok: true });
  }),
);

// ---- POST /api/notifications/send ----
// P4-1：成员间站内信（团队协作页发消息 / AI 页发送协同提醒）。
// 需要工作区上下文：收件人必须是当前工作区成员。
const sendSchema = z.object({
  userId: z.string().min(1, '缺少收件人'),
  title: z.string().min(1, '标题必填').max(120),
  body: z.string().max(1000).optional().default(''),
});
router.post(
  '/send',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());

    if (parsed.data.userId === req.user!.sub) {
      throw new ApiError(400, '不能给自己发送站内信');
    }

    // 收件人必须是当前工作区成员
    const target = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: req.workspace!.id, userId: parsed.data.userId } },
      include: { user: { select: { name: true } } },
    });
    if (!target) throw new ApiError(404, '收件人不在当前工作区');

    const sender = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { name: true },
    });

    const notification = await prisma.notification.create({
      data: {
        userId: parsed.data.userId,
        workspaceId: req.workspace!.id,
        type: 'system',
        title: `${sender?.name ?? '同事'}：${parsed.data.title}`,
        body: parsed.data.body,
        read: false,
      },
    });

    // P1-6：WebSocket 实时推送
    emitToUser(parsed.data.userId, 'notification', shape(notification));

    res.status(201).json({ notification: shape(notification) });
  }),
);

export default router;
