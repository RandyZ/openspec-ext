import React from 'react';
import { t } from '../../i18n';
import type { ProjectWorksetNavigationData, WorksetNavigationMember } from '../types/messages';

export interface WorksetProjectPickerProps {
  navigation: ProjectWorksetNavigationData;
  onSelectProject: (worksetName: string, memberPath: string) => void;
  onOpenWorkset: (name: string) => void;
  onBackToCurrentProject: () => void;
}

function isCurrentProject(navigation: ProjectWorksetNavigationData, member: WorksetNavigationMember): boolean {
  return member.project?.id === navigation.project.id || member.path === navigation.project.projectPath;
}

export const WorksetProjectPicker: React.FC<WorksetProjectPickerProps> = ({
  navigation,
  onSelectProject,
  onOpenWorkset,
  onBackToCurrentProject,
}) => (
  <section className="mb-6" data-workset-project-picker data-workset-picker-scene>
    <div className="mb-3 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div
          className="text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          {t('worksetNavigation.title')}
        </div>
        <h2 className="truncate text-base font-semibold" title={navigation.project.label}>
          {navigation.project.label}
        </h2>
      </div>
      <button
        type="button"
        onClick={onBackToCurrentProject}
        aria-label={t('worksetNavigation.returnCurrent')}
        title={t('worksetNavigation.returnCurrent')}
        className="shrink-0 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1"
        style={{
          background: 'var(--vscode-button-secondaryBackground)',
          color: 'var(--vscode-button-secondaryForeground)',
          outlineColor: 'var(--vscode-focusBorder)',
        }}
      >
        {t('worksetNavigation.returnCurrent')}
      </button>
    </div>

    <div className="space-y-3">
      {navigation.worksets.map((workset) => {
        const selectableProjects = workset.members.filter((member) => (
          member.role === 'project'
          && member.selectable
          && member.project
          && !isCurrentProject(navigation, member)
        ));

        return (
          <section
            key={workset.name}
            className="rounded border p-2"
            style={{ borderColor: 'var(--vscode-panel-border)' }}
            aria-labelledby={`workset-${workset.name}`}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3
                  id={`workset-${workset.name}`}
                  className="truncate text-sm font-semibold"
                  title={workset.name}
                >
                  {workset.name}
                </h3>
                {workset.tool && (
                  <div className="truncate text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                    {workset.tool}
                  </div>
                )}
              </div>
              <button
                type="button"
                data-action="open-workset"
                onClick={() => onOpenWorkset(workset.name)}
                aria-label={t('worksetsPage.openWholeWorkset', { name: workset.name })}
                title={t('worksetsPage.openWholeWorkset', { name: workset.name })}
                className="shrink-0 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1"
                style={{
                  background: 'var(--vscode-button-background)',
                  color: 'var(--vscode-button-foreground)',
                  outlineColor: 'var(--vscode-focusBorder)',
                }}
              >
                {t('worksetsPage.openWholeWorksetShort')}
              </button>
            </div>

            <div className="space-y-1">
              {workset.members.map((member) => {
                const current = member.role === 'project' && isCurrentProject(navigation, member);
                const selectable = member.role === 'project'
                  && member.selectable
                  && Boolean(member.project)
                  && !current;

                if (selectable) {
                  return (
                    <button
                      key={`${workset.name}:${member.path}`}
                      type="button"
                      data-workset-project={member.path}
                      onClick={() => onSelectProject(workset.name, member.path)}
                      aria-label={t('worksetNavigation.switchProject', { name: member.name })}
                      title={member.path}
                      className="flex w-full min-w-0 items-start justify-between gap-2 rounded px-2 py-1 text-left text-xs focus:outline-none focus:ring-1"
                      style={{
                        background: 'var(--vscode-button-secondaryBackground)',
                        color: 'var(--vscode-button-secondaryForeground)',
                        outlineColor: 'var(--vscode-focusBorder)',
                      }}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{member.name}</span>
                        {member.git?.branch && (
                          <span
                            className="truncate text-[10px]"
                            title={member.git.repository ?? member.git.branch}
                            style={{ color: 'var(--vscode-descriptionForeground)' }}
                          >
                            {member.git.branch}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0">{t('worksetNavigation.switchProjectShort')}</span>
                    </button>
                  );
                }

                return (
                  <div
                    key={`${workset.name}:${member.path}`}
                    data-workset-store={member.role === 'store' ? member.storeId : undefined}
                    className="flex min-w-0 items-start justify-between gap-2 px-2 py-1 text-xs"
                    title={member.path}
                    style={{ color: 'var(--vscode-descriptionForeground)' }}
                  >
                    <span className="min-w-0 truncate">
                      {member.name}
                      {member.git?.branch ? ` · ${member.git.branch}` : ''}
                    </span>
                    <span className="shrink-0">
                      {member.role === 'store'
                        ? t('worksetNavigation.planningStore')
                        : current
                          ? t('worksetNavigation.current')
                          : t('worksetNavigation.unavailable')}
                    </span>
                  </div>
                );
              })}
            </div>

            {selectableProjects.length === 0 && (
              <p className="mt-2 text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                {t('worksetNavigation.noSelectableProjects')}
              </p>
            )}
          </section>
        );
      })}
    </div>
  </section>
);
