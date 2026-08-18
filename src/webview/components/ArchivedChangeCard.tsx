import React from 'react';
import type { ArchivedChangeInfo } from '../types/messages';
import { t } from '../../i18n';

export interface ArchivedChangeCardProps {
  archive: ArchivedChangeInfo;
  onOpen?: (directoryName: string) => void;
}

export const ArchivedChangeCard: React.FC<ArchivedChangeCardProps> = ({ archive, onOpen }) => {
  const label = archive.archiveDate
    ? `${archive.name} (${archive.archiveDate})`
    : archive.name;

  return (
    <button
      type="button"
      data-archived-card
      data-readonly="true"
      aria-label={t('dashboard.openArchivedChange', { name: archive.name })}
      title={t('dashboard.archivedReadOnlyHint')}
      className="block w-full text-left p-3 rounded cursor-pointer focus:outline-none focus:ring-1"
      style={{
        background: 'var(--vscode-input-background)',
        color: 'var(--vscode-foreground)',
        border: '1px solid var(--vscode-panel-border)',
        opacity: 0.85,
        outlineColor: 'var(--vscode-focusBorder)',
      }}
      onClick={() => onOpen?.(archive.directoryName)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm">{archive.name}</span>
        <span
          className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded"
          style={{
            background: 'var(--vscode-badge-background)',
            color: 'var(--vscode-badge-foreground)',
          }}
        >
          {t('dashboard.lifecycleArchived')}
        </span>
      </div>
      {archive.archiveDate && (
        <div className="text-xs mt-1" style={{ color: 'var(--vscode-descriptionForeground)' }}>
          {archive.archiveDate}
        </div>
      )}
      <div className="text-[11px] mt-2" style={{ color: 'var(--vscode-descriptionForeground)' }}>
        {t('dashboard.archivedReadOnlyHint')}
      </div>
      <span className="sr-only">{label}</span>
    </button>
  );
};
