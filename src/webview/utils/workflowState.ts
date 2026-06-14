import {
  buildWorkflowCommand,
  type WorkflowAction as WorkflowCommandAction,
} from '../../shared/workflowCommand';

export type WorkflowStep =
  | 'proposal'
  | 'specs'
  | 'design'
  | 'tasks'
  | 'apply'
  | 'verify'
  | 'archive';

export type StepStatus = 'done' | 'current' | 'upcoming';

export interface WorkflowAction {
  label: string;
  action: WorkflowCommandAction;
  command: string;
  variant: 'primary' | 'secondary';
}

export interface StepInfo {
  step: WorkflowStep;
  status: StepStatus;
}

export interface WorkflowState {
  steps: StepInfo[];
  currentStep: WorkflowStep;
  nextAction: WorkflowAction | null;
  secondaryActions: WorkflowAction[];
}

const ARTIFACT_STEPS: WorkflowStep[] = ['proposal', 'specs', 'design', 'tasks'];
const ALL_STEPS: WorkflowStep[] = [...ARTIFACT_STEPS, 'apply', 'verify', 'archive'];

const STEP_LABELS: Record<WorkflowStep, string> = {
  proposal: 'Proposal',
  specs: 'Specs',
  design: 'Design',
  tasks: 'Tasks',
  apply: 'Apply',
  verify: 'Verify',
  archive: 'Archive',
};

export function getStepLabel(step: WorkflowStep): string {
  return STEP_LABELS[step];
}

export function getNextArtifact(existingArtifactIds: string[] | undefined): WorkflowStep | null {
  if (!existingArtifactIds) return 'proposal';
  for (const step of ARTIFACT_STEPS) {
    if (!existingArtifactIds.includes(step)) return step;
  }
  return null;
}

export function deriveWorkflowState(
  changeName: string,
  existingArtifactIds: string[] | undefined,
  completedTasks: number,
  totalTasks: number,
  isArchived: boolean,
  hasDeltaSpecs: boolean
): WorkflowState {
  if (isArchived) {
    return {
      steps: ALL_STEPS.map((step) => ({ step, status: 'done' as StepStatus })),
      currentStep: 'archive',
      nextAction: null,
      secondaryActions: [],
    };
  }

  const has = (id: string) => existingArtifactIds?.includes(id) ?? false;
  const allArtifactsDone = ARTIFACT_STEPS.every((s) => has(s));
  const allTasksDone = totalTasks > 0 && completedTasks === totalTasks;
  const hasAnyTaskDone = completedTasks > 0;

  let currentStep: WorkflowStep;
  if (!has('proposal')) {
    currentStep = 'proposal';
  } else if (!has('specs') || !has('design')) {
    currentStep = !has('specs') ? 'specs' : 'design';
  } else if (!has('tasks')) {
    currentStep = 'tasks';
  } else if (!allTasksDone) {
    currentStep = 'apply';
  } else {
    currentStep = 'verify';
  }

  const steps: StepInfo[] = ALL_STEPS.map((step) => {
    if (step === currentStep) return { step, status: 'current' as StepStatus };

    const idx = ALL_STEPS.indexOf(step);
    const currentIdx = ALL_STEPS.indexOf(currentStep);

    if (idx < currentIdx) return { step, status: 'done' as StepStatus };

    if (ARTIFACT_STEPS.includes(step) && has(step)) {
      return { step, status: 'done' as StepStatus };
    }

    return { step, status: 'upcoming' as StepStatus };
  });

  const nextAction = buildPrimaryAction(changeName, currentStep);

  const secondaryActions: WorkflowAction[] = [];

  const nextArtifact = getNextArtifact(existingArtifactIds);
  if (nextArtifact) {
    secondaryActions.push({
      label: 'FF',
      action: 'ff',
      command: buildWorkflowCommand({ action: 'ff', changeName, target: 'clipboard' }),
      variant: 'secondary',
    });
  }

  if (allArtifactsDone && !allTasksDone) {
    // Verify and Archive are high-impact flows and now live in the dedicated tab.
  }

  if (hasDeltaSpecs) {
    secondaryActions.push({
      label: 'Sync Specs',
      action: 'sync',
      command: buildWorkflowCommand({ action: 'sync', changeName, target: 'clipboard' }),
      variant: 'secondary',
    });
  }

  return { steps, currentStep, nextAction, secondaryActions };
}

function buildPrimaryAction(changeName: string, currentStep: WorkflowStep): WorkflowAction | null {
  switch (currentStep) {
    case 'proposal':
      return {
        label: 'Continue → Proposal',
        action: 'continue',
        command: buildWorkflowCommand({ action: 'continue', changeName, target: 'clipboard' }),
        variant: 'primary',
      };
    case 'specs':
      return {
        label: 'Continue → Specs',
        action: 'continue',
        command: buildWorkflowCommand({ action: 'continue', changeName, target: 'clipboard' }),
        variant: 'primary',
      };
    case 'design':
      return {
        label: 'Continue → Design',
        action: 'continue',
        command: buildWorkflowCommand({ action: 'continue', changeName, target: 'clipboard' }),
        variant: 'primary',
      };
    case 'tasks':
      return {
        label: 'Continue → Tasks',
        action: 'continue',
        command: buildWorkflowCommand({ action: 'continue', changeName, target: 'clipboard' }),
        variant: 'primary',
      };
    case 'apply':
      return {
        label: 'Apply',
        action: 'apply',
        command: buildWorkflowCommand({ action: 'apply', changeName, target: 'clipboard' }),
        variant: 'primary',
      };
    case 'verify':
      return null;
    default:
      return null;
  }
}
