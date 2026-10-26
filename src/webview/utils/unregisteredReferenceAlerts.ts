import type { ReferencedStoreSpecGroup } from '../types/messages';
import {
  isUnresolvedReference,
  referenceWarningStatuses,
  type ReferenceIndexInput,
} from './referenceHealth';

export interface UnregisteredReferenceAlert {
  storeId: string;
  message?: string;
  recoveryCommand: string;
}

export function defaultReferenceRecoveryCommand(storeId: string): string {
  return `openspec store setup ${storeId} --path <path>`;
}

/** Project-first alerts for config references that are not registered locally. */
export function collectUnregisteredReferenceAlerts(
  referenceIndex: readonly ReferenceIndexInput[] | undefined,
  referencedStoreSpecs: readonly ReferencedStoreSpecGroup[] | undefined,
): UnregisteredReferenceAlert[] {
  const alerts = new Map<string, UnregisteredReferenceAlert>();

  for (const ref of referenceIndex ?? []) {
    if (!isUnresolvedReference(ref)) continue;
    const warnings = referenceWarningStatuses(ref);
    const recoveryCommand = warnings.find((status) => status.fix)?.fix
      ?? defaultReferenceRecoveryCommand(ref.store_id);
    alerts.set(ref.store_id, {
      storeId: ref.store_id,
      message: warnings[0]?.message,
      recoveryCommand,
    });
  }

  for (const group of referencedStoreSpecs ?? []) {
    if ((group.specs?.length ?? 0) > 0) continue;
    if (!group.error && !alerts.has(group.storeId)) continue;
    if (!alerts.has(group.storeId)) {
      alerts.set(group.storeId, {
        storeId: group.storeId,
        recoveryCommand: defaultReferenceRecoveryCommand(group.storeId),
      });
    }
  }

  return [...alerts.values()];
}

export function isUnregisteredReferencedStore(
  storeId: string,
  alerts: readonly UnregisteredReferenceAlert[],
): boolean {
  return alerts.some((alert) => alert.storeId === storeId);
}
