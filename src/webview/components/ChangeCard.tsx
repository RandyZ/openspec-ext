import React from 'react';
import { ChangeInfo } from '../types/messages';

const ArtifactBadge: React.FC<{ id: string; status: 'done' | 'ready' | 'blocked' }> = ({ id, status }) => {
  const colors = {
    done: { bg: 'rgba(76, 175, 80, 0.2)', text: '#4caf50' },
    ready: { bg: 'rgba(255, 193, 7, 0.2)', text: '#ffc107' },
    blocked: { bg: 'rgba(158, 158, 158, 0.2)', text: '#9e9e9e' },
  };
  const { bg, text } = colors[status];
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: bg, color: text }}
    >
      {id}
    </span>
  );
};

function formatLastModified(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return d.toLocaleDateString();
  } catch {
    return '';
  }
}

export interface ChangeCardProps {
  change: ChangeInfo;
  onClick?: (changeName: string) => void;
  onCopyFf?: (changeName: string) => void;
  onCopyApply?: (changeName: string) => void;
  onArchive?: (changeName: string) => void;
  onFillChat?: (command: string) => void;
}

function getSmartActions(change: ChangeInfo): { label: string; command: string }[] {
  const hasAllArtifacts = change.artifacts?.every((a) => a.status === 'done') ?? false;
  const allTasksDone = change.totalTasks > 0 && change.completedTasks === change.totalTasks;

  if (!hasAllArtifacts) {
    return [
      { label: 'Continue', command: `/opsx:continue ${change.name}` },
      { label: 'FF', command: `/opsx:ff ${change.name}` },
    ];
  }
  if (allTasksDone) {
    return [
      { label: 'Verify', command: `/opsx:verify ${change.name}` },
    ];
  }
  return [
    { label: 'Apply', command: `/opsx:apply ${change.name}` },
  ];
}

export const ChangeCard: React.FC<ChangeCardProps> = ({
  change,
  onClick,
  onCopyFf,
  onCopyApply,
  onArchive,
  onFillChat,
}) => {
  const [hover, setHover] = React.useState(false);

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-action]')) return;
    onClick?.(change.name);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className="p-3 rounded cursor-pointer transition-opacity focus:outline-none focus:ring-1 relative"
      style={{
        background: 'var(--vscode-input-background)',
        outlineColor: 'var(--vscode-focusBorder)',
      }}
      onClick={handleCardClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!(e.target as HTMLElement).closest('[data-action]')) onClick?.(change.name);
        }
      }}
    >
      <div className="font-medium text-sm mb-2">{change.name}</div>

      {change.artifacts && change.artifacts.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {change.artifacts.map((a) => (
            <ArtifactBadge key={a.id} id={a.id} status={a.status} />
          ))}
        </div>
      )}

      <div
        className="text-xs flex items-center gap-2 flex-wrap"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
      >
        <span>
          {change.completedTasks} / {change.totalTasks} tasks
        </span>
        {change.totalTasks > 0 && (
          <>
            <span>•</span>
            <span>{Math.round((change.completedTasks / change.totalTasks) * 100)}%</span>
          </>
        )}
        {change.lastModified && (
          <>
            <span>•</span>
            <span>{formatLastModified(change.lastModified)}</span>
          </>
        )}
      </div>

      {change.totalTasks > 0 && (
        <div
          className="mt-2 h-1 rounded-full overflow-hidden"
          style={{ background: 'var(--vscode-input-border)' }}
        >
          <div
            className="h-full transition-all"
            style={{
              width: `${(change.completedTasks / change.totalTasks) * 100}%`,
              background: 'var(--vscode-progressBar-background)',
            }}
          />
        </div>
      )}

      {hover && (onFillChat || onCopyFf || onCopyApply || onArchive) && (
        <div
          className="flex flex-wrap gap-1 mt-2 pt-2 border-t"
          style={{ borderColor: 'var(--vscode-panel-border)' }}
          data-action
        >
          {onFillChat && getSmartActions(change).map((action) => (
            <button
              key={action.label}
              type="button"
              data-action
              className="px-2 py-0.5 text-xs rounded cursor-pointer border-none"
              style={{
                background: 'var(--vscode-button-background)',
                color: 'var(--vscode-button-foreground)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onFillChat(action.command);
              }}
            >
              {action.label}
            </button>
          ))}
          {onArchive && change.totalTasks > 0 && change.completedTasks === change.totalTasks && (
            <button
              type="button"
              data-action
              className="px-2 py-0.5 text-xs rounded cursor-pointer border-none"
              style={{
                background: 'var(--vscode-inputValidation-warningBackground)',
                color: 'var(--vscode-editor-foreground)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onArchive(change.name);
              }}
            >
              Archive
            </button>
          )}
          {onCopyFf && (
            <button
              type="button"
              data-action
              className="px-2 py-0.5 text-xs rounded cursor-pointer border-none"
              style={{
                background: 'var(--vscode-button-secondaryBackground)',
                color: 'var(--vscode-button-secondaryForeground)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onCopyFf(change.name);
              }}
            >
              Copy /opsx:ff
            </button>
          )}
          {onCopyApply && (
            <button
              type="button"
              data-action
              className="px-2 py-0.5 text-xs rounded cursor-pointer border-none"
              style={{
                background: 'var(--vscode-button-secondaryBackground)',
                color: 'var(--vscode-button-secondaryForeground)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onCopyApply(change.name);
              }}
            >
              Copy /opsx:apply
            </button>
          )}
        </div>
      )}
    </div>
  );
};
