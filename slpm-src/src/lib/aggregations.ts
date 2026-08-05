/**
 * 纯聚合函数：从 TaskItem[] 计算项目总览/智能分析页所需的指标。
 *
 * 这些指标完全基于当前任务快照在前端计算，无需后端聚合接口。
 * 数据源：useTasks()（当前用户的全部任务）。
 *
 * 注：涉及历史时间窗（7d/30d/Q2 趋势）、代码提交数、AI 采纳率等指标
 * 后端无数据源，相关页面会标注为【演示数据】，不在此处计算。
 */
import { TaskItem, TaskStatus } from '@/types';

const PHASES = ['需求评审', '产品设计', '开发实现', '测试验证'] as const;
type Phase = (typeof PHASES)[number];

/** 项目总览核心指标 */
export interface OverviewStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
  /** 完成率 0-100（total=0 时为 0） */
  completionRate: number;
  /** 各阶段任务数 */
  phaseBreakdown: { phase: Phase; count: number }[];
  /** 各阶段完成率（0-100） */
  phaseCompletion: { phase: Phase; rate: number }[];
  /** 阻塞/风险数 = 已延期 + 待处理 */
  blockedCount: number;
}

export function computeOverview(tasks: TaskItem[]): OverviewStats {
  const total = tasks.length;
  const countBy = (s: TaskStatus) => tasks.filter((t) => t.status === s).length;
  const completed = countBy('已完成');
  const inProgress = countBy('进行中');
  const pending = countBy('待处理');
  const overdue = countBy('已延期');

  const phaseBreakdown = PHASES.map((phase) => ({
    phase,
    count: tasks.filter((t) => t.phase === phase).length,
  }));
  const phaseCompletion = PHASES.map((phase) => {
    const inPhase = tasks.filter((t) => t.phase === phase);
    const done = inPhase.filter((t) => t.status === '已完成').length;
    return { phase, rate: inPhase.length === 0 ? 0 : Math.round((done / inPhase.length) * 100) };
  });

  return {
    total,
    completed,
    inProgress,
    pending,
    overdue,
    completionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
    phaseBreakdown,
    phaseCompletion,
    blockedCount: overdue + pending,
  };
}

/** 交付漏斗：按阶段统计进入数与已完成数 */
export interface FunnelStage {
  phase: Phase;
  entered: number; // 进入该阶段的任务数
  completed: number; // 该阶段已完成数
  /** 流转率 0-100 */
  passRate: number;
}

export function computeFunnel(tasks: TaskItem[]): FunnelStage[] {
  return PHASES.map((phase) => {
    const inPhase = tasks.filter((t) => t.phase === phase);
    const completed = inPhase.filter((t) => t.status === '已完成').length;
    return {
      phase,
      entered: inPhase.length,
      completed,
      passRate: inPhase.length === 0 ? 0 : Math.round((completed / inPhase.length) * 100),
    };
  });
}

/** 成员负荷：按 assignee 聚合 */
export interface MemberLoad {
  id: string;
  name: string;
  avatar: string | null;
  role: string | null;
  total: number;
  inProgress: number; // 在办（进行中）
  completed: number; // 产出（已完成）
  /** 负荷率 0-100（基于全组最大在办数归一化，total=0 时 0） */
  load: number;
}

export function computeMemberLoad(tasks: TaskItem[]): MemberLoad[] {
  // 用 assigneeId 聚合；兼容旧嵌入式 assignee（无 id 时退到 name）
  const groups = new Map<string, MemberLoad & { _maxInProgressBase: number }>();

  for (const t of tasks) {
    const id = t.assigneeId || (t.assignee as { id?: string }).id || (t.assignee as { name: string }).name;
    const name = (t.assignee as { name: string }).name || '未指派';
    const avatar = (t.assignee as { avatar?: string | null }).avatar ?? null;
    const role = (t.assignee as { role?: string | null }).role ?? null;
    if (!groups.has(id)) {
      groups.set(id, {
        id,
        name,
        avatar,
        role,
        total: 0,
        inProgress: 0,
        completed: 0,
        load: 0,
        _maxInProgressBase: 0,
      });
    }
    const g = groups.get(id)!;
    g.total += 1;
    if (t.status === '进行中') g.inProgress += 1;
    if (t.status === '已完成') g.completed += 1;
  }

  const arr = Array.from(groups.values());
  const maxInProgress = Math.max(1, ...arr.map((g) => g.inProgress));
  return arr
    .map(({ _maxInProgressBase, ...rest }) => ({
      ...rest,
      load: Math.round((rest.inProgress / maxInProgress) * 100),
    }))
    .sort((a, b) => b.inProgress - a.inProgress);
}

/** 瓶颈阶段：未完成任务占比最高的阶段 */
export function computeBottleneck(tasks: TaskItem[]): Phase | null {
  const candidates = PHASES.map((phase) => {
    const inPhase = tasks.filter((t) => t.phase === phase);
    const incomplete = inPhase.filter((t) => t.status !== '已完成').length;
    return { phase, incomplete, total: inPhase.length };
  });
  // 取未完成数最多、且确有任务的阶段
  const valid = candidates.filter((c) => c.total > 0);
  if (valid.length === 0) return null;
  valid.sort((a, b) => b.incomplete - a.incomplete);
  return valid[0].phase;
}
