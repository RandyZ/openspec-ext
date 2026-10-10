import { getLocale, t } from '../../i18n';

function parseDate(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date : null;
}

/** Whole calendar days from `from` (earlier) to `to` (later) in the local timezone. */
export function localCalendarDayDifference(from: Date, to: Date): number {
  const startOfDay = (value: Date) => new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  ).getTime();
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(to) - startOfDay(from)) / msPerDay);
}

export function formatDateLabel(iso: string): string {
  const date = parseDate(iso);
  if (!date) return '';
  if (getLocale() === 'zh-cn') {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatRelativeDateLabel(iso: string, now: Date = new Date()): string {
  const date = parseDate(iso);
  if (!date) return '';
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) {
    return getLocale() === 'zh-cn' ? t('time.justNow') : t('time.today');
  }
  const calendarDaysAgo = localCalendarDayDifference(date, now);
  if (calendarDaysAgo === 0) return t('time.today');
  if (calendarDaysAgo === 1) return t('time.yesterday');
  if (calendarDaysAgo < 7) return t('time.daysAgo', { days: calendarDaysAgo });
  if (calendarDaysAgo < 30) {
    return t('time.weeksAgo', { weeks: Math.floor(calendarDaysAgo / 7) });
  }
  return formatDateLabel(iso);
}
