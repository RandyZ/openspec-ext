import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CliActivationDiagnosticCard } from '../../../src/webview/components/CliActivationDiagnosticCard';

const diagnostic = {
  category: 'cli-not-found',
  message: 'OpenSpec CLI unavailable',
  recoveryActions: ['retry', 'open-settings', 'copy-diagnostics', 'open-docs'],
  safeDetails: [
    'process.env.PATH=<redacted path list>',
    'extension host PATH: failed ENOENT',
    'known path /usr/local/bin/openspec: failed ENOENT',
  ],
  copyText: 'category=cli-not-found',
  canRetry: true,
  normalizedMessage: 'openspec cli unavailable',
};

describe('CliActivationDiagnosticCard', () => {
  it('renders localized title, guidance, first two safe details, and recovery actions', () => {
    const html = renderToStaticMarkup(
      <CliActivationDiagnosticCard
        diagnostic={diagnostic}
        mode="blocking"
        onAction={vi.fn()}
      />
    );

    expect(html).toContain('OpenSpec CLI not found');
    expect(html).toContain('Install the CLI or set `openspec.cliPath`, then Retry.');
    expect(html).toContain('extension host PATH: failed ENOENT');
    expect(html).toMatch(/process\.env\.PATH=(?:<redacted path list>|&lt;redacted path list&gt;)/);
    expect(html).not.toContain('known path /usr/local/bin/openspec');
    expect(html).toContain('Open Settings');
    expect(html).toContain('Retry');
    expect(html).toContain('Copy Diagnostics');
    expect(html).toContain('Open Docs');
    expect(html).toContain('data-cli-diagnostic-action="open-docs"');
    expect(html).not.toContain('/Users/');
    expect(html).not.toContain('SECRET');
  });

  it('uses primary styling for Retry and renders Open Docs as a link-style action', () => {
    const html = renderToStaticMarkup(
      <CliActivationDiagnosticCard
        diagnostic={diagnostic}
        mode="blocking"
        onAction={vi.fn()}
      />
    );

    expect(html).toContain('var(--vscode-button-background)');
    expect(html).toContain('var(--vscode-textLink-foreground)');
    expect(html).toContain('Open Docs →');
  });

  it('shows checking label and disables Retry while retrying', () => {
    const html = renderToStaticMarkup(
      <CliActivationDiagnosticCard
        diagnostic={diagnostic}
        mode="blocking"
        isRetrying
        onAction={vi.fn()}
      />
    );

    expect(html).toContain('Checking…');
    expect(html).toContain('disabled');
    expect(html).not.toContain('>Retry<');
  });

  it('marks warning mode with stale cached data copy', () => {
    const html = renderToStaticMarkup(
      <CliActivationDiagnosticCard
        diagnostic={diagnostic}
        mode="warning"
        onAction={vi.fn()}
      />
    );

    expect(html).toContain('Showing cached data');
  });

  it('uses category-specific title for configured-path-invalid', () => {
    const html = renderToStaticMarkup(
      <CliActivationDiagnosticCard
        diagnostic={{
          ...diagnostic,
          category: 'configured-path-invalid',
          message: 'Configured OpenSpec CLI path is invalid: /tmp/bad',
        }}
        mode="blocking"
        onAction={vi.fn()}
      />
    );

    expect(html).toContain('Configured CLI path is invalid');
    expect(html).not.toContain('/tmp/bad');
  });
});
