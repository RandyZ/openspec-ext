import {
  buildExecutorLaunchPresentation,
  normalizeAgentAdaptersState,
  type AgentAdaptersState,
  type ExecutorLaunchPresentation,
} from '../../shared/executorLaunchPresentation';
import {
  isCopyOnlyWorkflowMode,
  toWorkflowLaunchConfigView,
  type WorkflowLaunchConfigView,
} from '../../shared/workflowLaunchConfig';

/** Embedded in webview bundle for VSIX unpack verification (survives minification). */
export const WEBVIEW_EXECUTOR_UI_BUILD_MARKER = 'openspec-webview-executor-ui-v1';
export const WEBVIEW_EXECUTOR_FN_MARKER = 'buildExecutorLaunchPresentation';

const COPY_ONLY_FALLBACK = toWorkflowLaunchConfigView({
  workflowLaunchMode: 'clipboard',
  preferredAgentAdapter: 'clipboard',
  cursorLaunchMode: 'clipboard',
  cursorAgentModel: 'auto',
  cursorLaunchModeExplicit: false,
});

export function getCopyOnlyFallbackLaunchConfig(): WorkflowLaunchConfigView {
  return COPY_ONLY_FALLBACK;
}

export function normalizePresentationAdapters(
  presentation: ExecutorLaunchPresentation | null | undefined,
): AgentAdaptersState {
  if (!presentation) {
    return { available: [], currentId: null };
  }
  return normalizeAgentAdaptersState(
    presentation.agentAdapters.available,
    presentation.agentAdapters.currentId,
  );
}

export function shouldForceCopyOnlyAdapters(adapters: AgentAdaptersState): boolean {
  if (adapters.available.length === 1 && adapters.available[0]?.id === 'clipboard') {
    return true;
  }
  if (adapters.currentId === 'clipboard') {
    return true;
  }
  const availableIds = adapters.available.map((adapter) => adapter.id);
  if (adapters.currentId && !availableIds.includes(adapters.currentId)) {
    return true;
  }
  return false;
}

/** Single webview entry for executor-driven ActionBar/TaskList labels. */
export function resolveExecutorUiLaunchConfig(
  presentation: ExecutorLaunchPresentation | null | undefined,
): WorkflowLaunchConfigView {
  if (!presentation) {
    return COPY_ONLY_FALLBACK;
  }

  const normalizedAdapters = normalizePresentationAdapters(presentation);
  if (normalizedAdapters.available.length === 0 || shouldForceCopyOnlyAdapters(normalizedAdapters)) {
    const built = buildExecutorLaunchPresentation(
      presentation.workflowLaunchConfig,
      normalizedAdapters.available.length > 0
        ? normalizedAdapters.available
        : [{ id: 'clipboard', displayName: 'Clipboard (copy to clipboard)' }],
      normalizedAdapters.currentId ?? 'clipboard',
    );
    if (isCopyOnlyWorkflowMode(built.uiWorkflowLaunchConfig)) {
      return built.uiWorkflowLaunchConfig;
    }
    return COPY_ONLY_FALLBACK;
  }

  return buildExecutorLaunchPresentation(
    presentation.workflowLaunchConfig,
    normalizedAdapters.available,
    normalizedAdapters.currentId,
  ).uiWorkflowLaunchConfig;
}

export function normalizeExecutorPresentation(
  presentation: ExecutorLaunchPresentation,
): ExecutorLaunchPresentation {
  const normalizedAdapters = normalizePresentationAdapters(presentation);
  return buildExecutorLaunchPresentation(
    presentation.workflowLaunchConfig,
    normalizedAdapters.available,
    normalizedAdapters.currentId,
  );
}
