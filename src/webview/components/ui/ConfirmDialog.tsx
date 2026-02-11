import React from 'react';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        background: 'rgba(0,0,0,0.4)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="rounded p-4 max-w-md mx-2 shadow-lg"
        style={{
          background: 'var(--vscode-editor-background)',
          border: '1px solid var(--vscode-panel-border)',
        }}
      >
        <h2
          id="confirm-dialog-title"
          className="text-sm font-semibold mb-2"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          {title}
        </h2>
        <p
          className="text-sm mb-4"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          {message}
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="md" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="md"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
