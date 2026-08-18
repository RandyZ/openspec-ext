import type { ChangeLifecycleStatus } from '../../shared/changeLifecycle';
import type { OpenSpecScopeView } from '../types/messages';

export type ChangeSort = 'updated-desc' | 'updated-asc' | 'created-desc' | 'name-asc';

export type ChangePageSize = 10 | 20 | 50;

export interface ChangesViewState {
  lifecycleStatus: ChangeLifecycleStatus | 'all';
  attentionOnly: boolean;
  query: string;
  sort: ChangeSort;
  page: number;
  pageSize: ChangePageSize;
}

export interface PersistedDashboardState {
  changesViews?: Record<string, ChangesViewState>;
}

export type ChangesViewRootKeyInput = Pick<
  OpenSpecScopeView,
  'source' | 'id' | 'storeId' | 'rootPath'
>;

export const DEFAULT_CHANGES_VIEW_STATE: ChangesViewState = {
  lifecycleStatus: 'all',
  attentionOnly: false,
  query: '',
  sort: 'updated-desc',
  page: 1,
  pageSize: 10,
};

const PAGE_SIZES = new Set<ChangePageSize>([10, 20, 50]);

export type ChangesViewAction =
  | { type: 'SET_LIFECYCLE_FILTER'; lifecycleStatus: ChangeLifecycleStatus | 'all' }
  | { type: 'SET_ATTENTION_FILTER'; attentionOnly: boolean }
  | { type: 'SET_QUERY'; query: string }
  | { type: 'SET_SORT'; sort: ChangeSort }
  | { type: 'SET_PAGE_SIZE'; pageSize: ChangePageSize }
  | { type: 'SET_PAGE'; page: number };

function normalizePage(page: unknown): number {
  if (typeof page !== 'number' || !Number.isFinite(page) || page < 1) {
    return 1;
  }
  return Math.floor(page);
}

function normalizePageSize(pageSize: unknown): ChangePageSize {
  if (typeof pageSize === 'number' && PAGE_SIZES.has(pageSize as ChangePageSize)) {
    return pageSize as ChangePageSize;
  }
  return DEFAULT_CHANGES_VIEW_STATE.pageSize;
}

export function normalizeChangesViewState(
  persisted: Partial<ChangesViewState> | null | undefined
): ChangesViewState {
  if (!persisted) {
    return { ...DEFAULT_CHANGES_VIEW_STATE };
  }

  return {
    lifecycleStatus: persisted.lifecycleStatus ?? DEFAULT_CHANGES_VIEW_STATE.lifecycleStatus,
    attentionOnly: persisted.attentionOnly ?? DEFAULT_CHANGES_VIEW_STATE.attentionOnly,
    query: persisted.query ?? DEFAULT_CHANGES_VIEW_STATE.query,
    sort: persisted.sort ?? DEFAULT_CHANGES_VIEW_STATE.sort,
    page: normalizePage(persisted.page),
    pageSize: normalizePageSize(persisted.pageSize),
  };
}

export function getChangesViewRootKey(scope: ChangesViewRootKeyInput): string {
  return [scope.source, scope.id, scope.storeId ?? '', scope.rootPath].join('::');
}

export function readPersistedDashboardState(raw: unknown): PersistedDashboardState {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const changesViewsRaw = (raw as PersistedDashboardState).changesViews;
  if (!changesViewsRaw || typeof changesViewsRaw !== 'object' || Array.isArray(changesViewsRaw)) {
    return { changesViews: {} };
  }

  const changesViews: Record<string, ChangesViewState> = {};
  for (const [key, value] of Object.entries(changesViewsRaw)) {
    if (!value || typeof value !== 'object') {
      continue;
    }
    changesViews[key] = normalizeChangesViewState(value as Partial<ChangesViewState>);
  }

  return { changesViews };
}

export function getChangesViewForRoot(
  persisted: PersistedDashboardState,
  rootKey: string
): ChangesViewState {
  return normalizeChangesViewState(persisted.changesViews?.[rootKey]);
}

export function upsertChangesViewForRoot(
  persisted: PersistedDashboardState,
  rootKey: string,
  viewState: ChangesViewState
): PersistedDashboardState {
  return {
    ...persisted,
    changesViews: {
      ...(persisted.changesViews ?? {}),
      [rootKey]: normalizeChangesViewState(viewState),
    },
  };
}

export function resolveChangesViewScope(
  data: { scope?: OpenSpecScopeView; scopes?: OpenSpecScopeView[] } | null | undefined,
  pendingScopeId?: string
): OpenSpecScopeView | undefined {
  if (!data) {
    return undefined;
  }
  if (pendingScopeId) {
    const pending = (data.scopes ?? []).find((scope) => scope.id === pendingScopeId);
    if (pending) {
      return pending;
    }
  }
  return data.scope;
}

export function shouldClampChangesViewPage(
  dataScope: ChangesViewRootKeyInput | undefined,
  viewScope: ChangesViewRootKeyInput | undefined
): boolean {
  if (!dataScope || !viewScope) {
    return false;
  }
  return getChangesViewRootKey(dataScope) === getChangesViewRootKey(viewScope);
}

export function maybeClampChangesViewPage(
  state: ChangesViewState,
  clampedPage: number,
  allowClamp: boolean
): ChangesViewState | null {
  if (!allowClamp) {
    return null;
  }
  const page = normalizePage(clampedPage);
  if (page === state.page) {
    return null;
  }
  return { ...state, page };
}

export function changesViewReducer(
  state: ChangesViewState,
  action: ChangesViewAction
): ChangesViewState {
  switch (action.type) {
    case 'SET_LIFECYCLE_FILTER':
      return { ...state, lifecycleStatus: action.lifecycleStatus, page: 1 };
    case 'SET_ATTENTION_FILTER':
      return { ...state, attentionOnly: action.attentionOnly, page: 1 };
    case 'SET_QUERY':
      return { ...state, query: action.query, page: 1 };
    case 'SET_SORT':
      return { ...state, sort: action.sort, page: 1 };
    case 'SET_PAGE_SIZE':
      return { ...state, pageSize: action.pageSize, page: 1 };
    case 'SET_PAGE':
      return { ...state, page: normalizePage(action.page) };
    default:
      return state;
  }
}
