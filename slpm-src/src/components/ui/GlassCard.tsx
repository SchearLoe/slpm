import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { clsx } from 'clsx';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'interactive' | 'active' | 'emerald' | 'emerald-ghost' | 'flat';
  glowColor?: 'emerald' | 'cyan' | 'purple' | 'red' | 'none';
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  variant = 'default',
  glowColor = 'none',
  onClick,
  ...props
}) => {
  const base = 'liquid-glass relative overflow-hidden';
  const variants = {
    default: '',
    interactive: 'liquid-glass-hover cursor-pointer',
    active: 'liquid-glass-active',
    emerald: 'frost-card-active text-white',
    'emerald-ghost': 'border border-emerald-400/25 shadow-[0_0_30px_rgba(16,185,129,0.12)]',
    flat: 'rounded-[18px]',
  };

  const glow = {
    none: '',
    emerald: 'shadow-[0_0_28px_rgba(16,185,129,0.18)]',
    cyan: 'shadow-[0_0_28px_rgba(6,182,212,0.18)]',
    purple: 'shadow-[0_0_28px_rgba(168,85,247,0.18)]',
    red: 'shadow-[0_0_28px_rgba(239,68,68,0.18)]',
  };

  // P8 无障碍：interactive 卡片有 onClick 时须键盘可达（Tab 聚焦 + Enter/Space 触发）
  const isInteractive = variant === 'interactive' && typeof onClick === 'function';

  return (
    <motion.div
      onClick={onClick}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-disabled={isInteractive && !onClick ? true : undefined}
      className={clsx(base, variants[variant], glow[glowColor], className)}
      {...props}
    >
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
};
