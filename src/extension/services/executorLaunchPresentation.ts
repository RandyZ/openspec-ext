import type { Webview } from 'vscode';
import {
  buildExecutorLaunchPresentation,
  type ExecutorLaunchPresentation,
} from '../../shared/executorLaunchPresentation';
import { toWorkflowLaunchConfigView } from '../../shared/workflowLaunchConfig';
import type { DataManager } from './dataManager';
import { getWorkflowLaunchConfig } from './workflowLaunchConfig';

export async function createExecutorLaunchPresentation(
  dataManager: DataManager,
): Promise<ExecutorLaunchPresentation> {
  const workflowLaunchConfig = toWorkflowLaunchConfigView(getWorkflowLaunchConfig());
  const adapters = await dataManager.getAgentAdaptersInfo();
  return buildExecutorLaunchPresentation(
    workflowLaunchConfig,
    adapters.available,
    adapters.currentId,
  );
}

export function postExecutorLaunchPresentation(
  webview: Webview,
  presentation: ExecutorLaunchPresentation,
): void {
  webview.postMessage({
    type: 'executorLaunchPresentation',
    ...presentation,
  });
}

export async function postExecutorLaunchPresentationFromHost(
  webview: Webview,
  dataManager: DataManager,
): Promise<void> {
  if (typeof dataManager.getAgentAdaptersInfo !== 'function') {
    return;
  }
  postExecutorLaunchPresentation(webview, await createExecutorLaunchPresentation(dataManager));
}
