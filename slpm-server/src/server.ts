import express from 'express';
import http from 'node:http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import fs from 'node:fs';
import { env } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import taskRoutes from './routes/task.routes.js';
import scheduleRoutes from './routes/schedule.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import workspaceRoutes from './routes/workspace.routes.js';
import articleRoutes from './routes/article.routes.js';
import fileRoutes from './routes/file.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import aiRoutes from './routes/ai.routes.js';
import { setupSocket } from './lib/ws.js';
import { errorHandler, notFound } from './middleware/error.js';

const app = express();

// P1-3：启动时确保上传根目录存在
fs.mkdirSync(env.uploadDir, { recursive: true });

// ---- 中间件 ----
app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true,
  }),
);
app.use(express.json());

// 健康检查（无需认证，供前端探活）
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'slpm-server', time: new Date().toISOString() });
});

// ---- 路由 ----
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/settings', settingsRoutes);
// P1-4：通知按收件人维度，不走 requireWorkspace
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes);

// ---- 错误兜底 ----
app.use(notFound);
app.use(errorHandler);

// P1-6：Socket.IO 实时推送（需 http.Server，不能直接用 app.listen）
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: { origin: env.clientOrigin, credentials: true },
});
setupSocket(io);

server.listen(env.port, () => {
  console.log(`🟢 slpm-server 运行中: http://localhost:${env.port}`);
  console.log(`   环境: ${env.nodeEnv} · 前端: ${env.clientOrigin} · WebSocket ✓`);
});
