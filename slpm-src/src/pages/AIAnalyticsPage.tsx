import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Zap,
  TrendingUp,
  AlertTriangle,
  Brain,
  Activity,
  Users,
  Target,
  Clock,
  BarChart3,
  RefreshCw,
  Download,
  ChevronRight,
  CheckCircle2,
  Flame,
  Send,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { LiquidModal } from '@/components/ui/LiquidModal';
import { useToast } from '@/components/ui/Toast';
import { springSoft } from '@/lib/motion';
import { ViewTransition } from '@/components/ui/PageTransition';
import { useTasks, useAiSuggest, useCreateTask, useSendMessage } from '@/lib/queries';
import { apiError } from '@/lib/api';
import { computeFunnel, computeMemberLoad, computeBottleneck } from '@/lib/aggregations';
import { useApp } from '@/context/AppContext';
import { getRoleConfig } from '@/lib/roleConfig';
import { TaskItem } from '@/types';

type Range = '7d' | '30d' | 'q2';

interface InsightItem {
  title: string;
  level: '高' | '中';
  body: string;
  score: number;
  kind: 'suggestion' | 'risk';
  action?: 'create-task'; // 可执行动作：创建跟进任务
}

/**
 * P4-1：默认分析 = 基于真实任务数据的规则推导（不依赖 AI）。
 * 点击「立即重算」后由真实 AI（LLM）替换建议/风险。
 */
function deriveInsights(tasks: TaskItem[]): InsightItem[] {
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  const insights: InsightItem[] = [];

  // 1. 延期任务 → 高风险
  const overdue = tasks.filter((t) => t.status === '已延期');
  if (overdue.length > 0) {
    insights.push({
      title: `${overdue.length} 个任务已延期`,
      level: '高',
      body: `「${overdue[0].title}」等 ${overdue.length} 项任务已延期，建议尽快确认阻塞原因并调整截止时间。`,
      score: 85,
      kind: 'risk',
      action: 'create-task',
    });
  }

  // 2. 3 天内截止且未完成 → 中风险
  const soon = tasks.filter((t) => {
    if (!t.deadline || t.status === '已完成') return false;
    const d = new Date(t.deadline).getTime() - now;
    return d >= 0 && d <= 3 * day;
  });
  if (soon.length > 0) {
    insights.push({
      title: `${soon.length} 个任务 3 天内截止`,
      level: '中',
      body: `「${soon[0].title}」等任务临近截止，注意跟进进度。`,
      score: 62,
      kind: 'risk',
    });
  }

  // 3. 需求评审积压 → 建议
  const review = tasks.filter((t) => t.phase === '需求评审' && t.status !== '已完成');
  if (review.length >= 3) {
    insights.push({
      title: `需求评审阶段积压 ${review.length} 项`,
      level: '中',
      body: '评审任务积压较多，建议优先完成评审，避免后续阶段断粮。',
      score: 55,
      kind: 'suggestion',
      action: 'create-task',
    });
  }

  // 4. 负荷不均 → 建议
  const loads = computeMemberLoad(tasks);
  const top = loads[0];
  if (top && top.inProgress >= 3) {
    insights.push({
      title: `${top.name} 在办任务 ${top.inProgress} 项`,
      level: '中',
      body: `${top.name} 当前在办任务最多，建议重新分配部分任务给负荷较低的成员。`,
      score: 48,
      kind: 'suggestion',
    });
  }

  // 5. 无任何风险/建议时的兜底
  if (insights.length === 0) {
    insights.push({
      title: '一切正常，保持节奏',
      level: '中',
      body: '当前没有延期与临近截止的任务，团队节奏健康。',
      score: 30,
      kind: 'suggestion',
    });
  }
  return insights;
}

