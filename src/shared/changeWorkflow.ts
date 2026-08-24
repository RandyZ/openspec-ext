import type { WorkflowAction as WorkflowCommandAction } from './workflowCommand';
import type { WorkflowCommandTarget } from './workflowCommand';

export type WorkflowArtifactStatus = 'done' | 'ready' | 'blocked' | 'skipped';

export interface WorkflowBindingIdentity {
  readonly projectId: string;
  readonly commandCwd: string;
  readonly rootPath: string;
  readonly rootSource: string;
  readonly storeId?: string;
}

export interface WorkflowArtifactNode {
  readonly id: string;
  readonly status: WorkflowArtifactStatus;
  readonly requires: readonly string[];
  readonly missingDeps: readonly string[];
  readonly outputPath: string;
  readonly existingOutputPaths: readonly string[];
  readonly rawStatus?: string;
}

export interface ChangeWorkflowSnapshot {
  readonly changeName: string;
  readonly schema: string;
  readonly bindingKey: string;
  readonly artifacts: readonly WorkflowArtifactNode[];
  readonly diagnostics?: readonly string[];
}

export type WorkflowActionReceiptStatus =
  | 'delivered'
  | 'copied'
  | 'fallback'
  | 'running'
  | 'completed'
  | 'failed';

export interface WorkflowActionReceipt {
  readonly requestId: string;
  readonly changeName: string;
  readonly bindingKey: string;
  readonly action: WorkflowCommandAction;
  readonly target: WorkflowCommandTarget;
  readonly status: WorkflowActionReceiptStatus;
  readonly message?: string;
}

