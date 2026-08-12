import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Plus, ChevronDown, Command, FilePlus2, CalendarPlus, Upload, FileText, BookOpen, Users, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { NotificationsModal } from '@/components/modals/NotificationsModal';
import { TitleTransition } from '@/components/ui/PageTransition';
import { useTasks, useUnreadNotificationCount, useFiles, useArticles, useWorkspaceMembers } from '@/lib/queries';

interface TopBarProps {
  title?: string;
  subtitle?: string;
  titleKey?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  title = '任务管理',
  subtitle = '高效规划 · 智能协同 · 结果驱动',
  titleKey = title,
}) => {
  const { setIsNewTaskOpen, setSelectedTask, currentWorkspace } = useApp();
  const navigate = useNavigate();
  const { data: tasks = [] } = useTasks();
  const { data: files = [] } = useFiles();
  const { data: articles = [] } = useArticles();
  const { data: members = [] } = useWorkspaceMembers(currentWorkspace?.id);
  // P1-4：真实未读通知数（WebSocket 实时推送）
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // P8：通知铃铛抖动 —— 新通知到达（计数增加）时触发一次 shake 动画
  const [bellShake, setBellShake] = useState(false);
  const prevUnreadRef = useRef(unreadCount);
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      setBellShake(true);
      const t = setTimeout(() => setBellShake(false), 700);
      prevUnreadRef.current = unreadCount;
      return () => clearTimeout(t);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  // P4-1：跨模块搜索（任务 / 文件 / 知识库文章 / 成员）
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return {
      tasks: tasks
        .filter((t) => t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || (t.assignee?.name ?? '').toLowerCase().includes(q))
        .slice(0, 4),
      files: files
        .filter((f) => f.title.toLowerCase().includes(q) || f.originalName.toLowerCase().includes(q) || f.tags.some((tag) => tag.toLowerCase().includes(q)))
        .slice(0, 3),
      articles: articles
        .filter((a) => a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q))
        .slice(0, 3),
      members: members
        .filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
        .slice(0, 3),
    };
  }, [searchQuery, tasks, files, articles, members]);

  const totalHits = searchResults ? searchResults.tasks.length + searchResults.files.length + searchResults.articles.length + searchResults.members.length : 0;

  // P8：⌘K 已由 MainLayout 的全局命令面板接管（原"聚焦搜索框"弱实现已移除）。
  // 这里仅保留 / 键聚焦搜索框的便捷快捷键。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable;
      if (isTyping || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const closeSearch = () => setSearchQuery('');

  return (
    <>
      <header className="w-full flex items-center justify-between gap-3 sm:gap-4 shrink-0 select-none px-0.5">
        <div className="min-w-0 shrink-0 max-w-[min(28%,320px)] sm:max-w-[34%]">
          <TitleTransition titleKey={titleKey}>
            <h1 className="text-[20px] sm:text-[22px] font-bold text-white tracking-tight leading-none truncate">{title}</h1>
            <p className="text-[11px] text-white/35 font-medium mt-1 tracking-wide truncate">{subtitle}</p>
          </TitleTransition>
        </div>

        <div className="relative flex-1 max-w-[min(560px,42vw)] mx-auto hidden sm:block min-w-0">
          <div className="liquid-pill flex items-center h-10 px-3.5 gap-2">
            <Search className="w-3.5 h-3.5 text-white/35 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="搜索任务、项目或文件..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-0 outline-none text-[12px] text-white/90 placeholder:text-white/30 min-w-0"
            />
            <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] text-white/35 font-mono shrink-0">
              <Command className="w-2.5 h-2.5" />K
            </kbd>
          </div>

          <AnimatePresence>
            {searchQuery.trim().length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="absolute top-full left-0 right-0 mt-2 p-2 liquid-glass z-50 max-h-[70vh] overflow-y-auto space-y-2"
              >
                {/* 任务 */}
                {searchResults!.tasks.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 px-2 pt-1 text-[10px] font-semibold text-emerald-300/80">
                      <Target className="w-3 h-3" /> 任务
                    </div>
                    {searchResults!.tasks.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setSelectedTask(t);
                          navigate('/tasks');
                          closeSearch();
                        }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-white/5 transition-colors"
                      >
                        <div className="text-[12px] font-semibold text-white truncate">{t.title}</div>
                        <div className="text-[10px] font-mono text-emerald-300/80 mt-0.5">
                          {t.id.slice(0, 8)} · {t.phase} · {t.assignee?.name ?? '未指派'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* 文件 */}
                {searchResults!.files.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 px-2 pt-1 text-[10px] font-semibold text-cyan-300/80">
                      <FileText className="w-3 h-3" /> 文件
                    </div>
                    {searchResults!.files.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => {
                          navigate('/files');
                          closeSearch();
                        }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-white/5 transition-colors"
                      >
                        <div className="text-[12px] font-semibold text-white truncate">{f.title}</div>
                        <div className="text-[10px] text-cyan-300/60 mt-0.5">{f.originalName} · {f.category}</div>
                      </button>
                    ))}
                  </div>
                )}

                {/* 知识库 */}
                {searchResults!.articles.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 px-2 pt-1 text-[10px] font-semibold text-violet-300/80">
                      <BookOpen className="w-3 h-3" /> 知识库
                    </div>
                    {searchResults!.articles.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => {
                          navigate('/knowledge');
                          closeSearch();
                        }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-white/5 transition-colors"
                      >
                        <div className="text-[12px] font-semibold text-white truncate">{a.title}</div>
                        <div className="text-[10px] text-violet-300/60 mt-0.5">{a.category}</div>
                      </button>
                    ))}
                  </div>
                )}

                {/* 成员 */}
                {searchResults!.members.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 px-2 pt-1 text-[10px] font-semibold text-amber-300/80">
                      <Users className="w-3 h-3" /> 成员
                    </div>
                    {searchResults!.members.map((m) => (
                      <button
                        key={m.userId}
                        onClick={() => {
                          navigate('/collaboration');
                          closeSearch();
                        }}
                        className="w-full flex items-center gap-2 p-2.5 rounded-xl hover:bg-white/5 transition-colors"
                      >
                        <span className="w-6 h-6 rounded-full liquid-icon-well flex items-center justify-center text-[9px] font-bold text-white/80 shrink-0">
                          {m.avatar || m.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[12px] font-semibold text-white truncate">{m.name}</div>
                          <div className="text-[10px] text-white/35 truncate">{m.email}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {totalHits === 0 && (
                  <div className="p-3 text-center text-white/35 text-[12px]">无匹配结果：任务、文件、知识库、成员均未找到</div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowNotifications(true)}
            className="liquid-btn-ghost w-9 h-9 rounded-full flex items-center justify-center text-white/55 hover:text-white relative"
            title="消息通知"
            aria-label={`消息通知，${unreadCount} 条未读`}
          >
            <motion.span
              animate={bellShake ? { rotate: [0, -18, 16, -12, 9, 0] } : {}}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
              className="inline-flex"
            >
              <Bell className="w-4 h-4" />
            </motion.span>
            {unreadCount > 0 && (
              <motion.span
                key={unreadCount}
                initial={{ scale: 0.4 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-[0_0_10px_rgba(244,63,94,0.7)] border border-white/20"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </motion.span>
            )}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowCreateMenu((v) => !v)}
              className="liquid-btn-primary h-9 px-3.5 rounded-full text-[12px] font-bold flex items-center gap-1 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">新增任务</span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
            <AnimatePresence>
              {showCreateMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute right-0 top-full mt-2 w-48 p-1.5 liquid-glass z-50 space-y-0.5"
                >
                  <button
                    onClick={() => {
                      setShowCreateMenu(false);
                      setIsNewTaskOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] text-white/75 hover:bg-white/5 hover:text-white"
                  >
                    <FilePlus2 className="w-3.5 h-3.5 text-emerald-300" /> 新建任务
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateMenu(false);
                      navigate('/files');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] text-white/75 hover:bg-white/5 hover:text-white"
                  >
                    <Upload className="w-3.5 h-3.5 text-cyan-300" /> 快速文档
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateMenu(false);
                      navigate('/schedule');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] text-white/75 hover:bg-white/5 hover:text-white"
                  >
                    <CalendarPlus className="w-3.5 h-3.5 text-violet-300" /> 预约日程
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <NotificationsModal
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </>
  );
};
