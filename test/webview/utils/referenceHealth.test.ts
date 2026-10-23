import { describe, expect, it } from 'vitest';
import {
  deriveScopeBarHealth,
  hasUnresolvedReferences,
  isUnresolvedReference,
} from '../../../src/webview/utils/referenceHealth';

describe('referenceHealth', () => {
  it('treats doctor warning status without specs as unresolved', () => {
    expect(
      isUnresolvedReference({
        store_id: 'fixture-plans',
        status: [
          {
            severity: 'warning',
            code: 'reference_unresolved',
            message: 'Store is not registered locally.',
            fix: 'openspec store register /path/to/fixture-plans',
          },
        ],
      }),
    ).toBe(true);
  });

  it('does not treat resolved references with specs as unresolved', () => {
    expect(
      isUnresolvedReference({
        store_id: 'fixture-plans',
        specs: [{ id: 'billing' }],
        status: [],
      }),
    ).toBe(false);
  });

  it('derives scope bar warning when root is healthy but a reference is unresolved', () => {
    expect(
      deriveScopeBarHealth(true, [
        {
          store_id: 'fixture-plans',
          status: [
            {
              severity: 'warning',
              code: 'reference_unresolved',
              message: 'Store is not registered locally.',
            },
          ],
        },
      ]),
    ).toEqual({
      status: 'warning',
      labelKey: 'scope.health.unregisteredReferences',
    });
  });

  it('prefers unregistered reference label over generic root issues', () => {
    expect(hasUnresolvedReferences([{ store_id: 'demo-plans', status: [{ severity: 'warning', code: 'reference_unresolved', message: 'x' }] }])).toBe(
      true,
    );
    expect(
      deriveScopeBarHealth(false, [
        {
          store_id: 'demo-plans',
          status: [{ severity: 'warning', code: 'reference_unresolved', message: 'x' }],
        },
      ]),
    ).toEqual({
      status: 'warning',
      labelKey: 'scope.health.unregisteredReferences',
    });
  });
});
