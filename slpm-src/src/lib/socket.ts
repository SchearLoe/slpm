/**
 * P1-6：Socket.IO 客户端（WebSocket 实时推送）。
 * 连接时携带 JWT token 做认证，收到 notification 事件时通知监听方。
 */
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

let socket: Socket | null = null;

/** 连接（登录后调用） */
export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'], // 优先 WS，降级 polling
    reconnection: true,
    reconnectionDelay: 2000,
  });
  socket.on('connect', () => console.log('[ws] 已连接'));
  socket.on('disconnect', (reason) => console.log('[ws] 断开:', reason));
  socket.on('connect_error', (err) => console.warn('[ws] 连接错误:', err.message));
  return socket;
}

/** 断开（登出时调用） */
export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

/** 获取当前 socket（可能 null） */
export function getSocket(): Socket | null {
  return socket;
}

/** 注册通知处理器（收到 WS 推送时刷新 UI） */
export function onNotification(handler: (data: { type: string; taskId?: string; snippet?: string; title?: string }) => void) {
  socket?.on('notification', handler);
  return () => socket?.off('notification', handler);
}
