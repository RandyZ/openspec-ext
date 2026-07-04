import React from 'react';
import { t } from '../../i18n';
import type { WorksetView } from '../types/messages';

export interface WorksetsPageProps {
  worksets?: WorksetView[];
  onOpenWorkset: (name: string) => void;
  onBack: () => void;
  currentRootLabel?: string;
}

export const WorksetsPage: React.FC<WorksetsPageProps> = ({
  worksets = [],
  onOpenWorkset,
  onBack,
  currentRootLabel,
}) => {
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded px-2 py-1 text-xs"
          style={{
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
          }}
        >
          ← {t('worksetsPage.back')}
        </button>
        <h2 className="text-base font-semibold" style={{ color: 'var(--vscode-foreground)' }}>
          {t('worksetsPage.title')}
        </h2>
      </div>

      <p
        className="mb-2 text-xs"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
      >
        {t('worksetsPage.description')}
      </p>

      {currentRootLabel && (
        <p
          className="mb-3 text-xs"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          {t('worksetsPage.currentRoot', { root: currentRootLabel })}
        </p>
      )}

      {worksets.length === 0 ? (
        <p
          className="text-xs"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          {t('worksetsPage.empty')}
        </p>
      ) : (
        <div className="space-y-2">
          {worksets.map((workset) => (
            <div
              key={workset.name}
              className="rounded border p-2"
              style={{ borderColor: 'var(--vscode-panel-border)' }}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium">{workset.name}</span>
                  {workset.tool ? (
                    <span
                      className="text-xs"
                      style={{ color: 'var(--vscode-descriptionForeground)' }}
                    >
                      {workset.tool}
                    </span>
                  ) : null}
                  <span
                    className="text-xs"
                    style={{ color: 'var(--vscode-descriptionForeground)' }}
                  >
                    {t('worksetsPage.memberCount', {
                      count: String(workset.members.length),
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenWorkset(workset.name)}
                  className="rounded px-2 py-0.5 text-xs"
                  style={{
                    background: 'var(--vscode-button-background)',
                    color: 'var(--vscode-button-foreground)',
                  }}
                >
                  {t('worksetsPage.open')}
                </button>
              </div>

              {workset.members.length > 0 && (
                <div className="space-y-0.5">
                  {workset.members.map((member, index) => (
                    <div
                      key={`${member.name}-${index}`}
                      className="flex items-center gap-2 text-xs"
                    >
                      {index === 0 ? (
                        <span
                          className="rounded px-1 py-0.5 text-xs font-medium"
                          style={{
                            background: 'var(--vscode-badge-background)',
                            color: 'var(--vscode-badge-foreground)',
                          }}
                        >
                          {t('worksetsPage.primaryMember')}
                        </span>
                      ) : null}
                      <span className="font-medium">{member.name}</span>
                      <span
                        className="truncate"
                        title={member.path}
                        style={{ color: 'var(--vscode-descriptionForeground)' }}
                      >
                        {member.path}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
