import React from 'react';
import { ChangeInfo } from '../types/messages';
import { t } from '../../i18n';
import type { WorkflowAction } from '../../shared/workflowCommand';
import {
  resolveWorkflowActions,
  type ResolvedWorkflowAction,
} from '../../shared/changeWorkflow';
import type { ChangeLifecycleStatus } from '../../shared/changeLifecycle';
import {
  getWorkflowActionButtonLabel,
  getWorkflowActionTitle,
  type WorkflowLaunchConfigView,
} from '../utils/workflowLaunchLabels';
import { formatDateLabel, formatRelativeDateLabel } from '../utils/dateLabels';

const LIFECYCLE_BADGE_KEYS: Record<ChangeLifecycleStatus, string> = {
  planning: 'dashboard.lifecyclePlanning',
  'ready-to-apply': 'dashboard.lifecycleReadyToApply',
  applying: 'dashboard.lifecycleApplying',
  'ready-to-verify': 'dashboard.lifecycleReadyToVerify',
  archived: 'dashboard.lifecycleArchived',
};

/** Semantic token hints — text/data attributes remain the primary status signal. */
const LIFECYCLE_BADGE_STYLES: Record<ChangeLifecycleStatus, React.CSSProperties> = {
  planning: {
    background: 'var(--vscode-badge-background)',
    color: 'var(--vscode-badge-foreground)',
  },
  'ready-to-apply': {
    background: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
  },
  applying: {
    background: 'var(--vscode-progressBar-background)',
    color: 'var(--vscode-editor-foreground)',
  },
  'ready-to-verify': {
    background: 'var(--vscode-inputValidation-infoBackground)',
    color: 'var(--vscode-editor-foreground)',
  },
  archived: {
    background: 'var(--vscode-badge-background)',
    color: 'var(--vscode-badge-foreground)',
    opacity: 0.85,
  },
};

function resolveLifecycleStatus(
  change: ChangeInfo
): ChangeLifecycleStatus | null {
  const status = change.lifecycleStatus as ChangeLifecycleStatus | undefined;
  if (
    status === 'planning' ||
    status === 'ready-to-apply' ||
    status === 'applying' ||
    status === 'ready-to-verify' ||
    status === 'archived'
  ) {
    return status;
  }
  return null;
}

export interface ChangeCardProps {
  change: ChangeInfo;
  onClick?: (changeName: string) => void;
  onCopyFf?: (changeName: string) => void;
  onCopyApply?: (changeName: string) => void;
  onArchive?: (changeName: string) => void;
  onLaunchWorkflow?: (action: WorkflowAction, changeName: string, bindingKey?: string) => void;
  workflowLaunchConfig?: WorkflowLaunchConfigView | null;
}

