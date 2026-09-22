import { t } from '../../i18n';
import type { WorkflowLaunchConfigView } from '../../shared/workflowLaunchConfig';
import { shouldUseAgentWorkflowLabels } from '../../shared/workflowLaunchConfig';

export function getTaskNextButtonLabel(
  config?: WorkflowLaunchConfigView | null,
  options?: { working?: boolean },
): string {
  if (options?.working) {
    return t('task.working');
  }
  if (!config || !shouldUseAgentWorkflowLabels(config)) {
    return t('task.copy');
  }
  return t('task.nextWithAgent');
}
