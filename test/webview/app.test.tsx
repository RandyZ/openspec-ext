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

function context(view: ProjectPageContextMessage['view']): ProjectPageContextMessage {
  if (view === 'sidebar') return { type: 'setContext', view, data: sidebar };
  if (view === 'changesExplorer') return { type: 'setContext', view, data: changes };
  return { type: 'setContext', view, data: specs };
}

describe('project page context routing', () => {
  it('preserves all five host page discriminants', () => {
    expect(resolveAppMessageRoute(context('sidebar'))).toBe('sidebar');
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
    expect(isProjectPageContext(context('changesExplorer'))).toBe(true);
    expect(isProjectPageContext(context('specsExplorer'))).toBe(true);
  });

  it('renders the matching direct component for each stored page', () => {
    expect(renderToStaticMarkup(<App initialState={{ ...initialState, page: 'sidebar' }} />)).toContain('data-page="sidebar"');
    expect(renderToStaticMarkup(<App initialState={{ ...initialState, page: 'changesExplorer', changesExplorer: changes }} />)).toContain('data-page="changesExplorer"');
    expect(renderToStaticMarkup(<App initialState={{ ...initialState, page: 'specsExplorer', specsExplorer: specs }} />)).toContain('data-page="specsExplorer"');
    expect(renderToStaticMarkup(<App initialState={{ ...initialState, page: 'dashboard', selectedChange: 'same-name' }} />)).toContain('data-page="changeDetail"');
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
