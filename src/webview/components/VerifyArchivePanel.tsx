import React from 'react';
import type { InteractiveWorkflowAction } from '../../shared/interactiveWorkflow';
import { t } from '../../i18n';
import {
  getVerifyArchiveDescription,
  getVerifyArchiveHint,
  getVerifyArchiveRunLabel,
  type WorkflowLaunchConfigView,
} from '../utils/workflowLaunchLabels';

export interface VerifyArchivePanelProps {
  isArchived: boolean;
  canArchiveNow?: boolean;
  archiveNowDisabledReason?: string;
  pendingAction?: InteractiveWorkflowAction | null;
  workflowLaunchConfig?: WorkflowLaunchConfigView | null;
  onRun: (action: InteractiveWorkflowAction) => void;
  onArchiveNow?: () => void;
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: 6,
  padding: 12,
  background: 'var(--vscode-editor-background)',
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  background: 'var(--vscode-button-background)',
  color: 'var(--vscode-button-foreground)',
  fontSize: 12,
  fontWeight: 600,
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '7px 10px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  background: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
  fontSize: 12,
};

const mutedTextStyle: React.CSSProperties = {
  color: 'var(--vscode-descriptionForeground)',
  fontSize: 12,
  lineHeight: 1.5,
};

export const VerifyArchivePanel: React.FC<VerifyArchivePanelProps> = ({
  isArchived,
  canArchiveNow = false,
  archiveNowDisabledReason,
  pendingAction,
  workflowLaunchConfig,
  onRun,
  onArchiveNow,
}) => {
  const directArchiveDisabledReason = archiveNowDisabledReason
    ?? (isArchived ? t('verifyArchive.archiveDisabledArchived') : t('verifyArchive.archiveDisabledIncomplete'));

  return (
    <div className="flex flex-col gap-4">
      <div style={cardStyle}>
        <div className="text-sm font-semibold mb-2">{t('verifyArchive.title')}</div>
        <p style={mutedTextStyle}>{getVerifyArchiveDescription(workflowLaunchConfig)}</p>
      </div>

      <WorkflowActionCard
        action="verify"
        disabled={false}
        launching={pendingAction === 'verify'}
        workflowLaunchConfig={workflowLaunchConfig}
        onRun={onRun}
      />

      <WorkflowActionCard
        action="archive"
        disabled={isArchived}
        launching={pendingAction === 'archive'}
        workflowLaunchConfig={workflowLaunchConfig}
        disabledMessage={isArchived ? t('verifyArchive.archiveDisabledArchived') : undefined}
        onRun={onRun}
      />

      <section style={cardStyle} aria-label={t('verifyArchive.archiveNow')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">{t('verifyArchive.archiveNow')}</div>
            {!canArchiveNow && (
              <div
                id="archive-now-disabled-reason"
                role="note"
                style={mutedTextStyle}
              >
                {directArchiveDisabledReason}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={!canArchiveNow}
            aria-describedby={!canArchiveNow ? 'archive-now-disabled-reason' : undefined}
            aria-label={canArchiveNow
              ? t('verifyArchive.archiveNow')
              : `${t('verifyArchive.archiveNow')}: ${directArchiveDisabledReason}`}
            onClick={() => {
              if (canArchiveNow) onArchiveNow?.();
            }}
            style={{
              ...secondaryButtonStyle,
              opacity: canArchiveNow ? 1 : 0.45,
              cursor: canArchiveNow ? 'pointer' : 'not-allowed',
            }}
          >
            {t('verifyArchive.archiveNow')}
          </button>
        </div>
      </section>
    </div>
  );
};

export const WorkflowActionCard: React.FC<{
  action: InteractiveWorkflowAction;
  disabled: boolean;
  disabledMessage?: string;
  launching?: boolean;
  workflowLaunchConfig?: WorkflowLaunchConfigView | null;
  onRun: (action: InteractiveWorkflowAction) => void;
}> = ({
  action,
  disabled,
  disabledMessage,
  launching = false,
  workflowLaunchConfig,
  onRun,
}) => {
  const isVerify = action === 'verify';
  const title = isVerify ? t('verifyArchive.verifyTitle') : t('verifyArchive.reviewArchiveTitle');
  const runLabel = getVerifyArchiveRunLabel(action, workflowLaunchConfig, { launching });
  const hint = getVerifyArchiveHint(action, workflowLaunchConfig);

  return (
    <section style={cardStyle}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          <div style={mutedTextStyle}>{disabledMessage ?? hint}</div>
        </div>
        <button
          type="button"
          disabled={disabled}
          aria-label={`${runLabel} ${title}`}
          onClick={() => onRun(action)}
          style={{
            ...primaryButtonStyle,
            opacity: disabled ? 0.45 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {launching ? t('workflow.launching') : runLabel}
        </button>
      </div>
    </section>
  );
};
