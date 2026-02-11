import React, { useEffect, useRef } from 'react';
import { marked } from 'marked';
import mermaid from 'mermaid';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

function escapeHtml(html: string): string {
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function highlightCode(code: string, lang: string): string {
  if (!lang || !hljs.getLanguage(lang)) {
    return escapeHtml(code);
  }
  try {
    return hljs.highlight(code, { language: lang }).value;
  } catch {
    return escapeHtml(code);
  }
}

function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
    || 'heading';
}

marked.setOptions({
  gfm: true,
  breaks: true,
});

marked.use({
  renderer: {
    heading(this: { parser: { parseInline: (tokens: unknown[]) => string } }, token: { depth: number; text: string; tokens: unknown[] }) {
      const slug = slugifyHeading(token.text);
      const inner = this.parser.parseInline(token.tokens);
      return `<h${token.depth} id="${escapeHtml(slug)}">${inner}</h${token.depth}>`;
    },
    code(token: { text: string; lang?: string }) {
      const lang = (token.lang || '').toLowerCase();
      if (lang === 'mermaid') {
        return `<div class="mermaid">${escapeHtml(token.text)}</div>`;
      }
      const highlighted = highlightCode(token.text, lang || 'plaintext');
      const langClass = lang ? ` language-${lang}` : '';
      return `<pre><code class="hljs${langClass}">${highlighted}</code></pre>`;
    },
  },
});

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'strict',
});

export interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const html = React.useMemo(() => {
    try {
      return marked(content, { async: false });
    } catch {
      return '';
    }
  }, [content]);

  useEffect(() => {
    if (!containerRef.current) return;
    const nodeList = containerRef.current.querySelectorAll('.mermaid');
    if (nodeList.length === 0) return;
    const nodes = Array.from(nodeList) as HTMLElement[];
    mermaid.run({ nodes }).catch((err) => {
      console.warn('Mermaid render error:', err);
    });
  }, [html]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]');
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;
      const id = href.slice(1);
      const targetEl = el.querySelector(`[id="${id}"]`);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, [html]);

  return (
    <div
      ref={containerRef}
      className={`markdown-body ${className}`}
      style={{
        color: 'var(--vscode-foreground)',
        fontSize: '13px',
        lineHeight: 1.5,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
