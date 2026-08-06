import type { ArtifactStatus } from '../types/messages';
import { VERIFY_ARCHIVE_TAB_ID } from '../../shared/interactiveWorkflow';

export interface ChangeDetailTabDef {
  id: string;
  label: string;
}

/** Known Schema artifact id → display label (English fallback; UI may i18n separately). */
const KNOWN_ARTIFACT_LABELS: Record<string, string> = {
  proposal: 'Proposal',
  specs: 'Specs',
  design: 'Design',
  tasks: 'Tasks',
};

export function titleCaseArtifactId(id: string): string {
  if (!id) return id;
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function labelForArtifactId(id: string): string {
  return KNOWN_ARTIFACT_LABELS[id] ?? titleCaseArtifactId(id);
}

/**
 * Build Change Detail tabs from Schema artifact list order.
 * Skips Schema ids that collide with the reserved Verify & Archive tab.
 */
export function buildTabs(
  artifacts: ArtifactStatus[] | undefined,
  showVerifyArchiveTab: boolean,
  onConflict?: (id: string) => void
): ChangeDetailTabDef[] {
  const source: ArtifactStatus[] =
    artifacts && artifacts.length > 0
      ? artifacts
      : [
          { id: 'proposal', outputPath: 'proposal.md', status: 'ready' },
          { id: 'specs', outputPath: 'specs', status: 'ready' },
          { id: 'design', outputPath: 'design.md', status: 'ready' },
          { id: 'tasks', outputPath: 'tasks.md', status: 'ready' },
        ];

  const tabs: ChangeDetailTabDef[] = [];
  for (const artifact of source) {
    const id = (artifact.id ?? '').trim();
    if (!id) continue;
    if (id === VERIFY_ARCHIVE_TAB_ID) {
      onConflict?.(id);
      continue;
    }
    tabs.push({ id, label: labelForArtifactId(id) });
  }

  if (showVerifyArchiveTab) {
    tabs.push({ id: VERIFY_ARCHIVE_TAB_ID, label: 'Verify & Archive' });
  }

  return tabs;
}
