/**
 * P1-6：Socket.IO 客户端（WebSocket 实时推送）。
 * 连接时携带 JWT token 做认证，收到 notification 事件时通知监听方。
 */
import { io, Socket } from 'socket.io-client';

// P4-2 修复：socket.io 需要后端真实地址。
//  - 开发（VITE_API_BASE_URL=/api 走 vite proxy，WS 不走 proxy）：直连 http://localhost:8080
//  - 生产：同源部署时用当前窗口 origin
//  - 特殊部署可用 VITE_WS_URL 覆盖
const VITE_BASE = import.meta.env.VITE_API_BASE_URL;
const SOCKET_URL = import.meta.env.VITE_WS_URL
  ?? (VITE_BASE && VITE_BASE !== '/api' ? VITE_BASE : import.meta.env.DEV ? 'http://localhost:8080' : window.location.origin);

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

// P4-2：在线状态事件负载
export interface PresencePayload {
  userId: string;
  online: boolean;
}

/** 注册在线状态处理器（某成员上线/下线） */
export function onPresence(handler: (data: PresencePayload) => void) {
  socket?.on('presence', handler);
  return () => socket?.off('presence', handler);
}

/** 注册在线列表初始化（连接时服务端推当前在线成员） */
export function onPresenceInit(handler: (data: { online: string[] }) => void) {
  socket?.on('presence:init', handler);
  return () => socket?.off('presence:init', handler);
}
