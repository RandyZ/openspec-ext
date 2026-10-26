export interface ReferenceIndexInput {
  store_id: string;
  specs?: readonly { id: string; summary?: string }[];
  status?: readonly { severity: string; code: string; message: string; fix?: string }[];
}

export function referenceWarningStatuses(
  ref: ReferenceIndexInput,
): readonly { severity: string; code: string; message: string; fix?: string }[] {
  return (ref.status ?? []).filter(
    (s) => s.severity === 'error' || s.severity === 'warning',
  );
}

/** Reference declared in config but not usable (no specs and doctor reported issues). */
export function isUnresolvedReference(ref: ReferenceIndexInput): boolean {
  const hasSpecs = (ref.specs?.length ?? 0) > 0;
  if (hasSpecs) return false;
  return referenceWarningStatuses(ref).length > 0;
}

export function hasUnresolvedReferences(
  references: readonly ReferenceIndexInput[] | undefined,
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
  references: readonly ReferenceIndexInput[] | undefined,
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
