import type { WorkflowLaunchConfigView } from '../../shared/workflowLaunchConfig';
export type { WorkflowLaunchConfigView } from '../../shared/workflowLaunchConfig';

export function getWorkflowActionButtonLabel(
  actionLabel: string,
  config?: WorkflowLaunchConfigView | null
): string {
  if (!config || config.effectiveAdapterId == null || config.effectiveAdapterId === 'clipboard') {
    return `Copy ${actionLabel}`;
  }

  if (config.effectiveAdapterId === 'cursor') {
    switch (config.cursorLaunchMode) {
      case 'agentCli':
        return `Run Agent ${actionLabel}`;
      case 'chatCommand':
        return `Open Chat ${actionLabel}`;
      case 'clipboard':
        return `Copy ${actionLabel}`;
      case 'deeplink':
      default:
        return `Open Cursor ${actionLabel}`;
    }
  }

  return `Launch ${actionLabel}`;
}

export function getWorkflowActionTitle(
  actionLabel: string,
  config?: WorkflowLaunchConfigView | null
): string {
  if (!config || config.effectiveAdapterId == null || config.effectiveAdapterId === 'clipboard') {
    return `${actionLabel}: copy command to clipboard`;
  }

  if (config.effectiveAdapterId === 'cursor') {
    switch (config.cursorLaunchMode) {
      case 'agentCli':
        return `${actionLabel}: copy command and run Cursor Agent CLI`;
      case 'chatCommand':
        return `${actionLabel}: copy command and open Cursor Chat`;
      case 'clipboard':
        return `${actionLabel}: copy command to clipboard`;
      case 'deeplink':
      default:
        return `${actionLabel}: copy command and open Cursor prompt`;
    }
  }

  return `${actionLabel}: launch via configured adapter`;
}
