import React, { useState } from 'react';
import type { ChangeSort } from '../state/changesViewState';
import { t } from '../../i18n';

const SORT_OPTIONS: Array<{
  value: ChangeSort;
  labelKey:
    | 'dashboard.sortUpdatedDesc'
    | 'dashboard.sortUpdatedAsc'
    | 'dashboard.sortCreatedDesc'
    | 'dashboard.sortNameAsc';
}> = [
  { value: 'updated-desc', labelKey: 'dashboard.sortUpdatedDesc' },
  { value: 'updated-asc', labelKey: 'dashboard.sortUpdatedAsc' },
  { value: 'created-desc', labelKey: 'dashboard.sortCreatedDesc' },
  { value: 'name-asc', labelKey: 'dashboard.sortNameAsc' },
];

export interface ChangeAdvancedFiltersProps {
  sort: ChangeSort;
  attentionOnly: boolean;
  needsAttentionCount: number;
  onSortChange: (sort: ChangeSort) => void;
  onAttentionChange: (attentionOnly: boolean) => void;
  compact?: boolean;
}

export const ChangeAdvancedFilters: React.FC<ChangeAdvancedFiltersProps> = ({
  sort,
  attentionOnly,
  needsAttentionCount,
  onSortChange,
  onAttentionChange,
  compact = false,
}) => {
  const [moreOpen, setMoreOpen] = useState(attentionOnly);
  const sortLabel = t('dashboard.sortLabel');
  const attentionLabel = t('dashboard.needsAttention');
  const attentionFilterLabel = t('dashboard.needsAttentionFilterLabel');

  const sortControl = (
    <select
      value={sort}
      aria-label={sortLabel}
      title={sortLabel}
      className={`px-2 py-1.5 text-xs rounded focus:outline-none focus:ring-1 ${compact ? 'flex-1 min-w-0' : ''}`}
      style={{
        background: 'var(--vscode-dropdown-background)',
        color: 'var(--vscode-dropdown-foreground)',
        border: '1px solid var(--vscode-dropdown-border, var(--vscode-input-border))',
        outlineColor: 'var(--vscode-focusBorder)',
      }}
      onChange={(e) => onSortChange(e.target.value as ChangeSort)}
    >
      {SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {t(option.labelKey)}
        </option>
      ))}
    </select>
  );

  const attentionControl = (
    <button
      type="button"
      aria-pressed={attentionOnly}
      aria-label={attentionFilterLabel}
      title={`${attentionLabel} (${needsAttentionCount})`}
      className="px-2 py-1.5 text-xs rounded cursor-pointer focus:outline-none focus:ring-1"
      style={{
        background: attentionOnly
          ? 'var(--vscode-button-background)'
          : 'var(--vscode-input-background)',
        color: attentionOnly
          ? 'var(--vscode-button-foreground)'
          : 'var(--vscode-foreground)',
        border: '1px solid var(--vscode-input-border)',
        outlineColor: 'var(--vscode-focusBorder)',
      }}
      onClick={() => onAttentionChange(!attentionOnly)}
    >
      {attentionLabel} ({needsAttentionCount})
    </button>
  );

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1 mb-3">
        {sortControl}
        <button
          type="button"
          aria-expanded={moreOpen || attentionOnly}
          aria-label={t('dashboard.moreFilters')}
          title={t('dashboard.moreFilters')}
          className="px-2 py-1.5 text-xs rounded cursor-pointer focus:outline-none focus:ring-1"
          style={{
            background:
              moreOpen || attentionOnly
                ? 'var(--vscode-button-secondaryBackground)'
                : 'var(--vscode-input-background)',
            color: 'var(--vscode-foreground)',
            border: '1px solid var(--vscode-input-border)',
            outlineColor: 'var(--vscode-focusBorder)',
          }}
          onClick={() => setMoreOpen((open) => !open)}
        >
          {t('dashboard.moreFilters')}
        </button>
        {(moreOpen || attentionOnly) && (
          <div className="w-full basis-full mt-1">{attentionControl}</div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      {sortControl}
      <button
        type="button"
        aria-expanded={true}
        aria-label={t('dashboard.moreFilters')}
        title={t('dashboard.moreFilters')}
        className="px-2 py-1.5 text-xs rounded cursor-pointer focus:outline-none focus:ring-1"
        style={{
          background: 'var(--vscode-input-background)',
          color: 'var(--vscode-foreground)',
          border: '1px solid var(--vscode-input-border)',
          outlineColor: 'var(--vscode-focusBorder)',
        }}
      >
        {t('dashboard.moreFilters')}
      </button>
      {/* Advanced filter: Needs Attention is combinable, not a lifecycle segment. */}
      {attentionControl}
    </div>
  );
};
