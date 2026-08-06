import { describe, it, expect, vi } from 'vitest';
import { buildTabs, labelForArtifactId, titleCaseArtifactId } from '../../../src/webview/utils/buildTabs';
import { VERIFY_ARCHIVE_TAB_ID } from '../../../src/shared/interactiveWorkflow';

describe('buildTabs', () => {
  it('uses default four tabs when artifacts are missing', () => {
    const tabs = buildTabs(undefined, false);
    expect(tabs.map((t) => t.id)).toEqual(['proposal', 'specs', 'design', 'tasks']);
    expect(tabs.map((t) => t.label)).toEqual(['Proposal', 'Specs', 'Design', 'Tasks']);
  });

  it('preserves schema order and labels known ids', () => {
    const tabs = buildTabs(
      [
        { id: 'tasks', outputPath: 'tasks.md', status: 'done' },
        { id: 'proposal', outputPath: 'proposal.md', status: 'done' },
      ],
      false
    );
    expect(tabs.map((t) => t.id)).toEqual(['tasks', 'proposal']);
  });

  it('title-cases custom schema ids', () => {
    expect(titleCaseArtifactId('risk-analysis')).toBe('Risk Analysis');
    expect(labelForArtifactId('risk-analysis')).toBe('Risk Analysis');
    const tabs = buildTabs(
      [{ id: 'risk-analysis', outputPath: 'risk-analysis.md', status: 'ready' }],
      false
    );
    expect(tabs).toEqual([{ id: 'risk-analysis', label: 'Risk Analysis' }]);
  });

  it('skips schema ids that collide with verifyArchive and still appends the reserved tab', () => {
    const onConflict = vi.fn();
    const tabs = buildTabs(
      [
        { id: 'proposal', outputPath: 'proposal.md', status: 'done' },
        { id: VERIFY_ARCHIVE_TAB_ID, outputPath: 'verify.md', status: 'ready' },
      ],
      true,
      onConflict
    );
    expect(onConflict).toHaveBeenCalledWith(VERIFY_ARCHIVE_TAB_ID);
    expect(tabs.map((t) => t.id)).toEqual(['proposal', VERIFY_ARCHIVE_TAB_ID]);
    expect(tabs.filter((t) => t.id === VERIFY_ARCHIVE_TAB_ID)).toHaveLength(1);
  });
});
