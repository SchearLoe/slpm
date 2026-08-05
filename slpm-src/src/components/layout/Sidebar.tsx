import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  BarChart3,
  FileText,
  Calendar,
  Users,
  Sparkles,
  BookOpen,
  Settings,
  Plus,
  ChevronDown,
  ChevronRight,
  UserCheck,
  LogOut,
  User,
  Package,
  Layers,
  Camera,
} from 'lucide-react';
import { NavTab } from '@/types';
import { clsx } from 'clsx';
import { LiquidModal } from '@/components/ui/LiquidModal';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { api, apiError } from '@/lib/api';
import { getRoleConfig } from '@/lib/roleConfig';
import { useCreateProduct } from '@/lib/queries';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

const navItems: { id: NavTab; label: string; icon: React.ElementType; badge?: string }[] = [
  { id: 'tasks', label: '任务管理', icon: Target },
  { id: 'overview', label: '项目总览', icon: BarChart3 },
  { id: 'files', label: '文件归档', icon: FileText },
  { id: 'schedule', label: '日程管理', icon: Calendar },
  { id: 'collaboration', label: '团队协作', icon: Users },
  { id: 'analytics', label: '智能分析', icon: Sparkles, badge: 'AI' },
  { id: 'knowledge', label: '知识库', icon: BookOpen },
  { id: 'settings', label: '设置中心', icon: Settings },
  // P3：产品管理（产品线聚合视图）
  { id: 'product', label: '产品管理', icon: Package },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const { show, ToastEl } = useToast();
  const { user, logout, refreshUser } = useAuth();
  // P1-2：从 AppContext 取真实工作区（替代原硬编码 + 本地 state）
  const { workspaces, currentWorkspace, setCurrentWorkspace, addWorkspace, currentRole, products, currentProduct, setCurrentProduct } = useApp();
  // P2-1：按角色排序导航
  const roleCfg = getRoleConfig(currentRole);
  const sortedNavItems = roleCfg.navOrder
    .map((id) => navItems.find((n) => n.id === id))
    .filter((n): n is { id: NavTab; label: string; icon: React.ElementType; badge?: string } => !!n);
  // P3：产品管理入口 —— 存在产品且当前用户在产品下有 po/admin 权限时置顶显示
  const canManageProduct = !!currentProduct && (currentProduct.role === 'po' || currentProduct.role === 'admin');
  const effectiveNavItems = canManageProduct && !sortedNavItems.some((n) => n.id === 'product')
    ? [navItems[navItems.length - 1], ...sortedNavItems]
    : sortedNavItems;
  const [workspaceExpanded, setWorkspaceExpanded] = useState(false);
  const [productExpanded, setProductExpanded] = useState(false);
  const [createWsOpen, setCreateWsOpen] = useState(false);
  const [createProdOpen, setCreateProdOpen] = useState(false);
  const [wsName, setWsName] = useState('');
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  // profile 从当前登录用户初始化（替代原硬编码 Brandon）
  const [profile, setProfile] = useState({ name: user?.name || '', role: user?.role || '成员', email: user?.email || '' });

  // P4-1：真实保存个人资料（PATCH /auth/me）
  const saveProfile = async () => {
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      await api.patch('/auth/me', { name: profile.name.trim(), role: profile.role.trim() });
      await refreshUser();
      setProfileOpen(false);
      show('资料已保存');
    } catch (err) {
      show(apiError(err, '保存失败'));
    } finally {
      setSavingProfile(false);
    }
  };

  // P4-1：真实头像上传（POST /auth/avatar → 刷新用户）
  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 允许重复选择同一文件
    if (!file) return;
    try {
      setAvatarPreview(URL.createObjectURL(file));
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post<{ user: { avatar: string }; avatar: string }>('/auth/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
      setAvatarPreview(null);
      await refreshUser();
      show('头像已更新');
    } catch (err) {
      setAvatarPreview(null);
      show(apiError(err, '头像上传失败'));
    }
  };

  // user 变化时（登录后）同步 profile
  React.useEffect(() => {
    if (user) setProfile({ name: user.name, role: user.role, email: user.email });
  }, [user]);

  // P1-2：新建工作区 —— 调真实 API
  const createWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsName.trim() || creating) return;
    setCreating(true);
    try {
      const ws = await addWorkspace(wsName.trim());
      setWsName('');
      setCreateWsOpen(false);
      show(`工作区「${ws.name}」已创建`);
    } catch (err) {
      show(apiError(err, '创建失败'));
    } finally {
      setCreating(false);
    }
  };

  // P3：新建产品线
  const createProduct = useCreateProduct();
  const createProductLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim() || creating) return;
    setCreating(true);
    try {
      const p = await createProduct.mutateAsync({ name: prodName.trim(), description: prodDesc.trim() });
      setCurrentProduct(p.id);
      setProdName('');
      setProdDesc('');
      setCreateProdOpen(false);
      show(`产品线「${p.name}」已创建`);
    } catch (err) {
      show(apiError(err, '创建失败'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      {ToastEl}
      <aside className="liquid-glass h-full w-full min-w-0 min-h-0 flex flex-col justify-between p-3 sm:p-3.5 select-none overflow-hidden">
        <div className="space-y-5 min-h-0 overflow-y-auto pr-0.5">
          <div className="flex items-center gap-2.5 px-1.5 pt-1">
            <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-emerald-300 via-emerald-400 to-teal-500 flex items-center justify-center font-extrabold text-[#04120c] text-[10px] shadow-[0_0_24px_rgba(16,185,129,0.45)] border border-white/40">
              SLPM
            </div>
            <span className="text-[15px] font-bold text-white tracking-wide">SLPM</span>
          </div>

          <nav className="space-y-1">
            {effectiveNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={clsx(
                    'w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-[13px] font-medium transition-all duration-300 relative group',
                    isActive ? 'text-white' : 'text-white/45 hover:text-white/80'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-liquid"
                      className="absolute inset-0 rounded-2xl liquid-glass-active"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  {!isActive && <span className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity bg-white/[0.04]" />}
                  <span className="relative z-10 flex items-center gap-2.5">
                    <Icon className={clsx('w-[15px] h-[15px]', isActive ? 'text-emerald-300' : 'text-white/40 group-hover:text-white/70')} strokeWidth={1.75} />
                    <span>{item.label}</span>
                  </span>
                  <span className="relative z-10 flex items-center gap-1">
                    {item.badge && (
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-400/15 text-emerald-300 border border-emerald-400/25">
                        {item.badge}
                      </span>
                    )}
                    {isActive && <ChevronRight className="w-3.5 h-3.5 text-emerald-300/80" />}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-2.5 pt-3 mt-3 border-t border-white/[0.06]">
          {/* P3：产品线选择器（跨工作区聚合视图的上下文） */}
          <div className="flex items-center justify-between px-2 text-[11px] font-medium text-white/35">
            <span>产品线</span>
            <button
              onClick={() => setCreateProdOpen(true)}
              className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              title="新建产品线"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative">
            <button
              onClick={() => setProductExpanded((v) => !v)}
              className="w-full liquid-pill flex items-center justify-between px-3 py-2 text-[12px] font-medium text-white/85"
            >
              <span className="flex items-center gap-2 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
                <span className="truncate">{currentProduct?.name ?? '无产品线'}</span>
              </span>
              <ChevronDown className={clsx('w-3.5 h-3.5 text-white/40 transition-transform', productExpanded && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {productExpanded && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  className="absolute bottom-full left-0 right-0 mb-2 p-1.5 liquid-glass z-50 space-y-0.5 max-h-52 overflow-y-auto"
                >
                  {products.length === 0 && (
                    <div className="px-3 py-2 text-[12px] text-white/40">暂无产品线，点 + 创建</div>
                  )}
                  {products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setCurrentProduct(p.id);
                        setProductExpanded(false);
                        show(`已切换到产品线「${p.name}」`);
                      }}
                      className={clsx(
                        'w-full text-left px-3 py-2 rounded-xl text-[12px] flex items-center justify-between transition-colors',
                        currentProduct?.id === p.id ? 'bg-violet-400/15 text-violet-200' : 'text-white/60 hover:bg-white/5 hover:text-white'
                      )}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <Layers className="w-3 h-3 shrink-0 text-white/30" />
                        <span className="truncate">{p.name}</span>
                        {(p.role === 'po' || p.role === 'admin') && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-violet-400/20 text-violet-300 shrink-0">管理</span>
                        )}
                      </span>
                      {currentProduct?.id === p.id && <UserCheck className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between px-2 text-[11px] font-medium text-white/35">
            <span>我的工作区</span>
            <button
              onClick={() => setCreateWsOpen(true)}
              className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              title="新建工作区"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative">
            <button
              onClick={() => setWorkspaceExpanded((v) => !v)}
              className="w-full liquid-pill flex items-center justify-between px-3 py-2.5 text-[12px] font-medium text-white/85"
            >
              <span className="flex items-center gap-2 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                <span className="truncate">{currentWorkspace?.name ?? '无工作区'}</span>
              </span>
              <ChevronDown className={clsx('w-3.5 h-3.5 text-white/40 transition-transform', workspaceExpanded && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {workspaceExpanded && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  className="absolute bottom-full left-0 right-0 mb-2 p-1.5 liquid-glass z-50 space-y-0.5 max-h-64 overflow-y-auto"
                >
                  {workspaces.length === 0 && (
                    <div className="px-3 py-2 text-[12px] text-white/40">暂无工作区</div>
                  )}
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => {
                        setCurrentWorkspace(ws.id);
                        setWorkspaceExpanded(false);
                        show(`已切换到「${ws.name}」`);
                      }}
                      className={clsx(
                        'w-full text-left px-3 py-2 rounded-xl text-[12px] flex items-center justify-between transition-colors',
                        currentWorkspace?.id === ws.id ? 'bg-emerald-400/15 text-emerald-200' : 'text-white/60 hover:bg-white/5 hover:text-white'
                      )}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{ws.name}</span>
                        {ws.role === 'admin' && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-400/20 text-emerald-300 shrink-0">管理员</span>
                        )}
                      </span>
                      {currentWorkspace?.id === ws.id && <UserCheck className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="w-full liquid-pill flex items-center justify-between px-2.5 py-2 hover:border-white/20 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full liquid-icon-well flex items-center justify-center text-[11px] font-bold text-white/90 shrink-0 overflow-hidden">
                {user?.avatar && user.avatar.startsWith('avatars/') ? (
                  <img src={`/api/auth/avatar/${user.avatar.split('/').pop()}`} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  user?.avatar || profile.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0 text-left">
                <div className="text-[12px] font-semibold text-white leading-tight truncate">{profile.name}</div>
                <div className="text-[10px] text-white/35 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {profile.role}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
          </button>
        </div>
      </aside>

      <LiquidModal
        open={createWsOpen}
        onClose={() => setCreateWsOpen(false)}
        title="新建工作区"
        subtitle="为团队开辟独立协作空间"
        icon={<Plus className="w-5 h-5" />}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreateWsOpen(false)} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">取消</button>
            <button form="ws-form" type="submit" disabled={creating} className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold disabled:opacity-60">{creating ? '创建中…' : '创建'}</button>
          </div>
        }
      >
        <form id="ws-form" onSubmit={createWorkspace} className="space-y-3">
          <input
            required
            value={wsName}
            onChange={(e) => setWsName(e.target.value)}
            placeholder="工作区名称"
            className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white"
          />
        </form>
      </LiquidModal>

      <LiquidModal
        open={createProdOpen}
        onClose={() => setCreateProdOpen(false)}
        title="新建产品线"
        subtitle="多个项目同属一条产品线，统一管理需求与版本"
        icon={<Package className="w-5 h-5" />}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreateProdOpen(false)} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">取消</button>
            <button form="prod-form" type="submit" disabled={creating} className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold disabled:opacity-60">{creating ? '创建中…' : '创建'}</button>
          </div>
        }
      >
        <form id="prod-form" onSubmit={createProductLine} className="space-y-3">
          <input
            required
            value={prodName}
            onChange={(e) => setProdName(e.target.value)}
            placeholder="产品线名称"
            className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white"
          />
          <input
            value={prodDesc}
            onChange={(e) => setProdDesc(e.target.value)}
            placeholder="产品描述（可选）"
            className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white"
          />
        </form>
      </LiquidModal>

      <LiquidModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title="个人资料"
        subtitle={profile.email}
        icon={<User className="w-5 h-5" />}
        footer={
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => {
                logout();
                setProfileOpen(false);
              }}
              className="h-10 px-3 rounded-full liquid-btn-ghost text-[12px] text-rose-300 flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" /> 退出登录
            </button>
            <div className="flex gap-2">
              <button onClick={() => setProfileOpen(false)} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">关闭</button>
              <button
                onClick={saveProfile}
                disabled={savingProfile}
                className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold disabled:opacity-60"
              >
                {savingProfile ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          {/* P4-1：真实头像上传 */}
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden liquid-icon-well flex items-center justify-center text-[15px] font-bold text-white/90 shrink-0">
              {avatarPreview ? (
                <img src={avatarPreview} alt="头像" className="w-full h-full object-cover" />
              ) : (
                profile.name.slice(0, 2).toUpperCase() || user?.avatar || 'U'
              )}
            </div>
            <div className="space-y-1">
              <label className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full liquid-btn-ghost text-[11px] text-white/70 cursor-pointer">
                <Camera className="w-3.5 h-3.5" /> 上传头像
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={uploadAvatar} />
              </label>
              <p className="text-[10px] text-white/30">支持 PNG/JPEG/WebP/GIF，≤ 2MB</p>
            </div>
          </div>
          <div>
            <label className="text-[11px] text-white/40 mb-1.5 block">显示名称</label>
            <input className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          </div>
          <div>
            <label className="text-[11px] text-white/40 mb-1.5 block">职位</label>
            <input className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white" value={profile.role} onChange={(e) => setProfile({ ...profile, role: e.target.value })} />
          </div>
          <div>
            <label className="text-[11px] text-white/40 mb-1.5 block">邮箱</label>
            <input className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} disabled />
            <p className="text-[10px] text-white/30 mt-1">邮箱为登录账号，不可修改</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setProfileOpen(false);
              onTabChange('settings');
            }}
            className="w-full h-10 rounded-full liquid-btn-ghost text-[12px] text-white/70"
          >
            打开设置中心
          </button>
        </div>
      </LiquidModal>
    </>
  );
};
