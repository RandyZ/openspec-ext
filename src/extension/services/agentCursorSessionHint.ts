import * as vscode from 'vscode';
import { t } from '../../i18n';
import type { AgentLaunchLayer } from './agentPanelLauncher';

let firstAgentPanelLaunchHintShown = false;

export function resetAgentCursorSessionHintForTests(): void {
  firstAgentPanelLaunchHintShown = false;
}

export function maybeShowFirstCursorAgentPanelLaunchHint(layer: AgentLaunchLayer): void {
  if (firstAgentPanelLaunchHintShown) return;
  if (layer !== 'composerCreateNew' && layer !== 'chatOpen') return;
  firstAgentPanelLaunchHintShown = true;
  void vscode.window.showInformationMessage(t('agentLaunch.cursorFirstPanelTabHint'));
}
