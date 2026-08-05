import React from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  onRetry?: () => void;
  message?: string;
  className?: string;
}

/**
 * P5-1：列表查询失败时的错误占位组件。
 *
 * 使用方式（任意页面）：
 *   const { data, isError, refetch } = useTasks();
 *   if (isError) return <QueryError onRetry={refetch} />;
 */
export const QueryError: React.FC<Props> = ({
  onRetry,
  message = '数据加载失败，可能是网络问题或服务器暂不可用',
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-10 text-center ${className}`}>
      <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-400/25 flex items-center justify-center text-rose-300">
        <RefreshCw className="w-5 h-5" />
      </div>
      <div className="space-y-0.5">
        <p className="text-[13px] font-semibold text-white/70">加载失败</p>
        <p className="text-[11px] text-white/35 max-w-xs">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="h-8 px-4 rounded-full liquid-btn-primary text-[11px] font-bold flex items-center gap-1.5"
        >
          <RefreshCw className="w-3 h-3" /> 重新加载
        </button>
      )}
    </div>
  );
};
