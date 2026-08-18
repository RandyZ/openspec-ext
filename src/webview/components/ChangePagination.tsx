import React from 'react';
import type { ChangePageSize } from '../state/changesViewState';
import { t } from '../../i18n';

const PAGE_SIZES: ChangePageSize[] = [10, 20, 50];

export interface ChangePaginationProps {
  page: number;
  pageSize: ChangePageSize;
  totalItems: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: ChangePageSize) => void;
  compact?: boolean;
}

export const ChangePagination: React.FC<ChangePaginationProps> = ({
  page,
  pageSize,
  totalItems,
  totalPages,
  startIndex,
  endIndex,
  onPageChange,
  onPageSizeChange,
  compact = false,
}) => {
  if (totalItems === 0) {
    return null;
  }

  const canGoPrev = page > 1 && totalPages > 1;
  const canGoNext = page < totalPages && totalPages > 1;
  const rangeText =
    totalPages <= 1
      ? t('dashboard.paginationRangeSimple', { start: startIndex, end: endIndex, total: totalItems })
      : t('dashboard.paginationRange', { start: startIndex, end: endIndex, total: totalItems });

  const prevDisabledTitle = canGoPrev
    ? t('dashboard.paginationPrev')
    : t('dashboard.paginationPrevDisabled');
  const nextDisabledTitle = canGoNext
    ? t('dashboard.paginationNext')
    : t('dashboard.paginationNextDisabled');

  return (
    <div
      className={`mt-3 flex ${compact ? 'flex-col gap-2' : 'flex-wrap items-center justify-between gap-2'}`}
      data-testid="change-pagination"
    >
      <div className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
        {rangeText}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <label className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
          <span className="sr-only">{t('dashboard.pageSizeLabel')}</span>
          <select
            value={pageSize}
            aria-label={t('dashboard.pageSizeLabel')}
            title={t('dashboard.pageSizeLabel')}
            className="px-1.5 py-1 text-xs rounded focus:outline-none focus:ring-1"
            style={{
              background: 'var(--vscode-dropdown-background)',
              color: 'var(--vscode-dropdown-foreground)',
              border: '1px solid var(--vscode-dropdown-border, var(--vscode-input-border))',
              outlineColor: 'var(--vscode-focusBorder)',
            }}
            onChange={(e) => onPageSizeChange(Number(e.target.value) as ChangePageSize)}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-label={t('dashboard.paginationPrev')}
          title={prevDisabledTitle}
          disabled={!canGoPrev}
          className="px-2 py-1 text-xs rounded focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            border: 'none',
            outlineColor: 'var(--vscode-focusBorder)',
          }}
          onClick={() => onPageChange(page - 1)}
        >
          &lt;
        </button>
        {totalPages > 1 &&
          Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              aria-label={t('dashboard.paginationPage', { page: pageNumber })}
              aria-current={pageNumber === page ? 'page' : undefined}
              title={t('dashboard.paginationPage', { page: pageNumber })}
              className="px-2 py-1 text-xs rounded focus:outline-none focus:ring-1"
              style={{
                background:
                  pageNumber === page
                    ? 'var(--vscode-button-background)'
                    : 'var(--vscode-button-secondaryBackground)',
                color:
                  pageNumber === page
                    ? 'var(--vscode-button-foreground)'
                    : 'var(--vscode-button-secondaryForeground)',
                border: 'none',
                outlineColor: 'var(--vscode-focusBorder)',
                fontWeight: pageNumber === page ? 600 : 400,
              }}
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
        <button
          type="button"
          aria-label={t('dashboard.paginationNext')}
          title={nextDisabledTitle}
          disabled={!canGoNext}
          className="px-2 py-1 text-xs rounded focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            border: 'none',
            outlineColor: 'var(--vscode-focusBorder)',
          }}
          onClick={() => onPageChange(page + 1)}
        >
          &gt;
        </button>
      </div>
    </div>
  );
};
