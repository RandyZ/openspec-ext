import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VerifyArchivePanel } from '../../../src/webview/components/VerifyArchivePanel';

describe('VerifyArchivePanel', () => {
  it('renders run controls for verify and archive', () => {
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
});
