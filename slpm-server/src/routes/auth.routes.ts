import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import multer from 'multer';
import path from 'node:path';
import { logger } from "../lib/logger.js";
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

// P8 安全修复（H1 存储型 XSS）：mimetype → 安全扩展名白名单。
// 关键：落盘扩展名完全由服务端 mimetype 决定，忽略客户端 originalname 的扩展名，
// 防止"originalname=evil.html + mimetype=image/png"绕过 fileFilter 后落盘为 .html。
const AVATAR_MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};
const AVATAR_ALLOWED_EXT = new Set(Object.values(AVATAR_MIME_EXT));

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
    filename: (_req, file, cb) => {
      // 扩展名由 mimetype 推导，绝不信任客户端 originalname
      const safeExt = AVATAR_MIME_EXT[file.mimetype] ?? '.png';
      cb(null, `${crypto.randomUUID()}${safeExt}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const clientExt = path.extname(file.originalname).toLowerCase();
    const mimeOk = file.mimetype in AVATAR_MIME_EXT;
    // 双重校验：mimetype 与客户端扩展名都必须在白名单内且一致
    if (mimeOk && AVATAR_ALLOWED_EXT.has(clientExt)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, '仅支持 PNG/JPEG/WebP/GIF 图片'));
    }
  },
});

// 从姓名生成首字母头像（如 张三 → 张三）
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
  jobTitle?: string | null;
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
    jobTitle: u.jobTitle ?? null,
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
  // P5-2：密码 ≥8 位 + 必须含字母和数字
  password: z.string().min(8, '密码至少 8 位').regex(/[a-zA-Z]/, '密码须含字母').regex(/[0-9]/, '密码须含数字'),
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

    const passwordHash = await bcrypt.hash(password, 12);

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
        if (seeded) logger.log(`🌱 已为 ${user.email} 创建演示项目（首次使用引导）`);
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
// P7 安全修复：禁止用户修改 User.role（权限标识），仅允许改 name 和 jobTitle（职位展示）。
// 历史漏洞：旧实现透传 role 字段，用户可自行提权为 system_admin。
const updateProfileSchema = z.object({
  name: z.string().min(1, '姓名必填').max(40).optional(),
  jobTitle: z.string().max(40).optional(),
  // 兼容前端旧字段名 "role"：映射到 jobTitle（而非权限 role）
  role: z.string().max(40).optional(),
});
router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());

    const data: { name?: string; jobTitle?: string } = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    // 前端 "role" 字段在语义上是"职位"（如"前端工程师"），写入 jobTitle 而非权限 User.role
    const titleVal = parsed.data.jobTitle ?? parsed.data.role;
    if (titleVal !== undefined) data.jobTitle = titleVal;

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
// P8 安全修复（H1）：扩展名→固定 Content-Type 白名单 + nosniff + inline，
// 即使历史上落盘了 .html 也不会被浏览器当 HTML 渲染（纵深防御）。
const AVATAR_CT_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};
router.get(
  '/avatar/:file',
  (req, res) => {
    const file = req.params.file;
    // 防路径穿越：只允许单层文件名
    if (!/^[\w.-]+$/.test(file)) {
      return res.status(400).json({ error: '非法文件名' });
    }
    const ext = path.extname(file).toLowerCase();
    const ct = AVATAR_CT_BY_EXT[ext];
    // 仅允许头像扩展名白名单（拒绝 .html/.svg 等）
    if (!ct) return res.status(404).json({ error: '头像不存在' });
    const abs = path.join(AVATAR_DIR, file);
    if (!fs.existsSync(abs)) return res.status(404).json({ error: '头像不存在' });
    res.setHeader('Content-Type', ct);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
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
    // P7 安全修复：devResetUrl 改为显式 env 开关（ENABLE_DEV_RESET_LINK），与 NODE_ENV 解耦
    // 避免生产环境误配 NODE_ENV=development 导致重置链接泄露
    const devResetUrl = env.enableDevResetLink
      ? `${env.clientOrigin}/reset-password?token=${token}`
      : null;
    // 仅记录邮箱与事件，不把含 token 的完整链接写入日志（防日志泄露导致账号接管）
    logger.log(`🔑 [forgot-password] 已为 ${parsed.data.email} 生成重置请求${env.enableDevResetLink ? '（开发模式已返回链接）' : '（生产环境请接入邮件服务）'}`);
    res.json({ ok: true, devResetUrl });
  }),
);

// ---- POST /api/auth/reset-password ----
const resetSchema = z.object({
  token: z.string().min(1, '缺少重置凭证'),
  newPassword: z.string().min(8, '新密码至少 8 位').regex(/[a-zA-Z]/, '密码须含字母').regex(/[0-9]/, '密码须含数字'),
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

    // P7 安全修复：bcrypt rounds 提升到 12（原 10 偏低）
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await prisma.user.update({
      where: { id: payload.sub },
      data: { passwordHash },
    });
    res.json({ ok: true });
  }),
);

export default router;
