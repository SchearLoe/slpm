import React, { useState } from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { clsx } from 'clsx';
import { LiquidModal } from '@/components/ui/LiquidModal';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from '@/lib/queries';
import { TAG_COLOR_OPTIONS, tagColorClass } from '@/lib/tagColors';
import type { Tag, TagColor } from '@/types';

interface TagManageModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * P6-A：标签库管理弹窗。
 *
 * 工作区级标签的 CRUD：创建（名称 + 颜色）、改色、重命名（级联更新任务 tags）、删除。
 */
export const TagManageModal: React.FC<TagManageModalProps> = ({ open, onClose }) => {
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<TagColor>('emerald');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState<TagColor>('emerald');

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createTag.mutate(
      { name, color: newColor },
      {
        onSuccess: () => setNewName(''),
        onError: () => alert('创建失败：标签名可能已存在'),
      },
    );
  };

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) return;
    updateTag.mutate(
      { id: editingId, name, color: editColor },
      { onSuccess: () => setEditingId(null) },
    );
  };

  return (
    <LiquidModal open={open} onClose={onClose} title="标签库管理" subtitle="工作区级标签 · 名称颜色统一管理" widthClass="max-w-xl">
      {/* 新建 */}
      <div className="flex items-center gap-2 mb-4">
        <input
          className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-[13px] text-white outline-none focus:border-emerald-400/40"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="新标签名称"
          maxLength={30}
        />
        <ColorPicker value={newColor} onChange={setNewColor} />
        <button
          onClick={handleCreate}
          disabled={!newName.trim() || createTag.isPending}
          className="liquid-btn-primary px-3 py-2 rounded-lg text-[12px] flex items-center gap-1 disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" /> 添加
        </button>
      </div>

      {/* 列表 */}
      {tags.length === 0 ? (
        <div className="text-center py-8 text-[12px] text-white/40">暂无标签，在上方创建第一个</div>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10"
            >
              {editingId === tag.id ? (
                <>
                  <input
                    className="flex-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[12px] text-white outline-none focus:border-emerald-400/40"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    autoFocus
                  />
                  <ColorPicker value={editColor} onChange={setEditColor} compact />
                  <button onClick={saveEdit} className="liquid-btn-ghost w-7 h-7 rounded-md flex items-center justify-center text-emerald-300">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="liquid-btn-ghost w-7 h-7 rounded-md flex items-center justify-center text-white/50">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-md text-[11px] border', tagColorClass(tag.color))}>
                    {tag.name}
                  </span>
                  <span className="ml-auto flex items-center gap-1">
                    <button
                      onClick={() => startEdit(tag)}
                      className="liquid-btn-ghost w-7 h-7 rounded-md flex items-center justify-center text-white/45 hover:text-white"
                      title="编辑"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`删除标签「${tag.name}」？将同时从所有任务中移除该标签。`)) {
                          deleteTag.mutate(tag.id);
                        }
                      }}
                      className="liquid-btn-ghost w-7 h-7 rounded-md flex items-center justify-center text-rose-300/70 hover:text-rose-300"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </LiquidModal>
  );
};

// 颜色选择器（弹窗内联）
const ColorPicker: React.FC<{ value: TagColor; onChange: (c: TagColor) => void; compact?: boolean }> = ({ value, onChange, compact }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={clsx('rounded-md border', tagColorClass(value), compact ? 'w-7 h-7' : 'w-9 h-9')}
        title="选择颜色"
      />
      {open && (
        <div className="absolute right-0 z-20 mt-1 p-1.5 liquid-glass rounded-lg border border-white/10 grid grid-cols-3 gap-1">
          {TAG_COLOR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={clsx(
                'w-6 h-6 rounded-md border',
                tagColorClass(opt.value),
                value === opt.value && 'ring-2 ring-white/60',
              )}
              title={opt.label}
            />
          ))}
        </div>
      )}
    </div>
  );
};
