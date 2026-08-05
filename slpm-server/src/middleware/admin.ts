import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from './auth.js';
import { ApiError } from './error.js';

/**
 * P1-4：系统管理员校验中间件。
 *
 * 校验当前登录用户的 User.role === 'system_admin'，否则 403。
 * 需在 requireAuth 之后挂载。查 DB 取最新 role（避免 JWT 过期后角色变更不生效）。
 */
export const requireSystemAdmin = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { role: true },
  });
  if (!user || user.role !== 'system_admin') {
    return next(new ApiError(403, '需要系统管理员权限'));
  }
  next();
});
