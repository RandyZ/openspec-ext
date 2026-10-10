import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { countOpenSpecTaskProgress } from '../../src/shared/openspecTaskProgress';

describe('openspecTaskProgress (CLI-aligned)', () => {
  it('matches ws2-zeta-markers fixture (3/8)', () => {
    const content = readFileSync(
      path.join(process.cwd(), 'test-fixtures/ws2-zeta-markers/tasks.md'),
      'utf-8',
    );
    expect(countOpenSpecTaskProgress(content)).toEqual({ completed: 3, total: 8 });
  });

  it('counts ordered and plus markers the legacy parser missed', () => {
    const content = ['* [ ] star', '1. [x] ordered', '+ [ ] plus'].join('\n');
    expect(countOpenSpecTaskProgress(content)).toEqual({ completed: 1, total: 3 });
  });
});
