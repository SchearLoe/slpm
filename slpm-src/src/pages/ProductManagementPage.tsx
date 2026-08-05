import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Target,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  Link2,
  Unlink,
  GitBranch,
  Users,
  Layers,
  CalendarClock,
  Box,
  ArrowRight,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { LiquidModal } from '@/components/ui/LiquidModal';
import { LiquidSelect } from '@/components/ui/LiquidSelect';
import { useToast } from '@/components/ui/Toast';
import { springSoft } from '@/lib/motion';
import { ViewTransition } from '@/components/ui/PageTransition';
import { useApp } from '@/context/AppContext';
import { apiError } from '@/lib/api';
import { getRoleConfig } from '@/lib/roleConfig';
import {
  useProductDetail,
  useProductTasks,
  useProductMembers,
  useProductStats,
  useProductVersions,
  useCreateProductVersion,
  useUpdateProductVersion,
  useDeleteProductVersion,
  useLinkWorkspace,
  useUnlinkWorkspace,
  useUpdateProduct,
  useCreateProduct,
} from '@/lib/queries';
import { ProductTaskItem, ProductVersion, ProductVersionStatus, WsRole } from '@/types';

// P3：产品版本状态元信息
const VERSION_STATUS_META: Record<ProductVersionStatus, { label: string; cls: string; dot: string }> = {
  planning: { label: '规划中', cls: 'text-sky-300 bg-sky-400/15 border-sky-400/25', dot: 'bg-sky-400' },
  in_progress: { label: '开发中', cls: 'text-amber-300 bg-amber-400/15 border-amber-400/25', dot: 'bg-amber-400' },
  released: { label: '已发布', cls: 'text-emerald-300 bg-emerald-400/15 border-emerald-400/25', dot: 'bg-emerald-400' },
  archived: { label: '已归档', cls: 'text-white/40 bg-white/10 border-white/10', dot: 'bg-white/30' },
};

const VERSION_STATUS_OPTIONS = (Object.keys(VERSION_STATUS_META) as ProductVersionStatus[]).map((s) => ({
  value: s,
  label: VERSION_STATUS_META[s].label,
}));

const STATUS_OPTIONS = [
  { value: '进行中', label: '进行中' },
  { value: '已完成', label: '已完成' },
  { value: '待处理', label: '待处理' },
  { value: '已延期', label: '已延期' },
];

const PHASE_OPTIONS = [
  { value: '需求评审', label: '需求评审' },
  { value: '产品设计', label: '产品设计' },
  { value: '开发实现', label: '开发实现' },
  { value: '测试验证', label: '测试验证' },
];

