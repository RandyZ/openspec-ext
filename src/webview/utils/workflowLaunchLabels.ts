import { t } from '../../i18n';
import type { WorkflowLaunchConfigView } from '../../shared/workflowLaunchConfig';
import { isCopyOnlyWorkflowMode } from '../../shared/workflowLaunchConfig';

export type { WorkflowLaunchConfigView } from '../../shared/workflowLaunchConfig';

export function getWorkflowActionButtonLabel(
  actionLabel: string,
  config?: WorkflowLaunchConfigView | null,
  options?: { launching?: boolean },
): string {
  if (options?.launching) {
    return t('workflow.launching');
  }

  if (!config || isCopyOnlyWorkflowMode(config)) {
    return t('workflow.button.copy', { action: actionLabel });
  }

  if (config.effectiveAdapterId === 'cursor') {
    switch (config.cursorLaunchMode) {
      case 'agentCli':
        return t('workflow.button.runAgent', { action: actionLabel });
      case 'chatCommand':
        return t('workflow.button.openChat', { action: actionLabel });
      case 'clipboard':
        return t('workflow.button.copy', { action: actionLabel });
      case 'deeplink':
      default:
        return t('workflow.button.openCursor', { action: actionLabel });
    }
  }

  return t('workflow.button.launch', { action: actionLabel });
}

export function getWorkflowActionTitle(
  actionLabel: string,
  config?: WorkflowLaunchConfigView | null,
): string {
  if (!config || isCopyOnlyWorkflowMode(config)) {
    return t('workflow.title.copy', { action: actionLabel });
  }

  if (config.effectiveAdapterId === 'cursor') {
    switch (config.cursorLaunchMode) {
      case 'agentCli':
        return t('workflow.title.runAgent', { action: actionLabel });
      case 'chatCommand':
        return t('workflow.title.openChat', { action: actionLabel });
      case 'clipboard':
        return t('workflow.title.copy', { action: actionLabel });
      case 'deeplink':
      default:
        return t('workflow.title.openCursor', { action: actionLabel });
    }
  }

  return t('workflow.title.launch', { action: actionLabel });
}

export function getWorkflowLaunchModeHint(
  config?: WorkflowLaunchConfigView | null,
): string | null {
  if (!config) return null;
  if (isCopyOnlyWorkflowMode(config)) {
    return t('workflow.modeHint.copyOnly');
  }
  if (config.effectiveAdapterId === 'cursor') {
    return t('workflow.modeHint.executableCursor');
  }
  return t('workflow.modeHint.executableGeneric');
}
