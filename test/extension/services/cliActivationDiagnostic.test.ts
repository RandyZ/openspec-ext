import { describe, expect, it } from 'vitest';
import {
  buildCliActivationDiagnostic,
  getRecoveryActionsForCategory,
  normalizeDiagnosticMessage,
  sanitizeDiagnosticDetails,
  type CliActivationDiagnosticCategory,
} from '@extension/services/cliActivationDiagnostic';

describe('cliActivationDiagnostic', () => {
  it.each([
    ['configured-path-invalid', ['open-settings', 'copy-diagnostics', 'open-docs']],
    ['cli-not-found', ['open-docs', 'open-settings', 'retry', 'copy-diagnostics']],
    ['permission-denied', ['open-docs', 'copy-diagnostics', 'retry']],
    ['spawn-failed', ['open-settings', 'copy-diagnostics', 'retry', 'open-docs']],
    ['shell-resolution-failed', ['open-settings', 'open-docs', 'copy-diagnostics', 'retry']],
    ['version-check-failed', ['open-docs', 'copy-diagnostics', 'retry']],
    ['unknown', ['copy-diagnostics', 'retry', 'open-docs']],
  ] as Array<[CliActivationDiagnosticCategory, string[]]>)(
    'maps %s to deterministic recovery actions',
    (category, actions) => {
      expect(getRecoveryActionsForCategory(category)).toEqual(actions);
    }
  );

  it('normalizes volatile paths while preserving stable error codes', () => {
    expect(
      normalizeDiagnosticMessage(
        'Failed to spawn openspec: spawn /Users/randy/.npm/bin/openspec.cmd ENOENT after 403ms'
      )
    ).toBe('failed to spawn openspec: spawn <path>/openspec.cmd enoent after <duration>');
  });

  it('normalizes Windows paths while preserving error codes', () => {
    expect(
      normalizeDiagnosticMessage(
        'Failed to spawn openspec: spawn C:\\Users\\Randy\\AppData\\Roaming\\npm\\openspec.cmd ENOENT'
      )
    ).toBe('failed to spawn openspec: spawn <path>/openspec.cmd enoent');
  });

  it('normalizes attempt numbers and timestamps', () => {
    expect(
      normalizeDiagnosticMessage(
        'Attempt 3/5 failed at 2024-01-15T10:30:00.000Z after 1500ms'
      )
    ).toBe('attempt <n> failed at <timestamp> after <duration>');
  });

  it('preserves EACCES and EPERM error codes', () => {
    expect(
      normalizeDiagnosticMessage(
        'Permission denied: /Users/randy/bin/openspec EACCES'
      )
    ).toBe('permission denied: <path>/openspec eacces');
  });

  it('preserves exit codes', () => {
    expect(
      normalizeDiagnosticMessage(
        'Command failed with code 127: openspec not found'
      )
    ).toBe('command failed with code 127: openspec not found');
  });

  it('truncates to 160 characters', () => {
    const longMessage = 'a'.repeat(300);
    const normalized = normalizeDiagnosticMessage(longMessage);
    expect(normalized.length).toBeLessThanOrEqual(160);
  });

  it('sanitizes user paths and sensitive environment details', () => {
    const details = sanitizeDiagnosticDetails([
      'process.env.PATH=/Users/randy/.npm/bin:/opt/homebrew/bin',
      'process.env.API_TOKEN=secret',
      'configured path: /Users/randy/bin/openspec',
      'extension host PATH: failed ENOENT',
    ]);

    expect(details.join('\n')).not.toContain('/Users/randy');
    expect(details.join('\n')).not.toContain('secret');
    expect(details).toContain('process.env.PATH=<redacted path list>');
    expect(details).toContain('configured path: <path>/openspec');
    expect(details).toContain('extension host PATH: failed ENOENT');
  });

  it('filters out details containing sensitive keywords', () => {
    const details = sanitizeDiagnosticDetails([
      'process.env.PATH=/usr/bin',
      'process.env.API_TOKEN=secret123',
      'process.env.SECRET_KEY=hidden',
      'process.env.PASSWORD=hidden',
      'process.env.MY_KEY=hidden',
      'normal detail: ok',
    ]);

    expect(details).toHaveLength(2);
    expect(details).toContain('process.env.PATH=<redacted path list>');
    expect(details).toContain('normal detail: ok');
  });

  it('sanitizes Windows paths in details', () => {
    const details = sanitizeDiagnosticDetails([
      'configured path: C:\\Users\\Randy\\bin\\openspec.cmd',
    ]);

    expect(details[0]).toBe('configured path: <path>/openspec.cmd');
  });

  it('builds copy text from safe fields only', () => {
    const diagnostic = buildCliActivationDiagnostic({
      category: 'spawn-failed',
      message: 'Failed to spawn openspec: spawn /Users/randy/bin/openspec.cmd ENOENT',
      rawDetails: [
        'process.env.PATH=/Users/randy/bin:/usr/bin',
        'process.env.SECRET_KEY=abc',
        'known path /usr/local/bin/openspec: failed ENOENT',
      ],
      platform: 'win32',
      arch: 'arm64',
      workspaceName: 'openspec-ext',
      configuredCliPath: '/Users/randy/bin/openspec.cmd',
    });

    expect(diagnostic.category).toBe('spawn-failed');
    expect(diagnostic.recoveryActions).toEqual([
      'open-settings',
      'copy-diagnostics',
      'retry',
      'open-docs',
    ]);
    expect(diagnostic.copyText).toContain('category=spawn-failed');
    expect(diagnostic.copyText).toContain('platform=win32');
    expect(diagnostic.copyText).toContain('workspace=openspec-ext');
    expect(diagnostic.copyText).toContain('configuredCliPath=<path>/openspec.cmd');
    expect(diagnostic.copyText).not.toContain('/Users/randy');
    expect(diagnostic.copyText).not.toContain('SECRET_KEY');
    expect(diagnostic.copyText).not.toContain('abc');
  });

  it('handles empty configuredCliPath in copy text', () => {
    const diagnostic = buildCliActivationDiagnostic({
      category: 'cli-not-found',
      message: 'OpenSpec CLI not found',
      rawDetails: ['extension host PATH: failed ENOENT'],
      platform: 'darwin',
      arch: 'x64',
      workspaceName: 'test-workspace',
    });

    expect(diagnostic.copyText).toContain('configuredCliPath=<empty>');
    expect(diagnostic.canRetry).toBe(true);
  });

  it('includes safe details in copy text', () => {
    const diagnostic = buildCliActivationDiagnostic({
      category: 'cli-not-found',
      message: 'OpenSpec CLI not found',
      rawDetails: [
        'process.env.PATH=/usr/bin',
        'extension host PATH: failed ENOENT',
      ],
      platform: 'darwin',
      arch: 'x64',
      workspaceName: 'test-workspace',
    });

    expect(diagnostic.copyText).toContain('detail=extension host PATH: failed ENOENT');
    expect(diagnostic.copyText).toContain('detail=process.env.PATH=<redacted path list>');
  });

  it('produces normalized message for dedupe key', () => {
    const diagnostic = buildCliActivationDiagnostic({
      category: 'configured-path-invalid',
      message: 'Configured path invalid: /Users/randy/bin/openspec',
      rawDetails: [],
      platform: 'darwin',
      arch: 'x64',
      workspaceName: 'test-workspace',
      configuredCliPath: '/Users/randy/bin/openspec',
    });

    expect(diagnostic.normalizedMessage).toBe('configured path invalid: <path>/openspec');
  });
});
