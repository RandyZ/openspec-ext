import React, { useEffect, useRef } from 'react';
import { marked } from 'marked';
import mermaid from 'mermaid';

function escapeHtml(html: string): string {
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

marked.setOptions({
  gfm: true,
  breaks: true,
});

marked.use({
  renderer: {
    code(token: { text: string; lang?: string }) {
      const lang = (token.lang || '').toLowerCase();
      if (lang === 'mermaid') {
        return `<div class="mermaid">${escapeHtml(token.text)}</div>`;
      }
      return false;
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
