import React from 'react';
import { t } from '../../i18n';
import type { WorksetView } from '../types/messages';

export interface WorksetsPageProps {
  worksets?: WorksetView[];
  onOpenWorkset: (name: string) => void;
  onRemoveWorkset: (name: string) => void;
  onBack: () => void;
  currentRootLabel?: string;
  /**
   * Whether the resolved OpenSpec runtime supports workset commands. When
   * explicitly `false`, open/remove actions are hidden and a concise upgrade
   * explanation is shown instead. `undefined` is treated as supported to keep
   * legacy/unknown runtimes permissive (capabilities are optional).
   */
  worksetsSupported?: boolean;
  /**
   * Registered store root paths, used to classify workset members. A member
   * whose normalized path matches one of these roots is labeled `Store root`.
   * Normalization ignores casing and trailing slashes; unmatched members are
   * treated as project folders/repos.
   */
  storeRootPaths?: string[];
}

/**
 * Normalize a filesystem path for case- and trailing-slash-insensitive
 * comparison. Absolute paths from the CLI are compared as-is (lowercased,
 * trailing slashes trimmed); symlinks cannot be resolved in the webview, so a
 * non-matching member falls back to the project label rather than risk a
 * false store-root classification.
 */
function normalizePath(path: string): string {
  return path.toLowerCase().replace(/\/+$/, '');
}

export const WorksetsPage: React.FC<WorksetsPageProps> = ({
  worksets = [],
  onOpenWorkset,
  onRemoveWorkset,
  onBack,
  currentRootLabel,
  worksetsSupported = true,
  storeRootPaths = [],
}) => {
  const normalizedStoreRoots = storeRootPaths.map(normalizePath);
  const worksetsUnavailable = worksetsSupported === false;

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2 flex-wrap">
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

      {worksetsUnavailable ? (
        // Workset commands are unsupported on this runtime: hide open/remove
        // actions (they cannot be enabled actionable controls) and surface a
        // concise upgrade explanation. Empty-state copy is NOT shown here
        // because that would imply the root has no worksets rather than the
        // feature being unavailable.
        <p
          className="text-xs"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          {t('scope.featureGated.upgradeNotice')}
        </p>
      ) : worksets.length === 0 ? (
        <p
          className="text-xs"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          {t('worksetsPage.empty')}
        </p>
      ) : (
        <div className="space-y-2">
          {worksets.map((workset) => {
            const memberCount = workset.members.length;
            return (
              <div
                key={workset.name}
                className="rounded border p-2"
                style={{ borderColor: 'var(--vscode-panel-border)' }}
              >
                {/* Header: primary title (workset name) + secondary metadata
                    (tool, member count) + grouped card actions (Open, Remove). */}
                <div className="mb-1 flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-semibold text-sm" style={{ color: 'var(--vscode-foreground)' }}>
                      {workset.name}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
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
                          count: String(memberCount),
                        })}
                      </span>
                    </div>
                  </div>
                  {/* Grouped card actions: Open is the primary workspace-launch
                      action; Remove is a secondary/destructive treatment that
                      does not compete with Open. */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      data-action="open-workset"
                      onClick={() => onOpenWorkset(workset.name)}
                      aria-label={t('worksetsPage.open', { name: workset.name })}
                      title={t('worksetsPage.open', { name: workset.name })}
                      className="rounded px-2 py-0.5 text-xs"
                      style={{
                        background: 'var(--vscode-button-background)',
                        color: 'var(--vscode-button-foreground)',
                      }}
                    >
                      {t('worksetsPage.open')}
                    </button>
                    <button
                      type="button"
                      data-action="remove-workset"
                      onClick={() => onRemoveWorkset(workset.name)}
                      className="rounded px-2 py-0.5 text-xs"
                      style={{
                        background: 'var(--vscode-button-secondaryBackground)',
                        color: 'var(--vscode-button-secondaryForeground)',
                      }}
                    >
                      {t('worksetsPage.remove')}
                    </button>
                  </div>
                </div>

                {memberCount > 0 && (
                  <div className="space-y-0.5">
                    {workset.members.map((member, index) => {
                      const isPrimary = index === 0;
                      const isStoreRoot = normalizedStoreRoots.includes(
                        normalizePath(member.path),
                      );
                      return (
                        <div
                          key={`${member.name}-${index}`}
                          className="flex items-center gap-2 text-xs flex-wrap"
                        >
                          {/* Member type badges: Primary is positional (first
                              member); Store root is path-derived. The first
                              member can carry both badges when it also matches
                              a store root. Other members fall back to Project. */}
                          {isPrimary ? (
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
                          {isStoreRoot ? (
                            <span
                              className="rounded px-1 py-0.5 text-xs font-medium"
                              style={{
                                background: 'var(--vscode-badge-background)',
                                color: 'var(--vscode-badge-foreground)',
                              }}
                            >
                              {t('worksetsPage.memberTypeStoreRoot')}
                            </span>
                          ) : null}
                          {!isPrimary && !isStoreRoot ? (
                            <span
                              className="rounded px-1 py-0.5 text-xs font-medium"
                              style={{
                                border: '1px solid var(--vscode-panel-border)',
                                color: 'var(--vscode-descriptionForeground)',
                              }}
                            >
                              {t('worksetsPage.memberTypeProject')}
                            </span>
                          ) : null}
                          <span className="font-medium">{member.name}</span>
                          {/* Full path remains inspectable through a tooltip so
                              long paths stay readable in narrow sidebars. */}
                          <span
                            className="truncate"
                            title={member.path}
                            style={{ color: 'var(--vscode-descriptionForeground)' }}
                          >
                            {member.path}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
