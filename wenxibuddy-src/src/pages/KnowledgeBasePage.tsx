import React, { useMemo, useState } from 'react';
import { BookOpen, Search, Folder, FileText, Star, ChevronRight, Plus, Share2, Bookmark } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { LiquidModal } from '@/components/ui/LiquidModal';
import { LiquidSelect } from '@/components/ui/LiquidSelect';
import { useToast } from '@/components/ui/Toast';
import { useArticles, useCreateArticle, useToggleArticleStar } from '@/lib/queries';
import { apiError } from '@/lib/api';
import { ArticleCategory, KnowledgeArticle } from '@/types';

// 浏览量格式化：≥1000 显示为 1.2k，与原 demo 的 '2.4k' 风格一致
function formatViews(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export const KnowledgeBasePage: React.FC = () => {
  const { show, ToastEl } = useToast();
  const { data: articles = [], isLoading } = useArticles();
  const createArticleMut = useCreateArticle();
  const toggleStarMut = useToggleArticleStar();

  const [search, setSearch] = useState('');
  // openArticle 存完整文章对象（打开时可能已包含最新 views），不强制再拉一次详情
  const [openArticle, setOpenArticle] = useState<KnowledgeArticle | null>(null);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<{ title: string; category: ArticleCategory; body: string }>({
    title: '',
    category: 'UI/UX 规范',
    body: '',
  });

  // 分类文件夹（与后端 CATEGORIES 对齐）
  const folders: { name: ArticleCategory; label: string; color: string; match: (c: ArticleCategory) => boolean }[] = [
    { name: 'UI/UX 规范', label: 'UI/UX 规范', color: 'text-emerald-300', match: (c) => c === 'UI/UX 规范' },
    { name: '技术架构', label: '技术架构', color: 'text-cyan-300', match: (c) => c === '技术架构' },
    { name: '团队流程', label: '团队流程', color: 'text-violet-300', match: (c) => c === '团队流程' },
    { name: '质量保障', label: '质量保障', color: 'text-amber-300', match: (c) => c === '质量保障' },
  ];

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return articles.filter((a) => {
      const matchQ = !q || a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q) || a.category.toLowerCase().includes(q);
      const folder = folders.find((f) => f.label === activeFolder);
      const matchF = !folder || folder.match(a.category);
      return matchQ && matchF;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles, search, activeFolder]);

  // 置顶文章：列表中第一个（与原 demo「置顶推荐」位对应）
  const featured = articles[0] ?? null;

  const createArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    try {
      const article = await createArticleMut.mutateAsync({
        title: form.title.trim(),
        category: form.category,
        body: form.body || '',
      });
      setForm({ title: '', category: 'UI/UX 规范', body: '' });
      setCreateOpen(false);
      setOpenArticle(article);
      show('文章已发布到知识库');
    } catch (err) {
      show(apiError(err, '发布失败'));
    }
  };

  const toggleStar = (article: KnowledgeArticle) => {
    toggleStarMut.mutate({ id: article.id, starred: !article.starred });
  };

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-4 pb-1">
      {ToastEl}
      <div className="flex items-center justify-between gap-3 flex-nowrap shrink-0 overflow-x-auto">
        <div className="shrink-0">
          <h2 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2 whitespace-nowrap">
            <BookOpen className="w-5 h-5 text-emerald-300" />
            企业知识库 Wiki
          </h2>
          <p className="text-[11px] text-white/40 whitespace-nowrap">搜索 · 分类 · 发布 · 收藏 · 分享</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <div className="relative w-56 sm:w-72">
            <Search className="w-4 h-4 text-white/35 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="全文搜索知识库..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="liquid-pill w-full h-10 pl-9 pr-4 text-[12px] text-white placeholder:text-white/30 bg-transparent outline-none"
            />
          </div>
          <button onClick={() => setCreateOpen(true)} className="h-10 px-3.5 rounded-full liquid-btn-primary text-[12px] font-bold flex items-center gap-1.5 whitespace-nowrap">
            <Plus className="w-3.5 h-3.5" /> 发布文章
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3.5 overflow-y-auto">
        {featured ? (
          <GlassCard className="p-5 space-y-4" glowColor="emerald" variant="interactive" onClick={() => setOpenArticle(featured)}>
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-semibold border border-emerald-500/30">置顶推荐</span>
              <Star className={`w-4 h-4 ${featured.starred ? 'text-amber-300 fill-amber-300' : 'text-white/30'}`} />
            </div>
            <h3 className="text-[17px] font-bold text-white leading-snug">{featured.title}</h3>
            <p className="text-[12px] text-white/50 leading-relaxed line-clamp-2">{featured.body || '暂无正文，待补充。'}</p>
            <div className="pt-2 flex items-center justify-between text-[11px] text-white/40 border-t border-white/[0.06]">
              <span>作者: {featured.author.name} · 阅览 {formatViews(featured.views)}</span>
              <span className="text-emerald-300 font-semibold flex items-center gap-1">阅读全文 <ChevronRight className="w-3.5 h-3.5" /></span>
            </div>
          </GlassCard>
        ) : (
          <GlassCard className="p-8 flex flex-col items-center justify-center text-center gap-2">
            <BookOpen className="w-8 h-8 text-white/20" />
            <p className="text-[13px] text-white/50">{isLoading ? '加载中…' : '知识库还是空的'}</p>
            <p className="text-[11px] text-white/30">点击右上角「发布文章」沉淀第一篇最佳实践</p>
          </GlassCard>
        )}

        <div className="grid grid-cols-2 gap-3">
          {folders.map((cat) => (
            <button key={cat.name} onClick={() => setActiveFolder(activeFolder === cat.label ? null : cat.label)} className="text-left">
              <GlassCard variant={activeFolder === cat.label ? 'active' : 'interactive'} className="p-4 space-y-2 h-full">
                <Folder className={`w-6 h-6 ${cat.color}`} />
                <h4 className="text-[13px] font-bold text-white">{cat.label}</h4>
                <p className="text-[11px] text-white/40">{articles.filter((a) => cat.match(a.category)).length} 篇</p>
              </GlassCard>
            </button>
          ))}
        </div>

        <GlassCard className="p-5 space-y-3 lg:col-span-2 min-h-0">
          <div className="flex items-center justify-between gap-2 flex-nowrap">
            <h3 className="text-[13px] font-bold text-white flex items-center gap-2 whitespace-nowrap">
              <FileText className="w-4 h-4 text-emerald-300" />
              {activeFolder ? `分类 · ${activeFolder}` : '全部文章'}
            </h3>
            {activeFolder && (
              <button onClick={() => setActiveFolder(null)} className="text-[11px] text-emerald-300 hover:underline whitespace-nowrap">清除筛选</button>
            )}
          </div>
          <div className="divide-y divide-white/[0.05] max-h-[360px] overflow-y-auto">
            {filtered.map((art) => (
              <div key={art.id} className="py-3 flex items-center justify-between gap-3 px-1">
                <button onClick={() => setOpenArticle(art)} className="flex items-center gap-3 min-w-0 text-left flex-1">
                  <FileText className="w-4 h-4 text-white/30 shrink-0" />
                  <span className="text-[12px] font-semibold text-white truncate hover:text-emerald-200">{art.title}</span>
                </button>
                <div className="hidden sm:flex items-center gap-2 text-white/35 text-[10px] shrink-0">
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">{art.category}</span>
                  <span>{art.author.name}</span>
                  <button
                    onClick={() => toggleStar(art)}
                    className={`p-1.5 rounded-lg hover:bg-white/5 ${art.starred ? 'text-amber-300' : 'text-white/30'}`}
                    title="收藏"
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${art.starred ? 'fill-amber-300' : ''}`} />
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(art.title);
                      show('文章标题已复制，可分享');
                    }}
                    className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5"
                    title="分享"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="py-10 text-center text-[12px] text-white/35">
                {isLoading ? '加载中…' : '无匹配文章'}
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      <LiquidModal
        open={!!openArticle}
        onClose={() => setOpenArticle(null)}
        title={openArticle?.title ?? ''}
        subtitle={openArticle ? `${openArticle.category} · ${openArticle.author.name}` : undefined}
        icon={<BookOpen className="w-5 h-5" />}
        widthClass="max-w-2xl"
        footer={
          <div className="flex justify-end gap-2 flex-wrap">
            <button onClick={() => setOpenArticle(null)} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">关闭</button>
            <button
              onClick={() => openArticle && toggleStar(openArticle)}
              className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/70"
            >
              {openArticle?.starred ? '取消收藏' : '收藏'}
            </button>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(openArticle?.title ?? '');
                show('文章标题已复制，可分享');
              }}
              className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold"
            >
              分享
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-[13px] text-white/65 leading-relaxed">
          <p className="whitespace-pre-wrap">{openArticle?.body || '暂无正文，待补充。'}</p>
          <p className="text-[11px] text-white/35">浏览量 {openArticle ? formatViews(openArticle.views) : 0} · 由 {openArticle?.author.name} 发布</p>
        </div>
      </LiquidModal>

      <LiquidModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="发布知识库文章"
        subtitle="沉淀最佳实践"
        icon={<Plus className="w-5 h-5" />}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreateOpen(false)} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">取消</button>
            <button form="kb-form" type="submit" disabled={createArticleMut.isPending} className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold disabled:opacity-50">
              {createArticleMut.isPending ? '发布中…' : '发布'}
            </button>
          </div>
        }
      >
        <form id="kb-form" onSubmit={createArticle} className="space-y-3">
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="文章标题" className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white" />
          <LiquidSelect
            value={form.category}
            onChange={(v) => setForm({ ...form, category: v as ArticleCategory })}
            options={[
              { value: 'UI/UX 规范', label: 'UI/UX 规范' },
              { value: '技术架构', label: '技术架构' },
              { value: '团队流程', label: '团队流程' },
              { value: '质量保障', label: '质量保障' },
            ]}
          />
          <textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="正文内容" className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white resize-none" />
        </form>
      </LiquidModal>
    </div>
  );
};

export default KnowledgeBasePage;
