import type { WorkflowAction } from './workflowCommand';

export type ActiveChangeLifecycleStatus =
  | 'planning'
  | 'ready-to-apply'
  | 'applying'
  | 'ready-to-verify';

export type ChangeLifecycleStatus = ActiveChangeLifecycleStatus | 'archived';

export type ChangeAttentionReason =
  | 'invalid-task-progress'
  | 'invalid-artifact-status'
  | 'invalid-artifact-path'
  | 'metadata-read-failed'
  | 'validation-failed'
  | 'root-write-unavailable';

export interface ChangeAttention {
  required: boolean;
  reasons: ChangeAttentionReason[];
}

export interface ChangeStatusCounts {
  all: number;
  planning: number;
  readyToApply: number;
  applying: number;
  readyToVerify: number;
  archived: number;
  needsAttention: number;
}

export type KnownArtifactStatus = 'done' | 'ready' | 'blocked';

export interface LifecycleArtifactStatus {
  id: string;
  outputPath: string;
  status: KnownArtifactStatus;
}

export interface LifecycleArtifactInput {
  id: string;
  outputPath: string;
  status: string;
}

export interface DeriveChangeLifecycleInput {
  artifacts: LifecycleArtifactInput[];
  completedTasks: number;
  totalTasks: number;
}

export interface DeriveChangeLifecycleResult {
  status: ActiveChangeLifecycleStatus;
  attention: ChangeAttention;
  normalizedArtifacts: LifecycleArtifactStatus[];
  normalizedCompletedTasks: number;
  normalizedTotalTasks: number;
}

export interface WorkflowActionDescriptor {
  readonly action: WorkflowAction;
  readonly variant: 'primary' | 'secondary';
}

const KNOWN_ARTIFACT_STATUSES = new Set<KnownArtifactStatus>(['done', 'ready', 'blocked']);

const LIFECYCLE_WORKFLOW_ACTIONS: Record<
  ChangeLifecycleStatus,
  readonly WorkflowAction[]
> = {
  planning: ['continue', 'ff'],
  'ready-to-apply': ['apply'],
  applying: ['apply'],
  'ready-to-verify': ['verify'],
  archived: [],
};

function isValidOutputPath(outputPath: string): boolean {
  return outputPath.trim().length > 0;
}

function normalizeArtifact(artifact: LifecycleArtifactInput): {
  artifact: LifecycleArtifactStatus;
  reasons: ChangeAttentionReason[];
} {
  const reasons: ChangeAttentionReason[] = [];

  if (!artifact.id || artifact.id.trim() === '') {
    reasons.push('invalid-artifact-status');
  }

  if (!isValidOutputPath(artifact.outputPath)) {
    reasons.push('invalid-artifact-path');
  }

  let status: KnownArtifactStatus;
  if (artifact.status === 'complete') {
    status = 'done';
  } else if (KNOWN_ARTIFACT_STATUSES.has(artifact.status as KnownArtifactStatus)) {
    status = artifact.status as KnownArtifactStatus;
  } else {
    reasons.push('invalid-artifact-status');
    status = 'blocked';
  }

  return {
    artifact: {
      id: artifact.id,
      outputPath: artifact.outputPath,
      status,
    },
    reasons,
  };
}

function normalizeLifecycleInput(input: DeriveChangeLifecycleInput): {
  artifacts: LifecycleArtifactStatus[];
  completedTasks: number;
  totalTasks: number;
  attentionReasons: ChangeAttentionReason[];
} {
  const artifactResults = input.artifacts.map(normalizeArtifact);
  const artifacts = artifactResults.map((result) => result.artifact);
  const attentionReasons = artifactResults.flatMap((result) => result.reasons);

  let completedTasks = input.completedTasks;
  const totalTasks = input.totalTasks;

  if (completedTasks < 0) {
    attentionReasons.push('invalid-task-progress');
    completedTasks = 0;
  }

  if (completedTasks > totalTasks) {
    attentionReasons.push('invalid-task-progress');
  }

  return {
    artifacts,
    completedTasks,
    totalTasks,
    attentionReasons: [...new Set(attentionReasons)],
  };
}

function buildAttention(reasons: ChangeAttentionReason[]): ChangeAttention {
  return {
    required: reasons.length > 0,
    reasons,
  };
}

