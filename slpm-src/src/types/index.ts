export type NavTab =
  | 'tasks'
  | 'overview'
  | 'files'
  | 'schedule'
  | 'collaboration'
  | 'analytics'
  | 'knowledge'
  | 'settings'
  | 'product'; // P3：产品管理（产品线聚合视图）

// P2-1：职能角色（P3 新增 po=产品经理）
export type WsRole = 'admin' | 'pm' | 'dev' | 'qa' | 'po';

export type Priority = '高' | '中' | '低' | '高优先级' | '紧急';
export type TaskStatus = '进行中' | '已完成' | '待处理' | '已延期';

// ============ 认证用户（来自后端） ============
// 用户主题设置（持久化到后端 UserSettings 表）
export interface UserSettings {
  accentColor: 'emerald' | 'cyan' | 'purple';
  glassBlur: 'standard' | 'ultra' | 'max';
  enableConfetti: boolean;
  // P4-2：通知偏好（后端 notify.ts 按此过滤）
  notifyMention: boolean;
  notifyAssign: boolean;
  notifyDeadline: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string; // 首字母，如 BR
  role: string;
  jobTitle?: string | null; // P7：职位展示字段（与权限 role 物理分离，用户可自行修改）
  settings?: UserSettings; // /auth/register|login|me 均返回
  // P1-2：用户所属的工作区列表（含每条的角色）
  workspaces?: WorkspaceMembership[];
}

// ============ 工作区 / 成员（P1-2 多租户 + RBAC） ============

export interface WorkspaceMembership {
  id: string;
  name: string;
  slug: string;
  role: WsRole;
  productId?: string | null; // P3：所属产品线（可空）
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  name: string;
  avatar: string | null;
  email: string;
  role: WsRole;
}

// ============ 后端任务 assignee（关系化外键） ============
export interface TaskAssignee {
  id: string;
  name: string;
  avatar: string | null;
  role: string | null;
}

export interface TaskItem {
  id: string; // 后端 cuid（原 demo 为 "WXB-2025-001"）
  title: string;
  priority: Priority;
  status: TaskStatus;
  time?: string; // 前端展示用（今天 10:00），后端不存
  phase: '需求评审' | '产品设计' | '开发实现' | '测试验证';
  createdAt?: string; // ISO（P4-1：吞吐趋势按创建日期聚合）
  // assignee 同时兼容：后端返回关系对象 {id,name,avatar,role}；旧 demo 嵌入式
  assignee: TaskAssignee | { name: string; avatar: string; role: string };
  assigneeId?: string | null; // 后端外键
  ownerId?: string; // 后端创建者
  workspaceId?: string; // P1-2：所属工作区
  // P1-6：任务依赖
  parentId?: string | null;
  parent?: { id: string; title: string; status: string } | null;
  children?: { id: string; title: string; status: string }[];
  blockedBy?: { dependsOnTask: { id: string; title: string; status: string } }[];
  blocks?: { task: { id: string; title: string; status: string } }[];
  startDate?: string | null; // ISO，甘特起始日
  milestone?: boolean;
  // P3：所属产品版本
  productVersionId?: string | null;
  productVersion?: { id: string; name: string; status: string } | null;
  // P4-2：预估工时（小时）
  estimatedHours?: number | null;
  project: string; // 旧 demo 字段，后端暂不持久化
  deadline: string; // 后端 ISO；旧 demo "2025-05-24 18:00"
  description: string;
  tags: string[];
  aiSuggestions?: string[];
  completionProgress?: number; // 0-100%
}

export interface MetricCardData {
  title: string;
  count: number;
  unit: string;
  comparisonText: string;
  isIncrease: boolean;
  percentage: number;
  iconName: 'clipboard' | 'pulse' | 'check' | 'alert';
  variant: 'default' | 'overdue';
}

export interface TimelineRow {
  id: string;
  phase: string;
  taskTitle: string;
  startDate: string; // e.g. "5.18"
  endDate: string; // e.g. "5.24"
  startDay: number; // e.g. 18
  endDay: number; // e.g. 24
  status: TaskStatus;
  highlighted?: boolean;
}

export interface FileDoc {
  id: string;
  title: string;
  category: string;
  size: string;
  author: string;
  updatedAt: string;
  completion?: number;
  tags: string[];
}

// ============ 文件记录（P1-3 真实文件上传） ============

export interface FileRecord {
  id: string;
  title: string;
  originalName: string;
  mimeType: string;
  size: number; // 字节数
  category: string;
  tags: string[];
  uploader: { id: string; name: string; avatar: string | null };
  workspaceId: string;
  createdAt: string; // ISO
}

// ============ 文件版本历史（P1-6） ============

export interface FileVersion {
  id: string;
  version: number;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string; // ISO
}

// ============ 任务评论 / 活动流（P1-1） ============

export interface TaskCommentAuthor {
  id: string;
  name: string;
  avatar: string | null;
  role: string | null;
}

