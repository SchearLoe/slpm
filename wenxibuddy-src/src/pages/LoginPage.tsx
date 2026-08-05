import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Mail, Lock, User as UserIcon, ArrowRight } from 'lucide-react';
import { useAuth, apiError } from '@/context/AuthContext';

type Mode = 'login' | 'register';

export const LoginPage: React.FC = () => {
  const { login, register: registerFn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from || '/tasks';

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await registerFn(email, password, name || email.split('@')[0]);
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(apiError(err, '登录失败'));
    } finally {
      setBusy(false);
    }
  };

  const field =
    'liquid-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-[12px] text-white placeholder:text-white/30';

  return (
    <div className="w-full h-screen liquid-shell flex items-center justify-center p-4 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96, filter: 'blur(12px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        transition={{ type: 'spring', stiffness: 360, damping: 26, mass: 0.8 }}
        className="liquid-glass w-full max-w-[400px] p-8 relative overflow-hidden"
      >
        {/* 顶部光带 */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="absolute top-0 inset-x-10 h-px origin-center bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent"
        />
        <div className="pointer-events-none absolute -top-16 right-0 w-40 h-40 rounded-full bg-emerald-400/10 blur-3xl" />

        {/* Logo 区 */}
        <div className="flex flex-col items-center text-center mb-6 relative z-10">
          <div className="w-14 h-14 rounded-[16px] bg-gradient-to-br from-emerald-300 via-emerald-400 to-teal-500 flex items-center justify-center font-extrabold text-[#04120c] text-[14px] shadow-[0_0_24px_rgba(16,185,129,0.45)] border border-white/40 mb-3">
            SLPM
          </div>
          <h1 className="text-[20px] font-bold text-white tracking-tight">SLPM</h1>
          <p className="text-[11px] text-white/40 mt-1">智能任务与项目管理</p>
        </div>

        {/* 模式切换 */}
        <div className="liquid-pill p-1 flex items-center gap-0.5 mb-5 relative z-10">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError('');
              }}
              className={`relative px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors z-10 flex-1 ${
                mode === m ? 'text-white' : 'text-white/40 hover:text-white/70'
              }`}
            >
              {mode === m && (
                <motion.span
                  layoutId="auth-mode-pill"
                  className="absolute inset-0 rounded-full bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10">{m === 'login' ? '登录' : '注册'}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 relative z-10">
          <AnimatePresence>
            {mode === 'register' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="relative pb-3">
                  <UserIcon className="w-3.5 h-3.5 text-white/35 absolute left-3.5 top-1/2 -translate-y-1/2 z-10" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="姓名（可选）"
                    className={field}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            <Mail className="w-3.5 h-3.5 text-white/35 absolute left-3.5 top-1/2 -translate-y-1/2 z-10" />
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="邮箱"
              className={field}
            />
          </div>

          <div className="relative">
            <Lock className="w-3.5 h-3.5 text-white/35 absolute left-3.5 top-1/2 -translate-y-1/2 z-10" />
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码（至少 6 位）"
              minLength={6}
              className={field}
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-400/25 rounded-lg px-3 py-2"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={busy}
            whileTap={{ scale: 0.98 }}
            className="w-full h-10 rounded-full liquid-btn-primary text-[12px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {busy ? '处理中…' : mode === 'login' ? '登录' : '创建账号'}
            {!busy && <ArrowRight className="w-3.5 h-3.5" />}
          </motion.button>
        </form>

        <p className="text-[10px] text-white/30 text-center mt-5 relative z-10 flex items-center justify-center gap-1">
          <Target className="w-3 h-3" />
          {mode === 'login' ? '还没有账号？点击上方「注册」' : '已有账号？点击上方「登录」'}
        </p>
      </motion.div>
    </div>
  );
};
