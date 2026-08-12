import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

/**
 * P8：统一空态组件。
 * 旧空态都是一行灰字"暂无 XX"，缺乏引导。现提供轻量 SVG 插画 + 明确主 CTA。
 * 配合液态玻璃风格：emerald 主色调、柔和光晕。
 */
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** 主行动按钮 */
  action?: { label: string; onClick: () => void };
  /** 次级文案按钮 */
  secondary?: { label: string; onClick: () => void };
  /** 紧凑模式（用于面板内嵌，缩小插画） */
  compact?: boolean;
  className?: string;
}

const DefaultSparkle: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="opacity-80">
    <path d="M12 3l1.6 4.6L18 9.2l-4.4 1.6L12 15.4l-1.6-4.6L6 9.2l4.4-1.6L12 3z" fill="currentColor" />
    <circle cx="18.5" cy="17.5" r="1.2" fill="currentColor" opacity="0.6" />
    <circle cx="6.5" cy="16" r="0.9" fill="currentColor" opacity="0.5" />
  </svg>
);

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondary,
  compact = false,
  className,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    className={clsx(
      'flex flex-col items-center justify-center text-center',
      compact ? 'py-8 px-4' : 'py-14 px-6',
      className,
    )}
  >
    {/* 液态玻璃风插画：柔光圆环 + 图标 */}
    <div className="relative mb-4">
      <div className={clsx(
        'relative rounded-full bg-emerald-500/[0.08] border border-emerald-400/15 flex items-center justify-center text-emerald-300/70',
        compact ? 'w-14 h-14' : 'w-20 h-20',
      )}>
        <div className="absolute inset-0 rounded-full bg-emerald-400/5 blur-xl" />
        <span className="relative">{icon ?? <DefaultSparkle size={compact ? 24 : 30} />}</span>
      </div>
    </div>

    <h4 className={clsx('font-semibold text-white/85 tracking-tight', compact ? 'text-[13.5px]' : 'text-[15px]')}>
      {title}
    </h4>
    {description && (
      <p className={clsx('mt-1.5 text-white/45 leading-relaxed max-w-sm', compact ? 'text-[11.5px]' : 'text-[12.5px]')}>
        {description}
      </p>
    )}

    {(action || secondary) && (
      <div className="mt-5 flex items-center gap-2.5">
        {action && (
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={action.onClick}
            className="px-4 py-2 rounded-xl text-[12.5px] font-semibold text-white bg-emerald-500/90 hover:bg-emerald-500 shadow-[0_0_22px_rgba(16,185,129,0.3)] transition-colors"
          >
            {action.label}
          </motion.button>
        )}
        {secondary && (
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={secondary.onClick}
            className="liquid-btn-ghost px-4 py-2 rounded-xl text-[12.5px] font-medium text-white/60 hover:text-white"
          >
            {secondary.label}
          </motion.button>
        )}
      </div>
    )}
  </motion.div>
);
