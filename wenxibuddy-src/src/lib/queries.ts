import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { TaskItem, TaskComment, TaskActivityEntry, WorkspaceMembership, WorkspaceMember, KnowledgeArticle, ArticleCategory, FileRecord, AppNotification, AiConfig, AiSuggestionResult, AiUsageSummary } from '@/types';

// ============ 任务 ============

const TASKS_KEY = ['tasks'] as const;

export function useTasks() {
  return useQuery({
    queryKey: TASKS_KEY,
    queryFn: async () => {
      const res = await api.get<{ tasks: TaskItem[] }>('/tasks');
      return res.data.tasks;
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<TaskItem>) => {
      const res = await api.post<{ task: TaskItem }>('/tasks', input);
      return res.data.task;
    },
    onSuccess: (task) => {
      // 乐观：直接把新任务插入缓存头部
      qc.setQueryData<TaskItem[]>(TASKS_KEY, (old) => [task, ...(old ?? [])]);
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<TaskItem>) => {
      const res = await api.patch<{ task: TaskItem }>(`/tasks/${id}`, updates);
      return res.data.task;
    },
    onSuccess: (task) => {
      qc.setQueryData<TaskItem[]>(TASKS_KEY, (old) =>
        (old ?? []).map((t) => (t.id === task.id ? task : t)),
      );
    },
  });
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch<{ task: TaskItem }>(`/tasks/${id}/complete`);
      return res.data.task;
    },
    onSuccess: (task) => {
      qc.setQueryData<TaskItem[]>(TASKS_KEY, (old) =>
        (old ?? []).map((t) => (t.id === task.id ? task : t)),
      );
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tasks/${id}`);
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<TaskItem[]>(TASKS_KEY, (old) => (old ?? []).filter((t) => t.id !== id));
    },
  });
}

// ============ 日程 ============

export interface ScheduleEvent {
  id: string;
  title: string;
  startTime: string; // ISO
  endTime: string; // ISO
  location: string | null;
  priority: '高' | '中' | '低';
  attendees: string[];
  status: '待开始' | '进行中' | '已结束';
  ownerId: string;
  createdAt: string;
}

export function useSchedules(month: string) {
  // month: "YYYY-MM"
  return useQuery({
    queryKey: ['schedules', month],
    queryFn: async () => {
      const res = await api.get<{ schedules: ScheduleEvent[] }>('/schedules', {
        params: { month },
      });
      return res.data.schedules;
    },
    enabled: !!month,
  });
}

export function useCreateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<ScheduleEvent, 'id' | 'ownerId' | 'createdAt'>) => {
      const res = await api.post<{ schedule: ScheduleEvent }>('/schedules', input);
      return res.data.schedule;
    },
    onSuccess: () => {
      // 刷新所有月份缓存（日程可能跨月）
      qc.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useUpdateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<ScheduleEvent>) => {
      const res = await api.put<{ schedule: ScheduleEvent }>(`/schedules/${id}`, updates);
      return res.data.schedule;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useDeleteSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/schedules/${id}`);
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

// ============ 任务评论 / 活动流（P1-1） ============

// 评论列表（按时间正序）
export function useComments(taskId: string | undefined) {
  return useQuery({
    queryKey: ['comments', taskId],
    queryFn: async () => {
      const res = await api.get<{ comments: TaskComment[] }>(`/tasks/${taskId}/comments`);
      return res.data.comments;
    },
    enabled: !!taskId,
  });
}

// 发表评论：成功后失效评论列表 + 活动流（评论也会出现在活动流里）
export function useCreateComment(taskId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const res = await api.post<{ comment: TaskComment }>(`/tasks/${taskId}/comments`, { body });
      return res.data.comment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', taskId] });
      qc.invalidateQueries({ queryKey: ['activity', taskId] });
    },
  });
}

// 活动流（评论 + 变更合并，按时间倒序）
export function useTaskActivity(taskId: string | undefined) {
  return useQuery({
    queryKey: ['activity', taskId],
    queryFn: async () => {
      const res = await api.get<{ activity: TaskActivityEntry[] }>(`/tasks/${taskId}/activity`);
      return res.data.activity;
    },
    enabled: !!taskId,
  });
}

