import { describe, expect, it, vi } from 'vitest';
import { formatDateLabel, formatRelativeDateLabel } from '../../../src/webview/utils/dateLabels';

describe('dateLabels', () => {
  it('formats absolute date labels for created metadata', () => {
    expect(formatDateLabel('2026-06-10T02:00:00.000Z')).toMatch(/2026|6|06|10/);
  });

  it('formats relative labels for updated metadata', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T12:00:00.000Z'));
    expect(formatRelativeDateLabel('2026-06-10T02:00:00.000Z')).toBe('Today');
    expect(formatRelativeDateLabel('2026-06-09T02:00:00.000Z')).toBe('Yesterday');
    vi.useRealTimers();
  });

  it('returns an empty string for invalid values', () => {
    expect(formatDateLabel('not-a-date')).toBe('');
    expect(formatRelativeDateLabel('not-a-date')).toBe('');
  });
});
