import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { DashboardData } from '../types/messages';
import type { CliActivationDiagnosticView } from '../types/messages';

// State shape
export interface AppState {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  selectedChange: string | null;
  debug: boolean;
  cliDiagnostic: { diagnostic: CliActivationDiagnosticView; mode: 'blocking' | 'warning' } | null;
}

// Action types
export type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_DATA'; payload: DashboardData }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SELECT_CHANGE'; payload: string | null }
  | { type: 'SET_DEBUG'; payload: boolean }
  | { type: 'SET_CLI_DIAGNOSTIC'; payload: { diagnostic: CliActivationDiagnosticView; mode: 'blocking' | 'warning' } | null };

// Initial state
const initialState: AppState = {
  data: null,
  loading: true,
  error: null,
  selectedChange: null,
  debug: false,
  cliDiagnostic: null,
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_DATA':
      return {
        ...state,
        data: action.payload,
        loading: false,
        error: null,
        cliDiagnostic: null,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false,
      };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    case 'SELECT_CHANGE':
      return { ...state, selectedChange: action.payload };

    case 'SET_DEBUG':
      return { ...state, debug: action.payload };

    case 'SET_CLI_DIAGNOSTIC':
      return { ...state, cliDiagnostic: action.payload, loading: false };

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
