import React from 'react';
import type {
  InteractiveWorkflowAction,
  InteractiveWorkflowSessionState,
} from '../../shared/interactiveWorkflow';
import { t } from '../../i18n';

export interface VerifyArchivePanelProps {
  isArchived: boolean;
  canArchiveNow?: boolean;
  archiveNowDisabledReason?: string;
  sessions: Partial<Record<InteractiveWorkflowAction, InteractiveWorkflowSessionState>>;
  onRun: (action: InteractiveWorkflowAction) => void;
  onReveal: (action: InteractiveWorkflowAction) => void;
  onStop: (action: InteractiveWorkflowAction) => void;
  onClear: (action: InteractiveWorkflowAction) => void;
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

/**
 * Format a session start timestamp (ms since epoch) as a locale-aware time.
 * Falls back to a raw string if the platform cannot format it.
 */
function formatStartTime(startedAt: number): string {
  try {
    return new Date(startedAt).toLocaleTimeString();
  } catch {
    return new Date(startedAt).toISOString();
  }
}

export const VerifyArchivePanel: React.FC<VerifyArchivePanelProps> = ({
  isArchived,
  canArchiveNow = false,
  archiveNowDisabledReason,
  sessions,
  onRun,
  onReveal,
  onStop,
  onClear,
  onArchiveNow,
}) => {
  const directArchiveDisabledReason = archiveNowDisabledReason
    ?? (isArchived ? t('verifyArchive.archiveDisabledArchived') : t('verifyArchive.archiveDisabledIncomplete'));

  return (
    <div className="flex flex-col gap-4">
      <div style={cardStyle}>
        <div className="text-sm font-semibold mb-2">{t('verifyArchive.title')}</div>
        <p style={mutedTextStyle}>{t('verifyArchive.description')}</p>
      </div>

      <WorkflowActionCard
        action="verify"
        session={sessions.verify}
        disabled={false}
        disabledMessage={undefined}
        onRun={onRun}
        onReveal={onReveal}
        onStop={onStop}
        onClear={onClear}
      />

      <WorkflowActionCard
        action="archive"
        session={sessions.archive}
        disabled={isArchived}
        disabledMessage={isArchived ? t('verifyArchive.archiveDisabledArchived') : undefined}
        onRun={onRun}
        onReveal={onReveal}
        onStop={onStop}
        onClear={onClear}
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
  session?: InteractiveWorkflowSessionState;
  disabled: boolean;
  disabledMessage?: string;
  onRun: (action: InteractiveWorkflowAction) => void;
  onReveal: (action: InteractiveWorkflowAction) => void;
  onStop: (action: InteractiveWorkflowAction) => void;
  onClear: (action: InteractiveWorkflowAction) => void;
}> = ({
  action,
  session,
  disabled,
  disabledMessage,
  onRun,
  onReveal,
  onStop,
  onClear,
}) => {
  const isVerify = action === 'verify';
  const title = isVerify ? t('verifyArchive.verifyTitle') : t('verifyArchive.reviewArchiveTitle');
  const runLabel = isVerify ? t('verifyArchive.runVerify') : t('verifyArchive.reviewArchive');

  const startedAtLabel =
    session?.status === 'running' && typeof session.startedAt === 'number'
      ? t('verifyArchive.startedAt', { time: formatStartTime(session.startedAt) })
      : undefined;

  return (
    <section style={cardStyle}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          <div style={mutedTextStyle}>
            {session?.status === 'running'
              ? session.terminalName ?? t('verifyArchive.running')
              : disabledMessage ?? t('verifyArchive.ready')}
          </div>
          {startedAtLabel && <div style={mutedTextStyle}>{startedAtLabel}</div>}
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
          {runLabel}
        </button>
      </div>

      {session && (
        <div className="mt-3 flex flex-col gap-3">
          {session.status === 'error' && session.message && (
            <div
              className="rounded px-3 py-2 text-xs"
              style={{
                background: 'var(--vscode-inputValidation-errorBackground)',
                color: 'var(--vscode-errorForeground)',
              }}
            >
              {session.message}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-label={`${t('verifyArchive.revealTerminal')} ${title}`}
              onClick={() => onReveal(action)}
              style={secondaryButtonStyle}
            >
              {t('verifyArchive.revealTerminal')}
            </button>
            <button
              type="button"
              aria-label={`${t('verifyArchive.stop')} ${title}`}
              onClick={() => onStop(action)}
              style={secondaryButtonStyle}
            >
              {t('verifyArchive.stop')}
            </button>
            <button
              type="button"
              aria-label={`${t('verifyArchive.clearSession')} ${title}`}
              onClick={() => onClear(action)}
              style={secondaryButtonStyle}
            >
              {t('verifyArchive.clearSession')}
            </button>
          </div>

          {session.lastCommand && (
            <code
              className="block rounded px-3 py-2 text-xs overflow-x-auto"
              style={{
                background: 'var(--vscode-textCodeBlock-background)',
                color: 'var(--vscode-textPreformat-foreground)',
              }}
            >
              {session.lastCommand}
            </code>
          )}
        </div>
      )}
    </section>
  );
};
