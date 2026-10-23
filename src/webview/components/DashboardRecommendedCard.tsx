import React from 'react';
import type { ChangeInfo } from '../types/messages';
import { t } from '../../i18n';
import {
  getScanHierarchyStatusLabel,
  resolveRecommendedPrimaryAction,
  resolveRecommendedSecondaryAction,
  type ScanHierarchyFocus,
} from '../utils/dashboardScanHierarchy';
import {
  getWorkflowActionButtonLabel,
  type WorkflowLaunchConfigView,
} from '../utils/workflowLaunchLabels';
import { resolveChangeBindingKey } from '../utils/changeBindingKey';
import type { OpenSpecRootBinding } from '../types/messages';
import { routeDashboardPriorityAction } from '../utils/dashboardPriorityChanges';
import type { WorkflowAction } from '../../shared/workflowCommand';

export interface DashboardRecommendedCardProps {
  focus: ScanHierarchyFocus;
  workflowLaunchConfig?: WorkflowLaunchConfigView | null;
  workflowLaunchPendingKeys?: ReadonlySet<string>;
  projectBinding?: OpenSpecRootBinding | null;
  onOpenChange: (changeName: string) => void;
  onLaunchWorkflow: (action: WorkflowAction, changeName: string, bindingKey?: string) => void;
}

export const DashboardRecommendedCard: React.FC<DashboardRecommendedCardProps> = ({
  focus,
  workflowLaunchConfig,
  workflowLaunchPendingKeys,
  projectBinding,
  onOpenChange,
  onLaunchWorkflow,
}) => {
  const { change, bucket } = focus;
  const statusLabel = getScanHierarchyStatusLabel(change);
  const primary = resolveRecommendedPrimaryAction(change, bucket);
  const secondary = resolveRecommendedSecondaryAction(change, bucket, primary);
  const bindingKey = resolveChangeBindingKey(change, projectBinding);
  const pendingKey = `${change.name}\u0000${bindingKey ?? ''}`;
  const isLaunchPending = workflowLaunchPendingKeys?.has(pendingKey) === true;

  const primaryLabel = primary && 'kind' in primary
    ? t('verifyArchive.reviewArchive')
    : primary
      ? getWorkflowActionButtonLabel(primary.label, workflowLaunchConfig, {
        launching: isLaunchPending,
      })
      : null;

  const secondaryLabel = secondary
    ? getWorkflowActionButtonLabel(secondary.label, workflowLaunchConfig, {
      launching: isLaunchPending,
    })
    : null;

  const activatePrimary = () => {
    if (!primary) return;
    if ('kind' in primary) {
      onOpenChange(change.name);
      return;
    }
    routeDashboardPriorityAction(change, bucket, {
      onOpenChange,
      onLaunchWorkflow,
    });
  };

  const activateSecondary = () => {
    if (!secondary) return;
    onLaunchWorkflow(secondary.action, change.name, bindingKey);
  };

  if (!primaryLabel) return null;

  return (
    <div
      data-recommended-card
      className="mx-2 mb-2 mt-1 rounded border p-2"
      style={{ borderColor: 'var(--vscode-panel-border)' }}
      aria-label={t('dashboard.recommendedTitle')}
    >
      <div className="text-xs font-semibold mb-1">{t('dashboard.recommendedTitle')}</div>
      <div
        className="text-[11px] mb-2"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
        data-recommended-hint
      >
        {t('dashboard.recommendedHint', { name: change.name, status: statusLabel })}
      </div>
      <div
        className="flex flex-wrap gap-1.5 justify-end"
        data-recommended-actions
      >
        <button
          type="button"
          data-recommended-primary
          className="rounded px-2 py-1 text-xs focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--vscode-focusBorder)]"
          style={{
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
          }}
          onClick={activatePrimary}
        >
          {primaryLabel}
        </button>
        {secondaryLabel && (
          <button
            type="button"
            data-recommended-secondary
            className="rounded px-2 py-1 text-xs focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--vscode-focusBorder)]"
            style={{
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
            }}
            onClick={activateSecondary}
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
};
