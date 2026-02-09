import React from 'react';
import { ChangeInfo } from '../types/messages';
import { ChangeCard } from './ChangeCard';
import { EmptyState } from './EmptyState';

interface ChangesSectionProps {
  changes: ChangeInfo[];
  onOpenChange?: (changeName: string) => void;
  onRequestNewChange?: () => void;
  onCopyFf?: (changeName: string) => void;
  onCopyApply?: (changeName: string) => void;
  onArchive?: (changeName: string) => void;
}

type StatusGroup = 'in-progress' | 'draft' | 'complete';

const STATUS_ORDER: StatusGroup[] = ['in-progress', 'draft', 'complete'];
const STATUS_LABELS: Record<StatusGroup, string> = {
  'in-progress': 'In progress',
  draft: 'Draft',
  complete: 'Complete',
};

function groupByStatus(changes: ChangeInfo[]): Map<StatusGroup, ChangeInfo[]> {
  const map = new Map<StatusGroup, ChangeInfo[]>();
  for (const s of STATUS_ORDER) {
    map.set(s, []);
  }
  for (const c of changes) {
    const group = (c.status in STATUS_LABELS ? c.status : 'draft') as StatusGroup;
    map.get(group)!.push(c);
  }
  return map;
}

export const ChangesSection: React.FC<ChangesSectionProps> = ({
  changes,
  onOpenChange,
  onRequestNewChange,
  onCopyFf,
  onCopyApply,
  onArchive,
}) => {
  const grouped = groupByStatus(changes);

  return (
    <div className="mb-6">
      <h2
        className="text-base font-semibold mb-2"
        style={{ color: 'var(--vscode-foreground)' }}
      >
        Changes ({changes.length})
      </h2>

      {changes.length === 0 ? (
        <EmptyState
          message="No active changes. Create one to get started."
          actionLabel="Create New Change"
          onAction={onRequestNewChange}
        />
      ) : (
        <div className="space-y-4">
          {STATUS_ORDER.map((status) => {
            const list = grouped.get(status)!;
            if (list.length === 0) return null;
            return (
              <div key={status}>
                <h3
                  className="text-xs font-medium mb-2"
                  style={{ color: 'var(--vscode-descriptionForeground)' }}
                >
                  {STATUS_LABELS[status]} ({list.length})
                </h3>
                <div className="space-y-2">
                  {list.map((change) => (
                    <ChangeCard
                      key={change.name}
                      change={change}
                      onClick={onOpenChange}
                      onCopyFf={onCopyFf}
                      onCopyApply={onCopyApply}
                      onArchive={onArchive}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
