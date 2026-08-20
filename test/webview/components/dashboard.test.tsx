import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AppProvider, appReducer, type AppState } from '../../../src/webview/context/AppContext';
import {
  Dashboard,
  createScopeSelectHandler,
  returnToCurrentProject,
  getDashboardActionScopeId,
  requestInitialDashboardData,
} from '../../../src/webview/components/Dashboard';
import { sendMessage } from '../../../src/webview/types/messages';
import type {
  DashboardData,
  OpenSpecScopeView,
  ProjectContext,
  OpenSpecRootBinding,
  ProjectSidebarData,
  ProjectWorksetNavigationData,
} from '../../../src/webview/types/messages';
import { adaptLegacyDashboardData } from '../../../src/webview/types/legacyDashboardAdapter';
import type { ChangeStatusCounts } from '../../../src/shared/changeLifecycle';

const EMPTY_COUNTS: ChangeStatusCounts = {
  all: 0,
  planning: 0,
  readyToApply: 0,
  applying: 0,
  readyToVerify: 0,
  archived: 0,
  needsAttention: 0,
};

function hostChange(
  name: string,
  overrides: Partial<DashboardData['changes'][number]> = {}
): DashboardData['changes'][number] {
  return {
    name,
    completedTasks: 0,
    totalTasks: 0,
    lastModified: '2026-06-14T00:00:00.000Z',
    status: 'draft',
    lifecycleStatus: 'planning',
    artifacts: [],
    ...overrides,
  };
}

function withHostChanges(
  base: DashboardData,
  changes: Array<Partial<DashboardData['changes'][number]> & { name: string }>
): DashboardData {
  const nextChanges = changes.map((change) => hostChange(change.name, change));
  return {
    ...base,
    changes: nextChanges,
    changeStatusCounts: {
      ...EMPTY_COUNTS,
      all: nextChanges.length + (base.archivedChanges?.length ?? 0),
      planning: nextChanges.filter((c) => c.lifecycleStatus === 'planning').length,
      readyToApply: nextChanges.filter((c) => c.lifecycleStatus === 'ready-to-apply').length,
      applying: nextChanges.filter((c) => c.lifecycleStatus === 'applying').length,
      readyToVerify: nextChanges.filter((c) => c.lifecycleStatus === 'ready-to-verify').length,
      archived: base.archivedChanges?.length ?? 0,
      needsAttention: nextChanges.filter((c) => c.attention?.required).length,
    },
  };
}

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
  archivedChanges: [],
  changeStatusCounts: EMPTY_COUNTS,
  lastRefresh: 1,
};

const projectContext: ProjectContext = {
  id: '/projects/project-a',
  label: 'Project A',
  projectPath: '/projects/project-a',
};

const projectBinding: OpenSpecRootBinding = {
  projectId: projectContext.id,
  commandCwd: projectContext.projectPath,
  rootPath: '/projects/project-a/openspec',
  rootSource: 'nearest',
};

const projectSidebarData: ProjectSidebarData = {
  project: projectContext,
  binding: projectBinding,
  changes: [hostChange('active-change', { lifecycleStatus: 'planning' })],
  lastRefresh: 2,
};

