import React from 'react';

/**
 * P6-E6：轻量级 Markdown 渲染器（零依赖）。
 *
 * 支持：标题 #、粗体 **、斜体 *、行内代码 `、链接 []()、
 * 无序/有序列表、引用 >、分隔线 ---、段落。
 * 不引入第三方库，避免包体积膨胀；对知识库文章正文足够。
 *
 * P9-UX3：标题渲染时附加稳定 id（slug），供知识库目录跳转锚定。
 */
export const Markdown: React.FC<{ content: string; className?: string }> = ({ content, className = '' }) => {
  const blocks = parseBlocks(content);
  return <div className={className}>{blocks.map((b, i) => renderBlock(b, i))}</div>;
};

/** 把标题文本转为 URL 友好的锚点 id（中文保留，去标点/空格转连字符） */
export function headingSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s.,;:!?'"`~()（）【】《》<>]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'heading';
}

type Block =
  | { type: 'h1' | 'h2' | 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'hr' }
  | { type: 'code'; text: string };

function parseBlocks(src: string): Block[] {
  const lines = src.split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 空行跳过
    if (!trimmed) {
      i++;
      continue;
    }

    // 分隔线
    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // 标题
    const h = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (h) {
      const level = h[1].length;
      blocks.push({ type: level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3', text: h[2] });
      i++;
      continue;
    }

    // 引用
    if (trimmed.startsWith('>')) {
      const text = trimmed.slice(1).trim();
      blocks.push({ type: 'quote', text });
      i++;
      continue;
    }

    // 代码块```
    if (trimmed.startsWith('```')) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      i++; // 跳过结束 ```
      blocks.push({ type: 'code', text: buf.join('\n') });
      continue;
    }

    // 无序列表
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // 有序列表
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // 段落（连续非空行合并）
    const buf: string[] = [trimmed];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|>|---|\*\*\*|```|[-*+]\s|\d+\.\s)/.test(lines[i].trim())) {
      buf.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: 'p', text: buf.join(' ') });
  }
  return blocks;
}

// 行内格式：粗体 / 斜体 / 行内代码 / 链接
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // 用占位拆分，依次匹配 [**bold**] [*italic*] [`code`] [ [text](url) ]
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2]) nodes.push(<strong key={key++} className="font-semibold text-white">{m[2]}</strong>);
    else if (m[3]) nodes.push(<em key={key++} className="italic">{m[3]}</em>);
    else if (m[4]) nodes.push(<code key={key++} className="px-1 py-0.5 rounded bg-white/10 text-emerald-200 font-mono text-[0.85em]">{m[4]}</code>);
    else if (m[5]) {
      // P7 安全修复：链接协议白名单——仅允许 http/https/mailto，拒绝 javascript:/data: 等 XSS 向量
      const rawUrl = m[6];
      const isSafe = /^(https?:|mailto:)/i.test(rawUrl) || (rawUrl.startsWith('/') && !rawUrl.startsWith('//'));
      if (isSafe) {
        nodes.push(<a key={key++} href={rawUrl} target="_blank" rel="noreferrer noopener" className="text-emerald-300 underline hover:text-emerald-200">{m[5]}</a>);
      } else {
        // 不安全协议降级为纯文本（不渲染成可点击链接）
        nodes.push(<span key={key++} className="text-white/50">{m[5]}</span>);
      }
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderBlock(b: Block, i: number): React.ReactNode {
  switch (b.type) {
    case 'h1':
      return <h1 key={i} id={headingSlug(b.text)} className="text-[16px] font-bold text-white mt-3 mb-1.5 scroll-mt-20">{renderInline(b.text)}</h1>;
    case 'h2':
      return <h2 key={i} id={headingSlug(b.text)} className="text-[14px] font-bold text-white mt-2.5 mb-1 scroll-mt-20">{renderInline(b.text)}</h2>;
    case 'h3':
      return <h3 key={i} id={headingSlug(b.text)} className="text-[13px] font-semibold text-white/90 mt-2 mb-1 scroll-mt-20">{renderInline(b.text)}</h3>;
    case 'p':
      return <p key={i} className="my-1.5 leading-relaxed">{renderInline(b.text)}</p>;
    case 'ul':
      return <ul key={i} className="list-disc pl-5 my-1.5 space-y-0.5">{b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ul>;
    case 'ol':
      return <ol key={i} className="list-decimal pl-5 my-1.5 space-y-0.5">{b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ol>;
    case 'quote':
      return <blockquote key={i} className="border-l-2 border-emerald-400/40 pl-3 my-2 text-white/60 italic">{renderInline(b.text)}</blockquote>;
    case 'hr':
      return <hr key={i} className="border-white/10 my-3" />;
    case 'code':
      return <pre key={i} className="my-2 p-2.5 rounded-lg bg-black/40 border border-white/[0.06] overflow-x-auto"><code className="text-[11px] font-mono text-emerald-200 whitespace-pre">{b.text}</code></pre>;
    default:
      return null;
  }
}
