import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CliActivationDiagnosticCard } from '../../../src/webview/components/CliActivationDiagnosticCard';

const diagnostic = {
  category: 'cli-not-found',
  message: 'OpenSpec CLI unavailable',
  recoveryActions: ['open-docs', 'open-settings', 'retry', 'copy-diagnostics'],
  safeDetails: [
    'process.env.PATH=<redacted path list>',
    'extension host PATH: failed ENOENT',
  ],
  copyText: 'category=cli-not-found',
  canRetry: true,
  normalizedMessage: 'openspec cli unavailable',
};

describe('CliActivationDiagnosticCard', () => {
  it('renders safe details and recovery actions without raw secrets', () => {
    const html = renderToStaticMarkup(
      <CliActivationDiagnosticCard
        diagnostic={diagnostic}
        mode="blocking"
        onAction={vi.fn()}
      />
    );

    expect(html).toContain('OpenSpec CLI unavailable');
    expect(html).toContain('extension host PATH: failed ENOENT');
    expect(html).toContain('Open Docs');
    expect(html).toContain('Open Settings');
    expect(html).toContain('Retry');
    expect(html).toContain('Copy Diagnostics');
    expect(html).not.toContain('/Users/');
    expect(html).not.toContain('SECRET');
  });

  it('marks warning mode as stale data', () => {
    const html = renderToStaticMarkup(
      <CliActivationDiagnosticCard
        diagnostic={diagnostic}
        mode="warning"
        onAction={vi.fn()}
      />
    );

    expect(html).toContain('stale');
  });
});
