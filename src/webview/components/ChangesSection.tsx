import React, { useEffect, useMemo, useReducer } from 'react';
import type { ChangeStatusCounts } from '../../shared/changeLifecycle';
import { ChangeInfo, ArchivedChangeInfo } from '../types/messages';
import { ChangeCard } from './ChangeCard';
import { ArchivedChangeCard } from './ArchivedChangeCard';
import { EmptyState } from './EmptyState';
import { ChangeStatusFilter, type LifecycleFilterValue } from './ChangeStatusFilter';
import { ChangeAdvancedFilters } from './ChangeAdvancedFilters';
import { ChangePagination } from './ChangePagination';
import { buildChangeListItems } from '../types/changeList';
import { buildVisibleChangePage } from '../utils/changeListPipeline';
import {
  changesViewReducer,
  DEFAULT_CHANGES_VIEW_STATE,
  maybeClampChangesViewPage,
  type ChangesViewAction,
  type ChangesViewState,
} from '../state/changesViewState';
import { t } from '../../i18n';
import type { WorkflowAction } from '../../shared/workflowCommand';
import type { WorkflowLaunchConfigView } from '../utils/workflowLaunchLabels';

export type ChangesSectionLayout = 'wide' | 'narrow' | 'auto';

interface ChangesSectionProps {
  changes: ChangeInfo[];
  changeStatusCounts: ChangeStatusCounts;
  onOpenChange?: (changeName: string) => void;
  onRequestNewChange?: () => void;
  onCopyFf?: (changeName: string) => void;
  onCopyApply?: (changeName: string) => void;
  onLaunchWorkflow?: (action: WorkflowAction, changeName: string) => void;
  archivedItems?: ArchivedChangeInfo[];
  onOpenArchivedChange?: (directoryName: string) => void;
  workflowLaunchConfig?: WorkflowLaunchConfigView | null;
  rootLabel?: string;
  /** Controlled view state for tests / Root persistence. */
  viewState?: ChangesViewState;
  onViewStateChange?: (state: ChangesViewState) => void;
  /**
   * When false, skip persisting a clamped page (e.g. stale old-root data while
   * the selected view Root has already switched).
   */
  allowPageClamp?: boolean;
  layout?: ChangesSectionLayout;
  compact?: boolean;
}

function resolveEmptyMessage(
  state: ChangesViewState,
  rootLabel: string | undefined,
  hasDataset: boolean
): { message: string; offerCreate: boolean } {
  const hasQueryOrAttention = state.query.trim().length > 0 || state.attentionOnly;

  if (hasDataset && hasQueryOrAttention) {
    return {
      message: t('dashboard.emptySearchAndFilters'),
      offerCreate: false,
    };
  }

  switch (state.lifecycleStatus) {
    case 'planning':
      return { message: t('dashboard.emptyPlanning'), offerCreate: true };
    case 'ready-to-apply':
      return { message: t('dashboard.emptyReadyToApply'), offerCreate: true };
    case 'applying':
      return { message: t('dashboard.emptyApplying'), offerCreate: true };
    case 'ready-to-verify':
      return { message: t('dashboard.emptyReadyToVerify'), offerCreate: true };
    case 'archived':
      return {
        message: rootLabel
          ? t('dashboard.emptyArchivedInRoot', { root: rootLabel })
          : t('dashboard.emptyArchived'),
        offerCreate: false,
      };
    case 'all':
    default:
      if (!hasDataset) {
        return {
          message: rootLabel
            ? t('dashboard.emptyChangesInRoot', { root: rootLabel })
            : t('dashboard.emptyChanges'),
          offerCreate: true,
        };
      }
      return {
        message: t('dashboard.emptySearchAndFilters'),
        offerCreate: false,
      };
  }
}