// 角色徽章（复用 roleConfig 配色）
function RoleBadge({ role }: { role: WsRole | null | undefined }) {
  const cfg = getRoleConfig(role ?? undefined);
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// 版本表单弹窗（新建/编辑共用）
function VersionFormModal({
  open,
  onClose,
  initial,
  productId,
  isEdit,
}: {
  open: boolean;
  onClose: () => void;
  initial: Partial<ProductVersion>;
  productId: string;
  isEdit: boolean;
}) {
  const { show, ToastEl } = useToast();
  const createVersion = useCreateProductVersion(productId);
  const updateVersion = useUpdateProductVersion(productId);
  const [name, setName] = useState(initial.name ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [status, setStatus] = useState<ProductVersionStatus>(initial.status ?? 'planning');
  const [startDate, setStartDate] = useState(initial.startDate ? initial.startDate.slice(0, 10) : '');
  const [releaseDate, setReleaseDate] = useState(initial.releaseDate ? initial.releaseDate.slice(0, 10) : '');
  const [order, setOrder] = useState(String(initial.order ?? 0));
  const [saving, setSaving] = useState(false);

  // 弹窗重新打开时重置表单
  React.useEffect(() => {
    if (open) {
      setName(initial.name ?? '');
      setDescription(initial.description ?? '');
      setStatus(initial.status ?? 'planning');
      setStartDate(initial.startDate ? initial.startDate.slice(0, 10) : '');
      setReleaseDate(initial.releaseDate ? initial.releaseDate.slice(0, 10) : '');
      setOrder(String(initial.order ?? 0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description,
        status,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        releaseDate: releaseDate ? new Date(releaseDate).toISOString() : null,
        order: Number(order) || 0,
      };
      if (isEdit && initial.id) {
        await updateVersion.mutateAsync({ id: initial.id, ...payload });
        show('版本已更新');
      } else {
        await createVersion.mutateAsync(payload);
        show('版本已创建');
      }
      onClose();
    } catch (err) {
      show(apiError(err, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <LiquidModal
      open={open}
      onClose={onClose}
      title={isEdit ? '编辑版本' : '新建版本'}
      subtitle="规划 → 开发 → 发布 → 归档"
      icon={<GitBranch className="w-5 h-5" />}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">取消</button>
          <button form="ver-form" type="submit" disabled={saving} className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold disabled:opacity-60">
            {saving ? '保存中…' : isEdit ? '保存' : '创建'}
          </button>
        </div>
      }
    >
      {ToastEl}
      <form id="ver-form" onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-white/40 mb-1.5 block">版本号 *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="如 v2.1.0" className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white" />
          </div>
          <div>
            <label className="text-[11px] text-white/40 mb-1.5 block">状态</label>
            <LiquidSelect value={status} onChange={(v) => setStatus(v as ProductVersionStatus)} options={VERSION_STATUS_OPTIONS} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] text-white/40 mb-1.5 block">开始日期</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white" />
          </div>
          <div>
            <label className="text-[11px] text-white/40 mb-1.5 block">发布日期</label>
            <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white" />
          </div>
          <div>
            <label className="text-[11px] text-white/40 mb-1.5 block">排序</label>
            <input type="number" min={0} value={order} onChange={(e) => setOrder(e.target.value)} className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white" />
          </div>
        </div>
        <div>
          <label className="text-[11px] text-white/40 mb-1.5 block">描述</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="版本说明 / 变更范围" className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white resize-none" />
        </div>
      </form>
    </LiquidModal>
  );
}

export const ProductManagementPage: React.FC = () => {
  const { show, ToastEl } = useToast();
  const navigate = useNavigate();
  const { currentProduct, products, workspaces, setCurrentWorkspace, setCurrentProduct } = useApp();
  const [tab, setTab] = useState<'requirements' | 'versions' | 'team'>('requirements');

  const productId = currentProduct?.id;
  // P3：产品级写权限（po/admin）
  const isManager = currentProduct?.role === 'po' || currentProduct?.role === 'admin';

  const { data: detail } = useProductDetail(productId);
  const { data: versions = [] } = useProductVersions(productId);
  const { data: stats } = useProductStats(productId);
  const { data: members = [] } = useProductMembers(productId);

  // ---- 需求总览筛选 ----
  const [fWorkspace, setFWorkspace] = useState('');
  const [fVersion, setFVersion] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fPhase, setFPhase] = useState('');
  const { data: tasks = [] } = useProductTasks(productId, {
    ...(fWorkspace ? { workspaceId: fWorkspace } : {}),
    ...(fVersion ? { versionId: fVersion } : {}),
    ...(fStatus ? { status: fStatus } : {}),
    ...(fPhase ? { phase: fPhase } : {}),
  });

  // ---- 弹窗状态 ----
  const [versionModal, setVersionModal] = useState<{ open: boolean; initial: Partial<ProductVersion> }>({ open: false, initial: {} });
  const [linkWsOpen, setLinkWsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editProductOpen, setEditProductOpen] = useState(false);
  const [taskDetail, setTaskDetail] = useState<ProductTaskItem | null>(null);
  const [versionTasksFor, setVersionTasksFor] = useState<string | null>(null); // 版本 id → 查看该版本任务

  const [newProductName, setNewProductName] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);
  const [linking, setLinking] = useState(false);

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const linkWs = useLinkWorkspace(productId);
  const unlinkWs = useUnlinkWorkspace(productId);
  const deleteVersion = useDeleteProductVersion(productId);

  // 可关联的工作区：我的工作区里还未关联到当前产品的（且我是 admin）
  const linkableWorkspaces = useMemo(() => {
    if (!detail) return [];
    const linkedIds = new Set(detail.workspaces.map((w) => w.id));
    return workspaces.filter((w) => !linkedIds.has(w.id) && w.role === 'admin');
  }, [detail, workspaces]);

  // KPI 卡片（真实聚合）
  const kpis = useMemo(() => {
    if (!stats) return [];
    return [
      { label: '需求总数', value: stats.total, icon: Target, color: 'text-white', tip: `${stats.byWorkspace.length} 个项目` },
      { label: '完成率', value: `${stats.completionRate}%`, icon: CheckCircle2, color: 'text-emerald-300', tip: `${stats.completed} 个已完成` },
      { label: '延期任务', value: stats.overdue, icon: AlertTriangle, color: stats.overdue > 0 ? 'text-rose-300' : 'text-white', tip: stats.overdue > 0 ? '需重点关注' : '暂无延期' },
      { label: '里程碑进度', value: `${stats.milestoneRate}%`, icon: Clock, color: 'text-cyan-300', tip: `${stats.milestonesDone}/${stats.milestones} 里程碑` },
    ];
  }, [stats]);

  // ---- 动作 ----
  const submitCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim() || savingProduct) return;
    setSavingProduct(true);
    try {
      const p = await createProduct.mutateAsync({ name: newProductName.trim(), description: newProductDesc });
      setCurrentProduct(p.id);
      setCreateOpen(false);
      setNewProductName('');
      setNewProductDesc('');
      show(`产品线「${p.name}」已创建`);
    } catch (err) {
      show(apiError(err, '创建失败'));
    } finally {
      setSavingProduct(false);
    }
  };

  const submitEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || savingProduct || !productId) return;
    setSavingProduct(true);
    try {
      await updateProduct.mutateAsync({ id: productId, name: editName.trim(), description: editDesc });
      setEditProductOpen(false);
      show('产品信息已更新');
    } catch (err) {
      show(apiError(err, '保存失败'));
    } finally {
      setSavingProduct(false);
    }
  };

  const submitLink = async (wsId: string) => {
    if (!wsId || linking) return;
    setLinking(true);
    try {
      await linkWs.mutateAsync(wsId);
      setLinkWsOpen(false);
      show('项目已关联到产品线');
    } catch (err) {
      show(apiError(err, '关联失败'));
    } finally {
      setLinking(false);
    }
  };

  const confirmUnlink = async (wsId: string, wsName: string) => {
    if (!window.confirm(`确认将「${wsName}」移出产品线？任务数据不受影响。`)) return;
    try {
      await unlinkWs.mutateAsync(wsId);
      show('已取消关联');
    } catch (err) {
      show(apiError(err, '操作失败'));
    }
  };

  const confirmDeleteVersion = async (v: ProductVersion) => {
    if (!window.confirm(`确认删除版本「${v.name}」？关联任务将解除版本归属。`)) return;
    try {
      await deleteVersion.mutateAsync(v.id);
      show('版本已删除');
    } catch (err) {
      show(apiError(err, '删除失败'));
    }
  };

  const openInWorkspace = (task: ProductTaskItem) => {
    if (!task.workspaceId) return;
    setCurrentWorkspace(task.workspaceId);
    setTaskDetail(null);
    navigate('/tasks');
  };

  // ---- 空态：还没有产品线 ----
  if (products.length === 0) {
    return (
      <>
        {ToastEl}
        <div className="h-full flex items-center justify-center">
          <GlassCard className="p-10 max-w-md text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl liquid-icon-well flex items-center justify-center text-emerald-300">
              <Package className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-white">还没有产品线</h3>
              <p className="text-[12px] text-white/40 mt-1">创建产品线后，可把多个项目（工作区）纳入同一产品线，统一查看需求、成员负荷与版本进度</p>
            </div>
            <button onClick={() => setCreateOpen(true)} className="h-10 px-5 rounded-full liquid-btn-primary text-[12px] font-bold flex items-center gap-1.5 mx-auto">
              <Plus className="w-4 h-4" /> 创建产品线
            </button>
          </GlassCard>
        </div>

        <LiquidModal open={createOpen} onClose={() => setCreateOpen(false)} title="创建产品线" subtitle="多个项目同属一条产品线" icon={<Package className="w-5 h-5" />}
          footer={
            <div className="flex justify-end gap-2">
              <button onClick={() => setCreateOpen(false)} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">取消</button>
              <button form="create-prod-form" type="submit" disabled={savingProduct} className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold disabled:opacity-60">{savingProduct ? '创建中…' : '创建'}</button>
            </div>
          }>
          <form id="create-prod-form" onSubmit={submitCreateProduct} className="space-y-3">
            <input required value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder="产品线名称" className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white" />
            <input value={newProductDesc} onChange={(e) => setNewProductDesc(e.target.value)} placeholder="产品描述（可选）" className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white" />
          </form>
        </LiquidModal>
      </>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-4 space-y-4">
      {ToastEl}

      {/* ---- 头部：产品信息 + 操作 ---- */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="liquid-icon-well w-11 h-11 rounded-2xl flex items-center justify-center text-emerald-300 shrink-0">
            <Package className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-bold text-white tracking-tight truncate">{currentProduct?.name}</h2>
              <RoleBadge role={currentProduct?.role} />
              {isManager && (
                <button onClick={() => { setEditName(currentProduct?.name ?? ''); setEditDesc(currentProduct?.description ?? ''); setEditProductOpen(true); }} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors" title="编辑产品信息">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-[11px] text-white/40 truncate">
              {currentProduct?.description || '暂无描述'} · {detail?.workspaces.length ?? currentProduct?.workspaceCount ?? 0} 个项目 · {versions.length} 个版本
            </p>
          </div>
        </div>
        {isManager && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setLinkWsOpen(true)} disabled={linkableWorkspaces.length === 0} className="h-9 px-3.5 rounded-full liquid-btn-ghost text-[12px] text-white/70 flex items-center gap-1.5 disabled:opacity-40" title={linkableWorkspaces.length === 0 ? '没有可关联的（你作为管理员且未归属的）项目' : '关联项目到产品线'}>
              <Link2 className="w-3.5 h-3.5" /> 关联项目
            </button>
            <button onClick={() => setVersionModal({ open: true, initial: {} })} className="h-9 px-3.5 rounded-full liquid-btn-primary text-[12px] font-bold flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> 新建版本
            </button>
          </div>
        )}
      </div>

      {/* ---- Tab 切换 ---- */}
      <div className="liquid-pill p-1 inline-flex items-center gap-0.5">
        {([
          ['requirements', '需求总览', Layers],
          ['versions', '版本管理', GitBranch],
          ['team', '团队视图', Users],
        ] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3.5 h-8 rounded-full text-[12px] font-medium flex items-center gap-1.5 transition-colors ${tab === id ? 'liquid-btn-primary' : 'text-white/50 hover:text-white/80'}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      <ViewTransition viewKey={tab}>
        {/* ================= Tab 1：需求总览（跨项目） ================= */}
        {tab === 'requirements' && (
          <div className="space-y-4">
            {/* KPI 卡片 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {kpis.map((k) => (
                <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={springSoft}>
                  <GlassCard className="p-4 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                      <k.icon className="w-3.5 h-3.5" /> {k.label}
                    </div>
                    <div className={`text-[24px] font-extrabold ${k.color}`}>{k.value}</div>
                    <div className="text-[10px] text-white/30">{k.tip}</div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>

            {/* 按项目分列完成情况 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {stats?.byWorkspace.map((w) => (
                <GlassCard key={w.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-white flex items-center gap-1.5">
                      <Box className="w-3.5 h-3.5 text-white/40" /> {w.name}
                    </span>
                    <span className="text-[11px] text-white/40">{w.completed}/{w.total} 完成</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all duration-500" style={{ width: `${w.completionRate}%` }} />
                  </div>
                  <div className="flex gap-4 text-[10px] text-white/35">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />进行中 {w.inProgress}</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" />延期 {w.overdue}</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />里程碑 {w.milestonesDone}/{w.milestones}</span>
                  </div>
                </GlassCard>
              ))}
              {stats && stats.byWorkspace.length === 0 && (
                <GlassCard className="p-5 text-[12px] text-white/40 col-span-2 text-center">产品线尚未关联任何项目，需求总览为空</GlassCard>
              )}
            </div>

            {/* 跨项目需求列表 */}
            <GlassCard className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-[13px] font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-300" /> 跨项目需求
                  <span className="text-[10px] font-normal text-white/30">{tasks.length} 条</span>
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <LiquidSelect variant="pill" placeholder="全部项目" value={fWorkspace} onChange={setFWorkspace}
                    options={[{ value: '', label: '全部项目' }, ...(detail?.workspaces ?? []).map((w) => ({ value: w.id, label: w.name }))]} />
                  <LiquidSelect variant="pill" placeholder="全部版本" value={fVersion} onChange={setFVersion}
                    options={[{ value: '', label: '全部版本' }, ...versions.map((v) => ({ value: v.id, label: v.name }))]} />
                  <LiquidSelect variant="pill" placeholder="全部状态" value={fStatus} onChange={setFStatus}
                    options={[{ value: '', label: '全部状态' }, ...STATUS_OPTIONS]} />
                  <LiquidSelect variant="pill" placeholder="全部阶段" value={fPhase} onChange={setFPhase}
                    options={[{ value: '', label: '全部阶段' }, ...PHASE_OPTIONS]} />
                </div>
              </div>

              <div className="space-y-1.5">
                {tasks.map((t) => (
                  <button key={t.id} onClick={() => setTaskDetail(t)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] transition-colors text-left group">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.status === '已完成' ? 'bg-emerald-400' : t.status === '已延期' ? 'bg-rose-400' : t.status === '进行中' ? 'bg-amber-400' : 'bg-white/30'}`} />
                    <span className={`text-[12.5px] truncate flex-1 ${t.status === '已完成' ? 'text-white/40 line-through' : 'text-white/85'}`}>{t.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-white/50 shrink-0">{t.workspace?.name}</span>
                    {t.productVersion && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md border shrink-0 ${VERSION_STATUS_META[t.productVersion.status as ProductVersionStatus]?.cls ?? 'text-white/50 bg-white/10 border-white/10'}`}>
                        {t.productVersion.name}
                      </span>
                    )}
                    <span className="text-[10px] text-white/40 w-14 shrink-0 text-right">{t.phase}</span>
                    <span className="text-[10px] text-white/40 shrink-0">{t.deadline ? new Date(t.deadline).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) : '—'}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 shrink-0 transition-colors" />
                  </button>
                ))}
                {tasks.length === 0 && (
                  <div className="text-[12px] text-white/30 text-center py-8">当前筛选下没有需求</div>
                )}
              </div>
            </GlassCard>
          </div>
        )}

        {/* ================= Tab 2：版本管理 ================= */}
        {tab === 'versions' && (
          <div className="space-y-3">
            {versions.length === 0 && (
              <GlassCard className="p-8 text-center space-y-2">
                <GitBranch className="w-8 h-8 mx-auto text-white/25" />
                <div className="text-[13px] text-white/70 font-semibold">还没有版本</div>
                <div className="text-[11px] text-white/35">为产品线创建版本（如 v1.0.0），并把任务关联到版本，跟踪每个版本的交付进度</div>
              </GlassCard>
            )}

            {/* 版本时间线 */}
            <div className="relative space-y-3 pl-6">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/10" />
              {versions.map((v) => {
                const meta = VERSION_STATUS_META[v.status];
                const vStat = stats?.byVersion.find((s) => s.id === v.id);
                return (
                  <motion.div key={v.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={springSoft}>
                    <GlassCard className="p-4 relative space-y-2.5">
                      <span className={`absolute -left-6 top-5 w-3.5 h-3.5 rounded-full ${meta.dot} ring-4 ring-black/20`} />
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-bold text-white">{v.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${meta.cls}`}>{meta.label}</span>
                          <span className="text-[10px] text-white/30">排序 {v.order}</span>
                        </div>
                        {isManager && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => setVersionTasksFor(v.id)} className="h-7 px-2.5 rounded-lg text-[11px] text-white/60 hover:bg-white/10 transition-colors flex items-center gap-1">
                              <Target className="w-3 h-3" /> {v.taskCount} 个需求
                            </button>
                            <button onClick={() => setVersionModal({ open: true, initial: v })} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors" title="编辑">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => confirmDeleteVersion(v)} className="p-1.5 rounded-lg hover:bg-rose-400/15 text-white/40 hover:text-rose-300 transition-colors" title="删除">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {v.description && <p className="text-[11.5px] text-white/45">{v.description}</p>}

                      <div className="flex items-center gap-4 text-[10px] text-white/35">
                        <span className="flex items-center gap-1"><CalendarClock className="w-3 h-3" /> 开始 {v.startDate ? new Date(v.startDate).toLocaleDateString('zh-CN') : '—'}</span>
                        <span className="flex items-center gap-1"><CalendarClock className="w-3 h-3" /> 发布 {v.releaseDate ? new Date(v.releaseDate).toLocaleDateString('zh-CN') : '—'}</span>
                      </div>

                      {/* 版本进度（来自跨区聚合 stats.byVersion） */}
                      {vStat && vStat.total > 0 && (
                        <div className="space-y-1">
                          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all duration-500" style={{ width: `${vStat.completionRate}%` }} />
                          </div>
                          <div className="flex justify-between text-[10px] text-white/35">
                            <span>{vStat.completed}/{vStat.total} 个需求已完成</span>
                            <span>{vStat.completionRate}%</span>
                          </div>
                        </div>
                      )}
                    </GlassCard>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= Tab 3：团队视图（跨项目成员负荷） ================= */}
        {tab === 'team' && (
          <div className="space-y-4">
            {/* 成员负荷横向柱状图 */}
            <GlassCard className="p-5 space-y-4">
              <h3 className="text-[13px] font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-300" /> 成员负荷分布
                <span className="text-[10px] font-normal text-white/30">跨 {stats?.byWorkspace.length ?? 0} 个项目汇总</span>
              </h3>
              <div className="space-y-3">
                {members.map((m) => {
                  const donePct = m.total > 0 ? (m.completed / m.total) * 100 : 0;
                  const inPct = m.total > 0 ? (m.inProgress / m.total) * 100 : 0;
                  const load = m.total > 0 ? Math.min(100, Math.round((m.inProgress / Math.max(1, members.reduce((mx, x) => Math.max(mx, x.inProgress), 1))) * 100)) : 0;
                  return (
                    <div key={m.userId} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full liquid-icon-well flex items-center justify-center text-[10px] font-bold text-white/80 shrink-0">
                        {m.avatar || m.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[12px] font-medium text-white/85 truncate">{m.name}</span>
                            <RoleBadge role={m.role} />
                            {m.workspaces.map((w) => (
                              <span key={w.id} className="text-[9px] px-1 py-0.5 rounded bg-white/8 text-white/40 truncate max-w-[100px]">{w.name}</span>
                            ))}
                          </div>
                          <span className="text-[10px] text-white/35 shrink-0">进行中 {m.inProgress} · 完成 {m.completed} · 延期 {m.overdue}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden flex">
                          <div className="h-full bg-emerald-400/80 transition-all duration-500" style={{ width: `${donePct}%` }} />
                          <div className="h-full bg-amber-400/70 transition-all duration-500" style={{ width: `${inPct}%` }} />
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-white/50 w-10 text-right shrink-0">{load}%</span>
                    </div>
                  );
                })}
                {members.length === 0 && <div className="text-[12px] text-white/30 text-center py-6">暂无成员数据</div>}
              </div>
              <div className="flex gap-4 text-[10px] text-white/35 pt-1">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400/80" />已完成</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400/70" />进行中</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-white/10" />未指派</span>
              </div>
            </GlassCard>
          </div>
        )}
      </ViewTransition>

      {/* ================= 弹窗 ================= */}

      {/* 关联项目 */}
      <LiquidModal open={linkWsOpen} onClose={() => setLinkWsOpen(false)} title="关联项目到产品线" subtitle="选择你作为管理员的项目" icon={<Link2 className="w-5 h-5" />}
        footer={<button onClick={() => setLinkWsOpen(false)} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">关闭</button>}>
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {linkableWorkspaces.map((w) => (
            <button key={w.id} onClick={() => submitLink(w.id)} disabled={linking}
              className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] transition-colors disabled:opacity-50">
              <span className="text-[12.5px] text-white/85 flex items-center gap-2">
                <Box className="w-4 h-4 text-white/40" /> {w.name}
              </span>
              <Plus className="w-4 h-4 text-emerald-300" />
            </button>
          ))}
          {linkableWorkspaces.length === 0 && (
            <div className="text-[12px] text-white/35 text-center py-6">没有可关联的项目：需要是你作为管理员、且尚未归属其他产品线的工作区</div>
          )}
        </div>
      </LiquidModal>

      {/* 创建产品线（有产品时的入口在侧栏） */}
      <LiquidModal open={createOpen} onClose={() => setCreateOpen(false)} title="创建产品线" subtitle="多个项目同属一条产品线" icon={<Package className="w-5 h-5" />}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreateOpen(false)} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">取消</button>
            <button form="create-prod-form" type="submit" disabled={savingProduct} className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold disabled:opacity-60">{savingProduct ? '创建中…' : '创建'}</button>
          </div>
        }>
        <form id="create-prod-form" onSubmit={submitCreateProduct} className="space-y-3">
          <input required value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder="产品线名称" className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white" />
          <input value={newProductDesc} onChange={(e) => setNewProductDesc(e.target.value)} placeholder="产品描述（可选）" className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white" />
        </form>
      </LiquidModal>

      {/* 编辑产品信息 */}
      <LiquidModal open={editProductOpen} onClose={() => setEditProductOpen(false)} title="编辑产品信息" subtitle={currentProduct?.name} icon={<Pencil className="w-5 h-5" />}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditProductOpen(false)} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">取消</button>
            <button form="edit-prod-form" type="submit" disabled={savingProduct} className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold disabled:opacity-60">{savingProduct ? '保存中…' : '保存'}</button>
          </div>
        }>
        <form id="edit-prod-form" onSubmit={submitEditProduct} className="space-y-3">
          <input required value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="产品线名称" className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white" />
          <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} placeholder="产品描述" className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white resize-none" />
        </form>
      </LiquidModal>

      {/* 版本新建/编辑 */}
      <VersionFormModal open={versionModal.open} onClose={() => setVersionModal({ open: false, initial: {} })} initial={versionModal.initial} productId={productId ?? ''} isEdit={!!versionModal.initial.id} />

      {/* 任务详情（跨项目需求点击） */}
      <LiquidModal open={!!taskDetail} onClose={() => setTaskDetail(null)} title={taskDetail?.title ?? ''} subtitle={taskDetail ? `${taskDetail.workspace?.name ?? ''} · ${taskDetail.phase}` : ''} icon={<Target className="w-5 h-5" />}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setTaskDetail(null)} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">关闭</button>
            {taskDetail?.workspaceId && (
              <button onClick={() => openInWorkspace(taskDetail)} className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5" /> 在工作区打开
              </button>
            )}
          </div>
        }>
        {taskDetail && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${taskDetail.status === '已完成' ? 'text-emerald-300 bg-emerald-400/15 border-emerald-400/25' : taskDetail.status === '已延期' ? 'text-rose-300 bg-rose-400/15 border-rose-400/25' : 'text-amber-300 bg-amber-400/15 border-amber-400/25'}`}>{taskDetail.status}</span>
              {taskDetail.productVersion && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${VERSION_STATUS_META[taskDetail.productVersion.status as ProductVersionStatus]?.cls ?? 'text-white/50 bg-white/10 border-white/10'}`}>{taskDetail.productVersion.name}</span>
              )}
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-white/50">{taskDetail.priority} 优先级</span>
              {taskDetail.milestone && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-400/15 text-violet-300 border border-violet-400/25">里程碑</span>}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-white/50">
              <span className="w-6 h-6 rounded-full liquid-icon-well flex items-center justify-center text-[9px] font-bold">
                {taskDetail.assignee?.avatar || taskDetail.assignee?.name?.slice(0, 2).toUpperCase() || '—'}
              </span>
              负责人：{taskDetail.assignee?.name ?? '未指派'}
              <span className="ml-auto flex items-center gap-1"><Clock className="w-3 h-3" /> 截止 {taskDetail.deadline ? new Date(taskDetail.deadline).toLocaleDateString('zh-CN') : '—'}</span>
            </div>
            <p className="text-[12px] text-white/60 whitespace-pre-wrap leading-relaxed">{taskDetail.description || '暂无描述'}</p>
          </div>
        )}
      </LiquidModal>

      {/* 版本任务列表 */}
      <VersionTasksModal productId={productId ?? ''} versionId={versionTasksFor} versions={versions} onClose={() => setVersionTasksFor(null)} onOpenTask={(t) => { setVersionTasksFor(null); setTaskDetail(t); }} />
    </div>
  );
};

