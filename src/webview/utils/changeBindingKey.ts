import { getWorkflowBindingKey } from '../../shared/changeWorkflow';
import type { ChangeInfo } from '../types/messages';
import type { OpenSpecRootBinding } from '../types/messages';

/** Binding key for workflow receipts when change.workflowSnapshot is absent (Project Sidebar). */
export function resolveChangeBindingKey(
  change: ChangeInfo,
  projectBinding?: OpenSpecRootBinding | null,
): string | undefined {
  if (change.workflowSnapshot?.bindingKey) {
    return change.workflowSnapshot.bindingKey;
  }
  if (!projectBinding) return undefined;
  return getWorkflowBindingKey({
    projectId: projectBinding.projectId,
    commandCwd: projectBinding.commandCwd,
    rootPath: projectBinding.rootPath,
    rootSource: projectBinding.rootSource,
    ...(projectBinding.storeId ? { storeId: projectBinding.storeId } : {}),
  });
}
