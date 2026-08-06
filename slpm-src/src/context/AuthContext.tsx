import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, tokenStore, workspaceStore, apiError } from '@/lib/api';
import { connectSocket, disconnectSocket, onNotification } from '@/lib/socket';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean; // 启动时校验 token 期间
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  // P1-2：重新拉取当前用户（含 workspaces），新建工作区/成员变更后调用
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  // 启动时：若有 token，调 /auth/me 恢复会话
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<{ user: User }>('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => {
        tokenStore.clear();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // P1-6：WebSocket 生命周期（登录连接，登出断开，收到通知刷新缓存）
  // P5-2：依赖 user?.id 而非 user 对象，避免 refreshUser 时 setUser 触发不必要的重连
  const userId = user?.id;
  useEffect(() => {
    const token = tokenStore.get();
    if (!token || !userId) return;
    connectSocket(token);
    const off = onNotification(() => {
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    });
    return () => {
      off();
      disconnectSocket();
    };
  }, [userId, qc]);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    tokenStore.set(res.data.token);
    setUser(res.data.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const res = await api.post<{ token: string; user: User }>('/auth/register', {
      email,
      password,
      name,
    });
    tokenStore.set(res.data.token);
    setUser(res.data.user);
  };

  const logout = () => {
    tokenStore.clear();
    workspaceStore.clear();
    setUser(null);
  };

  // P1-2：重新拉取当前用户（含 workspaces）
  const refreshUser = async () => {
    const res = await api.get<{ user: User }>('/auth/me');
    setUser(res.data.user);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return ctx;
}

export { apiError };
