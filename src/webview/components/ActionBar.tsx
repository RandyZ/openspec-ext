import React from 'react';
import { type WorkflowState } from '../utils/workflowState';

const buttonBase: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: '12px',
  fontWeight: 500,
  borderRadius: '4px',
  border: 'none',
  cursor: 'pointer',
};

const primaryStyle: React.CSSProperties = {
  ...buttonBase,
  background: 'var(--vscode-button-background)',
  color: 'var(--vscode-button-foreground)',
};

const secondaryStyle: React.CSSProperties = {
  ...buttonBase,
  background: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
};

const warningStyle: React.CSSProperties = {
  ...buttonBase,
  background: 'var(--vscode-inputValidation-warningBackground)',
  color: 'var(--vscode-editor-foreground)',
};

export interface ActionBarProps {
  changeName: string;
  isArchived: boolean;
  workflowState?: WorkflowState;
  hasDeltaSpecs?: boolean;
  onAction?: (command: string) => void;
  onCopyFf: (changeName: string) => void;
  onCopyApply: (changeName: string) => void;
  onOpenInEditor: () => void;
  onArchive: (changeName: string) => void;
  onRefresh: () => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  changeName,
  isArchived,
  workflowState,
  onAction,
  onCopyFf,
  onCopyApply,
  onOpenInEditor,
  onArchive,
  onRefresh,
}) => {
  if (!workflowState || !onAction) {
    return (
      <LegacyActionBar
        changeName={changeName}
        isArchived={isArchived}
        onCopyFf={onCopyFf}
        onCopyApply={onCopyApply}
        onOpenInEditor={onOpenInEditor}
        onArchive={onArchive}
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--vscode-panel-border)',
        background: 'var(--vscode-editor-background)',
      }}
    >
      {!isArchived && workflowState.nextAction && (
        <button
          type="button"
          style={primaryStyle}
          onClick={() => onAction(workflowState.nextAction!.command)}
        >
          {workflowState.nextAction.label}
        </button>
      )}

      {!isArchived &&
        workflowState.secondaryActions.map((action) =>
          action.label === 'Archive' ? (
            <button
              key={action.label}
              type="button"
              style={warningStyle}
              onClick={() => onArchive(changeName)}
            >
              Archive Change
            </button>
          ) : (
            <button
              key={action.label}
              type="button"
              style={secondaryStyle}
              onClick={() => onAction(action.command)}
            >
              {action.label}
            </button>
          )
        )}

      <button type="button" style={secondaryStyle} onClick={onOpenInEditor}>
        Open in Editor
      </button>

      <button type="button" style={secondaryStyle} onClick={onRefresh}>
        Refresh
      </button>
    </div>
  );
};

const LegacyActionBar: React.FC<{
  changeName: string;
  isArchived: boolean;
  onCopyFf: (changeName: string) => void;
  onCopyApply: (changeName: string) => void;
  onOpenInEditor: () => void;
  onArchive: (changeName: string) => void;
  onRefresh: () => void;
}> = ({ changeName, isArchived, onCopyFf, onCopyApply, onOpenInEditor, onArchive, onRefresh }) => (
  <div
    className="flex flex-wrap items-center gap-2"
    style={{
      padding: '8px 12px',
      borderBottom: '1px solid var(--vscode-panel-border)',
      background: 'var(--vscode-editor-background)',
    }}
  >
    <button type="button" style={secondaryStyle} onClick={() => onCopyFf(changeName)}>
      Copy /opsx:ff
    </button>
    <button type="button" style={secondaryStyle} onClick={() => onCopyApply(changeName)}>
      Copy /opsx:apply
    </button>
    <button type="button" style={secondaryStyle} onClick={onOpenInEditor}>
      Open in Editor
    </button>
    {!isArchived && (
      <button type="button" style={warningStyle} onClick={() => onArchive(changeName)}>
        Archive Change
      </button>
    )}
    <button type="button" style={secondaryStyle} onClick={onRefresh}>
      Refresh
    </button>
  </div>
);
