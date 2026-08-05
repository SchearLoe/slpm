import React from 'react';
import { motion } from 'framer-motion';
import { KPICardsRow } from '@/components/dashboard/KPICardsRow';
import { TaskGroupList } from '@/components/dashboard/TaskGroupList';
import { CoverFlowDeck } from '@/components/dashboard/CoverFlowDeck';
import { ProjectTimeline } from '@/components/dashboard/ProjectTimeline';
import { AISmartDetailPanel } from '@/components/dashboard/AISmartDetailPanel';
import { DocPreviewModal } from '@/components/modals/DocPreviewModal';
import { useApp } from '@/context/AppContext';
import { useTasks } from '@/lib/queries';

export const TaskManagementPage: React.FC = () => {
  const { setSelectedTask, selectedDoc, setSelectedDoc } = useApp();
  const { data: tasks = [], isLoading } = useTasks();

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/*
        框架：左右同高拉伸；
        左侧 KPI → 中部看板/卡片(弹性) → 底部时间线(贴底)
        右侧智能详情通高，底部操作条与时间线下沿对齐
      */}
      <div className="tasks-frame">
        <div className="tasks-left">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="tasks-kpi shrink-0"
          >
            <KPICardsRow />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="board-deck-row"
          >
            <div className="board-col min-w-0 min-h-0 flex flex-col gap-2">
              <div className="flex items-center justify-between px-0.5 h-5 shrink-0">
                <h3 className="text-[13px] font-bold text-white/90 tracking-wide">任务看板</h3>
                <span className="text-[10px] font-mono text-white/25">
                  {isLoading ? '加载中…' : `${tasks.length} active`}
                </span>
              </div>
              <div className="board-body min-h-0 flex-1 overflow-hidden">
                <TaskGroupList />
              </div>
            </div>

            <div className="deck-void min-w-0 min-h-0">
              <CoverFlowDeck onSelectDoc={setSelectedDoc} />
            </div>
          </motion.div>

          {/* 贴底：与右侧详情操作条下沿对齐 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="timeline-slot shrink-0 mt-auto"
          >
            <ProjectTimeline
              onSelectTask={(id) => {
                const matched = tasks.find((t) => t.id === id);
                if (matched) setSelectedTask(matched);
              }}
            />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.06, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="tasks-right"
        >
          <AISmartDetailPanel />
        </motion.div>
      </div>

      <DocPreviewModal doc={selectedDoc} onClose={() => setSelectedDoc(null)} />
    </div>
  );
};
