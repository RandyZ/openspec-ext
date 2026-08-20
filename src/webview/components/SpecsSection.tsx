import React from 'react';
import { SpecInfo } from '../types/messages';
import { EmptyState } from './EmptyState';
import { SpecCard } from './SpecCard';
import { t } from '../../i18n';

export interface SpecsSectionProps {
  specs: readonly SpecInfo[];
  specRequirements?: Record<string, string[]>;
  onOpenSpec?: (spec: SpecInfo) => void;
  onRequirementClick?: (spec: SpecInfo, requirementIndex: number) => void;
  rootLabel?: string;
  heading?: string;
  emptyMessage?: string;
  loadError?: string;
  sourceLabel?: string;
  readOnly?: boolean;
}

export const SpecsSection: React.FC<SpecsSectionProps> = ({
  specs,
  specRequirements,
  onOpenSpec,
  onRequirementClick,
  rootLabel,
  heading,
  emptyMessage,
  loadError,
  sourceLabel,
  readOnly = false,
}) => {
  return (
    <section
      className="mb-6"
      data-readonly={readOnly ? 'true' : undefined}
      data-source={sourceLabel}
    >
      <h2
        className="text-base font-semibold mb-2 break-words"
        style={{ color: 'var(--vscode-foreground)' }}
        title={sourceLabel}
      >
        {heading ?? t('dashboard.specs', { count: specs.length })}
      </h2>

      {loadError ? (
        <div
          role="alert"
          className="py-4 px-3 rounded text-sm"
          style={{
            background: 'var(--vscode-inputValidation-errorBackground)',
            color: 'var(--vscode-inputValidation-errorForeground, var(--vscode-foreground))',
          }}
        >
          {loadError}
        </div>
      ) : specs.length === 0 ? (
        <EmptyState
          message={emptyMessage ?? (rootLabel ? t('dashboard.emptySpecsInRoot', { root: rootLabel }) : t('dashboard.emptySpecs'))}
        />
      ) : (
        <div className="space-y-2">
          {specs.map((spec) => (
            <SpecCard
              key={spec.id}
              spec={spec}
              onClick={onOpenSpec}
              requirements={specRequirements?.[spec.id]}
              onRequirementClick={onRequirementClick}
              sourceLabel={sourceLabel}
            />
          ))}
        </div>
      )}
    </section>
  );
};
