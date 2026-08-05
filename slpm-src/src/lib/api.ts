import axios, { AxiosError } from 'axios';

const TOKEN_KEY = 'slpm_token';
const WS_KEY = 'slpm_workspace';

// 取/存 token（localStorage）
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// P1-2：当前选中的工作区 id（localStorage，供 axios 拦截器读取）
export const workspaceStore = {
  get: () => localStorage.getItem(WS_KEY),
  set: (id: string) => localStorage.setItem(WS_KEY, id),
  clear: () => localStorage.removeItem(WS_KEY),
};

// P3：当前选中的产品线 id（localStorage）
export const productStore = {
  get: () => localStorage.getItem('slpm_product'),
  set: (id: string) => localStorage.setItem('slpm_product', id),
  clear: () => localStorage.removeItem('slpm_product'),
};

// axios 实例：baseURL 走 vite proxy（/api → 后端 8080）
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  timeout: 15000,
});

// 请求拦截器：自动注入 Bearer token + X-Workspace-Id
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // P1-2：注入当前工作区（auth/workspaces 自身的请求不需要，但加上无害）
  const wsId = workspaceStore.get();
  if (wsId) {
    config.headers['X-Workspace-Id'] = wsId;
  }
  return config;
});

// 响应拦截器：401 → 清 token 并跳登录页
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ error?: string }>) => {
    if (error.response?.status === 401) {
      tokenStore.clear();
      // 避免在登录页自身循环跳转
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?from=' + encodeURIComponent(window.location.pathname);
      }
    }
    return Promise.reject(error);
  },
);

// 统一提取后端错误信息
export function apiError(e: unknown, fallback = '请求失败'): string {
  if (axios.isAxiosError(e)) {
    return e.response?.data?.error || e.message || fallback;
  }
  return fallback;
}

// P1-3：字节数 → 人类可读大小（如 1.2 MB）
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
