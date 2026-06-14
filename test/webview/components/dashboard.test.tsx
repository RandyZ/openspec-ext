import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AppProvider } from '../../../src/webview/context/AppContext';
import { Dashboard } from '../../../src/webview/components/Dashboard';

vi.mock('../../../src/webview/hooks/useVscode', () => ({
  useVscode: () => ({
    postMessage: vi.fn(),
    onMessage: vi.fn(() => vi.fn()),
  }),
}));

const diagnostic = {
  category: 'cli-not-found',
  message: 'OpenSpec CLI unavailable',
  recoveryActions: ['open-docs', 'open-settings', 'retry', 'copy-diagnostics'],
  safeDetails: ['extension host PATH: failed ENOENT'],
  copyText: 'category=cli-not-found',
  canRetry: true,
  normalizedMessage: 'openspec cli unavailable',
};

describe('Dashboard CLI diagnostic states', () => {
  it('renders a blocking diagnostic instead of the generic load failure when no data exists', () => {
    const html = renderToStaticMarkup(
      <AppProvider
        initialState={{
          data: null,
          loading: false,
          error: null,
          selectedChange: null,
          debug: false,
          cliDiagnostic: { diagnostic, mode: 'blocking' },
        }}
      >
        <Dashboard />
      </AppProvider>
    );

    expect(html).toContain('OpenSpec CLI unavailable');
    expect(html).toContain('extension host PATH: failed ENOENT');
    expect(html).toContain('Open Settings');
    expect(html).toContain('Copy Diagnostics');
    expect(html).not.toContain('Failed to load dashboard data');
    expect(html).not.toContain('No active changes');
  });

  it('renders cached dashboard data with a stale warning diagnostic', () => {
    const html = renderToStaticMarkup(
      <AppProvider
        initialState={{
          data: {
            changes: [
              {
                name: 'cached-change',
                completedTasks: 0,
                totalTasks: 0,
                lastModified: '2026-06-14T00:00:00.000Z',
                status: 'draft',
                artifacts: [],
              },
            ],
            specs: [],
            lastRefresh: 1,
          },
          loading: false,
          error: null,
          selectedChange: null,
          debug: false,
          cliDiagnostic: { diagnostic, mode: 'warning' },
        }}
      >
        <Dashboard />
      </AppProvider>
    );

    expect(html).toContain('cached-change');
    expect(html).toContain('stale');
    expect(html).toContain('OpenSpec CLI unavailable');
  });

  it('keeps workspace initialization errors separate from CLI diagnostics', () => {
    const html = renderToStaticMarkup(
      <AppProvider
        initialState={{
          data: null,
          loading: false,
          error: 'Workspace is not initialized. Run openspec init.',
          selectedChange: null,
          debug: false,
          cliDiagnostic: null,
        }}
      >
        <Dashboard />
      </AppProvider>
    );

    expect(html).toContain('openspec init');
    expect(html).not.toContain('Copy Diagnostics');
    expect(html).not.toContain('Open Settings');
  });
});
