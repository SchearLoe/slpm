import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ArrowUpDown, Plus, Clock, CheckSquare, Square, X, AlertTriangle } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { clsx } from 'clsx';
import { listItemVariants, springSoft } from '@/lib/motion';
import { LiquidSelect } from '@/components/ui/LiquidSelect';
import { useTasks, useUpdateTask, useTags, useBatchTasks, type BatchAction } from '@/lib/queries';
import { apiError } from '@/lib/api';
import { getRoleConfig } from '@/lib/roleConfig';
import { tagColorClass } from '@/lib/tagColors';
import { SkeletonRows } from '@/components/ui/Skeleton';

export const TaskGroupList: React.FC = () => {
  const { selectedTask, setSelectedTask, setIsNewTaskOpen, currentRole } = useApp();
  const { user } = useAuth();
  const { show, ToastEl } = useToast();
  const { data: tasks = [], isLoading } = useTasks();
  const { data: tags = [] } = useTags();
  const updateTask = useUpdateTask();
  const batchTasks = useBatchTasks();
  // P6-E3：筛选状态持久化到 URL query（刷新/分享链接保持筛选）
  const [searchParams, setSearchParams] = useSearchParams();
  // P2-1：默认筛选按角色
  const roleCfg = getRoleConfig(currentRole);
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'assigned' | 'participated' | 'phase-qa'>(
    (searchParams.get('tab') as 'all' | 'assigned' | 'participated' | 'phase-qa') || roleCfg.defaultTaskFilter,
  );
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [tagFilter, setTagFilter] = useState(searchParams.get('tag') || 'all');
  const [sortOrder, setSortOrder] = useState<'priority' | 'time'>('priority');
  // 筛选变化时同步到 URL（防抖式：仅记录非默认值，保持 URL 简洁）
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const setOrDel = (key: string, val: string, def: string) => {
      if (val && val !== def) next.set(key, val);
      else next.delete(key);
    };
    setOrDel('tab', activeFilterTab, roleCfg.defaultTaskFilter);
    setOrDel('status', statusFilter, 'all');
    setOrDel('tag', tagFilter, 'all');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilterTab, statusFilter, tagFilter]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  // P4-2：看板拖拽（改阶段）
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverPhase, setDragOverPhase] = useState<string | null>(null);
  // P6-D：批量选择
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // P8：批量删除二次确认（替代原生 confirm）
  const [pendingBatchDelete, setPendingBatchDelete] = useState(false);
  // P8：操作后高亮反馈 —— 刚移动/新建的任务闪一下 emerald 边框，帮用户在长列表里快速定位
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const flashHighlight = (id: string) => {
    setHighlightId(id);
    setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 1600);
  };

  // P8 修复：补全"测试验证"阶段（原只渲染 3 列，导致该阶段任务在看板里完全不可见）
  const phases = ['需求评审', '产品设计', '开发实现', '测试验证'] as const;
  // P6-E8：看板列 WIP 限制提示阈值（进行中任务数超过此值高亮警示）
  const WIP_WARN_THRESHOLD = 6;

  // P4-2：拖放到目标阶段组 → 真实更新任务阶段
  const handleDrop = async (phase: string) => {
    const taskId = dragTaskId;
    setDragTaskId(null);
    setDragOverPhase(null);
    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.phase === phase) return;
    try {
      await updateTask.mutateAsync({ id: taskId, phase: phase as typeof task.phase });
      show(`「${task.title}」已移至${phase}`);
      flashHighlight(taskId);
    } catch (err) {
      show(apiError(err, '移动失败'));
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (tagFilter !== 'all' && !(t.tags ?? []).includes(tagFilter)) return false;
    if (activeFilterTab === 'assigned' && t.assigneeId !== user?.id) return false;
    if (activeFilterTab === 'participated' && t.assigneeId === user?.id) return false;
    if (activeFilterTab === 'phase-qa' && t.phase !== '测试验证') return false;
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  // P6-D：执行批量操作
  const runBatch = async (action: BatchAction, payload?: Record<string, unknown>) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const label: Record<BatchAction, string> = {
      setStatus: '更新状态',
      setPriority: '更新优先级',
      setAssignee: '指派',
      setPhase: '移动阶段',
      delete: '删除',
    };
    // P8：批量删除改用 ConfirmDialog（替代原生 confirm）
    if (action === 'delete') {
      setPendingBatchDelete(true);
      return;
    }
    try {
      const r = await batchTasks.mutateAsync({ ids, action, ...payload });
      show(`已${label[action]} ${r.affected} 个任务`);
      exitSelectMode();
    } catch (err) {
      show(apiError(err, '批量操作失败'));
    }
  };
  // P8：批量删除确认后执行
  const confirmBatchDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    try {
      const r = await batchTasks.mutateAsync({ ids, action: 'delete' });
      show(`已删除 ${r.affected} 个任务`);
      exitSelectMode();
    } catch (err) {
      show(apiError(err, '批量删除失败'));
    }
  };

  const tabs = [
    { id: 'all' as const, label: '全部任务' },
    { id: 'assigned' as const, label: '我负责的' },
    { id: 'participated' as const, label: '我参与的' },
    { id: 'phase-qa' as const, label: '测试验证' },
  ];

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-2.5 select-none">
      {ToastEl}
      {/* P8：批量删除二次确认 */}
      <ConfirmDialog
        open={pendingBatchDelete}
        onClose={() => setPendingBatchDelete(false)}
        onConfirm={confirmBatchDelete}
        variant="danger"
        title={`批量删除 ${selectedIds.size} 个任务？`}
        description="被删除的任务及其评论、活动记录将一并清除，该操作不可恢复。"
        confirmText="确认删除"
      />
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
          {/* P6-A：标签筛选 */}
          {tags.length > 0 && (
            <LiquidSelect
              variant="pill"
              value={tagFilter}
              onChange={setTagFilter}
              aria-label="标签筛选"
              options={[{ value: 'all', label: '全部标签' }, ...tags.map((t) => ({ value: t.name, label: t.name }))]}
            />
          )}
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
          {/* P6-D：批量选择切换 */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            className={clsx(
              'liquid-pill px-2.5 py-1.5 text-[11px] flex items-center gap-1 whitespace-nowrap',
              selectMode ? 'text-emerald-300 ring-1 ring-emerald-400/40' : 'text-white/45 hover:text-white',
            )}
            title="批量操作"
          >
            {selectMode ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            <span>{selectMode ? `已选 ${selectedIds.size}` : '批量'}</span>
          </motion.button>
          <motion.button
            whileHover={{ rotate: 8 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setIsNewTaskOpen(true)}
            className="liquid-pill p-1.5 text-white/45 hover:text-white shrink-0"
            title="添加任务"
          >
            <Plus className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>

      {/* P6-D：批量操作工具条 */}
      <AnimatePresence>
        {selectMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden shrink-0"
          >
            <div className="flex items-center gap-2 flex-wrap px-2.5 py-2 rounded-xl bg-emerald-500/[0.06] border border-emerald-400/20">
              <span className="text-[11px] text-emerald-200 font-semibold">已选 {selectedIds.size} 项</span>
              <div className="flex items-center gap-1.5 ml-auto">
                <BatchBtn label="完成" onClick={() => runBatch('setStatus', { status: '已完成' })} />
                <BatchBtn label="进行中" onClick={() => runBatch('setStatus', { status: '进行中' })} />
                <BatchBtn label="高优" onClick={() => runBatch('setPriority', { priority: '高' })} />
                {/* P9-UX3：批量指派给我（原 setAssignee 已接入但 UI 缺失，现在补上） */}
                <BatchBtn label="指派给我" onClick={() => runBatch('setAssignee', { assigneeId: user?.id })} />
                <BatchBtn label="删除" danger onClick={() => runBatch('delete')} />
                <button onClick={exitSelectMode} className="liquid-btn-ghost w-7 h-7 rounded-md flex items-center justify-center text-white/50 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-0.5">
        {/* P9-UX：加载中显示骨架屏，避免四列看板全显示「暂无任务」的假空态 */}
        {isLoading ? (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            {phases.map((p) => (
              <div key={p} className="liquid-glass rounded-[18px] p-3">
                <SkeletonRows rows={3} />
              </div>
            ))}
          </div>
        ) : (
        <>{phases.map((phase, pi) => {
          const groupTasks = filteredTasks.filter((t) => t.phase === phase);
          const isCollapsed = collapsedGroups[phase];
          // P4-2：阶段工时小计（真实预估工时汇总）
          const groupHours = groupTasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0);
          // P6-E8：WIP 限制——统计「进行中」状态任务数（已完成的占列不警示）
          const activeInGroup = groupTasks.filter((t) => t.status === '进行中' || t.status === '待处理').length;
          const wipWarn = activeInGroup > WIP_WARN_THRESHOLD;
          const isDragOver = dragOverPhase === phase;
          const colors = {
            需求评审: { dot: 'bg-emerald-400', badge: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/25' },
            产品设计: { dot: 'bg-sky-400', badge: 'text-sky-300 bg-sky-400/10 border-sky-400/25' },
            开发实现: { dot: 'bg-violet-400', badge: 'text-violet-300 bg-violet-400/10 border-violet-400/25' },
            测试验证: { dot: 'bg-amber-400', badge: 'text-amber-300 bg-amber-400/10 border-amber-400/25' },
          }[phase];

          return (
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * pi, ...springSoft }}
              onDragOver={(e) => {
                if (!dragTaskId) return;
                e.preventDefault();
                setDragOverPhase(phase);
              }}
              onDragLeave={() => setDragOverPhase((p) => (p === phase ? null : p))}
              onDrop={() => handleDrop(phase)}
              className={clsx(
                'liquid-glass overflow-hidden !rounded-[18px] transition-colors',
                isDragOver && 'ring-2 ring-emerald-400/60 bg-emerald-400/[0.06]'
              )}
            >
              <button
                onClick={() => setCollapsedGroups((p) => ({ ...p, [phase]: !p[phase] }))}
                className="w-full flex items-center justify-between px-3 py-2 text-left"
              >
                <span className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} shadow-[0_0_8px_currentColor]`} />
                  <span className="text-[13px] font-bold text-white">{phase}</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono border ${colors.badge}`}>{groupTasks.length}</span>
                  {groupHours > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] font-mono text-white/35" title="预估工时小计">
                      <Clock className="w-2.5 h-2.5" />{groupHours}h
                    </span>
                  )}
                  {/* P6-E8：WIP 超限警示 */}
                  {wipWarn && (
                    <span className="flex items-center gap-0.5 text-[10px] font-mono text-amber-300" title={`进行中任务 ${activeInGroup} 个，建议控制 WIP`}>
                      <AlertTriangle className="w-2.5 h-2.5" />{activeInGroup}
                    </span>
                  )}
                </span>
                {selectMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const allIn = groupTasks.every((t) => selectedIds.has(t.id));
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        groupTasks.forEach((t) => (allIn ? next.delete(t.id) : next.add(t.id)));
                        return next;
                      });
                    }}
                    className="liquid-btn-ghost px-2 py-0.5 rounded-md text-[10px] text-white/50 hover:text-white mr-2"
                  >
                    {groupTasks.length > 0 && groupTasks.every((t) => selectedIds.has(t.id)) ? '取消全选' : '全选'}
                  </button>
                )}
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
                        const checked = selectedIds.has(task.id);
                        return (
                          <motion.div
                            key={task.id}
                            custom={ti}
                            variants={listItemVariants}
                            initial="hidden"
                            animate="show"
                            draggable={!selectMode}
                            onDragStart={(e) => {
                              if (selectMode) return;
                              const dt = (e as unknown as React.DragEvent<HTMLDivElement>).dataTransfer;
                              setDragTaskId(task.id);
                              dt?.setData('text/plain', task.id);
                              if (dt) dt.effectAllowed = 'move';
                            }}
                            onDragEnd={() => {
                              setDragTaskId(null);
                              setDragOverPhase(null);
                            }}
                            onClick={() => (selectMode ? toggleSelect(task.id) : setSelectedTask(task))}
                            className={clsx(
                              'w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left transition-colors duration-200 relative cursor-pointer',
                              selected ? 'bg-emerald-400/[0.08]' : 'hover:bg-white/[0.03]',
                              dragTaskId === task.id && 'opacity-40',
                              checked && 'bg-emerald-400/[0.05]',
                              highlightId === task.id && 'ring-1 ring-emerald-400/60 bg-emerald-400/[0.07]'
                            )}
                          >
                            {selected && !selectMode && (
                              <motion.span
                                layoutId="task-selected-bar"
                                className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                              />
                            )}
                            {selectMode && (
                              <span className={clsx('shrink-0', checked ? 'text-emerald-300' : 'text-white/30')}>
                                {checked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                              </span>
                            )}
                            <div className="min-w-0 flex flex-col gap-0.5 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] text-white/30 shrink-0">{task.id}</span>
                                <span className={clsx('text-[12px] truncate', selected ? 'text-white font-semibold' : 'text-white/70')}>
                                  {task.title}
                                </span>
                              </div>
                              {/* P6-A：任务卡片标签 chips */}
                              {(task.tags ?? []).length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  {(task.tags ?? []).slice(0, 4).map((tn) => {
                                    const tag = tags.find((x) => x.name === tn);
                                    return (
                                      <span key={tn} className={clsx('inline-flex items-center px-1.5 py-0 rounded text-[9px] border', tagColorClass(tag?.color))}>
                                        {tn}
                                      </span>
                                    );
                                  })}
                                  {(task.tags ?? []).length > 4 && (
                                    <span className="text-[9px] text-white/30">+{task.tags.length - 4}</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {task.estimatedHours ? (
                                <span className="text-[10px] font-mono text-white/25 hidden sm:inline">{task.estimatedHours}h</span>
                              ) : null}
                              <StatusBadge type="priority" value={task.priority} />
                              {task.deadline && (
                                <span className="text-[10px] font-mono text-white/30 hidden sm:inline">
                                  {new Date(task.deadline).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                                </span>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}</>
        )}
      </div>
    </div>
  );
};

// 批量操作按钮
const BatchBtn: React.FC<{ label: string; onClick: () => void; danger?: boolean }> = ({ label, onClick, danger }) => (
  <button
    onClick={onClick}
    className={clsx(
      'px-2.5 py-1 rounded-md text-[11px] border transition-colors',
      danger
        ? 'bg-rose-500/10 border-rose-400/30 text-rose-300 hover:bg-rose-500/20'
        : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10',
    )}
  >
    {label}
  </button>
);

