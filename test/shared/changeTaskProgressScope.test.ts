import { describe, expect, it } from 'vitest';
import { changeTaskProgressPatchAppliesToPanel } from '../../src/shared/changeTaskProgressScope';
import type { ChangeTaskProgressPatch } from '../../src/shared/changeTaskProgressPatch';

function patch(overrides: Partial<ChangeTaskProgressPatch>): ChangeTaskProgressPatch {
  return {
    type: 'changeTaskProgressPatch',
    changeName: 'demo-change',
    completedTasks: 1,
    totalTasks: 3,
    revisedAt: 1,
    ...overrides,
  };
}

describe('changeTaskProgressPatchAppliesToPanel', () => {
  it('matches project-bound detail panel when patch uses local scope id at same root', () => {
    const root = '/projects/acme/openspec';
    const applies = changeTaskProgressPatchAppliesToPanel(
      patch({
        scopeId: `local:${root}`,
        changeRootPath: root,
      }),
      {
        changeName: 'demo-change',
        scopeId: 'project:acme:/projects/acme/openspec:local:',
        planningRoot: root,
      },
    );
    expect(applies).toBe(true);
  });

  it('rejects patches for the same change name at a different root', () => {
    const applies = changeTaskProgressPatchAppliesToPanel(
      patch({ changeRootPath: '/workspace/a' }),
      {
        changeName: 'demo-change',
        planningRoot: '/workspace/b',
      },
    );
    expect(applies).toBe(false);
  });

  it('matches store scope panels via changeRootPath', () => {
    const storeRoot = '/stores/team-plans';
    const applies = changeTaskProgressPatchAppliesToPanel(
      patch({ scopeId: 'store:team-plans', changeRootPath: storeRoot }),
      {
        changeName: 'demo-change',
        scopeId: 'store:team-plans',
        planningRoot: storeRoot,
      },
    );
    expect(applies).toBe(true);
  });
});
