import React from 'react';

export interface WorksetView {
  name: string;
  tool?: string;
  members: { name: string; path: string }[];
}

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
        Worksets
      </h2>
      <p
        className="text-xs mb-2"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
      >
        Local personal views for opening folders together.
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
