import { describe, expect, it } from 'vitest';
import type {
  ActiveChangeLifecycleStatus,
  ChangeAttention,
  ChangeAttentionReason,
  ChangeLifecycleStatus,
  ChangeStatusCounts,
  LifecycleArtifactInput,
} from '@/shared/changeLifecycle';
import {
  buildChangeStatusCounts,
  deriveChangeAttention,
  deriveChangeLifecycle,
  deriveChangeLifecycleStatus,
  enrichChangeWithLifecycle,
  getWorkflowActionsForLifecycle,
} from '@/shared/changeLifecycle';

// Task 1.1: type-level fixture — every required export must compile.
const _activeStatus: ActiveChangeLifecycleStatus = 'planning';
const _lifecycleStatus: ChangeLifecycleStatus = 'archived';
const _attention: ChangeAttention = {
  required: true,
  reasons: ['invalid-task-progress' satisfies ChangeAttentionReason],
};
const _counts: ChangeStatusCounts = {
  all: 0,
  planning: 0,
  readyToApply: 0,
  applying: 0,
  readyToVerify: 0,
  archived: 0,
  needsAttention: 0,
};
void _activeStatus;
void _lifecycleStatus;
void _attention;
void _counts;

function artifact(
  id: string,
  status: string,
  outputPath = `openspec/changes/demo/${id}.md`
): LifecycleArtifactInput {
  return { id, outputPath, status };
}

describe('deriveChangeLifecycleStatus', () => {
  const cases: Array<{
    name: string;
    input: {
      artifacts: LifecycleArtifactInput[];
      completedTasks: number;
      totalTasks: number;
    };
    expected: ActiveChangeLifecycleStatus;
  }> = [
    {
      name: 'empty artifacts → planning',
      input: { artifacts: [], completedTasks: 0, totalTasks: 0 },
      expected: 'planning',
    },
    {
      name: '0/0 tasks with done artifacts → planning (no tasks)',
      input: {
        artifacts: [artifact('custom-step-a', 'done')],
        completedTasks: 0,
        totalTasks: 0,
      },
      expected: 'planning',
    },
    {
      name: '0/N tasks with all artifacts done → ready-to-apply',
      input: {
        artifacts: [
          artifact('custom-step-a', 'done'),
          artifact('custom-step-b', 'done'),
        ],
        completedTasks: 0,
        totalTasks: 5,
      },
      expected: 'ready-to-apply',
    },
    {
      name: '1/N tasks → applying',
      input: {
        artifacts: [artifact('custom-step-a', 'done')],
        completedTasks: 1,
        totalTasks: 5,
      },
      expected: 'applying',
    },
    {
      name: 'N/N tasks → ready-to-verify',
      input: {
        artifacts: [artifact('custom-step-a', 'done')],
        completedTasks: 5,
        totalTasks: 5,
      },
      expected: 'ready-to-verify',
    },
    {
      name: 'schema artifact not done → planning',
      input: {
        artifacts: [artifact('custom-step-a', 'ready')],
        completedTasks: 0,
        totalTasks: 3,
      },
      expected: 'planning',
    },
    {
      name: 'blocked artifact alone does not block via attention but keeps planning',
      input: {
        artifacts: [artifact('custom-step-a', 'blocked')],
        completedTasks: 0,
        totalTasks: 3,
      },
      expected: 'planning',
    },
    {
      name: 'mixed ready and blocked artifacts → planning',
      input: {
        artifacts: [
          artifact('custom-step-a', 'done'),
          artifact('custom-step-b', 'blocked'),
        ],
        completedTasks: 0,
        totalTasks: 2,
      },
      expected: 'planning',
    },
    {
      name: 'N+1/N completed → planning (invalid overflow)',
      input: {
        artifacts: [artifact('custom-step-a', 'done')],
        completedTasks: 6,
        totalTasks: 5,
      },
      expected: 'planning',
    },
    {
      name: 'negative completed → planning (invalid progress)',
      input: {
        artifacts: [artifact('custom-step-a', 'done')],
        completedTasks: -1,
        totalTasks: 5,
      },
      expected: 'planning',
    },
    {
      name: 'unknown artifact status → planning',
      input: {
        artifacts: [artifact('custom-step-a', 'mystery')],
        completedTasks: 0,
        totalTasks: 3,
      },
      expected: 'planning',
    },
    {
      name: 'empty artifact id → planning',
      input: {
        artifacts: [artifact('', 'done')],
        completedTasks: 0,
        totalTasks: 3,
      },
      expected: 'planning',
    },
    {
      name: 'invalid outputPath → planning',
      input: {
        artifacts: [artifact('custom-step-a', 'done', '')],
        completedTasks: 0,
        totalTasks: 3,
      },
      expected: 'planning',
    },
  ];

  it.each(cases)('$name', ({ input, expected }) => {
    expect(deriveChangeLifecycleStatus(input)).toBe(expected);
  });
});

