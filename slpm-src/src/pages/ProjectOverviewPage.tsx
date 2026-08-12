import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, CheckCircle2, AlertTriangle, Users, Zap, ShieldCheck, PieChart, ArrowRight, Info, Clock, Target, TrendingUp } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { LiquidModal } from '@/components/ui/LiquidModal';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/QueryError';
import { useToast } from '@/components/ui/Toast';
import { springSoft } from '@/lib/motion';
import { ViewTransition } from '@/components/ui/PageTransition';
import { useTasks, useCreateTask } from '@/lib/queries';
import { computeOverview, computeMemberLoad, OverviewStats } from '@/lib/aggregations';
import { apiError } from '@/lib/api';
import { useApp } from '@/context/AppContext';
import { getRoleConfig } from '@/lib/roleConfig';

// 阶段 → 展示用的进度条颜色（与原 modules 视觉风格保持一致）
const PHASE_COLOR: Record<string, string> = {
  需求评审: 'bg-emerald-500',
  产品设计: 'bg-teal-400',
  开发实现: 'bg-cyan-400',
  测试验证: 'bg-indigo-400',
};

export const ProjectOverviewPage: React.FC = () => {
  const { show, ToastEl } = useToast();
  const { data: tasks = [], isLoading, isError, refetch } = useTasks();
  const navigate = useNavigate();
  const { currentRole } = useApp();
  const roleCfg = getRoleConfig(currentRole);
  const isReadOnly = roleCfg.readOnlyPages.includes('overview');
  const isPM = currentRole === 'pm' || currentRole === 'admin';
  const stats: OverviewStats = useMemo(() => computeOverview(tasks), [tasks]);
  const memberLoad = useMemo(() => computeMemberLoad(tasks), [tasks]);

  // P2-2：本周截止日期范围
  const now = new Date();
  const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7);
  const upcomingDeadlines = useMemo(() => tasks.filter((t) => {
    if (!t.deadline) return false;
    const d = new Date(t.deadline);
    return d <= weekEnd && t.status !== '已完成';
  }).sort((a,b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()), [tasks]);

  const [selectedModule, setSelectedModule] = useState<{ name: string; progress: number; color: string; count: number } | null>(null);
  const [tab, setTab] = useState<'health' | 'risk' | 'team'>('health');

  // P4-1：风险清单 = 真实任务自动识别（延期 / 7 天内截止）
  const risks = useMemo(() => {
    const list: { title: string; level: '高' | '中'; desc: string; task?: (typeof tasks)[number] }[] = [];
    const overdue = tasks.filter((t) => t.status === '已延期');
    if (overdue.length > 0) {
      list.push({
        title: `${overdue.length} 个任务已延期`,
        level: '高',
        desc: `「${overdue.slice(0, 3).map((t) => t.title).join('」、「')}」${overdue.length > 3 ? ` 等 ${overdue.length} 项` : ''}已逾期，建议确认阻塞并调整计划。`,
        task: overdue[0],
      });
    }
    const soon = tasks.filter((t) => {
      if (!t.deadline || t.status === '已完成' || t.status === '已延期') return false;
      return new Date(t.deadline).getTime() <= weekEnd.getTime();
    });
    if (soon.length > 0) {
      list.push({
        title: `${soon.length} 个任务 7 天内截止`,
        level: '中',
        desc: `「${soon.slice(0, 3).map((t) => t.title).join('」、「')}」${soon.length > 3 ? ' 等' : ''}即将到期，注意跟进。`,
        task: soon[0],
      });
    }
    return list;
  }, [tasks, weekEnd]);

  // P4-1：点击风险创建真实跟进任务
  const createTask = useCreateTask();
  const createFollowUp = async (r: { title: string; desc: string }) => {
    try {
      const task = await createTask.mutateAsync({
        title: `跟进：${r.title}`,
        phase: '需求评审',
        priority: '高',
        status: '待处理',
        description: r.desc,
        tags: ['风险跟进'],
      });
      show(`已创建跟进任务「${task.title}」`);
    } catch (err) {
      show(apiError(err, '创建失败'));
    }
  };

  // P4-2：进度燃尽（按截止日期排序，剩余任务累计曲线 vs 理想直线）
  const burndown = useMemo(() => {
    const withDeadline = tasks
      .filter((t) => t.deadline)
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
    const total = withDeadline.length;
    if (total === 0) return null;
    const W = 100;
    const H = 44;
    let completedSoFar = 0;
    const points = withDeadline.map((t, i) => {
      if (t.status === '已完成') completedSoFar += 1;
      const x = total > 1 ? (i / (total - 1)) * W : W;
      const remaining = total - completedSoFar;
      const y = H - (remaining / total) * H;
      return { x, y, done: t.status === '已完成' };
    });
    return {
      total,
      completed: completedSoFar,
      points,
      lastDeadline: withDeadline[withDeadline.length - 1].deadline!,
    };
  }, [tasks]);

  // 模块进度 = 各阶段完成率（真实数据驱动，保留全部四阶段）
  const modules = useMemo(
    () =>
      stats.phaseCompletion.map((p) => ({
        name: p.phase,
        progress: p.rate,
        color: PHASE_COLOR[p.phase] ?? 'bg-emerald-500',
        count: stats.phaseBreakdown.find((x) => x.phase === p.phase)?.count ?? 0,
      })),
    [stats],
  );

  // P9-UX：错误态 —— 总览数据加载失败时给重试入口，不再静默显示全 0 健康度
  if (isError) {
    return (
      <div className="w-full min-h-full flex items-center justify-center">
        <QueryError onRetry={() => refetch()} message="总览数据加载失败，请检查网络或工作区状态" />
      </div>
    );
  }

  return (
    <div className="w-full min-h-full space-y-4 pb-4">
      {ToastEl}

      {/* 数据来源说明 */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[11px] text-white/50">
        <Info className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
        <span>以下指标基于当前工作区的真实任务数据实时聚合（里程碑、阻塞点、模块进度、成员负荷）。</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springSoft}
        className="liquid-glass p-5 sm:p-6 relative overflow-hidden"
      >
        <div className="absolute top-0 inset-x-16 h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              SLPM · {new Date().getFullYear()}
            </div>
            <h2 className="text-[22px] font-extrabold text-white tracking-tight flex items-center gap-2 flex-wrap">
              任务总览
              <span className="text-white/50 text-[14px] font-medium">
                共 {stats.total} 项 · 已完成 {stats.completed} · 进行中 {stats.inProgress}
              </span>
            </h2>
            <p className="text-[12px] text-white/50 max-w-xl leading-relaxed">
              完成度、阶段进度与成员负荷均为当前工作区的真实任务聚合。
            </p>
            {/* P2-2：角色标签 */}
            {isReadOnly && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300/80 text-[11px]">
                <Info className="w-3 h-3" />
                只读视图 · 当前角色：{roleCfg.label}
              </div>
            )}
            {isPM && !isReadOnly && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-300/80 text-[11px]">
                <Target className="w-3 h-3" />
                项目管理视图
              </div>
            )}
            <div className="flex gap-2 pt-1">
              {(['health', 'risk', 'team'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
                    tab === t
                      ? 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30'
                      : 'liquid-btn-ghost text-white/45 border-transparent'
                  }`}
                >
                  {t === 'health' ? '健康度' : t === 'risk' ? '风险' : '团队'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <div className="text-[28px] font-extrabold text-emerald-300 font-mono">{stats.completionRate}%</div>
              <div className="text-[11px] text-white/40">总体完成度</div>
            </div>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
              className="w-[72px] h-[72px] rounded-full border-4 border-emerald-400/80 border-t-transparent flex items-center justify-center font-extrabold text-sm text-white shadow-[0_0_24px_rgba(16,185,129,0.35)]"
              title={`${new Date().getFullYear()} 年第 ${Math.floor(new Date().getMonth() / 3) + 1} 季度`}
            >
              {`Q${Math.floor(new Date().getMonth() / 3) + 1}`}
            </motion.div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {isLoading ? (
          <div className="col-span-2 xl:col-span-4"><SkeletonCards cards={4} /></div>
        ) : [
          { title: '任务完成', value: `${stats.completed} / ${stats.total}`, tip: `完成率 ${stats.completionRate}%`, icon: CheckCircle2, color: 'text-emerald-300', to: '/tasks' },
          { title: '进行中任务', value: `${stats.total - stats.completed} 项`, tip: '当前在办（含待处理）', icon: Zap, color: 'text-cyan-300', to: '/tasks' },
          { title: '团队平均负荷', value: `${memberLoad.length ? Math.round(memberLoad.reduce((s, m) => s + m.load, 0) / memberLoad.length) : 0}%`, tip: '基于在办任务归一化', icon: Users, color: 'text-violet-300', to: '/team' },
          { title: '潜在阻塞点', value: `${stats.blockedCount} 项`, tip: `${stats.overdue} 延期 / ${stats.pending} 待处理`, icon: AlertTriangle, color: 'text-rose-300', to: '/tasks' },
        ].map((c, i) => (
          <motion.button
            key={c.title}
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, ...springSoft }}
            whileHover={{ y: -2 }}
            onClick={() => navigate(c.to)}
            className="liquid-glass liquid-glass-hover p-4 text-left space-y-2 group"
          >
            <div className="flex items-center justify-between text-[11px] text-white/40">
              <span>{c.title}</span>
              <c.icon className={`w-4 h-4 ${c.color}`} />
            </div>
            <div className="text-[22px] font-extrabold text-white">{c.value}</div>
            <div className={`text-[11px] font-medium ${c.color} flex items-center gap-1`}>
              {c.tip}
              <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0 transition-all" />
            </div>
          </motion.button>
        ))}
      </div>

      {/* P2-2：PM 专属看板 —— 截止日预警 + 成员负荷 */}
      {isPM && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {/* 截止日预警 */}
          <GlassCard className="p-5 space-y-3">
            <h3 className="text-[13px] font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-300" />
              截止日预警
              {upcomingDeadlines.length > 0 && (
                <span className="text-[10px] font-normal text-white/40">{upcomingDeadlines.length} 项</span>
              )}
            </h3>
            {upcomingDeadlines.length === 0 ? (
              <p className="text-[12px] text-white/35 py-2">当前无逾期或本周截止任务 ✓</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {upcomingDeadlines.slice(0, 8).map((t) => {
                  const d = new Date(t.deadline!);
                  const isOverdue = d < now;
                  return (
                    <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-black/20 border border-white/[0.05]">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isOverdue ? 'bg-rose-400' : 'bg-amber-400'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] text-white/80 truncate">{t.title}</div>
                        <div className={`text-[10px] ${isOverdue ? 'text-rose-300' : 'text-amber-300/70'}`}>
                          {isOverdue ? '已逾期 · ' : ''}{d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                          {t.assignee && typeof t.assignee === 'object' && 'name' in t.assignee && (
                            <span className="text-white/30 ml-1">· {t.assignee.name}</span>
                          )}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${t.status === '已延期' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/15 text-amber-300'}`}>
                        {t.status === '已延期' ? '已延期' : '进行中'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>

          {/* 成员负荷分布 */}
          <GlassCard className="p-5 space-y-3">
            <h3 className="text-[13px] font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-300" />
              成员负荷分布
            </h3>
            {memberLoad.length === 0 ? (
              <p className="text-[12px] text-white/35 py-2">暂无任务分配数据</p>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto">
                {memberLoad.slice(0, 8).map((m) => {
                  const maxLoad = Math.max(...memberLoad.map(x => x.total), 1);
                  const pct = Math.round((m.total / maxLoad) * 100);
                  const donePct = m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0;
                  return (
                    <div key={m.id} className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-200 flex items-center justify-center text-[9px] font-bold shrink-0">
                        {m.name.slice(0, 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between text-[11px] mb-0.5">
                          <span className="text-white/70 truncate">{m.name}</span>
                          <span className="text-white/35 font-mono">{m.completed}/{m.total}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-black/30 overflow-hidden flex">
                          <div className="h-full bg-emerald-400/70 rounded-full" style={{ width: `${donePct}%` }} />
                          <div className="h-full bg-white/10" style={{ width: `${Math.max(0, pct - donePct)}%` }} />
                        </div>
                      </div>
                      <span className="text-[10px] text-white/30 font-mono w-8 text-right shrink-0">{m.load}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      <ViewTransition viewKey={tab}>
      {tab === 'health' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GlassCard className="p-5 space-y-4">
            <h3 className="text-[13px] font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-300" />
              阶段完成进度
            </h3>
            <div className="space-y-3">
              {modules.map((item, idx) => (
                <button
                  key={item.name}
                  onClick={() => setSelectedModule(item)}
                  className="w-full text-left space-y-1.5 group"
                >
                  <div className="flex justify-between text-[12px] text-white/70 group-hover:text-white">
                    <span className="flex items-center gap-1">
                      {item.name}
                      <span className="text-[10px] text-white/35">（{item.count} 项）</span>
                      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                    </span>
                    <span className="font-mono text-emerald-300 font-bold">{item.progress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden border border-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.progress}%` }}
                      transition={{ delay: 0.05 * idx, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      className={`h-full rounded-full ${item.color}`}
                    />
                  </div>
                </button>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5 space-y-4">
            <h3 className="text-[13px] font-bold text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-cyan-300" />
              成员任务分布
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {memberLoad.length === 0 ? (
                <p className="text-[12px] text-white/35 col-span-2">暂无成员数据</p>
              ) : (
                memberLoad.slice(0, 4).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => show(`${m.name}：${m.inProgress} 进行中 · ${m.completed} 已完成 · 负荷 ${m.load}%`)}
                    className="p-3 rounded-2xl bg-black/25 border border-white/[0.06] text-left hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="text-[11px] text-white/40 truncate">{m.name}</div>
                    <div className="text-[18px] font-bold text-white mt-1">{m.inProgress + m.completed} 项</div>
                    <div className="text-[10px] font-mono text-cyan-300/70 mt-0.5">负荷 {m.load}%</div>
                  </button>
                ))
              )}
            </div>
          </GlassCard>

          {/* P4-2：进度燃尽图（按截止日期排序的剩余任务曲线 vs 理想直线） */}
          <GlassCard className="p-5 space-y-3 lg:col-span-2">
            <h3 className="text-[13px] font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-300" />
              进度燃尽
              <span className="text-[10px] font-normal text-white/35">
                {burndown ? `${burndown.total} 个有截止日期的任务 · 已完成 ${burndown.completed}` : '无截止日期任务'}
              </span>
            </h3>
            {burndown ? (
              <div className="space-y-2">
                {/* P8 修复：去掉 preserveAspectRatio="none"（会把圆点横向拉伸成椭圆），
                    改用默认 meet 保持比例；线条占满宽度，圆点保持正圆 */}
                <svg viewBox="0 0 100 44" className="w-full h-36" preserveAspectRatio="xMidYMid meet">
                  {/* 网格线 */}
                  {[0, 1, 2, 3].map((i) => (
                    <line key={i} x1="0" y1={i * 11} x2="100" y2={i * 11} stroke="rgba(255,255,255,0.06)" strokeWidth="0.3" />
                  ))}
                  {/* 理想直线：从 (0, 总量) 到 (100, 0) */}
                  <line x1="0" y1="0" x2="100" y2="44" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" strokeDasharray="2 2" />
                  {/* 实际燃尽曲线 */}
                  <polyline
                    points={burndown.points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {burndown.points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="0.9" fill={p.done ? '#34d399' : '#fbbf24'} />
                  ))}
                </svg>
                <div className="flex items-center justify-between text-[10px] text-white/35">
                  <span>最晚截止：{new Date(burndown.lastDeadline).toLocaleDateString('zh-CN')}</span>
                  <span className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />已完成</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />未完成</span>
                    <span className="flex items-center gap-1"><span className="w-px h-2.5 bg-white/40" />理想进度</span>
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-white/35 py-3">为任务设置截止日期后，将在此显示燃尽曲线</p>
            )}
          </GlassCard>
        </div>
      )}

      {tab === 'risk' && (
        <GlassCard className="p-5 space-y-3">
          <h3 className="text-[13px] font-bold text-white flex items-center gap-2">
            风险清单
            <span className="text-[10px] font-normal text-white/40">基于真实任务自动识别</span>
          </h3>
          {risks.length === 0 ? (
            <p className="text-[12px] text-white/35 py-3">当前没有延期或临近截止的任务 ✓</p>
          ) : (
            <div className="space-y-2">
              {risks.map((r) => (
                <button
                  key={r.title}
                  onClick={() => r.task && createFollowUp(r)}
                  className="w-full text-left p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-rose-400/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-white">{r.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md border ${r.level === '高' ? 'bg-rose-500/15 text-rose-300 border-rose-400/30' : 'bg-amber-500/15 text-amber-300 border-amber-400/30'}`}>{r.level}</span>
                  </div>
                  <p className="text-[11px] text-white/45 mt-1">{r.desc}</p>
                  {r.task && (
                    <span className="text-[10px] text-rose-300/70 mt-1.5 inline-flex items-center gap-1">
                      点击创建跟进任务 <ArrowRight className="w-3 h-3" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {tab === 'team' && (
        <GlassCard className="p-5">
          <h3 className="text-[13px] font-bold text-white mb-3">核心成员负荷</h3>
          {memberLoad.length === 0 ? (
            <p className="text-[12px] text-white/40 py-6 text-center">暂无任务数据，成员负荷将在任务被指派后显示。</p>
          ) : (
            <div className="space-y-2">
              {memberLoad.slice(0, 8).map((m) => (
                <button
                  key={m.id}
                  onClick={() => show(`查看成员：${m.name} · 在办 ${m.inProgress} · 完成 ${m.completed}`)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[12px] text-white/70 hover:text-white"
                >
                  <span className="flex items-center gap-2">
                    {m.avatar && (
                      <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/70">
                        {m.avatar}
                      </span>
                    )}
                    {m.name}
                    <span className="text-[10px] text-white/35">在办 {m.inProgress} · 完成 {m.completed}</span>
                  </span>
                  <span className="font-mono text-emerald-300">{m.load}%</span>
                </button>
              ))}
            </div>
          )}
        </GlassCard>
      )}
      </ViewTransition>

      <LiquidModal
        open={!!selectedModule}
        onClose={() => setSelectedModule(null)}
        title={selectedModule?.name ?? ''}
        subtitle="阶段详情"
        icon={<BarChart3 className="w-5 h-5" />}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setSelectedModule(null)} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">关闭</button>
          </div>
        }
      >
        {selectedModule && (
          <div className="space-y-3 text-[12px] text-white/65">
            <p>当前阶段完成度 <span className="text-emerald-300 font-mono font-bold">{selectedModule.progress}%</span></p>
            <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden border border-white/10">
              <div className={`h-full ${selectedModule.color}`} style={{ width: `${selectedModule.progress}%` }} />
            </div>
            <p>共 {selectedModule.count} 项任务，完成率基于当前工作区真实数据。</p>
          </div>
        )}
      </LiquidModal>
    </div>
  );
};