// 版本内需求列表弹窗
function VersionTasksModal({
  productId,
  versionId,
  versions,
  onClose,
  onOpenTask,
}: {
  productId: string;
  versionId: string | null;
  versions: ProductVersion[];
  onClose: () => void;
  onOpenTask: (t: ProductTaskItem) => void;
}) {
  const version = versions.find((v) => v.id === versionId);
  const { data: tasks = [] } = useProductTasks(productId, versionId ? { versionId } : undefined);
  const meta = version ? VERSION_STATUS_META[version.status] : null;

  return (
    <LiquidModal open={!!versionId} onClose={onClose} title={`${version?.name ?? ''} 的需求`} subtitle={version?.description || `共 ${tasks.length} 个需求`} icon={<Target className="w-5 h-5" />}
      footer={<button onClick={onClose} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">关闭</button>}>
      <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
        {version && (
          <div className="flex items-center gap-2 pb-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${meta?.cls}`}>{meta?.label}</span>
            <span className="text-[10px] text-white/35">开始 {version.startDate ? new Date(version.startDate).toLocaleDateString('zh-CN') : '—'} · 发布 {version.releaseDate ? new Date(version.releaseDate).toLocaleDateString('zh-CN') : '—'}</span>
          </div>
        )}
        {tasks.map((t) => (
          <button key={t.id} onClick={() => onOpenTask(t)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] transition-colors text-left">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.status === '已完成' ? 'bg-emerald-400' : t.status === '已延期' ? 'bg-rose-400' : 'bg-white/30'}`} />
            <span className={`text-[12px] truncate flex-1 ${t.status === '已完成' ? 'text-white/40 line-through' : 'text-white/85'}`}>{t.title}</span>
            <span className="text-[10px] text-white/40 shrink-0">{t.workspace?.name}</span>
            <span className="text-[10px] text-white/35 w-14 shrink-0 text-right">{t.phase}</span>
          </button>
        ))}
        {tasks.length === 0 && <div className="text-[12px] text-white/30 text-center py-8">该版本暂无关联需求</div>}
      </div>
    </LiquidModal>
  );
}
