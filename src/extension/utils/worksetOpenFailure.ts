import { t } from '../../i18n';

export function worksetOpenErrorDetail(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  return t('command.refreshFailed');
}

export function formatWorksetOpenFailure(worksetName: string, error: unknown): string {
  return t('worksetsPage.openFailed', {
    name: worksetName,
    detail: worksetOpenErrorDetail(error),
  });
}

export function isNoSavedWorksetToolError(error: unknown): boolean {
  const detail = worksetOpenErrorDetail(error);
  return /no saved tool/i.test(detail);
}
