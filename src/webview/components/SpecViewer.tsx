import React, { useEffect, useState } from 'react';
import { useVscode } from '../hooks/useVscode';
import { MarkdownRenderer } from './MarkdownRenderer';
import { t } from '../../i18n';

export interface SpecViewerProps {
  specId: string;
  initialContent?: string;
}

export const SpecViewer: React.FC<SpecViewerProps> = ({ specId, initialContent }) => {
  const { onMessage } = useVscode();
  const [content, setContent] = useState<string | null>(initialContent ?? null);

  useEffect(() => {
    const cleanup = onMessage((event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'specContent' && msg.specId === specId) {
        setContent(msg.content ?? '');
      }
    });
    return cleanup;
  }, [specId, onMessage]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'var(--vscode-editor-background)',
        color: 'var(--vscode-foreground)',
      }}
    >
      <div
        className="p-3 border-b"
        style={{ borderColor: 'var(--vscode-panel-border)' }}
      >
        <h1 className="text-lg font-semibold">{specId}</h1>
      </div>

      <div className="p-3 flex-1 overflow-auto">
        {content === null ? (
          <div className="text-sm py-4" style={{ color: 'var(--vscode-descriptionForeground)' }}>
            {t('loading')}
          </div>
        ) : (
          <MarkdownRenderer content={content} />
        )}
      </div>
    </div>
  );
};