// ============ 工作区 / 成员（P1-2 多租户 + RBAC） ============

const WORKSPACES_KEY = ['workspaces'] as const;

// 当前用户的所有工作区
export function useWorkspaces() {
  return useQuery({
    queryKey: WORKSPACES_KEY,
    queryFn: async () => {
      const res = await api.get<{ workspaces: WorkspaceMembership[] }>('/workspaces');
      return res.data.workspaces;
    },
  });
}

// 新建工作区（创建者自动 admin）
export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await api.post<{ workspace: WorkspaceMembership }>('/workspaces', { name });
      return res.data.workspace;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WORKSPACES_KEY });
    },
  });
}

// 工作区成员列表
export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => {
      const res = await api.get<{ members: WorkspaceMember[] }>(`/workspaces/${workspaceId}/members`);
      return res.data.members;
    },
    enabled: !!workspaceId,
  });
}

// 邀请成员（admin）
export function useInviteMember(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: 'admin' | 'member' }) => {
      const res = await api.post<{ member: WorkspaceMember }>(`/workspaces/${workspaceId}/members`, {
        email,
        role,
      });
      return res.data.member;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
    },
  });
}

// 改成员角色（admin）
export function useUpdateMemberRole(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'admin' | 'member' }) => {
      await api.patch(`/workspaces/${workspaceId}/members/${userId}`, { role });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
    },
  });
}

// 移除成员（admin）
export function useRemoveMember(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/workspaces/${workspaceId}/members/${userId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
    },
  });
}

// ============ 知识库文章（P1-3） ============

const ARTICLES_KEY = ['articles'] as const;

// 文章列表（可选过滤：category 精确分类 / starred 仅收藏）
export function useArticles(params?: { category?: ArticleCategory; starred?: boolean }) {
  return useQuery({
    queryKey: params?.category || params?.starred ? ['articles', params] : ARTICLES_KEY,
    queryFn: async () => {
      const res = await api.get<{ articles: KnowledgeArticle[] }>('/articles', {
        params: {
          ...(params?.category ? { category: params.category } : {}),
          ...(params?.starred ? { starred: 'true' } : {}),
        },
      });
      return res.data.articles;
    },
  });
}

// 新建文章
export function useCreateArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; body?: string; category?: ArticleCategory }) => {
      const res = await api.post<{ article: KnowledgeArticle }>('/articles', input);
      return res.data.article;
    },
    onSuccess: (article) => {
      qc.setQueryData<KnowledgeArticle[]>(ARTICLES_KEY, (old) => [article, ...(old ?? [])]);
    },
  });
}

// 编辑文章
export function useUpdateArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Pick<KnowledgeArticle, 'title' | 'body' | 'category' | 'pinned'>>) => {
      const res = await api.patch<{ article: KnowledgeArticle }>(`/articles/${id}`, updates);
      return res.data.article;
    },
    onSuccess: (article) => {
      qc.setQueryData<KnowledgeArticle[]>(ARTICLES_KEY, (old) =>
        (old ?? []).map((a) => (a.id === article.id ? article : a)),
      );
    },
  });
}

// 切换收藏（乐观更新，失败回滚）
export function useToggleArticleStar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, starred }: { id: string; starred: boolean }) => {
      const res = await api.patch<{ id: string; starred: boolean }>(`/articles/${id}/star`);
      return res.data;
    },
    onMutate: async ({ id, starred }) => {
      await qc.cancelQueries({ queryKey: ARTICLES_KEY });
      const prev = qc.getQueryData<KnowledgeArticle[]>(ARTICLES_KEY);
      qc.setQueryData<KnowledgeArticle[]>(ARTICLES_KEY, (old) =>
        (old ?? []).map((a) => (a.id === id ? { ...a, starred } : a)),
      );
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(ARTICLES_KEY, ctx.prev);
    },
  });
}

