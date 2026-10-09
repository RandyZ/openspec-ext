import * as vscode from 'vscode';
import { t } from '../../i18n';

const GLOBAL_SUPPRESS_KEY = 'openspec.suppressAgentPrefillLaunchHint';

let extensionContext: vscode.ExtensionContext | undefined;

export function configureAgentLaunchPrefillNotify(context: vscode.ExtensionContext): void {
  extensionContext = context;
}

export function resetAgentLaunchPrefillNotifyForTests(): void {
  extensionContext = undefined;
}

export async function notifyAgentPrefillLaunchHint(): Promise<void> {
  if (extensionContext?.globalState.get<boolean>(GLOBAL_SUPPRESS_KEY)) {
    return;
  }

  const openSettingsLabel = t('agentLaunch.prefillHintOpenSettings');
  const dontShowLabel = t('agentLaunch.prefillHintDontShowAgain');
  const picked = await vscode.window.showInformationMessage(
    t('agentLaunch.prefillHint'),
    openSettingsLabel,
    dontShowLabel,
  );

  if (picked === openSettingsLabel) {
    void vscode.commands.executeCommand('workbench.action.openSettings', 'openspec.agentAutoSubmit');
  } else if (picked === dontShowLabel && extensionContext) {
    await extensionContext.globalState.update(GLOBAL_SUPPRESS_KEY, true);
  }
}
