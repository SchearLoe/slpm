import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from './auth.js';
import { ApiError } from './error.js';

/**
 * P1-2：工作区上下文中间件。
 *
 * 从请求头 X-Workspace-Id 读取当前工作区，校验当前用户是该工作区成员，
 * 并把 { id, role } 挂到 req.workspace 供后续路由使用。
 *
 * 需在 requireAuth 之后挂载（依赖 req.user.sub）。
 * 缺失 header 或非成员 → 403。
 */
export const requireWorkspace = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const workspaceId = req.headers['x-workspace-id'] as string | undefined;
  if (!workspaceId || typeof workspaceId !== 'string') {
    return next(new ApiError(403, '未指定工作区，请在侧栏选择一个工作区'));
  }

  // 校验当前用户是该工作区成员
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: req.user!.sub,
      },
    },
    select: { role: true },
  });

  if (!membership) {
    return next(new ApiError(403, '你不是该工作区的成员，无权访问'));
  }

  req.workspace = {
    id: workspaceId,
    role: membership.role, // P2-1: admin | pm | dev | qa
  };
  next();
});

/**
 * 角色校验中间件工厂。
 * 用法：requireRole('admin') 或 requireRole('pm', 'admin')
 */
export function requireRole(...roles: string[]) {
  return (_req: Request, _res: Response, next: NextFunction) => {
    if (!_req.workspace || !roles.includes(_req.workspace.role)) {
      return next(new ApiError(403, `需要 ${roles.join('/')} 权限`));
    }
    next();
  };
}

/** P2-1：工作区管理员校验（仅 role=admin 可通过） */
export const requireAdmin = requireRole('admin');
