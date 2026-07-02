import React from 'react';
import type { WorksetView } from '../types/messages';
import { t } from '../../i18n';

// ── Component ────────────────────────────────────────────────────────────────

export interface WorksetsPanelProps {
  worksets?: WorksetView[];
  onOpenWorkset: (name: string) => void;
}

export const WorksetsPanel: React.FC<WorksetsPanelProps> = ({
  worksets = [],
  onOpenWorkset,
}) => {
  if (worksets.length === 0) return null;

  return (
    <section className="mt-4">
      <h2
        className="text-base font-semibold mb-1"
        style={{ color: 'var(--vscode-foreground)' }}
      >
        {t('worksets.title')}
      </h2>
      <p
        className="text-xs mb-2"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
      >
        {t('worksets.description')}
      </p>
      <div className="space-y-1">
        {worksets.map((workset) => (
          <button
            key={workset.name}
            type="button"
            onClick={() => onOpenWorkset(workset.name)}
            className="w-full text-left rounded border px-2 py-1 text-xs"
            style={{
              borderColor: 'var(--vscode-panel-border)',
              background: 'var(--vscode-editor-background)',
              color: 'var(--vscode-foreground)',
            }}
          >
            <span className="font-medium">{workset.name}</span>
            {workset.tool ? (
              <span
                className="ml-2"
                style={{ color: 'var(--vscode-descriptionForeground)' }}
              >
                ({workset.tool})
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
};
