import {
  toWorkflowLaunchConfigView,
  type PreferredAgentAdapter,
  type WorkflowLaunchConfigView,
} from '../../shared/workflowLaunchConfig';

/**
 * Derive the workflow launch view used by Tasks rows, ActionBar, and hints from
 * the extension config plus the live Executor dropdown selection (single UI source).
 */
export function resolveUiWorkflowLaunchConfig(
  config: WorkflowLaunchConfigView | null,
  currentAdapterId: string | null | undefined,
): WorkflowLaunchConfigView | null {
  if (!config) return null;
  const preferredAgentAdapter = (currentAdapterId ?? config.preferredAgentAdapter) as PreferredAgentAdapter;
  return toWorkflowLaunchConfigView({
    workflowLaunchMode: config.workflowLaunchMode,
    preferredAgentAdapter,
    cursorLaunchMode: config.cursorLaunchMode,
    cursorAgentModel: config.cursorAgentModel,
    cursorLaunchModeExplicit: config.cursorLaunchModeExplicit,
  });
}
