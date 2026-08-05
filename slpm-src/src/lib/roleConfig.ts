/**
 * P2-1：职能角色配置表。
 *
 * 每个角色定义：标签/颜色/着陆页/默认任务筛选/导航顺序/只读页面。
 * Sidebar 读 navOrder 决定导航项排序；App.tsx 读 landingPage 决定着陆重定向；
 * TaskGroupList 读 defaultTaskFilter 决定默认筛选 tab。
 */
import { NavTab, WsRole } from '@/types';

export interface RoleConfig {
  label: string;
  color: string;
  landingPage: NavTab;
  defaultTaskFilter: 'all' | 'assigned' | 'phase-qa';
  navOrder: NavTab[];
  readOnlyPages: NavTab[];
}

export const ROLE_CONFIGS: Record<WsRole, RoleConfig> = {
  pm: {
    label: '项目经理',
    color: 'text-emerald-300 bg-emerald-400/15',
    landingPage: 'overview',
    defaultTaskFilter: 'all',
    navOrder: ['overview', 'tasks', 'schedule', 'analytics', 'files', 'collaboration', 'knowledge', 'settings'],
    readOnlyPages: [],
  },
  dev: {
    label: '研发工程师',
    color: 'text-cyan-300 bg-cyan-400/15',
    landingPage: 'tasks',
    defaultTaskFilter: 'assigned',
    navOrder: ['tasks', 'schedule', 'files', 'knowledge', 'overview', 'collaboration', 'analytics', 'settings'],
    readOnlyPages: ['overview', 'analytics'],
  },
  qa: {
    label: '测试工程师',
    color: 'text-amber-300 bg-amber-400/15',
    landingPage: 'tasks',
    defaultTaskFilter: 'phase-qa',
    navOrder: ['tasks', 'schedule', 'knowledge', 'files', 'overview', 'analytics', 'collaboration', 'settings'],
    readOnlyPages: ['overview', 'analytics'],
  },
  admin: {
    label: '管理员',
    color: 'text-violet-300 bg-violet-400/15',
    landingPage: 'overview',
    defaultTaskFilter: 'all',
    navOrder: ['overview', 'tasks', 'schedule', 'analytics', 'files', 'collaboration', 'knowledge', 'settings'],
    readOnlyPages: [],
  },
};

/** 安全获取角色配置（未知角色兜底为 dev） */
export function getRoleConfig(role: string | null | undefined): RoleConfig {
  if (role && role in ROLE_CONFIGS) return ROLE_CONFIGS[role as WsRole];
  return ROLE_CONFIGS.dev;
}

/** 所有角色选项（用于邀请/改角色的下拉） */
export const ROLE_OPTIONS: { value: WsRole; label: string }[] = [
  { value: 'pm', label: '项目经理 (PM)' },
  { value: 'dev', label: '研发工程师 (Dev)' },
  { value: 'qa', label: '测试工程师 (QA)' },
  { value: 'admin', label: '管理员' },
];
