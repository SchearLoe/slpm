import dotenv from 'dotenv';
dotenv.config();

function required(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (!v) throw new Error(`缺少必需的环境变量: ${key}`);
  return v;
}

export const env = {
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET', 'slpm-dev-secret'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  port: Number(process.env.PORT ?? 8080),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:3000',
  // P1-3：文件上传本地存储根目录（按工作区分子目录 uploads/<workspaceId>/）
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  // P1-4：AI API Key 加密密钥（强 required，无 fallback）
  aiEncryptionKey: required('AI_ENCRYPTION_KEY'),
  // P4-1：超级管理员初始化（可选，未配置则随机生成并打印到控制台）
  initialAdminEmail: process.env.INITIAL_ADMIN_EMAIL,
  initialAdminPassword: process.env.INITIAL_ADMIN_PASSWORD,
} as const;
