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
    expect(runs).toEqual(['tasks', 'tasks-again']);
    coordinator.complete('tasks');

    coordinator.schedule('tasks', () => runs.push('tasks-third'));
    vi.advanceTimersByTime(100);
    expect(runs).toEqual(['tasks', 'tasks-again', 'tasks-third']);

    vi.useRealTimers();
  });

  it('marks dirty when hidden and refetches when the panel becomes visible', () => {
    vi.useFakeTimers();
    let visible = false;
    const runs: string[] = [];
    const coordinator = new ArtifactFetchCoordinator({
      debounceMs: 50,
      isVisible: () => visible,
    });

    coordinator.schedule('tasks', () => runs.push('tasks'));
    expect(runs).toEqual([]);

    visible = true;
    coordinator.setPanelVisible(true);
    vi.advanceTimersByTime(50);
    expect(runs).toEqual(['tasks']);

    vi.useRealTimers();
  });

  it('refetches after invalidation while a fetch is in flight', () => {
    vi.useFakeTimers();
    const runs: string[] = [];
    const coordinator = new ArtifactFetchCoordinator({
      debounceMs: 50,
      isVisible: () => true,
    });

    coordinator.schedule('tasks', () => runs.push('tasks'));
    vi.advanceTimersByTime(50);
    expect(runs).toEqual(['tasks']);

    coordinator.schedule('tasks', () => runs.push('tasks-again'));
    vi.advanceTimersByTime(50);
    expect(runs).toEqual(['tasks']);

    coordinator.complete('tasks');
    expect(runs).toEqual(['tasks', 'tasks-again']);

    vi.useRealTimers();
  });
});