describe('deriveChangeAttention', () => {
  it('does not flag ordinary blocked artifacts', () => {
    const attention = deriveChangeAttention({
      artifacts: [artifact('custom-step-a', 'blocked')],
      completedTasks: 0,
      totalTasks: 3,
    });
    expect(attention.required).toBe(false);
    expect(attention.reasons).toEqual([]);
  });

  it('flags invalid task progress', () => {
    const attention = deriveChangeAttention({
      artifacts: [artifact('custom-step-a', 'done')],
      completedTasks: 10,
      totalTasks: 5,
    });
    expect(attention.required).toBe(true);
    expect(attention.reasons).toContain('invalid-task-progress');
  });

  it('flags unknown artifact status', () => {
    const attention = deriveChangeAttention({
      artifacts: [artifact('custom-step-a', 'unknown-status')],
      completedTasks: 0,
      totalTasks: 3,
    });
    expect(attention.required).toBe(true);
    expect(attention.reasons).toContain('invalid-artifact-status');
  });

  it('flags empty artifact id', () => {
    const attention = deriveChangeAttention({
      artifacts: [artifact('', 'done')],
      completedTasks: 0,
      totalTasks: 3,
    });
    expect(attention.required).toBe(true);
    expect(attention.reasons).toContain('invalid-artifact-status');
  });

  it('flags invalid outputPath', () => {
    const attention = deriveChangeAttention({
      artifacts: [artifact('custom-step-a', 'done', '   ')],
      completedTasks: 0,
      totalTasks: 3,
    });
    expect(attention.required).toBe(true);
    expect(attention.reasons).toContain('invalid-artifact-path');
  });
});

describe('deriveChangeLifecycle', () => {
  it('clamps negative completed tasks for normalized output', () => {
    const result = deriveChangeLifecycle({
      artifacts: [artifact('custom-step-a', 'done')],
      completedTasks: -2,
      totalTasks: 5,
    });
    expect(result.normalizedCompletedTasks).toBe(0);
    expect(result.status).toBe('planning');
    expect(result.attention.reasons).toContain('invalid-task-progress');
  });
});

describe('getWorkflowActionsForLifecycle', () => {
  const mappingCases: Array<{
    status: ChangeLifecycleStatus;
    expectedActions: string[];
  }> = [
    { status: 'planning', expectedActions: ['continue', 'ff'] },
    { status: 'ready-to-apply', expectedActions: ['apply'] },
    { status: 'applying', expectedActions: ['apply'] },
    { status: 'ready-to-verify', expectedActions: ['verify'] },
    { status: 'archived', expectedActions: [] },
  ];

  it.each(mappingCases)('$status → $expectedActions', ({ status, expectedActions }) => {
    const actions = getWorkflowActionsForLifecycle(status);
    expect(actions.map((item) => item.action)).toEqual(expectedActions);
  });

  it('returns a defensive copy on each call', () => {
    const first = getWorkflowActionsForLifecycle('planning');
    const second = getWorkflowActionsForLifecycle('planning');
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
  });

  it('marks the first action as primary and the rest as secondary', () => {
    const actions = getWorkflowActionsForLifecycle('planning');
    expect(actions[0]?.variant).toBe('primary');
    expect(actions[1]?.variant).toBe('secondary');
  });

  it('uses verify (not archive) for ready-to-verify', () => {
    const actions = getWorkflowActionsForLifecycle('ready-to-verify');
    expect(actions).toHaveLength(1);
    expect(actions[0]?.action).toBe('verify');
  });
});

