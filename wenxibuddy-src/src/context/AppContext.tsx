import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CardDeckItem, TaskItem, UserSettings, WorkspaceMembership } from '@/types';
import { useAuth } from './AuthContext';
import { api, workspaceStore } from '@/lib/api';

type AccentColor = 'emerald' | 'cyan' | 'purple';
type GlassBlur = 'standard' | 'ultra' | 'max';

// 与后端 schema.prisma / settings.routes.ts 默认值保持一致
const DEFAULT_SETTINGS: UserSettings = {
  accentColor: 'emerald',
  glassBlur: 'ultra',
  enableConfetti: true,
};

// 玻璃模糊强度 → CSS 变量 --blur-liquid 的像素值
const BLUR_PX: Record<GlassBlur, string> = {
  standard: '24px',
  ultra: '40px',
  max: '56px',
};

/**
 * 把主题设置应用到 documentElement。
 * 提取为纯函数，便于在 AppProvider 启动与设置变更时统一调用，
 * 解决"状态恢复但 UI 未变"的问题。
 */
function applyThemeToDOM(s: { accentColor: AccentColor; glassBlur: GlassBlur }) {
  const root = document.documentElement;
  root.dataset.accent = s.accentColor;
  root.dataset.blur = s.glassBlur;
  root.style.setProperty('--blur-liquid', BLUR_PX[s.glassBlur]);
}

/**
 * AppContext —— 全局 UI 状态（弹窗、主题、工作区、文件）。
 *
 * 说明：任务的持久化数据已迁移到后端 + TanStack Query（见 src/lib/queries.ts），
 *   不再放在 Context。selectedTask / editingTask 作为 UI 选区状态保留在此处，
 *   供任务管理页、智能详情面板、编辑弹窗共享。
 *
 * 主题三件套（accentColor / glassBlur / enableConfetti）持久化到后端 UserSettings；
 *   登录/恢复会话时从 user.settings 初始化，变更时乐观更新 + PUT /settings 落库，
 *   并通过 applyThemeToDOM 实时同步到 DOM。
 */
interface AppContextType {
  // 任务 UI 选区（数据来自 TanStack Query，这里只存当前选中）
  selectedTask: TaskItem | null;
  setSelectedTask: (task: TaskItem | null) => void;

  // 工作区（P1-2：真实持久化到后端）
  // workspaces：当前用户所属的工作区列表（含 role，来自 user.workspaces）
  // currentWorkspace：当前选中的工作区对象（id 写 localStorage，axios 拦截器读取注入 header）
  // currentRole：当前工作区的角色（admin/member），供 UI 按钮禁用
  workspaces: WorkspaceMembership[];
  currentWorkspace: WorkspaceMembership | null;
  currentRole: 'admin' | 'member' | null;
  setCurrentWorkspace: (id: string) => void;
  addWorkspace: (name: string) => Promise<WorkspaceMembership>;

  // 主题（持久化到 UserSettings；updateSettings 负责落库）
  accentColor: AccentColor;
  glassBlur: GlassBlur;
  enableConfetti: boolean;
  setAccentColor: (color: AccentColor) => void;
  setGlassBlur: (blur: GlassBlur) => void;
  setEnableConfetti: (val: boolean) => void;
  // 一次性把当前三件套写入后端（设置页"保存全部"调用）
  updateSettings: () => Promise<void>;

  // 弹窗状态
  isNewTaskOpen: boolean;
  setIsNewTaskOpen: (val: boolean) => void;
  editingTask: TaskItem | null;
  setEditingTask: (task: TaskItem | null) => void;
  selectedDoc: CardDeckItem | null;
  setSelectedDoc: (doc: CardDeckItem | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, refreshUser } = useAuth();
  const qc = useQueryClient();
  const userSettings = user?.settings ?? DEFAULT_SETTINGS;

  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  // P1-2：工作区真实化 —— 从 user.workspaces 派生
  const workspaces: WorkspaceMembership[] = user?.workspaces ?? [];
  // currentWorkspaceId 存 localStorage（供 axios 拦截器读取注入 header）
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(
    () => workspaceStore.get(),
  );

