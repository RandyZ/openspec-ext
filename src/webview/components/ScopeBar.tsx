import React from 'react';
import type { OpenSpecScopeView } from '../types/messages';

// ── Helpers ──────────────────────────────────────────────────────────────────

function runtimeLabel(source: OpenSpecScopeView['runtimeSource']): string {
  if (source === 'localSource') return 'Local Source';
  if (source === 'customPath') return 'Custom Path';
  return 'Installed CLI';
}

function healthLabel(status: 'ok' | 'warning' | 'unavailable'): string {
  if (status === 'ok') return 'Healthy';
  if (status === 'warning') return 'Issues';
  return 'Unavailable';
}

function healthColor(status: 'ok' | 'warning' | 'unavailable'): string {
  if (status === 'ok') return 'var(--vscode-testing-iconPassed)';
  if (status === 'warning') return 'var(--vscode-testing-iconQueued)';
  return 'var(--vscode-testing-iconFailed)';
}

// ── Component ────────────────────────────────────────────────────────────────

export interface ScopeBarProps {
  scope?: OpenSpecScopeView;
  scopes?: OpenSpecScopeView[];
  health?: { status: 'ok' | 'warning' | 'unavailable'; label: string };
  loading: boolean;
  onSelectScope: (scopeId: string) => void;
}

export const ScopeBar: React.FC<ScopeBarProps> = ({
  scope,
  scopes = [],
  health,
  loading,
  onSelectScope,
}) => {
  if (!scope) return null;

  const showSelector = scopes.length > 1;

  return (
    <section
      className="mb-3 rounded border px-2 py-2 text-xs"
      style={{
        borderColor: 'var(--vscode-panel-border)',
        background: 'var(--vscode-editor-inactiveSelectionBackground)',
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span style={{ color: 'var(--vscode-descriptionForeground)' }}>
          {runtimeLabel(scope.runtimeSource)}
        </span>

        {showSelector ? (
          <select
            disabled={loading}
            value={scope.id}
            onChange={(event) => onSelectScope(event.currentTarget.value)}
            aria-label="OpenSpec scope"
            className="rounded border px-1 py-0.5 text-xs"
            style={{
              borderColor: 'var(--vscode-dropdown-border)',
              background: 'var(--vscode-dropdown-background)',
              color: 'var(--vscode-dropdown-foreground)',
            }}
          >
            {scopes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        ) : (
          <strong>{scope.label}</strong>
        )}

        {health && (
          <span
            style={{ color: healthColor(health.status) }}
            title={health.label}
          >
            ● {healthLabel(health.status)}
          </span>
        )}
      </div>
    </section>
  );
};
