import { prisma } from './prisma.js';
import { emitToUser } from './ws.js';

/**
 * P1-4 通知系统（站内信）—— 发送助手。
 *
 * 通知由两条业务事件触发：
 *   1. 评论 @某人：TaskComment.mentions 已存了用户名，这里按姓名在工作区内解析为 userId。
 *   2. 任务指派变更：assigneeId 从 A 改为 B（或从无到有）时，给新负责人发通知。
 *
 * 所有发送函数均吞掉错误（.catch 仅记日志）：通知是"尽力而为"的增强，
 * 主流程（评论/编辑）已成功，绝不能因通知写库失败而 500。
 *
 * P1-6：通知创建后同步 emit WebSocket 事件（在线收，离线下次打开页面拉取）。
 */

// 不打扰自己：给自己评论、把任务指派给自己，都不发通知
const SELF_FILTER = (actorId: string, recipientId: string) => actorId !== recipientId;

/**
 * 评论提及：给被 @ 的成员发通知。
 *
 * @param taskId       任务 id（点击跳转目标）
 * @param workspaceId  工作区 id（限制成员解析范围）
 * @param actorId      评论作者
 * @param mentions     评论正文中解析出的 @姓名 数组
 * @param snippet      评论正文片段（作为通知 body 摘要）
 */
export async function notifyMentions(
  taskId: string,
  workspaceId: string,
  actorId: string,
  mentions: string[],
  snippet: string,
): Promise<void> {
  if (mentions.length === 0) return;

  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { name: true },
  });

  // 工作区内按姓名匹配成员（mentions 是姓名，非 id）。
  // 用 link表 → user，拿到候选收件人。同名匹配多个时给每个人都发。
  const memberships = await prisma.workspaceMember.findMany({
    where: { workspaceId, user: { name: { in: mentions } } },
    select: { userId: true },
  });

  // 去重 + 排除作者自己
  const recipientIds = [...new Set(memberships.map((m) => m.userId))].filter((uid) =>
    SELF_FILTER(actorId, uid),
  );
  if (recipientIds.length === 0) return;

  // P4-2：按收件人通知偏好过滤（关闭 @提及 的成员不打扰）
  const enabledIds = await filterBySetting(recipientIds, 'notifyMention');
  if (enabledIds.length === 0) return;

  const title = `${actor?.name ?? '有人'} 在任务中提到了你`;
  await prisma.notification
    .createMany({
      data: enabledIds.map((userId) => ({
        userId,
        workspaceId,
        type: 'mention',
        title,
        body: snippet.slice(0, 200),
        taskId,
      })),
    })
    .catch((e) => console.error('[notifyMentions] 写通知失败:', e));

  // P1-6：WS 实时推送（online 收，offline 下次页面拉取）
  for (const userId of enabledIds) {
    emitToUser(userId, 'notification', { type: 'mention', taskId, snippet: snippet.slice(0, 200) });
  }
}

/**
 * 任务指派变更：当 assigneeId 变化（含从无到有）时，给新负责人发通知。
 * 不打扰自己（指派给自己不发）、也不在"无→无"时误发。
 *
 * @param taskId
 * @param workspaceId
 * @param actorId     操作者（改指派的人）
 * @param oldAssignee 原负责人 id（null 表示原本无人）
 * @param newAssignee 新负责人 id（null 表示已取消指派，不发通知）
 */
export async function notifyAssignment(
  taskId: string,
  workspaceId: string,
  actorId: string,
  oldAssignee: string | null,
  newAssignee: string | null,
): Promise<void> {
  if (!newAssignee) return; // 取消指派不打扰
  if (oldAssignee === newAssignee) return; // 没变化

  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { name: true },
  });

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { title: true },
  });

  if (!SELF_FILTER(actorId, newAssignee)) return;

  // P4-2：收件人关闭了「任务指派」通知则跳过
  const enabled = await filterBySetting([newAssignee], 'notifyAssign');
  if (enabled.length === 0) return;

  await prisma.notification
    .create({
      data: {
        userId: newAssignee,
        workspaceId,
        type: 'assign',
        title: `${actor?.name ?? '有人'} 把任务指派给了你`,
        body: task?.title ?? '',
        taskId,
      },
    })
    .catch((e) => console.error('[notifyAssignment] 写通知失败:', e));

  // P1-6：WS 实时推送
  emitToUser(newAssignee, 'notification', { type: 'assign', taskId, title: task?.title ?? '' });
}

/**
 * P4-2：按收件人的 UserSettings 过滤通知类型。
 * 记录缺失视为开启（默认值），静默失败不影响主流程。
 */
async function filterBySetting(userIds: string[], field: 'notifyMention' | 'notifyAssign' | 'notifyDeadline'): Promise<string[]> {
  try {
    const settings = await prisma.userSettings.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, notifyMention: true, notifyAssign: true, notifyDeadline: true },
    });
    const disabled = new Set(settings.filter((s) => s[field] === false).map((s) => s.userId));
    return userIds.filter((uid) => !disabled.has(uid));
  } catch (e) {
    console.error('[filterBySetting] 查询失败，按全部开启处理:', e);
    return userIds;
  }
}
