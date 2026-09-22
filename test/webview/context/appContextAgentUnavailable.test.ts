import { describe, expect, it } from 'vitest';
import {
  appReducer,
  createAgentUnavailableInitialState,
} from '../../../src/webview/context/AppContext';

describe('createAgentUnavailableInitialState', () => {
  it('starts on agent unavailable page without loading', () => {
    const state = createAgentUnavailableInitialState('/tmp/ws-b-empty');
    expect(state.page).toBe('agentUnavailable');
    expect(state.loading).toBe(false);
    expect(state.agentUnavailableWorkspacePath).toBe('/tmp/ws-b-empty');
  });

  it('SET_AGENT_UNAVAILABLE clears loading and dashboard data', () => {
    const next = appReducer(
      {
        ...createAgentUnavailableInitialState(),
        loading: true,
        loadingReason: 'initial',
        data: { changes: [], specs: [] } as never,
      },
      { type: 'SET_AGENT_UNAVAILABLE', payload: { workspacePath: '/tmp/ws' } },
    );

    expect(next.page).toBe('agentUnavailable');
    expect(next.loading).toBe(false);
    expect(next.data).toBeNull();
  });
});
