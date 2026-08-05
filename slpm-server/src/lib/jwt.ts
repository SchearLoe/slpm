import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  purpose?: 'reset'; // P4-2：密码重置 token 标记
}

export function signToken(payload: JwtPayload, expiresIn?: string): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: expiresIn ?? env.jwtExpiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}