function deriveStatusFromNormalized(input: {
  artifacts: LifecycleArtifactStatus[];
  completedTasks: number;
  totalTasks: number;
}): ActiveChangeLifecycleStatus {
  const hasArtifacts = input.artifacts.length > 0;
  const allSchemaArtifactsDone =
    hasArtifacts && input.artifacts.every((artifact) => artifact.status === 'done');

  if (!allSchemaArtifactsDone || input.totalTasks === 0) {
    return 'planning';
  }

  if (input.completedTasks <= 0) {
    return 'ready-to-apply';
  }

  if (input.completedTasks < input.totalTasks) {
    return 'applying';
  }

  return 'ready-to-verify';
}

export function deriveChangeAttention(input: DeriveChangeLifecycleInput): ChangeAttention {
  const normalized = normalizeLifecycleInput(input);
  return buildAttention(normalized.attentionReasons);
}

export function deriveChangeLifecycle(
  input: DeriveChangeLifecycleInput
): DeriveChangeLifecycleResult {
  const normalized = normalizeLifecycleInput(input);
  const attention = buildAttention(normalized.attentionReasons);
  const status =
    attention.required
      ? 'planning'
      : deriveStatusFromNormalized({
          artifacts: normalized.artifacts,
          completedTasks: normalized.completedTasks,
          totalTasks: normalized.totalTasks,
        });

  return {
    status,
    attention,
    normalizedArtifacts: normalized.artifacts,
    normalizedCompletedTasks: normalized.completedTasks,
    normalizedTotalTasks: normalized.totalTasks,
  };
}

export function deriveChangeLifecycleStatus(
  input: DeriveChangeLifecycleInput
): ActiveChangeLifecycleStatus {
  return deriveChangeLifecycle(input).status;
}

export interface EnrichableChange {
  name: string;
  completedTasks: number;
  totalTasks: number;
  lastModified: string;
  createdAt?: string;
  status: 'draft' | 'in-progress' | 'complete';
  artifacts?: LifecycleArtifactInput[];
  lifecycleStatus?: ActiveChangeLifecycleStatus;
  attention?: ChangeAttention;
  proposalWhySummary?: string;
  proposalWhyFullText?: string;
  searchText?: string;
}

export interface EnrichedChange extends EnrichableChange {
  lifecycleStatus: ActiveChangeLifecycleStatus;
}

/**
 * Derive Host lifecycle fields for a change. Status-read failures must pass
 * `attention.reasons` including `metadata-read-failed` so empty artifacts are
 * not treated as a legitimate empty graph.
 */
export function enrichChangeWithLifecycle<T extends EnrichableChange>(change: T): T & EnrichedChange {
  if (change.attention?.reasons.includes('metadata-read-failed')) {
    const reasons = [...new Set(change.attention.reasons)];
    return {
      ...change,
      lifecycleStatus: 'planning',
      attention: { required: true, reasons },
    };
  }

  const derived = deriveChangeLifecycle({
    artifacts: change.artifacts ?? [],
    completedTasks: change.completedTasks,
    totalTasks: change.totalTasks,
  });

  if (derived.attention.required) {
    return {
      ...change,
      lifecycleStatus: derived.status,
      attention: derived.attention,
    };
  }

  const { attention: _ignored, ...rest } = change;
  return {
    ...rest,
    lifecycleStatus: derived.status,
  };
}

export interface CountableActiveChange {
  lifecycleStatus: ActiveChangeLifecycleStatus;
  attention?: ChangeAttention;
}

/** Pure full-snapshot counts for one Root (not page/search filtered). */
export function buildChangeStatusCounts(
  activeChanges: readonly CountableActiveChange[],
  archivedChanges: readonly unknown[]
): ChangeStatusCounts {
  const counts: ChangeStatusCounts = {
    all: activeChanges.length + archivedChanges.length,
    planning: 0,
    readyToApply: 0,
    applying: 0,
    readyToVerify: 0,
    archived: archivedChanges.length,
    needsAttention: 0,
  };

  for (const change of activeChanges) {
    switch (change.lifecycleStatus) {
      case 'planning':
        counts.planning += 1;
        break;
      case 'ready-to-apply':
        counts.readyToApply += 1;
        break;
      case 'applying':
        counts.applying += 1;
        break;
      case 'ready-to-verify':
        counts.readyToVerify += 1;
        break;
      default:
        break;
    }
    if (change.attention?.required) {
      counts.needsAttention += 1;
    }
  }

  return counts;
}

export function getWorkflowActionsForLifecycle(
  lifecycleStatus: ChangeLifecycleStatus
): WorkflowActionDescriptor[] {
  return LIFECYCLE_WORKFLOW_ACTIONS[lifecycleStatus].map((action, index) => ({
    action,
    variant: index === 0 ? 'primary' : 'secondary',
  }));
}
