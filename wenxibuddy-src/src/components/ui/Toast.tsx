import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

export const Toast: React.FC<{ message: string }> = ({ message }) => (
  <AnimatePresence>
    {!!message && (
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10 }}
        className="fixed bottom-6 right-6 z-[90] px-4 py-3 rounded-2xl bg-emerald-500/15 border border-emerald-400/35 text-emerald-100 text-[12px] font-medium flex items-center gap-2 shadow-2xl backdrop-blur-2xl pointer-events-none"
      >
        <CheckCircle2 className="w-4 h-4 text-emerald-300" />
        {message}
      </motion.div>
    )}
  </AnimatePresence>
);

export function useToast() {
  const [message, setMessage] = React.useState('');
  const show = React.useCallback((msg: string) => {
    setMessage(msg);
    window.setTimeout(() => setMessage(''), 2200);
  }, []);
  return { message, show, ToastEl: <Toast message={message} /> };
}
