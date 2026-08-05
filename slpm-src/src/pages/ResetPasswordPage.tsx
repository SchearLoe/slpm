import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { KeyRound, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { api, apiError } from '@/lib/api';

/** P4-2：密码重置页（/reset-password?token=xxx） */
export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const field = 'liquid-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-[12px] text-white placeholder:text-white/30';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('密码至少 6 位');
      return;
    }
    if (password !== confirm) {
      setError('两次输入的密码不一致');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setDone(true);
    } catch (err) {
      setError(apiError(err, '重置失败'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full h-screen liquid-shell flex items-center justify-center p-4 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96, filter: 'blur(12px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        transition={{ type: 'spring', stiffness: 360, damping: 26, mass: 0.8 }}
        className="liquid-glass w-full max-w-[400px] p-8 relative overflow-hidden"
      >
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="absolute top-0 inset-x-10 h-px origin-center bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent"
        />
        <div className="pointer-events-none absolute -top-16 right-0 w-40 h-40 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="flex flex-col items-center text-center mb-6 relative z-10">
          <div className="w-14 h-14 rounded-[16px] bg-gradient-to-br from-emerald-300 via-emerald-400 to-teal-500 flex items-center justify-center font-extrabold text-[#04120c] text-[14px] shadow-[0_0_24px_rgba(16,185,129,0.45)] border border-white/40 mb-3">
            SLPM
          </div>
          <h1 className="text-[20px] font-bold text-white tracking-tight">重置密码</h1>
          <p className="text-[11px] text-white/40 mt-1">设置新密码，令牌 15 分钟内有效</p>
        </div>

        {done ? (
          <div className="space-y-4 relative z-10 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto" />
            <p className="text-[13px] text-white/70">密码已重置成功，请使用新密码登录</p>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/login')}
              className="w-full h-10 rounded-full liquid-btn-primary text-[12px] font-bold flex items-center justify-center gap-1.5"
            >
              去登录 <ArrowRight className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        ) : !token ? (
          <div className="space-y-4 relative z-10 text-center">
            <KeyRound className="w-10 h-10 text-rose-300/80 mx-auto" />
            <p className="text-[13px] text-white/70">重置链接无效：缺少令牌参数</p>
            <button onClick={() => navigate('/login')} className="w-full h-10 rounded-full liquid-btn-ghost text-[12px] text-white/70">
              返回登录
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 relative z-10">
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-white/35 absolute left-3.5 top-1/2 -translate-y-1/2 z-10" />
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="新密码（至少 6 位）"
                minLength={6}
                className={field}
              />
            </div>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-white/35 absolute left-3.5 top-1/2 -translate-y-1/2 z-10" />
              <input
                required
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="确认新密码"
                minLength={6}
                className={field}
              />
            </div>
            {error && (
              <div className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-400/25 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <motion.button
              type="submit"
              disabled={busy}
              whileTap={{ scale: 0.98 }}
              className="w-full h-10 rounded-full liquid-btn-primary text-[12px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {busy ? '重置中…' : '重置密码'}
              {!busy && <ArrowRight className="w-3.5 h-3.5" />}
            </motion.button>
          </form>
        )}
      </motion.div>
    </div>
  );
};
