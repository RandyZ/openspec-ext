import { t } from '../../i18n';

function parseDate(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatDateLabel(iso: string): string {
  const date = parseDate(iso);
  if (!date) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatRelativeDateLabel(iso: string): string {
  const date = parseDate(iso);
  if (!date) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return t('time.today' as any);
  if (diffDays === 1) return t('time.yesterday' as any);
  if (diffDays < 7) return t('time.daysAgo' as any, { days: diffDays });
  if (diffDays < 30) return t('time.weeksAgo' as any, { weeks: Math.floor(diffDays / 7) });
  return formatDateLabel(iso);
}
