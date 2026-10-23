import type { ReferenceIndexEntryView } from '../types/messages';

export function referenceWarningStatuses(
  ref: ReferenceIndexEntryView,
): ReferenceIndexEntryView['status'] {
  return (ref.status ?? []).filter(
    (s) => s.severity === 'error' || s.severity === 'warning',
  );
}

/** Reference declared in config but not usable (no specs and doctor reported issues). */
export function isUnresolvedReference(ref: ReferenceIndexEntryView): boolean {
  const hasSpecs = (ref.specs?.length ?? 0) > 0;
  if (hasSpecs) return false;
  return referenceWarningStatuses(ref).length > 0;
}

export function hasUnresolvedReferences(
  references: ReferenceIndexEntryView[] | undefined,
): boolean {
  return (references ?? []).some(isUnresolvedReference);
}

export interface ScopeBarHealthView {
  status: 'ok' | 'warning';
  labelKey: 'scope.health.ok' | 'scope.health.warning' | 'scope.health.unregisteredReferences';
}

/** ScopeBar health: root doctor result plus honest warning when references are unresolved. */
export function deriveScopeBarHealth(
  rootHealthy: boolean | undefined,
  references: ReferenceIndexEntryView[] | undefined,
): ScopeBarHealthView | undefined {
  if (rootHealthy === undefined) return undefined;
  if (hasUnresolvedReferences(references)) {
    return { status: 'warning', labelKey: 'scope.health.unregisteredReferences' };
  }
  if (!rootHealthy) {
    return { status: 'warning', labelKey: 'scope.health.warning' };
  }
  return { status: 'ok', labelKey: 'scope.health.ok' };
}
