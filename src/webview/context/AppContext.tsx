import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { DashboardData } from '../types/messages';
import type { CliActivationDiagnosticView, LoadingReason, WebviewCacheMeta } from '../types/messages';

export type DashboardActivity =
  | { kind: 'idle' }
  | { kind: 'scope-switch'; targetScopeId: string }
  | { kind: 'cached-refresh'; scopeId: string }
  | { kind: 'manual-refresh' }
  | { kind: 'scope-action'; action: 'setup' | 'register' }
  | { kind: 'warning'; message: string };

// State shape
export interface AppState {
  data: DashboardData | null;
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
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SELECT_CHANGE'; payload: string | null }
  | { type: 'SET_DEBUG'; payload: boolean }
  | { type: 'SET_CLI_DIAGNOSTIC'; payload: { diagnostic: CliActivationDiagnosticView; mode: 'blocking' | 'warning' } | null };

// Initial state
const initialState: AppState = {
  data: null,
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

    case 'SET_DATA':
      if (action.cache?.stale === true) {
        const scopeId = action.payload.scope?.id;
        const isPendingTarget = scopeId !== undefined && scopeId === state.pendingScopeId;
        return {
          ...state,
          data: action.payload,
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
        data: action.payload,
        loading: false,
        loadingReason: undefined,
        pendingScopeId: undefined,
        stale: action.cache?.stale === true,
        error: null,
        cliDiagnostic: null,
        activity: { kind: 'idle' },
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