// 删除文章
export function useDeleteArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/articles/${id}`);
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<KnowledgeArticle[]>(ARTICLES_KEY, (old) =>
        (old ?? []).filter((a) => a.id !== id),
      );
    },
  });
}

// ============ 文件上传（P1-3） ============

const FILES_KEY = ['files'] as const;

// 工作区文件列表
export function useFiles() {
  return useQuery({
    queryKey: FILES_KEY,
    queryFn: async () => {
      const res = await api.get<{ files: FileRecord[] }>('/files');
      return res.data.files;
    },
  });
}

// 上传文件（multipart/form-data）
export function useUploadFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { file: File; title?: string; category?: string; tags?: string[] }) => {
      const formData = new FormData();
      formData.append('file', input.file);
      if (input.title) formData.append('title', input.title);
      if (input.category) formData.append('category', input.category);
      if (input.tags && input.tags.length > 0) formData.append('tags', input.tags.join(','));
      const res = await api.post<{ file: FileRecord }>('/files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000, // 文件上传放宽超时
      });
      return res.data.file;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FILES_KEY });
    },
  });
}

// 删除文件（DB 记录 + 磁盘文件）
export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/files/${id}`);
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<FileRecord[]>(FILES_KEY, (old) => (old ?? []).filter((f) => f.id !== id));
    },
  });
}

// 下载文件（blob → 浏览器触发下载）
export async function downloadFile(id: string, fallbackName: string) {
  const res = await api.get(`/files/${id}/download`, { responseType: 'blob' });
  // 从 Content-Disposition 提取文件名，兜底用 fallbackName
  const cd = res.headers['content-disposition'] as string | undefined;
  let filename = fallbackName;
  const match = cd?.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i);
  if (match) {
    try {
      filename = decodeURIComponent(match[1]);
    } catch {
      filename = match[1];
    }
  }
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============ 通知 / 站内信（P1-4） ============
// 通知按【收件人】维度，不依赖 X-Workspace-Id（顶栏铃铛汇总所有工作区）。
// 本期不做 WebSocket，用短轮询拉取未读数（顶栏红点）。

const NOTIFICATIONS_KEY = ['notifications'] as const;
const UNREAD_COUNT_KEY = ['notifications', 'unread-count'] as const;

// 未读数：顶栏红点用，30s 轮询保持近实时
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: async () => {
      const res = await api.get<{ count: number }>('/notifications/unread-count');
      return res.data.count;
    },
    // P1-6：移除轮询，改用 WebSocket 实时推送
  });
}

// 通知列表（打开铃铛弹窗时加载）
export function useNotifications() {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: async () => {
      const res = await api.get<{ notifications: AppNotification[] }>('/notifications');
      return res.data.notifications;
    },
  });
}

