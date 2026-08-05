import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

// 路由守卫：未登录跳 /login，登录后回跳来源页
export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // token 校验期间显示启动画面（复用 Liquid Glass 风格）
  if (loading) {
    return (
      <div className="w-full h-screen liquid-shell flex items-center justify-center">
        <div className="text-white/60 text-[13px] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          正在加载…
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};
