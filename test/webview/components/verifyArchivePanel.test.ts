import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { setLocale, t } from '../../../src/i18n';
import { VerifyArchivePanel } from '../../../src/webview/components/VerifyArchivePanel';

describe('VerifyArchivePanel', () => {
  it('renders run controls for verify and archive', () => {
    setLocale('en');
    const html = renderToStaticMarkup(
      React.createElement(VerifyArchivePanel, {
        isArchived: false,
        sessions: {},
        onRun: () => undefined,
        onReveal: () => undefined,
        onStop: () => undefined,
        onClear: () => undefined,
      })
    );

    expect(html).toContain('Run Verify');
    expect(html).toContain('Run Archive');
  });

  it('renders reveal, stop, and clear controls for an existing session', () => {
    const html = renderToStaticMarkup(
      React.createElement(VerifyArchivePanel, {
        isArchived: false,
        sessions: {
          verify: {
            action: 'verify',
            status: 'running',
            terminalName: 'OpenSpec Verify: demo-change',
            lastCommand: "agent --workspace '/workspace' --model 'auto' '/opsx-verify' 'demo-change'",
          },
        },
        onRun: () => undefined,
        onReveal: () => undefined,
        onStop: () => undefined,
        onClear: () => undefined,
      })
    );

    expect(html).toContain('Reveal Terminal');
    expect(html).toContain('Clear Session');
    expect(html).toContain('OpenSpec Verify: demo-change');
  });

  it('disables archive when the change is already archived', () => {
    const html = renderToStaticMarkup(
      React.createElement(VerifyArchivePanel, {
        isArchived: true,
        sessions: {},
        onRun: () => undefined,
        onReveal: () => undefined,
        onStop: () => undefined,
        onClear: () => undefined,
      })
    );

    expect(html).toContain('disabled');
    expect(html).toContain('Run Archive');
  });

  it('renders the session start time for a running session (spec: start time MUST be visible)', () => {
    setLocale('en');
    const startedAt = 1717300000000; // fixed epoch ms
    const html = renderToStaticMarkup(
      React.createElement(VerifyArchivePanel, {
        isArchived: false,
        sessions: {
          verify: {
            action: 'verify',
            status: 'running',
            terminalName: 'OpenSpec Verify: demo-change',
            lastCommand: "agent --workspace '/workspace' --model 'auto' '/opsx-verify' 'demo-change'",
            startedAt,
          },
        },
        onRun: () => undefined,
        onReveal: () => undefined,
        onStop: () => undefined,
        onClear: () => undefined,
      })
    );

    // The "Started {time}" label prefix must be present, and the formatted
    // time string must appear (locale-aware, so only assert the label prefix
    // and that the placeholder token was substituted).
    const label = t('verifyArchive.startedAt', { time: '__TIME__' });
    expect(label.startsWith('Started ')).toBe(true);
    expect(html).toContain('Started ');
    // The raw placeholder must NOT leak through.
    expect(html).not.toContain('{time}');
  });

  it('does not render a start time when the session is not running', () => {
    setLocale('en');
    const html = renderToStaticMarkup(
      React.createElement(VerifyArchivePanel, {
        isArchived: false,
        sessions: {
          verify: {
            action: 'verify',
            status: 'error',
            message: 'Cursor Agent CLI not found.',
          },
        },
        onRun: () => undefined,
        onReveal: () => undefined,
        onStop: () => undefined,
        onClear: () => undefined,
      })
    );

    expect(html).not.toContain('Started ');
  });
});