describe('enrichChangeWithLifecycle', () => {
  it('derives lifecycleStatus and omits attention when healthy', () => {
    const enriched = enrichChangeWithLifecycle({
      name: 'demo',
      completedTasks: 0,
      totalTasks: 3,
      lastModified: '2026-01-01',
      status: 'draft',
      artifacts: [
        artifact('proposal', 'done'),
        artifact('design', 'done'),
        artifact('tasks', 'done'),
      ],
    });
    expect(enriched.lifecycleStatus).toBe('ready-to-apply');
    expect(enriched.attention).toBeUndefined();
    expect(enriched.status).toBe('draft');
  });

  it('preserves metadata-read-failed as planning + attention (not empty-artifact success)', () => {
    const enriched = enrichChangeWithLifecycle({
      name: 'broken-status',
      completedTasks: 0,
      totalTasks: 2,
      lastModified: '2026-01-01',
      status: 'draft',
      artifacts: [],
      attention: { required: true, reasons: ['metadata-read-failed'] },
    });
    expect(enriched.lifecycleStatus).toBe('planning');
    expect(enriched.attention).toEqual({
      required: true,
      reasons: ['metadata-read-failed'],
    });
  });

  it('marks attention for malformed artifact data without throwing', () => {
    const enriched = enrichChangeWithLifecycle({
      name: 'malformed',
      completedTasks: 5,
      totalTasks: 2,
      lastModified: '2026-01-01',
      status: 'in-progress',
      artifacts: [artifact('x', 'not-a-status', '')],
    });
    expect(enriched.lifecycleStatus).toBe('planning');
    expect(enriched.attention?.required).toBe(true);
    expect(enriched.attention?.reasons).toEqual(
      expect.arrayContaining(['invalid-artifact-status', 'invalid-artifact-path', 'invalid-task-progress'])
    );
  });
});

describe('buildChangeStatusCounts', () => {
  it('counts active lifecycle buckets, archived, and needsAttention from one snapshot', () => {
    const counts = buildChangeStatusCounts(
      [
        { lifecycleStatus: 'planning' },
        { lifecycleStatus: 'planning', attention: { required: true, reasons: ['metadata-read-failed'] } },
        { lifecycleStatus: 'ready-to-apply' },
        { lifecycleStatus: 'applying' },
        { lifecycleStatus: 'ready-to-verify' },
      ],
      [{ directoryName: '2026-01-01-old', name: 'old', archiveDate: '2026-01-01' }]
    );

    expect(counts).toEqual({
      all: 6,
      planning: 2,
      readyToApply: 1,
      applying: 1,
      readyToVerify: 1,
      archived: 1,
      needsAttention: 1,
    });
    expect(counts.all).toBe(
      counts.planning +
        counts.readyToApply +
        counts.applying +
        counts.readyToVerify +
        counts.archived
    );
  });

  it('does not count archived items toward needsAttention', () => {
    const counts = buildChangeStatusCounts([], [
      { directoryName: '2026-01-01-old', name: 'old', archiveDate: '2026-01-01' },
    ]);
    expect(counts.needsAttention).toBe(0);
    expect(counts.archived).toBe(1);
    expect(counts.all).toBe(1);
  });
});
