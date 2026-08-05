import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, FolderOpen, ArrowRight, Upload } from 'lucide-react';
import { useFiles } from '@/lib/queries';
import { formatFileSize } from '@/lib/api';
import { useApp } from '@/context/AppContext';

/**
 * P4-1：任务页右侧「最近归档」—— 真实文件列表（替代原硬编码 CoverFlowDeck 假卡片墙）。
 * 展示最近上传的 5 个文件，点击进入文件归档页。
 */
export const RecentFilesPanel: React.FC = () => {
  const navigate = useNavigate();
  const { data: files = [], isLoading } = useFiles();
  const { setIsNewTaskOpen } = useApp();

  return (
    <div className="h-full min-h-0 flex flex-col gap-2">
      <div className="flex items-center justify-between px-0.5 h-5 shrink-0">
        <h3 className="text-[13px] font-bold text-white/90 tracking-wide flex items-center gap-1.5">
          <FolderOpen className="w-3.5 h-3.5 text-cyan-300" /> 最近归档
        </h3>
        <span className="text-[10px] font-mono text-white/25">{isLoading ? '加载中…' : `${files.length} files`}</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
        {files.length === 0 && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-4">
            <Upload className="w-6 h-6 text-white/20" />
            <p className="text-[11px] text-white/35">还没有文件</p>
            <button
              onClick={() => navigate('/files')}
              className="h-7 px-3 rounded-full liquid-btn-ghost text-[10px] text-white/60"
            >
              去文件归档页上传
            </button>
          </div>
        )}
        {files.slice(0, 5).map((f) => (
          <button
            key={f.id}
            onClick={() => navigate('/files')}
            className="w-full text-left p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-cyan-400/25 hover:bg-white/[0.06] transition-colors group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/15 text-cyan-300 flex items-center justify-center shrink-0">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] font-medium text-white/85 truncate">{f.title}</div>
                <div className="text-[9.5px] text-white/35 truncate">
                  {f.uploader.name} · {formatFileSize(f.size)} · {new Date(f.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                </div>
              </div>
              <ArrowRight className="w-3 h-3 text-white/20 group-hover:text-cyan-300/70 shrink-0 transition-colors" />
            </div>
          </button>
        ))}
        {files.length > 5 && (
          <button
            onClick={() => navigate('/files')}
            className="w-full text-center py-1.5 text-[10px] text-cyan-300/70 hover:text-cyan-200 transition-colors"
          >
            查看全部 {files.length} 个文件 →
          </button>
        )}
      </div>
    </div>
  );
};
