import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const source = readFileSync(
  path.resolve(__dirname, '../../../src/webview/hooks/useWorkflowLaunchPending.ts'),
  'utf8',
);

describe('useWorkflowLaunchPending paint anchoring', () => {
  it('starts the min-visible clock after two requestAnimationFrame callbacks', () => {
    const registerBlock = source.slice(
      source.indexOf('const registerLaunch = useCallback('),
      source.indexOf('const handleReceipt = useCallback('),
    );
    expect(registerBlock).toContain('requestAnimationFrame');
    expect(registerBlock.match(/requestAnimationFrame/g)?.length).toBeGreaterThanOrEqual(2);
    expect(registerBlock).not.toMatch(/pendingStartedAtRef\.current\.set\(key, Date\.now\(\)\);\s*\n\s*const existing/);
  });

  it('defers min-visible clear until paint anchor when receipt arrives early', () => {
    const receiptBlock = source.slice(
      source.indexOf('const handleReceipt = useCallback('),
      source.indexOf('useEffect(() => () => {'),
    );
    expect(receiptBlock).toContain('clearAfterMinVisible');
    expect(receiptBlock).toContain('requestAnimationFrame');
  });
});
