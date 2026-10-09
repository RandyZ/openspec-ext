import { readFileSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { describe, expect, it } from 'vitest';

describe('check-typecheck-baseline.sh', () => {
  const scriptPath = path.resolve(__dirname, '../../scripts/check-typecheck-baseline.sh');
  const script = readFileSync(scriptPath, 'utf8');

  it('counts TypeScript errors with grep (no ripgrep dependency)', () => {
    expect(script).toMatch(/grep -c 'error TS'/);
    expect(script).not.toMatch(/\brg\b/);
  });

  it('uses strict bash, baseline 12, and rejects tsc crash without error TS lines', () => {
    expect(script).toContain('set -euo pipefail');
    expect(script).toContain('TSC_BASELINE_ERROR_COUNT:-12');
    expect(script).toContain("no 'error TS' lines were counted");
  });

  it('fails when tsc cannot start (non-zero exit, no error TS lines)', () => {
    const result = spawnSync('bash', [scriptPath], {
      env: {
        ...process.env,
        CHECK_TYPECHECK_TSC_INVOKE: 'echo "Cannot find module \'/tmp/typescript/bin/tsc\'" >&2; exit 1',
        TSC_BASELINE_ERROR_COUNT: '12',
      },
      encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("no 'error TS' lines were counted");
    expect(`${result.stdout}${result.stderr}`).toContain('Cannot find module');
  });

  it('fails when tsc aborts without diagnostics (e.g. OOM exit 134)', () => {
    const result = spawnSync('bash', [scriptPath], {
      env: {
        ...process.env,
        CHECK_TYPECHECK_TSC_INVOKE: 'echo "Killed" >&2; exit 134',
        TSC_BASELINE_ERROR_COUNT: '12',
      },
      encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("no 'error TS' lines were counted");
  });
});
