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
  onSelectStore,
  onRegisterStore,
  onSetupStore,
  onOpenWorkset,
  onOpenWorksetsPage,
  onCopyFetch,
}) => {
  const stores = scopes.filter((scope) => scope.source === 'store');

  return (
    <section className="mb-6 border-t pt-4" style={{ borderColor: 'var(--vscode-panel-border)' }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold" style={{ color: 'var(--vscode-foreground)' }}>
          {t('storesWorksets.title')}
        </h2>
        <div className="flex gap-1">
          <button type="button" disabled={pending} onClick={onRegisterStore} className="rounded px-2 py-1 text-xs">
            {t('scope.action.registerStore')}
          </button>
          <button type="button" disabled={pending} onClick={onSetupStore} className="rounded px-2 py-1 text-xs">
            {t('scope.action.setupStore')}
          </button>
        </div>
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <h3 className="mb-1 font-medium">{t('storesWorksets.stores')}</h3>
          {stores.length === 0 ? (
            <p style={{ color: 'var(--vscode-descriptionForeground)' }}>{t('storesWorksets.noStores')}</p>
          ) : (
            <div className="space-y-1">
              {stores.map((store) => (
                <div key={store.id} className="rounded border p-2" style={{ borderColor: 'var(--vscode-panel-border)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{formatOpenSpecRootLabel(store)}</span>
                    <button
                      type="button"
                      disabled={pending || currentScopeId === store.id}
                      onClick={() => onSelectStore(store.id)}
                      className="rounded px-2 py-0.5 text-xs"
                    >
                      {t('storesWorksets.openStore')}
                    </button>
                  </div>
                  <div className="mt-1 truncate" title={store.rootPath} style={{ color: 'var(--vscode-descriptionForeground)' }}>
                    {store.rootPath}
                  </div>
                </div>
              ))}
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
      </div>
    </section>
  );
};
