import React, { useEffect, useRef, useState } from 'react';
import type { CacheAction, CacheStatsView, LoadingReason, OpenSpecScopeView } from '../types/messages';
import type { DashboardActivity } from '../context/AppContext';
import { t } from '../../i18n';
import { formatOpenSpecRootLabel } from '../utils/scopeLabels';

// ── Helpers ──────────────────────────────────────────────────────────────────

function runtimeLabel(source: OpenSpecScopeView['runtimeSource']): string {
  if (source === 'localSource') return t('cli.runtime.localSource');
  if (source === 'customPath') return t('cli.runtime.customPath');
  return t('cli.runtime.installed');
}

function healthLabel(status: 'ok' | 'warning' | 'unavailable'): string {
  if (status === 'ok') return t('scope.health.ok');
  if (status === 'warning') return t('scope.health.warning');
  return t('scope.health.unavailable');
}

function healthColor(status: 'ok' | 'warning' | 'unavailable'): string {
  if (status === 'ok') return 'var(--vscode-testing-iconPassed)';
  if (status === 'warning') return 'var(--vscode-testing-iconQueued)';
  return 'var(--vscode-testing-iconFailed)';
}

function reasonLabel(reason?: LoadingReason): string | undefined {
  if (reason === 'scope-switch') return t('scope.switching');
  if (reason === 'store-register') return t('scope.registeringStore');
  if (reason === 'store-setup') return t('scope.settingUpStore');
  if (reason === 'refresh') return t('dashboard.refreshing');
  if (reason === 'background-refresh') return t('dashboard.staleData');
  return undefined;
}

function activityLabel(activity?: DashboardActivity, fallbackReason?: LoadingReason): string | undefined {
  if (!activity || activity.kind === 'idle') return reasonLabel(fallbackReason);
  if (activity.kind === 'cached-refresh') return t('dashboard.staleData');
  if (activity.kind === 'manual-refresh') return t('dashboard.refreshing');
  if (activity.kind === 'warning') return activity.message;
  if (activity.kind === 'scope-action') {
    return activity.action === 'register' ? t('scope.registeringStore') : t('scope.settingUpStore');
  }
  return t('scope.switching');
}

function cacheSummary(stats?: CacheStatsView | null): string {
  if (!stats) return t('cache.statsUnavailable');
  if (stats.isCalculating) return t('cache.statsCalculating');
  if (stats.error) return t('cache.statsUnavailable');
  return t('cache.summary', {
    size: stats.formattedSize,
    files: String(stats.fileCount),
  });
}

// ── Component ────────────────────────────────────────────────────────────────
//
// ScopeBar is now strictly the CLI/cache status row. Root selection has moved
// into the primary action rail (Header) so the selected OpenSpec root stays
// visually associated with Refresh/New Change rather than with cache status.
// This component keeps the runtime label, current root label (read-only),
// health, activity/status, cache menu, and store availability hints.

export interface ScopeBarProps {
  scope?: OpenSpecScopeView;
  scopes?: OpenSpecScopeView[];
  health?: { status: 'ok' | 'warning' | 'unavailable'; label: string };
  loading: boolean;
  loadingReason?: LoadingReason;
  pendingScopeId?: string;
  activity?: DashboardActivity;
  cacheStats?: CacheStatsView | null;
  cacheActionMessage?: string | null;
  pendingCacheAction?: CacheAction | null;
  onSelectScope?: (scopeId: string) => void;
  onRegisterStore?: () => void;
  onSetupStore?: () => void;
  onCacheAction?: (action: CacheAction) => void;
}

