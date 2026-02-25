import React from 'react';
import { SpecInfo } from '../types/messages';
import { t } from '../../i18n';

export interface SpecCardProps {
  spec: SpecInfo;
  onClick?: (spec: SpecInfo) => void;
}

export const SpecCard: React.FC<SpecCardProps> = ({ spec, onClick }) => {
  return (
    <div
      role="button"
      tabIndex={0}
      className="p-3 rounded cursor-pointer transition-opacity hover:opacity-90 focus:outline-none focus:ring-1"
      style={{
        background: 'var(--vscode-input-background)',
        outlineColor: 'var(--vscode-focusBorder)',
      }}
      onClick={() => onClick?.(spec)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(spec);
        }
      }}
    >
      <div className="font-medium text-sm">{spec.id}</div>
      <div
        className="text-xs mt-1"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
      >
        {t('spec.requirements', { count: spec.requirementCount })}
      </div>
    </div>
  );
};
