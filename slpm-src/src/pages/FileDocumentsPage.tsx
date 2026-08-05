import React, { useMemo, useRef, useState } from 'react';
import { FileText, Search, UploadCloud, Download, Eye, Share2, MoreHorizontal, Paperclip, Pencil, Check, X, LayoutGrid, List as ListIcon } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { LiquidModal } from '@/components/ui/LiquidModal';
import { LiquidSelect } from '@/components/ui/LiquidSelect';
import { QueryError } from '@/components/QueryError';
import { useToast } from '@/components/ui/Toast';
import { FileRecord } from '@/types';
import { useFiles, useUploadFile, useDeleteFile, useRenameFile, useFilePreviewUrl, downloadFile } from '@/lib/queries';
import { apiError, formatFileSize } from '@/lib/api';
import { AnimatePresence, motion } from 'framer-motion';

export const FileDocumentsPage: React.FC = () => {
  const { show, ToastEl } = useToast();
  // P1-3：从后端拉真实文件（按工作区隔离）
  const { data: files = [], isLoading, isError, refetch } = useFiles();
  const uploadFile = useUploadFile();
  const deleteFile = useDeleteFile();
  const renameFile = useRenameFile(); // P1-5 重命名
  // P1-5：预览 blob URL（用 fileId 触发 lazy fetch）
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);

  if (isError) {
    return <QueryError onRetry={() => refetch()} message="文件列表加载失败，请检查网络或工作区状态" />;
  }
  const previewBlobQ = useFilePreviewUrl(previewFileId);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [searchQuery, setSearchQuery] = useState('');
  // P6-E7：网格/列表视图切换（localStorage 持久化）
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => (localStorage.getItem('slpm_file_view') as 'grid' | 'list') || 'grid');
  const switchView = (m: 'grid' | 'list') => {
    setViewMode(m);
    localStorage.setItem('slpm_file_view', m);
  };
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

  // 上传表单状态
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('产品文档');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = ['全部', '产品文档', '设计规范', '技术文档', '测试文档', 'AI 算法', '通用文档'];
  const filteredFiles = useMemo(
    () =>
      files.filter((f) => {
        const matchCategory = selectedCategory === '全部' || f.category === selectedCategory;
        const matchSearch = f.title.toLowerCase().includes(searchQuery.toLowerCase()) || f.originalName.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCategory && matchSearch;
      }),
    [files, selectedCategory, searchQuery]
  );
  const previewFile = files.find((f) => f.id === previewId) ?? null;

  // P1-5：打开预览时对图片/PDF 触发 blob fetch
  React.useEffect(() => {
    if (previewFile && (previewFile.mimeType.startsWith('image/') || previewFile.mimeType === 'application/pdf')) {
      setPreviewFileId(previewFile.id);
    } else {
      setPreviewFileId(null);
    }
  }, [previewFile?.id]);

  // 提交上传：构造 FormData，调真实 API
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      show('请先选择文件');
      return;
    }
    try {
      await uploadFile.mutateAsync({
        file: selectedFile,
        title: uploadTitle.trim() || selectedFile.name,
        category: uploadCategory,
        tags: ['新增', uploadCategory],
      });
      // 重置表单
      setSelectedFile(null);
      setUploadTitle('');
      setShowUpload(false);
      show('文档已上传并归档');
    } catch (err) {
      show(apiError(err, '上传失败'));
    }
  };

  // 真实下载
  const handleDownload = async (file: FileRecord) => {
    try {
      await downloadFile(file.id, file.originalName);
      show(`已开始下载：${file.title}`);
    } catch (err) {
      show(apiError(err, '下载失败'));
    }
  };

  // 真实删除
  const handleDelete = async (file: FileRecord) => {
    setMenuId(null);
    try {
      await deleteFile.mutateAsync(file.id);
      show('文档已删除');
    } catch (err) {
      show(apiError(err, '删除失败'));
    }
  };

  // P1-5：重命名文件
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameId || !renameTitle.trim()) return;
    try {
      await renameFile.mutateAsync({ id: renameId, title: renameTitle.trim() });
      setRenameId(null);
      show('文档已重命名');
    } catch (err) {
      show(apiError(err, '重命名失败'));
    }
  };

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-4 pb-1">
      {ToastEl}
      <div className="flex items-center justify-between gap-3 flex-nowrap shrink-0 overflow-x-auto">
        <div className="shrink-0">
          <h2 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2 whitespace-nowrap">
            <FileText className="w-5 h-5 text-emerald-300" />
            文件文档归档
          </h2>
          <p className="text-[11px] text-white/40 whitespace-nowrap">上传 · 预览 · 下载 · 分享 · 删除（真实持久化）</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 ml-auto"
        >
          <UploadCloud className="w-4 h-4" />
          上传新文档
        </button>
      </div>

      <div className="flex items-center gap-3 flex-nowrap shrink-0 overflow-x-auto">
        <div className="liquid-pill p-1 flex items-center gap-1 shrink-0 whitespace-nowrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="relative w-56 sm:w-64 shrink-0 ml-auto">
          <Search className="w-4 h-4 text-white/35 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索文档名称..."
            className="liquid-pill w-full h-9 pl-9 pr-3 text-[12px] text-white placeholder:text-white/30 bg-transparent outline-none"
          />
        </div>
        {/* P6-E7：网格/列表视图切换 */}
        <div className="liquid-pill p-1 flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => switchView('grid')}
            className={`w-7 h-7 rounded-md flex items-center justify-center ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}
            title="网格视图"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => switchView('list')}
            className={`w-7 h-7 rounded-md flex items-center justify-center ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}
            title="列表视图"
          >
            <ListIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="py-16 text-center text-[12px] text-white/35">加载中…</div>
        ) : (
          <>
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5' : 'flex flex-col gap-2'}>
              {filteredFiles.map((file) => (
                <GlassCard key={file.id} variant="interactive" className={viewMode === 'grid' ? 'p-5 space-y-4 flex flex-col justify-between relative' : 'p-3 flex items-center gap-3 relative'}>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="liquid-icon-well w-10 h-10 rounded-xl flex items-center justify-center text-emerald-300">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono text-white/40 px-2 py-0.5 rounded-md bg-black/30 border border-white/10">{formatFileSize(file.size)}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuId(menuId === file.id ? null : file.id);
                          }}
                          className="p-1 rounded-lg text-white/35 hover:text-white hover:bg-white/5"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-[13px] font-bold text-white line-clamp-2">{file.title}</h3>
                      <p className="text-[11px] text-white/40 mt-1 truncate">分类: {file.category} · {file.uploader.name} · {file.originalName}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {file.tags.map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded text-[10px] bg-white/5 border border-white/10 text-white/55">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="text-[10px] font-mono text-white/30">{new Date(file.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setPreviewId(file.id)} className="liquid-btn-ghost w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white" title="预览">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDownload(file)} className="liquid-btn-ghost w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-emerald-300" title="下载">
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(file.title);
                          show('分享链接已复制');
                        }}
                        className="liquid-btn-ghost w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white"
                        title="分享"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {menuId === file.id && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute right-3 top-12 z-20 p-1 liquid-glass min-w-[132px]"
                      >
                        <button onClick={() => { setPreviewId(file.id); setMenuId(null); }} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] text-white/70 hover:bg-white/5">
                          <Eye className="w-3 h-3" /> 预览
                        </button>
                        <button onClick={() => handleDownload(file)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] text-white/70 hover:bg-white/5">
                          <Download className="w-3 h-3" /> 下载
                        </button>
                        <button
                          onClick={() => { setRenameId(file.id); setRenameTitle(file.title); setMenuId(null); }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] text-white/70 hover:bg-white/5"
                        >
                          <Pencil className="w-3 h-3" /> 重命名
                        </button>
                        <button onClick={() => handleDelete(file)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] text-rose-300 hover:bg-rose-500/10">
                          <MoreHorizontal className="w-3 h-3" /> 删除
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </GlassCard>
              ))}
            </div>
            {filteredFiles.length === 0 && <div className="py-16 text-center text-[12px] text-white/35">暂无匹配文档</div>}
          </>
        )}
      </div>

      {/* 上传弹窗：真实文件选择 + multipart 上传 */}
      <LiquidModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        title="上传新文档"
        subtitle="归档到当前工作区（最大 20MB）"
        icon={<UploadCloud className="w-5 h-5" />}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowUpload(false)} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">取消</button>
            <button form="upload-form" type="submit" disabled={uploadFile.isPending} className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold disabled:opacity-60">
              {uploadFile.isPending ? '上传中…' : '确认上传'}
            </button>
          </div>
        }
      >
        <form id="upload-form" className="space-y-3" onSubmit={handleUpload}>
          {/* 文件选择器 */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl liquid-input text-left text-[12px] text-white/70 hover:text-white"
          >
            <Paperclip className="w-4 h-4 text-emerald-300 shrink-0" />
            <span className="truncate flex-1">
              {selectedFile ? selectedFile.name : '点击选择文件'}
            </span>
            {selectedFile && (
              <span className="text-[10px] text-white/40 font-mono shrink-0">{formatFileSize(selectedFile.size)}</span>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setSelectedFile(f ?? null);
              // 未填标题时用文件名预填
              if (f && !uploadTitle.trim()) setUploadTitle(f.name.replace(/\.[^.]+$/, ''));
            }}
          />
          {/* 标题（可选，默认用文件名） */}
          <input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="文档标题（可选，默认用文件名）" className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white" />
          <LiquidSelect
            value={uploadCategory}
            onChange={setUploadCategory}
            options={categories.filter((c) => c !== '全部').map((c) => ({ value: c, label: c }))}
          />
        </form>
      </LiquidModal>

      {/* 预览弹窗：真实元数据 */}
      <LiquidModal
        open={!!previewFile}
        onClose={() => setPreviewId(null)}
        title={previewFile?.title ?? ''}
        subtitle={previewFile ? `${previewFile.category} · ${formatFileSize(previewFile.size)}` : undefined}
        icon={<FileText className="w-5 h-5" />}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setPreviewId(null)} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">关闭</button>
            <button onClick={() => { if (previewFile) handleDownload(previewFile); }} className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" /> 下载附件
            </button>
          </div>
        }
      >
        {previewFile && (
          <div className="space-y-2 text-[13px] text-white/65 leading-relaxed">
            {/* P1-5：图片/PDF 内联预览 */}
            {previewFile.mimeType.startsWith('image/') || previewFile.mimeType === 'application/pdf' ? (
              <div className="rounded-xl overflow-hidden border border-white/10 bg-black/30 min-h-[180px] flex items-center justify-center">
                {previewBlobQ.isLoading ? (
                  <span className="text-white/40 text-[12px]">加载预览…</span>
                ) : previewBlobQ.data ? (
                  previewFile.mimeType === 'application/pdf' ? (
                    <iframe src={previewBlobQ.data} className="w-full h-[360px]" title={previewFile.title} />
                  ) : (
                    <img src={previewBlobQ.data} alt={previewFile.title} className="max-w-full max-h-[360px] object-contain" />
                  )
                ) : (
                  <span className="text-rose-300/70 text-[12px]">预览加载失败</span>
                )}
              </div>
            ) : null}
            <p><span className="text-white/40">原始文件名：</span>{previewFile.originalName}</p>
            <p><span className="text-white/40">类型：</span>{previewFile.mimeType || '未知'} · <span className="text-white/40">大小：</span>{formatFileSize(previewFile.size)}</p>
            <p><span className="text-white/40">上传者：</span>{previewFile.uploader.name} · <span className="text-white/40">时间：</span>{new Date(previewFile.createdAt).toLocaleString('zh-CN')}</p>
            {previewFile.tags.length > 0 && <p><span className="text-white/40">标签：</span>{previewFile.tags.join('、')}</p>}
          </div>
        )}
      </LiquidModal>

      {/* P1-5：重命名弹窗 */}
      <LiquidModal
        open={!!renameId}
        onClose={() => setRenameId(null)}
        title="重命名文档"
        subtitle="修改标题不会影响原始文件名和下载"
        icon={<Pencil className="w-5 h-5" />}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setRenameId(null)} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">取消</button>
            <button form="rename-form" type="submit" disabled={renameFile.isPending} className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold disabled:opacity-60">
              {renameFile.isPending ? '保存中…' : '保存'}
            </button>
          </div>
        }
      >
        <form id="rename-form" onSubmit={handleRename}>
          <input
            autoFocus
            required
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
            className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white"
          />
        </form>
      </LiquidModal>
    </div>
  );
};
