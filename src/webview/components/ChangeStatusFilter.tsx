import React from 'react';
import type { ChangeLifecycleStatus, ChangeStatusCounts } from '../../shared/changeLifecycle';
import { t } from '../../i18n';

export type LifecycleFilterValue = ChangeLifecycleStatus | 'all';

export interface LifecycleFilterOption {
  value: LifecycleFilterValue;
  label: string;
  count: number;
}

export function buildLifecycleFilterOptions(counts: ChangeStatusCounts): LifecycleFilterOption[] {
  return [
    { value: 'all', label: t('dashboard.lifecycleAll'), count: counts.all },
    { value: 'planning', label: t('dashboard.lifecyclePlanning'), count: counts.planning },
    {
      value: 'ready-to-apply',
      label: t('dashboard.lifecycleReadyToApply'),
      count: counts.readyToApply,
    },
    { value: 'applying', label: t('dashboard.lifecycleApplying'), count: counts.applying },
    {
      value: 'ready-to-verify',
      label: t('dashboard.lifecycleReadyToVerify'),
      count: counts.readyToVerify,
    },
    { value: 'archived', label: t('dashboard.lifecycleArchived'), count: counts.archived },
  ];
}

export interface ChangeStatusFilterProps {
  variant: 'segments' | 'compact';
  value: LifecycleFilterValue;
  counts: ChangeStatusCounts;
  onChange: (value: LifecycleFilterValue) => void;
}

export const ChangeStatusFilter: React.FC<ChangeStatusFilterProps> = ({
  variant,
  value,
  counts,
  onChange,
}) => {
  const options = buildLifecycleFilterOptions(counts);
  const groupLabel = t('dashboard.lifecycleFilterLabel');

  if (variant === 'compact') {
    return (
      <label className="block w-full mb-2">
        <span className="sr-only">{groupLabel}</span>
        <select
          value={value}
          aria-label={groupLabel}
          title={groupLabel}
          className="w-full px-2 py-1.5 text-xs rounded focus:outline-none focus:ring-1"
          style={{
            background: 'var(--vscode-dropdown-background)',
            color: 'var(--vscode-dropdown-foreground)',
            border: '1px solid var(--vscode-dropdown-border, var(--vscode-input-border))',
            outlineColor: 'var(--vscode-focusBorder)',
          }}
          onChange={(e) => onChange(e.target.value as LifecycleFilterValue)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} ({option.count})
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div
      role="group"
      aria-label={groupLabel}
      className="flex flex-wrap gap-1 mb-3"
      data-testid="lifecycle-segments"
    >
      {options.map((option) => {
        const selected = value === option.value;
        const label = `${option.label} ${option.count}`;
        return (
          <button
            key={option.value}
            type="button"
            data-lifecycle-status={option.value}
            aria-pressed={selected}
            aria-current={selected ? 'true' : undefined}
            aria-label={label}
            title={label}
            className="px-2 py-1 text-xs rounded cursor-pointer focus:outline-none focus:ring-1"
            style={{
              background: selected
                ? 'var(--vscode-button-background)'
                : 'var(--vscode-input-background)',
              color: selected
                ? 'var(--vscode-button-foreground)'
                : 'var(--vscode-foreground)',
              border: selected
                ? '1px solid var(--vscode-button-background)'
                : '1px solid var(--vscode-input-border)',
              outlineColor: 'var(--vscode-focusBorder)',
              fontWeight: selected ? 600 : 400,
            }}
            onClick={() => onChange(option.value)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};
