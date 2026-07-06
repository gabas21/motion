'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import dynamic from 'next/dynamic';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Import KaTeX CSS — wajib agar rumus LaTeX ter-render dengan benar
import 'katex/dist/katex.min.css';

const SyntaxHighlighter = dynamic(
  () => import('react-syntax-highlighter').then((mod) => mod.Prism),
  {
    ssr: false,
    loading: () => (
      <div className="bg-slate-900/60 text-slate-300 font-mono text-[0.78rem] p-4 overflow-x-auto rounded-xl">
        Memuat penyorot sintaksis...
      </div>
    ),
  }
);

interface MarkdownRendererProps {
  content: string;
  /** Ukuran font dasar: 'sm' (default, untuk balon chat) atau 'base' (untuk panel lebar) */
  size?: 'sm' | 'base';
}

/**
 * MarkdownRenderer — Komponen render kaya untuk Asep AI.
 * Mendukung: Markdown penuh, LaTeX/TeX matematika, syntax highlighting kode,
 * tabel GFM, task list, dan blockquote bergaya glassmorphism.
 */
export default function MarkdownRenderer({ content, size = 'sm' }: MarkdownRendererProps) {
  const textSizeClass = size === 'sm' ? 'text-xs md:text-sm' : 'text-sm md:text-base';

  // Pre-process content to replace literal \n (backslash + n) with real newlines
  const formattedContent = React.useMemo(() => {
    if (!content) return '';
    return content.replace(/\\n/g, '\n');
  }, [content]);

  return (
    <div className={`markdown-asep ${textSizeClass} leading-relaxed break-words w-full max-w-full overflow-hidden`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // ── Kode ─────────────────────────────────────────────────────────
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const isBlock = !!match;
            const codeContent = String(children).replace(/\n$/, '');

            if (isBlock) {
              return (
                <div className="my-3 rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-xl overflow-hidden w-full max-w-full shadow-lg shadow-black/20">
                  {/* Header blok kode: nama bahasa + tombol salin */}
                  <div className="flex items-center justify-between bg-white/5 border-b border-white/10 px-3 py-1.5">
                    <span className="text-blue-400 font-mono text-[10px] font-bold uppercase tracking-widest">
                      {match[1]}
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(codeContent)}
                      className="text-[9px] text-zinc-300 hover:text-cyan-400 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Salin
                    </button>
                  </div>
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      borderRadius: 0,
                      fontSize: '0.78rem',
                      lineHeight: '1.6',
                      background: 'rgba(15, 23, 42, 0.7)',
                      maxWidth: '100%',
                      overflowX: 'auto',
                    }}
                  >
                    {codeContent}
                  </SyntaxHighlighter>
                </div>
              );
            }

            // Inline code
            return (
              <code
                className="bg-black/[0.05] border border-black/10 px-1.5 py-0.5 rounded font-mono text-[0.78em] font-semibold text-rose-600 break-words whitespace-pre-wrap inline-block max-w-full"
                {...props}
              >
                {children}
              </code>
            );
          },

          // ── Heading ───────────────────────────────────────────────────────
          h1: ({ children }) => (
            <h1 className="font-heading font-bold text-base text-slate-900 mt-4 mb-2 border-b border-black/10 pb-1">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-heading font-bold text-sm text-slate-800 mt-3 mb-1.5 border-b border-black/5 pb-0.5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-heading font-semibold text-xs text-slate-700 mt-2 mb-1 uppercase tracking-wide">
              {children}
            </h3>
          ),

          // ── Paragraf ──────────────────────────────────────────────────────
          p: ({ children }) => (
            <p className="text-slate-800 my-1 leading-relaxed">{children}</p>
          ),

          // ── Bold & Italic ─────────────────────────────────────────────────
          strong: ({ children }) => (
            <strong className="font-extrabold text-slate-950">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-slate-600">{children}</em>
          ),

          // ── List ──────────────────────────────────────────────────────────
          ul: ({ children }) => (
            <ul className="my-1.5 space-y-0.5 pl-4">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-1.5 space-y-0.5 pl-4 list-decimal">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-slate-800 flex gap-2 items-start">
              <span className="mt-[5px] shrink-0 w-1.5 h-1.5 rounded-full bg-blue-600/70 inline-block" />
              <span>{children}</span>
            </li>
          ),

          // ── Blockquote ────────────────────────────────────────────────────
          blockquote: ({ children }) => (
            <blockquote className="my-2 pl-3 border-l-2 border-blue-600/40 bg-black/[0.04] backdrop-blur-sm rounded-r-lg py-1.5 pr-2">
              <div className="text-slate-600 italic text-xs">{children}</div>
            </blockquote>
          ),

          // ── Tabel GFM ─────────────────────────────────────────────────────
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-xl border border-black/10 shadow-lg shadow-black/5 bg-black/[0.02] backdrop-blur-sm">
              <table className="w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-black/[0.05] border-b border-black/10">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-bold text-slate-800 border-r border-black/5 last:border-r-0 uppercase tracking-wider text-[10px]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-1.5 text-slate-700 border-r border-black/5 last:border-r-0 border-b border-black/5">
              {children}
            </td>
          ),

          // ── Horizontal Rule ───────────────────────────────────────────────
          hr: () => <hr className="my-3 border-t border-black/10" />,

          // ── Link ──────────────────────────────────────────────────────────
          a: ({ href, children }) => {
            const isDocx = href && href.includes('/downloads/') && href.endsWith('.docx');
            if (isDocx) {
              const apiURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
              const baseURL = apiURL.replace('/api/v1', '').replace('/api', '');
              const fullURL = href.startsWith('http') ? href : `${baseURL}${href}`;
              return (
                <div className="my-3 text-center">
                  <a
                    href={fullURL}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2.5 px-6 py-3 bg-white border-2 border-black text-black font-black text-xs tracking-wider rounded-xl shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all duration-150 cursor-pointer"
                  >
                    <span className="p-1 bg-neoYellow border border-black rounded-lg">
                      📄
                    </span>
                    <span>{children}</span>
                  </a>
                </div>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 font-semibold underline underline-offset-2 hover:text-cyan-400 transition-colors"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {formattedContent}
      </ReactMarkdown>
    </div>
  );
}
