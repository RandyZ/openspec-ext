import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';
import {
  appReducer,
  type AppState,
} from '../../src/webview/context/AppContext';
import { resolveAppMessageRoute } from '../../src/webview/App';
import { App } from '../../src/webview/App';
import {
  isProjectPageContext,
  type ProjectChangesExplorerData,
  type ProjectPageContextMessage,
  type ProjectSpecsExplorerData,
  type ProjectSidebarData,
} from '../../src/webview/types/messages';

vi.mock('../../src/webview/hooks/useVscode', () => ({
  useVscode: () => ({
    postMessage: vi.fn(),
    onMessage: vi.fn(() => vi.fn()),
    getState: () => undefined,
    setState: vi.fn(),
  }),
}));
vi.mock('../../src/webview/components/Dashboard', () => ({
  Dashboard: () => React.createElement('div', { 'data-page': 'sidebar' }),
}));
vi.mock('../../src/webview/components/ChangesExplorer', () => ({
  ChangesExplorer: () => React.createElement('div', { 'data-page': 'changesExplorer' }),
}));
vi.mock('../../src/webview/components/SpecsExplorer', () => ({
  SpecsExplorer: () => React.createElement('div', { 'data-page': 'specsExplorer' }),
}));
vi.mock('../../src/webview/components/ChangeDetail', () => ({
  ChangeDetail: () => React.createElement('div', { 'data-page': 'changeDetail' }),
}));
vi.mock('../../src/webview/components/SpecViewer', () => ({
  SpecViewer: () => React.createElement('div', { 'data-page': 'specContent' }),
}));

const project = {
  id: 'project-a',
  label: 'Project A',
  projectPath: '/workspace/project-a',
} as const;

const binding = {
  projectId: project.id,
  commandCwd: project.projectPath,
  rootPath: '/workspace/project-a/openspec',
  rootSource: 'nearest',
} as const;

const sidebar: ProjectSidebarData = { project, binding, changes: [] };
const legacyDashboardData = {
  changes: [],
  specs: [],
  archivedChanges: [],
  changeStatusCounts: {
    all: 0,
    planning: 0,
    readyToApply: 0,
    applying: 0,
    readyToVerify: 0,
    archived: 0,
    needsAttention: 0,
  },
  lastRefresh: 1,
};
const changes: ProjectChangesExplorerData = {
  project,
  binding,
  changes: [],
  archivedChanges: [],
};
const specs: ProjectSpecsExplorerData = {
  project,
  binding,
  projectSpecs: [],
  referencedStoreSpecs: [],
};

const initialState = {
  data: null,
  projectSidebar: null,
  projectFirst: true,
  loading: false,
  activity: { kind: 'idle' },
  stale: false,
  error: null,
  selectedChange: null,
  debug: false,
  cliDiagnostic: null,
} as AppState;

function context(view: ProjectPageContextMessage['view'] | 'dashboard'): ProjectPageContextMessage {
  if (view === 'sidebar') return { type: 'setContext', view, data: sidebar };
  if (view === 'changesExplorer') return { type: 'setContext', view, data: changes };
  if (view === 'dashboard') {
    return { type: 'setContext', view, data: sidebar } as ProjectPageContextMessage;
  }
  return { type: 'setContext', view, data: specs };
}

