export type WorkflowLaunchMode = 'clipboard' | 'adapter';
export type CursorLaunchMode = 'deeplink' | 'chatCommand' | 'clipboard' | 'agentCli';
export type PreferredAgentAdapter =
  | 'clipboard'
  | 'cursor'
  | 'vscode-copilot'
  | 'claude-code'
  | 'opencode';

export interface WorkflowLaunchConfig {
  workflowLaunchMode: WorkflowLaunchMode;
  preferredAgentAdapter: PreferredAgentAdapter;
  cursorLaunchMode: CursorLaunchMode;
  cursorAgentModel: string;
  cursorLaunchModeExplicit: boolean;
}

export interface WorkflowLaunchConfigWithExplicit extends WorkflowLaunchConfig {
  workflowLaunchModeExplicit: boolean;
  preferredAgentAdapterExplicit: boolean;
}

export interface WorkflowLaunchRuntimeContext {
  isCursorHost: boolean;
}

export type EffectiveWorkflowAdapterId = PreferredAgentAdapter | null;

export interface WorkflowLaunchConfigView extends WorkflowLaunchConfig {
  effectiveAdapterId: EffectiveWorkflowAdapterId;
}

export function shouldForceCursorWorkflowRoute(config: WorkflowLaunchConfig): boolean {
  return config.cursorLaunchModeExplicit && config.cursorLaunchMode !== 'clipboard';
}

export function resolveWorkflowLaunchConfig(
  config: WorkflowLaunchConfigWithExplicit,
  context: WorkflowLaunchRuntimeContext,
): WorkflowLaunchConfig {
  if (shouldForceCursorWorkflowRoute(config)) {
    return {
      workflowLaunchMode: config.workflowLaunchMode,
      preferredAgentAdapter: config.preferredAgentAdapter,
      cursorLaunchMode: config.cursorLaunchMode,
      cursorAgentModel: config.cursorAgentModel,
      cursorLaunchModeExplicit: config.cursorLaunchModeExplicit,
    };
  }

  let { workflowLaunchMode, preferredAgentAdapter, cursorLaunchMode } = config;

  if (!config.workflowLaunchModeExplicit && !config.cursorLaunchModeExplicit && context.isCursorHost) {
    workflowLaunchMode = 'adapter';
  }

  if (!config.preferredAgentAdapterExplicit && workflowLaunchMode === 'adapter' && context.isCursorHost) {
    preferredAgentAdapter = 'cursor';
  }

  if (
    !config.cursorLaunchModeExplicit &&
    config.cursorLaunchMode === 'clipboard' &&
    workflowLaunchMode === 'adapter' &&
    preferredAgentAdapter === 'cursor'
  ) {
    cursorLaunchMode = 'deeplink';
  }

  return {
    workflowLaunchMode,
    preferredAgentAdapter,
    cursorLaunchMode,
    cursorAgentModel: config.cursorAgentModel,
    cursorLaunchModeExplicit: config.cursorLaunchModeExplicit,
  };
}

export function isCopyOnlyWorkflowMode(config: WorkflowLaunchConfigView): boolean {
  return config.effectiveAdapterId == null || config.effectiveAdapterId === 'clipboard';
}

export function getEffectiveWorkflowAdapterId(
  config: WorkflowLaunchConfig
): EffectiveWorkflowAdapterId {
  if (shouldForceCursorWorkflowRoute(config)) {
    return 'cursor';
  }
  if (config.workflowLaunchMode === 'adapter') {
    return config.preferredAgentAdapter;
  }
  return null;
}

export function toWorkflowLaunchConfigView(
  config: WorkflowLaunchConfig
): WorkflowLaunchConfigView {
  return {
    ...config,
    effectiveAdapterId: getEffectiveWorkflowAdapterId(config),
  };
}
