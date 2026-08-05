import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/workspace.js';
import { ApiError } from '../middleware/error.js';
import { env } from '../config/env.js';
import { FILE_UPLOAD, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE } from '../lib/constants.js';

const router = Router();

/**
 * P5-1：上传安全校验。
 * 1. 扩展名黑名单（.exe/.svg/.js 等）
 * 2. mimetype 与扩展名白名单一致性（防 mime 欺骗）
 */
function validateUpload(filename: string, mimetype: string): void {
  const ext = path.extname(filename || '').toLowerCase();
  // 危险扩展名一律拒绝
  if (FILE_UPLOAD.blockedExtensions.includes(ext as never)) {
    throw new ApiError(400, `不允许上传此类型文件：${ext || '(无扩展名)'}`);
  }
  // mimetype 与扩展名白名单一致性
  const allowedExts = FILE_UPLOAD.allowed[mimetype];
  if (!allowedExts || !allowedExts.includes(ext)) {
    throw new ApiError(400, `不支持的文件类型：${mimetype || '未知'} (${ext || '无扩展名'})。支持图片/PDF/Office/文本/压缩包。`);
  }
}

// P1-3：multer 磁盘存储。destination 需要 req.workspace（所以中间件顺序：
//   requireAuth → requireWorkspace → upload.single → handler）。
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      // 每个工作区一个子目录，避免文件名碰撞 + 便于按工作区清理
      const dir = path.join(env.uploadDir, req.workspace!.id);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      // 用 uuid + 原扩展名，避免中文/特殊文件名碰撞与编码问题
      const ext = path.extname(file.originalname || '');
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: FILE_UPLOAD.maxBytes }, // 20MB
});

// ---- GET /api/files ---- 工作区文件列表（P5-1：分页，?page=&pageSize=）
const listFilesSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional().default(DEFAULT_PAGE_SIZE),
});
router.get(
  '/',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const parsed = listFilesSchema.safeParse(req.query);
    if (!parsed.success) throw new ApiError(400, '查询参数错误', parsed.error.flatten());
    const { page, pageSize } = parsed.data;

    const [files, total] = await Promise.all([
      prisma.fileRecord.findMany({
        where: { workspaceId: req.workspace!.id },
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
        include: {
          uploader: { select: { id: true, name: true, avatar: true } },
        },
      }),
      prisma.fileRecord.count({ where: { workspaceId: req.workspace!.id } }),
    ]);
    res.json({ files, total, page, pageSize, hasMore: page * pageSize < total });
  }),
);

// ---- POST /api/files ---- 上传（multipart/form-data，字段名 file）
// 中间件顺序关键：requireWorkspace 先跑（设置 req.workspace），multer 才能拿到 destination
router.post(
  '/',
  requireAuth,
  requireWorkspace,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw new ApiError(400, '请选择要上传的文件');

    // P5-1：上传安全校验（扩展名黑名单 + mimetype/扩展名白名单一致性）
    validateUpload(file.originalname, file.mimetype);

    // 表单字段（multipart）
    const title = (req.body.title as string | undefined)?.trim() || file.originalname;
    const category = (req.body.category as string | undefined)?.trim() || '通用文档';
    const tagsRaw = req.body.tags as string | undefined;
    const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [];

    // storagePath 存相对路径（uploads/<wsId>/<uuid>.ext），便于迁移/备份
    const storagePath = path.join(req.workspace!.id, file.filename);

    // P1-6：同名文件自动归档旧版本
    const existing = await prisma.fileRecord.findFirst({
      where: {
        workspaceId: req.workspace!.id,
        uploaderId: req.user!.sub,
        originalName: file.originalname,
      },
    });

    let record;
    if (existing) {
      // 归档旧版本 → 更新现有记录为最新文件
      await prisma.fileVersion.create({
        data: {
          fileId: existing.id,
          version: existing.currentVersion,
          originalName: existing.originalName,
          mimeType: existing.mimeType,
          size: existing.size,
          storagePath: existing.storagePath,
        },
      });
      record = await prisma.fileRecord.update({
        where: { id: existing.id },
        data: {
          title: title !== file.originalname ? title : existing.title, // 保留非默认标题
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          storagePath,
          category,
          tags,
          currentVersion: existing.currentVersion + 1,
        },
        include: { uploader: { select: { id: true, name: true, avatar: true } } },
      });
      // 旧磁盘文件保留不删（版本历史可下载）
    } else {
      record = await prisma.fileRecord.create({
        data: {
          title,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          storagePath,
          category,
          tags,
          uploaderId: req.user!.sub,
          workspaceId: req.workspace!.id,
        },
        include: { uploader: { select: { id: true, name: true, avatar: true } } },
      });
    }

    res.status(201).json({ file: record });
  }),
);

