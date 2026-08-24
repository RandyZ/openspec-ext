import React, { useEffect, useMemo, useState } from 'react';
import { buildChangeStatusCounts } from '../../shared/changeLifecycle';
import type { WorkflowAction } from '../../shared/workflowCommand';
import { buildWorkflowCommand } from '../../shared/workflowCommand';
import { t } from '../../i18n';
import { useVscode } from '../hooks/useVscode';
import { ChangesSection } from './ChangesSection';
import type { ProjectChangesExplorerData, ExtensionMessage } from '../types/messages';
import { sendMessage } from '../types/messages';
import type { WorkflowLaunchConfigView } from '../utils/workflowLaunchLabels';

export interface ChangesExplorerProps {
  data: ProjectChangesExplorerData;
}

export const ChangesExplorer: React.FC<ChangesExplorerProps> = ({ data }) => {
  const { postMessage, onMessage } = useVscode();
  const [workflowLaunchConfig, setWorkflowLaunchConfig] = useState<WorkflowLaunchConfigView | null>(null);
  const counts = useMemo(
    () => buildChangeStatusCounts(data.changes, data.archivedChanges),
    [data.changes, data.archivedChanges],
  );

  useEffect(() => {
    const cleanup = onMessage((event: MessageEvent<ExtensionMessage>) => {
      if (event.data.type === 'workflowLaunchConfig') {
        setWorkflowLaunchConfig(event.data.config);
      }
    });
    postMessage(sendMessage.getWorkflowLaunchConfig());
    return cleanup;
  }, [onMessage, postMessage]);

  const openChange = (changeName: string) => {
    postMessage(sendMessage.openChangeDetailInEditor(
      changeName,
      undefined,
      undefined,
      undefined,
      data.project,
      data.binding,
    ));
  };

  const openArchivedChange = (directoryName: string) => {
    openChange(`archive:${directoryName}`);
  };

  const copyWorkflow = (action: 'ff' | 'apply', changeName: string) => {
    postMessage(sendMessage.copyToClipboard(buildWorkflowCommand({
      action,
      changeName,
      target: 'clipboard',
    })));
  };

  const launchWorkflow = (action: WorkflowAction, changeName: string, bindingKey?: string) => {
    if (action === 'verify' || action === 'archive') {
      postMessage(sendMessage.openChangeDetailInEditor(
        changeName,
        'verifyArchive',
        action,
        undefined,
        data.project,
        data.binding,
      ));
      return;
    }
    postMessage(sendMessage.launchWorkflowAction(action, changeName, undefined, undefined, bindingKey));
  };

  return (
    <main
      data-testid="changes-explorer"
      data-project-id={data.project.id}
      data-root-path={data.binding.rootPath}
      className="p-4"
    >
      <header className="mb-4">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--vscode-foreground)' }}>
          {t('projectSidebar.allChanges')}
        </h1>
        <div className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
          {data.project.label} · {data.binding.rootPath}
        </div>
      </header>
      <ChangesSection
        changes={[...data.changes]}
        archivedItems={[...data.archivedChanges]}
        changeStatusCounts={counts}
        onOpenChange={openChange}
        onOpenArchivedChange={openArchivedChange}
        onCopyFf={(changeName) => copyWorkflow('ff', changeName)}
        onCopyApply={(changeName) => copyWorkflow('apply', changeName)}
        onLaunchWorkflow={launchWorkflow}
        workflowLaunchConfig={workflowLaunchConfig}
        rootLabel={data.project.label}
      />
    </main>
  );
};
