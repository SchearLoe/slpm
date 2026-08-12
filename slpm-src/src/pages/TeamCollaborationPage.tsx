import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, UserCheck, MessageSquare, UserMinus } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { LiquidModal } from '@/components/ui/LiquidModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LiquidSelect } from '@/components/ui/LiquidSelect';
import { QueryError } from '@/components/QueryError';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useApp } from '@/context/AppContext';
import { springSoft } from '@/lib/motion';
import { useTasks, useWorkspaceMembers, useWorkspaceOnline, useInviteMember, useRemoveMember, useUpdateMemberRole, useSendMessage } from '@/lib/queries';
import { onPresence, onPresenceInit } from '@/lib/socket';
import { apiError } from '@/lib/api';
import { ROLE_OPTIONS, getRoleConfig } from '@/lib/roleConfig';
import { WsRole } from '@/types';

export const TeamCollaborationPage: React.FC = () => {
  const { show, ToastEl } = useToast();
  // P1-2：按当前工作区角色禁用邀请/移除按钮（仅 admin 可邀请、可改角色）
  const { currentRole, currentWorkspace } = useApp();
  const canManage = currentRole === 'admin';
  const wsId = currentWorkspace?.id;

  // P1-3：成员列表来自真实 workspace 成员（替代写死的 initialMembers）
  const { data: members = [], isLoading, isError: membersError, refetch: refetchMembers } = useWorkspaceMembers(wsId);
  // P4-2：在线成员（快照 + WebSocket presence 实时更新）
  const { data: onlineSnapshot } = useWorkspaceOnline(wsId);
  const [onlineSet, setOnlineSet] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (onlineSnapshot) setOnlineSet(onlineSnapshot);
  }, [onlineSnapshot]);
  useEffect(() => {
    const offInit = onPresenceInit(({ online }) => setOnlineSet(new Set(online)));
    const offPresence = onPresence(({ userId, online }) => {
      setOnlineSet((prev) => {
        const next = new Set(prev);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
    });
    return () => {
      offInit();
      offPresence();
    };
  }, []);
  // P1-3：在办任务数从真实任务聚合（按 assigneeId 计未完成数）
  const { data: tasks = [] } = useTasks();

  const inProgressByUser = useMemo(() => {
    const map = new Map<string, { inProgress: number; completed: number }>();
    for (const t of tasks) {
      const uid = t.assigneeId;
      if (!uid) continue;
      const cur = map.get(uid) ?? { inProgress: 0, completed: 0 };
      if (t.status === '已完成') cur.completed += 1;
      else cur.inProgress += 1;
      map.set(uid, cur);
    }
    return map;
  }, [tasks]);

  const inviteMut = useInviteMember(wsId);
  const removeMut = useRemoveMember(wsId);
  const updateRoleMut = useUpdateMemberRole(wsId);
  // P4-1：真实站内信（替代演示 toast）
  const sendMsg = useSendMessage();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState<(typeof members)[number] | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WsRole>('dev');
  const [msgText, setMsgText] = useState('');
  // P9-UX2：成员移除二次确认（替代原生 window.confirm）
  const [pendingRemove, setPendingRemove] = useState<{ userId: string; name: string } | null>(null);

  // P4-1：真实站内信发送
  const handleSendMsg = async () => {
    if (!msgOpen || !msgText.trim() || sendMsg.isPending) return;
    try {
      await sendMsg.mutateAsync({ userId: msgOpen.userId, title: '协同消息', body: msgText.trim() });
      setMsgOpen(null);
      show(`站内信已发送给 ${msgOpen.name}`);
    } catch (err) {
      show(apiError(err, '发送失败'));
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    try {
      const member = await inviteMut.mutateAsync({ email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail('');
      setInviteOpen(false);
      show(`已邀请 ${member.name} 加入工作区`);
    } catch (err) {
      show(apiError(err, '邀请失败'));
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await removeMut.mutateAsync(userId);
      show('已移除成员');
    } catch (err) {
      show(apiError(err, '移除失败'));
    }
  };

  const handleRoleChange = async (userId: string, role: WsRole, name: string) => {
    try {
      await updateRoleMut.mutateAsync({ userId, role });
      show(`${name} 的角色已切换为 ${getRoleConfig(role).label}`);
    } catch (err) {
      show(apiError(err, '角色切换失败'));
    }
  };

  if (membersError) {
    return <QueryError onRetry={() => refetchMembers()} message="成员列表加载失败，请检查网络或工作区状态" />;
  }

  return (
    <div className="w-full min-h-full space-y-5 pb-4">
      {ToastEl}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[20px] font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-300" />
            团队协作矩阵
          </h2>
          <p className="text-[12px] text-white/40">
            {currentWorkspace ? `工作区 · ${currentWorkspace.name}` : '实时协同状态'} · 成员负载把控与任务协同流
          </p>
        </div>
        <button
          onClick={() => {
            if (!canManage) {
              show('需要管理员权限才能邀请成员');
              return;
            }
            setInviteOpen(true);
          }}
          disabled={!canManage}
          title={canManage ? '邀请新成员加入当前工作区' : '仅管理员可邀请成员'}
          className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <UserCheck className="w-4 h-4" />
          邀请新成员
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {/* P9-UX：加载中骨架屏（原实现空白，用户以为没成员） */}
        {isLoading && (
          <div className="col-span-full">
            <SkeletonCards cards={3} />
          </div>
        )}
        {members.map((member, idx) => {
          const stats = inProgressByUser.get(member.userId) ?? { inProgress: 0, completed: 0 };
          // P4-1：负荷饱和度 = 在办任务数相对最高者的归一化（真实数据，替代 ×10% 公式）
          const maxInProgress = Math.max(1, ...members.map((m) => inProgressByUser.get(m.userId)?.inProgress ?? 0));
          const workload = stats.inProgress > 0 ? Math.round((stats.inProgress / maxInProgress) * 100) : 0;
          const isAdmin = member.role === 'admin';
          return (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, ...springSoft }}
            >
              <GlassCard variant="interactive" className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-11 h-11 rounded-2xl liquid-icon-well font-bold text-[12px] text-white flex items-center justify-center shrink-0 overflow-hidden">
                      {member.avatar && member.avatar.startsWith('avatars/') ? (
                        <img src={`/api/auth/avatar/${member.avatar.split('/').pop()}`} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        member.avatar ?? member.name.slice(0, 2).toUpperCase()
                      )}
                      {/* P4-2：在线状态绿点 */}
                      <span
                        className={`absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full border-2 border-black/40 transition-colors ${
                          onlineSet.has(member.userId) ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]' : 'bg-white/20'
                        }`}
                        title={onlineSet.has(member.userId) ? '在线' : '离线'}
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[13px] font-bold text-white truncate">{member.name}</h3>
                      <p className="text-[11px] text-white/40 truncate">{member.email}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium shrink-0 border ${getRoleConfig(member.role).color} border-white/10`}
                  >
                    {getRoleConfig(member.role).label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-black/25 border border-white/[0.05]">
                    <div className="text-white/40">在办任务</div>
                    <div className="text-[16px] font-bold text-white font-mono mt-0.5">{stats.inProgress} 项</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/25 border border-white/[0.05]">
                    <div className="text-white/40">已完成</div>
                    <div className="text-[16px] font-bold text-emerald-300 font-mono mt-0.5">{stats.completed} 项</div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  {canManage && (
                    <LiquidSelect
                      value={member.role}
                      onChange={(v) => handleRoleChange(member.userId, v as WsRole, member.name)}
                      variant="pill"
                      options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
                    />
                  )}
                  <button
                    onClick={() => {
                      setMsgOpen(member);
                      setMsgText('');
                    }}
                    className="liquid-btn-ghost w-9 h-9 rounded-xl flex items-center justify-center text-white/60 hover:text-white"
                    title="发消息"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                  {canManage && (
                    <button
                      onClick={() => setPendingRemove({ userId: member.userId, name: member.name })}
                      className="liquid-btn-ghost w-9 h-9 rounded-xl flex items-center justify-center text-white/60 hover:text-rose-300"
                      title="移除成员"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
        {members.length === 0 && !isLoading && (
          <div className="col-span-full">
            <EmptyState
              icon={<Users className="w-7 h-7" />}
              title="当前工作区暂无其他成员"
              description="邀请同事加入，开始协同管理任务、日程与文件吧"
              action={canManage ? { label: '邀请新成员', onClick: () => setInviteOpen(true) } : undefined}
            />
          </div>
        )}
      </div>

      <LiquidModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="邀请新成员"
        subtitle="加入当前工作区协作（需对方已注册）"
        icon={<UserCheck className="w-5 h-5" />}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setInviteOpen(false)} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">取消</button>
            <button form="invite-form" type="submit" disabled={inviteMut.isPending} className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold disabled:opacity-50">
              {inviteMut.isPending ? '发送中…' : '发送邀请'}
            </button>
          </div>
        }
      >
        <form id="invite-form" onSubmit={handleInvite} className="space-y-3">
          <input
            required
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="成员邮箱（需已注册）"
            className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white"
          />
          <LiquidSelect
            value={inviteRole}
            onChange={(v) => setInviteRole(v as WsRole)}
            options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
          />
        </form>
      </LiquidModal>

      <LiquidModal
        open={!!msgOpen}
        onClose={() => setMsgOpen(null)}
        title={msgOpen ? `消息 · ${msgOpen.name}` : '消息'}
        subtitle={msgOpen?.email}
        icon={<MessageSquare className="w-5 h-5" />}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setMsgOpen(null)} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">取消</button>
            <button
              onClick={handleSendMsg}
              disabled={!msgText.trim() || sendMsg.isPending}
              className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold disabled:opacity-50"
            >
              {sendMsg.isPending ? '发送中…' : '发送'}
            </button>
          </div>
        }
      >
        <textarea
          rows={4}
          value={msgText}
          onChange={(e) => setMsgText(e.target.value)}
          placeholder="输入协同消息，将作为站内信推送给对方…"
          className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white resize-none"
        />
      </LiquidModal>

      {/* P9-UX2：移除成员二次确认 */}
      <ConfirmDialog
        open={!!pendingRemove}
        onClose={() => setPendingRemove(null)}
        onConfirm={async () => {
          if (pendingRemove) await handleRemove(pendingRemove.userId);
        }}
        variant="danger"
        title="移除成员？"
        description={<>确定将「{pendingRemove?.name}」移出当前工作区？该成员将无法再访问此工作区的任务、日程与文件。</>}
        confirmText="移除"
      />
    </div>
  );
};

export default TeamCollaborationPage;
