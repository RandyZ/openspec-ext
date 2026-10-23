import type { ChangeLifecycleStatus } from '../../shared/changeLifecycle';
import {
  resolveWorkflowActions,
  type ResolvedWorkflowAction,
  type WorkflowActionReceipt,
} from '../../shared/changeWorkflow';
import type { ChangeInfo } from '../types/messages';
import { t } from '../../i18n';
import {
  type DashboardPriorityGroupKey,
  getDashboardPriorityChanges,
} from './dashboardPriorityChanges';

export type ScanHierarchyFocus = {
  change: ChangeInfo;
  bucket: DashboardPriorityGroupKey;
};

export function selectScanHierarchyFocus(
  changes: readonly ChangeInfo[],
  receipts: readonly WorkflowActionReceipt[] = [],
): ScanHierarchyFocus | null {
  const priorities = getDashboardPriorityChanges(changes, receipts);
  if (priorities.needsAttention[0]) {
    return { change: priorities.needsAttention[0], bucket: 'needs-attention' };
  }
  if (priorities.readyToVerify[0]) {
    return { change: priorities.readyToVerify[0], bucket: 'ready-to-verify' };
  }
  if (priorities.recommended[0]) {
    return { change: priorities.recommended[0], bucket: 'recommended' };
  }
  return null;
}

/** Status vocabulary shared between scan rows and the Recommended hint line. */
export function getScanHierarchyStatusLabel(change: ChangeInfo): string {
  if (change.attention?.required === true) {
    return t('dashboard.scanStatusNeedsAttention');
  }
  const lifecycle = change.lifecycleStatus as ChangeLifecycleStatus | undefined;
  switch (lifecycle) {
    case 'ready-to-apply':
      return t('dashboard.scanStatusReadyToApply');
    case 'ready-to-verify':
      return t('dashboard.scanStatusReadyToVerify');
    case 'applying':
      return t('dashboard.scanStatusApplying');
    case 'planning':
      return t('dashboard.scanStatusInProposal');
    case 'archived':
      return t('dashboard.lifecycleArchived');
    default:
      return t('dashboard.scanStatusInProposal');
  }
}

export function resolveRecommendedPrimaryAction(
  change: ChangeInfo,
  bucket: DashboardPriorityGroupKey,
): ResolvedWorkflowAction | { kind: 'review' } | null {
  if (bucket === 'needs-attention') {
    return { kind: 'review' };
  }
  const snapshot = change.workflowSnapshot;
  if (!snapshot) return null;
  const resolved = resolveWorkflowActions(snapshot, {
    completedTasks: change.completedTasks,
    totalTasks: change.totalTasks,
    isArchived: change.lifecycleStatus === 'archived',
  });
  if (bucket === 'ready-to-verify') {
    return resolved.recommended?.action === 'verify'
      ? resolved.recommended
      : { action: 'verify', label: 'Verify', variant: 'primary' };
  }
  return resolved.recommended;
}

export function resolveRecommendedSecondaryAction(
  change: ChangeInfo,
  bucket: DashboardPriorityGroupKey,
  primary: ResolvedWorkflowAction | { kind: 'review' } | null,
): ResolvedWorkflowAction | null {
  const snapshot = change.workflowSnapshot;
  if (!snapshot) return null;
  const resolved = resolveWorkflowActions(snapshot, {
    completedTasks: change.completedTasks,
    totalTasks: change.totalTasks,
    isArchived: change.lifecycleStatus === 'archived',
  });
  const candidates = [
    ...(resolved.recommended ? [resolved.recommended] : []),
    ...resolved.available,
    ...resolved.highImpact,
  ];
  const primaryAction = primary && 'action' in primary ? primary.action : null;
  const verify = candidates.find((item) => item.action === 'verify');
  if (!verify || verify.action === primaryAction) return null;
  if (bucket === 'needs-attention' && verify) return verify;
  if (primaryAction !== 'verify' && verify) return verify;
  const apply = candidates.find((item) => item.action === 'apply');
  if (apply && apply.action !== primaryAction) return apply;
  return null;
}
