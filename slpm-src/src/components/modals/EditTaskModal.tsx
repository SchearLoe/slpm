import React, { useEffect, useState } from 'react';
import { Edit3, CheckCircle2, Trash2 } from 'lucide-react';
import { Priority, TaskStatus } from '@/types';
import { useApp } from '@/context/AppContext';
import { LiquidModal } from '@/components/ui/LiquidModal';
import { LiquidSelect } from '@/components/ui/LiquidSelect';
import { TagPicker } from '@/components/modals/TagPicker';
import { TagManageModal } from '@/components/modals/TagManageModal';
import { motion } from 'framer-motion';
import { useUpdateTask, useDeleteTask, useProductVersions } from '@/lib/queries';
import { apiError } from '@/lib/api';

export const EditTaskModal: React.FC = () => {
  const { editingTask, setEditingTask, setSelectedTask, currentWorkspace, products } = useApp();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  // P3：当前工作区所属产品线的版本列表
  const productId = currentWorkspace?.productId ?? null;
  const { data: versions = [] } = useProductVersions(productId ?? undefined);
  const currentProduct = products.find((p) => p.id === productId);
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState<'需求评审' | '产品设计' | '开发实现' | '测试验证'>('需求评审');
  const [priority, setPriority] = useState<Priority>('高');
  const [status, setStatus] = useState<TaskStatus>('进行中');
  const [deadlineInput, setDeadlineInput] = useState('');
  const [assignee, setAssignee] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagManageOpen, setTagManageOpen] = useState(false);
  const [versionId, setVersionId] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editingTask) return;
    setTitle(editingTask.title);
    setPhase(editingTask.phase);
    setPriority(editingTask.priority);
    setStatus(editingTask.status);
    setDeadlineInput(
      editingTask.deadline ? new Date(editingTask.deadline).toISOString().slice(0, 16) : '',
    );
    setAssignee(editingTask.assignee?.name || '');
    setDescription(editingTask.description);
    setTags(editingTask.tags ?? []);
    setVersionId(editingTask.productVersionId ?? '');
    setEstimatedHours(editingTask.estimatedHours != null ? String(editingTask.estimatedHours) : '');
    setError('');
  }, [editingTask]);

  const open = !!editingTask;
  const field = 'liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    setError('');
    try {
      const task = await updateTask.mutateAsync({
        id: editingTask.id,
        title,
        phase,
        priority,
        status,
        deadline: deadlineInput ? new Date(deadlineInput).toISOString() : undefined,
        description,
        tags,
        // P3：产品版本（可选）
        ...(versions.length > 0 ? { productVersionId: versionId || null } : {}),
        // P4-2：预估工时（可选；空串 → 清空）
        estimatedHours: estimatedHours.trim() ? Math.max(0, Number(estimatedHours)) : null,
      });
      setSelectedTask(task); // 同步右侧详情
      setEditingTask(null);
    } catch (err) {
      setError(apiError(err, '保存失败'));
    }
  };

  const handleDelete = async () => {
    if (!editingTask) return;
    if (!confirm(`确认删除任务 ${editingTask.id}（${editingTask.title}）吗？`)) return;
    try {
      await deleteTask.mutateAsync(editingTask.id);
      setSelectedTask(null);
      setEditingTask(null);
    } catch (err) {
      setError(apiError(err, '删除失败'));
    }
  };

  return (
    <LiquidModal
      open={open}
      onClose={() => setEditingTask(null)}
      title="编辑任务详情"
      subtitle={editingTask ? <span className="font-mono text-emerald-300/80">{editingTask.id}</span> : undefined}
      icon={<Edit3 className="w-5 h-5" />}
      footer={
        <div className="flex items-center justify-between gap-2">
          <motion.button
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={handleDelete}
            disabled={deleteTask.isPending}
            className="h-10 px-3 rounded-full bg-rose-500/10 border border-rose-400/30 text-rose-300 text-[12px] font-semibold flex items-center gap-1.5 disabled:opacity-60"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleteTask.isPending ? '删除中…' : '删除'}
          </motion.button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setEditingTask(null)} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">
              取消
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              type="submit"
              form="edit-task-form"
              disabled={updateTask.isPending}
              className="h-10 px-5 rounded-full liquid-btn-primary text-[12px] font-bold flex items-center gap-1.5 disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              {updateTask.isPending ? '保存中…' : '保存修改'}
            </motion.button>
          </div>
        </div>
      }
    >
      <form id="edit-task-form" onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-[11px] text-white/40 mb-1.5">任务名称</label>
          <input className={field} required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <div>
            <label className="block text-[11px] text-white/40 mb-1.5">阶段</label>
            <LiquidSelect
              value={phase}
              onChange={(v) => setPhase(v as typeof phase)}
              options={[
                { value: '需求评审', label: '需求评审' },
                { value: '产品设计', label: '产品设计' },
                { value: '开发实现', label: '开发实现' },
                { value: '测试验证', label: '测试验证' },
              ]}
            />
          </div>
          <div>
            <label className="block text-[11px] text-white/40 mb-1.5">优先级</label>
            <LiquidSelect
              value={priority}
              onChange={(v) => setPriority(v as Priority)}
              options={[
                { value: '高', label: '高' },
                { value: '中', label: '中' },
                { value: '低', label: '低' },
              ]}
            />
          </div>
          <div>
            <label className="block text-[11px] text-white/40 mb-1.5">状态</label>
            <LiquidSelect
              value={status}
              onChange={(v) => setStatus(v as TaskStatus)}
              options={[
                { value: '进行中', label: '进行中' },
                { value: '已完成', label: '已完成' },
                { value: '待处理', label: '待处理' },
                { value: '已延期', label: '已延期' },
              ]}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-white/40 mb-1.5">负责人</label>
            <input className={field} value={assignee} onChange={(e) => setAssignee(e.target.value)} disabled />
            <p className="text-[10px] text-white/30 mt-1">指派关系以当前登录用户为准（团队版可改派）</p>
          </div>
          <div>
            <label className="block text-[11px] text-white/40 mb-1.5">截止时间</label>
            <input
              type="datetime-local"
              className={`${field} [color-scheme:dark]`}
              value={deadlineInput}
              onChange={(e) => setDeadlineInput(e.target.value)}
            />
          </div>
        </div>
        {/* P3：产品版本（当前工作区归属产品线且有版本时显示） */}
        {versions.length > 0 && (
          <div>
            <label className="block text-[11px] text-white/40 mb-1.5">所属版本（{currentProduct?.name ?? '产品线'}）</label>
            <LiquidSelect
              value={versionId}
              onChange={setVersionId}
              placeholder="不关联版本"
              options={[{ value: '', label: '不关联版本' }, ...versions.map((v) => ({ value: v.id, label: v.name }))]}
            />
          </div>
        )}
        <div>
          <label className="block text-[11px] text-white/40 mb-1.5">详细描述</label>
          <textarea className={`${field} resize-none`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="block text-[11px] text-white/40 mb-1.5">标签</label>
          <TagPicker value={tags} onChange={setTags} onManage={() => setTagManageOpen(true)} />
        </div>
        {/* P4-2：预估工时 */}
        <div>
          <label className="block text-[11px] text-white/40 mb-1.5">预估工时（小时）</label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
            placeholder="留空表示未估算"
            className={field}
          />
        </div>
        {error && (
          <div className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-400/25 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </form>
      <TagManageModal open={tagManageOpen} onClose={() => setTagManageOpen(false)} />
    </LiquidModal>
  );
};
