import { Request, Response, NextFunction } from 'express';

// 自定义业务错误，携带 HTTP 状态码
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, `路径不存在: ${req.method} ${req.path}`));
}

// 统一错误处理 —— 兜底所有抛出的错误
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message, details: err.details });
  }

  // Prisma 常见错误转友好提示
  const e = err as { code?: string; meta?: { target?: string[] } };
  if (e?.code === 'P2002') {
    // 唯一约束冲突（如邮箱重复）
    return res.status(409).json({ error: '数据已存在', details: e.meta?.target });
  }
  if (e?.code === 'P2025') {
    // 记录不存在
    return res.status(404).json({ error: '记录不存在' });
  }

  console.error('[未处理错误]', err);
  return res.status(500).json({ error: '服务器内部错误' });
}
