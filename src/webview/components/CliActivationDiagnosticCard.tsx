import React from 'react';
import type { CliActivationDiagnosticView } from '../types/messages';
import { t } from '../../i18n';

type Mode = 'blocking' | 'warning';

interface Props {
  diagnostic: CliActivationDiagnosticView;
  mode: Mode;
  isRetrying?: boolean;
  onAction: (action: string) => void;
}

const ACTION_LABEL_KEYS: Record<string, string> = {
  'open-settings': 'cliDiagnostic.actionOpenSettings',
  retry: 'cliDiagnostic.actionRetry',
  'copy-diagnostics': 'cliDiagnostic.actionCopyDiagnostics',
  'open-docs': 'cliDiagnostic.actionOpenDocs',
};

const TITLE_KEYS: Record<string, string> = {
  'cli-not-found': 'cliDiagnostic.title.cliNotFound',
  'configured-path-invalid': 'cliDiagnostic.title.configuredPathInvalid',
  'spawn-failed': 'cliDiagnostic.title.spawnFailed',
  'shell-resolution-failed': 'cliDiagnostic.title.timeout',
  'version-check-failed': 'cliDiagnostic.title.timeout',
};

const BUTTON_ACTIONS = ['retry', 'open-settings', 'copy-diagnostics'] as const;
const LINK_ACTION = 'open-docs';

function resolveTitle(diagnostic: CliActivationDiagnosticView): string {
  const key = TITLE_KEYS[diagnostic.category];
  return key ? t(key) : diagnostic.message;
}

export const CliActivationDiagnosticCard: React.FC<Props> = ({
  diagnostic,
  mode,
  isRetrying = false,
  onAction,
}) => {
  const isWarning = mode === 'warning';
  const title = resolveTitle(diagnostic);
  const visibleDetails = diagnostic.safeDetails.slice(0, 2);
  const buttonActions = BUTTON_ACTIONS.filter((action) => diagnostic.recoveryActions.includes(action));
  const showDocsLink = diagnostic.recoveryActions.includes(LINK_ACTION);

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
      <div className="font-semibold mb-1">{title}</div>
      <div className="mb-2" style={{ color: 'var(--vscode-descriptionForeground)' }}>
        {t('cliDiagnostic.guideLine')}
      </div>
      {isWarning && (
        <div className="mb-2" style={{ color: 'var(--vscode-descriptionForeground)' }}>
          {t('cliDiagnostic.staleWarning')}
        </div>
      )}
      {visibleDetails.length > 0 && (
        <ul className="m-0 mb-3 pl-4" style={{ color: 'var(--vscode-descriptionForeground)' }}>
          {visibleDetails.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {buttonActions.map((action) => {
          const isRetry = action === 'retry';
          const isPrimary = isRetry;
          const disabled = isRetry && isRetrying;
          const label = isRetry && isRetrying
            ? t('cliDiagnostic.actionRetryLoading')
            : t(ACTION_LABEL_KEYS[action] ?? action);

          return (
            <button
              key={action}
              type="button"
              className="px-2 py-1 rounded text-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: isPrimary
                  ? 'var(--vscode-button-background)'
                  : 'var(--vscode-button-secondaryBackground)',
                color: isPrimary
                  ? 'var(--vscode-button-foreground)'
                  : 'var(--vscode-button-secondaryForeground)',
                border: 'none',
              }}
              disabled={disabled}
              onClick={() => onAction(action)}
            >
              {label}
            </button>
          );
        })}
      </div>
      {showDocsLink && (
        <div className="mt-2">
          <button
            type="button"
            className="p-0 text-xs cursor-pointer underline bg-transparent border-none"
            style={{ color: 'var(--vscode-textLink-foreground)' }}
            onClick={() => onAction(LINK_ACTION)}
          >
            {t(ACTION_LABEL_KEYS[LINK_ACTION])}
          </button>
        </div>
      )}
    </section>
  );
};
