import React from 'react';
import { t } from '../../i18n';
import type { UnregisteredReferenceAlert } from '../utils/unregisteredReferenceAlerts';

export interface UnregisteredReferenceAlertsProps {
  alerts: readonly UnregisteredReferenceAlert[];
  onCopyRecovery: (command: string) => void;
  className?: string;
}

export const UnregisteredReferenceAlerts: React.FC<UnregisteredReferenceAlertsProps> = ({
  alerts,
  onCopyRecovery,
  className = 'mb-4',
}) => {
  if (alerts.length === 0) return null;

  return (
    <div className={className} data-testid="unregistered-reference-alerts">
      {alerts.map((alert) => (
        <div
          key={alert.storeId}
          role="status"
          className="mb-2 rounded border p-3 text-xs leading-snug"
          style={{
            borderColor: 'var(--vscode-editorWarning-border, var(--vscode-panel-border))',
            background: 'var(--vscode-inputValidation-warningBackground, var(--vscode-editor-background))',
            color: 'var(--vscode-editorWarning-foreground, var(--vscode-foreground))',
          }}
        >
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">{t('scope.health.unregisteredReferences')}</span>
            <span
              className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide"
              style={{ border: '1px solid var(--vscode-panel-border)' }}
            >
              {t('references.unregisteredBadge')}
            </span>
          </div>
          <p className="mb-1" style={{ color: 'var(--vscode-descriptionForeground)' }}>
            <span className="font-medium">{alert.storeId}</span>
            {' — '}
            {alert.message ?? t('references.unresolvedFix')}
          </p>
          <p className="mb-2" style={{ color: 'var(--vscode-descriptionForeground)' }}>
            {t('storesWorksets.referencesDescription')}
          </p>
          <button
            type="button"
            className="rounded px-2 py-1 text-xs"
            style={{
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
              border: '1px solid var(--vscode-button-border)',
            }}
            onClick={() => onCopyRecovery(alert.recoveryCommand)}
          >
            {t('references.copyRecoveryCommand')}
          </button>
        </div>
      ))}
    </div>
  );
};
