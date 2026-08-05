import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/workspace.js';
import { ApiError } from '../middleware/error.js';

const router = Router();

// 标准化分类（与前端 KnowledgeBasePage 一致）
const CATEGORIES = ['UI/UX 规范', '技术架构', '团队流程', '质量保障'] as const;

// 脱敏后的文章对象（含收藏状态：当前用户是否在 starredByIds 内）
function publicArticle(
  a: {
    id: string;
    title: string;
    body: string;
    category: string;
    starredByIds: string[];
    views: number;
    pinned: boolean;
    authorId: string;
    workspaceId: string;
    createdAt: Date;
    updatedAt: Date;
    author?: { id: string; name: string; avatar: string | null } | null;
  },
  currentUserId: string,
) {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    category: a.category,
    views: a.views,
    pinned: a.pinned,
    starred: a.starredByIds.includes(currentUserId),
    author: a.author
      ? { id: a.author.id, name: a.author.name, avatar: a.author.avatar ?? a.author.name.slice(0, 2).toUpperCase() }
      : { id: a.authorId, name: '未知', avatar: 'U' },
    authorId: a.authorId,
    workspaceId: a.workspaceId,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

// ---- GET /api/articles ----
// 可选 query: category（精确分类）、starred=true（仅收藏）
router.get(
  '/',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const onlyStarred = req.query.starred === 'true';

    const where: Record<string, unknown> = { workspaceId: req.workspace!.id };
    if (category && CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
      where.category = category;
    }
    if (onlyStarred) {
      where.starredByIds = { has: req.user!.sub };
    }

    const articles = await prisma.knowledgeArticle.findMany({
      where,
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      include: { author: { select: { id: true, name: true, avatar: true } } },
    });

    res.json({ articles: articles.map((a) => publicArticle(a, req.user!.sub)) });
  }),
);

// ---- POST /api/articles ----
const createSchema = z.object({
  title: z.string().min(1, '标题必填').max(200),
  body: z.string().max(20000).optional().default(''),
  category: z.enum(CATEGORIES).optional().default('UI/UX 规范'),
});

router.post(
  '/',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());
    const d = parsed.data;

    const article = await prisma.knowledgeArticle.create({
      data: {
        title: d.title,
        body: d.body,
        category: d.category,
        views: 1, // 发布即 1 次浏览
        authorId: req.user!.sub,
        workspaceId: req.workspace!.id,
      },
      include: { author: { select: { id: true, name: true, avatar: true } } },
    });

    res.status(201).json({ article: publicArticle(article, req.user!.sub) });
  }),
);

// ---- GET /api/articles/:id ----
// 打开详情：浏览量 +1（确保事务内 increment，避免并发丢失）
router.get(
  '/:id',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const article = await prisma.knowledgeArticle.findFirst({
      where: { id: req.params.id, workspaceId: req.workspace!.id },
      include: { author: { select: { id: true, name: true, avatar: true } } },
    });
    if (!article) throw new ApiError(404, '文章不存在或无权访问');

    // 浏览量自增（独立查询，失败不影响返回）
    const updated = await prisma.knowledgeArticle
      .update({
        where: { id: article.id },
        data: { views: { increment: 1 } },
        include: { author: { select: { id: true, name: true, avatar: true } } },
      })
      .catch(() => article);

    res.json({ article: publicArticle(updated, req.user!.sub) });
  }),
);

// ---- PATCH /api/articles/:id ----
const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(20000).optional(),
  category: z.enum(CATEGORIES).optional(),
  pinned: z.boolean().optional(),
});

router.patch(
  '/:id',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());
    const d = parsed.data;

    const data: Record<string, unknown> = {};
    if (d.title !== undefined) data.title = d.title;
    if (d.body !== undefined) data.body = d.body;
    if (d.category !== undefined) data.category = d.category;
    if (d.pinned !== undefined) data.pinned = d.pinned;

    // 工作区内文章（非成员访问会被 findFirst 拦截在 update 报错前）
    const article = await prisma.knowledgeArticle.update({
      where: { id: req.params.id, workspaceId: req.workspace!.id },
      data,
      include: { author: { select: { id: true, name: true, avatar: true } } },
    });

    res.json({ article: publicArticle(article, req.user!.sub) });
  }),
);

// ---- PATCH /api/articles/:id/star ----
// 切换当前用户的收藏状态：已收藏 → 取消；未收藏 → 加入
router.patch(
  '/:id/star',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const article = await prisma.knowledgeArticle.findFirst({
      where: { id: req.params.id, workspaceId: req.workspace!.id },
      select: { id: true, starredByIds: true },
    });
    if (!article) throw new ApiError(404, '文章不存在或无权访问');

    const uid = req.user!.sub;
    const starred = article.starredByIds.includes(uid);
    const nextStarred = !starred;

    await prisma.knowledgeArticle.update({
      where: { id: article.id },
      data: nextStarred
        ? { starredByIds: { push: uid } }
        : { starredByIds: article.starredByIds.filter((x) => x !== uid) },
    });

    res.json({ id: article.id, starred: nextStarred });
  }),
);

// ---- DELETE /api/articles/:id ----
router.delete(
  '/:id',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    await prisma.knowledgeArticle.delete({
      where: { id: req.params.id, workspaceId: req.workspace!.id },
    });
    res.json({ ok: true });
  }),
);

export default router;
