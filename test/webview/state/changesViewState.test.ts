import { describe, expect, it } from 'vitest';
import type { OpenSpecScopeView } from '../../../src/webview/types/messages';
import {
  DEFAULT_CHANGES_VIEW_STATE,
  changesViewReducer,
  getChangesViewForRoot,
  getChangesViewRootKey,
  maybeClampChangesViewPage,
  normalizeChangesViewState,
  readPersistedDashboardState,
  resolveChangesViewScope,
  shouldClampChangesViewPage,
  upsertChangesViewForRoot,
} from '../../../src/webview/state/changesViewState';

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

const otherStoreScope: OpenSpecScopeView = {
  id: 'store:other',
  label: 'other',
  source: 'store',
  rootPath: '/stores/other',
  storeId: 'other',
  runtimeSource: 'installed',
};

describe('changesViewState', () => {
  it('provides serializable defaults', () => {
    expect(DEFAULT_CHANGES_VIEW_STATE).toEqual({
      lifecycleStatus: 'all',
      attentionOnly: false,
      query: '',
      sort: 'updated-desc',
      page: 1,
      pageSize: 10,
    });
    expect(JSON.parse(JSON.stringify(DEFAULT_CHANGES_VIEW_STATE))).toEqual(
      DEFAULT_CHANGES_VIEW_STATE
    );
  });

  it('normalizes malformed persisted page and pageSize', () => {
    expect(
      normalizeChangesViewState({
        page: 0,
        pageSize: 99 as 10,
      })
    ).toEqual({
      ...DEFAULT_CHANGES_VIEW_STATE,
      page: 1,
      pageSize: 10,
    });

    expect(normalizeChangesViewState({ page: -3, pageSize: 20 })).toMatchObject({
      page: 1,
      pageSize: 20,
    });
  });

  it('resets page to 1 for filter, query, sort, and pageSize actions', () => {
    const base = { ...DEFAULT_CHANGES_VIEW_STATE, page: 3 };

    expect(changesViewReducer(base, { type: 'SET_LIFECYCLE_FILTER', lifecycleStatus: 'applying' }).page).toBe(1);
    expect(changesViewReducer(base, { type: 'SET_ATTENTION_FILTER', attentionOnly: true }).page).toBe(1);
    expect(changesViewReducer(base, { type: 'SET_QUERY', query: 'foo' }).page).toBe(1);
    expect(changesViewReducer(base, { type: 'SET_SORT', sort: 'name-asc' }).page).toBe(1);
    expect(changesViewReducer(base, { type: 'SET_PAGE_SIZE', pageSize: 20 }).page).toBe(1);
  });

  it('updates page only through SET_PAGE', () => {
    const base = { ...DEFAULT_CHANGES_VIEW_STATE, page: 1 };
    expect(changesViewReducer(base, { type: 'SET_PAGE', page: 2 }).page).toBe(2);
    expect(changesViewReducer(base, { type: 'SET_PAGE', page: 0 }).page).toBe(1);
  });
});

describe('Task 7.1 getChangesViewRootKey', () => {
  it('produces the same key for equivalent Root descriptors', () => {
    const a = getChangesViewRootKey(localScope);
    const b = getChangesViewRootKey({
      ...localScope,
      label: 'Renamed Local',
    });
    expect(a).toBe(b);
    expect(a).toBe('local::local:/workspace::::/workspace');
  });

  it('produces different keys for distinct Roots', () => {
    const localKey = getChangesViewRootKey(localScope);
    const storeKey = getChangesViewRootKey(storeScope);
    const otherKey = getChangesViewRootKey(otherStoreScope);

    expect(localKey).not.toBe(storeKey);
    expect(storeKey).not.toBe(otherKey);
    expect(storeKey).toBe('store::store:team-plans::team-plans::/stores/team-plans');
  });

  it('does not collide when only labels match', () => {
    const left = getChangesViewRootKey({
      ...localScope,
      label: 'same-label',
      rootPath: '/a',
      id: 'local:/a',
    });
    const right = getChangesViewRootKey({
      ...storeScope,
      label: 'same-label',
      rootPath: '/b',
      id: 'store:b',
      storeId: 'b',
    });
    expect(left).not.toBe(right);
  });
});

