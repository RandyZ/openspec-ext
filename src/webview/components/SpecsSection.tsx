import React from 'react';
import { SpecInfo } from '../types/messages';
import { EmptyState } from './EmptyState';
import { SpecCard } from './SpecCard';
import { t } from '../../i18n';

interface SpecsSectionProps {
  specs: SpecInfo[];
  onOpenSpec?: (spec: SpecInfo) => void;
}

export const SpecsSection: React.FC<SpecsSectionProps> = ({ specs, onOpenSpec }) => {
  return (
    <div className="mb-6">
      <h2
        className="text-base font-semibold mb-2"
        style={{ color: 'var(--vscode-foreground)' }}
      >
        {t('dashboard.specs', { count: specs.length })}
      </h2>

      {specs.length === 0 ? (
        <EmptyState message={t('dashboard.emptySpecs')} />
      ) : (
        <div className="space-y-2">
          {specs.map((spec) => (
            <SpecCard
              key={spec.id}
              spec={spec}
              onClick={onOpenSpec}
            />
          ))}
        </div>
      )}
    </div>
  );
};
