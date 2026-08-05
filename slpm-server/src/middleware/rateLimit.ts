import rateLimit from 'express-rate-limit';

/**
 * P5-1：速率限制中间件。
 *
 * - authLimiter：登录/注册/忘记密码/重置密码 —— 防 brute-force / enumeration
 * - apiLimiter：通用 API（按 IP，宽松，防基础滥用）
 */

// 认证类：每个 IP 每分钟最多 10 次（登录/注册/忘记密码等）
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试（每分钟最多 10 次认证尝试）' },
});

// 通用 API：每个 IP 每分钟最多 300 次（正常使用足够，防爬虫/滥用）
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
});
