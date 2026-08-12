import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ScrollText, Globe, Building2, Filter } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuditLogs } from '@/lib/queries';
import { useAuth } from '@/context/AuthContext';
import { LiquidSelect } from '@/components/ui/LiquidSelect';
import { Avatar } from '@/components/ui/Avatar';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/QueryError';

// 审计动作 → 中文标签 + 颜色
const ACTION_META: Record<string, { label: string; cls: string }> = {
  login: { label: '登录', cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' },
  logout: { label: '登出', cls: 'bg-slate-500/15 text-slate-200 border-slate-400/30' },
  register: { label: '注册', cls: 'bg-sky-500/15 text-sky-200 border-sky-400/30' },
  member_invite: { label: '邀请成员', cls: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/30' },
  member_remove: { label: '移除成员', cls: 'bg-rose-500/15 text-rose-200 border-rose-400/30' },
  role_change: { label: '角色变更', cls: 'bg-amber-500/15 text-amber-200 border-amber-400/30' },
  product_create: { label: '创建产品线', cls: 'bg-purple-500/15 text-purple-200 border-purple-400/30' },
  product_update: { label: '更新产品线', cls: 'bg-indigo-500/15 text-indigo-200 border-indigo-400/30' },
  product_delete: { label: '删除产品线', cls: 'bg-rose-500/15 text-rose-200 border-rose-400/30' },
  version_create: { label: '创建版本', cls: 'bg-teal-500/15 text-teal-200 border-teal-400/30' },
  version_update: { label: '更新版本', cls: 'bg-teal-500/15 text-teal-200 border-teal-400/30' },
  version_delete: { label: '删除版本', cls: 'bg-rose-500/15 text-rose-200 border-rose-400/30' },
  ai_config_update: { label: 'AI 配置变更', cls: 'bg-violet-500/15 text-violet-200 border-violet-400/30' },
  batch_op: { label: '批量操作', cls: 'bg-slate-500/15 text-slate-200 border-slate-400/30' },
  password_reset: { label: '密码重置', cls: 'bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-400/30' },
  task_delete: { label: '删除任务', cls: 'bg-rose-500/15 text-rose-200 border-rose-400/30' },
};

function actionMeta(action: string) {
  return ACTION_META[action] ?? { label: action, cls: 'bg-white/10 text-white/60 border-white/20' };
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / min)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  return new Date(iso).toLocaleString('zh-CN');
}

/**
 * P6-C：审计日志面板。
 *
 * - 系统管理员可切换「全局 / 当前工作区」两种视图；
 * - 普通成员（admin/pm）仅看当前工作区。
 */
export const AuditLogPanel: React.FC = () => {
  const { user } = useAuth();
  const isSystemAdmin = user?.role === 'system_admin';
  const [scope, setScope] = useState<'global' | 'workspace'>(isSystemAdmin ? 'global' : 'workspace');
  const [actionFilter, setActionFilter] = useState('all');

  const { data, isLoading, isError, refetch } = useAuditLogs(scope, {
    action: actionFilter !== 'all' ? actionFilter : undefined,
    page: 1,
  });

  if (isError) {
    return <QueryError onRetry={() => refetch()} message="审计日志加载失败" />;
  }

  const logs = data?.logs ?? [];

  return (
    <div className="space-y-3.5">
      {/* 视图切换 + 筛选 */}
      <div className="flex items-center gap-2 flex-wrap">
        {isSystemAdmin && (
          <div className="liquid-pill p-1 flex items-center gap-0.5">
            <button
              onClick={() => setScope('global')}
              className={clsx(
                'px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5',
                scope === 'global' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70',
              )}
            >
              <Globe className="w-3 h-3" /> 全局
            </button>
            <button
              onClick={() => setScope('workspace')}
              className={clsx(
                'px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5',
                scope === 'workspace' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70',
              )}
            >
              <Building2 className="w-3 h-3" /> 当前工作区
            </button>
          </div>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <Filter className="w-3.5 h-3.5 text-white/35" />
          <LiquidSelect
            variant="pill"
            value={actionFilter}
            onChange={setActionFilter}
            aria-label="动作筛选"
            options={[
              { value: 'all', label: '全部动作' },
              ...Object.entries(ACTION_META).map(([k, v]) => ({ value: k, label: v.label })),
            ]}
          />
        </div>
      </div>

      {!isSystemAdmin && scope === 'global' ? null : (
        <div className="text-[11px] text-white/40">
          {scope === 'global' ? '全局视图：记录所有登录、成员变更、产品/版本等系统级操作' : '工作区视图：仅当前工作区内的成员与配置变更'}
        </div>
      )}

      {/* 日志列表 */}
      <div className="liquid-glass rounded-2xl overflow-hidden">
        {isLoading ? (
          // P9-UX：骨架屏替代"加载中…"纯文字
          <div className="p-4"><SkeletonRows rows={4} /></div>
        ) : logs.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <ScrollText className="w-8 h-8 text-white/15 mx-auto mb-2" />
            <div className="text-[12px] text-white/40">暂无审计记录</div>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.04] max-h-[420px] overflow-y-auto">
            {logs.map((log) => {
              const meta = actionMeta(log.action);
              return (
                <motion.li
                  key={log.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="px-4 py-2.5 flex items-start gap-3"
                >
                  <Avatar avatar={log.actor?.avatar} name={log.actor?.name ?? '?'} size="sm" className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-medium text-white/85">{log.actor?.name ?? '系统'}</span>
                      <span className={clsx('px-1.5 py-0.5 rounded text-[9px] border', meta.cls)}>{meta.label}</span>
                      {log.ip && <span className="text-[10px] font-mono text-white/25">{log.ip}</span>}
                    </div>
                    <p className="text-[11px] text-white/55 leading-relaxed mt-0.5 break-words">{log.target}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-white/30 mt-1">{timeAgo(log.createdAt)}</span>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>

      {data && data.total > data.pageSize && (
        <div className="text-center text-[11px] text-white/35">
          显示最近 {logs.length} 条 / 共 {data.total} 条
        </div>
      )}
    </div>
  );
};
