import type { TagColor } from '@/types';

/**
 * P6-A：标签颜色 → Tailwind 类映射。
 *
 * 集中管理，供 TagPicker / 任务卡片标签徽章 / 标签管理弹窗复用。
 * 使用低饱和度的 bg-xxx-500/15 + text-xxx-200 + border-xxx-400/30，契合液态玻璃风格。
 */
export const TAG_COLOR_CLASSES: Record<TagColor, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
  cyan: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/30',
  purple: 'bg-purple-500/15 text-purple-200 border-purple-400/30',
  rose: 'bg-rose-500/15 text-rose-200 border-rose-400/30',
  amber: 'bg-amber-500/15 text-amber-200 border-amber-400/30',
  sky: 'bg-sky-500/15 text-sky-200 border-sky-400/30',
  indigo: 'bg-indigo-500/15 text-indigo-200 border-indigo-400/30',
  teal: 'bg-teal-500/15 text-teal-200 border-teal-400/30',
  slate: 'bg-slate-500/15 text-slate-200 border-slate-400/30',
};

// 颜色色板（标签管理弹窗用，带中文名）
export const TAG_COLOR_OPTIONS: { value: TagColor; label: string }[] = [
  { value: 'emerald', label: '翡翠绿' },
  { value: 'cyan', label: '青蓝' },
  { value: 'purple', label: '紫色' },
  { value: 'rose', label: '玫瑰红' },
  { value: 'amber', label: '琥珀黄' },
  { value: 'sky', label: '天蓝' },
  { value: 'indigo', label: '靛蓝' },
  { value: 'teal', label: '蓝绿' },
  { value: 'slate', label: '灰' },
];

// 取颜色样式（容错：未知颜色降级为 slate）
export function tagColorClass(color: string | undefined): string {
  return TAG_COLOR_CLASSES[(color as TagColor) ?? 'emerald'] ?? TAG_COLOR_CLASSES.slate;
}
