import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from './auth.js';
import { ApiError } from './error.js';

/**
 * P3：产品上下文中间件。
 *
 * 从 URL 参数 :id（产品路由统一挂载在 /api/products/:id 下）取产品，
 * 兜底支持 X-Product-Id header。校验当前用户至少是该产品下
 * 一个工作区的成员，并把 { productId, workspaceIds, role } 挂到 req.product。
 *
 * 需在 requireAuth 之后挂载（依赖 req.user.sub）。
 * 缺失产品 id / 产品不存在 / 非任何关联工作区成员 → 403。
 */
export const requireProductAccess = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const productId = (req.params.id as string | undefined) || (req.headers['x-product-id'] as string | undefined);
  if (!productId || typeof productId !== 'string') {
    return next(new ApiError(403, '未指定产品线，请在侧栏选择一个产品'));
  }

  // 该产品下的所有工作区
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, ownerId: true, workspaces: { select: { id: true } } },
  });
  if (!product) {
    return next(new ApiError(404, '产品线不存在'));
  }
  const workspaceIds = product.workspaces.map((w) => w.id);
  if (workspaceIds.length === 0) {
    // 产品还没有关联任何工作区：仅负责人可访问（空态展示 + 首个关联操作）
    if (product.ownerId !== req.user!.sub) {
      return next(new ApiError(403, '该产品线尚未关联任何项目，仅产品负责人可管理'));
    }
    req.product = { productId, workspaceIds: [], role: 'admin' };
    return next();
  }

  // 当前用户在关联工作区里的成员记录（可能属于多个工作区）
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: req.user!.sub, workspaceId: { in: workspaceIds } },
    select: { workspaceId: true, role: true },
  });
  if (memberships.length === 0) {
    return next(new ApiError(403, '你不在该产品线的任何项目中，无权访问'));
  }

  // 取最高角色用于写权限判断（负责人或任一关联工作区 po/admin 即可写）
  const roleRank: Record<string, number> = { po: 4, admin: 3, pm: 2, dev: 1, qa: 1 };
  const effective = memberships.reduce((best, m) =>
    (roleRank[m.role] ?? 0) > (roleRank[best.role] ?? 0) ? m : best,
  );

  req.product = {
    productId,
    workspaceIds: memberships.map((m) => m.workspaceId),
    role: product.ownerId === req.user!.sub ? 'admin' : effective.role,
  };
  next();
});

/**
 * P3：产品级写操作权限校验。
 * 用法：requireProductRole('po', 'admin')
 */
export function requireProductRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.product || !req.product.role || !roles.includes(req.product.role)) {
      return next(new ApiError(403, `需要 ${roles.join('/')} 权限`));
    }
    next();
  };
}