export const ChangesSection: React.FC<ChangesSectionProps> = ({
  changes,
  changeStatusCounts,
  onOpenChange,
  onRequestNewChange,
  onCopyFf,
  onCopyApply,
  onLaunchWorkflow,
  archivedItems = [],
  onOpenArchivedChange,
  workflowLaunchConfig,
  rootLabel,
  viewState: controlledViewState,
  onViewStateChange,
  allowPageClamp = true,
  layout = 'auto',
  compact = false,
}) => {
  const [internalState, dispatch] = useReducer(
    changesViewReducer,
    DEFAULT_CHANGES_VIEW_STATE
  );
  const state = controlledViewState ?? internalState;

  const applyAction = (action: ChangesViewAction) => {
    if (controlledViewState) {
      onViewStateChange?.(changesViewReducer(controlledViewState, action));
      return;
    }
    dispatch(action);
  };

  const listItems = useMemo(
    () => buildChangeListItems(changes, compact ? [] : archivedItems),
    [changes, archivedItems, compact]
  );

  const pageResult = useMemo(
    () => buildVisibleChangePage(listItems, state),
    [listItems, state]
  );
  const visibleItems = compact ? listItems : pageResult.items;

  // Persist pipeline-clamped page for the matching Root without resetting filters.
  useEffect(() => {
    if (!controlledViewState || !onViewStateChange) {
      return;
    }
    const clamped = maybeClampChangesViewPage(
      controlledViewState,
      pageResult.page,
      allowPageClamp
    );
    if (clamped) {
      onViewStateChange(clamped);
    }
  }, [
    allowPageClamp,
    controlledViewState,
    onViewStateChange,
    pageResult.page,
  ]);

  const hasDataset = listItems.length > 0;
  const showWide = !compact && (layout === 'wide' || layout === 'auto');
  const showNarrow = !compact && (layout === 'narrow' || layout === 'auto');
  const isNarrowOnly = layout === 'narrow';

  const empty = compact && !hasDataset
    ? { message: t('projectSidebar.emptyActive'), offerCreate: false }
    : resolveEmptyMessage(state, rootLabel, hasDataset);

  const setLifecycle = (lifecycleStatus: LifecycleFilterValue) => {
    applyAction({ type: 'SET_LIFECYCLE_FILTER', lifecycleStatus });
  };

  return (
    <div
      className="mb-6"
      data-changes-section
      data-responsive={layout === 'auto' ? 'true' : undefined}
      style={{ containerType: 'inline-size' } as React.CSSProperties}
    >
      {!compact && layout === 'auto' && (
        <style>{`
          [data-changes-section][data-responsive] [data-layout="wide"] { display: none; }
          [data-changes-section][data-responsive] [data-layout="narrow"] { display: block; }
          @container (min-width: 420px) {
            [data-changes-section][data-responsive] [data-layout="wide"] { display: block; }
            [data-changes-section][data-responsive] [data-layout="narrow"] { display: none; }
          }
        `}</style>
      )}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h2
          className="text-base font-semibold"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          {t('dashboard.changes', { count: changeStatusCounts.all })}
        </h2>
        {onRequestNewChange && state.lifecycleStatus !== 'archived' && (
          <button
            type="button"
            className="px-2 py-1 text-xs rounded cursor-pointer border-none focus:outline-none focus:ring-1 shrink-0"
            style={{
              background: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              outlineColor: 'var(--vscode-focusBorder)',
            }}
            aria-label={t('dashboard.createNew')}
            title={t('dashboard.createNew')}
            onClick={onRequestNewChange}
          >
            {t('dashboard.createNew')}
          </button>
        )}
      </div>

      {showWide && (
        <div data-layout="wide">
          <ChangeStatusFilter
            variant="segments"
            value={state.lifecycleStatus}
            counts={changeStatusCounts}
            onChange={setLifecycle}
          />
        </div>
      )}

      {showNarrow && (
        <div data-layout="narrow">
          <ChangeStatusFilter
            variant="compact"
            value={state.lifecycleStatus}
            counts={changeStatusCounts}
            onChange={setLifecycle}
          />
        </div>
      )}

      {!compact && (hasDataset || state.query.length > 0 || state.attentionOnly) && (
        <>
          <input
            type="search"
            value={state.query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              applyAction({ type: 'SET_QUERY', query: e.target.value })
            }
            placeholder={t('dashboard.searchPlaceholder')}
            aria-label={t('dashboard.searchLabel')}
            title={t('dashboard.searchLabel')}
            className="w-full mb-3 px-2 py-1.5 text-xs rounded focus:outline-none focus:ring-1"
            style={{
              background: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              border: '1px solid var(--vscode-input-border)',
              outlineColor: 'var(--vscode-focusBorder)',
            }}
          />
          <ChangeAdvancedFilters
            sort={state.sort}
            attentionOnly={state.attentionOnly}
            needsAttentionCount={changeStatusCounts.needsAttention}
            compact={isNarrowOnly}
            onSortChange={(sort) => applyAction({ type: 'SET_SORT', sort })}
            onAttentionChange={(attentionOnly) =>
              applyAction({ type: 'SET_ATTENTION_FILTER', attentionOnly })
            }
          />
        </>
      )}

      {pageResult.totalItems === 0 ? (
        <EmptyState
          message={empty.message}
          actionLabel={empty.offerCreate ? t('dashboard.createNew') : undefined}
          onAction={empty.offerCreate ? onRequestNewChange : undefined}
        />
      ) : (
        <div className="space-y-2">
          {visibleItems.map((item) =>
            item.kind === 'active' ? (
              <ChangeCard
                key={item.id}
                change={item.change}
                onClick={onOpenChange}
                onCopyFf={onCopyFf}
                onCopyApply={onCopyApply}
                onLaunchWorkflow={onLaunchWorkflow}
                workflowLaunchConfig={workflowLaunchConfig}
              />
            ) : (
              <ArchivedChangeCard
                key={item.id}
                archive={item.archive}
                onOpen={onOpenArchivedChange}
              />
            )
          )}
        </div>
      )}

      {!compact && (
        <ChangePagination
          page={pageResult.page}
          pageSize={state.pageSize}
          totalItems={pageResult.totalItems}
          totalPages={pageResult.totalPages}
          startIndex={pageResult.startIndex}
          endIndex={pageResult.endIndex}
          compact={isNarrowOnly}
          onPageChange={(page) => applyAction({ type: 'SET_PAGE', page })}
          onPageSizeChange={(pageSize) =>
            applyAction({ type: 'SET_PAGE_SIZE', pageSize })
          }
        />
      )}
    </div>
  );
};
