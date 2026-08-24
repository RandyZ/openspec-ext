import React from 'react';
import { type WorkflowState } from '../utils/workflowState';
import type { ResolvedWorkflowActions } from '../../shared/changeWorkflow';
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

function getReceiptLabel(status: string): string {
  const labels: Record<string, Parameters<typeof t>[0]> = {
    pending: 'workflow.receiptPending',
    delivered: 'workflow.receiptDelivered',
    copied: 'workflow.receiptCopied',
    fallback: 'workflow.receiptFallback',
    failed: 'workflow.receiptFailed',
  };
  return labels[status] ? t(labels[status]) : status;
}

export interface ActionBarProps {
  changeName: string;
  isArchived: boolean;
  workflowState?: WorkflowState;
  resolvedActions?: ResolvedWorkflowActions;
  workflowLaunchConfig?: WorkflowLaunchConfigView | null;
  hasDeltaSpecs?: boolean;
  onAction?: (action: WorkflowCommandAction, changeName: string) => void;
  pendingAction?: WorkflowCommandAction | null;
  receiptStatus?: string;
  receiptMessage?: string;
  onCopyFf: (changeName: string) => void;
  onCopyApply: (changeName: string) => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  changeName,
  isArchived,
  workflowState,
  resolvedActions,
  workflowLaunchConfig,
  onAction,
  pendingAction,
  receiptStatus,
  receiptMessage,
  onCopyFf,
  onCopyApply,
}) => {
  if (!workflowState && !resolvedActions) return null;
  if (!onAction) {
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
      {!isArchived && (resolvedActions?.recommended ?? workflowState?.nextAction) && (
        <button
          type="button"
          style={primaryStyle}
          title={getWorkflowActionTitle(
            (resolvedActions?.recommended ?? workflowState?.nextAction)!.label,
            workflowLaunchConfig
          )}
          aria-label={getWorkflowActionTitle(
            (resolvedActions?.recommended ?? workflowState?.nextAction)!.label,
            workflowLaunchConfig
          )}
          onClick={() => onAction(
            (resolvedActions?.recommended ?? workflowState?.nextAction)!.action as WorkflowCommandAction,
            changeName
          )}
          disabled={pendingAction === (resolvedActions?.recommended ?? workflowState?.nextAction)!.action}
        >
          {getWorkflowActionButtonLabel(
            (resolvedActions?.recommended ?? workflowState?.nextAction)!.label,
            workflowLaunchConfig
          )}
        </button>
      )}

      {!isArchived &&
        (resolvedActions?.available ?? workflowState?.secondaryActions ?? []).map((action) =>
          <button
            key={action.label}
            type="button"
            style={secondaryStyle}
            title={getWorkflowActionTitle(action.label, workflowLaunchConfig)}
            aria-label={getWorkflowActionTitle(action.label, workflowLaunchConfig)}
            onClick={() => onAction(action.action as WorkflowCommandAction, changeName)}
            disabled={pendingAction === action.action}
          >
            {getWorkflowActionButtonLabel(action.label, workflowLaunchConfig)}
          </button>
        )}

      {!isArchived && resolvedActions?.highImpact.length ? (
        <div className="flex flex-wrap items-center gap-2 ml-2" role="group" aria-label={t('workflow.highImpact')}>
          {resolvedActions.highImpact.map((action) => (
            <button
              key={`high-impact:${action.action}:${action.artifactId ?? ''}`}
              type="button"
              data-high-impact="true"
              style={secondaryStyle}
              title={getWorkflowActionTitle(action.label, workflowLaunchConfig)}
              aria-label={getWorkflowActionTitle(action.label, workflowLaunchConfig)}
              onClick={() => onAction(action.action as WorkflowCommandAction, changeName)}
              disabled={pendingAction === action.action}
            >
              {getWorkflowActionButtonLabel(action.label, workflowLaunchConfig)}
            </button>
          ))}
        </div>
      ) : null}
      {receiptStatus && (
        <div className="basis-full text-xs" role="status" aria-live="polite">
          {getReceiptLabel(receiptStatus)}{receiptMessage ? `: ${receiptMessage}` : ''}
        </div>
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
