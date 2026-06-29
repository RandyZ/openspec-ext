import React from 'react';
import type { ReferenceIndexEntryView } from '../types/messages';

export interface ReferencesPanelProps {
  references?: ReferenceIndexEntryView[];
  onCopyFetch: (text: string) => void;
}

export const ReferencesPanel: React.FC<ReferencesPanelProps> = ({
  references = [],
  onCopyFetch,
}) => {
  if (references.length === 0) return null;

  return (
    <section className="mt-4">
      <h2
        className="text-base font-semibold mb-2"
        style={{ color: 'var(--vscode-foreground)' }}
      >
        References
      </h2>
      <div className="space-y-2">
        {references.map((ref) => {
          const isResolved = ref.specs && ref.specs.length > 0;
          const hasIssues = (ref.status ?? []).some(
            (s) => s.severity === 'error' || s.severity === 'warning',
          );

          return (
            <div
              key={ref.store_id}
              className="rounded border p-2 text-xs"
              style={{
                borderColor: 'var(--vscode-panel-border)',
                background: 'var(--vscode-editor-background)',
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{ref.store_id}</span>
                <span
                  style={{
                    color: isResolved
                      ? 'var(--vscode-testing-iconPassed)'
                      : 'var(--vscode-testing-iconQueued)',
                  }}
                >
                  {isResolved ? '✓' : hasIssues ? '⚠' : '…'}
                </span>
              </div>

              {isResolved &&
                ref.specs!.map((spec) => (
                  <div
                    key={spec.id}
                    className="ml-1"
                    style={{ color: 'var(--vscode-descriptionForeground)' }}
                  >
                    {spec.id}
                    {spec.summary ? ` — ${spec.summary}` : ''}
                  </div>
                ))}

              {ref.fetch && (
                <button
                  type="button"
                  onClick={() => onCopyFetch(ref.fetch!)}
                  className="mt-1 rounded px-2 py-0.5 text-xs"
                  style={{
                    border: '1px solid var(--vscode-button-border)',
                    background: 'var(--vscode-button-secondaryBackground)',
                    color: 'var(--vscode-button-secondaryForeground)',
                  }}
                >
                  Copy fetch command
                </button>
              )}

              {(ref.status ?? []).map((status) => (
                <div
                  key={status.code}
                  className="mt-1"
                  style={{
                    color:
                      status.severity === 'error'
                        ? 'var(--vscode-errorForeground)'
                        : 'var(--vscode-descriptionForeground)',
                  }}
                >
                  {status.message}
                  {status.fix ? (
                    <span className="ml-1">Fix: {status.fix}</span>
                  ) : null}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
};
