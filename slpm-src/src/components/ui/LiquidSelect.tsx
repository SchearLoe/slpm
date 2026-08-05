import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { clsx } from 'clsx';

export type LiquidSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

interface LiquidSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: LiquidSelectOption[];
  placeholder?: string;
  className?: string;
  /** pill = 紧凑筛选条；field = 表单输入同宽 */
  variant?: 'pill' | 'field';
  /** 下拉向上展开（底栏场景） */
  placement?: 'bottom' | 'top';
  disabled?: boolean;
  'aria-label'?: string;
}

export const LiquidSelect: React.FC<LiquidSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = '请选择',
  className,
  variant = 'field',
  placement = 'bottom',
  disabled,
  'aria-label': ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, maxH: 240 });

  const selected = options.find((o) => o.value === value);

  const updatePos = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const spaceAbove = r.top - 12;
    const wantTop = placement === 'top' || (spaceBelow < 160 && spaceAbove > spaceBelow);
    const maxH = Math.min(280, Math.max(120, wantTop ? spaceAbove : spaceBelow));
    setPos({
      top: wantTop ? r.top - 6 : r.bottom + 6,
      left: r.left,
      width: Math.max(r.width, 128),
      maxH,
    });
    return wantTop;
  };

  const [openUp, setOpenUp] = useState(false);

  useEffect(() => {
    if (!open) return;
    const up = updatePos();
    setOpenUp(!!up);

    const onWin = () => {
      const u = updatePos();
      setOpenUp(!!u);
    };
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, placement]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={clsx(
          'flex items-center justify-between gap-2 text-left transition-colors disabled:opacity-40',
          variant === 'pill' &&
            'liquid-pill px-2.5 py-1.5 text-[11px] text-white/65 hover:text-white min-w-0 whitespace-nowrap',
          variant === 'field' &&
            'liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white',
          open && 'border-emerald-400/35 text-white',
          className
        )}
      >
        <span className={clsx('truncate', !selected && 'text-white/35')}>
          {selected?.label ?? placeholder}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0 text-white/40">
          <ChevronDown className="w-3.5 h-3.5" />
        </motion.span>
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panelRef}
                id={listId}
                role="listbox"
                initial={{ opacity: 0, y: openUp ? 8 : -8, scale: 0.96, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: openUp ? 6 : -6, scale: 0.97, filter: 'blur(4px)' }}
                transition={{ type: 'spring', stiffness: 420, damping: 28, mass: 0.7 }}
                style={{
                  position: 'fixed',
                  top: openUp ? undefined : pos.top,
                  bottom: openUp ? window.innerHeight - pos.top : undefined,
                  left: pos.left,
                  width: pos.width,
                  maxHeight: pos.maxH,
                  zIndex: 100,
                }}
                className="liquid-glass p-1.5 overflow-y-auto shadow-[0_20px_50px_rgba(0,0,0,0.65)]"
              >
                {options.map((opt) => {
                  const active = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={active}
                      disabled={opt.disabled}
                      onClick={() => {
                        if (opt.disabled) return;
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className={clsx(
                        'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[12px] transition-colors text-left',
                        active
                          ? 'bg-emerald-400/15 text-emerald-100'
                          : 'text-white/70 hover:bg-white/[0.06] hover:text-white',
                        opt.disabled && 'opacity-40 pointer-events-none'
                      )}
                    >
                      <span className="truncate">{opt.label}</span>
                      {active && <Check className="w-3.5 h-3.5 text-emerald-300 shrink-0" />}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};
