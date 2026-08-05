import React from 'react';
import { clsx } from 'clsx';
import { Priority, TaskStatus } from '@/types';

interface StatusBadgeProps {
  type: 'priority' | 'status' | 'phase' | 'tag';
  value: Priority | TaskStatus | string;
  className?: string;
  onClick?: () => void;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  type,
  value,
  className,
  onClick,
}) => {
  if (type === 'priority') {
    const isHigh = value === '高' || value === '高优先级' || value === '紧急';
    const isMedium = value === '中';
    
    return (
      <span
        onClick={onClick}
        className={clsx(
          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium tracking-wide transition-all',
          isHigh && 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]',
          isMedium && 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
          !isHigh && !isMedium && 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
          className
        )}
      >
        {value}
      </span>
    );
  }

  if (type === 'status') {
    const isCompleted = value === '已完成';
    const isInProgress = value === '进行中';
    const isOverdue = value === '已延期';

    return (
      <span
        onClick={onClick}
        className={clsx(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
          isInProgress && 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
          isCompleted && 'bg-blue-500/10 text-blue-300 border border-blue-500/20',
          isOverdue && 'bg-rose-500/10 text-rose-300 border border-rose-500/20',
          !isInProgress && !isCompleted && !isOverdue && 'bg-slate-500/10 text-slate-300 border border-slate-500/20',
          className
        )}
      >
        <span
          className={clsx(
            'w-1.5 h-1.5 rounded-full',
            isInProgress && 'bg-emerald-400 animate-pulse',
            isCompleted && 'bg-blue-400',
            isOverdue && 'bg-rose-400',
            !isInProgress && !isCompleted && !isOverdue && 'bg-slate-400'
          )}
        />
        {value}
      </span>
    );
  }

  if (type === 'phase') {
    const isRequirement = value.includes('需求');
    const isDesign = value.includes('设计');
    const isDev = value.includes('开发');

    return (
      <span
        className={clsx(
          'inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md',
          isRequirement && 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20',
          isDesign && 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/20',
          isDev && 'text-purple-400 bg-purple-500/10 border border-purple-500/20',
          !isRequirement && !isDesign && !isDev && 'text-slate-400 bg-slate-500/10 border border-slate-500/20',
          className
        )}
      >
        <span
          className={clsx(
            'w-1.5 h-1.5 rounded-full',
            isRequirement && 'bg-emerald-400',
            isDesign && 'bg-cyan-400',
            isDev && 'bg-purple-400',
            !isRequirement && !isDesign && !isDev && 'bg-slate-400'
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
