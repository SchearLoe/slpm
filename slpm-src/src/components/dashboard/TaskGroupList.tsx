import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ArrowUpDown, LayoutGrid } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { clsx } from 'clsx';
import { listItemVariants, springSoft } from '@/lib/motion';
import { LiquidSelect } from '@/components/ui/LiquidSelect';
import { useTasks } from '@/lib/queries';

export const TaskGroupList: React.FC = () => {
  const { selectedTask, setSelectedTask, setIsNewTaskOpen } = useApp();
  const { user } = useAuth();
  const { data: tasks = [] } = useTasks();
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'assigned' | 'participated'>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'priority' | 'time'>('priority');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const phases = ['需求评审', '产品设计', '开发实现'] as const;

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    // 用当前登录用户判断，替代原硬编码 'Brandon'
    if (activeFilterTab === 'assigned' && t.assigneeId !== user?.id) return false;
    if (activeFilterTab === 'participated' && t.assigneeId === user?.id) return false;
    return true;
  });

  const tabs = [
    { id: 'all' as const, label: '全部任务' },
    { id: 'assigned' as const, label: '我负责的' },
    { id: 'participated' as const, label: '我参与的' },
  ];

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-2.5 select-none">
      {/* 筛选工具条：永远单行，不换行 */}
      <div className="flex items-center gap-2 flex-nowrap min-w-0 overflow-x-auto pb-0.5 shrink-0">
        <div className="liquid-pill p-1 flex items-center gap-0.5 relative shrink-0 whitespace-nowrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilterTab(tab.id)}
              className={clsx(
                'relative px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors z-10 whitespace-nowrap',
                activeFilterTab === tab.id ? 'text-white' : 'text-white/40 hover:text-white/70'
              )}
            >
              {activeFilterTab === tab.id && (
                <motion.span
                  layoutId="task-filter-pill"
                  className="absolute inset-0 rounded-full bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                  transition={springSoft}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto whitespace-nowrap">
          <LiquidSelect
            variant="pill"
            value={statusFilter}
            onChange={setStatusFilter}
            aria-label="状态筛选"
            options={[
              { value: 'all', label: '状态' },
              { value: '进行中', label: '进行中' },
              { value: '已完成', label: '已完成' },
              { value: '待处理', label: '待处理' },
            ]}
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setSortOrder(sortOrder === 'priority' ? 'time' : 'priority')}
            className="liquid-pill px-2.5 py-1.5 text-[11px] text-white/55 flex items-center gap-1 whitespace-nowrap"
          >
            <ArrowUpDown className="w-3 h-3 shrink-0" />
            <span>{sortOrder === 'priority' ? '优先级' : '时间'}</span>
          </motion.button>
          <motion.button
            whileHover={{ rotate: 8 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setIsNewTaskOpen(true)}
            className="liquid-pill p-1.5 text-white/45 hover:text-white shrink-0"
            title="添加任务"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>

      <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-0.5">
        {phases.map((phase, pi) => {
          const groupTasks = filteredTasks.filter((t) => t.phase === phase);
          const isCollapsed = collapsedGroups[phase];
          const colors = {
            需求评审: { dot: 'bg-emerald-400', badge: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/25' },
            产品设计: { dot: 'bg-sky-400', badge: 'text-sky-300 bg-sky-400/10 border-sky-400/25' },
            开发实现: { dot: 'bg-violet-400', badge: 'text-violet-300 bg-violet-400/10 border-violet-400/25' },
          }[phase];

          return (
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * pi, ...springSoft }}
              className="liquid-glass overflow-hidden !rounded-[18px]"
            >
              <button
                onClick={() => setCollapsedGroups((p) => ({ ...p, [phase]: !p[phase] }))}
                className="w-full flex items-center justify-between px-3 py-2 text-left"
              >
                <span className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} shadow-[0_0_8px_currentColor]`} />
                  <span className="text-[13px] font-bold text-white">{phase}</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono border ${colors.badge}`}>{groupTasks.length}</span>
                </span>
                <motion.span animate={{ rotate: isCollapsed ? -90 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="w-3.5 h-3.5 text-white/35" />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-white/[0.05] divide-y divide-white/[0.04]">
                      {groupTasks.length === 0 && (
                        <div className="px-3 py-3 text-[11px] text-white/30 text-center">暂无任务</div>
                      )}
                      {groupTasks.map((task, ti) => {
                        const selected = selectedTask?.id === task.id;
                        return (
                          <motion.button
                            key={task.id}
                            custom={ti}
                            variants={listItemVariants}
                            initial="hidden"
                            animate="show"
                            whileHover={{ x: 2 }}
                            onClick={() => setSelectedTask(task)}
                            className={clsx(
                              'w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left transition-colors duration-200 relative',
                              selected ? 'bg-emerald-400/[0.08]' : 'hover:bg-white/[0.03]'
                            )}
                          >
                            {selected && (
                              <motion.span
                                layoutId="task-selected-bar"
                                className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                              />
                            )}
                            <div className="min-w-0 flex items-center gap-2">
                              <span className="font-mono text-[10px] text-white/30 shrink-0">{task.id}</span>
                              <span className={clsx('text-[12px] truncate', selected ? 'text-white font-semibold' : 'text-white/70')}>
                                {task.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <StatusBadge type="priority" value={task.priority} />
                              {task.deadline && (
                                <span className="text-[10px] font-mono text-white/30 hidden sm:inline">
                                  {new Date(task.deadline).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                                </span>
                              )}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