describe('project page context routing', () => {
  it('preserves all host page discriminants including Project Dashboard', () => {
    expect(resolveAppMessageRoute(context('sidebar'))).toBe('sidebar');
    expect(resolveAppMessageRoute(context('dashboard'))).toBe('dashboard');
    expect(resolveAppMessageRoute(context('changesExplorer'))).toBe('changesExplorer');
    expect(resolveAppMessageRoute(context('specsExplorer'))).toBe('specsExplorer');
    expect(resolveAppMessageRoute({
      type: 'setContext',
      view: 'changeDetail',
      changeName: 'same-name',
    })).toBe('changeDetail');
    expect(resolveAppMessageRoute({
      type: 'specContent',
      specId: 'project-spec',
      content: '# Spec',
    })).toBe('specContent');
  });

  it('accepts each of the three bound project page contexts', () => {
    expect(isProjectPageContext(context('sidebar'))).toBe(true);
    expect(isProjectPageContext(context('dashboard'))).toBe(true);
    expect(isProjectPageContext(context('changesExplorer'))).toBe(true);
    expect(isProjectPageContext(context('specsExplorer'))).toBe(true);
  });

  it('renders the matching direct component for each stored page', () => {
    expect(renderToStaticMarkup(<App initialState={{ ...initialState, page: 'sidebar' }} />)).toContain('data-page="sidebar"');
    expect(renderToStaticMarkup(<App initialState={{ ...initialState, page: 'changesExplorer', changesExplorer: changes }} />)).toContain('data-page="changesExplorer"');
    expect(renderToStaticMarkup(<App initialState={{ ...initialState, page: 'specsExplorer', specsExplorer: specs }} />)).toContain('data-page="specsExplorer"');
    expect(renderToStaticMarkup(<App initialState={{ ...initialState, page: 'dashboard', selectedChange: 'same-name' }} />)).toContain('data-page="changeDetail"');
  });

  it('renders Project Dashboard as a distinct surface from the Sidebar route', () => {
    const html = renderToStaticMarkup(
      <App initialState={{
        ...initialState,
        page: 'dashboard',
        projectSidebar: sidebar,
        selectedChange: null,
      }} />
    );

    expect(html).toContain('data-page="projectDashboard"');
    expect(html).not.toContain('data-page="sidebar"');
  });

  it('keeps legacy SET_DATA payloads on the original Dashboard route', () => {
    const state = appReducer(initialState, {
      type: 'SET_DATA',
      payload: legacyDashboardData,
    });

    expect(state.page).toBe('dashboard');
    expect(state.projectSidebar).toBeNull();
    expect(renderToStaticMarkup(<App initialState={state} />)).toContain('data-page="sidebar"');
  });

  it('keeps Project Dashboard routing distinct from local Sidebar views', () => {
    const sidebarState = appReducer(initialState, {
      type: 'SET_PAGE_CONTEXT',
      payload: context('sidebar'),
    });
    const dashboardState = appReducer(sidebarState, {
      type: 'SET_PAGE_CONTEXT',
      payload: context('dashboard'),
    });

    expect(sidebarState.page).toBe('sidebar');
    expect(dashboardState.page).toBe('dashboard');
    expect(dashboardState.projectSidebar).toBe(sidebar);
    expect(resolveAppMessageRoute({ type: 'openProjectDashboard' })).toBe('unknown');
  });

  it('rejects malformed and project/binding-mismatched contexts', () => {
    expect(resolveAppMessageRoute(null)).toBe('unknown');
    expect(isProjectPageContext({ type: 'setContext', view: 'unknown' })).toBe(false);
    expect(resolveAppMessageRoute({ type: 'setContext', view: 'changesExplorer', data: {} })).toBe('unknown');
    expect(
      isProjectPageContext({
        type: 'setContext',
        view: 'sidebar',
        data: { ...sidebar, binding: { ...binding, projectId: 'other-project' } },
      })
    ).toBe(false);
  });

  it('stores one page payload and clears incompatible page data on transition', () => {
    const sidebarState = appReducer(initialState, {
      type: 'SET_PAGE_CONTEXT',
      payload: context('sidebar'),
    });
    expect(sidebarState.page).toBe('sidebar');
    expect(sidebarState.projectSidebar).toBe(sidebar);

    const changesState = appReducer(sidebarState, {
      type: 'SET_PAGE_CONTEXT',
      payload: context('changesExplorer'),
    });
    expect(changesState.page).toBe('changesExplorer');
    expect(changesState.changesExplorer).toBe(changes);
    expect(changesState.projectSidebar).toBeNull();
    expect(changesState.specsExplorer).toBeNull();
  });

  it('keeps Project and referenced Store Specs grouped in the Sidebar payload', () => {
    const unified = {
      ...sidebar,
      projectSpecs: [{ id: 'shared-spec', requirementCount: 1 }],
      referencedStoreSpecs: [{
        storeId: 'aihelp-workspace',
        binding: { ...binding, rootSource: 'store', storeId: 'aihelp-workspace' },
        specs: [{ id: 'shared-spec', requirementCount: 2 }],
      }],
    };
    const state = appReducer(initialState, {
      type: 'SET_PAGE_CONTEXT',
      payload: { type: 'setContext', view: 'sidebar', data: unified },
    });

    expect(state.projectSidebar?.projectSpecs).toEqual([
      { id: 'shared-spec', requirementCount: 1 },
    ]);
    expect(state.projectSidebar?.referencedStoreSpecs[0]).toMatchObject({
      storeId: 'aihelp-workspace',
      binding: { storeId: 'aihelp-workspace' },
    });
  });

  it('is idempotent for a repeated identical context and clears stale data on invalid input', () => {
    const first = appReducer(initialState, {
      type: 'SET_PAGE_CONTEXT',
      payload: context('specsExplorer'),
    });
    const repeated = appReducer(first, {
      type: 'SET_PAGE_CONTEXT',
      payload: context('specsExplorer'),
    });
    expect(repeated.page).toBe('specsExplorer');
    expect(repeated.specsExplorer).toBe(specs);

    const cleared = appReducer(repeated, { type: 'CLEAR_PAGE_CONTEXT' });
    expect(cleared.page).toBe('loading');
    expect(cleared.specsExplorer).toBeNull();
    expect(cleared.projectSidebar).toBeNull();
  });
});
