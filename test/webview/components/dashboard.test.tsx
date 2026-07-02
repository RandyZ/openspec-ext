import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AppProvider, appReducer, type AppState } from '../../../src/webview/context/AppContext';
import {
  Dashboard,
  createScopeSelectHandler,
  requestInitialDashboardData,
} from '../../../src/webview/components/Dashboard';
import { sendMessage } from '../../../src/webview/types/messages';
import type { DashboardData, OpenSpecScopeView } from '../../../src/webview/types/messages';

const localScope: OpenSpecScopeView = {
  id: 'local:/workspace',
  label: 'Local Root',
  source: 'local',
  rootPath: '/workspace',
  runtimeSource: 'installed',
};

const storeScope: OpenSpecScopeView = {
  id: 'store:team-plans',
  label: 'team-plans',
  source: 'store',
  rootPath: '/stores/team-plans',
  storeId: 'team-plans',
  runtimeSource: 'localSource',
};

const dashboardData: DashboardData = {
  scope: localScope,
  scopes: [localScope, storeScope],
  changes: [],
  specs: [],
  lastRefresh: 1,
};

function renderDashboardWithData(data: DashboardData, state: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    <AppProvider
      initialState={{
        data,
        loading: false,
        error: null,
        selectedChange: null,
        debug: false,
        cliDiagnostic: null,
        activity: { kind: 'idle' },
        ...state,
      } as any}
    >
      <Dashboard />
    </AppProvider>,
  );
}

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
          activity: { kind: 'idle' },
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
          activity: { kind: 'idle' },
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
          activity: { kind: 'idle' },
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

