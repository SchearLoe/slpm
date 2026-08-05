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
        role: 'admin' | 'member';
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
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new ApiError(401, '未登录，请先认证'));
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    next(new ApiError(401, '登录已过期，请重新登录'));
  }
}
