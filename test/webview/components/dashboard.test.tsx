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

const declaredScope: OpenSpecScopeView = {
  id: 'declared:/other-project',
  label: 'other-project',
  source: 'declared',
  rootPath: '/other-project',
  runtimeSource: 'installed',
};

// OpenSpec runtime that supports neither stores nor worksets (e.g. older than
// 1.5.0). Feature gating must surface an upgrade notice for these capabilities.
const lowCapabilitiesScope: OpenSpecScopeView = {
  ...localScope,
  capabilities: {
    stores: false,
    context: false,
    doctor: false,
    worksets: false,
    diagnostics: [],
  },
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

describe('Dashboard primary action rail owns root context', () => {
  it('renders the root selector in the primary action area near Refresh and New Change', () => {
    const html = renderDashboardWithData(dashboardData);

    // The Refresh and New Change actions exist in the header action rail.
    expect(html).toContain('OpenSpec');
    expect(html).toContain('New Change');
    // The root selector markup itself appears.
    expect(html).toContain('<select');
    expect(html).toContain('aria-label="OpenSpec Root"');
    expect(html).toContain('Local Root');
    expect(html).toContain('Store: team-plans');

    // The selector sits within the same header block as Refresh/New Change,
    // BEFORE the CLI/cache status section (marked by the Cache actions menu).
    const refreshIdx = html.indexOf('Refresh');
    const selectorIdx = html.indexOf('aria-label="OpenSpec Root"');
    const cacheIdx = html.indexOf('aria-label="Cache actions"');
    expect(refreshIdx).toBeGreaterThan(-1);
    expect(selectorIdx).toBeGreaterThan(refreshIdx);
    // The defining invariant: the selector appears before the CLI status row.
    expect(selectorIdx).toBeLessThan(cacheIdx);
  });

  it('keeps the root selector associated with primary actions, not cache status', () => {
    const html = renderDashboardWithData(dashboardData);

    // The root selector and the cache menu live in distinct containers.
    // The cache actions trigger is part of the CLI/cache status area; the
    // root selector must appear before it, grouped with Refresh/New Change.
    const refreshIdx = html.indexOf('Refresh');
    const selectorIdx = html.indexOf('aria-label="OpenSpec Root"');
    const cacheSectionIdx = html.indexOf('aria-label="Cache actions"');
    expect(selectorIdx).toBeGreaterThan(-1);
    expect(cacheSectionIdx).toBeGreaterThan(-1);
    expect(refreshIdx).toBeLessThan(selectorIdx);
    expect(selectorIdx).toBeLessThan(cacheSectionIdx);
  });

  it('groups project and store roots in the action rail selector', () => {
    const html = renderDashboardWithData({
      ...dashboardData,
      scopes: [localScope, declaredScope, storeScope],
    });

    expect(html).toContain('Projects');
    expect(html).toContain('Stores');
    expect(html).toContain('<optgroup');
    expect(html).toContain('Local Root');
    expect(html).toContain('Declared Root: other-project');
    expect(html).toContain('Store: team-plans');

    // The optgroups must render inside the header action rail (before the
    // CLI/cache status section), not inside the status bar.
    const optgroupIdx = html.indexOf('<optgroup');
    const cacheIdx = html.indexOf('aria-label="Cache actions"');
    expect(optgroupIdx).toBeLessThan(cacheIdx);
  });

  it('never surfaces workset names as root selector options in the action rail', () => {
    // Worksets live in a separate WorksetView[] and are never part of scopes.
    // This regression test ensures a workset-like label cannot leak into the
    // action-rail selector markup even if a parent component were to merge them.
    const worksetName = 'my-personal-workset';
    const html = renderDashboardWithData({
      ...dashboardData,
      scopes: [localScope, declaredScope, storeScope],
      worksets: [
        {
          name: worksetName,
          tool: 'code',
          members: [{ name: 'team-plans', path: '/stores/team-plans' }],
        },
      ],
    });

    expect(html).not.toContain(worksetName);
    expect(html).toContain('Projects');
    expect(html).toContain('Stores');
  });

  it('shows the current root label as a non-interactive label when only one root exists', () => {
    const html = renderDashboardWithData({
      ...dashboardData,
      scopes: [localScope],
    });

    // No selector dropdown is rendered for a single root, but the current
    // root label stays visible in the action rail area (before CLI status).
    expect(html).not.toContain('<select');
    expect(html).toContain('Local Root');
    expect(html).toContain('New Change');
    // The header action rail label appears before the CLI/cache status section.
    const headerLabelIdx = html.indexOf('OpenSpec Root');
    const cacheIdx = html.indexOf('aria-label="Cache actions"');
    expect(headerLabelIdx).toBeLessThan(cacheIdx);
  });

  it('preserves scope switching state in the action rail when selecting another root', () => {
    const html = renderDashboardWithData(dashboardData, {
      loading: true,
      loadingReason: 'scope-switch',
      pendingScopeId: storeScope.id,
    });

    expect(html).toMatch(/role="status"/);
    expect(html).toMatch(/switching|切换/i);
    // The selector itself disables while a switch is pending and remains in
    // the action rail (before the CLI/cache status section).
    expect(html).toContain('disabled');
    const selectorIdx = html.indexOf('aria-label="OpenSpec Root"');
    const cacheIdx = html.indexOf('aria-label="Cache actions"');
    expect(selectorIdx).toBeLessThan(cacheIdx);
  });

  it('exposes Register Store and Create Store from the primary action area', () => {
    const html = renderDashboardWithData({
      ...dashboardData,
      scope: {
        ...localScope,
        capabilities: {
          stores: true,
          context: true,
          doctor: true,
          worksets: true,
          diagnostics: [],
        },
      },
    });

    expect(html).toContain('Register Store');
    // Register Store appears in the action rail area (before the cache status).
    const registerIdx = html.indexOf('Register Store');
    const cacheIdx = html.indexOf('aria-label="Cache actions"');
    expect(registerIdx).toBeGreaterThan(-1);
    expect(cacheIdx).toBeGreaterThan(-1);
    expect(registerIdx).toBeLessThan(cacheIdx);
  });
});

describe('Dashboard Local Root lightweight mode', () => {
  it('exposes Register Store from the action rail when Local Root supports stores', () => {
    const html = renderDashboardWithData({
      ...dashboardData,
      scope: {
        ...localScope,
        capabilities: {
          stores: true,
          context: true,
          doctor: true,
          worksets: true,
          diagnostics: [],
        },
      },
      // Plain Local Root: no references, no registered stores.
      scopes: [localScope],
      relationships: { references: [] },
      worksets: [],
    });

    // Register Store is visible in the primary action area without the user
    // needing to discover a lower maintenance panel.
    expect(html).toContain('Register Store');
    const registerIdx = html.indexOf('Register Store');
    const cacheIdx = html.indexOf('aria-label="Cache actions"');
    expect(registerIdx).toBeGreaterThan(-1);
    expect(cacheIdx).toBeGreaterThan(-1);
    expect(registerIdx).toBeLessThan(cacheIdx);
  });

  it('keeps Local Root dashboard lightweight with no references or stores', () => {
    const html = renderDashboardWithData({
      ...dashboardData,
      scope: {
        ...localScope,
        capabilities: {
          stores: true,
          context: true,
          doctor: true,
          worksets: true,
          diagnostics: [],
        },
      },
      scopes: [localScope],
      relationships: { references: [] },
      worksets: [],
    });

    // Changes and Specs areas remain present (single-project dashboard shape).
    expect(html).toContain('New Change');

    // The dominant Stores & Worksets maintenance panel must NOT render for a
    // plain Local Root with nothing to maintain. At most a lightweight
    // contextual action/message is allowed.
    expect(html).not.toContain('Stores &amp; Worksets');
    // No empty-state "No stores registered." block from the heavy panel.
    expect(html).not.toContain('Read-only references');
  });

  it('does not surface store actions when Local Root lacks store capability', () => {
    const html = renderDashboardWithData({
      ...dashboardData,
      scope: {
        ...localScope,
        capabilities: {
          stores: false,
          context: false,
          doctor: false,
          worksets: false,
          diagnostics: [],
        },
      },
      scopes: [localScope],
      relationships: { references: [] },
      worksets: [],
    });

    // No store registration affordances when stores are unsupported, and no
    // dominant maintenance panel either.
    expect(html).not.toContain('Register Store');
    expect(html).not.toContain('Create Store');
    expect(html).not.toContain('Stores &amp; Worksets');
  });
});

describe('Dashboard root rail and store state regression', () => {
  it('renders the current store with a Current indicator and inactive stores with Switch', () => {
    const otherStore: OpenSpecScopeView = {
      id: 'store:shared-libs',
      label: 'shared-libs',
      source: 'store',
      rootPath: '/stores/shared-libs',
      storeId: 'shared-libs',
      runtimeSource: 'localSource',
    };
    const html = renderDashboardWithData({
      ...dashboardData,
      scope: storeScope,
      scopes: [localScope, storeScope, otherStore],
    });

    // The selected store shows Current; the other store shows Switch.
    expect(html).toContain('Current');
    expect(html).toContain('Switch');
    // No disabled Open button is rendered for the current store.
    expect(html).not.toContain('>Open<');
  });

  it('keeps the current root visible in the action rail across single and multi-root cases', () => {
    // Multi-root: selector present, current root still identifiable.
    const multi = renderDashboardWithData({
      ...dashboardData,
      scopes: [localScope, storeScope],
    });
    expect(multi).toContain('aria-label="OpenSpec Root"');
    expect(multi).toContain('Local Root');

    // Single-root: no selector, but the current root label still shows.
    const single = renderDashboardWithData({
      ...dashboardData,
      scopes: [storeScope],
      scope: storeScope,
    });
    expect(single).not.toContain('<select');
    expect(single).toContain('Store: team-plans');
  });

  it('keeps the rail selector and store actions disabled during a store action pending state', () => {
    const html = renderDashboardWithData(
      {
        ...dashboardData,
        scope: {
          ...localScope,
          capabilities: {
            stores: true,
            context: true,
            doctor: true,
            worksets: true,
            diagnostics: [],
          },
        },
        scopes: [localScope, storeScope],
      },
      {
        loading: true,
        loadingReason: 'store-register',
      },
    );

    // The rail selector and Register/Create actions reflect the pending state.
    expect(html).toContain('disabled');
    expect(html).toContain('aria-label="OpenSpec Root"');
    expect(html).toContain('Register Store');
  });

  it('keeps store maintenance panel actions wired through the dashboard handlers', () => {
    const html = renderDashboardWithData({
      ...dashboardData,
      scope: localScope,
      scopes: [localScope, storeScope],
      relationships: { references: [] },
    });

    // Inactive store exposes a Switch action; current root (Local Root) has no
    // Current badge for itself here (it is not a store card).
    expect(html).toContain('Switch');
    expect(html).toContain('Store: team-plans');
  });
});

describe('Dashboard feature gating: OpenSpec 1.5 upgrade messaging', () => {
  it('shows an OpenSpec 1.5.0 upgrade notice when stores are unsupported', () => {
    const html = renderDashboardWithData({
      ...dashboardData,
      scope: {
        ...localScope,
        capabilities: {
          stores: false,
          context: true,
          doctor: true,
          worksets: true,
          diagnostics: [],
        },
      },
      scopes: [localScope],
    });

    expect(html).toContain('Stores and worksets require OpenSpec 1.5.0 or newer');
  });

  it('shows an OpenSpec 1.5.0 upgrade notice when worksets are unsupported', () => {
    const html = renderDashboardWithData({
      ...dashboardData,
      scope: {
        ...localScope,
        capabilities: {
          stores: true,
          context: true,
          doctor: true,
          worksets: false,
          diagnostics: [],
        },
      },
      scopes: [localScope],
    });

    expect(html).toContain('Stores and worksets require OpenSpec 1.5.0 or newer');
  });

  it('shows the upgrade notice once when both stores and worksets are unsupported', () => {
    const html = renderDashboardWithData({
      ...dashboardData,
      scope: lowCapabilitiesScope,
      scopes: [localScope],
    });

    // The concise upgrade message MUST appear exactly once (not duplicated per
    // feature) and must explain the version requirement.
    expect(html).toContain('Stores and worksets require OpenSpec 1.5.0 or newer');
    expect(html.match(/Stores and worksets require OpenSpec 1\.5\.0 or newer/g)).toHaveLength(1);
  });

  it('does not show the upgrade notice when capabilities fully support stores and worksets', () => {
    const html = renderDashboardWithData({
      ...dashboardData,
      scope: {
        ...localScope,
        capabilities: {
          stores: true,
          context: true,
          doctor: true,
          worksets: true,
          diagnostics: [],
        },
      },
      scopes: [localScope, storeScope],
    });

    expect(html).not.toContain('Stores and worksets require OpenSpec 1.5.0 or newer');
  });

  it('keeps Local Root change and spec workflows usable when capabilities are unavailable', () => {
    const html = renderDashboardWithData({
      ...dashboardData,
      scope: lowCapabilitiesScope,
      scopes: [localScope],
      changes: [
        {
          name: 'gated-change',
          completedTasks: 0,
          totalTasks: 0,
          lastModified: '2026-06-14T00:00:00.000Z',
          status: 'draft',
          artifacts: [],
        },
      ],
      specs: [{ id: 'gated-spec', requirementCount: 1 }],
    });

    // Local Root changes and specs MUST remain usable even when store/workset
    // features are gated off.
    expect(html).toContain('New Change');
    expect(html).toContain('gated-change');
    expect(html).toContain('gated-spec');
    // The upgrade notice coexists with the still-usable Local Root content.
    expect(html).toContain('Stores and worksets require OpenSpec 1.5.0 or newer');
  });
});

describe('Dashboard feature gating: independent store and workset controls', () => {
  it('hides store controls when stores are unsupported but keeps workset entry', () => {
    // Stores unavailable, worksets available: store registration/setup must be
    // hidden, but the Worksets page entry should still be reachable.
    const html = renderDashboardWithData({
      ...dashboardData,
      scope: {
        ...localScope,
        capabilities: {
          stores: false,
          context: true,
          doctor: true,
          worksets: true,
          diagnostics: [],
        },
      },
      scopes: [localScope, storeScope],
      relationships: { references: [] },
      worksets: [],
    });

    // Register Store / Create Store controls MUST NOT be enabled actionable
    // controls when stores are unsupported.
    expect(html).not.toContain('Register Store');
    expect(html).not.toContain('Create Store');
    // The Worksets page navigation entry is independent and remains available.
    expect(html).toContain('Manage Worksets');
  });

  it('hides Worksets page entry when worksets are unsupported but keeps store controls', () => {
    // Stores available, worksets unavailable: store registration stays, but the
    // Worksets page entry must be hidden/disabled.
    const html = renderDashboardWithData({
      ...dashboardData,
      scope: {
        ...localScope,
        capabilities: {
          stores: true,
          context: true,
          doctor: true,
          worksets: false,
          diagnostics: [],
        },
      },
      scopes: [localScope, storeScope],
      relationships: { references: [] },
      worksets: [],
    });

    // Store controls are independent of workset gating and remain available.
    expect(html).toContain('Register Store');
    // The Worksets page navigation entry MUST NOT appear as an enabled control.
    expect(html).not.toContain('Manage Worksets');
  });

  it('hides both store and workset controls when neither is supported, but keeps Local Root content', () => {
    const html = renderDashboardWithData({
      ...dashboardData,
      scope: lowCapabilitiesScope,
      scopes: [localScope],
      changes: [
        {
          name: 'still-usable-change',
          completedTasks: 0,
          totalTasks: 0,
          lastModified: '2026-06-14T00:00:00.000Z',
          status: 'draft',
          artifacts: [],
        },
      ],
      specs: [{ id: 'still-usable-spec', requirementCount: 1 }],
    });

    // No store/workset controls as enabled actionable controls.
    expect(html).not.toContain('Register Store');
    expect(html).not.toContain('Create Store');
    expect(html).not.toContain('Manage Worksets');
    // Local Root changes and specs remain fully usable.
    expect(html).toContain('still-usable-change');
    expect(html).toContain('still-usable-spec');
    expect(html).toContain('New Change');
  });

  it('keeps store and workset controls enabled when both are fully supported', () => {
    const html = renderDashboardWithData({
      ...dashboardData,
      scope: {
        ...localScope,
        capabilities: {
          stores: true,
          context: true,
          doctor: true,
          worksets: true,
          diagnostics: [],
        },
      },
      scopes: [localScope, storeScope],
      relationships: { references: [] },
      worksets: [],
    });

    expect(html).toContain('Register Store');
    expect(html).toContain('Manage Worksets');
    // No upgrade notice when everything is supported.
    expect(html).not.toContain('Stores and worksets require OpenSpec 1.5.0 or newer');
  });

  it('treats omitted capabilities as not gated so legacy Local Root dashboards keep controls', () => {
    // No capabilities object at all (legacy runtime). Controls must remain
    // visible/permissive rather than being hidden as "unsupported".
    const html = renderDashboardWithData({
      ...dashboardData,
      scope: localScope, // no capabilities field
      scopes: [localScope, storeScope],
      relationships: { references: [] },
      worksets: [],
    });

    expect(html).toContain('Register Store');
    expect(html).toContain('Manage Worksets');
    expect(html).not.toContain('Stores and worksets require OpenSpec 1.5.0 or newer');
  });
});
