import { describe, expect, it } from 'vitest';
import { normalizeAgentAdaptersState } from '../../../src/webview/utils/agentAdaptersState';

describe('normalizeAgentAdaptersState', () => {
  it('aligns currentId with the only available adapter', () => {
    expect(
      normalizeAgentAdaptersState(
        [{ id: 'clipboard', displayName: 'Clipboard (copy to clipboard)' }],
        'cursor',
      ),
    ).toEqual({
      available: [{ id: 'clipboard', displayName: 'Clipboard (copy to clipboard)' }],
      currentId: 'clipboard',
    });
  });
});
