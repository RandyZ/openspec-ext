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

const CATEGORY_TITLE_KEYS: Record<string, string> = {
  'cli-not-found': 'cliDiagnostic.title.cliNotFound',
  'configured-path-invalid': 'cliDiagnostic.title.configuredPathInvalid',
  'spawn-failed': 'cliDiagnostic.title.spawnFailed',
  timeout: 'cliDiagnostic.title.timeout',
};

const BUTTON_ACTIONS = ['retry', 'open-settings', 'copy-diagnostics'] as const;
const MAX_VISIBLE_DETAILS = 2;

function resolveTitle(category: string, fallbackMessage: string): string {
  const key = CATEGORY_TITLE_KEYS[category];
  return key ? t(key) : fallbackMessage;
}

export const CliActivationDiagnosticCard: React.FC<Props> = ({
  diagnostic,
  mode,
  isRetrying = false,
  onAction,
}) => {
  const isWarning = mode === 'warning';
  const visibleDetails = diagnostic.safeDetails.slice(0, MAX_VISIBLE_DETAILS);
  const buttonActions = BUTTON_ACTIONS.filter((action) => diagnostic.recoveryActions.includes(action));
  const showDocsLink = diagnostic.recoveryActions.includes('open-docs');

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
      data-cli-diagnostic-mode={mode}
    >
      <div className="font-semibold mb-1">{resolveTitle(diagnostic.category, diagnostic.message)}</div>
      <div className="mb-2" style={{ color: 'var(--vscode-descriptionForeground)' }}>
        {t('cliDiagnostic.guidance')}
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
            ? t('cliDiagnostic.actionRetryChecking')
            : t(ACTION_LABEL_KEYS[action] ?? action);

          return (
            <button
              key={action}
              type="button"
              data-cli-diagnostic-action={action}
              disabled={disabled}
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
              onClick={() => onAction(action)}
            >
              {label}
            </button>
          );
        })}
      </div>
      {showDocsLink && (
        <button
          type="button"
          data-cli-diagnostic-action="open-docs"
          className="mt-2 p-0 text-xs cursor-pointer bg-transparent border-none underline"
          style={{ color: 'var(--vscode-textLink-foreground)' }}
          onClick={() => onAction('open-docs')}
        >
          {t('cliDiagnostic.actionOpenDocs')} →
        </button>
      )}
    </section>
  );
};
