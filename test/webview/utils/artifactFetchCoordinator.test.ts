import { describe, expect, it, vi } from 'vitest';
import { ArtifactFetchCoordinator } from '../../../src/webview/utils/artifactFetchCoordinator';

describe('ArtifactFetchCoordinator', () => {
  it('does not run overlapping fetches for the same key', () => {
    vi.useFakeTimers();
    const runs: string[] = [];
    const coordinator = new ArtifactFetchCoordinator({
      debounceMs: 100,
      isVisible: () => true,
    });

    coordinator.schedule('tasks', () => runs.push('tasks'));
    vi.advanceTimersByTime(100);
    expect(runs).toEqual(['tasks']);
    expect(coordinator.isInFlight('tasks')).toBe(true);

    coordinator.schedule('tasks', () => runs.push('tasks-again'));
    vi.advanceTimersByTime(200);
    expect(runs).toEqual(['tasks']);

    coordinator.complete('tasks');
    coordinator.schedule('tasks', () => runs.push('tasks-second'));
    vi.advanceTimersByTime(100);
    expect(runs).toEqual(['tasks', 'tasks-second']);

    vi.useRealTimers();
  });
});
