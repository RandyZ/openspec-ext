import { describe, expect, it, vi } from 'vitest';
import {
  artifactContentCacheKey,
  artifactFetchCoordinatorKey,
} from '../../../src/webview/utils/artifactFetchKeys';
import { ArtifactFetchCoordinator } from '../../../src/webview/utils/artifactFetchCoordinator';

describe('artifactFetchKeys', () => {
  it('uses a stable coordinator key for tasks regardless of output path', () => {
    expect(artifactFetchCoordinatorKey('scope-1', 'tasks')).toBe('scope-1::tasks');
    expect(artifactFetchCoordinatorKey('scope-1', 'tasks')).toBe(
      artifactFetchCoordinatorKey('scope-1', 'tasks', 'ignored'),
    );
    expect(artifactContentCacheKey('scope-1', 'tasks')).toBe('scope-1::tasks');
    expect(artifactContentCacheKey('scope-1', 'tasks', 'openspec/changes/x/tasks.md')).toBe(
      'scope-1::tasks:openspec/changes/x/tasks.md',
    );
  });
});

describe('ArtifactFetchCoordinator with stable fetch keys', () => {
  it('clears in-flight when complete uses coordinator key after response path differs', () => {
    vi.useFakeTimers();
    const scopeId = 'scope-1';
    const fetchKey = artifactFetchCoordinatorKey(scopeId, 'tasks');
    const responsePath = 'openspec/changes/demo/tasks.md';
    const runs: string[] = [];
    const coordinator = new ArtifactFetchCoordinator({ debounceMs: 1, isVisible: () => true });

    coordinator.schedule(fetchKey, () => runs.push('initial'));
    vi.advanceTimersByTime(1);
    expect(runs).toEqual(['initial']);
    expect(coordinator.isInFlight(fetchKey)).toBe(true);

    const storageKey = artifactContentCacheKey(scopeId, 'tasks', responsePath);
    expect(storageKey).not.toBe(fetchKey);
    coordinator.complete(fetchKey);
    expect(coordinator.isInFlight(fetchKey)).toBe(false);

    coordinator.schedule(fetchKey, () => runs.push('after-invalidation'));
    vi.advanceTimersByTime(1);
    expect(runs).toEqual(['initial', 'after-invalidation']);
    vi.useRealTimers();
  });

  it('refetches immediately on invalidation after first fetch completes', () => {
    vi.useFakeTimers();
    const fetchKey = artifactFetchCoordinatorKey('ws', 'tasks');
    const runs: string[] = [];
    const coordinator = new ArtifactFetchCoordinator({
      debounceMs: 50,
      isVisible: () => true,
    });

    coordinator.schedule(fetchKey, () => runs.push('open-va'));
    vi.advanceTimersByTime(50);
    expect(runs).toEqual(['open-va']);
    coordinator.complete(fetchKey);

    coordinator.schedule(fetchKey, () => runs.push('invalidated'));
    vi.advanceTimersByTime(50);
    expect(runs).toEqual(['open-va', 'invalidated']);

    vi.useRealTimers();
  });
});
