import React from 'react';
import { t } from '../../i18n';
import type { LoadingReason, OpenSpecScopeView } from '../types/messages';
import type { DashboardActivity } from '../context/AppContext';
import { formatOpenSpecRootLabel } from '../utils/scopeLabels';

export interface HeaderProps {
  onRefresh: () => void;
  onNewChange?: () => void;
  loading: boolean;
  // Primary action rail also owns OpenSpec root context so users can choose the
  // planning root next to Refresh/New Change rather than in CLI/cache status.
  scope?: OpenSpecScopeView;
  scopes?: OpenSpecScopeView[];
  loadingReason?: LoadingReason;
  activity?: DashboardActivity;
  pendingScopeId?: string;
  onSelectScope?: (scopeId: string) => void;
  onRegisterStore?: () => void;
  onSetupStore?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onRefresh,
  onNewChange,
  loading,
  scope,
  scopes = [],
  loadingReason,
  activity,
  onSelectScope,
  onRegisterStore,
  onSetupStore,
}) => {
  const showSelector = scope && scopes.length > 1 && onSelectScope;
  const projectScopes = scopes.filter((s) => s.source === 'local' || s.source === 'declared');
  const storeScopes = scopes.filter((s) => s.source === 'store');
  const storeFeaturesAvailable = scope?.capabilities?.stores === true;

  // Disable root actions during any in-flight scope/store operation so the
  // selector reflects the pending state (preserved from the old ScopeBar logic).
  // The textual status indicator itself stays in the CLI/cache status bar to
  // avoid duplicating it across both the rail and the status row.
  const disableScopeActions =
    activity?.kind === 'scope-switch' ||
    activity?.kind === 'scope-action' ||
    loadingReason === 'scope-switch' ||
    loadingReason === 'store-register' ||
    loadingReason === 'store-setup' ||
    (loading && !activity && !loadingReason);

  return (
    <div className="mb-4 pb-3 border-b" style={{
      borderColor: 'var(--vscode-panel-border)'
    }}>
      <h1 className="text-xl font-bold mb-2" style={{
        color: 'var(--vscode-textLink-foreground)'
      }}>
        OpenSpec
      </h1>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-1 text-xs rounded"
          style={{
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? `⟳ ${t('header.loading')}` : `⟳ ${t('header.refresh')}`}
        </button>
        {onNewChange && (
          <button
            onClick={onNewChange}
            className="px-3 py-1 text-xs rounded"
            style={{
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
              cursor: 'pointer',
            }}
          >
            {t('header.newChange')}
          </button>
        )}

        {/* Root selector: visually grouped with Refresh/New Change, not cache status.
            On narrow sidebar widths, this wraps to a second row. */}
        {scope && (
          <div className="flex min-w-0 flex-wrap items-center gap-2" aria-label="OpenSpec root context">
            {showSelector ? (
              <select
                disabled={disableScopeActions}
                value={scope.id}
                onChange={(event) => onSelectScope?.(event.currentTarget.value)}
                aria-label={t('scope.root.selectorLabel')}
                className="min-w-0 max-w-[60%] truncate rounded border px-1 py-0.5 text-xs"
                style={{
                  borderColor: 'var(--vscode-dropdown-border)',
                  background: 'var(--vscode-dropdown-background)',
                  color: 'var(--vscode-dropdown-foreground)',
                }}
              >
                {projectScopes.length > 0 && (
                  <optgroup label={t('scope.group.projects')}>
                    {projectScopes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatOpenSpecRootLabel(item)}
                      </option>
                    ))}
                  </optgroup>
                )}
                {storeScopes.length > 0 && (
                  <optgroup label={t('scope.group.stores')}>
                    {storeScopes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatOpenSpecRootLabel(item)}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            ) : (
              <strong className="min-w-0 truncate text-xs">{formatOpenSpecRootLabel(scope)}</strong>
            )}

            {/* Lightweight Register/Create store actions live in the action rail
                so Local Root users can connect to store planning without first
                discovering the lower maintenance panel. */}
            {storeFeaturesAvailable && onRegisterStore && (
              <button
                type="button"
                onClick={onRegisterStore}
                disabled={disableScopeActions}
                className="rounded px-2 py-0.5 text-xs"
                style={{
                  background: 'var(--vscode-button-secondaryBackground)',
                  color: 'var(--vscode-button-secondaryForeground)',
                  opacity: disableScopeActions ? 0.6 : 1,
                  cursor: disableScopeActions ? 'not-allowed' : 'pointer',
                }}
              >
                {t('scope.action.registerStore')}
              </button>
            )}
            {storeFeaturesAvailable && onSetupStore && (
              <button
                type="button"
                onClick={onSetupStore}
                disabled={disableScopeActions}
                className="rounded px-2 py-0.5 text-xs"
                style={{
                  background: 'var(--vscode-button-secondaryBackground)',
                  color: 'var(--vscode-button-secondaryForeground)',
                  opacity: disableScopeActions ? 0.6 : 1,
                  cursor: disableScopeActions ? 'not-allowed' : 'pointer',
                }}
              >
                {t('scope.action.setupStore')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
