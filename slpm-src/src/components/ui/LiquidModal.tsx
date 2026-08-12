import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface LiquidModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
  className?: string;
  /** 点击遮罩是否关闭（默认 true）。提交中应传 false 防误关丢输入 */
  closeOnOverlayClick?: boolean;
  /** 为 true 时禁用 Esc + 遮罩关闭（用于表单提交中） */
  blockCloseWhileSubmitting?: boolean;
}

// P8：可聚焦元素选择器（含原生表单 + 自定义 role）
const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export const LiquidModal: React.FC<LiquidModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  widthClass = 'max-w-lg',
  className,
  closeOnOverlayClick = true,
  blockCloseWhileSubmitting = false,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  // 记录打开弹窗前焦点所在元素，关闭后归还（无障碍最佳实践）
  const prevFocusRef = useRef<HTMLElement | null>(null);

  const allowClose = !blockCloseWhileSubmitting;

  // ESC 关闭（提交中禁用）
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && allowClose) {
        e.stopPropagation();
        onClose();
      }
      // Tab 焦点陷阱：在弹窗内循环，不跑到背景
      if (e.key === 'Tab' && panelRef.current) {
        const nodes = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement as HTMLElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, allowClose]);

  // 打开时记录焦点 + 自动聚焦首个可交互元素；关闭时归还焦点
  useEffect(() => {
    if (open) {
      prevFocusRef.current = document.activeElement as HTMLElement;
      // 下一帧聚焦面板内首个可聚焦元素（等 DOM 渲染）
      const t = setTimeout(() => {
        const node = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
        node?.focus();
      }, 60);
      return () => clearTimeout(t);
    } else if (prevFocusRef.current && typeof prevFocusRef.current.focus === 'function') {
      prevFocusRef.current.focus();
    }
  }, [open]);

  const handleOverlay = () => {
    if (closeOnOverlayClick && allowClose) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="liquid-modal-root"
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* 遮罩：淡入 + 模糊加强 */}
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(20px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.28 }}
            onClick={handleOverlay}
            className="absolute inset-0 bg-black/72"
          />

          {/* 面板：缩放 + 上浮 + 模糊清除 */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={subtitle ? undefined : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, y: 36, scale: 0.92, filter: 'blur(12px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 20, scale: 0.96, filter: 'blur(8px)' }}
            transition={{ type: 'spring', stiffness: 360, damping: 26, mass: 0.8 }}
            className={clsx(
              'relative w-full liquid-glass overflow-hidden p-0 text-white z-10 outline-none',
              widthClass,
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="absolute top-0 inset-x-10 h-px origin-center bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent"
            />

            <div className="pointer-events-none absolute -top-16 right-0 w-40 h-40 rounded-full bg-emerald-400/10 blur-3xl" />

            <div className="relative z-10 p-5 sm:p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {icon && (
                    <motion.div
                      initial={{ scale: 0.6, opacity: 0, rotate: -12 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.06 }}
                      className="liquid-icon-well w-11 h-11 rounded-2xl flex items-center justify-center text-emerald-300 shrink-0"
                    >
                      {icon}
                    </motion.div>
                  )}
                  <motion.div
                    className="min-w-0"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08, duration: 0.28 }}
                  >
                    <h3 id={titleId} className="text-[17px] font-bold tracking-tight text-white truncate">{title}</h3>
                    {subtitle && <div className="text-[11px] text-white/40 mt-0.5">{subtitle}</div>}
                  </motion.div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.08, rotate: 90 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={allowClose ? onClose : undefined}
                  disabled={!allowClose}
                  aria-label="关闭"
                  className="liquid-btn-ghost w-9 h-9 rounded-full flex items-center justify-center text-white/45 hover:text-white shrink-0 disabled:opacity-40 disabled:hover:scale-100"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.3 }}
              >
                {children}
              </motion.div>

              {footer && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.16, duration: 0.28 }}
                  className="pt-3 border-t border-white/[0.06]"
                >
                  {footer}
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
