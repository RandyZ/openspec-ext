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
    'third detail should be hidden by default',
  ],
  copyText: 'category=cli-not-found',
  canRetry: true,
  normalizedMessage: 'openspec cli unavailable',
};

describe('CliActivationDiagnosticCard', () => {
  it('renders i18n title, guide line, safe details, and recovery actions without raw secrets', () => {
    const html = renderToStaticMarkup(
      <CliActivationDiagnosticCard
        diagnostic={diagnostic}
        mode="blocking"
        onAction={vi.fn()}
      />
    );

    expect(html).toContain('OpenSpec CLI not found');
    expect(html).toContain('openspec.cliPath');
    expect(html).toContain('extension host PATH: failed ENOENT');
    expect(html).not.toContain('third detail should be hidden by default');
    expect(html).not.toContain('OpenSpec CLI unavailable');
    expect(html).not.toContain('/Users/');
    expect(html).not.toContain('SECRET');
  });

  it('orders actions with Retry primary, secondary buttons, and Open Docs as a link', () => {
    const html = renderToStaticMarkup(
      <CliActivationDiagnosticCard
        diagnostic={diagnostic}
        mode="blocking"
        onAction={vi.fn()}
      />
    );

    const retryIndex = html.indexOf('Retry');
    const settingsIndex = html.indexOf('Open Settings');
    const copyIndex = html.indexOf('Copy Diagnostics');
    const docsIndex = html.indexOf('Open Docs');

    expect(retryIndex).toBeGreaterThan(-1);
    expect(settingsIndex).toBeGreaterThan(retryIndex);
    expect(copyIndex).toBeGreaterThan(settingsIndex);
    expect(docsIndex).toBeGreaterThan(copyIndex);
    expect(html).toContain('var(--vscode-button-background)');
    expect(html).toContain('var(--vscode-textLink-foreground)');
  });

  it('shows Retry loading label and disables the button while retrying', () => {
    const html = renderToStaticMarkup(
      <CliActivationDiagnosticCard
        diagnostic={diagnostic}
        mode="blocking"
        isRetrying
        onAction={vi.fn()}
      />
    );

    expect(html).toContain('Checking…');
    expect(html).not.toContain('>Retry<');
    expect(html).toContain('disabled');
  });

  it('marks warning mode as stale data', () => {
    const html = renderToStaticMarkup(
      <CliActivationDiagnosticCard
        diagnostic={diagnostic}
        mode="warning"
        onAction={vi.fn()}
      />
    );

    expect(html).toContain('cached data');
  });

  it('uses category-specific titles for configured-path-invalid', () => {
    const html = renderToStaticMarkup(
      <CliActivationDiagnosticCard
        diagnostic={{
          ...diagnostic,
          category: 'configured-path-invalid',
          message: 'Configured path invalid: /bad/path',
        }}
        mode="blocking"
        onAction={vi.fn()}
      />
    );

    expect(html).toContain('Configured CLI path is invalid');
    expect(html).not.toContain('Configured path invalid: /bad/path');
  });
});
