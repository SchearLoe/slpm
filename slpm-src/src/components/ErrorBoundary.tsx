import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * P5-1：全局错误边界。
 *
 * 当任意子组件渲染时抛出异常（如后端返回了不符合预期的数据结构），
 * 捕获后展示友好的错误页，而非整个应用白屏。
 * 提供「刷新页面」与「返回首页」两个恢复入口。
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] 捕获渲染异常:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  handleHome = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-screen liquid-shell flex items-center justify-center p-4">
          <div className="liquid-glass p-8 max-w-md text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 border border-rose-400/30 flex items-center justify-center text-rose-300">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div className="space-y-1">
              <h2 className="text-[18px] font-bold text-white tracking-tight">应用遇到了意外错误</h2>
              <p className="text-[12px] text-white/40 leading-relaxed">
                页面渲染时发生异常。通常刷新即可恢复；若持续出现，请检查网络或联系管理员。
              </p>
            </div>
            {this.state.error && (
              <details className="text-left p-3 rounded-xl bg-black/25 border border-white/[0.06] text-[11px] text-white/40 font-mono">
                <summary className="cursor-pointer hover:text-white/70">错误详情</summary>
                <pre className="mt-2 whitespace-pre-wrap break-all">{this.state.error.message}</pre>
              </details>
            )}
            <div className="flex justify-center gap-2 pt-1">
              <button onClick={this.handleHome} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/70">
                返回首页
              </button>
              <button onClick={this.handleReload} className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold">
                刷新页面
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
