import React from 'react';
import { clsx } from 'clsx';
import { Priority, TaskStatus } from '@/types';

interface StatusBadgeProps {
  type: 'priority' | 'status' | 'phase' | 'tag';
  value: Priority | TaskStatus | string;
  className?: string;
  onClick?: () => void;
}

/**
 * P8 视觉修复：配色判断从脆弱的"中文字面量严格相等"改为"归一化匹配"，
 * 兼容后端返回的繁简/空格/大小写差异（如 '已完成 ' / 'Completed'），避免掉进默认灰色分支。
 */
const norm = (v: string) => v.trim().toLowerCase();

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  type,
  value,
  className,
  onClick,
}) => {
  if (type === 'priority') {
    const n = norm(String(value));
    const isHigh = n === '高' || n === '高优先级' || n.includes('紧急') || n.includes('high') || n.includes('urgent');
    const isMedium = n === '中' || n.includes('medium');
    const isLow = n === '低' || n.includes('low');

    return (
      <span
        onClick={onClick}
        className={clsx(
          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium tracking-wide transition-all',
          isHigh && 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]',
          isMedium && 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
          isLow && 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
          !isHigh && !isMedium && !isLow && 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
          className
        )}
      >
        {value}
      </span>
    );
  }

  if (type === 'status') {
    const n = norm(String(value));
    const isInProgress = n.includes('进行') || n.includes('progress');
    const isCompleted = n.includes('完成') || n.includes('done') || n.includes('completed');
    const isOverdue = n.includes('延期') || n.includes('overdue');
    const isPending = n.includes('待') || n.includes('pending');

    return (
      <span
        onClick={onClick}
        className={clsx(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
          isInProgress && 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
          isCompleted && 'bg-blue-500/10 text-blue-300 border border-blue-500/20',
          isOverdue && 'bg-rose-500/10 text-rose-300 border border-rose-500/20',
          isPending && 'bg-amber-500/10 text-amber-300 border border-amber-500/20',
          !isInProgress && !isCompleted && !isOverdue && !isPending && 'bg-slate-500/10 text-slate-300 border border-slate-500/20',
          className
        )}
      >
        <span
          className={clsx(
            'w-1.5 h-1.5 rounded-full',
            isInProgress && 'bg-emerald-400 animate-pulse',
            isCompleted && 'bg-blue-400',
            isOverdue && 'bg-rose-400',
            isPending && 'bg-amber-400',
            !isInProgress && !isCompleted && !isOverdue && !isPending && 'bg-slate-400'
          )}
        />
        {value}
      </span>
    );
  }

  if (type === 'phase') {
    const n = norm(String(value));
    const isRequirement = n.includes('需求');
    const isDesign = n.includes('设计');
    const isDev = n.includes('开发');
    const isQa = n.includes('测试') || n.includes('验证');

    return (
      <span
        className={clsx(
          'inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md',
          isRequirement && 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20',
          isDesign && 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/20',
          isDev && 'text-purple-400 bg-purple-500/10 border border-purple-500/20',
          isQa && 'text-amber-400 bg-amber-500/10 border border-amber-500/20',
          !isRequirement && !isDesign && !isDev && !isQa && 'text-slate-400 bg-slate-500/10 border border-slate-500/20',
          className
        )}
      >
        <span
          className={clsx(
            'w-1.5 h-1.5 rounded-full',
            isRequirement && 'bg-emerald-400',
            isDesign && 'bg-cyan-400',
            isDev && 'bg-purple-400',
            isQa && 'bg-amber-400',
            !isRequirement && !isDesign && !isDev && !isQa && 'bg-slate-400'
          )}
        />
        {value}
      </span>
    );
  }

  // Tag variant
  return (
    <span
      onClick={onClick}
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-normal text-slate-300 bg-slate-800/60 border border-slate-700/50 hover:border-slate-500/50 transition-colors',
        className
      )}
    >
      {value}
    </span>
  );
};