export function createWorkflowRequestId(prefix = 'workflow'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export interface WorkflowResolutionContext {
  readonly completedTasks: number;
  readonly totalTasks: number;
  readonly isArchived?: boolean;
  readonly hasDeltaSpecs?: boolean;
}

export interface ResolvedWorkflowAction {
  readonly action: WorkflowCommandAction;
  readonly label: string;
  readonly variant: 'primary' | 'secondary';
  readonly artifactId?: string;
  readonly highImpact?: boolean;
}

export interface ResolvedWorkflowActions {
  readonly recommended: ResolvedWorkflowAction | null;
  readonly available: readonly ResolvedWorkflowAction[];
  readonly highImpact: readonly ResolvedWorkflowAction[];
  readonly blocked: readonly WorkflowArtifactNode[];
  readonly skipped: readonly WorkflowArtifactNode[];
  readonly attentionReasons: readonly string[];
}

function action(
  workflowAction: WorkflowCommandAction,
  label: string,
  variant: ResolvedWorkflowAction['variant'],
  options: Pick<ResolvedWorkflowAction, 'artifactId' | 'highImpact'> = {}
): ResolvedWorkflowAction {
  return { action: workflowAction, label, variant, ...options };
}

export function resolveWorkflowActions(
  snapshot: ChangeWorkflowSnapshot,
  context: WorkflowResolutionContext
): ResolvedWorkflowActions {
  const blocked = snapshot.artifacts.filter((artifact) => artifact.status === 'blocked');
  const skipped = snapshot.artifacts.filter((artifact) => artifact.status === 'skipped');
  const attentionReasons = [...(snapshot.diagnostics ?? [])];
  const invalidProgress = context.totalTasks < 0
    || context.completedTasks < 0
    || context.completedTasks > context.totalTasks;
  if (invalidProgress) attentionReasons.push('invalid-task-progress');

  const empty = (overrides: Partial<ResolvedWorkflowActions> = {}): ResolvedWorkflowActions => ({
    recommended: null,
    available: [],
    highImpact: [],
    blocked,
    skipped,
    attentionReasons: [...new Set(attentionReasons)],
    ...overrides,
  });

  if (context.isArchived || invalidProgress || snapshot.diagnostics?.length) return empty();

  const ready = snapshot.artifacts.filter((artifact) => artifact.status === 'ready');
  const planningComplete = snapshot.artifacts.length > 0
    && snapshot.artifacts.every((artifact) => artifact.status === 'done' || artifact.status === 'skipped')
    && context.totalTasks > 0;

  if (!planningComplete) {
    if (ready.length === 0) {
      return context.hasDeltaSpecs
        ? empty({ available: [action('sync', 'Sync Specs', 'secondary')] })
        : empty();
    }
    const recommended = action('continue', 'Continue planning', 'primary', { artifactId: ready[0].id });
    const available = [
      ...ready.slice(1).map((artifact) => action(
        'continue',
        'Continue planning',
        'secondary',
        { artifactId: artifact.id }
      )),
      action('ff', 'FF', 'secondary'),
      ...(context.hasDeltaSpecs ? [action('sync', 'Sync Specs', 'secondary')] : []),
    ];
    return { ...empty(), recommended, available };
  }

  const allTasksDone = context.completedTasks === context.totalTasks;
  const recommended = allTasksDone
    ? action('verify', 'Verify', 'primary', { highImpact: true })
    : action('apply', 'Apply', 'primary');
  const highImpact = allTasksDone
    ? [action('archive', 'Archive', 'secondary', { highImpact: true })]
    : [];
  const available = context.hasDeltaSpecs
    ? [action('sync', 'Sync Specs', 'secondary')]
    : [];
  return { ...empty(), recommended, available, highImpact };
}

export function getWorkflowBindingKey(binding: WorkflowBindingIdentity): string {
  return JSON.stringify([
    binding.projectId,
    binding.commandCwd,
    binding.rootPath,
    binding.rootSource,
    binding.storeId ?? '',
  ]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isWorkflowArtifactNode(value: unknown): value is WorkflowArtifactNode {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || value.id.trim().length === 0
    || !['done', 'ready', 'blocked', 'skipped'].includes(value.status as string)
    || !isStringArray(value.requires)
    || !isStringArray(value.missingDeps)
    || typeof value.outputPath !== 'string'
    || !isStringArray(value.existingOutputPaths)) {
    return false;
  }
  return value.rawStatus === undefined || typeof value.rawStatus === 'string';
}

export function isChangeWorkflowSnapshot(
  value: unknown,
  expectedBindingKey?: string,
  expectedChangeName?: string
): value is ChangeWorkflowSnapshot {
  if (!isRecord(value)
    || typeof value.changeName !== 'string'
    || value.changeName.trim().length === 0
    || typeof value.schema !== 'string'
    || value.schema.trim().length === 0
    || typeof value.bindingKey !== 'string'
    || value.bindingKey.trim().length === 0
    || !Array.isArray(value.artifacts)) {
    return false;
  }
  if (expectedBindingKey !== undefined && value.bindingKey !== expectedBindingKey) return false;
  if (expectedChangeName !== undefined && value.changeName !== expectedChangeName) return false;
  const ids = new Set<string>();
  return value.artifacts.every((artifact) => {
    if (!isWorkflowArtifactNode(artifact) || ids.has(artifact.id)) return false;
    ids.add(artifact.id);
    return true;
  }) && (value.diagnostics === undefined || isStringArray(value.diagnostics));
}

export function isWorkflowSnapshotBoundTo(
  value: unknown,
  binding: WorkflowBindingIdentity,
  changeName?: string
): value is ChangeWorkflowSnapshot {
  return isChangeWorkflowSnapshot(value, getWorkflowBindingKey(binding), changeName);
}

/** Rebinds a valid status snapshot to the root that actually produced it. */
export function bindWorkflowSnapshot(
  value: unknown,
  binding: WorkflowBindingIdentity,
  changeName?: string
): ChangeWorkflowSnapshot | undefined {
  const bindingKey = getWorkflowBindingKey(binding);
  if (isRecord(value) && value.bindingKey !== undefined && value.bindingKey !== bindingKey) {
    return undefined;
  }
  const candidate = isRecord(value) && value.bindingKey === undefined
    ? { ...value, bindingKey }
    : value;
  if (!isChangeWorkflowSnapshot(candidate, undefined, changeName)) return undefined;
  return {
    ...candidate,
    bindingKey,
  };
}
