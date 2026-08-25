import { describe, expect, it } from 'vitest';
import {
  resolveWorkflowActions,
  type ChangeWorkflowSnapshot,
  type WorkflowArtifactNode,
  type WorkflowResolutionContext,
} from '@/shared/changeWorkflow';

function artifact(
  id: string,
  status: WorkflowArtifactNode['status'],
  overrides: Partial<WorkflowArtifactNode> = {}
): WorkflowArtifactNode {
  return {
    id,
    status,
    requires: [],
    missingDeps: [],
    outputPath: `openspec/changes/demo/${id}.md`,
    existingOutputPaths: [],
    ...overrides,
  };
}

function snapshot(
  artifacts: readonly WorkflowArtifactNode[],
  diagnostics?: readonly string[]
): ChangeWorkflowSnapshot {
  return {
    changeName: 'demo',
    schema: 'custom-schema',
    bindingKey: 'bound-root',
    artifacts,
    ...(diagnostics ? { diagnostics } : {}),
  };
}

const planningContext: WorkflowResolutionContext = {
  completedTasks: 0,
  totalTasks: 3,
};

describe('resolveWorkflowActions', () => {
  it('recommends the first ready artifact and keeps parallel ready artifacts available', () => {
    const result = resolveWorkflowActions(snapshot([
      artifact('specs', 'ready'),
      artifact('design', 'ready'),
      artifact('blocked', 'blocked', { missingDeps: ['proposal'] }),
      artifact('optional', 'skipped'),
    ]), planningContext);

    expect(result.recommended).toMatchObject({
      action: 'continue',
      artifactId: 'specs',
      label: 'Continue planning',
    });
    expect(result.available.map((action) => action.artifactId ?? action.action)).toEqual(['design', 'ff']);
    expect(result.blocked.map((node) => ({ id: node.id, missingDeps: node.missingDeps }))).toEqual([
      { id: 'blocked', missingDeps: ['proposal'] },
    ]);
    expect(result.skipped.map((node) => node.id)).toEqual(['optional']);
  });

  it('recommends Apply when planning is complete and tasks remain', () => {
    const result = resolveWorkflowActions(
      snapshot([artifact('proposal', 'done'), artifact('tasks', 'done')]),
      planningContext
    );

    expect(result.recommended).toMatchObject({ action: 'apply', label: 'Apply' });
    expect(result.available).toEqual([]);
    expect(result.highImpact).toEqual([]);
  });

  it('recommends Verify, keeps Archive high-impact, and exposes conditional Sync Specs', () => {
    const result = resolveWorkflowActions(
      snapshot([artifact('proposal', 'done'), artifact('tasks', 'done')]),
      { completedTasks: 3, totalTasks: 3, hasDeltaSpecs: true }
    );

    expect(result.recommended).toMatchObject({ action: 'verify', label: 'Verify', highImpact: true });
    expect(result.highImpact).toMatchObject([
      { action: 'archive', label: 'Archive', highImpact: true },
    ]);
    expect(result.available).toMatchObject([
      { action: 'sync', label: 'Sync Specs' },
    ]);
  });

  it('only exposes direct Archive as a high-impact action for a healthy completed snapshot', () => {
    const incomplete = resolveWorkflowActions(
      snapshot([artifact('proposal', 'done'), artifact('tasks', 'done')]),
      { completedTasks: 2, totalTasks: 3 }
    );
    const invalid = resolveWorkflowActions(
      snapshot([artifact('proposal', 'done'), artifact('tasks', 'done')], ['stale-binding']),
      { completedTasks: 3, totalTasks: 3 }
    );

    expect(incomplete.highImpact).toEqual([]);
    expect(invalid.highImpact).toEqual([]);
  });

  it('returns no write actions for archived Changes', () => {
    const result = resolveWorkflowActions(
      snapshot([artifact('proposal', 'done'), artifact('tasks', 'done')]),
      { completedTasks: 3, totalTasks: 3, isArchived: true, hasDeltaSpecs: true }
    );

    expect(result.recommended).toBeNull();
    expect(result.available).toEqual([]);
    expect(result.highImpact).toEqual([]);
  });
});
