import React, { useState } from 'react';
import { Plus, CheckCircle2, Sparkles } from 'lucide-react';
import { Priority, TaskItem } from '@/types';
import { LiquidModal } from '@/components/ui/LiquidModal';
import { LiquidSelect } from '@/components/ui/LiquidSelect';
import { motion } from 'framer-motion';
import { useCreateTask, useProductVersions } from '@/lib/queries';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { apiError } from '@/lib/api';
import confetti from 'canvas-confetti';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (task: TaskItem) => void;
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({ isOpen, onClose, onCreated }) => {
  const { user } = useAuth();
  const { enableConfetti, currentWorkspace, products } = useApp();
  const createTask = useCreateTask();
  // P3：当前工作区所属产品线的版本列表（任务可选关联版本）
  const productId = currentWorkspace?.productId ?? null;
  const { data: versions = [] } = useProductVersions(productId ?? undefined);
  const currentProduct = products.find((p) => p.id === productId);

  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState<'需求评审' | '产品设计' | '开发实现' | '测试验证'>('需求评审');
  const [priority, setPriority] = useState<Priority>('高');
  const [deadline, setDeadline] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('评审, 需求, 关键路径');
  const [versionId, setVersionId] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [error, setError] = useState('');

  // 截止时间：默认 7 天后，转 ISO（datetime-local 输入）
  const defaultDeadline = () => {
    const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    return d.toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm
  };
  const [deadlineInput, setDeadlineInput] = useState(defaultDeadline);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError('');

    const payload: Partial<TaskItem> & { deadline?: string } = {
      title: title.trim(),
      phase,
      priority,
      status: '进行中',
      description: description || '暂无详细描述信息。',
      tags: tagsInput.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
    };
    // 截止时间转 ISO；后端期望 datetime 字符串
    if (deadlineInput) {
      payload.deadline = new Date(deadlineInput).toISOString();
    }
    // P3：产品版本（可选，空串=不关联）
    if (versions.length > 0) {
      payload.productVersionId = versionId || null;
    }
    // P4-2：预估工时（可选）
    if (estimatedHours.trim()) {
      payload.estimatedHours = Math.max(0, Number(estimatedHours));
    }

    try {
      const task = await createTask.mutateAsync(payload);
      // confetti 保留（视觉反馈，可由设置开关控制）
      if (enableConfetti) {
        confetti({ particleCount: 55, spread: 62, origin: { y: 0.62 }, colors: ['#34d399', '#6ee7b7', '#a7f3d0', '#ffffff'] });
      }
      setTitle('');
      setDescription('');
      setVersionId('');
      setEstimatedHours('');
      onCreated?.(task);
      onClose();
    } catch (err) {
      setError(apiError(err, '创建失败'));
    }
  };

  const field = 'liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white placeholder:text-white/30';

  return (
    <LiquidModal
      open={isOpen}
      onClose={onClose}
      title="新增任务"
      subtitle="高效规划 · 智能协同 · 结果驱动"
      icon={<Plus className="w-5 h-5" />}
      footer={
        <div className="flex items-center justify-end gap-2">
          <motion.button whileTap={{ scale: 0.96 }} type="button" onClick={onClose} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">
            取消
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            type="submit"
            form="new-task-form"
            disabled={createTask.isPending}
            className="h-10 px-5 rounded-full liquid-btn-primary text-[12px] font-bold flex items-center gap-1.5 disabled:opacity-60"
          >
            <CheckCircle2 className="w-4 h-4" />
            {createTask.isPending ? '创建中…' : '立即创建'}
          </motion.button>
        </div>
      }
    >
      <form id="new-task-form" onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-[11px] text-white/40 mb-1.5">任务名称 <span className="text-emerald-300">*</span></label>
          <input className={field} required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="请输入任务标题..." />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-white/40 mb-1.5">所属阶段</label>
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
        </div>

        <div>
          <label className="block text-[11px] text-white/40 mb-1.5">负责人</label>
          <div className="liquid-input px-3.5 py-2.5 rounded-xl text-[12px] text-white/70 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full liquid-icon-well text-[9px] font-bold flex items-center justify-center">
              {user?.avatar || 'U'}
            </span>
            {user?.name || '当前用户'}（默认指派给自己）
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
          <label className="block text-[11px] text-white/40 mb-1.5">截止时间</label>
          <input
            type="datetime-local"
            className={`${field} [color-scheme:dark]`}
            value={deadlineInput}
            onChange={(e) => setDeadlineInput(e.target.value)}
          />
        </div>

        {/* P4-2：预估工时 */}
        <div>
          <label className="block text-[11px] text-white/40 mb-1.5">预估工时（小时，用于燃尽图与负荷统计）</label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
            placeholder="如 8"
            className={field}
          />
        </div>

        <div>
          <label className="block text-[11px] text-white/40 mb-1.5">任务描述</label>
          <textarea className={`${field} resize-none`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="输入更详细的需求说明..." />
        </div>

        <div>
          <label className="block text-[11px] text-white/40 mb-1.5">标签（逗号分隔）</label>
          <input className={field} value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
        </div>

        {error && (
          <div className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-400/25 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="p-3 rounded-2xl bg-emerald-400/[0.06] border border-emerald-400/20 text-[11px] text-emerald-100/80 flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-emerald-300 mt-0.5 shrink-0" />
          <span>任务将保存到数据库，刷新页面数据不丢失。</span>
        </div>
      </form>
    </LiquidModal>
  );
};
