import { t } from '../../i18n';
import { OpenSpecCliError } from '../services/types';

/** stderr + message for matching CLI semantics (e.g. retry gates). */
export function cliErrorAggregate(error: unknown): string {
  if (error instanceof OpenSpecCliError) {
    return [error.stderr, error.message].filter((part) => part?.trim()).join('\n').trim();
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  return '';
}

/** User-facing detail: prefer stderr over generic exit-code messages. */
export function worksetOpenErrorDetail(error: unknown): string {
  if (error instanceof OpenSpecCliError) {
    const stderr = error.stderr?.trim();
    const message = error.message.trim();
    if (stderr) {
      return stderr;
    }
    if (message) {
      return message;
    }
  }
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
  return /no saved tool/i.test(cliErrorAggregate(error));
}
