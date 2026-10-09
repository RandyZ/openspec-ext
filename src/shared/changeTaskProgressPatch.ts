import type { ActiveChangeLifecycleStatus, ChangeAttention } from './changeLifecycle';

export interface ChangeTaskProgressPatch {
  type: 'changeTaskProgressPatch';
  changeName: string;
  scopeId?: string;
  /** Canonical OpenSpec root for this change; used to match project-bound detail panels. */
  changeRootPath?: string;
  completedTasks: number;
  totalTasks: number;
  tasksContent?: string;
  lifecycleStatus?: ActiveChangeLifecycleStatus;
  attention?: ChangeAttention;
  revisedAt: number;
}

export function isChangeTaskProgressPatch(value: unknown): value is ChangeTaskProgressPatch {
  if (!value || typeof value !== 'object') return false;
  const patch = value as Partial<ChangeTaskProgressPatch>;
  return patch.type === 'changeTaskProgressPatch'
    && typeof patch.changeName === 'string'
    && typeof patch.completedTasks === 'number'
    && typeof patch.totalTasks === 'number'
    && typeof patch.revisedAt === 'number';
}
