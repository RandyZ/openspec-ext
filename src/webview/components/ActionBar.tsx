import React from 'react';
import { type WorkflowState } from '../utils/workflowState';
import { t } from '../../i18n';
import type { WorkflowAction as WorkflowCommandAction } from '../../shared/workflowCommand';
import {
  getWorkflowActionButtonLabel,
  getWorkflowActionTitle,
  type WorkflowLaunchConfigView,
} from '../utils/workflowLaunchLabels';

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
  workflowLaunchConfig?: WorkflowLaunchConfigView | null;
  hasDeltaSpecs?: boolean;
  onAction?: (action: WorkflowCommandAction, changeName: string) => void;
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
  workflowLaunchConfig,
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
          title={getWorkflowActionTitle(workflowState.nextAction.label, workflowLaunchConfig)}
          aria-label={getWorkflowActionTitle(workflowState.nextAction.label, workflowLaunchConfig)}
          onClick={() => onAction(workflowState.nextAction!.action as WorkflowCommandAction, changeName)}
        >
          {getWorkflowActionButtonLabel(workflowState.nextAction.label, workflowLaunchConfig)}
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
              {t('action.archiveChange')}
            </button>
          ) : (
            <button
              key={action.label}
              type="button"
              style={secondaryStyle}
              title={getWorkflowActionTitle(action.label, workflowLaunchConfig)}
              aria-label={getWorkflowActionTitle(action.label, workflowLaunchConfig)}
              onClick={() => onAction(action.action as WorkflowCommandAction, changeName)}
            >
              {getWorkflowActionButtonLabel(action.label, workflowLaunchConfig)}
            </button>
          )
        )}

      <button type="button" style={secondaryStyle} onClick={onOpenInEditor}>
        {t('action.openInEditor')}
      </button>

      <button type="button" style={secondaryStyle} onClick={onRefresh}>
        {t('action.refresh')}
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
      {t('action.openInEditor')}
    </button>
    {!isArchived && (
      <button type="button" style={warningStyle} onClick={() => onArchive(changeName)}>
        {t('action.archiveChange')}
      </button>
    )}
    <button type="button" style={secondaryStyle} onClick={onRefresh}>
      {t('action.refresh')}
    </button>
  </div>
);
