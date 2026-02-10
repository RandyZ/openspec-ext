import React from 'react';
import { ChangeInfo, ArchivedChangeInfo } from '../types/messages';
import { ChangeCard } from './ChangeCard';
import { EmptyState } from './EmptyState';

interface ChangesSectionProps {
  changes: ChangeInfo[];
  onOpenChange?: (changeName: string) => void;
  onRequestNewChange?: () => void;
  onCopyFf?: (changeName: string) => void;
  onCopyApply?: (changeName: string) => void;
  onArchive?: (changeName: string) => void;
  archivedExpanded?: boolean;
  onArchivedToggle?: () => void;
  archivedItems?: ArchivedChangeInfo[];
  archivedLoading?: boolean;
  onOpenArchivedChange?: (directoryName: string) => void;
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
  archivedExpanded = false,
  onArchivedToggle,
  archivedItems = [],
  archivedLoading = false,
  onOpenArchivedChange,
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

      {onArchivedToggle && (
        <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--vscode-panel-border)' }}>
          <button
            type="button"
            className="flex items-center gap-2 w-full text-left py-1 px-0 rounded cursor-pointer border-none bg-transparent"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
            onClick={onArchivedToggle}
          >
            <span
              className="inline-block text-xs transition-transform"
              style={{ transform: archivedExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              ▶
            </span>
            <span className="text-xs font-medium">Archived</span>
            {archivedExpanded && archivedItems.length > 0 && (
              <span className="text-xs">({archivedItems.length})</span>
            )}
          </button>
          {archivedExpanded && (
            <div className="mt-2 pl-4">
              {archivedLoading ? (
                <div className="text-xs py-2" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                  Loading...
                </div>
              ) : archivedItems.length === 0 ? (
                <div className="text-xs py-2" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                  No archived changes.
                </div>
              ) : (
                <div className="space-y-2">
                  {archivedItems.map((item) => (
                    <button
                      key={item.directoryName}
                      type="button"
                      className="block w-full text-left p-2 rounded cursor-pointer border-none text-xs"
                      style={{
                        background: 'var(--vscode-input-background)',
                        color: 'var(--vscode-foreground)',
                      }}
                      onClick={() => onOpenArchivedChange?.(item.directoryName)}
                    >
                      <span className="font-medium">{item.name}</span>
                      {item.archiveDate && (
                        <span className="ml-2" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                          {item.archiveDate}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
