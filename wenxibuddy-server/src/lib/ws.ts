/**
 * P1-6：Socket.IO 实时推送。
 *
 * server.ts 调用 setupSocket(io) 初始化认证/房间。
 * notify.ts 调用 emitToUser/emitToWorkspace 推送事件到对应客户端。
 */
import { Server as SocketServer, Socket } from 'socket.io';
import { verifyToken } from './jwt.js';
import { prisma } from './prisma.js';

let io: SocketServer | null = null;

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
      for (const m of members) {
        socket.join(`ws:${m.workspaceId}`);
      }
      socket.join(`user:${payload.sub}`);
      next();
    } catch {
      next(new Error('token 无效或已过期'));
    }
  });

  server.on('connection', (socket) => {
    console.log(`[ws] 用户 ${socket.data.userId} 已连接 (${socket.id})`);
    socket.on('disconnect', () => {
      console.log(`[ws] 用户 ${socket.data.userId} 已断开`);
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

export function getIO(): SocketServer | null {
  return io;
}
