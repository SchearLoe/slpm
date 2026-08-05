/**
 * P1-4：AES-256-GCM 对称加密工具，用于加密存储 AI API Key。
 *
 * 密文格式："<ivHex>:<authTagHex>:<cipherHex>"，base64 友好，便于存 TEXT 列。
 * 密钥由 AI_ENCRYPTION_KEY 环境变量经 scrypt 派生（盐固定，因密钥本身已是高熵随机串）。
 */
import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

const ALGO = 'aes-256-gcm';
// scrypt 派生 32 字节密钥（AES-256 需要）；盐固定，因为 env 密钥已高熵
const KEY = scryptSync(env.aiEncryptionKey, 'slpm-ai-key-salt', 32);

/** 加密明文 → "iv:authTag:cipher"（全 hex） */
export function encrypt(plain: string): string {
  const iv = randomBytes(12); // GCM 推荐 12 字节 IV
  const cipher = createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

/** 解密 "iv:authTag:cipher" → 明文。密文格式错/被篡改 → 抛错 */
export function decrypt(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) throw new Error('密文格式错误');
  const [ivHex, tagHex, dataHex] = parts;
  const decipher = createDecipheriv(ALGO, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return dec.toString('utf8');
}