// 标记单条已读
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`);
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<AppNotification[]>(NOTIFICATIONS_KEY, (old) =>
        (old ?? []).map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      // 未读数重算（本地更准，避免等下一次轮询）
      qc.setQueryData<number>(UNREAD_COUNT_KEY, (old) => Math.max(0, (old ?? 0) - 1));
    },
  });
}

// 全部已读
export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post('/notifications/read-all');
    },
    onSuccess: () => {
      qc.setQueryData<AppNotification[]>(NOTIFICATIONS_KEY, (old) =>
        (old ?? []).map((n) => ({ ...n, read: true })),
      );
      qc.setQueryData<number>(UNREAD_COUNT_KEY, 0);
    },
  });
}

// 清除已读
export function useClearReadNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete('/notifications/read');
    },
    onSuccess: () => {
      qc.setQueryData<AppNotification[]>(NOTIFICATIONS_KEY, (old) =>
        (old ?? []).filter((n) => !n.read),
      );
    },
  });
}

// ============ AI（P1-4 真实接入：管理员配置 + 任务建议代理） ============

const AI_CONFIG_KEY = ['ai-config'] as const;

// 取 AI 配置（仅 system_admin 能调通；非管理员后端 403）
export function useAiConfig() {
  return useQuery({
    queryKey: AI_CONFIG_KEY,
    queryFn: async () => {
      const res = await api.get<{ config: AiConfig }>('/ai/config');
      return res.data.config;
    },
    // 非管理员会 403，不弹错误
    retry: false,
  });
}

// 保存 AI 配置（apiKey 可选，空则保留旧值）
export function useSaveAiConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      aiBaseUrl?: string;
      aiModel?: string;
      aiTemperature?: number;
      apiKey?: string; // 留空表示不改 key
    }) => {
      const res = await api.put<{ config: AiConfig }>('/ai/config', input);
      return res.data.config;
    },
    onSuccess: (config) => {
      qc.setQueryData<AiConfig>(AI_CONFIG_KEY, config);
    },
  });
}

// 连通性测试
export function useTestAi() {
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<{ ok: boolean; latencyMs: number; reply?: string }>('/ai/test');
      return res.data;
    },
  });
}

// 任务智能建议（点「查看建议详情」时调用）
export function useAiSuggest() {
  return useMutation({
    mutationFn: async (task: {
      title: string;
      description?: string;
      phase?: string;
      status?: string;
      priority?: string;
    }) => {
      // 后端直接返回 { suggestions, confidence }（无外层 result 包裹）
      const res = await api.post<AiSuggestionResult>('/ai/suggest', { task });
      return res.data;
    },
  });
}

// ============ P1-5：文件重命名 + 用量统计 + 流式 AI + 预览 blob ============

// 文件重命名（只改 title）
export function useRenameFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const res = await api.patch<{ file: FileRecord }>(`/files/${id}`, { title });
      return res.data.file;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FILES_KEY });
    },
  });
}

// 取文件预览 blob URL（图片/PDF 内联渲染用；鉴权干净，不暴露 token 到 src）
export function useFilePreviewUrl(fileId: string | null) {
  return useQuery({
    queryKey: ['file-preview', fileId],
    queryFn: async () => {
      const res = await api.get(`/files/${fileId}/preview`, { responseType: 'blob' });
      return URL.createObjectURL(res.data);
    },
    enabled: !!fileId,
  });
}

// P1-6：文件版本历史列表 + 恢复
export function useFileVersions(fileId: string | undefined) {
  return useQuery({
    queryKey: ['file-versions', fileId],
    queryFn: async () => {
      const res = await api.get<{ versions: import('@/types').FileVersion[]; currentVersion: number }>(`/files/${fileId}/versions`);
      return res.data;
    },
    enabled: !!fileId,
  });
}

export function useRestoreFileVersion(fileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (versionId: string) => {
      const res = await api.post<{ file: FileRecord }>(`/files/${fileId}/restore/${versionId}`);
      return res.data.file;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FILES_KEY });
      qc.invalidateQueries({ queryKey: ['file-versions', fileId] });
    },
  });
}

// AI token 用量（近 30 天聚合，仅 system_admin）
export function useAiUsage() {
  return useQuery({
    queryKey: ['ai-usage'],
    queryFn: async () => {
      const res = await api.get<{ usage: AiUsageSummary }>('/ai/usage');
      return res.data.usage;
    },
    retry: false,
  });
}

/**
 * P1-5：流式 AI 建议调用（fetch + ReadableStream，逐 delta 回调）。
 * 后端返回 SSE：data: {"delta":"..."} / {"done":true,"confidence":N} / {"error":"..."}
 */
export async function streamAiSuggest(
  task: { title: string; description?: string; phase?: string; status?: string; priority?: string },
  onDelta: (fullText: string) => void,
  signal?: AbortSignal,
): Promise<{ confidence: number }> {
  const token = localStorage.getItem('wenxibuddy_token');
  const workspaceId = localStorage.getItem('wenxibuddy_workspace');
  const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

  const resp = await fetch(`${baseURL}/ai/suggest/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(workspaceId ? { 'X-Workspace-Id': workspaceId } : {}),
    },
    body: JSON.stringify({ task }),
    signal,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  if (!resp.body) throw new Error('未返回流');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let confidence = 80;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload) continue;
      try {
        const chunk = JSON.parse(payload) as { delta?: string; done?: boolean; confidence?: number; error?: string };
        if (chunk.error) throw new Error(chunk.error);
        if (chunk.delta) {
          fullText += chunk.delta;
          onDelta(fullText);
        }
        if (chunk.done && typeof chunk.confidence === 'number') confidence = chunk.confidence;
      } catch (e) {
        if (e instanceof Error && e.message && !e.message.startsWith('Unexpected')) throw e;
      }
    }
  }
  return { confidence };
}
