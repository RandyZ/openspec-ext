import React from 'react';
import { t } from '../../i18n';
import type {
  OpenSpecScopeView,
  ReferenceIndexEntryView,
  WorksetView,
} from '../types/messages';
import { formatOpenSpecRootLabel } from '../utils/scopeLabels';

export interface StoresAndWorksetsPanelProps {
  scopes?: OpenSpecScopeView[];
  currentScopeId?: string;
  references?: ReferenceIndexEntryView[];
  worksets?: WorksetView[];
  pending?: boolean;
  /**
   * Resolved feature capabilities for the current root. Stores and worksets are
   * gated independently: a control only treats its feature as unavailable when
   * the corresponding flag is explicitly `false` (undefined = unknown/legacy,
   * treated as not gated to preserve backward compatibility). When a feature is
   * explicitly unavailable, the panel surfaces a concise upgrade notice instead
   * of the unsupported control, without blocking Local Root content.
   */
  capabilities?: { stores?: boolean; worksets?: boolean };
  /**
   * When true, the panel renders nothing. This is used for plain Local Root
   * usage (no stores, no references, no workset management in progress) so the
   * Changes/Specs areas stay similar to the original single-project dashboard
   * instead of being dominated by an empty management section. Store
   * registration stays reachable from the primary action rail.
   */
  lightweight?: boolean;
  onSelectStore: (scopeId: string) => void;
  onRegisterStore: () => void;
  onSetupStore: () => void;
  onOpenWorkset: (name: string) => void;
  onOpenWorksetsPage?: () => void;
  onCopyFetch: (text: string) => void;
}

export const StoresAndWorksetsPanel: React.FC<StoresAndWorksetsPanelProps> = ({
  scopes = [],
  currentScopeId,
  references = [],
  worksets = [],
  pending = false,
  capabilities,
  lightweight = false,
  onSelectStore,
  onRegisterStore,
  onSetupStore,
  onOpenWorkset,
  onOpenWorksetsPage,
  onCopyFetch,
}) => {
  // Plain Local Root with nothing to maintain: stay lightweight and render no
  // dominant management block. Register Store remains available from the
  // primary action rail (Header), so this panel is not the only entry point.
  if (lightweight) return null;

  const stores = scopes.filter((scope) => scope.source === 'store');

  // Independent capability gating. A feature is only treated as unavailable
  // when explicitly `false`; `undefined` (legacy fixtures / unknown runtime)
  // stays permissive so existing Local Root dashboards keep their controls.
  const storesSupported = capabilities?.stores !== false;
  const worksetsSupported = capabilities?.worksets !== false;
  const showUpgradeNotice = !storesSupported || !worksetsSupported;

  return (
    <section className="mb-6 border-t pt-4" style={{ borderColor: 'var(--vscode-panel-border)' }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold" style={{ color: 'var(--vscode-foreground)' }}>
          {t('storesWorksets.title')}
        </h2>
        {storesSupported && (
          // Store registration controls are independent of workset gating and
          // are hidden (not just disabled) when stores are explicitly
          // unsupported so they cannot appear as enabled actionable controls.
          <div className="flex gap-1">
            <button type="button" disabled={pending} onClick={onRegisterStore} className="rounded px-2 py-1 text-xs">
              {t('scope.action.registerStore')}
            </button>
            <button type="button" disabled={pending} onClick={onSetupStore} className="rounded px-2 py-1 text-xs">
              {t('scope.action.setupStore')}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3 text-xs">
        {showUpgradeNotice && (
          // Concise OpenSpec 1.5.0 upgrade explanation. Surfaced only when a
          // store or workset feature is explicitly unsupported; it never blocks
          // the Local Root Changes/Specs sections (which live outside this panel).
          <div
            className="leading-snug"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
          >
            {t('scope.featureGated.upgradeNotice')}
          </div>
        )}

        <div>
          <h3 className="mb-1 font-medium">{t('storesWorksets.stores')}</h3>
          {stores.length === 0 ? (
            <p style={{ color: 'var(--vscode-descriptionForeground)' }}>{t('storesWorksets.noStores')}</p>
          ) : (
            <div className="space-y-1">
              {stores.map((store) => {
                const isCurrent = currentScopeId === store.id;
                return (
                  <div key={store.id} className="rounded border p-2" style={{ borderColor: 'var(--vscode-panel-border)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{formatOpenSpecRootLabel(store)}</span>
                      {isCurrent ? (
                        // Selected store: show a Current state indicator instead
                        // of a disabled Open button that looks broken/unavailable.
                        <span
                          className="rounded px-2 py-0.5 text-xs"
                          style={{
                            color: 'var(--vscode-descriptionForeground)',
                            border: '1px solid var(--vscode-panel-border)',
                          }}
                          aria-current="true"
                        >
                          {t('storesWorksets.currentStore')}
                        </span>
                      ) : (
                        // Inactive store: enabled Switch action that selects the
                        // store root (and triggers a root-scoped data refresh via
                        // the dashboard wiring).
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => onSelectStore(store.id)}
                          className="rounded px-2 py-0.5 text-xs"
                        >
                          {t('storesWorksets.switchStore')}
                        </button>
                      )}
                    </div>
                    <div className="mt-1 truncate" title={store.rootPath} style={{ color: 'var(--vscode-descriptionForeground)' }}>
                      {store.rootPath}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-1 font-medium">{t('storesWorksets.references')}</h3>
          <p className="mb-1" style={{ color: 'var(--vscode-descriptionForeground)' }}>
            {t('storesWorksets.referencesDescription')}
          </p>
          {references.length === 0 ? (
            <p style={{ color: 'var(--vscode-descriptionForeground)' }}>{t('storesWorksets.noReferences')}</p>
          ) : (
            references.map((ref) => (
              <div key={ref.store_id} className="rounded border p-2" style={{ borderColor: 'var(--vscode-panel-border)' }}>
                <div className="font-medium">{ref.store_id}</div>
                {(ref.specs ?? []).map((spec) => (
                  <div key={spec.id} style={{ color: 'var(--vscode-descriptionForeground)' }}>
                    {spec.id}{spec.summary ? ` - ${spec.summary}` : ''}
                  </div>
                ))}
                {ref.fetch && (
                  <button type="button" onClick={() => onCopyFetch(ref.fetch!)} className="mt-1 rounded px-2 py-0.5 text-xs">
                    {t('references.copyFetchCommand')}
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {worksetsSupported && (
          // The Worksets page entry is independent of store gating and is hidden
          // when worksets are explicitly unsupported so it cannot appear as an
          // enabled actionable control. The upgrade notice above explains why.
          <div>
            <h3 className="mb-1 font-medium">{t('storesWorksets.worksets')}</h3>
            <button
              type="button"
              onClick={onOpenWorksetsPage}
              className="block w-full rounded border px-2 py-1 text-left"
              style={{ borderColor: 'var(--vscode-panel-border)' }}
            >
              <span className="font-medium">{t('worksetsPage.openWorksets')}</span>
              {worksets.length > 0 ? (
                <span
                  className="ml-2"
                  style={{ color: 'var(--vscode-descriptionForeground)' }}
                >
                  ({worksets.length})
                </span>
              ) : null}
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
