import { describe, expect, it } from 'vitest';
import { adaptLegacyDashboardData } from '../../../src/webview/types/legacyDashboardAdapter';

describe('adaptLegacyDashboardData', () => {
  it('fills lifecycleStatus and changeStatusCounts for legacy fixtures missing Host fields', () => {
    const adapted = adaptLegacyDashboardData({
      changes: [
        {
          name: 'legacy-change',
          completedTasks: 0,
          totalTasks: 3,
          lastModified: '2026-06-14T00:00:00.000Z',
          status: 'draft',
          artifacts: [
            { id: 'proposal', outputPath: 'proposal.md', status: 'done' },
            { id: 'design', outputPath: 'design.md', status: 'done' },
            { id: 'tasks', outputPath: 'tasks.md', status: 'done' },
          ],
        },
      ],
      specs: [],
      archivedChanges: [
        { directoryName: '2026-01-01-old', name: 'old', archiveDate: '2026-01-01' },
      ],
      lastRefresh: 1,
    });

    expect(adapted.changes[0].lifecycleStatus).toBe('ready-to-apply');
    expect(adapted.changeStatusCounts).toEqual({
      all: 2,
      planning: 0,
      readyToApply: 1,
      applying: 0,
      readyToVerify: 0,
      archived: 1,
      needsAttention: 0,
    });
  });

  it('does not invent a healthy lifecycle when metadata-read-failed attention is present', () => {
    const adapted = adaptLegacyDashboardData({
      changes: [
        {
          name: 'broken-status',
          completedTasks: 0,
          totalTasks: 2,
          lastModified: '2026-06-14T00:00:00.000Z',
          status: 'draft',
          artifacts: [],
          attention: { required: true, reasons: ['metadata-read-failed'] },
        },
      ],
      specs: [],
      lastRefresh: 1,
    });

    expect(adapted.changes[0].lifecycleStatus).toBe('planning');
    expect(adapted.changes[0].attention).toEqual({
      required: true,
      reasons: ['metadata-read-failed'],
    });
    expect(adapted.changeStatusCounts.needsAttention).toBe(1);
  });

  it('returns the same object when Host lifecycle contract is already complete', () => {
    const complete = adaptLegacyDashboardData({
      changes: [
        {
          name: 'ready',
          completedTasks: 0,
          totalTasks: 1,
          lastModified: '2026-06-14T00:00:00.000Z',
          status: 'draft',
          lifecycleStatus: 'ready-to-apply' as const,
          artifacts: [
            { id: 'proposal', outputPath: 'proposal.md', status: 'done' },
            { id: 'design', outputPath: 'design.md', status: 'done' },
            { id: 'tasks', outputPath: 'tasks.md', status: 'done' },
          ],
        },
      ],
      specs: [],
      archivedChanges: [],
      changeStatusCounts: {
        all: 1,
        planning: 0,
        readyToApply: 1,
        applying: 0,
        readyToVerify: 0,
        archived: 0,
        needsAttention: 0,
      },
      lastRefresh: 1,
    });

    const again = adaptLegacyDashboardData(complete);
    expect(again).toBe(complete);
  });
});
