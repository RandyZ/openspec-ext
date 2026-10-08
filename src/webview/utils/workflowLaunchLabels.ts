import { t } from '../../i18n';
import type { WorkflowLaunchConfigView } from '../../shared/workflowLaunchConfig';
import { shouldUseAgentWorkflowLabels } from '../../shared/workflowLaunchConfig';
import {
  buildWorkflowCommand,
  resolveWorkflowCommandTargetForUi,
  type WorkflowAction,
} from '../../shared/workflowCommand';

const VERIFY_ARCHIVE_EXAMPLE_CHANGE = 'my-change';

export type WorkflowCommandFormatRuntime = { isCursorHost?: boolean };

export function getExampleWorkflowCommand(
  action: WorkflowAction,
  config?: WorkflowLaunchConfigView | null,
  runtime?: WorkflowCommandFormatRuntime,
): string {
  return buildWorkflowCommand({
    action,
    changeName: VERIFY_ARCHIVE_EXAMPLE_CHANGE,
    target: resolveWorkflowCommandTargetForUi(config ?? null, runtime),
  });
}

export type { WorkflowLaunchConfigView } from '../../shared/workflowLaunchConfig';

export function getWorkflowActionButtonLabel(
  actionLabel: string,
  config?: WorkflowLaunchConfigView | null,
  options?: { launching?: boolean },
): string {
  if (options?.launching) {
    return t('workflow.launching');
  }

  if (!config || !shouldUseAgentWorkflowLabels(config)) {
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
  if (!config || !shouldUseAgentWorkflowLabels(config)) {
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

export function getVerifyArchiveRunLabel(
  action: 'verify' | 'archive',
  config?: WorkflowLaunchConfigView | null,
  options?: { launching?: boolean },
): string {
  const actionLabel = action === 'verify' ? 'Verify' : 'Archive';
  return getWorkflowActionButtonLabel(actionLabel, config, options);
}

export function getVerifyArchiveDescription(
  config?: WorkflowLaunchConfigView | null,
  runtime?: WorkflowCommandFormatRuntime,
): string {
  if (!config || !shouldUseAgentWorkflowLabels(config)) {
    return t('verifyArchive.descriptionCopy');
  }
  if (config.effectiveAdapterId === 'cursor') {
    if (config.cursorLaunchMode === 'agentCli') {
      return t('verifyArchive.descriptionAgentCli');
    }
    if (config.cursorLaunchMode === 'clipboard') {
      return t('verifyArchive.descriptionCopy');
    }
    return t('verifyArchive.descriptionAgentPanel');
  }
  return t('verifyArchive.descriptionChatAdapter', {
    verifyCommand: getExampleWorkflowCommand('verify', config, runtime),
    archiveCommand: getExampleWorkflowCommand('archive', config, runtime),
  });
}

export function getVerifyArchiveHint(
  action: 'verify' | 'archive',
  config?: WorkflowLaunchConfigView | null,
  runtime?: WorkflowCommandFormatRuntime,
): string {
  const command = getExampleWorkflowCommand(action, config, runtime);
  if (!config || !shouldUseAgentWorkflowLabels(config)) {
    return action === 'verify'
      ? t('verifyArchive.verifyCopyHint', { command })
      : t('verifyArchive.archiveCopyHint', { command });
  }
  if (config.effectiveAdapterId === 'cursor') {
    if (config.cursorLaunchMode === 'agentCli') {
      return action === 'verify'
        ? t('verifyArchive.verifyAgentCliHint', { command })
        : t('verifyArchive.archiveAgentCliHint', { command });
    }
    if (config.cursorLaunchMode === 'clipboard') {
      return action === 'verify'
        ? t('verifyArchive.verifyCopyHint', { command })
        : t('verifyArchive.archiveCopyHint', { command });
    }
    if (config.cursorLaunchMode === 'chatCommand') {
      return action === 'verify'
        ? t('verifyArchive.verifyChatHint', { command })
        : t('verifyArchive.archiveChatHint', { command });
    }
    return action === 'verify'
      ? t('verifyArchive.verifyAgentHint', { command })
      : t('verifyArchive.archiveAgentHint', { command });
  }
  return action === 'verify'
    ? t('verifyArchive.verifyChatHint', { command })
    : t('verifyArchive.archiveChatHint', { command });
}

export function getWorkflowLaunchModeHint(
  config?: WorkflowLaunchConfigView | null,
): string | null {
  if (!config) return null;
  if (!shouldUseAgentWorkflowLabels(config)) {
    return t('workflow.modeHint.copyOnly');
  }
  if (config.effectiveAdapterId === 'cursor') {
    if (config.cursorLaunchMode === 'agentCli') {
      return t('workflow.modeHint.executableCursorCli');
    }
    if (config.cursorLaunchMode === 'clipboard') {
      return t('workflow.modeHint.copyOnly');
    }
    return t('workflow.modeHint.executableCursor');
  }
  return t('workflow.modeHint.executableGeneric');
}
