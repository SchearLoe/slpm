import { Request, Response, NextFunction, RequestHandler } from 'express';
import { verifyToken, JwtPayload } from '../lib/jwt.js';
import { ApiError } from './error.js';

// 扩展 Request 类型，挂载当前用户
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
      // P1-2：当前请求的工作区上下文（由 requireWorkspace 中间件填充）
      workspace?: {
        id: string;
        role: string; // P2-1: admin | pm | dev | qa | po
      };
      // P3：当前请求的产品上下文（由 requireProductAccess 中间件填充）
      product?: {
        productId: string;
        workspaceIds: string[]; // 用户可访问的、属于该产品的工作区 id
        role: string | null; // 用户在任一关联工作区的最高角色（用于写权限判断）
      };
    }
  }
}

// 包装异步路由：把 throw / rejected promise 转给错误中间件
type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncHandler(fn: AsyncRoute): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// JWT 验证中间件 —— 从 Authorization: Bearer <token> 提取并校验
// P7 安全修复：拒绝 purpose!=='access' 的 token（reset token 不能当登录 token 用）
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new ApiError(401, '未登录，请先认证'));
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = verifyToken(token);
    // P7 安全修复：带 purpose 的 token（如 reset）只能用于特定流程，不能当普通登录凭证。
    // 登录 token 不带 purpose（undefined）；reset token 带 purpose='reset'，此处拒绝。
    if (payload.purpose !== undefined) {
      return next(new ApiError(401, '该凭证类型不能用于此操作'));
    }
    req.user = payload;
    next();
  } catch {
    next(new ApiError(401, '登录已过期，请重新登录'));
  }
}
