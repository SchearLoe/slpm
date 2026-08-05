import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListChecks, Plus, Trash2, X, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { useChecklist, useAddChecklistItem, useUpdateChecklistItem, useDeleteChecklistItem } from '@/lib/queries';

interface TaskChecklistProps {
  taskId: string;
}

/**
 * P6-B：任务清单（Checklist）。
 *
 * 可勾选的子项列表 + 完成度进度条。轻量待办清单，区别于 parent/children 任务层级。
 */
export const TaskChecklist: React.FC<TaskChecklistProps> = ({ taskId }) => {
  const { data: items = [], isLoading } = useChecklist(taskId);
  const addItem = useAddChecklistItem(taskId);
  const updateItem = useUpdateChecklistItem(taskId);
  const deleteItem = useDeleteChecklistItem(taskId);

  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const done = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const handleAdd = () => {
    const content = draft.trim();
    if (!content) return;
    addItem.mutate(content, {
      onSuccess: () => {
        setDraft('');
        setAdding(false);
      },
    });
  };

  const handleSaveEdit = (itemId: string) => {
    const content = editText.trim();
    if (!content) return;
    updateItem.mutate({ itemId, content }, { onSuccess: () => setEditingId(null) });
  };

  return (
    <div className="mt-3 p-3.5 rounded-2xl bg-black/25 border border-white/[0.07] space-y-2.5">
      <div className="flex items-center gap-1.5 text-[12px] font-bold text-white">
        <ListChecks className="w-3.5 h-3.5 text-emerald-300" />
        清单
        {total > 0 && <span className="text-[10px] text-white/35 font-normal">{done}/{total}</span>}
        <button
          onClick={() => setAdding((v) => !v)}
          className="ml-auto liquid-btn-ghost w-5 h-5 rounded-md flex items-center justify-center text-white/40 hover:text-white"
          title="添加清单项"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 完成度进度条 */}
      {total > 0 && (
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-400 to-teal-300"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      )}

      {isLoading ? (
        <div className="text-[11px] text-white/35 py-1">加载中…</div>
      ) : total === 0 && !adding ? (
        <div className="text-[11px] text-white/30 py-1">还没有清单项，点击 + 添加</div>
      ) : (
        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 group"
              >
                <button
                  onClick={() => updateItem.mutate({ itemId: item.id, done: !item.done })}
                  className={clsx(
                    'shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors',
                    item.done
                      ? 'bg-emerald-500/80 border-emerald-400 text-white'
                      : 'border-white/25 hover:border-emerald-400/60',
                  )}
                >
                  {item.done && <Check className="w-3 h-3" />}
                </button>
                {editingId === item.id ? (
                  <>
                    <input
                      className="flex-1 min-w-0 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px] text-white outline-none focus:border-emerald-400/40"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(item.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                    />
                    <button onClick={() => handleSaveEdit(item.id)} className="text-emerald-300 hover:text-emerald-200">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-white/40 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      onDoubleClick={() => {
                        setEditingId(item.id);
                        setEditText(item.content);
                      }}
                      className={clsx(
                        'flex-1 min-w-0 text-[11px] leading-relaxed truncate',
                        item.done ? 'text-white/35 line-through' : 'text-white/75',
                      )}
                      title="双击编辑"
                    >
                      {item.content}
                    </span>
                    <button
                      onClick={() => {
                        setEditingId(item.id);
                        setEditText(item.content);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-white/35 hover:text-white text-[10px]"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => deleteItem.mutate(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-rose-300/60 hover:text-rose-300"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {/* 添加输入 */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 pt-1 border-t border-white/[0.05]">
              <input
                className="flex-1 min-w-0 px-2 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px] text-white outline-none focus:border-emerald-400/40"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd();
                  if (e.key === 'Escape') {
                    setAdding(false);
                    setDraft('');
                  }
                }}
                placeholder="清单项内容，回车添加"
                autoFocus
              />
              <button
                onClick={handleAdd}
                disabled={!draft.trim() || addItem.isPending}
                className="liquid-btn-primary px-2.5 py-1 rounded-md text-[11px] disabled:opacity-40"
              >
                添加
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
