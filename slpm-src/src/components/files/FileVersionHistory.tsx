import React from 'react';
import { History, RotateCcw, FileText } from 'lucide-react';
import { useFileVersions, useRestoreFileVersion } from '@/lib/queries';
import { apiError, formatFileSize } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { FileRecord } from '@/types';

/**
 * P10-3：文件版本历史（后端 FileVersion 链早已存在，本组件补齐 UI）。
 * 在预览弹窗内展示历史版本列表，支持一键回滚到指定版本。
 */
export const FileVersionHistory: React.FC<{ file: FileRecord }> = ({ file }) => {
  const { show } = useToast();
  const versionsQ = useFileVersions(file.id);
  const restoreVersion = useRestoreFileVersion(file.id);
  const [pendingRestore, setPendingRestore] = React.useState<{ id: string; version: number } | null>(null);

  const versions = versionsQ.data?.versions ?? [];
  const currentVersion = versionsQ.data?.currentVersion ?? Math.max(1, ...versions.map((v) => v.version));

  if (versionsQ.isLoading) {
    return (
      <div className="pt-2 border-t border-white/[0.06]">
        <div className="text-[11px] text-white/35 py-2">版本历史加载中…</div>
      </div>
    );
  }

  // 仅一个版本且等于当前版本时，无需展示历史
  if (versions.length <= 1) {
    return (
      <div className="pt-2 border-t border-white/[0.06] flex items-center gap-1.5 text-[11px] text-white/30">
        <History className="w-3 h-3" />
        版本历史：当前为首个版本（v{currentVersion}），重新上传同名文件会产生新版本
      </div>
    );
  }

  return (
    <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white/60">
        <History className="w-3.5 h-3.5 text-cyan-300/80" />
        版本历史 · {versions.length} 个版本
      </div>
      <div className="max-h-[180px] overflow-y-auto space-y-1 pr-0.5">
        {[...versions]
          .sort((a, b) => b.version - a.version)
          .map((v) => {
            const isCurrent = v.version === currentVersion;
            return (
              <div
                key={v.id}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${
                  isCurrent ? 'bg-emerald-400/[0.08] border-emerald-400/25' : 'bg-white/[0.03] border-white/[0.05]'
                }`}
              >
                <FileText className="w-3 h-3 text-white/30 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className={`text-[11px] font-mono font-bold mr-1.5 ${isCurrent ? 'text-emerald-300' : 'text-white/50'}`}>
                    v{v.version}
                  </span>
                  <span className="text-[10.5px] text-white/60 truncate">{v.originalName}</span>
                  <span className="text-[9.5px] text-white/30 ml-1.5">{formatFileSize(v.size)} · {new Date(v.createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
                {isCurrent ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-400/15 border border-emerald-400/30 text-emerald-300 shrink-0">当前</span>
                ) : (
                  <button
                    onClick={() => setPendingRestore({ id: v.id, version: v.version })}
                    disabled={restoreVersion.isPending}
                    className="shrink-0 h-6 px-2 rounded-full liquid-btn-ghost text-[10px] text-cyan-300/90 flex items-center gap-1 hover:text-cyan-200 disabled:opacity-40"
                  >
                    <RotateCcw className="w-2.5 h-2.5" /> 回滚
                  </button>
                )}
              </div>
            );
          })}
      </div>

      <ConfirmDialog
        open={!!pendingRestore}
        onClose={() => setPendingRestore(null)}
        onConfirm={async () => {
          const target = pendingRestore;
          setPendingRestore(null);
          if (!target) return;
          try {
            await restoreVersion.mutateAsync(target.id);
            show(`已回滚到 v${target.version}`);
          } catch (err) {
            show(apiError(err, '回滚失败'));
          }
        }}
        title={`回滚到 v${pendingRestore?.version}？`}
        description="当前版本会作为历史版本保留，回滚后可再切回。"
        confirmText="确认回滚"
      />
    </div>
  );
};
