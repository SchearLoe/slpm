import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import { asyncHandler, requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';

const router = Router();

// 从姓名生成首字母头像（如 Brandon → BR）
function avatarFromName(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || 'U';
}

// 默认设置（与 schema.prisma 的 UserSettings 默认值保持一致）
const DEFAULT_SETTINGS = {
  accentColor: 'emerald',
  glassBlur: 'ultra',
  enableConfetti: true,
};

// 脱敏后的用户对象（不含密码哈希）
function publicUser(u: {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: string;
  settings?: {
    accentColor: string;
    glassBlur: string;
    enableConfetti: boolean;
  } | null;
  memberships?: {
    id: string;
    role: string;
    workspace: { id: string; name: string; slug: string; productId: string | null };
  }[];
}) {
  // settings 可能未 include（旧调用方）或为 null（用户先于设置记录创建）
  const s = u.settings ?? null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatar: u.avatar ?? avatarFromName(u.name),
    role: u.role,
    settings: s
      ? {
          accentColor: s.accentColor as 'emerald' | 'cyan' | 'purple',
          glassBlur: s.glassBlur as 'standard' | 'ultra' | 'max',
          enableConfetti: s.enableConfetti,
        }
      : { ...DEFAULT_SETTINGS },
    // P1-2：返回用户所属的工作区列表（含每条的角色；P3 加产品线归属）
    workspaces: (u.memberships ?? []).map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      productId: m.workspace.productId, // P3：所属产品线（可空）
      role: m.role as 'admin' | 'pm' | 'dev' | 'qa' | 'po',
    })),
  };
}

// ---- POST /api/auth/register ----
const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少 6 位'),
  name: z.string().min(1, '请填写姓名').max(40),
});

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, '参数校验失败', parsed.error.flatten());
    }
    const { email, password, name } = parsed.data;

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) throw new ApiError(409, '该邮箱已注册');

    const passwordHash = await bcrypt.hash(password, 10);

    // P1-4：第一个注册的用户自动成为系统管理员（可配置 AI 等）
    const userCount = await prisma.user.count();
    const systemRole = userCount === 0 ? 'system_admin' : '成员';

    // P1-2：事务建用户 + 默认工作区 + admin 成员记录 + 设置
    // 用 SQL 的任意 cuid 作为 slug（保证唯一），name 用「我的工作区」
    const slug = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        avatar: avatarFromName(name),
        role: systemRole,
        settings: { create: {} }, // 建用户时同步建设置
        memberships: {
          create: [
            {
              role: 'admin',
              workspace: {
                create: { name: '我的工作区', slug },
              },
            },
          ],
        },
      },
      include: {
        settings: true,
        memberships: { include: { workspace: { select: { id: true, name: true, slug: true, productId: true } } } },
      },
    });

    const token = signToken({ sub: user.id, email: user.email });
    res.status(201).json({ token, user: publicUser(user) });
  }),
);

// ---- POST /api/auth/login ----
const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '请输入密码'),
});

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, '参数校验失败', parsed.error.flatten());
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        settings: true,
        memberships: { include: { workspace: { select: { id: true, name: true, slug: true, productId: true } } } },
      },
    });
    if (!user) throw new ApiError(401, '邮箱或密码错误');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new ApiError(401, '邮箱或密码错误');

    const token = signToken({ sub: user.id, email: user.email });
    res.json({ token, user: publicUser(user) });
  }),
);

// ---- GET /api/auth/me ----
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      include: {
        settings: true,
        memberships: { include: { workspace: { select: { id: true, name: true, slug: true, productId: true } } } },
      },
    });
    if (!user) throw new ApiError(404, '用户不存在');
    res.json({ user: publicUser(user) });
  }),
);

export default router;
