import React from 'react';
import { clsx } from 'clsx';

/**
 * P8：统一骨架屏加载组件。
 * 之前各页 `data = []` 默认值让"加载中"与"真空数据"无法区分（KPI 全 0、列表空）。
 * 用 shimmer 骨架替代，明确传达"正在加载"。
 */
interface SkeletonProps {
  className?: string;
  /** 圆角样式，默认圆角矩形 */
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

const ROUNDED: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  sm: 'rounded-md',
  md: 'rounded-xl',
  lg: 'rounded-2xl',
  full: 'rounded-full',
};

export const Skeleton: React.FC<SkeletonProps> = ({ className, rounded = 'md' }) => (
  <div
    role="status"
    aria-label="加载中"
    className={clsx(
      'relative overflow-hidden bg-white/[0.04] border border-white/[0.05]',
      ROUNDED[rounded],
      className,
    )}
  >
    <div className="absolute inset-0 -translate-x-full animate-[sweep_1.6s_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
  </div>
);

// 行级骨架：用于列表/表格
export const SkeletonRows: React.FC<{ rows?: number; className?: string }> = ({ rows = 5, className }) => (
  <div className={clsx('space-y-3', className)}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3">
        <Skeleton rounded="full" className="w-9 h-9 shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    ))}
  </div>
);

// 卡片骨架：用于 KPI/概览
export const SkeletonCards: React.FC<{ cards?: number; className?: string }> = ({ cards = 4, className }) => (
  <div className={clsx('grid gap-3', className)} style={{ gridTemplateColumns: `repeat(${Math.min(cards, 4)}, minmax(0, 1fr))` }}>
    {Array.from({ length: cards }).map((_, i) => (
      <div key={i} className="liquid-glass rounded-[18px] p-4 space-y-3">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-2 w-full" />
      </div>
    ))}
  </div>
);
