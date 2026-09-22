import React, { useCallback, useEffect, useState } from 'react';
import { useVscode } from '../hooks/useVscode';
import { sendMessage } from '../types/messages';
import { t } from '../../i18n';
import { buildAgentInitPrompt, OPENSPEC_INIT_COMMAND } from '../../shared/agentInit';
import type { WorkflowLaunchConfigView } from '../../shared/workflowLaunchConfig';
import { getTaskNextButtonLabel } from '../utils/taskNextButtonLabels';

interface Props {
  workspacePath?: string;
}

export const AgentUnavailableCard: React.FC<Props> = ({ workspacePath }) => {
  const { postMessage, onMessage } = useVscode();
  const [workflowLaunchConfig, setWorkflowLaunchConfig] = useState<WorkflowLaunchConfigView | null>(null);

  useEffect(() => {
    postMessage(sendMessage.getWorkflowLaunchConfig());
    return onMessage((event: MessageEvent) => {
      const message = event.data;
      if (message?.type === 'workflowLaunchConfig') {
        setWorkflowLaunchConfig(message.config ?? null);
      }
    });
  }, [postMessage, onMessage]);

  const initPrompt = buildAgentInitPrompt(workspacePath);
  const primaryLabel = t('agentUnavailable.askAgentInit');

  const handleAskAgentInit = useCallback(() => {
    postMessage(sendMessage.fillChat(initPrompt));
  }, [postMessage, initPrompt]);

  const handleOpenFolder = useCallback(() => {
    postMessage(sendMessage.openWorkspaceFolder());
  }, [postMessage]);

  const handleCopyInit = useCallback(() => {
    postMessage(sendMessage.copyToClipboard(OPENSPEC_INIT_COMMAND));
  }, [postMessage]);

  const handleOpenDocs = useCallback(() => {
    postMessage(sendMessage.openCliInstallDocs());
  }, [postMessage]);

  return (
    <div
      className="min-h-screen p-4"
      style={{
        background: 'var(--vscode-editor-background)',
        color: 'var(--vscode-foreground)',
      }}
    >
      <section
        data-agent-unavailable-card
        className="rounded border p-4 text-sm max-w-xl"
        style={{
          borderColor: 'var(--vscode-editorWidget-border, var(--vscode-panel-border))',
          background: 'var(--vscode-editorWidget-background, var(--vscode-sideBar-background))',
        }}
      >
        <h2 className="m-0 mb-2 text-base font-semibold">{t('agentUnavailable.title')}</h2>
        <p className="m-0 mb-4" style={{ color: 'var(--vscode-descriptionForeground)' }}>
          {t('agentUnavailable.description')}
        </p>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            type="button"
            data-agent-unavailable-action="ask-init"
            className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer"
            style={{
              background: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              border: 'none',
            }}
            title={primaryLabel}
            onClick={handleAskAgentInit}
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            data-agent-unavailable-action="open-folder"
            className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer"
            style={{
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
              border: 'none',
            }}
            onClick={handleOpenFolder}
          >
            {t('agentUnavailable.openFolder')}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            data-agent-unavailable-action="copy-init"
            className="p-0 cursor-pointer bg-transparent border-none underline"
            style={{ color: 'var(--vscode-textLink-foreground)' }}
            onClick={handleCopyInit}
          >
            {t('agentUnavailable.copyInitCommand')}
          </button>
          <span style={{ color: 'var(--vscode-descriptionForeground)' }}>·</span>
          <button
            type="button"
            data-agent-unavailable-action="open-docs"
            className="p-0 cursor-pointer bg-transparent border-none underline"
            style={{ color: 'var(--vscode-textLink-foreground)' }}
            onClick={handleOpenDocs}
          >
            {t('agentUnavailable.openDocs')}
          </button>
        </div>
        {workflowLaunchConfig && (
          <p
            className="mt-3 mb-0 text-[11px]"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
            data-launch-mode-hint
          >
            {getTaskNextButtonLabel(workflowLaunchConfig) === t('task.copy')
              ? t('workflow.modeHint.copyOnly')
              : t('workflow.modeHint.executableGeneric')}
          </p>
        )}
      </section>
    </div>
  );
};
