import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { DashboardData } from '../types/messages';
import type {
  CliActivationDiagnosticView,
  LoadingReason,
  ProjectChangesExplorerData,
  ProjectPageContextMessage,
  ProjectSidebarData,
  ProjectSpecsExplorerData,
  WebviewCacheMeta,
} from '../types/messages';
import { adaptLegacyDashboardData } from '../types/legacyDashboardAdapter';

export type DashboardActivity =
  | { kind: 'idle' }
  | { kind: 'scope-switch'; targetScopeId: string }
  | { kind: 'cached-refresh'; scopeId: string }
  | { kind: 'manual-refresh' }
  | { kind: 'scope-action'; action: 'setup' | 'register' }
  | { kind: 'warning'; message: string };

export type AppPage = 'dashboard' | 'sidebar' | 'changesExplorer' | 'specsExplorer' | 'loading';

// State shape
export interface AppState {
  data: DashboardData | null;
  /** Undefined means a legacy compatibility caller supplied the state. */
  projectSidebar?: ProjectSidebarData | null;
  changesExplorer?: ProjectChangesExplorerData | null;
  specsExplorer?: ProjectSpecsExplorerData | null;
  page?: AppPage;
  projectFirst?: boolean;
  loading: boolean;
  loadingReason?: LoadingReason;
  pendingScopeId?: string;
  activity: DashboardActivity;
  stale?: boolean;
  error: string | null;
  selectedChange: string | null;
  debug: boolean;
  cliDiagnostic: { diagnostic: CliActivationDiagnosticView; mode: 'blocking' | 'warning' } | null;
}

// Action types
export type AppAction =
  | { type: 'SET_LOADING'; payload: boolean; reason?: LoadingReason }
  | { type: 'START_LOADING'; reason: LoadingReason }
  | { type: 'START_SCOPE_SWITCH'; scopeId: string }
  | { type: 'SET_DATA'; payload: DashboardData; cache?: WebviewCacheMeta }
  | { type: 'SET_PROJECT_SIDEBAR'; payload: ProjectSidebarData }
  | { type: 'SET_PAGE_CONTEXT'; payload: ProjectPageContextMessage }
  | { type: 'CLEAR_PAGE_CONTEXT' }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SELECT_CHANGE'; payload: string | null }
  | { type: 'SET_DEBUG'; payload: boolean }
  | { type: 'SET_CLI_DIAGNOSTIC'; payload: { diagnostic: CliActivationDiagnosticView; mode: 'blocking' | 'warning' } | null };

// Initial state
const initialState: AppState = {
  data: null,
  projectSidebar: null,
  changesExplorer: null,
  specsExplorer: null,
  page: 'sidebar',
  projectFirst: true,
  loading: true,
  loadingReason: 'initial',
  pendingScopeId: undefined,
  activity: { kind: 'idle' },
  stale: false,
  error: null,
  selectedChange: null,
  debug: false,
  cliDiagnostic: null,
};

function activityForLoading(reason?: LoadingReason, current: DashboardActivity = { kind: 'idle' }): DashboardActivity {
  if (reason === 'refresh') return { kind: 'manual-refresh' };
  if (reason === 'store-register') return { kind: 'scope-action', action: 'register' };
  if (reason === 'store-setup') return { kind: 'scope-action', action: 'setup' };
  return current;
}

