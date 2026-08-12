import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { clsx } from 'clsx';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

const VARIANT_STYLE: Record<ToastVariant, { wrap: string; icon: string; Icon: React.FC<{ className?: string }> }> = {
  success: {
    wrap: 'bg-emerald-500/15 border-emerald-400/35 text-emerald-100',
    icon: 'text-emerald-300',
    Icon: CheckCircle2,
  },
  error: {
    wrap: 'bg-rose-500/15 border-rose-400/35 text-rose-100',
    icon: 'text-rose-300',
    Icon: XCircle,
  },
  warning: {
    wrap: 'bg-amber-500/15 border-amber-400/35 text-amber-100',
    icon: 'text-amber-300',
    Icon: AlertTriangle,
  },
  info: {
    wrap: 'bg-sky-500/15 border-sky-400/35 text-sky-100',
    icon: 'text-sky-300',
    Icon: Info,
  },
};

// P8：启发式判别 —— 未显式指定 variant 时根据文案语义自动着色。
// 这样历史所有 `show(msg)` 调用点零改动即获得"错误用红、警告用黄"的正确反馈。
const ERROR_KEYWORDS = ['失败', '错误', '出错', '异常', '无效', '过期', '无权', '权限', '禁止', '不能', '请先', '不存在', '至少', '必须', '请求过于频繁'];
const WARNING_KEYWORDS = ['警告', '注意', '提醒', '冲突', '已占用', '接近', '即将'];

function detectVariant(msg: string): ToastVariant {
  if (ERROR_KEYWORDS.some((k) => msg.includes(k))) return 'error';
  if (WARNING_KEYWORDS.some((k) => msg.includes(k))) return 'warning';
  return 'success';
}

export const ToastStack: React.FC<{ items: ToastItem[]; onDismiss: (id: number) => void }> = ({ items, onDismiss }) => (
  <div className="fixed bottom-6 right-6 z-[95] flex flex-col gap-2 items-end pointer-events-none">
    <AnimatePresence>
      {items.map((t) => {
        const cfg = VARIANT_STYLE[t.variant];
        const Icon = cfg.Icon;
        return (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className={clsx(
              'px-4 py-3 rounded-2xl border text-[12.5px] font-medium flex items-center gap-2.5 shadow-2xl backdrop-blur-2xl pointer-events-auto max-w-[min(92vw,420px)]',
              cfg.wrap,
            )}
          >
            <Icon className={clsx('w-4 h-4 shrink-0', cfg.icon)} />
            <span className="leading-relaxed">{t.message}</span>
            <button
              onClick={() => onDismiss(t.id)}
              aria-label="关闭通知"
              className="ml-1 -mr-1 w-5 h-5 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        );
      })}
    </AnimatePresence>
  </div>
);

export function useToast() {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const idRef = React.useRef(0);
  const timersRef = React.useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const tm = timersRef.current.get(id);
    if (tm) {
      clearTimeout(tm);
      timersRef.current.delete(id);
    }
  }, []);

  // P8：修复计时 bug —— 旧实现每次 show 都新建 setTimeout 却不 clear 旧的，
  // 连续 show 两条时第一条的 timer 会把第二条提前清掉。现按 id 管理 timer。
  const push = React.useCallback(
    (message: string, variant?: ToastVariant) => {
      if (!message) return;
      const id = ++idRef.current;
      const v = variant ?? detectVariant(message);
      setItems((prev) => [...prev.slice(-3), { id, message, variant: v }]); // 最多堆叠 4 条
      const tm = setTimeout(() => dismiss(id), 3200);
      timersRef.current.set(id, tm);
    },
    [dismiss],
  );

  const show = React.useCallback((msg: string, variant?: ToastVariant) => push(msg, variant), [push]);
  const success = React.useCallback((msg: string) => push(msg, 'success'), [push]);
  const error = React.useCallback((msg: string) => push(msg, 'error'), [push]);
  const warning = React.useCallback((msg: string) => push(msg, 'warning'), [push]);
  const info = React.useCallback((msg: string) => push(msg, 'info'), [push]);

  // 卸载时清掉所有残留 timer，避免在已卸载组件上 setState
  React.useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  // 兼容旧 API：ToastEl（单条 → 现在渲染整个堆叠栈）
  const ToastEl = <ToastStack items={items} onDismiss={dismiss} />;

  return { message: items[0]?.message ?? '', items, show, success, error, warning, info, dismiss, ToastEl };
}
