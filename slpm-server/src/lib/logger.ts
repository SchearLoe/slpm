/**
 * P5-3：统一日志工具。
 *
 * - 生产环境（NODE_ENV=production）静默普通 log（仅保留 warn/error）
 * - 开发环境全量输出
 *
 * 用法：import { logger } from './lib/logger.js';
 *   logger.log('普通信息');
 *   logger.warn('警告');
 *   logger.error('错误');
 */
const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info(...args);
  },
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};