export interface TaskComment {
  id: string;
  taskId: string;
  author: TaskCommentAuthor;
  body: string; // 纯文本，前端对 @姓名 做高亮
  mentions: string[]; // 解析自 body 的用户名（为通知系统预留）
  createdAt: string; // ISO
}

// 活动流统一条目（评论 + 系统事件合并，由 GET /tasks/:id/activity 返回）
export interface TaskActivityEntry {
  id: string;
  taskId: string;
  kind: 'comment' | 'activity';
  actor: { id: string; name: string; avatar: string | null };
  action: string; // 创建任务 | 完成任务 | 更新字段 | 发表评论
  detail?: string | null; // 更新字段的变更详情
  body?: string; // kind==='comment' 时的正文
  createdAt: string; // ISO
}

// ============ 知识库文章（P1-3） ============

export type ArticleCategory = 'UI/UX 规范' | '技术架构' | '团队流程' | '质量保障';

export interface KnowledgeArticle {
  id: string;
  title: string;
  body: string;
  category: ArticleCategory;
  views: number; // 后端 Int，前端展示时格式化（如 2.4k）
  pinned: boolean;
  starred: boolean; // 当前用户是否收藏
  author: { id: string; name: string; avatar: string };
  authorId: string;
  workspaceId?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

// ============ 通知 / 站内信（P1-4） ============
// 消费 TaskComment.mentions（评论 @某人）+ 任务指派变更。
// 顶栏铃铛按【收件人】维度汇总，与当前正在浏览的工作区无关。

export type NotificationType = 'mention' | 'assign' | 'system';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  taskId: string | null; // 点击跳转目标（前端 deep-link 到对应任务）
  read: boolean;
  workspaceId: string;
  createdAt: string; // ISO
}

// ============ AI（P1-4 真实接入） ============

// 系统级 AI 配置（GET 返回脱敏；PUT 提交时 apiKey 明文）
export interface AiConfig {
  aiBaseUrl: string;
  aiModel: string;
  aiTemperature: number;
  hasApiKey: boolean;
  apiKeyMasked?: string; // 如 ••••abcd，不含明文
}

// 任务智能建议返回
export interface AiSuggestionResult {
  suggestions: string[];
  confidence: number; // 0-100
}

// P1-5：AI token 用量聚合（近 30 天）
export interface AiUsageSummary {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  count: number;
  byDay: { date: string; tokens: number }[];
}

// ============ 标签库（P6-A） ============
// 工作区级标签：name + color。任务通过 Task.tags String[] 引用 name。

export type TagColor =
  | 'emerald'
  | 'cyan'
  | 'purple'
  | 'rose'
  | 'amber'
  | 'sky'
  | 'indigo'
  | 'teal'
  | 'slate';

export interface Tag {
  id: string;
  name: string;
  color: TagColor;
  workspaceId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============ 任务清单子项（P6-B Checklist） ============

export interface TaskChecklistItem {
  id: string;
  taskId: string;
  content: string;
  done: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// ============ 审计日志（P6-C） ============

export interface AuditLog {
  id: string;
  actorId: string | null;
  actor: { id: string; name: string; avatar: string | null; email: string } | null;
  action: string;
  target: string;
  ip: string | null;
  userAgent: string | null;
  workspaceId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ============ 产品线 / 版本（P3） ============
// 层级：Product（产品线）→ Workspace（项目）→ Task

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  workspaceCount: number;
  versionCount: number;
  // 当前用户在该产品线下的最高角色（决定产品页写权限）
  role: WsRole | null;
}

// 产品详情（含关联工作区 + 当前用户在每个工作区的角色）
export interface ProductWorkspaceLink {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  role: WsRole | null; // null = 非我所属的工作区（别人关联进来的）
}

export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  versionCount: number;
  role: WsRole | null;
  workspaces: ProductWorkspaceLink[];
}

// 产品版本
export type ProductVersionStatus = 'planning' | 'in_progress' | 'released' | 'archived';

export interface ProductVersion {
  id: string;
  name: string;
  description: string;
  releaseNotes: string; // P4-2：发布说明
  status: ProductVersionStatus;
  startDate: string | null;
  releaseDate: string | null;
  order: number;
  taskCount: number;
  createdAt: string;
  updatedAt: string;
}

// 跨工作区任务（产品视图用，额外带 workspace / productVersion）
export interface ProductTaskItem extends TaskItem {
  workspace?: { id: string; name: string };
  productVersion?: { id: string; name: string; status: string } | null;
}

// 跨工作区成员负荷聚合
export interface ProductMemberSummary {
  userId: string;
  name: string;
  avatar: string | null;
  email: string;
  role: WsRole;
  workspaces: { id: string; name: string; role: string }[];
  total: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

// 跨工作区 KPI 聚合
export interface ProductStats {
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
  completionRate: number;
  milestones: number;
  milestonesDone: number;
  milestoneRate: number;
  byWorkspace: {
    id: string;
    name: string;
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
    milestones: number;
    milestonesDone: number;
    completionRate: number;
  }[];
  byVersion: {
    id: string;
    name: string;
    status: string;
    releaseDate: string | null;
    total: number;
    completed: number;
    completionRate: number;
  }[];
}