export const ScopeBar: React.FC<ScopeBarProps> = ({
  scope,
  scopes = [],
  health,
  loading,
  loadingReason,
  activity,
  cacheStats,
  cacheActionMessage,
  pendingCacheAction = null,
  onCacheAction,
}) => {
  const [cacheMenuOpen, setCacheMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Reset the cache menu whenever the selected scope changes.
  useEffect(() => {
    setCacheMenuOpen(false);
  }, [scope?.id]);

  // Close on Escape / outside pointerdown, and manage focus while the menu is open.
  useEffect(() => {
    if (!cacheMenuOpen) return;
    const menuEl = menuRef.current;
    // Move focus to the first menuitem when opening.
    const firstItem = menuEl?.querySelector<HTMLButtonElement>('button[role="menuitem"]');
    firstItem?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      if (menuEl && event.target instanceof Node && !menuEl.contains(event.target)) {
        setCacheMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCacheMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [cacheMenuOpen]);

  if (!scope) return null;

  const storeFeaturesAvailable = scope.capabilities?.stores === true;
  const storeFeaturesUnavailable = scope.capabilities?.stores === false;
  const showNoStoresHint = storeFeaturesAvailable && scopes.every((item) => item.source !== 'store');
  const showStoreUnavailableHint = storeFeaturesUnavailable;
  const statusLabel = activityLabel(activity, loadingReason);
  const showStatusLabel = Boolean(statusLabel) && (loading || activity?.kind === 'warning');
  const showSpinner = loading && activity?.kind !== 'warning';
  const disableScopeActions =
    activity?.kind === 'scope-switch' ||
    activity?.kind === 'scope-action' ||
    loadingReason === 'scope-switch' ||
    loadingReason === 'store-register' ||
    loadingReason === 'store-setup' ||
    (loading && !activity && !loadingReason);
  const cacheText = cacheSummary(cacheStats);
  const cacheLabel = cacheStats && !cacheStats.isCalculating && !cacheStats.error
    ? `${t('cache.label')} ${cacheText}`
    : cacheText;
  const cacheActionDisabled = !onCacheAction || disableScopeActions || pendingCacheAction !== null;
  const runCacheAction = (action: CacheAction) => {
    if (!cacheActionDisabled) {
      onCacheAction?.(action);
    }
  };
  const cacheActions: CacheAction[] = ['openFolder', 'copyPath', 'clear', 'showDetails'];

  return (
    <section
      className="mb-3 border-y py-2 text-xs"
      style={{
        borderColor: 'var(--vscode-panel-border)',
      }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className="min-w-0 truncate"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          {runtimeLabel(scope.runtimeSource)}
        </span>

        <strong className="min-w-0 truncate">{formatOpenSpecRootLabel(scope)}</strong>

        {health && (
          <span
            className="inline-flex min-w-0 items-center gap-1 truncate"
            style={{ color: healthColor(health.status) }}
            title={health.label}
          >
            ● {healthLabel(health.status)}
          </span>
        )}

        {showStatusLabel && (
          <span
            role="status"
            aria-live="polite"
            className="inline-flex items-center gap-1"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
          >
            {showSpinner && (
              <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
            )}
            {statusLabel}
          </span>
        )}

        <div className="relative min-w-0">
          <button
            ref={triggerRef}
            type="button"
            aria-label={t('cache.menuLabel')}
            aria-haspopup="menu"
            aria-expanded={cacheMenuOpen}
            title={cacheText}
            disabled={cacheActionDisabled}
            onClick={() => setCacheMenuOpen((open) => !open)}
            className="max-w-full truncate border-none bg-transparent p-0 text-left text-xs"
            style={{
              color: 'var(--vscode-foreground)',
              opacity: cacheActionDisabled ? 0.6 : 1,
            }}
          >
            {cacheLabel}
          </button>

          {cacheMenuOpen && (
            <div
              ref={menuRef}
              role="menu"
              className="absolute left-0 z-10 mt-1 min-w-36 rounded border p-1 shadow-lg"
              style={{
                borderColor: 'var(--vscode-panel-border)',
                background: 'var(--vscode-menu-background)',
                color: 'var(--vscode-menu-foreground)',
              }}
            >
              {cacheActions.map((action) => {
                const label = action === 'openFolder'
                  ? t('cache.openFolder')
                  : action === 'copyPath'
                    ? t('cache.copyPath')
                    : action === 'clear'
                      ? t('cache.clear')
                      : t('cache.showDetails');

                return (
                  <button
                    key={action}
                    type="button"
                    role="menuitem"
                    aria-label={label}
                    title={label}
                    disabled={cacheActionDisabled}
                    onClick={() => {
                      setCacheMenuOpen(false);
                      runCacheAction(action);
                    }}
                    className="block w-full rounded px-2 py-1 text-left text-xs"
                    style={{
                      background: 'transparent',
                      color: 'var(--vscode-menu-foreground)',
                      opacity: cacheActionDisabled ? 0.6 : 1,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {cacheActionMessage && (
          <span
            role="status"
            aria-live="polite"
            className="min-w-0 truncate"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
            title={cacheActionMessage}
          >
            {cacheActionMessage}
          </span>
        )}
      </div>

      {(showNoStoresHint || showStoreUnavailableHint) && (
        <div
          className="mt-2 leading-snug"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          <div className="font-medium">
            {showNoStoresHint ? t('scope.noStoresRegistered') : t('scope.storeUnavailable')}
          </div>
          <div>
            {showNoStoresHint ? t('scope.noStoresHint') : t('scope.storeUnavailableHint')}
          </div>
        </div>
      )}
    </section>
  );
};
