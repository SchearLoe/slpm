import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, CheckCircle2, AlertTriangle, Users, Zap, ShieldCheck, PieChart, ArrowRight, Info } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { LiquidModal } from '@/components/ui/LiquidModal';
import { useToast } from '@/components/ui/Toast';
import { springSoft } from '@/lib/motion';
import { ViewTransition } from '@/components/ui/PageTransition';
import { useTasks } from '@/lib/queries';
import { computeOverview, computeMemberLoad, OverviewStats } from '@/lib/aggregations';

// 阶段 → 展示用的进度条颜色（与原 modules 视觉风格保持一致）
const PHASE_COLOR: Record<string, string> = {
  需求评审: 'bg-emerald-500',
  产品设计: 'bg-teal-400',
  开发实现: 'bg-cyan-400',
  测试验证: 'bg-indigo-400',
};

// 【演示】数据标签：无真实数据源的指标明确标注，避免误导
function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/10 text-white/50 text-[9px] font-semibold align-middle">
      演示
    </span>
  );
}

export const ProjectOverviewPage: React.FC = () => {
  const { show, ToastEl } = useToast();
  const { data: tasks = [] } = useTasks();
  const stats: OverviewStats = useMemo(() => computeOverview(tasks), [tasks]);
  const memberLoad = useMemo(() => computeMemberLoad(tasks), [tasks]);

  const [selectedModule, setSelectedModule] = useState<{ name: string; progress: number; color: string } | null>(null);
  const [tab, setTab] = useState<'health' | 'risk' | 'team'>('health');

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

  return (
    <div className="w-full min-h-full space-y-4 pb-4">
      {ToastEl}

      {/* 数据来源说明 */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[11px] text-white/50">
        <Info className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
        <span>
          以下指标基于真实任务数据聚合（里程碑、阻塞点、模块进度、成员负荷）；标注
          <DemoBadge /> 的项需接入外部数据源（代码托管 / 测试平台），当前为演示。
        </span>
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
              SLPM 旗舰版
            </div>
            <h2 className="text-[22px] font-extrabold text-white tracking-tight flex items-center gap-2 flex-wrap">
              任务总览 <DemoBadge />
              <span className="text-white/50 text-[14px] font-medium">
                共 {stats.total} 项 · 已完成 {stats.completed} · 进行中 {stats.inProgress}
              </span>
            </h2>
            <p className="text-[12px] text-white/50 max-w-xl leading-relaxed flex items-center gap-1 flex-wrap">
              原健康度 / 需求收敛率 / 测试通过率为
              <DemoBadge />
              数据，需接入测试与需求平台。当前真实完成度见右侧。
            </p>
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
            >
              Q2
            </motion.div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { title: '任务完成', value: `${stats.completed} / ${stats.total}`, tip: `完成率 ${stats.completionRate}%`, icon: CheckCircle2, color: 'text-emerald-300', demo: false },
          { title: '研发代码提交', value: '1,248', tip: '较上周 +18%', icon: Zap, color: 'text-cyan-300', demo: true },
          { title: '团队平均负荷', value: `${memberLoad.length ? Math.round(memberLoad.reduce((s, m) => s + m.load, 0) / memberLoad.length) : 0}%`, tip: '基于在办任务归一化', icon: Users, color: 'text-violet-300', demo: false },
          { title: '潜在阻塞点', value: `${stats.blockedCount} 项`, tip: `${stats.overdue} 延期 / ${stats.pending} 待处理`, icon: AlertTriangle, color: 'text-rose-300', demo: false },
        ].map((c, i) => (
          <motion.button
            key={c.title}
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, ...springSoft }}
            whileHover={{ y: -2 }}
            onClick={() => show(`已打开：${c.title}`)}
            className="liquid-glass liquid-glass-hover p-4 text-left space-y-2"
          >
            <div className="flex items-center justify-between text-[11px] text-white/40">
              <span className="flex items-center gap-1">
                {c.title}
                {c.demo && <DemoBadge />}
              </span>
              <c.icon className={`w-4 h-4 ${c.color}`} />
            </div>
            <div className="text-[22px] font-extrabold text-white">{c.value}</div>
            <div className={`text-[11px] font-medium ${c.color}`}>{c.tip}</div>
          </motion.button>
        ))}
      </div>

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
              团队资源投入占比 <DemoBadge />
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { role: '前端研发', count: '6 人', ratio: '35%', ring: 'border-emerald-400/50 text-emerald-200' },
                { role: '后端与云架构', count: '5 人', ratio: '29%', ring: 'border-cyan-400/50 text-cyan-200' },
                { role: 'AI 算法专家', count: '3 人', ratio: '18%', ring: 'border-violet-400/50 text-violet-200' },
                { role: 'UI/UX 体验设计', count: '3 人', ratio: '18%', ring: 'border-amber-400/50 text-amber-200' },
              ].map((r) => (
                <button
                  key={r.role}
                  onClick={() => show(`${r.role}：${r.count} · 占比 ${r.ratio}`)}
                  className={`p-3 rounded-2xl bg-black/25 border text-left hover:bg-white/[0.04] transition-colors ${r.ring}`}
                >
                  <div className="text-[11px] text-white/40">{r.role}</div>
                  <div className="text-[18px] font-bold text-white mt-1">{r.count}</div>
                  <div className="text-[10px] font-mono opacity-80 mt-0.5">占比 {r.ratio}</div>
                </button>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {tab === 'risk' && (
        <GlassCard className="p-5 space-y-3">
          <h3 className="text-[13px] font-bold text-white flex items-center gap-2">
            风险清单 <DemoBadge />
          </h3>
          {[
            { title: '需求范围蔓延', level: '高', desc: 'WXB-2025-001 新增 4 项次要功能' },
            { title: '设计交付时延', level: '中', desc: '原型评审节点可能延后 0.5 天' },
          ].map((r) => (
            <button
              key={r.title}
              onClick={() => show(`已创建风险跟进：${r.title}`)}
              className="w-full text-left p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-rose-400/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-white">{r.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-400/30">{r.level}</span>
              </div>
              <p className="text-[11px] text-white/45 mt-1">{r.desc}</p>
            </button>
          ))}
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
            <button
              onClick={() => {
                show(`已订阅阶段进度：${selectedModule?.name}`);
                setSelectedModule(null);
              }}
              className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold"
            >
              订阅进度
            </button>
          </div>
        }
      >
        {selectedModule && (
          <div className="space-y-3 text-[12px] text-white/65">
            <p>当前阶段完成度 <span className="text-emerald-300 font-mono font-bold">{selectedModule.progress}%</span></p>
            <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden border border-white/10">
              <div className={`h-full ${selectedModule.color}`} style={{ width: `${selectedModule.progress}%` }} />
            </div>
            <p>点击「订阅进度」后，该阶段变更将推送到消息中心。</p>
          </div>
        )}
      </LiquidModal>
    </div>
  );
};
