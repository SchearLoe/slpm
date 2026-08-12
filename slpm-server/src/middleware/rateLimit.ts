import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * P5-1：速率限制中间件。
 *
 * - authLimiter：登录/注册/忘记密码/重置密码 —— 防 brute-force / enumeration
 * - apiLimiter：通用 API（按 IP，宽松，防基础滥用）
 * - aiLimiter（P8 MH2）：AI 接口按用户限流，防成本 DoS / 上游配额耗尽
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

// P8 安全修复（MH2）：AI 调用按 token 计费且昂贵，须按用户独立限流。
// keyGenerator 用 req.user.sub（JWT 已解析），避免多用户共享 IP 配额被一人耗尽。
// 每个登录用户每分钟最多 10 次 AI 调用（suggest + stream 合并计算）。
// P9 健壮性（L4）：未登录兜底用官方 ipKeyGenerator，正确归一化 IPv6，消除
// express-rate-limit 的 ERR_ERL_KEY_GEN_IPV6 启动校验告警。
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user?.sub ? `ai:${req.user.sub}` : ipKeyGenerator(req.ip ?? 'anon')),
  message: { error: 'AI 请求过于频繁，每分钟最多 10 次，请稍后再试' },
});