export const ChangeCard: React.FC<ChangeCardProps> = ({
  change,
  onClick,
  onCopyFf,
  onCopyApply,
  onLaunchWorkflow,
  workflowLaunchConfig,
}) => {
  const [hover, setHover] = React.useState(false);
  const [focusWithin, setFocusWithin] = React.useState(false);
  const showActions = hover || focusWithin;

  const lifecycleStatus = resolveLifecycleStatus(change);
  const resolvedActions = change.workflowSnapshot
    ? resolveWorkflowActions(change.workflowSnapshot, {
      completedTasks: change.completedTasks,
      totalTasks: change.totalTasks,
      isArchived: lifecycleStatus === 'archived',
    })
    : undefined;
  const workflowActions: readonly ResolvedWorkflowAction[] = resolvedActions
    ? [
      ...(resolvedActions.recommended ? [resolvedActions.recommended] : []),
      ...resolvedActions.available,
      ...resolvedActions.highImpact,
    ]
    : [];
  const needsAttention = change.attention?.required === true;
  const additionalActionCount = resolvedActions
    ? resolvedActions.available.length + resolvedActions.highImpact.length
    : 0;

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-action]')) return;
    onClick?.(change.name);
  };

  const createdLabel = change.createdAt ? formatDateLabel(change.createdAt) : '';
  const updatedLabel = change.lastModified ? formatRelativeDateLabel(change.lastModified) : '';
  const progressPercent = change.totalTasks > 0
    ? Math.round((change.completedTasks / change.totalTasks) * 100)
    : 0;

  const hasActionRail =
    (onLaunchWorkflow && workflowActions.length > 0) || Boolean(onCopyFf) || Boolean(onCopyApply);

  return (
    <div
      role="button"
      tabIndex={0}
      className="p-3 rounded cursor-pointer transition-colors focus:outline-none focus:ring-1 relative"
      title={change.proposalWhyFullText || change.proposalWhySummary}
      style={{
        background: 'var(--vscode-input-background)',
        outlineColor: 'var(--vscode-focusBorder)',
      }}
      onClick={handleCardClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setFocusWithin(false);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!(e.target as HTMLElement).closest('[data-action]')) onClick?.(change.name);
        }
      }}
    >
      {/* 1. Change name */}
      <div className="font-medium text-sm mb-2">{change.name}</div>

      {/* 2. Lifecycle status badge (+ attention) */}
      {lifecycleStatus && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <span
            data-lifecycle-status={lifecycleStatus}
            className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-medium"
            style={LIFECYCLE_BADGE_STYLES[lifecycleStatus]}
          >
            {t(LIFECYCLE_BADGE_KEYS[lifecycleStatus])}
          </span>
          {needsAttention && (
            <span
              data-attention="true"
              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{
                background: 'var(--vscode-inputValidation-warningBackground)',
                color: 'var(--vscode-editor-foreground)',
              }}
              title={t('dashboard.needsAttention')}
            >
              {t('dashboard.needsAttention')}
            </span>
          )}
        </div>
      )}

      {/* 3. Proposal Why summary */}
      {change.proposalWhySummary && (
        <div
          className="text-xs mb-2 leading-relaxed"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
          title={change.proposalWhyFullText || change.proposalWhySummary}
        >
          {change.proposalWhySummary}
        </div>
      )}

      {/* 4. Shared action summary; artifact states stay in bound Detail. */}
      {resolvedActions && (
        <div
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs mb-2"
          data-workflow-summary
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          <span>{resolvedActions.recommended?.label ?? t('dashboard.noRecommendedAction')}</span>
          {additionalActionCount > 0 && <span>{t('dashboard.moreActions', { count: additionalActionCount })}</span>}
          {resolvedActions.blocked.length > 0 && <span>{t('dashboard.blockedCount', { count: resolvedActions.blocked.length })}</span>}
          {resolvedActions.skipped.length > 0 && <span>{t('dashboard.skippedCount', { count: resolvedActions.skipped.length })}</span>}
        </div>
      )}

      {/* 5. Created / Updated row */}
      <div className="text-xs flex flex-wrap items-center gap-x-2 gap-y-1 mb-2" style={{ color: 'var(--vscode-descriptionForeground)' }}>
        {createdLabel && <span>{t('change.created', { date: createdLabel })}</span>}
        {createdLabel && updatedLabel && <span aria-hidden="true">•</span>}
        {updatedLabel && <span>{t('change.updated', { date: updatedLabel })}</span>}
      </div>

      {/* 6. Task progress block */}
      {change.totalTasks > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between gap-2 text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
            <span>{change.completedTasks} / {change.totalTasks} tasks</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--vscode-input-border)' }}>
            <div
              className="h-full transition-[width] duration-150 ease-out"
              style={{
                width: `${progressPercent}%`,
                background: 'var(--vscode-progressBar-background)',
              }}
            />
          </div>
        </div>
      )}

      {/* 7. Hover/focus workflow actions. Inline display:none keeps the rail
          out of layout until focus or hover reveals the keyboard path. */}
      {hasActionRail && (
        <div
          className="flex flex-wrap gap-1 mt-2 pt-2 border-t"
          style={{
            borderColor: 'var(--vscode-panel-border)',
            display: showActions ? 'flex' : 'none',
          }}
          data-action-rail
          aria-hidden={!showActions}
        >
          {onLaunchWorkflow &&
            workflowActions.map((descriptor) => {
              const label = descriptor.label;
              const isInteractiveVerifyOrArchive =
                descriptor.action === 'verify' || descriptor.action === 'archive';
              const buttonLabel = isInteractiveVerifyOrArchive
                ? label
                : getWorkflowActionButtonLabel(label, workflowLaunchConfig);
              const title = isInteractiveVerifyOrArchive
                ? label
                : getWorkflowActionTitle(label, workflowLaunchConfig);

              return (
                <button
                  key={`${descriptor.action}:${descriptor.artifactId ?? ''}`}
                  type="button"
                  data-action
                  data-workflow-action={descriptor.action}
                  data-variant={descriptor.variant}
                  className="px-2 py-0.5 text-xs rounded cursor-pointer border-none"
                  title={title}
                  aria-label={title}
                  style={{
                    background:
                      descriptor.variant === 'primary'
                        ? 'var(--vscode-button-background)'
                        : 'var(--vscode-button-secondaryBackground)',
                    color:
                      descriptor.variant === 'primary'
                        ? 'var(--vscode-button-foreground)'
                        : 'var(--vscode-button-secondaryForeground)',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onLaunchWorkflow(descriptor.action, change.name, change.workflowSnapshot?.bindingKey);
                  }}
                >
                  {buttonLabel}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
};
