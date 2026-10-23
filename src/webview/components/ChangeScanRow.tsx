import React from 'react';
import type { ChangeInfo } from '../types/messages';
import { localizeWorkflowActionDisplayLabel } from '../utils/workflowLaunchLabels';
import { resolveWorkflowActions } from '../../shared/changeWorkflow';
import { changeWorkflowResolutionContext } from '../utils/changeWorkflowResolutionContext';
import { getScanHierarchyStatusLabel } from '../utils/dashboardScanHierarchy';
import { t } from '../../i18n';

export interface ChangeScanRowProps {
  change: ChangeInfo;
  highlighted?: boolean;
  onOpen?: (changeName: string) => void;
}

export const ChangeScanRow: React.FC<ChangeScanRowProps> = ({
  change,
  highlighted = false,
  onOpen,
}) => {
  const statusLabel = getScanHierarchyStatusLabel(change);
  const resolved = change.workflowSnapshot
    ? resolveWorkflowActions(change.workflowSnapshot, changeWorkflowResolutionContext(change))
    : undefined;
  const metaHint = change.attention?.required === true && resolved?.recommended
    ? localizeWorkflowActionDisplayLabel(resolved.recommended.label).toLowerCase()
    : change.totalTasks > 0
      ? t('dashboard.scanTasksProgress', {
        completed: change.completedTasks,
        total: change.totalTasks,
      })
      : resolved?.recommended
        ? localizeWorkflowActionDisplayLabel(resolved.recommended.label).toLowerCase()
        : undefined;

  return (
    <button
      type="button"
      data-change-scan-row={change.name}
      data-scan-highlighted={highlighted ? 'true' : undefined}
      className="w-full px-2 py-1.5 text-left transition-colors hover:bg-[var(--vscode-list-hoverBackground)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--vscode-focusBorder)]"
      style={{
        borderLeft: highlighted
          ? '2px solid var(--vscode-focusBorder)'
          : '2px solid transparent',
      }}
      onClick={() => onOpen?.(change.name)}
      title={change.name}
      aria-label={`${change.name} · ${statusLabel}`}
    >
      <div className="font-semibold text-xs truncate">{change.name}</div>
      <div
        className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px]"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
      >
        <span
          data-scan-status-pill
          className="rounded px-1 py-px text-[10px]"
          style={{
            border: highlighted
              ? '1px solid var(--vscode-focusBorder)'
              : '1px solid var(--vscode-panel-border)',
            color: highlighted
              ? 'var(--vscode-focusBorder)'
              : 'var(--vscode-descriptionForeground)',
          }}
        >
          {statusLabel}
        </span>
        {metaHint && <span data-scan-meta>{metaHint}</span>}
      </div>
    </button>
  );
};
