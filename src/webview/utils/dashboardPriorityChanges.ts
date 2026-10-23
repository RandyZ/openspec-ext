import type { ChangeInfo } from '../types/messages';
import {
  resolveWorkflowActions,
  type WorkflowActionReceipt,
} from '../../shared/changeWorkflow';
import type { WorkflowAction } from '../../shared/workflowCommand';
import { changeWorkflowResolutionContext } from './changeWorkflowResolutionContext';

export function getDashboardPriorityChanges(
  changes: readonly ChangeInfo[],
  receipts: readonly WorkflowActionReceipt[] = [],
): {
  needsAttention: ChangeInfo[];
  readyToVerify: ChangeInfo[];
  recommended: ChangeInfo[];
} {
  const latestReceipts = new Map<string, WorkflowActionReceipt>();
  for (const receipt of receipts) {
    latestReceipts.set(`${receipt.changeName}\u0000${receipt.bindingKey}`, receipt);
  }
  const readyToVerify: ChangeInfo[] = [];
  const needsAttention: ChangeInfo[] = [];
  const recommended: ChangeInfo[] = [];
  for (const change of changes) {
    const snapshot = change.workflowSnapshot;
    const resolved = snapshot
      ? resolveWorkflowActions(snapshot, changeWorkflowResolutionContext(change))
      : undefined;
    const receipt = snapshot
      ? latestReceipts.get(`${change.name}\u0000${snapshot.bindingKey}`)
      : undefined;
    const hasReceiptAttention = (receipt?.status === 'failed' || receipt?.status === 'fallback')
      && receipt?.suppressPriorityAttention !== true;
    const hasResolverAttention = resolved !== undefined && resolved.attentionReasons.length > 0;
    if (change.attention?.required === true || hasReceiptAttention || hasResolverAttention) {
      needsAttention.push(change);
      continue;
    }
    if (resolved?.recommended?.action === 'verify') readyToVerify.push(change);
    else if (resolved?.recommended) recommended.push(change);
  }
  return { needsAttention, readyToVerify, recommended };
}

export type DashboardPriorityGroupKey = 'needs-attention' | 'ready-to-verify' | 'recommended';

export function routeDashboardPriorityAction(
  change: ChangeInfo,
  groupKey: DashboardPriorityGroupKey,
  handlers: {
    onOpenChange: (changeName: string) => void;
    onLaunchWorkflow: (action: WorkflowAction, changeName: string, bindingKey?: string) => void;
  },
): void {
  const bindingKey = change.workflowSnapshot?.bindingKey;
  if (groupKey === 'needs-attention') {
    handlers.onOpenChange(change.name);
    return;
  }
  if (groupKey === 'ready-to-verify') {
    handlers.onLaunchWorkflow('verify', change.name, bindingKey);
    return;
  }

  const snapshot = change.workflowSnapshot;
  if (!snapshot) return;
  const recommended = resolveWorkflowActions(
    snapshot,
    changeWorkflowResolutionContext(change),
  ).recommended;
  if (!recommended) return;
  if (recommended.highImpact || recommended.action === 'archive') {
    if (recommended.action === 'verify') {
      handlers.onLaunchWorkflow('verify', change.name, bindingKey);
    } else {
      handlers.onOpenChange(change.name);
    }
    return;
  }
  handlers.onLaunchWorkflow(recommended.action, change.name, bindingKey);
}
