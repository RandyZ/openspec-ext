import {
  toWorkflowLaunchConfigView,
  type PreferredAgentAdapter,
  type WorkflowLaunchConfigView,
} from './workflowLaunchConfig';

export interface AgentAdapterOption {
  id: string;
  displayName: string;
}

export interface AgentAdaptersState {
  available: AgentAdapterOption[];
  currentId: string | null;
}

export interface ExecutorLaunchPresentation {
  agentAdapters: AgentAdaptersState;
  workflowLaunchConfig: WorkflowLaunchConfigView;
  uiWorkflowLaunchConfig: WorkflowLaunchConfigView;
}

export function normalizeAgentAdaptersState(
  available: AgentAdapterOption[],
  currentId: string | null | undefined,
): AgentAdaptersState {
  const availableIds = available.map((adapter) => adapter.id);
  let normalizedCurrentId = currentId ?? null;

  if (normalizedCurrentId && !availableIds.includes(normalizedCurrentId)) {
    normalizedCurrentId = availableIds[0] ?? null;
  }

  if (!normalizedCurrentId && availableIds.length === 1) {
    normalizedCurrentId = availableIds[0];
  }

  return {
    available,
    currentId: normalizedCurrentId,
  };
}

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

/** Derive labels from runtime Executor adapter, not stale settings alone. */
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

export function buildExecutorLaunchPresentation(
  workflowLaunchConfig: WorkflowLaunchConfigView,
  available: AgentAdapterOption[],
  currentId: string | null | undefined,
): ExecutorLaunchPresentation {
  const agentAdapters = normalizeAgentAdaptersState(available, currentId);
  const availableIds = agentAdapters.available.map((adapter) => adapter.id);
  const uiWorkflowLaunchConfig = resolveUiWorkflowLaunchConfig(
    workflowLaunchConfig,
    agentAdapters.currentId,
    availableIds,
  );

  if (!uiWorkflowLaunchConfig) {
    throw new Error('Unable to resolve executor launch presentation');
  }

  return {
    agentAdapters,
    workflowLaunchConfig,
    uiWorkflowLaunchConfig,
  };
}
