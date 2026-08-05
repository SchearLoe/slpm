import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Search,
  Calendar,
  Edit3,
  MoreHorizontal,
  ArrowUpRight,
  ShieldCheck,
  Check,
  MessageSquare,
  Activity as ActivityIcon,
  Send,
  Trash2,
  Pencil,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { springSoft } from '@/lib/motion';
import { LiquidModal } from '@/components/ui/LiquidModal';
import { Avatar } from '@/components/ui/Avatar';
import { TaskChecklist } from '@/components/dashboard/TaskChecklist';
import { useCompleteTask, useUpdateTask, useComments, useCreateComment, useUpdateComment, useDeleteComment, useTaskActivity, streamAiSuggest } from '@/lib/queries';
import { apiError } from '@/lib/api';
import confetti from 'canvas-confetti';

// P1-1：相对时间（如「3 分钟前」「昨天」），无新依赖
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / min)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

// P1-1：把评论正文里的 @姓名 渲染为高亮 span
function renderCommentBody(body: string): React.ReactNode {
  const parts = body.split(/(@[\u4e00-\u9fa5A-Za-z0-9_]+)/g);
  return parts.map((p, i) =>
    p.startsWith('@') ? (
      <span key={i} className="text-emerald-300 font-medium">
        {p}
      </span>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    ),
  );
}

