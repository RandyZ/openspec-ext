import React from 'react';
import type { CliActivationDiagnosticView } from '../types/messages';
import { t } from '../../i18n';

type Mode = 'blocking' | 'warning';

interface Props {
  diagnostic: CliActivationDiagnosticView;
  mode: Mode;
  onAction: (action: string) => void;
}

const ACTION_LABEL_KEYS: Record<string, string> = {
  'open-settings': 'cliDiagnostic.actionOpenSettings',
  retry: 'cliDiagnostic.actionRetry',
  'copy-diagnostics': 'cliDiagnostic.actionCopyDiagnostics',
  'open-docs': 'cliDiagnostic.actionOpenDocs',
};

export const CliActivationDiagnosticCard: React.FC<Props> = ({ diagnostic, mode, onAction }) => {
  const isWarning = mode === 'warning';
  return (
    <section
      className="mb-4 rounded border p-3 text-xs"
      style={{
        borderColor: isWarning
          ? 'var(--vscode-inputValidation-warningBorder, var(--vscode-panel-border))'
          : 'var(--vscode-inputValidation-errorBorder, var(--vscode-panel-border))',
        background: isWarning
          ? 'var(--vscode-inputValidation-warningBackground)'
          : 'var(--vscode-inputValidation-errorBackground)',
        color: 'var(--vscode-foreground)',
      }}
    >
      <div className="font-semibold mb-1">{diagnostic.message}</div>
      {isWarning && (
        <div className="mb-2" style={{ color: 'var(--vscode-descriptionForeground)' }}>
          {t('cliDiagnostic.staleWarning')}
        </div>
      )}
      {diagnostic.safeDetails.length > 0 && (
        <ul className="m-0 mb-3 pl-4" style={{ color: 'var(--vscode-descriptionForeground)' }}>
          {diagnostic.safeDetails.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {diagnostic.recoveryActions.map((action) => (
          <button
            key={action}
            type="button"
            className="px-2 py-1 rounded text-xs cursor-pointer"
            style={{
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
              border: 'none',
            }}
            onClick={() => onAction(action)}
          >
            {t(ACTION_LABEL_KEYS[action] ?? action)}
          </button>
        ))}
      </div>
    </section>
  );
};
