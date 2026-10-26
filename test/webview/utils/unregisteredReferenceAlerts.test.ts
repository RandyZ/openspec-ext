import { describe, expect, it } from 'vitest';
import {
  collectUnregisteredReferenceAlerts,
  defaultReferenceRecoveryCommand,
} from '../../../src/webview/utils/unregisteredReferenceAlerts';

describe('unregisteredReferenceAlerts', () => {
  it('collects unresolved entries from doctor reference index', () => {
    const alerts = collectUnregisteredReferenceAlerts(
      [
        {
          store_id: 'fixture-plans',
          status: [
            {
              severity: 'warning',
              code: 'reference_unresolved',
              message: 'Store is not registered locally.',
              fix: 'openspec store register /tmp/fixture-plans',
            },
          ],
        },
      ],
      [],
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0].storeId).toBe('fixture-plans');
    expect(alerts[0].recoveryCommand).toContain('openspec store register');
  });

  it('falls back to spec load errors when doctor index is absent', () => {
    const alerts = collectUnregisteredReferenceAlerts(undefined, [
      {
        storeId: 'demo-plans',
        specs: [],
        error: 'Unable to load Specs for referenced Store "demo-plans".',
      },
    ]);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].recoveryCommand).toBe(defaultReferenceRecoveryCommand('demo-plans'));
  });
});
