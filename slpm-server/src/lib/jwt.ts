import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  purpose?: 'reset'; // P4-2：密码重置 token 标记
  // P9 安全（H3）：令牌版本号。requireAuth 会与 User.tokenVersion 比对，不一致即拒绝（重置密码后旧 token 失效）。
  tv?: number;
  // P9 安全（L2）：重置 token 的一次性 nonce。reset-password 校验后清空 User.resetNonce，重放即失效。
  nonce?: string;
}

export function signToken(payload: JwtPayload, expiresIn?: string): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: expiresIn ?? env.jwtExpiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  // P8 安全修复（M5）：显式钉死算法为 HS256，杜绝 alg 混淆/none 攻击
  return jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
}
