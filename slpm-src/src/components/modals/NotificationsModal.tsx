import React, { useState } from 'react';
import { Bell, CheckCheck, Trash2, AlertTriangle, UserPlus, AtSign } from 'lucide-react';
import { LiquidModal } from '@/components/ui/LiquidModal';
import { LiquidSelect } from '@/components/ui/LiquidSelect';
import { motion } from 'framer-motion';
import { AppNotification, NotificationType } from '@/types';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useClearReadNotifications,
} from '@/lib/queries';
import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';

interface NotificationsModalProps {
  open: boolean;
  onClose: () => void;
}

// 类型 → 图标 / 配色（与原 demo 视觉一致）
const iconMap: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  mention: AtSign,
  assign: UserPlus,
  system: AlertTriangle,
};

const colorMap: Record<NotificationType, string> = {
  mention: 'text-cyan-300 bg-cyan-500/15 border-cyan-400/25',
  assign: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/25',
  system: 'text-amber-300 bg-amber-500/15 border-amber-400/25',
};

// 后端 type 归一化（防御旧值，兜底 system）
function normalizedType(t: string): NotificationType {
  return t === 'mention' || t === 'assign' ? t : 'system';
}

// ISO → 相对时间（如「3 分钟前」「昨天」），与原 demo 的中文相对时间一致
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / min)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 2 * day) return '昨天';
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ open, onClose }) => {
  const { data: notifications = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const clearRead = useClearReadNotifications();

  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  // P6-E4：类型筛选
  const [typeFilter, setTypeFilter] = useState<'all' | AppNotification['type']>('all');

  const { currentWorkspace, setCurrentWorkspace, setSelectedTask } = useApp();
  const navigate = useNavigate();

  const unread = notifications.filter((n) => !n.read).length;
  // P6-E4：未读优先排序（未读在前，同状态按时间倒序）+ 类型筛选
  const visible = notifications
    .filter((n) => (filter === 'unread' ? !n.read : true))
    .filter((n) => (typeFilter === 'all' ? true : n.type === typeFilter))
    .slice()
    .sort((a, b) => {
      if (a.read !== b.read) return a.read ? -1 : 1; // 未读优先
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  const handleClearRead = () => {
    clearRead.mutate();
  };

  // 点击单条：标记已读；带 taskId 的跳转到任务详情页（必要时先切到通知所属工作区）
  const handleClick = (n: AppNotification) => {
    if (!n.read) markRead.mutate(n.id);
    if (!n.taskId) return;
    // 任务归属的工作区可能与当前不同：切过去才能在任务页看到该任务
    if (currentWorkspace && n.workspaceId && currentWorkspace.id !== n.workspaceId) {
      setCurrentWorkspace(n.workspaceId);
    }
    // P6-E1：直接跳到任务详情独立页（精确 deep-link）
    setSelectedTask(null);
    onClose();
    navigate(`/tasks/${n.taskId}`);
  };

  return (
    <LiquidModal
      open={open}
      onClose={onClose}
      title="消息通知"
      subtitle={`${unread} 条未读 · 共 ${notifications.length} 条`}
      icon={<Bell className="w-5 h-5" />}
      widthClass="max-w-lg"
      footer={
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={handleClearRead}
            className="h-10 px-3 rounded-full liquid-btn-ghost text-[12px] text-white/55 flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            清除已读
          </button>
          <div className="flex items-center gap-2">
            <button onClick={handleMarkAllRead} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/70 flex items-center gap-1.5">
              <CheckCheck className="w-3.5 h-3.5" />
              全部已读
            </button>
            <button onClick={onClose} className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold">
              关闭
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="liquid-pill p-1 inline-flex items-center gap-0.5">
            {([
              ['all', '全部'],
              ['unread', '未读'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                  filter === id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {/* P6-E4：类型筛选 */}
          <div className="ml-auto">
            <LiquidSelect
              variant="pill"
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as typeof typeFilter)}
              aria-label="类型筛选"
              options={[
                { value: 'all', label: '全部类型' },
                { value: 'mention', label: '@ 提及' },
                { value: 'assign', label: '任务指派' },
                { value: 'system', label: '系统通知' },
              ]}
            />
          </div>
        </div>

        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-0.5">
          {isLoading && <div className="py-12 text-center text-[12px] text-white/35">加载中…</div>}
          {!isLoading && visible.length === 0 && (
            <div className="py-12 text-center text-[12px] text-white/35">
              {filter === 'unread' ? '暂无未读通知' : '暂无通知'}
            </div>
          )}
          {visible.map((n, i) => {
            const t = normalizedType(n.type);
            const Icon = iconMap[t];
            return (
              <motion.button
                key={n.id}
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => handleClick(n)}
                className={`w-full text-left p-3 rounded-2xl border transition-colors flex gap-3 ${
                  n.read
                    ? 'bg-white/[0.02] border-white/[0.05] opacity-70'
                    : 'bg-white/[0.04] border-white/10 hover:border-emerald-400/25'
                }`}
              >
                <span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${colorMap[t]}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-medium text-white leading-snug">{n.title}</p>
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />}
                  </div>
                  {n.body && <p className="text-[11px] text-white/45 mt-1 line-clamp-2">{n.body}</p>}
                  <p className="text-[10px] text-white/30 mt-1">{timeAgo(n.createdAt)}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </LiquidModal>
  );
};
