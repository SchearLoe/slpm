import { prisma } from './prisma.js';
import type { Request } from 'express';

/**
 * P6-C：审计日志写入辅助。
 *
 * 记录关键安全/管理操作，供管理员在设置中心审计页查看。
 * best-effort：失败仅记录到控制台，绝不影响主业务流程。
 *
 * action 约定（小写蛇形）：
 *   login / logout / register
 *   member_invite / member_remove / role_change
 *   product_create / product_update / product_delete
 *   version_create / version_update / version_delete
 *   ai_config_update / batch_op
 *   ...
 */

export interface AuditInput {
  actorId?: string;
  action: string;
  target: string;
  workspaceId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function writeAudit(input: AuditInput, req?: Request): Promise<void> {
  try {
    const ip = req ? extractIp(req) : null;
    const userAgent = req?.headers['user-agent']?.slice(0, 255) ?? null;
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        target: input.target.slice(0, 500),
        ip,
        userAgent,
        workspaceId: input.workspaceId ?? null,
        metadata: (input.metadata as never) ?? undefined,
      },
    });
  } catch (e) {
    console.warn('[audit] 写入失败（忽略）:', e instanceof Error ? e.message : e);
  }
}

function extractIp(req: Request): string | null {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim().slice(0, 64);
  }
  if (Array.isArray(fwd) && fwd.length > 0) {
    return fwd[0].slice(0, 64);
  }
  return req.ip?.slice(0, 64) ?? null;
}
