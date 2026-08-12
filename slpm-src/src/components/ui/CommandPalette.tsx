import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * P8：全局命令面板（⌘K / Ctrl+K）。
 * 替代原来"⌘K 只是聚焦搜索框"的弱实现，升级为真正的 Command Palette：
 *  - 页面跳转、新建任务、切换工作区等一键直达
 *  - 模糊搜索（标题 + 关键词）
 *  - ↑↓ 选择 + Enter 执行 + Esc 关闭
 *  - 分组展示（导航 / 操作）
 */
export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  keywords?: string;
  section: '导航' | '操作';
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose, commands }) => {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 模糊匹配：标题/关键词包含查询串（大小写不敏感）
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => {
      const hay = `${c.title} ${c.subtitle ?? ''} ${c.keywords ?? ''} ${c.section}`.toLowerCase();
      return q.split(/\s+/).every((token) => hay.includes(token));
    });
  }, [query, commands]);

  // 按分组归类（保持顺序）
  const grouped = useMemo(() => {
    const order = ['导航', '操作'];
    return order
      .map((section) => ({ section, items: filtered.filter((c) => c.section === section) }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  // 扁平化索引（用于键盘上下选择）
  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // 打开时聚焦输入框 + 重置状态
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  // 过滤结果变化时重置选中 + 滚动到可视
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cmd-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const runItem = (item: CommandItem | undefined) => {
    if (!item) return;
    item.action();
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runItem(flat[activeIdx]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[85] flex items-start justify-center pt-[12vh] p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="relative z-10 w-full max-w-xl liquid-glass overflow-hidden shadow-2xl"
            onKeyDown={onKeyDown}
          >
            {/* 顶部搜索栏 */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
              <Search className="w-4 h-4 text-white/40 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索页面、操作、快捷键…"
                className="flex-1 bg-transparent outline-none text-[14px] text-white placeholder:text-white/30"
              />
              <kbd className="text-[10px] font-mono text-white/40 px-1.5 py-0.5 rounded border border-white/10 bg-white/5">ESC</kbd>
            </div>

            {/* 命令列表 */}
            <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
              {flat.length === 0 && (
                <div className="py-10 text-center text-[12.5px] text-white/35">
                  无匹配命令：试试输入"任务""日程""新建"
                </div>
              )}
              {grouped.map((group) => (
                <div key={group.section} className="mb-1">
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                    {group.section}
                  </div>
                  {group.items.map((item) => {
                    const idx = flat.indexOf(item);
                    const active = idx === activeIdx;
                    return (
                      <button
                        key={item.id}
                        data-cmd-idx={idx}
                        onMouseMove={() => setActiveIdx(idx)}
                        onClick={() => runItem(item)}
                        className={clsx(
                          'w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left transition-colors',
                          active ? 'bg-emerald-500/15 ring-1 ring-emerald-400/30' : 'hover:bg-white/[0.04]',
                        )}
                      >
                        <span className={clsx(
                          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                          active ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/5 text-white/55',
                        )}>
                          {item.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium text-white truncate">{item.title}</span>
                          {item.subtitle && (
                            <span className="block text-[11px] text-white/40 truncate">{item.subtitle}</span>
                          )}
                        </span>
                        {item.shortcut && (
                          <kbd className="text-[10px] font-mono text-white/40 px-1.5 py-0.5 rounded border border-white/10 bg-white/5 shrink-0">
                            {item.shortcut}
                          </kbd>
                        )}
                        {active && <CornerDownLeft className="w-3.5 h-3.5 text-emerald-300 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* 底部提示 */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-white/[0.06] text-[10px] text-white/35">
              <span className="flex items-center gap-1"><ArrowUp className="w-3 h-3" /><ArrowDown className="w-3 h-3" /> 选择</span>
              <span className="flex items-center gap-1"><CornerDownLeft className="w-3 h-3" /> 执行</span>
              <span className="ml-auto">SLPM 命令面板</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
