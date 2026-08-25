import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, Activity, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useTasks } from '@/lib/queries';
import { springSoft } from '@/lib/motion';
import { LiquidModal } from '@/components/ui/LiquidModal';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';

export const KPICardsRow: React.FC<{ onCardClick?: (t: string) => void }> = ({ onCardClick }) => {
  const { setSelectedTask, setIsNewTaskOpen } = useApp();
  const { user } = useAuth();
  const { data: tasks = [], isLoading } = useTasks();
  const [open, setOpen] = useState<string | null>(null);

  // P9-UX：加载中显示骨架屏，避免四个 KPI 全显示 0 误导用户以为工作区为空
  if (isLoading) {
    return <SkeletonCards cards={4} className="kpi-row" />;
  }

  // 真实计数：从后端任务聚合（替代原 demo 写死的 12/28/56/3）
  const liveCompleted = tasks.filter((t) => t.status === '已完成').length;
  const liveInProgress = tasks.filter((t) => t.status === '进行中').length;
  const livePending = tasks.filter((t) => t.status === '待处理').length;
  const liveOverdue = tasks.filter((t) => t.status === '已延期').length;

  const cards = [
    { title: '今日待办', count: livePending, unit: '项任务', tip: '待处理', delta: `共 ${livePending} 项`, up: true, icon: ClipboardList, overdue: false },
    { title: '进行中', count: liveInProgress, unit: '项任务', tip: '进行中', delta: `共 ${liveInProgress} 项`, up: true, icon: Activity, overdue: false },
    { title: '已完成', count: liveCompleted, unit: '项任务', tip: '已完成', delta: `共 ${liveCompleted} 项`, up: true, icon: CheckCircle2, overdue: false },
    { title: '逾期任务', count: liveOverdue, unit: '项任务', tip: '已延期', delta: `共 ${liveOverdue} 项`, up: false, icon: AlertCircle, overdue: true },
  ];

  const list =
    open === '今日待办'
      ? tasks.filter((t) => t.status === '待处理')
      : open === '进行中'
        ? tasks.filter((t) => t.status === '进行中')
        : open === '已完成'
          ? tasks.filter((t) => t.status === '已完成')
          : open === '逾期任务'
            ? tasks.filter((t) => t.status === '已延期')
            : [];

  return (
    <>
      <div className="kpi-row">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.button
              key={card.title}
              type="button"
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...springSoft, delay: i * 0.05 }}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.985 }}
              onClick={() => {
                onCardClick?.(card.title);
                setOpen(card.title);
              }}
              className={`liquid-glass text-left p-3.5 flex items-center justify-between gap-3 min-h-[88px] ${
                card.overdue ? 'shadow-[0_0_28px_rgba(244,63,94,0.12)]' : ''
              }`}
            >
              <div className="min-w-0 space-y-1">
                <div className="text-[12px] text-white/45 font-medium">{card.title}</div>
                <div className="flex items-baseline gap-1.5">
                  <AnimatedNumber
                    value={card.count}
                    duration={0.8}
                    className="text-[28px] font-extrabold text-white leading-none tracking-tight tabular-nums"
                  />
                  <span className="text-[11px] text-white/35">{card.unit}</span>
                </div>
                <div className="text-[11px] flex items-center gap-1 pt-0.5">
                  <span className="text-white/30">{card.tip}</span>
                  <span className={card.up ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>{card.delta}</span>
                </div>
              </div>

              <motion.div
                whileHover={{ rotate: card.overdue ? -8 : 6, scale: 1.05 }}
                className={`liquid-icon-well w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  card.overdue ? 'text-rose-400 border-rose-400/30 shadow-[0_0_18px_rgba(244,63,94,0.25)]' : 'text-white/75'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={1.6} />
              </motion.div>
            </motion.button>
          );
        })}
      </div>

      <LiquidModal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ?? ''}
        subtitle="点击任务可定位到智能详情"
        icon={<Activity className="w-5 h-5" />}
        footer={
          <div className="flex justify-end">
            <button onClick={() => setOpen(null)} className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold">关闭</button>
          </div>
        }
      >
        <div className="space-y-2 max-h-[360px] overflow-y-auto">
          {list.length === 0 && (
            <EmptyState
              compact
              icon={<ClipboardList className="w-6 h-6" />}
              title="当前列表为空"
              description="这里还没有对应状态的任务，去任务页创建第一个吧"
              action={{ label: '新建任务', onClick: () => { setOpen(null); setIsNewTaskOpen(true); } }}
            />
          )}
          {list.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setSelectedTask(t);
                setOpen(null);
              }}
              className="w-full text-left p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-emerald-400/25"
            >
              <div className="text-[12px] font-semibold text-white">{t.title}</div>
              <div className="text-[10px] font-mono text-white/35 mt-1">{t.id} · {t.status} · {t.priority}</div>
            </button>
          ))}
        </div>
      </LiquidModal>
    </>
  );
};
