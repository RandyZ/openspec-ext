import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../../src/i18n';
import {
  formatDateLabel,
  formatRelativeDateLabel,
  localCalendarDayDifference,
} from '../../../src/webview/utils/dateLabels';

describe('dateLabels', () => {
  afterEach(() => {
    setLocale('en');
    vi.useRealTimers();
  });

  it('formats absolute date labels for created metadata in English', () => {
    setLocale('en');
    expect(formatDateLabel('2026-06-10T02:00:00.000Z')).toMatch(/2026|Jun|6|10/);
  });

  it('formats absolute date labels as Chinese calendar text when locale is zh-cn', () => {
    setLocale('zh-cn');
    expect(formatDateLabel('2026-08-31T12:00:00.000Z')).toBe('2026年8月31日');
  });

  it('uses local calendar days for today and yesterday in English', () => {
    setLocale('en');
    const now = new Date(2026, 5, 10, 8, 0, 0);
    const earlierToday = new Date(2026, 5, 10, 1, 0, 0);
    const lastNight = new Date(2026, 5, 9, 23, 30, 0);

    expect(formatRelativeDateLabel(earlierToday.toISOString(), now)).toBe('Today');
    expect(formatRelativeDateLabel(lastNight.toISOString(), now)).toBe('Yesterday');
  });

  it('uses local calendar days for today and yesterday in Chinese', () => {
    setLocale('zh-cn');
    const now = new Date(2026, 5, 10, 8, 0, 0);
    const lastNight = new Date(2026, 5, 9, 22, 0, 0);

    expect(formatRelativeDateLabel(lastNight.toISOString(), now)).toBe('昨天');
    expect(formatRelativeDateLabel(now.toISOString(), now)).toBe('今天');
  });

  it('falls back to Chinese absolute dates for updates older than 30 local days', () => {
    setLocale('zh-cn');
    const now = new Date(2026, 8, 30, 12, 0, 0);
    const older = new Date(2026, 7, 31, 12, 0, 0);

    expect(formatRelativeDateLabel(older.toISOString(), now)).toBe('2026年8月31日');
  });

  it('keeps English month abbreviations for updates older than 30 local days', () => {
    setLocale('en');
    const now = new Date(2026, 8, 30, 12, 0, 0);
    const older = new Date(2026, 7, 31, 12, 0, 0);

    expect(formatRelativeDateLabel(older.toISOString(), now)).toMatch(/Aug|8|31|2026/);
  });

  it('clamps future timestamps from clock skew instead of showing negative offsets', () => {
    setLocale('en');
    const now = new Date(2026, 5, 10, 12, 0, 0);
    const future = new Date(2026, 5, 11, 0, 0, 0);
    expect(formatRelativeDateLabel(future.toISOString(), now)).toBe('Just now');

    setLocale('zh-cn');
    expect(formatRelativeDateLabel(future.toISOString(), now)).toBe('刚刚');
  });

  it('computes local calendar day differences across midnight', () => {
    const morning = new Date(2026, 5, 10, 8, 0, 0);
    const lastNight = new Date(2026, 5, 9, 23, 0, 0);
    expect(localCalendarDayDifference(lastNight, morning)).toBe(1);
    expect(localCalendarDayDifference(morning, morning)).toBe(0);
  });

  it('returns an empty string for invalid values', () => {
    expect(formatDateLabel('not-a-date')).toBe('');
    expect(formatRelativeDateLabel('not-a-date')).toBe('');
  });
});
