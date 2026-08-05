import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { AISmartDetailPanel } from '@/components/dashboard/AISmartDetailPanel';
import { QueryError } from '@/components/QueryError';
import { useApp } from '@/context/AppContext';
import { useTask } from '@/lib/queries';

/**
 * P6-E1：任务详情独立路由页 `/tasks/:id`。
 *
 * 通知 deep-link 等场景可直接跳转。复用 AISmartDetailPanel 的渲染逻辑：
 * 加载任务后写入 AppContext.selectedTask，面板据此显示详情。
 */
export const TaskDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setSelectedTask } = useApp();
  const { data: task, isLoading, isError, refetch } = useTask(id);

  // 加载完成后同步到全局选区（AISmartDetailPanel 依赖 selectedTask）
  useEffect(() => {
    if (task) setSelectedTask(task);
  }, [task, setSelectedTask]);

  return (
    <div className="h-full min-h-0 flex flex-col gap-3 max-w-2xl mx-auto w-full">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 shrink-0"
      >
        <button
          onClick={() => navigate('/tasks')}
          className="liquid-btn-ghost h-9 px-3 rounded-full flex items-center gap-1.5 text-[12px] text-white/60"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          返回任务列表
        </button>
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-white truncate">
            {isLoading ? '加载任务…' : task?.title ?? '任务详情'}
          </h2>
          {task && (
            <p className="text-[11px] font-mono text-white/30">{task.id}</p>
          )}
        </div>
      </motion.div>

      {isLoading ? (
        <div className="liquid-glass rounded-2xl p-8 text-center text-[12px] text-white/40">
          加载中…
        </div>
      ) : isError ? (
        <QueryError onRetry={() => refetch()} message="任务加载失败，可能已被删除或无权访问" />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex-1 min-h-0 overflow-y-auto"
        >
          {!task ? (
            <div className="liquid-glass rounded-2xl p-8 text-center">
              <AlertCircle className="w-8 h-8 text-white/20 mx-auto mb-2" />
              <div className="text-[12px] text-white/40">任务不存在</div>
            </div>
          ) : (
            <AISmartDetailPanel />
          )}
        </motion.div>
      )}
    </div>
  );
};