/** P4-1：真实 CSV 导出（任务清单，带 BOM 保证 Excel 中文正常） */
function exportTasksCSV(tasks: TaskItem[]) {
  const header = ['ID', '标题', '阶段', '状态', '优先级', '负责人', '截止时间', '标签'];
  const rows = tasks.map((t) => [
    t.id,
    t.title,
    t.phase,
    t.status,
    t.priority,
    t.assignee?.name ?? '未指派',
    t.deadline ? new Date(t.deadline).toLocaleString('zh-CN') : '',
    t.tags.join('/'),
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `任务清单_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const AIAnalyticsPage: React.FC = () => {
  const { show, ToastEl } = useToast();
  const { data: tasks = [] } = useTasks();
  const { currentRole } = useApp();
  const roleCfg = getRoleConfig(currentRole);
  const isReadOnly = roleCfg.readOnlyPages.includes('analytics');
  const [range, setRange] = useState<Range>('7d');
  const [detail, setDetail] = useState<InsightItem | null>(null);
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null);
  const [recomputing, setRecomputing] = useState(false);

  const createTask = useCreateTask();
  const sendMessage = useSendMessage();

  // 真实数据聚合（不随 range 变化，range 仅影响吞吐柱图分桶粒度）
  const funnel = useMemo(() => computeFunnel(tasks), [tasks]);
  const members = useMemo(
    () =>
      computeMemberLoad(tasks).map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role ?? '成员',
        load: m.load,
        output: m.completed, // 产出 = 已完成任务数
        inProgress: m.inProgress,
      })),
    [tasks],
  );
  const bottleneck = useMemo(() => computeBottleneck(tasks), [tasks]);

  // P4-1：吞吐趋势 = 按任务创建日期分桶的真实计数
  const bars = useMemo(() => {
    const now = Date.now();
    const day = 24 * 3600 * 1000;
    if (range === '7d') {
      // 近 7 天：每天一桶
      const buckets = Array(7).fill(0) as number[];
      for (const t of tasks) {
        const d = new Date(t.createdAt ?? t.deadline ?? Date.now()).getTime();
        const idx = 6 - Math.floor((now - d) / day);
        if (idx >= 0 && idx < 7) buckets[idx] += 1;
      }
      return buckets;
    }
    if (range === '30d') {
      // 近 30 天：每 3 天一桶（10 桶）
      const buckets = Array(10).fill(0) as number[];
      for (const t of tasks) {
        const d = new Date(t.createdAt ?? t.deadline ?? Date.now()).getTime();
        const idx = 9 - Math.floor((now - d) / (3 * day));
        if (idx >= 0 && idx < 10) buckets[idx] += 1;
      }
      return buckets;
    }
    // P5-3：本季度累计（动态计算当前季度起始日，不再硬编码 2026-04-01）
    const today = new Date();
    const qStartMonth = Math.floor(today.getMonth() / 3) * 3; // 0/3/6/9
    const qStart = new Date(today.getFullYear(), qStartMonth, 1).getTime();
    const buckets: number[] = [];
    for (const t of tasks) {
      const d = new Date(t.createdAt ?? Date.now()).getTime();
      if (d < qStart || d > now) continue;
      const week = Math.floor((d - qStart) / (7 * day));
      buckets[week] = (buckets[week] ?? 0) + 1;
    }
    return buckets;
  }, [tasks, range]);

  const barsTotal = bars.reduce((a, b) => a + b, 0);

  // P4-1：默认建议/风险 = 规则推导；AI 重算后替换
  const [insights, setInsights] = useState<InsightItem[]>(() => deriveInsights([]));
  const [aiRecomputed, setAiRecomputed] = useState(false);
  // 任务加载后若尚未重算，用真实规则推导
  const insightsFinal = aiRecomputed ? insights : deriveInsights(tasks);

  const suggestions = insightsFinal.filter((i) => i.kind === 'suggestion');
  const risks = insightsFinal.filter((i) => i.kind === 'risk');

  // 真实 KPI（全部来自任务聚合，无演示数据）
  const completedCount = tasks.filter((t) => t.status === '已完成').length;
  const inProgressCount = tasks.filter((t) => t.status === '进行中').length;
  const overdueCount = tasks.filter((t) => t.status === '已延期').length;
  const completionRate = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const kpis = [
    { label: '完成率', value: `${completionRate}%`, tip: `${completedCount}/${tasks.length} 项已完成`, icon: CheckCircle2, color: 'text-emerald-300' },
    { label: '进行中', value: String(inProgressCount), tip: '当前在办任务', icon: Activity, color: 'text-cyan-300' },
    { label: '延期任务', value: String(overdueCount), tip: overdueCount > 0 ? '需重点关注' : '暂无延期', icon: AlertTriangle, color: overdueCount > 0 ? 'text-rose-300' : 'text-white' },
    { label: '瓶颈阶段', value: bottleneck ?? '—', tip: '未完成任务最多', icon: Target, color: 'text-amber-300' },
  ];

  // P1-4：真实 AI 重算 —— 把交付漏斗 + 成员负荷聚合作为上下文
  const aiSuggest = useAiSuggest();
  const recompute = async () => {
    setRecomputing(true);
    show('AI 全量重算中…');
    try {
      const funnelSummary = funnel.map((f) => `${f.phase}:${f.entered}进/${f.completed}完`).join('，');
      const memberSummary = members.map((m) => `${m.name}(${m.load})`).join('，');
      const result = await aiSuggest.mutateAsync({
        title: `项目效能分析（共 ${tasks.length} 任务）`,
        description: `交付漏斗：${funnelSummary}。成员负荷：${memberSummary}。瓶颈阶段：${bottleneck}。`,
        phase: '项目总览',
        status: '进行中',
        priority: '高',
      });
      if (result.suggestions.length > 0) {
        const aiInsights: InsightItem[] = result.suggestions.map((s, i) => ({
          title: s.split(/[：:，,。]/)[0]?.slice(0, 20) || `AI 分析 ${i + 1}`,
          level: result.confidence > 70 ? '中' : '高',
          body: s,
          score: result.confidence,
          kind: i < Math.ceil(result.suggestions.length / 2) ? 'suggestion' : 'risk',
          action: 'create-task',
        }));
        setInsights(aiInsights);
        setAiRecomputed(true);
        show('重算完成 · 基于真实 AI 分析');
      } else {
        show('AI 未返回有效建议');
      }
    } catch (err) {
      show(apiError(err, 'AI 重算失败（若提示未配置，请联系管理员）'));
    } finally {
      setRecomputing(false);
    }
  };

  // 创建跟进任务（真实 API）
  const createFollowUp = async (item: InsightItem) => {
    try {
      const task = await createTask.mutateAsync({
        title: `跟进：${item.title}`,
        phase: '需求评审',
        priority: '高',
        status: '待处理',
        description: item.body,
        tags: ['AI跟进'],
      });
      setDetail(null);
      show(`已创建跟进任务「${task.title}」`);
    } catch (err) {
      show(apiError(err, '创建失败'));
    }
  };

  // 发送协同提醒（真实站内信）
  const sendReminder = async () => {
    if (!selectedMember) return;
    try {
      await sendMessage.mutateAsync({
        userId: selectedMember.id,
        title: '协同提醒',
        body: `请在近期的任务跟进中关注进度，如有阻塞请及时同步。`,
      });
      setSelectedMember(null);
      show(`已向 ${selectedMember.name} 发送协同提醒`);
    } catch (err) {
      show(apiError(err, '发送失败'));
    }
  };

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-3.5 pb-1">
      {ToastEl}

      {/* Header — 单行工具 */}
      <div className="flex items-center justify-between gap-3 flex-nowrap shrink-0 min-w-0 overflow-x-auto">
        <div className="flex items-center gap-3 shrink-0 min-w-0">
          <div className="liquid-icon-well w-10 h-10 rounded-2xl flex items-center justify-center text-violet-300">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[18px] font-bold text-white tracking-tight whitespace-nowrap">智能分析</h2>
            <p className="text-[11px] text-white/40 whitespace-nowrap truncate">AI 效能推演 · 链路瓶颈 · 风险与成员矩阵</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <div className="liquid-pill p-1 flex items-center gap-0.5 whitespace-nowrap">
            {([
              ['7d', '近 7 天'],
              ['30d', '近 30 天'],
              ['q2', '本季度'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setRange(id)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                  range === id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/75'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              exportTasksCSV(tasks);
              show(`已导出 ${tasks.length} 条任务为 CSV`);
            }}
            disabled={tasks.length === 0}
            className="liquid-pill h-9 px-3 text-[11px] text-white/60 flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40"
            title="导出当前任务清单（真实 CSV）"
          >
            <Download className="w-3.5 h-3.5" /> 导出
          </button>
          <button
            onClick={recompute}
            disabled={recomputing || isReadOnly}
            title={isReadOnly ? '需管理员或 PM 权限' : ''}
            className="h-9 px-3.5 rounded-full liquid-btn-primary text-[12px] font-bold flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${recomputing ? 'animate-spin' : ''}`} />
            {recomputing ? '重算中' : '立即重算'}
          </button>
        </div>
      </div>

      {/* P2-2：角色标签 */}
      {isReadOnly && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300/80 text-[11px] mt-3">
          <span>🔒</span>
          只读视图 · 当前角色：{roleCfg.label} — 无法重算或修改
        </div>
      )}

      {/* Hero banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springSoft}
        className="liquid-glass p-4 sm:p-5 relative overflow-hidden shrink-0"
      >
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-violet-500/15 blur-3xl rounded-full pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-400/30 text-violet-200 text-[11px] font-semibold">
              <Flame className="w-3.5 h-3.5" />
              AI 智能效能引擎 · {range === '7d' ? '近 7 天' : range === '30d' ? '近 30 天' : '本季度'}
            </div>
            <h3 className="text-[22px] font-extrabold text-white tracking-tight flex items-center gap-2 flex-wrap">
              AI 效能推演
              <span className="text-white/50 text-[14px] font-medium">
                {tasks.length} 项任务 · {members.length} 位成员
                {bottleneck ? ` · 瓶颈「${bottleneck}」` : ''}
              </span>
            </h3>
            <p className="text-[12px] text-white/50 max-w-2xl leading-relaxed">
              全部指标基于真实任务数据实时聚合；点击「立即重算」调用 AI 生成深度建议与风险矩阵。
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-400/25 text-center shrink-0 min-w-[120px]">
            <Brain className={`w-10 h-10 text-violet-300 mx-auto mb-1 ${recomputing ? 'animate-pulse' : ''}`} />
            <div className="text-[11px] font-mono text-violet-200 font-bold">{recomputing ? '推理重算中' : 'AI 实时在线'}</div>
          </div>
        </div>
      </motion.div>

      {/* KPI + 主体随 range 切换带动效 */}
      <ViewTransition viewKey={range} className="flex flex-col gap-3.5 flex-1 min-h-0">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 shrink-0">
        {kpis.map((k, i) => (
          <motion.button
            key={k.label}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, ...springSoft }}
            whileHover={{ y: -2 }}
            onClick={() => setDetail({
              title: k.label,
              level: '中',
              body: `${k.label}：${k.value}（${k.tip}），基于当前工作区 ${tasks.length} 条任务实时聚合。`,
              score: 50,
              kind: 'suggestion',
            })}
            className="liquid-glass liquid-glass-hover p-4 text-left space-y-1"
          >
            <div className="flex items-center justify-between text-[11px] text-white/40">
              <span>{k.label}</span>
              <k.icon className={`w-4 h-4 ${k.color}`} />
            </div>
            <div className="text-[22px] font-extrabold text-white tracking-tight">{k.value}</div>
            <div className={`text-[11px] font-medium ${k.color}`}>{k.tip}</div>
          </motion.button>
        ))}
      </div>

      {/* Main grids — fill remaining height */}
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-3 gap-3.5 overflow-y-auto xl:overflow-hidden">
        {/* 提效建议 */}
        <GlassCard className="p-4 sm:p-5 space-y-3 min-h-0 xl:overflow-y-auto" glowColor="purple">
          <h3 className="text-[13px] font-bold text-white flex items-center gap-2 shrink-0">
            <Zap className="w-4 h-4 text-violet-300" />
            智能提效建议
            {aiRecomputed && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-violet-400/15 text-violet-300 border border-violet-400/25">AI 生成</span>
            )}
          </h3>
          <div className="space-y-2.5">
            {suggestions.map((item) => (
              <button
                key={item.title}
                onClick={() => setDetail(item)}
                className="w-full text-left p-3 rounded-xl bg-black/25 border border-white/[0.05] hover:border-violet-400/30 transition-colors space-y-1.5"
              >
                <div className="font-bold text-white text-[12px] flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">{item.title}</span>
                  <span className="text-emerald-300 font-mono text-[10px] shrink-0">建议</span>
                </div>
                <p className="text-[11px] text-white/40 line-clamp-2">{item.body}</p>
                <span className="text-[10px] text-violet-300 inline-flex items-center gap-0.5">
                  查看详情 <ChevronRight className="w-3 h-3" />
                </span>
              </button>
            ))}
            {suggestions.length === 0 && (
              <div className="text-[12px] text-white/30 text-center py-8">暂无建议</div>
            )}
          </div>
        </GlassCard>

        {/* 吞吐趋势（真实：按创建日期分桶） */}
        <GlassCard className="p-4 sm:p-5 space-y-3 min-h-0 flex flex-col" glowColor="emerald">
          <div className="flex items-center justify-between shrink-0">
            <h3 className="text-[13px] font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-300" />
              任务吞吐量
            </h3>
            <span className="text-[10px] text-white/35 font-mono">新增 {barsTotal} 项 · {bars.length} 桶</span>
          </div>
          <div className="flex-1 min-h-[180px] flex items-end justify-between gap-1.5 px-1">
            {bars.map((h, i) => {
              const maxBar = Math.max(1, ...bars);
              return (
                <button
                  key={i}
                  onClick={() => show(`第 ${i + 1} 桶：新增 ${h} 项任务`)}
                  className="flex-1 flex flex-col items-center gap-1.5 group h-full justify-end"
                >
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(4, (h / maxBar) * 100)}%` }}
                    transition={{ delay: i * 0.03, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full max-h-full rounded-t-lg bg-gradient-to-t from-emerald-700 to-teal-300 shadow-[0_0_12px_rgba(16,185,129,0.22)] group-hover:brightness-125"
                  />
                  <span className="text-[9px] font-mono text-white/30">{h > 0 ? h : ''}</span>
                </button>
              );
            })}
            {bars.length === 0 && <div className="text-[12px] text-white/30 text-center py-10">所选区间暂无新建任务</div>}
          </div>
          <div className="grid grid-cols-3 gap-2 shrink-0">
            {[
              { l: '峰值', v: `${Math.max(0, ...bars)}` },
              { l: '均值', v: `${bars.length > 0 ? Math.round(barsTotal / bars.length) : 0}` },
              { l: '合计', v: `${barsTotal}` },
            ].map((x) => (
              <div key={x.l} className="p-2 rounded-xl bg-black/25 border border-white/[0.05] text-center">
                <div className="text-[10px] text-white/35">{x.l}</div>
                <div className="text-[13px] font-bold text-white font-mono">{x.v}</div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* 风险 */}
        <GlassCard className="p-4 sm:p-5 space-y-3 min-h-0 xl:overflow-y-auto" glowColor="red">
          <h3 className="text-[13px] font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-300" />
            风险排查矩阵
          </h3>
          <div className="space-y-2.5">
            {risks.map((r) => (
              <button
                key={r.title}
                onClick={() => setDetail(r)}
                className={`w-full text-left p-3 rounded-xl border space-y-1.5 ${
                  r.level === '高'
                    ? 'bg-rose-500/10 border-rose-400/25'
                    : 'bg-amber-500/10 border-amber-400/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-white text-[12px]">{r.title}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-black/30 text-white/70 border border-white/10">
                    {r.level} · {r.score}
                  </span>
                </div>
                <p className="text-[11px] text-white/55 line-clamp-2">{r.body}</p>
                <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${r.level === '高' ? 'bg-rose-400' : 'bg-amber-400'}`}
                    style={{ width: `${r.score}%` }}
                  />
                </div>
              </button>
            ))}
            {risks.length === 0 && (
              <div className="text-[12px] text-white/30 text-center py-8">暂无风险</div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Bottom row: funnel + members */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5 shrink-0 min-h-[200px]">
        <GlassCard className="p-4 sm:p-5 space-y-3">
          <h3 className="text-[13px] font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-300" />
            交付漏斗（按阶段）
          </h3>
          <div className="space-y-2.5">
            {funnel.map((f, i) => (
              <button
                key={f.phase}
                onClick={() => show(`${f.phase}：进入 ${f.entered} 项 · 已完成 ${f.completed} · 流转率 ${f.passRate}%`)}
                className="w-full text-left space-y-1"
              >
                <div className="flex justify-between text-[11px] text-white/55">
                  <span>{f.phase}</span>
                  <span className="font-mono text-cyan-300">{f.completed}/{f.entered} · {f.passRate}%</span>
                </div>
                <div className="h-2 rounded-full bg-black/35 border border-white/10 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${f.passRate}%` }}
                    transition={{ delay: 0.05 * i, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                  />
                </div>
              </button>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-5 space-y-3">
          <h3 className="text-[13px] font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-300" />
            成员效能矩阵
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {members.length === 0 ? (
              <p className="col-span-full text-[12px] text-white/40 py-6 text-center">暂无任务数据，成员效能将在任务被指派后显示。</p>
            ) : (
              members.slice(0, 9).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMember({ id: m.id, name: m.name })}
                  className="p-3 rounded-xl bg-black/25 border border-white/[0.05] text-left hover:border-emerald-400/30 transition-colors"
                >
                  <div className="text-[12px] font-bold text-white truncate">{m.name}</div>
                  <div className="text-[10px] text-white/35 mb-2">{m.role}</div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-amber-300">负荷 {m.load}%</span>
                    <span className="text-emerald-300">产出 {m.output}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </GlassCard>
      </div>
      </ViewTransition>

      {/* 详情弹窗（建议/风险/KPI） */}
      <LiquidModal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.title ?? ''}
        subtitle={detail?.kind === 'risk' ? '风险详情' : detail?.kind === 'suggestion' ? '建议详情' : '分析详情'}
        icon={detail?.kind === 'risk' ? <AlertTriangle className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={() => setDetail(null)} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">
              关闭
            </button>
            {detail?.action === 'create-task' && (
              <button
                onClick={() => detail && createFollowUp(detail)}
                disabled={isReadOnly || createTask.isPending}
                className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold disabled:opacity-40"
              >
                <CheckCircle2 className="w-4 h-4 inline mr-1" />
                {createTask.isPending ? '创建中…' : '创建跟进任务'}
              </button>
            )}
          </div>
        }
      >
        <p className="text-[13px] text-white/65 leading-relaxed">{detail?.body}</p>
      </LiquidModal>

      {/* 成员下钻（发送真实协同提醒） */}
      <LiquidModal
        open={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        title={selectedMember ? `${selectedMember.name} · 效能详情` : ''}
        subtitle="成员下钻"
        icon={<Users className="w-5 h-5" />}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setSelectedMember(null)} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">关闭</button>
            <button
              onClick={sendReminder}
              disabled={sendMessage.isPending}
              className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5 inline mr-1" />
              {sendMessage.isPending ? '发送中…' : '发送协同提醒'}
            </button>
          </div>
        }
      >
        {selectedMember && (
          <div className="space-y-3 text-[12px] text-white/65">
            <p>该成员的任务负荷与产出（基于真实任务聚合）。点击「发送协同提醒」将发送站内信通知 TA。</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-black/25 border border-white/10">
                <div className="text-white/40 text-[11px]">在办任务</div>
                <div className="text-[18px] font-bold text-white font-mono mt-1">
                  {members.find((m) => m.id === selectedMember.id)?.inProgress ?? 0} 项
                </div>
              </div>
              <div className="p-3 rounded-xl bg-black/25 border border-white/10">
                <div className="text-white/40 text-[11px]">已完成（产出）</div>
                <div className="text-[18px] font-bold text-emerald-300 font-mono mt-1">
                  {members.find((m) => m.id === selectedMember.id)?.output ?? 0}
                </div>
              </div>
            </div>
          </div>
        )}
      </LiquidModal>
    </div>
  );
};
