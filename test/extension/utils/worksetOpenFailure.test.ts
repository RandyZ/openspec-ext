import { describe, expect, it } from 'vitest';
import { OpenSpecCliError } from '@extension/services/types';
import {
  cliErrorAggregate,
  formatWorksetOpenFailure,
  isNoSavedWorksetToolError,
  worksetOpenErrorDetail,
} from '@extension/utils/worksetOpenFailure';

describe('worksetOpenFailure', () => {
  const cliShapeError = new OpenSpecCliError(
    'Command failed with code 1',
    1,
    "Workset 'qa-ws2-pair' has no saved tool.\n",
  );

  it('formats failures with CLI detail in the translated template', () => {
    const message = formatWorksetOpenFailure('qa-ws2-pair', cliShapeError);
    expect(message).toContain('qa-ws2-pair');
    expect(message).toContain("Workset 'qa-ws2-pair' has no saved tool.");
    expect(message).not.toContain('Command failed with code 1');
  });

  it('aggregates stderr when message is only a generic exit code', () => {
    expect(cliErrorAggregate(cliShapeError)).toContain('has no saved tool');
    expect(worksetOpenErrorDetail(cliShapeError)).toBe("Workset 'qa-ws2-pair' has no saved tool.");
  });

  it('detects no-saved-tool CLI errors from stderr', () => {
    expect(isNoSavedWorksetToolError(cliShapeError)).toBe(true);
    expect(isNoSavedWorksetToolError(new Error('Command failed with code 1'))).toBe(false);
    expect(isNoSavedWorksetToolError(new Error("Workset 'x' has no saved tool."))).toBe(true);
  });
});