// Reducer
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
        loadingReason: action.payload ? action.reason : undefined,
        pendingScopeId: action.payload ? state.pendingScopeId : undefined,
        activity: action.payload ? activityForLoading(action.reason, state.activity) : { kind: 'idle' },
      };

    case 'START_LOADING':
      return {
        ...state,
        loading: true,
        loadingReason: action.reason,
        pendingScopeId: undefined,
        activity: activityForLoading(action.reason),
      };

    case 'START_SCOPE_SWITCH':
      return {
        ...state,
        loading: true,
        loadingReason: 'scope-switch',
        pendingScopeId: action.scopeId,
        stale: false,
        activity: { kind: 'scope-switch', targetScopeId: action.scopeId },
      };

    case 'SET_DATA': {
      // Disk/memory cache from older extension builds may omit lifecycle fields;
      // adapt before render so ChangesSection never sees undefined counts.
      const payload = adaptLegacyDashboardData(action.payload);
      if (action.cache?.stale === true) {
        const scopeId = payload.scope?.id;
        const isPendingTarget = scopeId !== undefined && scopeId === state.pendingScopeId;
        return {
          ...state,
          data: payload,
          projectSidebar: null,
          changesExplorer: null,
          specsExplorer: null,
          page: 'dashboard',
          loading: true,
          loadingReason: scopeId ? 'background-refresh' : state.loadingReason,
          pendingScopeId: isPendingTarget ? undefined : state.pendingScopeId,
          stale: true,
          error: null,
          cliDiagnostic: null,
          activity: scopeId ? { kind: 'cached-refresh', scopeId } : state.activity,
        };
      }
      return {
        ...state,
        data: payload,
        projectSidebar: null,
        changesExplorer: null,
        specsExplorer: null,
        page: 'dashboard',
        loading: false,
        loadingReason: undefined,
        pendingScopeId: undefined,
        stale: false,
        error: null,
        cliDiagnostic: null,
        activity: { kind: 'idle' },
      };
    }

    case 'SET_PROJECT_SIDEBAR': {
      const stale = action.payload.cache?.stale === true;
      return {
        ...state,
        data: null,
        projectSidebar: action.payload,
        changesExplorer: null,
        specsExplorer: null,
        page: 'sidebar',
        projectFirst: true,
        loading: stale,
        loadingReason: stale ? 'background-refresh' : undefined,
        pendingScopeId: undefined,
        stale,
        error: null,
        selectedChange: null,
        cliDiagnostic: action.payload.cliDiagnostic
          ? { diagnostic: action.payload.cliDiagnostic, mode: 'warning' }
          : null,
        activity: stale
          ? { kind: 'cached-refresh', scopeId: action.payload.binding.projectId }
          : { kind: 'idle' },
      };
    }

    case 'SET_PAGE_CONTEXT': {
      const page = action.payload.view;
      if (
        state.page === page
        && ((page === 'sidebar' && state.projectSidebar === action.payload.data)
          || (page === 'dashboard' && state.projectSidebar === action.payload.data)
          || (page === 'changesExplorer' && state.changesExplorer === action.payload.data)
          || (page === 'specsExplorer' && state.specsExplorer === action.payload.data))
      ) {
        return state;
      }
      return {
        ...state,
        data: null,
        projectSidebar: page === 'sidebar' || page === 'dashboard' ? action.payload.data : null,
        changesExplorer: page === 'changesExplorer' ? action.payload.data : null,
        specsExplorer: page === 'specsExplorer' ? action.payload.data : null,
        page,
        projectFirst: page === 'sidebar' || page === 'dashboard',
        loading: false,
        loadingReason: undefined,
        pendingScopeId: undefined,
        stale: false,
        error: null,
        selectedChange: null,
        cliDiagnostic: (page === 'sidebar' || page === 'dashboard') && action.payload.data.cliDiagnostic
          ? { diagnostic: action.payload.data.cliDiagnostic, mode: 'warning' }
          : null,
        activity: { kind: 'idle' },
      };
    }

    case 'CLEAR_PAGE_CONTEXT':
      return {
        ...state,
        data: null,
        projectSidebar: null,
        changesExplorer: null,
        specsExplorer: null,
        page: 'loading',
        loading: true,
        loadingReason: 'initial',
        pendingScopeId: undefined,
        stale: false,
        selectedChange: null,
        cliDiagnostic: null,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false,
        loadingReason: undefined,
        pendingScopeId: undefined,
        activity: { kind: 'warning', message: action.payload },
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
        activity: state.activity.kind === 'warning' ? { kind: 'idle' } : state.activity,
      };

    case 'SELECT_CHANGE':
      return { ...state, selectedChange: action.payload };

    case 'SET_DEBUG':
      return { ...state, debug: action.payload };

    case 'SET_CLI_DIAGNOSTIC':
      return {
        ...state,
        cliDiagnostic: action.payload,
        loading: false,
        loadingReason: undefined,
        pendingScopeId: undefined,
        activity: action.payload ? { kind: 'warning', message: action.payload.diagnostic.message } : { kind: 'idle' },
      };

    default:
      return state;
  }
}

// Context
interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

// Provider
export function AppProvider({ children, initialState: overrideInitialState }: { children: ReactNode; initialState?: AppState }) {
  const [state, dispatch] = useReducer(appReducer, overrideInitialState ?? initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// Hook
export function useAppState() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used within AppProvider');
  }
  return context;
}
