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

export interface ActionBarProps {
  changeName: string;
  isArchived: boolean;
  workflowState?: WorkflowState;
  workflowLaunchConfig?: WorkflowLaunchConfigView | null;
  hasDeltaSpecs?: boolean;
  onAction?: (action: WorkflowCommandAction, changeName: string) => void;
  onCopyFf: (changeName: string) => void;
  onCopyApply: (changeName: string) => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  changeName,
  isArchived,
  workflowState,
  workflowLaunchConfig,
  onAction,
  onCopyFf,
  onCopyApply,
}) => {
  if (!workflowState || !onAction) {
    return (
      <LegacyActionBar
        changeName={changeName}
        isArchived={isArchived}
        onCopyFf={onCopyFf}
        onCopyApply={onCopyApply}
      />
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      style={{
        padding: '10px 16px',
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
        )}
    </div>
  );
};

const LegacyActionBar: React.FC<{
  changeName: string;
  isArchived: boolean;
  onCopyFf: (changeName: string) => void;
  onCopyApply: (changeName: string) => void;
}> = ({ changeName, onCopyFf, onCopyApply }) => (
  <div
    className="flex flex-wrap items-center gap-2"
    style={{
      padding: '10px 16px',
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
  </div>
);
