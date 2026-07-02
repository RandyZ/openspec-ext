import { t } from '../../i18n';
import type { OpenSpecScopeView } from '../types/messages';

/**
 * Builds a human-readable label for an OpenSpec root, distinguishing local,
 * store, and declared sources so the scope selector is unambiguous.
 */
export function formatOpenSpecRootLabel(
  scope?: Pick<OpenSpecScopeView, 'source' | 'label' | 'storeId'>,
): string {
  if (!scope) return t('scope.root.unknown');
  if (scope.source === 'store') {
    const id = scope.storeId?.trim();
    if (id) return t('scope.root.storeLabel', { id });
    // Avoid leaking a filesystem path / generic name into the label when the
    // store id is missing; fall back to a neutral root label instead.
    return t('scope.root.unknown');
  }
  if (scope.source === 'declared') {
    return t('scope.root.declaredLabel', { label: scope.label });
  }
  return t('scope.root.localLabel');
}
