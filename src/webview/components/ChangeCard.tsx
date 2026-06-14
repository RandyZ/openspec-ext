import React from 'react';
import { ChangeInfo } from '../types/messages';
import { t } from '../../i18n';
import type { WorkflowAction } from '../../shared/workflowCommand';
import {
  getWorkflowActionButtonLabel,
  getWorkflowActionTitle,
  type WorkflowLaunchConfigView,
} from '../utils/workflowLaunchLabels';
import { formatDateLabel, formatRelativeDateLabel } from '../utils/dateLabels';

const ArtifactBadge: React.FC<{ id: string; status: 'done' | 'ready' | 'blocked' }> = ({ id, status }) => {
  const colors = {
    done: { bg: 'rgba(76, 175, 80, 0.2)', text: '#4caf50' },
    ready: { bg: 'rgba(255, 193, 7, 0.2)', text: '#ffc107' },
    blocked: { bg: 'rgba(158, 158, 158, 0.2)', text: '#9e9e9e' },
  };
  const { bg, text } = colors[status];
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: bg, color: text }}
    >
      {id}
    </span>
  );
};

function getSmartActions(change: ChangeInfo): { label: string; action: WorkflowAction }[] {
  const hasAllArtifacts = change.artifacts?.every((a) => a.status === 'done') ?? false;
  const allTasksDone = change.totalTasks > 0 && change.completedTasks === change.totalTasks;

  if (!hasAllArtifacts) {
    return [
      { label: 'Continue', action: 'continue' },
      { label: 'FF', action: 'ff' },
    ];
  }
  if (allTasksDone) {
    return [
      { label: 'Verify', action: 'verify' },
      { label: 'Archive', action: 'archive' },
    ];
  }
  return [
    { label: 'Apply', action: 'apply' },
  ];
}

export interface ChangeCardProps {
  change: ChangeInfo;
  onClick?: (changeName: string) => void;
  onCopyFf?: (changeName: string) => void;
  onCopyApply?: (changeName: string) => void;
  onArchive?: (changeName: string) => void;
  onLaunchWorkflow?: (action: WorkflowAction, changeName: string) => void;
  workflowLaunchConfig?: WorkflowLaunchConfigView | null;
}

export const ChangeCard: React.FC<ChangeCardProps> = ({
  change,
  onClick,
  onCopyFf,
  onCopyApply,
  onArchive,
  onLaunchWorkflow,
  workflowLaunchConfig,
}) => {
  const [hover, setHover] = React.useState(false);
  const [focusWithin, setFocusWithin] = React.useState(false);
  const showActions = hover || focusWithin;

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-action]')) return;
    onClick?.(change.name);
  };

  const createdLabel = change.createdAt ? formatDateLabel(change.createdAt) : '';
  const updatedLabel = change.lastModified ? formatRelativeDateLabel(change.lastModified) : '';
  const progressPercent = change.totalTasks > 0
    ? Math.round((change.completedTasks / change.totalTasks) * 100)
    : 0;

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

      {/* 2. Proposal Why summary */}
      {change.proposalWhySummary && (
        <div
          className="text-xs mb-2 leading-relaxed"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
          title={change.proposalWhyFullText || change.proposalWhySummary}
        >
          {change.proposalWhySummary}
        </div>
      )}

      {/* 3. Artifact badges */}
      {change.artifacts && change.artifacts.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {change.artifacts.map((a) => (
            <ArtifactBadge key={a.id} id={a.id} status={a.status} />
          ))}
        </div>
      )}

      {/* 4. Created / Updated row */}
      <div className="text-xs flex flex-wrap items-center gap-x-2 gap-y-1 mb-2" style={{ color: 'var(--vscode-descriptionForeground)' }}>
        {createdLabel && <span>{t('change.created', { date: createdLabel })}</span>}
        {createdLabel && updatedLabel && <span aria-hidden="true">•</span>}
        {updatedLabel && <span>{t('change.updated', { date: updatedLabel })}</span>}
      </div>

      {/* 5. Task progress block */}
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

      {/* 6. hover/focus workflow actions */}
      {showActions && (onLaunchWorkflow || onCopyFf || onCopyApply || onArchive) && (
        <div
          className="flex flex-wrap gap-1 mt-2 pt-2 border-t transition-opacity duration-150"
          style={{ borderColor: 'var(--vscode-panel-border)' }}
          data-action
        >
          {onLaunchWorkflow && getSmartActions(change).map((action) => (
            <button
              key={action.label}
              type="button"
              data-action
              className="px-2 py-0.5 text-xs rounded cursor-pointer border-none"
              title={
                action.action === 'verify' || action.action === 'archive'
                  ? action.label
                  : getWorkflowActionTitle(action.label, workflowLaunchConfig)
              }
              aria-label={
                action.action === 'verify' || action.action === 'archive'
                  ? action.label
                  : getWorkflowActionTitle(action.label, workflowLaunchConfig)
              }
              style={{
                background: 'var(--vscode-button-background)',
                color: 'var(--vscode-button-foreground)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onLaunchWorkflow(action.action, change.name);
              }}
            >
              {action.action === 'verify' || action.action === 'archive'
                ? action.label
                : getWorkflowActionButtonLabel(action.label, workflowLaunchConfig)}
            </button>
          ))}
          {onArchive && !onLaunchWorkflow && change.totalTasks > 0 && change.completedTasks === change.totalTasks && (
            <button
              type="button"
              data-action
              className="px-2 py-0.5 text-xs rounded cursor-pointer border-none"
              style={{
                background: 'var(--vscode-inputValidation-warningBackground)',
                color: 'var(--vscode-editor-foreground)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onArchive(change.name);
              }}
            >
              Archive
            </button>
          )}
        </div>
      )}
    </div>
  );
};
