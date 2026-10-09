import { t } from '../../i18n';
import type { WorkflowLaunchConfigView } from '../../shared/workflowLaunchConfig';
import { shouldUseAgentWorkflowLabels } from '../../shared/workflowLaunchConfig';
import {
  buildWorkflowCommand,
  resolveWorkflowCommandTargetForUi,
  type WorkflowAction,
} from '../../shared/workflowCommand';

export const NEUTRAL_CHANGE_PLACEHOLDER = '<change-name>';

const ENGLISH_ACTION_LABEL_KEYS: Record<string, Parameters<typeof t>[0]> = {
  Verify: 'workflow.action.verify',
  Archive: 'workflow.action.archive',
  Apply: 'workflow.action.apply',
  Explore: 'workflow.action.explore',
  Propose: 'workflow.action.propose',
  Continue: 'workflow.action.continue',
  'Continue planning': 'workflow.action.continuePlanning',
  FF: 'workflow.action.ff',
  'Sync Specs': 'workflow.action.syncSpecs',
};

export type WorkflowCommandFormatRuntime = { isCursorHost?: boolean };

export function localizeWorkflowActionDisplayLabel(englishLabel: string): string {
  const key = ENGLISH_ACTION_LABEL_KEYS[englishLabel];
  return key ? t(key) : englishLabel;
}

export function getExampleWorkflowCommand(
  action: WorkflowAction,
  config?: WorkflowLaunchConfigView | null,
  runtime?: WorkflowCommandFormatRuntime,
  changeName?: string,
): string {
  const resolvedName = changeName?.trim() || NEUTRAL_CHANGE_PLACEHOLDER;
  return buildWorkflowCommand({
    action,
    changeName: resolvedName,
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

  const displayAction = localizeWorkflowActionDisplayLabel(actionLabel);

  if (!config || !shouldUseAgentWorkflowLabels(config)) {
    return t('workflow.button.copy', { action: displayAction });
  }

  if (config.effectiveAdapterId === 'cursor') {
    switch (config.cursorLaunchMode) {
      case 'agentCli':
        return t('workflow.button.runAgent', { action: displayAction });
      case 'chatCommand':
        return t('workflow.button.openChat', { action: displayAction });
      case 'clipboard':
        return t('workflow.button.copy', { action: displayAction });
      case 'deeplink':
      default:
        return t('workflow.button.openAgentPanel', { action: displayAction });
    }
  }

  return t('workflow.button.launch', { action: displayAction });
}

export function getWorkflowActionTitle(
  actionLabel: string,
  config?: WorkflowLaunchConfigView | null,
): string {
  const displayAction = localizeWorkflowActionDisplayLabel(actionLabel);

  if (!config || !shouldUseAgentWorkflowLabels(config)) {
    return t('workflow.title.copy', { action: displayAction });
  }

  if (config.effectiveAdapterId === 'cursor') {
    switch (config.cursorLaunchMode) {
      case 'agentCli':
        return t('workflow.title.runAgent', { action: displayAction });
      case 'chatCommand':
        return t('workflow.title.openChat', { action: displayAction });
      case 'clipboard':
        return t('workflow.title.copy', { action: displayAction });
      case 'deeplink':
      default:
        return t('workflow.title.openAgentPanel', { action: displayAction });
    }
  }

  return t('workflow.title.launch', { action: displayAction });
}

export function getVerifyArchiveRunLabel(
  action: 'verify' | 'archive',
  config?: WorkflowLaunchConfigView | null,
  options?: { launching?: boolean },
): string {
  const actionLabel = action === 'verify' ? 'Verify' : 'Archive';
  return getWorkflowActionButtonLabel(actionLabel, config, options);
}

function verifyArchiveDescriptionCopy(
  config: WorkflowLaunchConfigView | null | undefined,
  runtime?: WorkflowCommandFormatRuntime,
  changeName?: string,
): string {
  return t('verifyArchive.descriptionCopy', {
    verifyCommand: getExampleWorkflowCommand('verify', config, runtime, changeName),
    archiveCommand: getExampleWorkflowCommand('archive', config, runtime, changeName),
  });
}

export function getVerifyArchiveDescription(
  config?: WorkflowLaunchConfigView | null,
  runtime?: WorkflowCommandFormatRuntime,
  changeName?: string,
): string {
  if (!config || !shouldUseAgentWorkflowLabels(config)) {
    return verifyArchiveDescriptionCopy(config, runtime, changeName);
  }
  if (config.effectiveAdapterId === 'cursor') {
    if (config.cursorLaunchMode === 'agentCli') {
      return t('verifyArchive.descriptionAgentCli');
    }
    if (config.cursorLaunchMode === 'clipboard') {
      return verifyArchiveDescriptionCopy(config, runtime, changeName);
    }
    return t('verifyArchive.descriptionAgentPanel');
  }
  return t('verifyArchive.descriptionChatAdapter', {
    verifyCommand: getExampleWorkflowCommand('verify', config, runtime, changeName),
    archiveCommand: getExampleWorkflowCommand('archive', config, runtime, changeName),
  });
}

export function getVerifyArchiveHint(
  action: 'verify' | 'archive',
  config?: WorkflowLaunchConfigView | null,
  runtime?: WorkflowCommandFormatRuntime,
  changeName?: string,
): string {
  const command = getExampleWorkflowCommand(action, config, runtime, changeName);
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
      return t('workflow.modeHint.executableAgentCli');
    }
    if (config.cursorLaunchMode === 'clipboard') {
      return t('workflow.modeHint.copyOnly');
    }
    return t('workflow.modeHint.executableCursor');
  }
  return t('workflow.modeHint.executableGeneric');
}
