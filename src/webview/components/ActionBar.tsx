import React from 'react';

const buttonBase = {
  padding: '6px 10px',
  fontSize: '12px',
  fontWeight: 500,
  borderRadius: '4px',
  border: 'none',
  cursor: 'pointer' as const,
};

export interface ActionBarProps {
  changeName: string;
  isArchived: boolean;
  onCopyFf: (changeName: string) => void;
  onCopyApply: (changeName: string) => void;
  onOpenInEditor: () => void;
  onArchive: (changeName: string) => void;
  onRefresh: () => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  changeName,
  isArchived,
  onCopyFf,
  onCopyApply,
  onOpenInEditor,
  onArchive,
  onRefresh,
}) => {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--vscode-panel-border)',
        background: 'var(--vscode-editor-background)',
      }}
    >
      <button
        type="button"
        style={{
          ...buttonBase,
          background: 'var(--vscode-button-secondaryBackground)',
          color: 'var(--vscode-button-secondaryForeground)',
        }}
        onClick={() => onCopyFf(changeName)}
      >
        Copy /opsx:ff
      </button>
      <button
        type="button"
        style={{
          ...buttonBase,
          background: 'var(--vscode-button-secondaryBackground)',
          color: 'var(--vscode-button-secondaryForeground)',
        }}
        onClick={() => onCopyApply(changeName)}
      >
        Copy /opsx:apply
      </button>
      <button
        type="button"
        style={{
          ...buttonBase,
          background: 'var(--vscode-button-secondaryBackground)',
          color: 'var(--vscode-button-secondaryForeground)',
        }}
        onClick={onOpenInEditor}
      >
        Open in Editor
      </button>
      {!isArchived && (
        <button
          type="button"
          style={{
            ...buttonBase,
            background: 'var(--vscode-inputValidation-warningBackground)',
            color: 'var(--vscode-editor-foreground)',
          }}
          onClick={() => onArchive(changeName)}
        >
          Archive Change
        </button>
      )}
      <button
        type="button"
        style={{
          ...buttonBase,
          background: 'var(--vscode-button-secondaryBackground)',
          color: 'var(--vscode-button-secondaryForeground)',
        }}
        onClick={onRefresh}
      >
        Refresh
      </button>
    </div>
  );
};
