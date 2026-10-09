import * as vscode from 'vscode';
import { t } from '../../i18n';

/** Single clipboard success toast for workflow copy paths (no duplicate wording). */
export function notifyWorkflowCommandCopied(command: string): void {
  void vscode.window.showInformationMessage(t('workflow.commandCopied', { command }));
}