// ---- GET /api/files/:id/download ---- 下载（鉴权后返回文件流）
router.get(
  '/:id/download',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const record = await prisma.fileRecord.findFirst({
      where: { id: req.params.id, workspaceId: req.workspace!.id },
    });
    if (!record) throw new ApiError(404, '文件不存在');

    const absPath = path.join(env.uploadDir, record.storagePath);
    if (!fs.existsSync(absPath)) {
      throw new ApiError(404, '文件已被移除');
    }
    // 用原始文件名作为下载名，设置正确的 content-type
    res.download(absPath, record.originalName, {
      headers: { 'Content-Type': record.mimeType },
    });
  }),
);

// ---- GET /api/files/:id/preview ---- 内联预览（图片/PDF 浏览器内联显示，不触发下载）
router.get(
  '/:id/preview',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const record = await prisma.fileRecord.findFirst({
      where: { id: req.params.id, workspaceId: req.workspace!.id },
      select: { storagePath: true, mimeType: true, size: true },
    });
    if (!record) throw new ApiError(404, '文件不存在');

    const absPath = path.join(env.uploadDir, record.storagePath);
    if (!fs.existsSync(absPath)) {
      throw new ApiError(404, '文件已被移除');
    }
    // 内联显示：Content-Disposition: inline + 正确 mimeType，浏览器自动渲染图片/PDF
    res.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Content-Length', record.size.toString());
    fs.createReadStream(absPath).pipe(res);
  }),
);

// ---- PATCH /api/files/:id ---- 重命名（只改 title，保留 originalName）
const renameSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题过长'),
});
router.patch(
  '/:id',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const parsed = renameSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());

    const record = await prisma.fileRecord.update({
      where: { id: req.params.id, workspaceId: req.workspace!.id },
      data: { title: parsed.data.title },
      include: { uploader: { select: { id: true, name: true, avatar: true } } },
    });
    res.json({ file: record });
  }),
);

// ---- DELETE /api/files/:id ---- 删除（DB 记录 + 磁盘文件）
router.delete(
  '/:id',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const record = await prisma.fileRecord.findFirst({
      where: { id: req.params.id, workspaceId: req.workspace!.id },
      select: { id: true, storagePath: true },
    });
    if (!record) throw new ApiError(404, '文件不存在');

    await prisma.fileRecord.delete({ where: { id: record.id } });

    // 删磁盘文件（失败仅记日志，不影响 DB 已删除的事实）
    const absPath = path.join(env.uploadDir, record.storagePath);
    fs.promises.unlink(absPath).catch(() => {});

    res.json({ ok: true });
  }),
);

// ---- GET /api/files/:id/versions ---- 版本历史
router.get(
  '/:id/versions',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const record = await prisma.fileRecord.findFirst({
      where: { id: req.params.id, workspaceId: req.workspace!.id },
      select: { id: true, currentVersion: true },
    });
    if (!record) throw new ApiError(404, '文件不存在');
    const versions = await prisma.fileVersion.findMany({
      where: { fileId: record.id },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, originalName: true, mimeType: true, size: true, createdAt: true },
    });
    res.json({ versions, currentVersion: record.currentVersion });
  }),
);

// ---- POST /api/files/:id/restore/:versionId ---- 恢复某个历史版本
router.post(
  '/:id/restore/:versionId',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const record = await prisma.fileRecord.findFirst({
      where: { id: req.params.id, workspaceId: req.workspace!.id },
      select: { id: true, currentVersion: true, title: true, originalName: true, mimeType: true, size: true, storagePath: true },
    });
    if (!record) throw new ApiError(404, '文件不存在');
    const version = await prisma.fileVersion.findFirst({
      where: { id: req.params.versionId, fileId: record.id },
    });
    if (!version) throw new ApiError(404, '版本不存在');

    // 归档当前版本 → 用选中版本覆盖
    await prisma.fileVersion.create({
      data: {
        fileId: record.id,
        version: record.currentVersion,
        originalName: record.originalName,
        mimeType: record.mimeType,
        size: record.size,
        storagePath: record.storagePath,
      },
    });
    const updated = await prisma.fileRecord.update({
      where: { id: record.id },
      data: {
        originalName: version.originalName,
        mimeType: version.mimeType,
        size: version.size,
        storagePath: version.storagePath,
        currentVersion: record.currentVersion + 1,
      },
      include: { uploader: { select: { id: true, name: true, avatar: true } } },
    });
    res.json({ file: updated });
  }),
);

export default router;