  // 当前选中的工作区对象（从 workspaces 列表里找 id 匹配的）
  const currentWorkspace: WorkspaceMembership | null = useMemo(() => {
    if (!currentWorkspaceId) return workspaces[0] ?? null;
    return workspaces.find((w) => w.id === currentWorkspaceId) ?? workspaces[0] ?? null;
  }, [workspaces, currentWorkspaceId]);

  // 当前工作区的角色（admin/member），供 UI 按钮禁用
  const currentRole: 'admin' | 'member' | null = currentWorkspace?.role ?? null;

  // 用户登录/恢复会话带来 workspaces 时，确保 localStorage 与实际选中同步
  useEffect(() => {
    if (!user) {
      // 登出：清 workspace 选择
      workspaceStore.clear();
      setCurrentWorkspaceId(null);
      return;
    }
    // 若 localStorage 无 workspace 或存的 id 已不在用户工作区列表里，默认选第一个
    const stored = workspaceStore.get();
    const valid = stored && workspaces.some((w) => w.id === stored);
    if (!valid) {
      const first = workspaces[0];
      if (first) {
        workspaceStore.set(first.id);
        setCurrentWorkspaceId(first.id);
      }
    } else if (stored !== currentWorkspaceId) {
      setCurrentWorkspaceId(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, workspaces.length]);

  // Themes —— 初始值从已登录用户的 settings 读取（登录/恢复会话后即生效）
  const [accentColor, setAccentColor] = useState<AccentColor>(userSettings.accentColor);
  const [glassBlur, setGlassBlur] = useState<GlassBlur>(userSettings.glassBlur);
  const [enableConfetti, setEnableConfetti] = useState<boolean>(userSettings.enableConfetti);

  // 当用户切换（登录/登出/恢复会话带来新 settings）时，同步本地 state
  useEffect(() => {
    setAccentColor(userSettings.accentColor);
    setGlassBlur(userSettings.glassBlur);
    setEnableConfetti(userSettings.enableConfetti);
    // 仅依赖 user?.settings 的各字段，避免 user 引用变化导致重置本地编辑中的值
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.settings?.accentColor, user?.settings?.glassBlur, user?.settings?.enableConfetti]);

  // 主题变化时实时应用 DOM（含启动初次渲染）——刷新后状态恢复 UI 也跟着变
  useEffect(() => {
    applyThemeToDOM({ accentColor, glassBlur });
  }, [accentColor, glassBlur]);

  // Modals
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<CardDeckItem | null>(null);

  // P1-2：切换工作区 —— 写 localStorage（axios 自动注入 header）+ 失效数据缓存
  const setCurrentWorkspace = (id: string) => {
    workspaceStore.set(id);
    setCurrentWorkspaceId(id);
    // 失效所有工作区相关数据，让切换后重新拉取
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['schedules'] });
    qc.invalidateQueries({ queryKey: ['comments'] });
    qc.invalidateQueries({ queryKey: ['activity'] });
    // P1-3：知识库文章同样按工作区隔离
    qc.invalidateQueries({ queryKey: ['articles'] });
  };

  // P1-2：新建工作区 —— 调后端 API，成功后切到新工作区并刷新用户数据
  const addWorkspace = async (name: string): Promise<WorkspaceMembership> => {
    const res = await api.post<{ workspace: WorkspaceMembership }>('/workspaces', { name });
    const ws = res.data.workspace;
    // 刷新 user.workspaces（让侧栏列表更新）
    await refreshUser();
    workspaceStore.set(ws.id);
    setCurrentWorkspaceId(ws.id);
    qc.invalidateQueries({ queryKey: ['tasks'] });
    return ws;
  };

  // 把当前三件套落库（设置页保存按钮调用；本地 state 已是最新，这里只负责持久化）
  const updateSettings = async () => {
    await api.put('/settings', { accentColor, glassBlur, enableConfetti });
  };

  return (
    <AppContext.Provider
      value={{
        selectedTask,
        setSelectedTask,
        // P1-2：真实工作区
        workspaces,
        currentWorkspace,
        currentRole,
        setCurrentWorkspace,
        addWorkspace,
        accentColor,
        glassBlur,
        enableConfetti,
        setAccentColor,
        setGlassBlur,
        setEnableConfetti,
        updateSettings,
        isNewTaskOpen,
        setIsNewTaskOpen,
        editingTask,
        setEditingTask,
        selectedDoc,
        setSelectedDoc,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
