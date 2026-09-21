import {
  toWorkflowLaunchConfigView,
  type PreferredAgentAdapter,
  type WorkflowLaunchConfigView,
} from '../../shared/workflowLaunchConfig';

export function normalizeExecutorAdapterId(
  currentAdapterId: string | null | undefined,
  configPreferredAdapter: PreferredAgentAdapter,
  availableAdapterIds?: readonly string[],
): PreferredAgentAdapter {
  const available = availableAdapterIds ?? [];

  if (currentAdapterId && available.includes(currentAdapterId)) {
    return currentAdapterId as PreferredAgentAdapter;
  }

  if (available.length === 1) {
    return available[0] as PreferredAgentAdapter;
  }

  if (available.includes(configPreferredAdapter)) {
    return configPreferredAdapter;
  }

  if (currentAdapterId) {
    return currentAdapterId as PreferredAgentAdapter;
  }

  return configPreferredAdapter;
}

/**
 * Derive launch labels from the Executor dropdown (runtime adapter), not stale settings.
 * Clipboard executor always maps to copy-only presentation.
 */
export function resolveUiWorkflowLaunchConfig(
  config: WorkflowLaunchConfigView | null,
  currentAdapterId: string | null | undefined,
  availableAdapterIds?: readonly string[],
): WorkflowLaunchConfigView | null {
  if (!config) return null;

  const executorId = normalizeExecutorAdapterId(
    currentAdapterId,
    config.preferredAgentAdapter,
    availableAdapterIds,
  );

  if (executorId === 'clipboard') {
    return toWorkflowLaunchConfigView({
      workflowLaunchMode: 'clipboard',
      preferredAgentAdapter: 'clipboard',
      cursorLaunchMode: 'clipboard',
      cursorAgentModel: config.cursorAgentModel,
      cursorLaunchModeExplicit: config.cursorLaunchModeExplicit,
    });
  }

  return toWorkflowLaunchConfigView({
    ...config,
    workflowLaunchMode: 'adapter',
    preferredAgentAdapter: executorId,
  });
}
