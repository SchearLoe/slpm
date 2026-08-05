import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';

const router = Router();

// 与 schema.prisma / auth.routes.ts 保持一致的默认值
const DEFAULT_SETTINGS = {
  accentColor: 'emerald',
  glassBlur: 'ultra',
  enableConfetti: true,
};

// PUT 校验：三个字段均校验枚举/类型，防注入与脏数据
const updateSchema = z.object({
  accentColor: z.enum(['emerald', 'cyan', 'purple']).optional(),
  glassBlur: z.enum(['standard', 'ultra', 'max']).optional(),
  enableConfetti: z.boolean().optional(),
});

// ---- GET /api/settings ----
// 读取当前用户设置；记录缺失时返回默认值（兜底旧用户）
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const record = await prisma.userSettings.findUnique({
      where: { userId: req.user!.sub },
    });
    res.json({
      settings: record
        ? {
            accentColor: record.accentColor as 'emerald' | 'cyan' | 'purple',
            glassBlur: record.glassBlur as 'standard' | 'ultra' | 'max',
            enableConfetti: record.enableConfetti,
          }
        : { ...DEFAULT_SETTINGS },
    });
  }),
);

// ---- PUT /api/settings ----
// 部分更新；用 upsert 兜底用户尚未有设置记录的情况
router.put(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());

    const data = parsed.data;
    const record = await prisma.userSettings.upsert({
      where: { userId: req.user!.sub },
      // 合并默认值，确保新记录字段完整
      create: {
        userId: req.user!.sub,
        accentColor: data.accentColor ?? DEFAULT_SETTINGS.accentColor,
        glassBlur: data.glassBlur ?? DEFAULT_SETTINGS.glassBlur,
        enableConfetti: data.enableConfetti ?? DEFAULT_SETTINGS.enableConfetti,
      },
      update: data,
    });

    res.json({
      settings: {
        accentColor: record.accentColor as 'emerald' | 'cyan' | 'purple',
        glassBlur: record.glassBlur as 'standard' | 'ultra' | 'max',
        enableConfetti: record.enableConfetti,
      },
    });
  }),
);

export default router;
