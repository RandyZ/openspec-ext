import React, { useEffect, useState } from 'react';
import { useVscode } from '../hooks/useVscode';
import { useAppState } from '../context/AppContext';
import { sendMessage } from '../types/messages';
import type { ArchivedChangeInfo, SpecInfo } from '../types/messages';
import { Header } from './Header';
import { ChangesSection } from './ChangesSection';
import { SpecsSection } from './SpecsSection';
import { t } from '../../i18n';
import {
  buildWorkflowCommand,
  type WorkflowAction,
} from '../../shared/workflowCommand';
import type { WorkflowLaunchConfigView } from '../utils/workflowLaunchLabels';

export const Dashboard: React.FC = () => {
  const { postMessage, onMessage } = useVscode();
  const { state, dispatch } = useAppState();
  const [archivedExpanded, setArchivedExpanded] = useState(false);
  const [archivedItems, setArchivedItems] = useState<ArchivedChangeInfo[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [specRequirements, setSpecRequirements] = useState<Record<string, string[]>>({});
  const [workflowLaunchConfig, setWorkflowLaunchConfig] = useState<WorkflowLaunchConfigView | null>(null);

  useEffect(() => {
    // Listen for messages from extension
    const cleanup = onMessage((event: MessageEvent) => {
      const message = event.data;

      if (message.type === 'dashboardData') {
        dispatch({ type: 'SET_DATA', payload: message.data });
        if (message.debug !== undefined) {
          dispatch({ type: 'SET_DEBUG', payload: message.debug });
        }
        if (message.data?.specs) {
          for (const spec of message.data.specs) {
            postMessage(sendMessage.getSpecRequirements(spec.id));
          }
        }
      } else if (message.type === 'error') {
        dispatch({ type: 'SET_ERROR', payload: message.message });
      } else if (message.type === 'specRequirements') {
        setSpecRequirements((prev) => ({
          ...prev,
          [message.specId]: message.requirements ?? [],
        }));
      } else if (message.type === 'archivedChanges') {
        setArchivedItems(message.items ?? []);
        setArchivedLoading(false);
      } else if (message.type === 'workflowLaunchConfig') {
        setWorkflowLaunchConfig(message.config ?? null);
      }
    });

    // Request initial data
    dispatch({ type: 'SET_LOADING', payload: true });
    postMessage(sendMessage.getDashboardData());
    postMessage(sendMessage.getWorkflowLaunchConfig());

    return cleanup;
  }, [postMessage, onMessage, dispatch]);

  const handleArchivedToggle = () => {
    const next = !archivedExpanded;
    setArchivedExpanded(next);
    if (next) {
      setArchivedLoading(true);
      postMessage(sendMessage.getArchivedChanges());
    }
  };

  const handleOpenArchivedChange = (directoryName: string) => {
    postMessage(sendMessage.openChangeDetailInEditor(`archive:${directoryName}`));
  };

  const handleRefresh = () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    postMessage(sendMessage.refresh());
    postMessage(sendMessage.getWorkflowLaunchConfig());
  };

  const handleOpenChange = (changeName: string) => {
    postMessage(sendMessage.openChangeDetailInEditor(changeName));
  };

  const handleRequestNewChange = () => {
    postMessage(sendMessage.requestNewChange());
  };

  const handleCopyFf = (changeName: string) => {
    postMessage(sendMessage.copyToClipboard(buildWorkflowCommand({ action: 'ff', changeName, target: 'clipboard' })));
  };

  const handleCopyApply = (changeName: string) => {
    postMessage(sendMessage.copyToClipboard(buildWorkflowCommand({ action: 'apply', changeName, target: 'clipboard' })));
  };

  const handleArchive = (changeName: string) => {
    postMessage(sendMessage.archiveChange(changeName));
  };

  const handleLaunchWorkflow = (action: WorkflowAction, changeName: string) => {
    postMessage(sendMessage.launchWorkflowAction(action, changeName));
  };

  const handleOpenSpec = (spec: SpecInfo) => {
    postMessage(sendMessage.openSpecInEditor(spec.id));
    if (!specRequirements[spec.id]) {
      postMessage(sendMessage.getSpecRequirements(spec.id));
    }
  };

  const handleRequirementClick = (spec: SpecInfo, requirementIndex: number) => {
    postMessage(sendMessage.openSpecInEditor(spec.id, requirementIndex));
  };

  const { data, loading, error } = state;

  return (
    <div className="min-h-screen" style={{ 
      background: 'var(--vscode-editor-background)',
      color: 'var(--vscode-foreground)'
    }}>
      <div className="p-3">
        <Header
          onRefresh={handleRefresh}
          onNewChange={handleRequestNewChange}
          loading={loading}
        />

        {error && (
          <div 
            className="mb-4 p-2 rounded text-xs"
            style={{ 
              background: 'var(--vscode-inputValidation-errorBackground)',
              color: 'var(--vscode-errorForeground)',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {data ? (
          <>
            <ChangesSection
              changes={data.changes}
              onOpenChange={handleOpenChange}
              onRequestNewChange={handleRequestNewChange}
              onCopyFf={handleCopyFf}
              onCopyApply={handleCopyApply}
              onArchive={handleArchive}
              onLaunchWorkflow={handleLaunchWorkflow}
              archivedExpanded={archivedExpanded}
              onArchivedToggle={handleArchivedToggle}
              archivedItems={archivedItems}
              archivedLoading={archivedLoading}
              onOpenArchivedChange={handleOpenArchivedChange}
              workflowLaunchConfig={workflowLaunchConfig}
            />
            <SpecsSection
              specs={data.specs}
              specRequirements={specRequirements}
              onOpenSpec={handleOpenSpec}
              onRequirementClick={handleRequirementClick}
            />
          </>
        ) : loading ? (
          <div className="text-xs py-4" style={{ 
            color: 'var(--vscode-descriptionForeground)' 
          }}>
            {t('dashboard.loading')}
          </div>
        ) : (
          <div className="text-xs py-4" style={{ 
            color: 'var(--vscode-errorForeground)' 
          }}>
            {t('dashboard.loadFailed')}
          </div>
        )}
      </div>
    </div>
  );
};
