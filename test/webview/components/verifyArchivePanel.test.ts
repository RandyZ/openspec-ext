import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { setLocale } from '../../../src/i18n';
import { VerifyArchivePanel } from '../../../src/webview/components/VerifyArchivePanel';

describe('VerifyArchivePanel', () => {
  it('renders run controls for verify and archive', () => {
    setLocale('en');
    const html = renderToStaticMarkup(
      React.createElement(VerifyArchivePanel, {
        isArchived: false,
        onRun: () => undefined,
      })
    );

    expect(html).toContain('Run Verify');
    expect(html).toContain('Run Archive');
    expect(html).toContain('Archive Now');
  });

  it('renders an accessible disabled reason when direct archive is not resolver-eligible', () => {
    setLocale('en');
    const html = renderToStaticMarkup(
      React.createElement(VerifyArchivePanel, {
        isArchived: false,
        canArchiveNow: false,
        archiveNowDisabledReason: 'Complete all required tasks before archiving directly.',
        onRun: () => undefined,
        onArchiveNow: () => undefined,
      })
    );

    expect(html).toContain('Archive Now');
    expect(html).toContain('disabled');
    expect(html).toContain('Complete all required tasks before archiving directly.');
    expect(html).toContain('aria-describedby="archive-now-disabled-reason"');
  });

  it('keeps both archive actions non-executable for archived changes', () => {
    const html = renderToStaticMarkup(
      React.createElement(VerifyArchivePanel, {
        isArchived: true,
        canArchiveNow: false,
        archiveNowDisabledReason: 'Archived changes are read-only.',
        onRun: () => undefined,
        onArchiveNow: () => undefined,
      })
    );

    expect((html.match(/disabled/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('Archived changes are read-only.');
  });

  it('disables archive when the change is already archived', () => {
    const html = renderToStaticMarkup(
      React.createElement(VerifyArchivePanel, {
        isArchived: true,
        onRun: () => undefined,
      })
    );

    expect(html).toContain('disabled');
    expect(html).toContain('Run Archive');
  });

  it('describes Agent panel launch hints instead of terminal session controls', () => {
    setLocale('en');
    const html = renderToStaticMarkup(
      React.createElement(VerifyArchivePanel, {
        isArchived: false,
        onRun: () => undefined,
      })
    );

    expect(html).toContain('/opsx-verify');
    expect(html).toContain('/opsx-archive');
    expect(html).not.toContain('Reveal Terminal');
    expect(html).not.toContain('Clear Session');
  });
});
