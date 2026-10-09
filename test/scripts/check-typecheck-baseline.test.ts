import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('check-typecheck-baseline.sh', () => {
  const script = readFileSync(
    path.resolve(__dirname, '../../scripts/check-typecheck-baseline.sh'),
    'utf8',
  );

  it('counts TypeScript errors with grep (no ripgrep dependency)', () => {
    expect(script).toMatch(/grep -c 'error TS'/);
    expect(script).not.toMatch(/\brg\b/);
  });

  it('uses strict bash and validates the parsed count', () => {
    expect(script).toContain('set -euo pipefail');
    expect(script).toContain('could not parse TypeScript error count');
  });
});
