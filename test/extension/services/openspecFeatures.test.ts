import { describe, expect, it, vi } from 'vitest';
import { detectOpenSpecFeatures } from '@extension/services/openspecFeatures';

describe('detectOpenSpecFeatures', () => {
  it('marks store features available when probes succeed', async () => {
    const cli = {
      runJson: vi.fn()
        .mockResolvedValueOnce({ stores: [], status: [] })
        .mockResolvedValueOnce({ root: { path: '/repo', source: 'nearest' }, members: [], status: [] })
        .mockResolvedValueOnce({ root: { path: '/repo', healthy: true, status: [] }, references: [], status: [] }),
    };

    await expect(detectOpenSpecFeatures(cli as any)).resolves.toMatchObject({
      stores: true,
      context: true,
      doctor: true,
    });
  });

  it('keeps base dashboard available when store probe fails', async () => {
    const cli = { runJson: vi.fn().mockRejectedValue(new Error('unknown command store')) };

    const result = await detectOpenSpecFeatures(cli as any);
    expect(result.stores).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'store_features_unavailable' })]),
    );
  });

  it('detects workset support separately', async () => {
    const cli = {
      runJson: vi.fn()
        .mockResolvedValueOnce({ stores: [], status: [] })
        .mockResolvedValueOnce({ root: { path: '/repo' }, members: [], status: [] })
        .mockResolvedValueOnce({ root: { path: '/repo', healthy: true }, references: [], status: [] })
        .mockRejectedValueOnce(new Error('unknown command workset')),
    };

    await expect(detectOpenSpecFeatures(cli as any)).resolves.toMatchObject({
      stores: true,
      context: true,
      doctor: true,
      worksets: false,
      diagnostics: [expect.objectContaining({ code: 'workset_feature_unavailable' })],
    });
  });
});
