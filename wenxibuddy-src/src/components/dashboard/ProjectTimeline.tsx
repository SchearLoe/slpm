import React, { useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LiquidSelect } from '@/components/ui/LiquidSelect';
import { useTasks } from '@/lib/queries';
import { TaskItem } from '@/types';

interface ProjectTimelineProps {
  onSelectTask?: (taskId: string) => void;
}

type Scale = '周' | '双周' | '月';

const DAY_MS = 86400000;

/** 把日期算成距 minDate 的天数 */
function dayIndex(dateStr: string, origin: number): number {
  return Math.floor((new Date(dateStr).getTime() - origin) / DAY_MS);
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth()+1}.${d.getDate()}`;
}

export const ProjectTimeline: React.FC<ProjectTimelineProps> = ({ onSelectTask }) => {
  const { data: tasks = [] } = useTasks();
  const [scale, setScale] = useState<Scale>('周');
  const [windowStart, setWindowStart] = useState(0); // days from origin
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // 计算日期窗口
  const ganttTasks = useMemo(() => {
    return tasks
      .filter((t) => t.startDate || t.deadline)
      .map((t) => ({
        ...t,
        start: t.startDate || t.deadline!,
        end: t.deadline || t.startDate!,
      }));
  }, [tasks]);

  const milestones = useMemo(() => tasks.filter((t) => t.milestone), [tasks]);

  // 自动计算窗口范围
  const { origin, totalDays, windowDays } = useMemo(() => {
    if (ganttTasks.length === 0) return { origin: Date.now(), totalDays: 30, windowDays: 24 };
    const allDates = ganttTasks.flatMap((t) => [new Date(t.start).getTime(), new Date(t.end).getTime()]);
    const min = Math.min(...allDates) - 3 * DAY_MS;
    const max = Math.max(...allDates) + 3 * DAY_MS;
    const total = Math.max(Math.ceil((max - min) / DAY_MS), 14);
    const win = scale === '周' ? 24 : scale === '双周' ? 28 : 31;
    return { origin: min, totalDays: total, windowDays: Math.min(win, total) };
  }, [ganttTasks, scale]);

  const axisCount = windowDays;
  const axis = useMemo(
    () => Array.from({ length: axisCount }, (_, i) => new Date(origin + (windowStart + i) * DAY_MS)),
    [windowStart, axisCount, origin],
  );

  const todayIdx = axis.findIndex(
    (d) => d.toDateString() === new Date().toDateString(),
  );

  const shiftWindow = (dir: -1 | 1) => {
    const step = scale === '周' ? 7 : scale === '双周' ? 14 : 30;
    setWindowStart((s) => Math.max(0, Math.min(totalDays - axisCount, s + dir * step)));
  };

  const jumpToday = () => {
    const todayDayIdx = Math.floor((Date.now() - origin) / DAY_MS);
    setWindowStart(Math.max(0, todayDayIdx - Math.floor(axisCount / 2)));
  };

  if (ganttTasks.length === 0 && milestones.length === 0) {
    return (
      <div className="liquid-glass p-3.5 sm:p-4 overflow-hidden">
        <div className="text-center py-10 text-[12px] text-white/35">
          <Target className="w-6 h-6 mx-auto mb-2 text-white/20" />
          设置任务的开始日期或截止日期后，将在此显示甘特图
        </div>
      </div>
    );
  }

  return (
    <div className="liquid-glass p-3.5 sm:p-4 overflow-hidden">
      <div className="flex items-center justify-between gap-2 pb-3 mb-1 border-b border-white/[0.06] flex-nowrap min-w-0">
        <div className="flex items-center gap-2.5 shrink-0 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <h3 className="text-[13px] font-bold text-white whitespace-nowrap">项目甘特图</h3>
          <div className="hidden sm:flex items-center gap-0.5">
            <button onClick={() => shiftWindow(-1)} className="p-1 rounded-lg text-white/40 hover:text-white" title="向前"><ChevronLeft className="w-3.5 h-3.5" /></button>
            <button onClick={() => shiftWindow(1)} className="p-1 rounded-lg text-white/40 hover:text-white" title="向后"><ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <LiquidSelect variant="pill" value={scale} onChange={(v) => setScale(v as Scale)}
            options={[{value:'周',label:'周视图'},{value:'双周',label:'双周视图'},{value:'月',label:'月视图'}]} />
          <button onClick={jumpToday} className="px-3 py-1 rounded-full text-[11px] font-semibold border bg-emerald-400/15 text-emerald-300 border-emerald-400/30 hover:bg-emerald-400/25 whitespace-nowrap">
            今天
          </button>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-none">
        <div className="min-w-[760px]">
          {/* 日期表头 */}
          <div className="grid items-center text-[11px] pb-2 gap-0" style={{ gridTemplateColumns: `100px repeat(${axisCount}, minmax(0,1fr))` }}>
            <div className="text-white/30 pl-1">任务</div>
            {axis.map((d, i) => {
              const isToday = i === todayIdx;
              return (
                <span key={i} className="flex justify-center">
                  {isToday ? (
                    <span className="w-6 h-6 rounded-full bg-emerald-400 text-[#04120c] font-bold flex items-center justify-center text-[10px]">{d.getDate()}</span>
                  ) : (
                    <span className="text-[10px] font-mono text-white/35">{d.getDate()}</span>
                  )}
                </span>
              );
            })}
          </div>

          {/* 任务行 */}
          <div className="relative space-y-2">
            {todayIdx >= 0 && (
              <div className="absolute top-0 bottom-0 z-20 pointer-events-none"
                style={{ left: `calc(100px + (100% - 100px)*${(todayIdx+0.5)/axisCount})`, width: 1,
                  background: 'linear-gradient(to bottom, rgba(52,211,153,0.95), rgba(52,211,153,0.2), transparent)' }} />
            )}
            <AnimatePresence mode="popLayout">
              {ganttTasks.map((task) => {
                const s = dayIndex(task.start, origin) - windowStart;
                const e = dayIndex(task.end, origin) - windowStart;
                const visible = !(e < 0 || s >= axisCount);
                const left = `${Math.max(0, (s / axisCount) * 100)}%`;
                const width = `${Math.max(4/axisCount*100, ((Math.min(e, axisCount) - Math.max(s, 0)) / axisCount) * 100)}%`;
                return (
                  <motion.div key={task.id} layout initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}
                    className="grid items-center text-[11px] gap-0"
                    style={{ gridTemplateColumns: `100px repeat(${axisCount}, minmax(0,1fr))` }}>
                    <button onClick={() => { setSelectedTaskId(task.id); onSelectTask?.(task.id); }}
                      className="text-white/50 font-medium flex items-center gap-1.5 pr-2 truncate text-left hover:text-white pl-1">
                      {task.milestone ? <Target className="w-2.5 h-2.5 text-amber-400 shrink-0" /> : <span className="w-1 h-1 rounded-full bg-white/35 shrink-0" />}
                      <span className="truncate">{task.title}</span>
                    </button>
                    <div className="relative h-7 rounded-full bg-black/30 border border-white/[0.05]"
                      style={{ gridColumn: `2 / span ${axisCount}` }}>
                      {visible && (
                        <button
                          onClick={() => { setSelectedTaskId(task.id); onSelectTask?.(task.id); }}
                          className={`absolute top-1 bottom-1 rounded-full border px-2.5 flex items-center text-[10px] cursor-pointer overflow-hidden ${
                            task.milestone
                              ? 'bg-amber-400/20 border-amber-400/40 text-amber-300 left-1/2 -translate-x-1/2 w-6'
                              : 'bg-emerald-400/20 border-emerald-400/35 text-emerald-100'
                          } ${selectedTaskId === task.id ? 'ring-1 ring-emerald-300/40' : ''}`}
                          style={task.milestone ? {} : { left, width }}
                          title={`${task.title} · ${fmtDate(task.start)} – ${fmtDate(task.end)}`}>
                          {!task.milestone && <span className="truncate font-medium">{task.title}</span>}
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
              {/* 里程碑菱形标记行 */}
              {milestones.filter(m => !ganttTasks.some(t => t.id === m.id)).map((m) => {
                if (!m.deadline) return null;
                const d = dayIndex(m.deadline, origin) - windowStart;
                if (d < 0 || d >= axisCount) return null;
                return (
                  <motion.div key={`ms-${m.id}`} layout initial={{opacity:0}} animate={{opacity:1}}
                    className="grid items-center text-[11px] gap-0"
                    style={{ gridTemplateColumns: `100px repeat(${axisCount}, minmax(0,1fr))` }}>
                    <button onClick={() => onSelectTask?.(m.id)} className="text-amber-300/70 font-medium flex items-center gap-1.5 truncate text-left hover:text-amber-200 pl-1">
                      <Target className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                      <span className="truncate">{m.title}</span>
                    </button>
                    <div className="relative h-5" style={{ gridColumn: `2 / span ${axisCount}` }}>
                      <div className="absolute top-1/2 -translate-y-1/2 z-10"
                        style={{ left: `calc((100%)*${(d+0.5)/axisCount})`, transform: 'translate(-50%, -50%) rotate(45deg)' }}>
                        <div className="w-3 h-3 bg-amber-400 rounded-sm" />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
