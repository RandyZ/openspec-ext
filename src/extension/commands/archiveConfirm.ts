import * as vscode from 'vscode';
import { t } from '../../i18n';

/**
 * Outcome of the direct-archive confirmation dialog.
 * - `'archive'`     — user chose to proceed with direct archive.
 * - `'verifyFirst'` — user chose to jump into the interactive Verify & Archive tab.
 * - `undefined`     — user dismissed the dialog (cancel / escape).
 */
export type ArchiveConfirmChoice = 'archive' | 'verifyFirst' | undefined;

/**
 * Present the direct-archive confirmation dialog with verify-first guidance.
 *
 * Per the `workflow-control` spec scenario "Direct archive keeps Verify
 * guidance": the dialog SHOULD suggest verifying first, MUST offer an entry
 * into the interactive `Verify & Archive` tab, and MUST keep an escape path
 * to proceed with direct archive.
 *
 * `showWarningMessage` renders action buttons left-to-right in the order
 * given. We place `verifyFirst` first (the recommended path) and `archive`
 * second (the escape hatch).
 */
export async function confirmDirectArchive(changeName: string): Promise<ArchiveConfirmChoice> {
  const verifyFirst = t('command.archiveVerifyFirst');
  const archive = t('command.archive');
  const choice = await vscode.window.showWarningMessage(
    t('command.archiveConfirm', { name: changeName }),
    { modal: true, detail: t('command.archiveVerifySuggest') },
    verifyFirst,
    archive
  );
  if (choice === verifyFirst) return 'verifyFirst';
  if (choice === archive) return 'archive';
  return undefined;
}