describe('Task 7.2 persisted Changes view map', () => {
  it('reads defaults for a new Root and normalizes corrupted entries', () => {
    expect(getChangesViewForRoot({}, getChangesViewRootKey(localScope))).toEqual(
      DEFAULT_CHANGES_VIEW_STATE
    );

    const corrupted = readPersistedDashboardState({
      changesViews: {
        [getChangesViewRootKey(localScope)]: { page: 0, pageSize: 99, query: 'ok' },
      },
    });
    expect(getChangesViewForRoot(corrupted, getChangesViewRootKey(localScope))).toEqual({
      ...DEFAULT_CHANGES_VIEW_STATE,
      query: 'ok',
      page: 1,
      pageSize: 10,
    });
  });

  it('upserts validated state into the Root map without dropping other entries', () => {
    const localKey = getChangesViewRootKey(localScope);
    const storeKey = getChangesViewRootKey(storeScope);

    let persisted = upsertChangesViewForRoot(
      {},
      localKey,
      { ...DEFAULT_CHANGES_VIEW_STATE, lifecycleStatus: 'applying', page: 2 }
    );
    persisted = upsertChangesViewForRoot(
      persisted,
      storeKey,
      { ...DEFAULT_CHANGES_VIEW_STATE, lifecycleStatus: 'ready-to-verify', page: 1, query: 'verify' }
    );

    expect(getChangesViewForRoot(persisted, localKey)).toMatchObject({
      lifecycleStatus: 'applying',
      page: 2,
    });
    expect(getChangesViewForRoot(persisted, storeKey)).toMatchObject({
      lifecycleStatus: 'ready-to-verify',
      page: 1,
      query: 'verify',
    });
  });

  it('treats removed Root entries as harmless leftovers', () => {
    const orphanKey = getChangesViewRootKey(otherStoreScope);
    const persisted = upsertChangesViewForRoot(
      {},
      orphanKey,
      { ...DEFAULT_CHANGES_VIEW_STATE, query: 'gone' }
    );
    expect(getChangesViewForRoot(persisted, getChangesViewRootKey(localScope))).toEqual(
      DEFAULT_CHANGES_VIEW_STATE
    );
    expect(persisted.changesViews?.[orphanKey]?.query).toBe('gone');
  });

  it('ignores malformed top-level persisted JSON', () => {
    expect(readPersistedDashboardState(null)).toEqual({});
    expect(readPersistedDashboardState('nope')).toEqual({});
    expect(readPersistedDashboardState({ changesViews: 'bad' })).toEqual({ changesViews: {} });
  });
});

describe('Task 7.3–7.5 Root switch isolation and clamp gating', () => {
  it('keeps Local Applying/page 2 and Store Ready to Verify/page 1 independent across reload', () => {
    const localKey = getChangesViewRootKey(localScope);
    const storeKey = getChangesViewRootKey(storeScope);

    let persisted = upsertChangesViewForRoot(
      {},
      localKey,
      { ...DEFAULT_CHANGES_VIEW_STATE, lifecycleStatus: 'applying', page: 2, sort: 'name-asc' }
    );
    persisted = upsertChangesViewForRoot(
      persisted,
      storeKey,
      {
        ...DEFAULT_CHANGES_VIEW_STATE,
        lifecycleStatus: 'ready-to-verify',
        page: 1,
        attentionOnly: true,
      }
    );

    // Simulate vscode reload: re-read the same map.
    const reloaded = readPersistedDashboardState(JSON.parse(JSON.stringify(persisted)));
    expect(getChangesViewForRoot(reloaded, localKey)).toMatchObject({
      lifecycleStatus: 'applying',
      page: 2,
      sort: 'name-asc',
    });
    expect(getChangesViewForRoot(reloaded, storeKey)).toMatchObject({
      lifecycleStatus: 'ready-to-verify',
      page: 1,
      attentionOnly: true,
    });
  });

  it('resolves the pending target Root while old data is still showing', () => {
    const viewScope = resolveChangesViewScope(
      { scope: localScope, scopes: [localScope, storeScope] },
      storeScope.id
    );
    expect(viewScope).toEqual(storeScope);
    expect(getChangesViewRootKey(viewScope!)).toBe(getChangesViewRootKey(storeScope));
  });

  it('clamps page when matching-scope data shrinks, preserving filters', () => {
    const state = {
      ...DEFAULT_CHANGES_VIEW_STATE,
      lifecycleStatus: 'applying' as const,
      query: 'keep-me',
      sort: 'name-asc' as const,
      page: 5,
    };
    const clamped = maybeClampChangesViewPage(state, 2, true);
    expect(clamped).toEqual({
      ...state,
      page: 2,
    });
    expect(maybeClampChangesViewPage(state, 5, true)).toBeNull();
  });

  it('does not clamp target state from stale old-root data', () => {
    expect(shouldClampChangesViewPage(localScope, storeScope)).toBe(false);
    expect(shouldClampChangesViewPage(storeScope, storeScope)).toBe(true);

    const targetState = {
      ...DEFAULT_CHANGES_VIEW_STATE,
      lifecycleStatus: 'ready-to-verify' as const,
      page: 3,
    };
    expect(maybeClampChangesViewPage(targetState, 1, false)).toBeNull();
  });
});
