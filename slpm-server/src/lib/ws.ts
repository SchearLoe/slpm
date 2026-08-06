/**
 * P1-6：Socket.IO 实时推送。
 *
 * server.ts 调用 setupSocket(io) 初始化认证/房间。
 * notify.ts 调用 emitToUser/emitToWorkspace 推送事件到对应客户端。
 *
 * P4-2：在线状态（presence）—— 连接时记录 userId，断开时移除；
 * 用户加入/离开时向所在工作区广播 'presence' 事件。
 */
import { Server as SocketServer, Socket } from 'socket.io';
import { verifyToken } from './jwt.js';
import { logger } from './logger.js';
import { prisma } from './prisma.js';

let io: SocketServer | null = null;

// P4-2：在线用户集合（userId → 连接的 socket 数，多标签页防误删）
const online = new Map<string, number>();
// 用户 → 其工作区列表（断开时广播用）
const userWorkspaces = new Map<string, string[]>();

function getOnlineUsers(): Set<string> {
  return new Set(online.keys());
}

/** 广播某用户的在线状态变化到其所有工作区 */
function broadcastPresence(userId: string, wsIds: string[]) {
  const payload = { userId, online: (online.get(userId) ?? 0) > 0 };
  for (const wsId of wsIds) {
    io?.to(`ws:${wsId}`).emit('presence', payload);
  }
}

/** 初始化：JWT 认证 + 按 workspace 加入房间 */
export function setupSocket(server: SocketServer) {
  io = server;

  // 认证中间件：从 handshake.auth.token 提取 JWT
  server.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('缺少认证 token'));
    try {
      const payload = verifyToken(token);
      socket.data.userId = payload.sub;
      // 查该用户的所有 workspace，加入对应房间
      const members = await prisma.workspaceMember.findMany({
        where: { userId: payload.sub },
        select: { workspaceId: true },
      });
      const wsIds = members.map((m) => m.workspaceId);
      userWorkspaces.set(payload.sub, wsIds);
      for (const wsId of wsIds) {
        socket.join(`ws:${wsId}`);
      }
      socket.join(`user:${payload.sub}`);
      next();
    } catch {
      next(new Error('token 无效或已过期'));
    }
  });

  server.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    logger.log(`[ws] 用户 ${userId} 已连接 (${socket.id})`);

    // P4-2：标记在线 + 广播给所在工作区
    online.set(userId, (online.get(userId) ?? 0) + 1);
    broadcastPresence(userId, userWorkspaces.get(userId) ?? []);

    // 新连接加入时，把当前在线成员推给 TA（进入页面即知谁在线）
    const onlineList = [...getOnlineUsers()].filter((u) => u !== userId);
    if (onlineList.length > 0) {
      socket.emit('presence:init', { online: onlineList });
    }

    socket.on('disconnect', () => {
      const count = (online.get(userId) ?? 1) - 1;
      if (count <= 0) {
        online.delete(userId);
      } else {
        online.set(userId, count);
      }
      broadcastPresence(userId, userWorkspaces.get(userId) ?? []);
      logger.log(`[ws] 用户 ${userId} 已断开`);
    });
  });
}

/** 给指定用户推送事件（用 user:xxx 房间，在线即收） */
export function emitToUser(userId: string, event: string, data: unknown) {
  io?.to(`user:${userId}`).emit(event, data);
}

/** 给指定工作区所有在线成员推送事件 */
export function emitToWorkspace(wsId: string, event: string, data: unknown) {
  io?.to(`ws:${wsId}`).emit(event, data);
}

/** P4-2：当前在线用户 id 列表 */
export function getOnlineUsersList(): string[] {
  return [...getOnlineUsers()];
}

export function getIO(): SocketServer | null {
  return io;
}
