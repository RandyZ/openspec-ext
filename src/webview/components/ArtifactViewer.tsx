import React from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

export interface ArtifactViewerProps {
  content: string | null;
  loading: boolean;
  error: string | null;
  errorCode?: string;
  onOpenInEditor?: () => void;
  onCreateWithAi?: () => void;
  onContinue?: () => void;
  onExplore?: () => void;
  /** When set, "用 AI 创建" renders as disabled with this tooltip reason */
  createDisabledReason?: string;
}

export const ArtifactViewer: React.FC<ArtifactViewerProps> = ({
  content,
  loading,
  error,
  errorCode,
  onOpenInEditor,
  onCreateWithAi,
  onContinue,
  onExplore,
  createDisabledReason,
}) => {
  if (loading) {
    return (
      <div
        className="py-6 text-sm"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
      >
        Loading...
      </div>
    );
  }

  if (error) {
    const isMissing = errorCode === 'ARTIFACT_MISSING';
    return (
      <div
        className="py-4 px-3 rounded text-sm"
        style={{
          background: isMissing
            ? 'var(--vscode-editor-inactiveSelectionBackground)'
            : 'var(--vscode-inputValidation-errorBackground)',
          color: isMissing
            ? 'var(--vscode-foreground)'
            : 'var(--vscode-errorForeground)',
        }}
      >
        <p className="mb-2">
          {isMissing
            ? '该内容尚未创建或文件已丢失。可使用 /opsx:continue 生成对应 artifact，或在编辑器中打开 change 目录查看。'
            : error}
        </p>
        {isMissing && (onCreateWithAi !== undefined || onContinue !== undefined) && (
          <div className="flex flex-wrap gap-2 items-center">
            {createDisabledReason ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled
                  className="px-3 py-1.5 rounded text-xs font-medium border-none"
                  style={{
                    background: 'var(--vscode-button-background)',
                    color: 'var(--vscode-button-foreground)',
                    opacity: 0.4,
                    cursor: 'not-allowed',
                  }}
                >
                  Continue
                </button>
                <span className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                  {createDisabledReason}
                </span>
              </div>
            ) : (
              <>
                {onContinue && (
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer border-none"
                    style={{
                      background: 'var(--vscode-button-background)',
                      color: 'var(--vscode-button-foreground)',
                    }}
                    onClick={onContinue}
                  >
                    Continue
                  </button>
                )}
                {!onContinue && onCreateWithAi && (
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer border-none"
                    style={{
                      background: 'var(--vscode-button-background)',
                      color: 'var(--vscode-button-foreground)',
                    }}
                    onClick={onCreateWithAi}
                  >
                    用 AI 创建
                  </button>
                )}
                {onExplore && (
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer border-none"
                    style={{
                      background: 'var(--vscode-button-secondaryBackground)',
                      color: 'var(--vscode-button-secondaryForeground)',
                    }}
                    onClick={onExplore}
                  >
                    Explore
                  </button>
                )}
              </>
            )}
          </div>
        )}
        {!isMissing && onOpenInEditor && (
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer border-none"
              style={{
                background: 'var(--vscode-button-secondaryBackground)',
                color: 'var(--vscode-button-secondaryForeground)',
              }}
              onClick={onOpenInEditor}
            >
              在编辑器中打开
            </button>
          </div>
        )}
      </div>
    );
  }

  if (content === null || content === '') {
    return (
      <div
        className="py-6 text-sm"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
      >
        No content
      </div>
    );
  }

  return (
    <div className="artifact-content overflow-auto">
      <MarkdownRenderer content={content} />
    </div>
  );
};
