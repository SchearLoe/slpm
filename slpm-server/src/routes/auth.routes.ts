import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { signToken, verifyToken } from '../lib/jwt.js';
import { asyncHandler, requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { env } from '../config/env.js';
import { seedDemoForUser } from '../lib/seed.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { writeAudit } from '../lib/audit.js';

const router = Router();

// P4-1：真实头像上传目录 uploads/avatars/（sendFile 需要绝对路径）
const AVATAR_DIR = path.resolve(env.uploadDir, 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.png';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    if (['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, '仅支持 PNG/JPEG/WebP/GIF 图片'));
    }
  },
});

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
  authLimiter,
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

    // P4-1：首个用户（且数据库尚无任何工作区）→ 自动播种「演示项目」教程数据
    seedDemoForUser(user.id, user.name)
      .then((seeded) => {
        if (seeded) console.log(`🌱 已为 ${user.email} 创建演示项目（首次使用引导）`);
      })
      .catch(() => {}); // 播种失败不影响注册

    res.status(201).json({ token, user: publicUser(user) });

    // P6-C：注册审计（best-effort）
    writeAudit(
      { actorId: user.id, action: 'register', target: `新用户注册 ${user.email}${systemRole === 'system_admin' ? '（系统管理员）' : ''}` },
      req,
    ).catch(() => {});
  }),
);

// ---- POST /api/auth/login ----
const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '请输入密码'),
});

router.post(
  '/login',
  authLimiter,
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

    // P6-C：登录审计（best-effort）
    writeAudit({ actorId: user.id, action: 'login', target: `用户登录 ${user.email}` }, req).catch(() => {});
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

// ---- PATCH /api/auth/me ----
// 更新个人资料（显示名称 / 职位展示字段）
const updateProfileSchema = z.object({
  name: z.string().min(1, '姓名必填').max(40).optional(),
  role: z.string().max(40).optional(),
});
router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());

    const data: Record<string, string> = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.role !== undefined) data.role = parsed.data.role;

    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data,
      include: {
        settings: true,
        memberships: { include: { workspace: { select: { id: true, name: true, slug: true, productId: true } } } },
      },
    });
    res.json({ user: publicUser(user) });
  }),
);

// ---- POST /api/auth/avatar ----
// 真实头像上传：uploads/avatars/<uuid>.<ext>，User.avatar 存相对路径
// （前端 <img src="/api/auth/avatar/xxx"> 直接展示）
router.post(
  '/avatar',
  authLimiter,
  requireAuth,
  avatarUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, '缺少头像文件');
    const avatarPath = path.join('avatars', req.file.filename).replace(/\\/g, '/');
    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data: { avatar: avatarPath },
      include: {
        settings: true,
        memberships: { include: { workspace: { select: { id: true, name: true, slug: true, productId: true } } } },
      },
    });
    res.json({ user: publicUser(user), avatar: avatarPath });
  }),
);

// ---- GET /api/auth/avatar/:file ----
// 头像静态访问（无需鉴权，公开资源；文件名是 uuid 不可枚举）
router.get(
  '/avatar/:file',
  (req, res) => {
    const file = req.params.file;
    // 防路径穿越：只允许单层文件名
    if (!/^[\w.-]+$/.test(file)) {
      return res.status(400).json({ error: '非法文件名' });
    }
    const abs = path.join(AVATAR_DIR, file);
    if (!fs.existsSync(abs)) return res.status(404).json({ error: '头像不存在' });
    res.sendFile(abs);
  },
);

// ---- POST /api/auth/forgot-password ----
// P4-2：忘记密码 —— 生成 15 分钟有效重置 token。
// 防枚举：用户不存在也返回 ok:true。开发环境返回重置链接（生产需邮件服务）。
const forgotSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
});
router.post(
  '/forgot-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = forgotSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user) {
      // 防枚举：统一响应
      return res.json({ ok: true, devResetUrl: null });
    }

    const token = signToken({ sub: user.id, email: user.email, purpose: 'reset' }, '15m');
    const devResetUrl = env.nodeEnv === 'development'
      ? `${env.clientOrigin}/reset-password?token=${token}`
      : null;
    console.log(`🔑 [forgot-password] ${parsed.data.email}${devResetUrl ? ` → 重置链接: ${devResetUrl}` : '（生产环境请接入邮件服务）'}`);
    res.json({ ok: true, devResetUrl });
  }),
);

// ---- POST /api/auth/reset-password ----
const resetSchema = z.object({
  token: z.string().min(1, '缺少重置凭证'),
  newPassword: z.string().min(6, '新密码至少 6 位'),
});
router.post(
  '/reset-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());

    let payload: ReturnType<typeof verifyToken>;
    try {
      payload = verifyToken(parsed.data.token);
    } catch {
      throw new ApiError(400, '重置链接无效或已过期，请重新申请');
    }
    if (payload.purpose !== 'reset') {
      throw new ApiError(400, '重置链接无效或已过期，请重新申请');
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.user.update({
      where: { id: payload.sub },
      data: { passwordHash },
    });
    res.json({ ok: true });
  }),
);

export default router;
