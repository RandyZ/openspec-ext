export type WorkflowLaunchMode = 'clipboard' | 'adapter';
export type CursorLaunchMode =
  | 'agentPanel'
  | 'deeplink'
  | 'chatCommand'
  | 'clipboard'
  | 'agentCli';
export type PreferredAgentAdapter =
  | 'clipboard'
  | 'cursor'
  | 'vscode-copilot'
  | 'vscode-chat'
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

/** User explicitly chose copy-only via settings (package defaults do not count). */
export function isExplicitCopyOnlyConfig(config: WorkflowLaunchConfigWithExplicit): boolean {
  return (config.workflowLaunchModeExplicit && config.workflowLaunchMode === 'clipboard')
    || (config.preferredAgentAdapterExplicit && config.preferredAgentAdapter === 'clipboard');
}

export function shouldForceCursorWorkflowRoute(config: WorkflowLaunchConfig): boolean {
  return config.cursorLaunchModeExplicit && config.cursorLaunchMode === 'agentCli';
}

export function resolveWorkflowLaunchConfig(
  config: WorkflowLaunchConfigWithExplicit,
  context: WorkflowLaunchRuntimeContext,
): WorkflowLaunchConfig {
  const explicitCopyOnly = isExplicitCopyOnlyConfig(config);

  let { workflowLaunchMode, preferredAgentAdapter, cursorLaunchMode } = config;

  if (context.isCursorHost && !explicitCopyOnly) {
    if (!config.workflowLaunchModeExplicit && workflowLaunchMode === 'clipboard') {
      workflowLaunchMode = 'adapter';
    }
    if (
      !config.preferredAgentAdapterExplicit
      && preferredAgentAdapter === 'clipboard'
      && workflowLaunchMode === 'adapter'
    ) {
      preferredAgentAdapter = 'cursor';
    }
    if (
      config.cursorLaunchModeExplicit
      && cursorLaunchMode !== 'clipboard'
      && cursorLaunchMode !== 'agentCli'
    ) {
      if (!config.workflowLaunchModeExplicit) {
        workflowLaunchMode = 'adapter';
      }
      if (!config.preferredAgentAdapterExplicit && preferredAgentAdapter === 'clipboard') {
        preferredAgentAdapter = 'cursor';
      }
    }
  }

  if (
    !config.cursorLaunchModeExplicit
    && cursorLaunchMode === 'clipboard'
    && workflowLaunchMode === 'adapter'
    && preferredAgentAdapter === 'cursor'
  ) {
    cursorLaunchMode = 'agentPanel';
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

/** Label/intent: adapter mode with a non-clipboard preferred adapter uses Agent verbs. */
export function shouldUseAgentWorkflowLabels(config: WorkflowLaunchConfigView): boolean {
  if (config.effectiveAdapterId === 'cursor' && config.cursorLaunchMode === 'clipboard') {
    return false;
  }
  if (config.workflowLaunchMode === 'adapter' && config.preferredAgentAdapter !== 'clipboard') {
    return true;
  }
  return !isCopyOnlyWorkflowMode(config);
}

export function getEffectiveWorkflowAdapterId(
  config: WorkflowLaunchConfig,
): EffectiveWorkflowAdapterId {
  if (config.workflowLaunchMode === 'clipboard') {
    return 'clipboard';
  }
  if (config.workflowLaunchMode === 'adapter') {
    return config.preferredAgentAdapter === 'clipboard' ? 'clipboard' : config.preferredAgentAdapter;
  }
  if (shouldForceCursorWorkflowRoute(config)) {
    return 'cursor';
  }
  return null;
}

export function toWorkflowLaunchConfigView(
  config: WorkflowLaunchConfig,
): WorkflowLaunchConfigView {
  return {
    ...config,
    effectiveAdapterId: getEffectiveWorkflowAdapterId(config),
  };
}
