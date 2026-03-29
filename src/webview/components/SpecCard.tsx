import React, { useState } from 'react';
import { SpecInfo } from '../types/messages';
import { t } from '../../i18n';

export interface SpecCardProps {
  spec: SpecInfo;
  onClick?: (spec: SpecInfo) => void;
  requirements?: string[];
  onRequirementClick?: (spec: SpecInfo, requirementIndex: number) => void;
}

export const SpecCard: React.FC<SpecCardProps> = ({ spec, onClick, requirements, onRequirementClick }) => {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = (e: React.MouseEvent) => {
    if (requirements && requirements.length > 0) {
      e.stopPropagation();
      setExpanded(!expanded);
    }
  };

  return (
    <div
      className="rounded overflow-hidden"
      style={{ background: 'var(--vscode-input-background)' }}
    >
      <div
        role="button"
        tabIndex={0}
        className="p-3 cursor-pointer transition-opacity hover:opacity-90 focus:outline-none focus:ring-1 flex items-center gap-2"
        style={{ outlineColor: 'var(--vscode-focusBorder)' }}
        onClick={() => onClick?.(spec)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.(spec);
          }
        }}
      >
        {requirements && requirements.length > 0 && (
          <button
            type="button"
            className="shrink-0 border-none bg-transparent cursor-pointer text-xs p-0"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
            onClick={handleToggle}
          >
            <span
              className="inline-block transition-transform"
              style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              ▶
            </span>
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{spec.id}</div>
          <div
            className="text-xs mt-0.5"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
          >
            {t('spec.requirements', { count: spec.requirementCount })}
          </div>
        </div>
      </div>

      {expanded && requirements && requirements.length > 0 && (
        <div
          className="px-3 pb-2"
          style={{ borderTop: '1px solid var(--vscode-panel-border)' }}
        >
          {requirements.map((req, i) => (
            <button
              key={i}
              type="button"
              className="block w-full text-left py-1.5 px-2 mt-1 rounded text-xs cursor-pointer border-none hover:opacity-80"
              style={{
                background: 'var(--vscode-editor-background)',
                color: 'var(--vscode-foreground)',
              }}
              onClick={() => onRequirementClick?.(spec, i)}
            >
              {req}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
