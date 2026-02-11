import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  message,
  actionLabel,
  onAction,
  className = '',
}) => (
  <div
    className={`py-6 px-4 rounded text-center ${className}`}
    style={{
      background: 'var(--vscode-editor-inactiveSelectionBackground)',
      color: 'var(--vscode-descriptionForeground)',
    }}
  >
    <p className="text-sm mb-3">{message}</p>
    {actionLabel && onAction && (
      <Button variant="primary" size="md" onClick={onAction}>
        {actionLabel}
      </Button>
    )}
  </div>
);
