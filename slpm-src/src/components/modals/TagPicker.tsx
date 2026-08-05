import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Tag as TagIcon, Settings2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useTags } from '@/lib/queries';
import { tagColorClass } from '@/lib/tagColors';
import type { Tag } from '@/types';

interface TagPickerProps {
  value: string[]; // 已选标签名
  onChange: (tags: string[]) => void;
  onManage?: () => void; // 打开标签管理弹窗（可选）
}

/**
 * P6-A：任务表单里的标签选择器。
 *
 * - 已存在的标签（来自工作区标签库）可点选/取消
 * - 也可输入自定义新标签名（回车添加）
 * - 选中标签以彩色 chip 展示
 */
export const TagPicker: React.FC<TagPickerProps> = ({ value, onChange, onManage }) => {
  const { data: tags = [] } = useTags();
  const [input, setInput] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭建议
  useEffect(() => {
    if (!showSuggest) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowSuggest(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [showSuggest]);

  const selectedSet = new Set(value);
  const tagByName = new Map(tags.map((t) => [t.name, t]));

  const toggle = (name: string) => {
    if (selectedSet.has(name)) onChange(value.filter((n) => n !== name));
    else onChange([...value, name]);
  };

  const addCustom = () => {
    const name = input.trim();
    if (!name || selectedSet.has(name)) return;
    onChange([...value, name]);
    setInput('');
  };

  return (
    <div ref={wrapRef} className="relative">
      {/* 已选标签 chips + 输入 */}
      <div className="flex flex-wrap items-center gap-1.5 min-h-[40px] px-2.5 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 focus-within:border-emerald-400/40 transition-colors">
        {value.map((name) => {
          const tag = tagByName.get(name);
          return (
            <span
              key={name}
              className={clsx(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border',
                tagColorClass(tag?.color),
              )}
            >
              {name}
              <button
                type="button"
                onClick={() => toggle(name)}
                className="hover:bg-white/20 rounded-sm"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          );
        })}
        <input
          className="flex-1 min-w-[100px] bg-transparent outline-none text-[12px] text-white placeholder-white/30 py-1"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggest(true);
          }}
          onFocus={() => setShowSuggest(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom();
            } else if (e.key === 'Backspace' && !input && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder={value.length === 0 ? '选择或输入标签...' : ''}
        />
        {onManage && (
          <button
            type="button"
            onClick={onManage}
            title="管理标签库"
            className="ml-auto liquid-btn-ghost w-6 h-6 rounded-md flex items-center justify-center text-white/40 hover:text-white"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 建议：未选中的已有标签 + 新建 */}
      {showSuggest && (
        <div className="absolute z-30 mt-1 w-full liquid-glass rounded-xl border border-white/10 p-1.5 max-h-48 overflow-y-auto">
          {tags.filter((t) => !selectedSet.has(t.name)).length === 0 && !input.trim() && (
            <div className="px-2.5 py-2 text-[11px] text-white/40 flex items-center gap-1.5">
              <TagIcon className="w-3.5 h-3.5" />
              暂无更多标签，输入文字可创建
            </div>
          )}
          {tags
            .filter((t) => !selectedSet.has(t.name))
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  toggle(t.name);
                  setInput('');
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left"
              >
                <span className={clsx('w-2 h-2 rounded-full border', tagColorClass(t.color))} />
                <span className="text-[12px] text-white/80">{t.name}</span>
              </button>
            ))}
          {input.trim() && !selectedSet.has(input.trim()) && !tagByName.has(input.trim()) && (
            <button
              type="button"
              onClick={addCustom}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-emerald-500/15 text-left border-t border-white/5 mt-0.5"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-300" />
              <span className="text-[12px] text-emerald-200">创建标签「{input.trim()}」</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
