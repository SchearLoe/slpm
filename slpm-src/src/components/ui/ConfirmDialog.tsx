import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Trash2, Info, AlertOctagon } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * P8：统一的二次确认弹窗，替代散落全站的原生 confirm()/alert()。
 * 原生弹窗是 OS 风格白底蓝按钮，在 Liquid Glass 界面里极其突兀，且不可被自动化、不可聚焦。
 *
 * 使用方式：
 *   const { open, openWith } = useConfirm();
 *   <ConfirmDialog {...open} variant="danger" title="删除文件？"
 *     description="该操作不可恢复" confirmText="删除" onConfirm={handleDelete} />
 *   // 触发：openWith() 或 setOpen(true)
 */
import { LiquidModal } from './LiquidModal';

type ConfirmVariant = 'danger' | 'warning' | 'info';

const VARIANT_CFG: Record<ConfirmVariant, { icon: React.ReactNode; ring: string; btn: string }> = {
  danger: {
    icon: <Trash2 className="w-5 h-5 text-rose-300" />,
    ring: 'text-rose-300',
    btn: 'bg-rose-500/90 hover:bg-rose-500 text-white shadow-[0_0_24px_rgba(244,63,94,0.35)]',
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5 text-amber-300" />,
    ring: 'text-amber-300',
    btn: 'bg-amber-500/90 hover:bg-amber-500 text-white shadow-[0_0_24px_rgba(245,158,11,0.35)]',
  },
  info: {
    icon: <Info className="w-5 h-5 text-sky-300" />,
    ring: 'text-sky-300',
    btn: 'bg-sky-500/90 hover:bg-sky-500 text-white shadow-[0_0_24px_rgba(14,165,233,0.35)]',
  },
};

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  /** 默认 false。为 true 时隐藏取消按钮（用于 alert 语义） */
  hideCancel?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'danger',
  hideCancel = false,
}) => {
  const [submitting, setSubmitting] = React.useState(false);
  const cfg = VARIANT_CFG[variant];

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LiquidModal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={title}
      icon={cfg.icon}
      widthClass="max-w-md"
      blockCloseWhileSubmitting={submitting}
      footer={
        <div className="flex items-center justify-end gap-2.5">
          {!hideCancel && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={onClose}
              disabled={submitting}
              className="liquid-btn-ghost px-4 py-2 rounded-xl text-[13px] font-medium text-white/70 hover:text-white disabled:opacity-50"
            >
              {cancelText}
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleConfirm}
            disabled={submitting}
            className={clsx(
              'px-4 py-2 rounded-xl text-[13px] font-semibold disabled:opacity-60 flex items-center gap-2 transition-colors',
              cfg.btn,
            )}
          >
            {submitting && (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            )}
            {confirmText}
          </motion.button>
        </div>
      }
    >
      {description && (
        <div className="text-[13px] text-white/55 leading-relaxed">{description}</div>
      )}
    </LiquidModal>
  );
};

/** 便捷 Hook：管理 open 状态 + 透传 props 给 ConfirmDialog */
export function useConfirm() {
  const [open, setOpen] = React.useState(false);
  const openWith = React.useCallback(() => setOpen(true), []);
  const close = React.useCallback(() => setOpen(false), []);
  return { open, setOpen, openWith, close, dialogProps: { open, onClose: close } };
}
