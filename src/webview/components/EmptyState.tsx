import React from 'react';

export interface EmptyStateProps {
  message: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  message,
  hint,
  actionLabel,
  onAction,
}) => {
  return (
    <div
      className="py-6 px-4 rounded text-center"
      data-empty-state={hint ? 'healthy-active' : undefined}
      style={{
        background: 'var(--vscode-editor-inactiveSelectionBackground)',
        color: 'var(--vscode-descriptionForeground)',
      }}
    >
      {hint ? (
        <>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--vscode-foreground)' }}>
            {message}
          </p>
          <p className="text-sm mb-3">{hint}</p>
        </>
      ) : (
        <p className="text-sm mb-3">{message}</p>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          className="px-3 py-1.5 rounded text-sm font-medium cursor-pointer border-none transition-opacity hover:opacity-90"
          style={{
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
          }}
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
