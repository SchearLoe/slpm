import express from 'express';
import http from 'node:http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import fs from 'node:fs';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import authRoutes from './routes/auth.routes.js';
import taskRoutes from './routes/task.routes.js';
import scheduleRoutes from './routes/schedule.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import workspaceRoutes from './routes/workspace.routes.js';
import articleRoutes from './routes/article.routes.js';
import fileRoutes from './routes/file.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import aiRoutes from './routes/ai.routes.js';
import productRoutes from './routes/product.routes.js';
import productVersionRoutes from './routes/product-version.routes.js';
import productDashboardRoutes from './routes/product-dashboard.routes.js';
import tagRoutes from './routes/tag.routes.js';
import auditRoutes from './routes/audit.routes.js';
import { setupSocket } from './lib/ws.js';
import { ensureSystemAdmin } from './lib/seed.js';
import { errorHandler, notFound } from './middleware/error.js';
import { apiLimiter } from './middleware/rateLimit.js';

const app = express();

// P7 安全修复：trust proxy 配置（部署在 nginx/CDN/负载均衡后必须开启，
// 否则 req.ip 永远是反代 IP，导致 express-rate-limit 全站共享配额失效、审计 IP 失真）
if (env.trustProxy) {
  app.set('trust proxy', 1);
}

// P1-3：启动时确保上传根目录存在
fs.mkdirSync(env.uploadDir, { recursive: true });

// ---- 中间件 ----
app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true,
  }),
);
// P7 安全修复：限制请求体大小，防超大 JSON DoS
app.use(express.json({ limit: '2mb' }));
// P5-1：通用 API 速率限制（认证类路由在各自 router 内加更严格限制）
app.use('/api/', apiLimiter);

// 健康检查（无需认证，供前端探活/容器健康检查）
// P5-2：探活数据库连接（真实 liveness，而非仅进程存活）
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: 'slpm-server', db: 'ok', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ ok: false, service: 'slpm-server', db: 'unavailable', time: new Date().toISOString() });
  }
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
// P3：产品线 / 版本 / 跨工作区聚合
app.use('/api/products', productRoutes);
app.use('/api/products', productVersionRoutes);
app.use('/api/products', productDashboardRoutes);
// P6-A：工作区标签库
app.use('/api/tags', tagRoutes);
// P6-C：审计日志（登录/成员变更/角色变更等）
app.use('/api/audit', auditRoutes);

// ---- 错误兜底 ----
app.use(notFound);
app.use(errorHandler);

// P1-6：Socket.IO 实时推送（需 http.Server，不能直接用 app.listen）
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: { origin: env.clientOrigin, credentials: true },
});
setupSocket(io);

// P4-1：启动引导（超级管理员初始化）→ 监听端口
async function bootstrap() {
  try {
    await ensureSystemAdmin();
  } catch (e) {
    console.error('⚠️ 超级管理员初始化失败（忽略，继续启动）:', e instanceof Error ? e.message : e);
  }
  server.listen(env.port, () => {
    console.log(`🟢 slpm-server 运行中: http://localhost:${env.port}`);
    console.log(`   环境: ${env.nodeEnv} · 前端: ${env.clientOrigin} · WebSocket ✓`);
  });
}

// P5-2：优雅关闭（SIGTERM/SIGINT → 停止接受新连接 → 等 in-flight 完成 → 断开 Prisma）
function gracefulShutdown(signal: string) {
  console.log(`\n📤 收到 ${signal}，正在优雅关闭…`);
  server.close(async () => {
    console.log('   HTTP 服务已停止');
    try {
      await prisma.$disconnect();
      console.log('   数据库连接已断开');
    } catch {
      console.error('   数据库断开失败（忽略）');
    }
    process.exit(0);
  });
  // 5 秒后强制退出（防卡死）
  setTimeout(() => {
    console.error('⚠️ 5 秒内未能完成优雅关闭，强制退出');
    process.exit(1);
  }, 5000);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ 未处理的 Promise rejection:', reason);
});

bootstrap();
