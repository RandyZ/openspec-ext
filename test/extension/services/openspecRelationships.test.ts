import { describe, expect, it, vi } from 'vitest';
import { loadScopeRelationships } from '@extension/services/openspecScope';

describe('loadScopeRelationships', () => {
  it('loads context and doctor data for a store scope', async () => {
    const cli = {
      runJson: vi
        .fn()
        .mockResolvedValueOnce({
          root: {
            path: '/stores/team-plans',
            source: 'store',
            store_id: 'team-plans',
          },
          members: [
            {
              role: 'referenced_store',
              id: 'platform-reqs',
              path: '/stores/platform-reqs',
              status: [],
            },
          ],
          status: [],
        })
        .mockResolvedValueOnce({
          root: { path: '/stores/team-plans', healthy: true, status: [] },
          references: [
            {
              store_id: 'platform-reqs',
              specs: [{ id: 'billing', summary: 'Billing requirements' }],
              fetch: 'openspec show billing --type spec --store platform-reqs',
              status: [],
            },
          ],
          status: [],
        }),
    };

    const scope = { storeId: 'team-plans', rootPath: '/stores/team-plans' };

    await expect(loadScopeRelationships(cli as any, scope as any)).resolves.toMatchObject({
      references: [expect.objectContaining({ store_id: 'platform-reqs' })],
      health: expect.objectContaining({
        root: expect.objectContaining({ healthy: true }),
      }),
    });
  });

  it('loads empty references for local root', async () => {
    const cli = {
      runJson: vi
        .fn()
        .mockResolvedValueOnce({
          root: { path: '/workspace', source: 'nearest' },
          members: [],
          status: [],
        })
        .mockResolvedValueOnce({
          root: { path: '/workspace', healthy: true, status: [] },
          references: [],
          status: [],
        }),
    };

    const scope = { rootPath: '/workspace' };

    await expect(loadScopeRelationships(cli as any, scope as any)).resolves.toMatchObject({
      references: [],
    });
  });
});
