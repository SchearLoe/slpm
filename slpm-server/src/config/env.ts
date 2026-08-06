import dotenv from 'dotenv';
dotenv.config();

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

function required(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (!v) throw new Error(`缺少必需的环境变量: ${key}`);
  return v;
}

// P7 安全修复：JWT_SECRET 在生产环境强制 required（无 fallback）；
// 仅开发环境允许使用兜底默认值，并打醒目警告。
const jwtSecretFallback = isProduction ? undefined : 'slpm-dev-secret-do-not-use-in-prod';
const jwtSecret = required('JWT_SECRET', jwtSecretFallback);
if (!isProduction && jwtSecret.startsWith('slpm-dev-secret')) {
  console.warn('⚠️  [安全警告] JWT_SECRET 未配置，正在使用开发兜底默认值。生产环境务必设置强随机 JWT_SECRET！');
}

// P7 安全修复：CORS origin 校验——credentials:true 时禁止通配
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:3000';
if (isProduction && (clientOrigin === '*' || !clientOrigin)) {
  throw new Error('生产环境 CLIENT_ORIGIN 不能为通配 * 或空（credentials:true 需精确 origin）');
}

export const env = {
  databaseUrl: required('DATABASE_URL'),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  port: Number(process.env.PORT ?? 8080),
  nodeEnv,
  isProduction,
  clientOrigin,
  // P1-3：文件上传本地存储根目录（按工作区分子目录 uploads/<workspaceId>/）
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  // P1-4：AI API Key 加密密钥（强 required，无 fallback）
  aiEncryptionKey: required('AI_ENCRYPTION_KEY'),
  // P4-1：超级管理员初始化（可选，未配置则随机生成）
  initialAdminEmail: process.env.INITIAL_ADMIN_EMAIL,
  initialAdminPassword: process.env.INITIAL_ADMIN_PASSWORD,
  // P7 安全修复：忘记密码的"开发态返回重置链接"改为显式开关（默认关，与 NODE_ENV 解耦）
  enableDevResetLink: process.env.ENABLE_DEV_RESET_LINK === 'true',
  // P7：反向代理信任跳数（部署在 nginx/CDN 后应设为 1 或更高；直连部署保持默认）
  trustProxy: process.env.TRUST_PROXY === 'true',
} as const;