const projectWorksetNavigation: ProjectWorksetNavigationData = {
  project: projectContext,
  worksets: [{
    name: 'planning',
    members: [
      {
        name: projectContext.label,
        path: projectContext.projectPath,
        role: 'project',
        selectable: true,
        project: projectContext,
      },
      {
        name: 'other-project',
        path: '/projects/other',
        role: 'project',
        selectable: true,
        project: { id: '/projects/other', label: 'Other Project', projectPath: '/projects/other' },
      },
    ],
  }],
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

function renderProjectSidebar(data: ProjectSidebarData = projectSidebarData, state: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    <AppProvider
      initialState={{
        data: null,
        projectSidebar: data,
        projectFirst: true,
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
    getState: () => undefined,
    setState: vi.fn(),
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
          data: adaptLegacyDashboardData({
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
          }),
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

describe('project page contract', () => {
  it('returns from the Workset picker locally when Host keeps the current Project selected', () => {
    const events: string[] = [];
    const setProjectFirstView = (view: 'project') => {
      events.push(view);
    };
    const postMessage = vi.fn(() => {
      events.push('host');
    });

    returnToCurrentProject(setProjectFirstView, postMessage);

    expect(events).toEqual(['project', 'host']);
    expect(postMessage).toHaveBeenCalledWith(sendMessage.selectCurrentProject());
  });

  it('does not forward a legacy selected Store scope from Project-first actions', () => {
    expect(getDashboardActionScopeId(projectSidebarData, storeScope.id)).toBeUndefined();
    expect(getDashboardActionScopeId(undefined, storeScope.id)).toBe(storeScope.id);
  });

  it('requires a complete Project/root binding for Explorer requests', () => {
    const project: ProjectContext = {
      id: '/projects/project-a',
      label: 'same-label',
      projectPath: '/projects/project-a',
    };
    const binding: OpenSpecRootBinding = {
      projectId: project.id,
      commandCwd: project.projectPath,
      rootPath: '/planning/project-a',
      rootSource: 'nearest',
    };

    expect(sendMessage.getProjectSidebarData()).toEqual({ type: 'getProjectSidebarData' });
    expect(sendMessage.openChangesExplorer(project, binding)).toEqual({
      type: 'openChangesExplorer',
      project,
      binding,
    });
    expect(sendMessage.openSpecsExplorer(project, binding)).toEqual({
      type: 'openSpecsExplorer',
      project,
      binding,
    });
  });

  it('renders the current Project, active work, and persistent Explorer entry points', () => {
    const html = renderProjectSidebar({
      ...projectSidebarData,
      changes: [
        ...projectSidebarData.changes,
        hostChange('archive:old-change', { lifecycleStatus: 'archived' } as any),
      ] as any,
    });

    expect(html).toContain('Project A');
    expect(html).toContain('active-change');
    expect(html).toContain('All Changes');
    expect(html).toContain('Specs');
    expect(html).toContain('New Change');
    expect(html).not.toContain('archive:old-change');
    expect(html).not.toContain('Root selector');
    expect(html).not.toContain('Stores & Worksets');
  });

  it('keeps Workset picker navigation separate from the Project content scene', () => {
    const html = renderProjectSidebar({
      ...projectSidebarData,
      worksetNavigation: projectWorksetNavigation,
    });

    expect(html).toContain('Open Worksets');
    expect(html).toContain('active-change');
    expect(html).not.toContain('data-workset-project-picker');
    expect(sendMessage.selectWorksetProject('planning', '/projects/other')).toEqual({
      type: 'selectWorksetProject',
      worksetName: 'planning',
      memberPath: '/projects/other',
    });
    expect(sendMessage.selectCurrentProject()).toEqual({ type: 'selectCurrentProject' });
  });

  it('keeps All Changes and Specs available when active work is empty', () => {
    const html = renderProjectSidebar({ ...projectSidebarData, changes: [] });

    expect(html).toMatch(/No active changes/i);
    expect(html).toContain('All Changes');
    expect(html).toContain('Specs');
    expect(html).toContain('New Change');
  });

  it('keeps long Project labels bounded and cached data visibly stale', () => {
    const html = renderProjectSidebar(
      {
        ...projectSidebarData,
        project: {
          ...projectContext,
          label: 'A very long project label that must remain readable in a narrow sidebar',
        },
        cache: { source: 'memory', stale: true, generatedAt: 1 },
      },
      { stale: true },
    );

    expect(html).toContain('A very long project label that must remain readable in a narrow sidebar');
    expect(html).toContain('truncate');
    expect(html).toMatch(/cached data|refreshing/i);
  });

  it('keeps cached Project work visible under a CLI warning', () => {
    const html = renderProjectSidebar(
      {
        ...projectSidebarData,
        cache: { source: 'memory', stale: true },
      },
      {
        stale: true,
        cliDiagnostic: { diagnostic, mode: 'warning' },
      },
    );

    expect(html).toContain('active-change');
    expect(html).toContain('OpenSpec CLI unavailable');
    expect(html).toContain('stale');
    expect(html).not.toContain('Failed to load data. Try refreshing.');
  });

  it('renders a project cache diagnostic carried by the host payload', () => {
    const html = renderProjectSidebar({
      ...projectSidebarData,
      cache: { source: 'memory', stale: true },
      cliDiagnostic: diagnostic,
    });

    expect(html).toContain('OpenSpec CLI unavailable');
    expect(html).toContain('Copy Diagnostics');
  });

  it('shows a blocking CLI diagnostic before Project data exists', () => {
    const html = renderProjectSidebar(
      { ...projectSidebarData, changes: [] },
      { projectSidebar: null, cliDiagnostic: { diagnostic, mode: 'blocking' } },
    );

    expect(html).toContain('OpenSpec CLI unavailable');
    expect(html).toContain('Copy Diagnostics');
    expect(html).not.toContain('No active changes');
  });

  it('keeps Project-first default Sidebar free of legacy administration surfaces', () => {
    const html = renderProjectSidebar();

    expect(html).toContain('Project A');
    expect(html).not.toContain('OpenSpec root context');
    expect(html).not.toContain('Stores & Worksets');
    expect(html).not.toContain('Worksets');
    expect(html).not.toContain('Specs (');
    expect(html).not.toContain('Archived — read only');
  });

  it('replaces a cached Project Sidebar only with the latest bound payload', () => {
    const first = { ...projectSidebarData, cache: { source: 'memory' as const, stale: true } };
    const secondProject: ProjectContext = {
      id: '/projects/project-b',
      label: 'Project B',
      projectPath: '/projects/project-b',
    };
    const second = {
      ...projectSidebarData,
      project: secondProject,
      binding: { ...projectBinding, projectId: secondProject.id, commandCwd: secondProject.projectPath },
      changes: [hostChange('fresh-project-b-change')],
      cache: { source: 'fresh' as const, stale: false },
    };
    const initial = {
      data: null,
      projectSidebar: null,
      projectFirst: true,
      loading: true,
      error: null,
      selectedChange: null,
      debug: false,
      cliDiagnostic: null,
      activity: { kind: 'idle' },
    };

    const cached = appReducer(initial as any, { type: 'SET_PROJECT_SIDEBAR', payload: first } as any);
    const fresh = appReducer(cached, { type: 'SET_PROJECT_SIDEBAR', payload: second } as any);

    expect(cached.projectSidebar).toBe(first);
    expect(cached.stale).toBe(true);
    expect(fresh.projectSidebar).toBe(second);
    expect(fresh.projectSidebar?.project.id).toBe(secondProject.id);
    expect(fresh.projectSidebar?.changes[0].name).toBe('fresh-project-b-change');
    expect(fresh.stale).toBe(false);
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
    const cachedStoreData = withHostChanges(
      { ...dashboardData, scope: storeScope },
      [{ name: 'cached-store-change' }],
    );
    const freshStoreData = withHostChanges(
      cachedStoreData,
      [{ name: 'fresh-store-change', lastModified: '2026-06-15T00:00:00.000Z' }],
    );

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

  it('adapts legacy cached payloads missing changeStatusCounts on SET_DATA', () => {
    const legacyPayload = {
      changes: [
        {
          name: 'legacy-cached',
          completedTasks: 0,
          totalTasks: 0,
          lastModified: '2026-06-14T00:00:00.000Z',
          status: 'draft' as const,
          artifacts: [],
        },
      ],
      specs: [],
      lastRefresh: 1,
    };

    const next = appReducer(
      {
        data: null,
        loading: true,
        error: null,
        selectedChange: null,
        debug: false,
        cliDiagnostic: null,
        stale: false,
        activity: { kind: 'idle' },
      },
      {
        type: 'SET_DATA',
        // Older disk cache / fixtures omit Host lifecycle fields.
        payload: legacyPayload as unknown as AppState['data'] & object,
        cache: { source: 'disk', stale: true, generatedAt: 1 },
      }
    );

    expect(next.data?.changeStatusCounts).toEqual({
      all: 1,
      planning: 1,
      readyToApply: 0,
      applying: 0,
      readyToVerify: 0,
      archived: 0,
      needsAttention: 0,
    });
    expect(next.data?.changes[0].lifecycleStatus).toBe('planning');
    expect(next.stale).toBe(true);
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
    const cachedStoreData = withHostChanges(
      { ...dashboardData, scope: storeScope },
      [{ name: 'cached-store-change' }],
    );
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
      withHostChanges(dashboardData, [{ name: 'cached-change' }]),
      { stale: true },
    );

    expect(html).toContain('cached-change');
    expect(html).toMatch(/cached data|缓存数据/i);
  });

  it('does not duplicate stale copy while cached refresh is already shown in the rail', () => {
    const html = renderDashboardWithData(
      withHostChanges(dashboardData, [{ name: 'cached-change' }]),
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

    // No root selector dropdown is rendered for a single root, but the current
    // root label stays visible in the action rail area (before CLI status).
    expect(html).not.toContain('aria-label="OpenSpec Root"');
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
    expect(single).not.toContain('aria-label="OpenSpec Root"');
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
      changes: [hostChange('gated-change')],
      changeStatusCounts: withHostChanges(dashboardData, [{ name: 'gated-change' }]).changeStatusCounts,
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
      changes: [hostChange('still-usable-change')],
      changeStatusCounts: withHostChanges(dashboardData, [{ name: 'still-usable-change' }]).changeStatusCounts,
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

describe('Dashboard Host lifecycle contract', () => {
  it('renders Host-provided changeStatusCounts without webview lifecycle derivation', () => {
    const hostCounts: ChangeStatusCounts = {
      all: 3,
      planning: 1,
      readyToApply: 1,
      applying: 0,
      readyToVerify: 0,
      archived: 1,
      needsAttention: 1,
    };
    const data: DashboardData = {
      ...dashboardData,
      changes: [
        {
          name: 'planning-one',
          completedTasks: 0,
          totalTasks: 0,
          lastModified: '2026-06-14T00:00:00.000Z',
          status: 'draft',
          lifecycleStatus: 'planning',
          attention: { required: true, reasons: ['metadata-read-failed'] },
          artifacts: [],
        },
        {
          name: 'ready-one',
          completedTasks: 0,
          totalTasks: 3,
          lastModified: '2026-06-14T00:00:00.000Z',
          status: 'draft',
          lifecycleStatus: 'ready-to-apply',
          artifacts: [
            { id: 'proposal', outputPath: 'openspec/changes/ready-one/proposal.md', status: 'done' },
            { id: 'design', outputPath: 'openspec/changes/ready-one/design.md', status: 'done' },
            { id: 'tasks', outputPath: 'openspec/changes/ready-one/tasks.md', status: 'done' },
          ],
        },
      ],
      archivedChanges: [
        { directoryName: '2026-01-01-old', name: 'old', archiveDate: '2026-01-01' },
      ],
      changeStatusCounts: hostCounts,
    };

    const html = renderDashboardWithData(data);
    expect(html).toContain('planning-one');
    expect(html).toContain('ready-one');
    // Contract: counts are on the payload; UI does not recompute lifecycle here.
    expect(data.changeStatusCounts).toEqual(hostCounts);
    expect(data.changes.every((change) => typeof change.lifecycleStatus === 'string')).toBe(true);
  });
});