export const AISmartDetailPanel: React.FC = () => {
  const { selectedTask, setSelectedTask, setEditingTask, enableConfetti, currentRole } = useApp();
  const { user } = useAuth();
  const completeTask = useCompleteTask();
  const updateTask = useUpdateTask();
  // P1-1：评论 / 活动流（task 可能 undefined，hooks 内部用 enabled 守卫）
  const commentsQ = useComments(selectedTask?.id);
  const createComment = useCreateComment(selectedTask?.id);
  const updateComment = useUpdateComment(selectedTask?.id);
  const deleteComment = useDeleteComment(selectedTask?.id);
  const activityQ = useTaskActivity(selectedTask?.id);
  const [commentDraft, setCommentDraft] = useState('');
  // P6-E2：评论编辑状态
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentDraft, setEditCommentDraft] = useState('');
  const [showAiDetail, setShowAiDetail] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [toast, setToast] = useState('');
  // P1-5：流式 AI 建议（逐 token 增量渲染）
  const [aiCache, setAiCache] = useState<{ taskId: string; fullText: string; suggestions: string[]; confidence: number } | null>(null);
  const [aiStreaming, setAiStreaming] = useState(false);
  const aiAbortRef = React.useRef<AbortController | null>(null);
  const task = selectedTask;

  if (!task) {
    return (
      <div className="liquid-glass h-full p-5 flex items-center justify-center text-[12px] text-white/35">
        选择左侧任务以查看智能详情
      </div>
    );
  }

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2000);
  };

  // P1-5：流式拉取 AI 建议（逐 token 实时展示）
  const fetchAi = async () => {
    if (!task) return;
    if (aiStreaming) return; // 防止重复点击
    // 缓存命中不重复调用
    if (aiCache?.taskId === task.id && aiCache.suggestions.length > 0) return;

    // 取消之前的流
    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;
    setAiStreaming(true);

    // 初始状态（空，边收边填充）
    setAiCache({ taskId: task.id, fullText: '', suggestions: [], confidence: 80 });

    try {
      const result = await streamAiSuggest(
        { title: task.title, description: task.description, phase: task.phase, status: task.status, priority: task.priority },
        (fullText) => {
          // 增量更新：按行切成建议（去掉空行、编号前缀）
          const lines = fullText
            .split('\n')
            .map((s) => s.replace(/^[\d]+[\.\)、]?\s*/, '').trim())
            .filter((s) => s.length > 3);
          setAiCache({ taskId: task.id, fullText, suggestions: lines.slice(0, 5), confidence: 80 });
        },
        controller.signal,
      );
      // 流完成，设置最终置信度
      setAiCache((prev) => (prev ? { ...prev, confidence: result.confidence } : null));
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setAiCache(null);
    } finally {
      setAiStreaming(false);
      aiAbortRef.current = null;
    }
  };

  return (
    <>
      {/* 通高 flex：内容可滚，底部操作条永远贴底 → 与时间线下沿对齐 */}
      <motion.div
        className="liquid-glass h-full min-h-0 p-4 sm:p-5 flex flex-col overflow-hidden relative z-10"
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={springSoft}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -6, filter: 'blur(3px)' }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col h-full min-h-0"
          >
            {/* 可滚动主体 */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-300" />
                  <h3 className="text-[13px] font-bold text-white tracking-wide">智能详情</h3>
                </div>
                <button
                  onClick={() => flash(`已聚焦搜索：${task.id}`)}
                  className="liquid-btn-ghost w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white"
                  title="搜索此任务"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div className="text-[11px] font-mono text-white/35 tracking-wider">{task.id}</div>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-[18px] font-bold text-white tracking-tight leading-snug">{task.title}</h2>
                  <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
                    {task.priority === '高' ? '高优先级' : task.priority}
                  </span>
                </div>
                <p className="text-[12px] text-white/55 leading-relaxed p-3 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
                  {task.description || '暂无详细描述信息。'}
                </p>
              </div>

              <div className="mt-5 space-y-3 text-[12px]">
                <Meta label="负责人">
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full liquid-icon-well text-[9px] font-bold flex items-center justify-center">
                      {task.assignee?.avatar || 'BR'}
                    </span>
                    <span className="text-white/85 font-medium">{task.assignee?.name}</span>
                  </span>
                </Meta>
                <Meta label="所属项目">
                  <span className="flex items-center gap-1.5 text-white/85 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                    {task.project || '我的工作区'}
                  </span>
                </Meta>
                <Meta label="截止时间">
                  <span className="flex items-center gap-1.5 font-mono text-white/70">
                    <Calendar className="w-3.5 h-3.5 text-white/35" />
                    {task.deadline
                      ? new Date(task.deadline).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '未设置'}
                  </span>
                </Meta>
                <Meta label="当前状态">
                  <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {task.status}
                  </span>
                </Meta>
                <Meta label="优先级">
                  <span className="flex items-center gap-1.5 text-rose-300 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    {task.priority}
                  </span>
                </Meta>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-white/35 pt-0.5">标签</span>
                  <div className="flex flex-wrap justify-end gap-1.5 max-w-[210px]">
                    {task.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded-md text-[10px] bg-white/[0.04] border border-white/10 text-white/60">
                        {tag}
                      </span>
                    ))}
                    <button
                      onClick={() => setEditingTask(task)}
                      className="px-1.5 py-0.5 rounded-md border border-dashed border-white/15 text-white/35 text-[10px] hover:text-white"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-5 p-3.5 rounded-2xl bg-black/25 border border-white/[0.07] space-y-2.5 relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-24 h-24 bg-emerald-400/10 blur-2xl rounded-full pointer-events-none" />
                <div className="flex items-center gap-1.5 text-[12px] font-bold text-white relative z-10">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                  AI 助手建议
                </div>
                <ul className="space-y-2 text-[11px] text-white/60 relative z-10">
                  {aiCache && aiCache.taskId === task.id && aiCache.suggestions.length > 0 ? (
                    aiCache.suggestions.map((sug, i) => (
                      <li key={i} className="flex gap-1.5 leading-relaxed">
                        <span className="text-emerald-400">•</span>
                        <span>{sug}</span>
                      </li>
                    ))
                  ) : aiStreaming ? (
                    <li className="text-white/40">AI 分析中…</li>
                  ) : (
                    <li className="text-white/40">点击下方按钮，由 AI 生成任务建议</li>
                  )}
                </ul>
                <button
                  onClick={() => {
                    setShowAiDetail(true);
                    fetchAi();
                  }}
                  className="w-full mt-1 py-2 rounded-xl liquid-btn-ghost text-[11px] font-medium text-white/70 flex items-center justify-center gap-1 relative z-10"
                >
                  查看建议详情
                  <ArrowUpRight className="w-3.5 h-3.5 text-white/35" />
                </button>
              </div>

              {/* P1-1：活动流（评论 + 任务变更合并，时间倒序） */}
              {/* P6-B：任务清单（Checklist，可勾选子项 + 完成度） */}
              <TaskChecklist taskId={task.id} />

              <div className="mt-3 p-3.5 rounded-2xl bg-black/25 border border-white/[0.07] space-y-2.5">
                <div className="flex items-center gap-1.5 text-[12px] font-bold text-white">
                  <ActivityIcon className="w-3.5 h-3.5 text-emerald-300" />
                  活动流
                  {activityQ.data && activityQ.data.length > 0 && (
                    <span className="text-[10px] text-white/35 font-normal">{activityQ.data.length}</span>
                  )}
                </div>
                {activityQ.isLoading ? (
                  <div className="text-[11px] text-white/35 py-2">加载中…</div>
                ) : activityQ.data && activityQ.data.length > 0 ? (
                  <ul className="space-y-2 relative z-10">
                    {activityQ.data.slice(0, 8).map((a) => (
                      <li key={`${a.kind}-${a.id}`} className="flex gap-2 text-[11px] leading-relaxed">
                        <Avatar avatar={a.actor.avatar} name={a.actor.name} size="xs" />
                        <div className="min-w-0 flex-1">
                          <span className="text-white/80 font-medium">{a.actor.name}</span>{' '}
                          <span className="text-white/55">{a.action}</span>
                          {a.detail && <span className="text-white/45"> · {a.detail}</span>}
                          {a.kind === 'comment' && a.body && (
                            <span className="text-white/65">：{renderCommentBody(a.body)}</span>
                          )}
                          <span className="text-white/30 ml-1.5">{timeAgo(a.createdAt)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-[11px] text-white/30 py-1">暂无活动</div>
                )}
              </div>

              {/* P1-1：评论 */}
              <div className="mt-3 p-3.5 rounded-2xl bg-black/25 border border-white/[0.07] space-y-2.5">
                <div className="flex items-center gap-1.5 text-[12px] font-bold text-white">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-300" />
                  评论
                  {commentsQ.data && commentsQ.data.length > 0 && (
                    <span className="text-[10px] text-white/35 font-normal">{commentsQ.data.length}</span>
                  )}
                </div>

                {commentsQ.data && commentsQ.data.length > 0 ? (
                  <ul className="space-y-2.5">
                    {commentsQ.data.map((c) => {
                      const isAuthor = c.author.id === user?.id;
                      const canModerate = currentRole === 'admin' || currentRole === 'pm';
                      const isEditing = editingCommentId === c.id;
                      return (
                        <li key={c.id} className="flex gap-2 group">
                          <Avatar avatar={c.author.avatar} name={c.author.name} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-[11px] font-medium text-white/85">{c.author.name}</span>
                              <span className="text-[10px] text-white/30">{timeAgo(c.createdAt)}</span>
                              {/* P6-E2：编辑/删除（仅作者或 admin/pm） */}
                              {(isAuthor || canModerate) && !isEditing && (
                                <span className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {isAuthor && (
                                    <button
                                      onClick={() => {
                                        setEditingCommentId(c.id);
                                        setEditCommentDraft(c.body);
                                      }}
                                      className="text-white/35 hover:text-white"
                                      title="编辑"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      if (confirm('删除这条评论？')) deleteComment.mutate(c.id);
                                    }}
                                    className="text-rose-300/50 hover:text-rose-300"
                                    title="删除"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </span>
                              )}
                            </div>
                            {isEditing ? (
                              <div className="mt-0.5 space-y-1">
                                <textarea
                                  className="w-full resize-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-[11px] text-white/80 outline-none focus:border-emerald-400/40"
                                  value={editCommentDraft}
                                  onChange={(e) => setEditCommentDraft(e.target.value)}
                                  rows={2}
                                  autoFocus
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      const body = editCommentDraft.trim();
                                      if (!body) return;
                                      updateComment.mutate(
                                        { commentId: c.id, body },
                                        {
                                          onSuccess: () => {
                                            setEditingCommentId(null);
                                            flash('评论已更新');
                                          },
                                          onError: (err) => flash(apiError(err, '更新失败')),
                                        },
                                      );
                                    }}
                                    disabled={!editCommentDraft.trim() || updateComment.isPending}
                                    className="liquid-btn-primary px-2 py-0.5 rounded-md text-[10px] disabled:opacity-40"
                                  >
                                    保存
                                  </button>
                                  <button
                                    onClick={() => setEditingCommentId(null)}
                                    className="liquid-btn-ghost px-2 py-0.5 rounded-md text-[10px] text-white/50"
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[11px] text-white/65 leading-relaxed break-words mt-0.5">
                                {renderCommentBody(c.body)}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  !commentsQ.isLoading && (
                    <div className="text-[11px] text-white/30 py-1">还没有评论，说点什么吧</div>
                  )
                )}

                {/* 评论输入框 */}
                <div className="flex gap-2 pt-1 border-t border-white/[0.05]">
                  <Avatar avatar={user?.avatar} name={user?.name ?? '?'} size="sm" className="mt-0.5" />
                  <textarea
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter 发送 / Shift+Enter 换行
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        const body = commentDraft.trim();
                        if (!body || createComment.isPending) return;
                        createComment.mutate(body, {
                          onSuccess: () => {
                            setCommentDraft('');
                            flash('评论已发送');
                          },
                          onError: (err) => flash(apiError(err, '发送失败')),
                        });
                      }
                    }}
                    rows={2}
                    placeholder="发表评论…（Enter 发送，Shift+Enter 换行，@姓名 可提及）"
                    className="flex-1 min-w-0 resize-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-2.5 py-1.5 text-[11px] text-white/80 placeholder:text-white/25 focus:outline-none focus:border-emerald-400/40"
                  />
                  <button
                    disabled={!commentDraft.trim() || createComment.isPending}
                    onClick={() => {
                      const body = commentDraft.trim();
                      if (!body || createComment.isPending) return;
                      createComment.mutate(body, {
                        onSuccess: () => {
                          setCommentDraft('');
                          flash('评论已发送');
                        },
                        onError: (err) => flash(apiError(err, '发送失败')),
                      });
                    }}
                    className="shrink-0 w-8 h-8 rounded-xl liquid-btn-primary flex items-center justify-center disabled:opacity-40 self-end"
                    title="发送评论"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* 底部操作条：始终贴底，与项目时间线下沿对齐 */}
            <div className="pt-3 mt-auto border-t border-white/[0.06] flex items-center gap-2 shrink-0 relative z-20">
              <button
                onClick={() => setEditingTask(task)}
                className="flex-1 h-10 rounded-full liquid-btn-ghost text-[12px] font-semibold text-white/80 flex items-center justify-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5 text-white/40" />
                编辑任务
              </button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                disabled={completeTask.isPending}
                onClick={async () => {
                  try {
                    const updated = await completeTask.mutateAsync(task.id);
                    setSelectedTask(updated);
                    flash('任务已标记完成');
                    if (enableConfetti) {
                      confetti({ particleCount: 70, spread: 70, origin: { x: 0.85, y: 0.6 }, colors: ['#34d399', '#6ee7b7', '#a7f3d0', '#ffffff'] });
                    }
                  } catch (err) {
                    flash(apiError(err, '完成失败'));
                  }
                }}
                className="flex-[1.35] h-10 rounded-full liquid-btn-primary text-[12px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <Check className="w-4 h-4 stroke-[2.75]" />
                {completeTask.isPending ? '处理中…' : task.status === '已完成' ? '已完成' : '完成任务'}
              </motion.button>
              <div className="relative">
                <button
                  onClick={() => setShowMore((v) => !v)}
                  className="w-10 h-10 rounded-full liquid-btn-ghost flex items-center justify-center text-white/40 hover:text-white"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                <AnimatePresence>
                  {showMore && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.96 }}
                      className="absolute bottom-full right-0 mb-2 w-40 p-1.5 liquid-glass z-30 space-y-0.5"
                    >
                      {[
                        {
                          label: '复制任务 ID',
                          action: () => {
                            navigator.clipboard?.writeText(task.id);
                            flash('已复制任务 ID');
                          },
                        },
                        { label: '编辑任务', action: () => setEditingTask(task) },
                        {
                          // P4-1：标记延期 → 真实调 API 更新状态
                          label: '标记延期',
                          action: async () => {
                            try {
                              await updateTask.mutateAsync({ id: task.id, status: '已延期' });
                              flash('任务已标记为延期');
                            } catch (err) {
                              flash(apiError(err, '操作失败'));
                            }
                          },
                        },
                      ].map((item) => (
                        <button
                          key={item.label}
                          onClick={() => {
                            item.action();
                            setShowMore(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-[11px] text-white/70 hover:bg-white/5 hover:text-white"
                        >
                          {item.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute left-4 right-4 bottom-[4.5rem] z-20 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-[11px] text-emerald-200 text-center backdrop-blur-xl"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <LiquidModal
        open={showAiDetail}
        onClose={() => setShowAiDetail(false)}
        title="AI 建议详情"
        subtitle={task.id}
        icon={<Sparkles className="w-5 h-5" />}
        footer={
          <div className="flex justify-end">
            <button onClick={() => setShowAiDetail(false)} className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold">
              知道了
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-[12px] text-white/65 leading-relaxed">
          {aiCache && aiCache.taskId === task.id && aiCache.suggestions.length > 0 ? (
            <>
              <p className="text-[11px] text-white/40">整体置信度 <span className="text-emerald-300 font-semibold">{aiCache.confidence}%</span> · 基于任务信息实时分析</p>
              {aiCache.suggestions.map((s, i) => (
                <div key={i} className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-emerald-300 font-semibold mb-1">建议 {i + 1}</div>
                  <p>{s}</p>
                </div>
              ))}
            </>
          ) : aiStreaming ? (
            <div className="py-6 text-center text-white/45">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-2" />
              AI 正在分析任务…
            </div>
          ) : aiCache === null ? (
            <div className="py-4 text-center text-rose-300/80 text-[12px]">
              AI 调用失败，请检查配置或稍后重试
              <div className="mt-2 text-white/40 text-[11px]">若提示「尚未配置 AI」，请联系系统管理员在设置页配置。</div>
            </div>
          ) : (
            <div className="py-4 text-center text-white/40 text-[12px]">
              点击「重新分析」获取 AI 建议
            </div>
          )}
          {aiCache && aiCache.taskId === task.id && (
            <button
              onClick={() => {
                setAiCache(null);
                fetchAi();
              }}
              className="w-full mt-1 py-2 rounded-xl liquid-btn-ghost text-[11px] font-medium text-white/70 flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              重新分析
            </button>
          )}
        </div>
      </LiquidModal>
    </>
  );
};

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/35">{label}</span>
      {children}
    </div>
  );
}
