import { describe, expect, it } from 'vitest';
import {
  formatWorksetOpenFailure,
  isNoSavedWorksetToolError,
} from '@extension/utils/worksetOpenFailure';

describe('worksetOpenFailure', () => {
  it('formats failures with CLI detail in the translated template', () => {
    const message = formatWorksetOpenFailure(
      'qa-ws2-pair',
      new Error("Workset 'qa-ws2-pair' has no saved tool."),
    );
    expect(message).toContain('qa-ws2-pair');
    expect(message).toContain("Workset 'qa-ws2-pair' has no saved tool.");
  });

  it('detects no-saved-tool CLI errors', () => {
    expect(isNoSavedWorksetToolError(new Error("Workset 'x' has no saved tool."))).toBe(true);
    expect(isNoSavedWorksetToolError(new Error('workset open failed'))).toBe(false);
  });
});
