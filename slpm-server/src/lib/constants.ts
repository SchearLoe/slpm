/**
 * P5-1：全站共享常量。
 *
 * 状态/阶段/优先级等枚举集中在此，避免后端多路由 + 前端多处复制魔法字符串
 * 导致拼错时静默失效。后端 zod schema 与前端筛选器统一引用本文件。
 */

// 任务状态
export const TASK_STATUS = ['进行中', '已完成', '待处理', '已延期'] as const;
export type TaskStatus = (typeof TASK_STATUS)[number];

// 任务阶段（标准化四阶段流水线）
export const TASK_PHASE = ['需求评审', '产品设计', '开发实现', '测试验证'] as const;
export type TaskPhase = (typeof TASK_PHASE)[number];

// 优先级（标准化三档）
export const PRIORITY = ['高', '中', '低'] as const;
export type Priority = (typeof PRIORITY)[number];

// 工作区职能角色（P2-1）
export const WS_ROLES = ['admin', 'pm', 'dev', 'qa', 'po'] as const;
export type WsRole = (typeof WS_ROLES)[number];

// 角色等级（用于产品级聚合时取最高角色）
export const ROLE_RANK: Record<string, number> = {
  po: 4,
  admin: 3,
  pm: 2,
  dev: 1,
  qa: 1,
};

// 产品版本状态
export const VERSION_STATUS = ['planning', 'in_progress', 'released', 'archived'] as const;
export type VersionStatus = (typeof VERSION_STATUS)[number];

// 通知类型
export const NOTIFICATION_TYPES = ['mention', 'assign', 'system'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// 优先级归一化（前端旧值 → 标准值）
export const PRIORITY_MAP: Record<string, Priority> = {
  高: '高',
  高优先级: '高',
  紧急: '高',
  中: '中',
  低: '低',
};

// 通用分页上限（防止无界 findMany）
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 50;

// 文件上传：允许的 mimetype + 扩展名（防 mime 欺骗）
export const FILE_UPLOAD = {
  maxBytes: 20 * 1024 * 1024, // 20MB
  // mimetype → 安全扩展名白名单（magic number 校验后比对）
  allowed: {
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/webp': ['.webp'],
    'image/gif': ['.gif'],
    'application/pdf': ['.pdf'],
    'text/plain': ['.txt', '.md'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'application/zip': ['.zip'],
    'application/x-zip-compressed': ['.zip'],
    'application/vnd.ms-excel': ['.xls'],
    'application/msword': ['.doc'],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'application/json': ['.json'],
    'text/csv': ['.csv'],
    'application/csv': ['.csv'],
    'video/mp4': ['.mp4'],
  } as Record<string, string[]>,
  // 危险扩展名（无论 mime 一律拒绝）
  blockedExtensions: ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.js', '.mjs', '.jar', '.war', '.dll', '.so', '.svg'],
} as const;
