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

export type EffectiveWorkflowAdapterId = PreferredAgentAdapter | null;

export interface WorkflowLaunchConfigView extends WorkflowLaunchConfig {
  effectiveAdapterId: EffectiveWorkflowAdapterId;
}

export function shouldForceCursorWorkflowRoute(config: WorkflowLaunchConfig): boolean {
  return config.cursorLaunchModeExplicit && config.cursorLaunchMode !== 'clipboard';
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
