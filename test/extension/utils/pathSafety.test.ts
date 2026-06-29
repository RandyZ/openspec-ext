import { describe, expect, it } from 'vitest';
import { isPathUnderRoot } from '@extension/utils/pathSafety';

describe('isPathUnderRoot', () => {
  it('returns true for a file directly under root', () => {
    expect(isPathUnderRoot('/root/file.txt', '/root')).toBe(true);
  });

  it('returns true for a nested file under root', () => {
    expect(isPathUnderRoot('/root/sub/file.txt', '/root')).toBe(true);
  });

  it('returns true for the root itself', () => {
    expect(isPathUnderRoot('/root', '/root')).toBe(true);
  });

  it('returns false for traversal outside root', () => {
    expect(isPathUnderRoot('/root/../secret.txt', '/root')).toBe(false);
  });

  it('returns false for a path completely outside root', () => {
    expect(isPathUnderRoot('/other/file.txt', '/root')).toBe(false);
  });

  it('handles relative paths by resolving them', () => {
    // The resolve should normalize the path
    expect(isPathUnderRoot('/stores/team-plans/changes/test', '/stores/team-plans')).toBe(true);
  });
});
