import React from 'react';

export interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** A-2 teaching empty: title, body, primary + optional secondary (e.g. Refresh). */
  variant?: 'default' | 'teaching';
  title?: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  message,
  actionLabel,
  onAction,
  variant = 'default',
  title,
  secondaryActionLabel,
  onSecondaryAction,
}) => {
  if (variant === 'teaching') {
    return (
      <div
        data-empty-teaching
        className="mx-1 mb-2 rounded p-3"
        style={{
          border: '1px dashed var(--vscode-inputValidation-warningBorder)',
          background: 'transparent',
          color: 'var(--vscode-foreground)',
        }}
      >
        {title && <h3 className="text-sm font-semibold m-0 mb-1">{title}</h3>}
        <p
          className="text-xs m-0 mb-3 leading-relaxed"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          {message}
        </p>
        <div className="flex flex-wrap gap-2 justify-end">
          {actionLabel && onAction && (
            <button
              type="button"
              data-empty-primary
              className="rounded px-2 py-1 text-xs focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--vscode-focusBorder)]"
              style={{
                background: 'var(--vscode-button-background)',
                color: 'var(--vscode-button-foreground)',
              }}
              onClick={onAction}
            >
              {actionLabel}
            </button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <button
              type="button"
              data-empty-secondary
              className="rounded px-2 py-1 text-xs focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--vscode-focusBorder)]"
              style={{
                background: 'var(--vscode-button-secondaryBackground)',
                color: 'var(--vscode-button-secondaryForeground)',
              }}
              onClick={onSecondaryAction}
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="py-6 px-4 rounded text-center"
      style={{
        background: 'var(--vscode-editor-inactiveSelectionBackground)',
        color: 'var(--vscode-descriptionForeground)',
      }}
    >
      <p className="text-sm mb-3">{message}</p>
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