describe('Dashboard scope switching states', () => {
  it('requests cache stats during the initial dashboard load', () => {
    const dispatch = vi.fn();
    const postMessage = vi.fn();

    requestInitialDashboardData(dispatch, postMessage);

    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_LOADING', payload: true, reason: 'initial' });
    expect(postMessage).toHaveBeenCalledWith({ type: 'getDashboardData' });
    expect(postMessage).toHaveBeenCalledWith({ type: 'getWorkflowLaunchConfig' });
    expect(postMessage).toHaveBeenCalledWith({ type: 'getCacheStats' });
  });

  it('selects a root without forcing cache stats recalculation', () => {
    const dispatch = vi.fn();
    const postMessage = vi.fn();

    createScopeSelectHandler(dispatch, postMessage)('store:team-plans');

    expect(dispatch).toHaveBeenCalledWith({
      type: 'START_SCOPE_SWITCH',
      scopeId: 'store:team-plans',
    });
    expect(postMessage).toHaveBeenCalledWith({
      type: 'selectScope',
      scopeId: 'store:team-plans',
    });
    expect(postMessage).not.toHaveBeenCalledWith({ type: 'getCacheStats', force: true });
    expect(postMessage).not.toHaveBeenCalledWith({ type: 'getCacheStats' });
  });

  it('creates typed cache stats and action messages', () => {
    expect(sendMessage.getCacheStats()).toEqual({ type: 'getCacheStats' });
    expect(sendMessage.getCacheStats(false)).toEqual({ type: 'getCacheStats' });
    expect(sendMessage.getCacheStats(true)).toEqual({ type: 'getCacheStats', force: true });
    expect(sendMessage.cacheAction('copyPath')).toEqual({ type: 'cacheAction', action: 'copyPath' });
  });

  it('changes scope switching to cached refresh when target cached data is shown, then clears on fresh data', () => {
    const pendingState: AppState = {
      data: dashboardData,
      loading: false,
      error: null,
      selectedChange: null,
      debug: false,
      cliDiagnostic: null,
      stale: false,
      activity: { kind: 'idle' },
    };
    const cachedStoreData: DashboardData = {
      ...dashboardData,
      scope: storeScope,
      changes: [
        {
          name: 'cached-store-change',
          completedTasks: 0,
          totalTasks: 0,
          lastModified: '2026-06-14T00:00:00.000Z',
          status: 'draft',
          artifacts: [],
        },
      ],
    };
    const freshStoreData: DashboardData = {
      ...cachedStoreData,
      changes: [
        {
          name: 'fresh-store-change',
          completedTasks: 0,
          totalTasks: 0,
          lastModified: '2026-06-15T00:00:00.000Z',
          status: 'draft',
          artifacts: [],
        },
      ],
    };

    const switching = appReducer(pendingState, {
      type: 'START_SCOPE_SWITCH',
      scopeId: storeScope.id,
    });
    const withStaleCache = appReducer(switching, {
      type: 'SET_DATA',
      payload: cachedStoreData,
      cache: { source: 'disk', stale: true, generatedAt: 1 },
    });

    expect(withStaleCache.data).toBe(cachedStoreData);
    expect(withStaleCache.stale).toBe(true);
    expect(withStaleCache.loading).toBe(true);
    expect(withStaleCache.loadingReason).toBe('background-refresh');
    expect(withStaleCache.pendingScopeId).toBeUndefined();
    expect(withStaleCache.activity).toEqual({ kind: 'cached-refresh', scopeId: storeScope.id });

    const withFreshData = appReducer(withStaleCache, {
      type: 'SET_DATA',
      payload: freshStoreData,
      cache: { source: 'fresh', stale: false },
    });

    expect(withFreshData.data).toBe(freshStoreData);
    expect(withFreshData.stale).toBe(false);
    expect(withFreshData.loading).toBe(false);
    expect(withFreshData.loadingReason).toBeUndefined();
    expect(withFreshData.pendingScopeId).toBeUndefined();
    expect(withFreshData.activity).toEqual({ kind: 'idle' });
  });

  it('keeps target cached data and shows a warning when the fresh refresh fails', () => {
    const pendingState: AppState = {
      data: dashboardData,
      loading: false,
      error: null,
      selectedChange: null,
      debug: false,
      cliDiagnostic: null,
      stale: false,
      activity: { kind: 'idle' },
    };
    const cachedStoreData: DashboardData = {
      ...dashboardData,
      scope: storeScope,
      changes: [
        {
          name: 'cached-store-change',
          completedTasks: 0,
          totalTasks: 0,
          lastModified: '2026-06-14T00:00:00.000Z',
          status: 'draft',
          artifacts: [],
        },
      ],
    };
    const warningMessage = 'OpenSpec refresh failed';

    const switching = appReducer(pendingState, {
      type: 'START_SCOPE_SWITCH',
      scopeId: storeScope.id,
    });
    const withStaleCache = appReducer(switching, {
      type: 'SET_DATA',
      payload: cachedStoreData,
      cache: { source: 'disk', stale: true, generatedAt: 1 },
    });
    const failed = appReducer(withStaleCache, {
      type: 'SET_ERROR',
      payload: warningMessage,
    });

    expect(failed.data).toBe(cachedStoreData);
    expect(failed.stale).toBe(true);
    expect(failed.loading).toBe(false);
    expect(failed.loadingReason).toBeUndefined();
    expect(failed.pendingScopeId).toBeUndefined();
    expect(failed.activity).toEqual({ kind: 'warning', message: warningMessage });
  });

  it('tracks manual refresh as a distinct activity without a pending scope', () => {
    const state: AppState = {
      data: dashboardData,
      loading: false,
      error: null,
      selectedChange: null,
      debug: false,
      cliDiagnostic: null,
      stale: false,
      activity: { kind: 'idle' },
    };

    const refreshing = appReducer(state, {
      type: 'SET_LOADING',
      payload: true,
      reason: 'refresh',
    });

    expect(refreshing.loading).toBe(true);
    expect(refreshing.loadingReason).toBe('refresh');
    expect(refreshing.pendingScopeId).toBeUndefined();
    expect(refreshing.activity).toEqual({ kind: 'manual-refresh' });
  });

  it('keeps previous data and shows a warning when scope switch fails before target data arrives', () => {
    const state: AppState = {
      data: dashboardData,
      loading: false,
      error: null,
      selectedChange: null,
      debug: false,
      cliDiagnostic: null,
      stale: false,
      activity: { kind: 'idle' },
    };
    const warningMessage = 'Scope switch failed';

    const switching = appReducer(state, {
      type: 'START_SCOPE_SWITCH',
      scopeId: storeScope.id,
    });
    const failed = appReducer(switching, {
      type: 'SET_ERROR',
      payload: warningMessage,
    });

    expect(failed.data).toBe(dashboardData);
    expect(failed.loading).toBe(false);
    expect(failed.loadingReason).toBeUndefined();
    expect(failed.pendingScopeId).toBeUndefined();
    expect(failed.activity).toEqual({ kind: 'warning', message: warningMessage });
  });

  it('tracks CLI diagnostics as warning activity and returns to idle when cleared', () => {
    const state: AppState = {
      data: dashboardData,
      loading: false,
      error: null,
      selectedChange: null,
      debug: false,
      cliDiagnostic: null,
      stale: false,
      activity: { kind: 'idle' },
    };

    const withDiagnostic = appReducer(state, {
      type: 'SET_CLI_DIAGNOSTIC',
      payload: { diagnostic, mode: 'warning' },
    });
    const cleared = appReducer(withDiagnostic, {
      type: 'SET_CLI_DIAGNOSTIC',
      payload: null,
    });

    expect(withDiagnostic.activity).toEqual({ kind: 'warning', message: diagnostic.message });
    expect(cleared.activity).toEqual({ kind: 'idle' });
  });

  it('enters pending state immediately when selecting another scope', async () => {
    const postMessage = vi.fn();
    const dispatch = vi.fn();
    const dashboardModule = await import('../../../src/webview/components/Dashboard') as any;

    dashboardModule.createScopeSelectHandler(dispatch, postMessage)(storeScope.id);

    expect(dispatch).toHaveBeenCalledWith({ type: 'START_SCOPE_SWITCH', scopeId: storeScope.id });
    expect(postMessage).toHaveBeenCalledWith({ type: 'selectScope', scopeId: storeScope.id });

    const html = renderDashboardWithData(dashboardData, {
      loading: true,
      loadingReason: 'scope-switch',
      pendingScopeId: storeScope.id,
    });

    expect(html).toMatch(/role="status"/);
    expect(html).toMatch(/switching|切换/i);
  });

  it('enters pending state immediately when registering or setting up a store', async () => {
    const postMessage = vi.fn();
    const dispatch = vi.fn();
    const dashboardModule = await import('../../../src/webview/components/Dashboard') as any;

    dashboardModule.createStoreRegisterHandler(dispatch, postMessage)();
    dashboardModule.createStoreSetupHandler(dispatch, postMessage)();

    expect(dispatch).toHaveBeenCalledWith({ type: 'START_LOADING', reason: 'store-register' });
    expect(postMessage).toHaveBeenCalledWith({ type: 'requestRegisterStore' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'START_LOADING', reason: 'store-setup' });
    expect(postMessage).toHaveBeenCalledWith({ type: 'requestSetupStore' });
  });

  it('renders a localized stale cached data indicator', () => {
    const html = renderDashboardWithData(
      {
        ...dashboardData,
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
      },
      { stale: true },
    );

    expect(html).toContain('cached-change');
    expect(html).toMatch(/cached data|缓存数据/i);
  });

  it('does not duplicate stale copy while cached refresh is already shown in the rail', () => {
    const html = renderDashboardWithData(
      {
        ...dashboardData,
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
      },
      {
        stale: true,
        loading: true,
        loadingReason: 'background-refresh',
        activity: { kind: 'cached-refresh', scopeId: localScope.id },
      },
    );

    expect(html).toContain('cached-change');
    expect(html.match(/Showing cached data while refreshing/g)).toHaveLength(1);
  });

  it('renders dashboard with cache-capable status rail props', () => {
    const html = renderDashboardWithData(dashboardData);

    expect(html).toContain('OpenSpec');
    expect(html).toContain('Local Root');
    expect(html).toContain('Cache actions');
  });

  it('renders stores and worksets maintenance from dashboard data', () => {
    const html = renderDashboardWithData({
      ...dashboardData,
      scope: localScope,
      scopes: [localScope, storeScope],
      relationships: {
        references: [
          {
            store_id: 'platform-reqs',
            specs: [{ id: 'billing', summary: 'Billing requirements' }],
            fetch: 'openspec show billing --type spec --store platform-reqs',
            status: [],
          },
        ],
      },
      worksets: [
        {
          name: 'platform',
          tool: 'code',
          members: [{ name: 'team-plans', path: '/stores/team-plans' }],
        },
      ],
    });

    expect(html).toContain('Stores &amp; Worksets');
    expect(html).toContain('Store: team-plans');
    expect(html).toContain('platform-reqs');
    expect(html).toContain('platform');
  });
});
