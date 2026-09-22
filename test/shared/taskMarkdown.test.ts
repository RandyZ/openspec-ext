import { describe, expect, it } from 'vitest';
import { countTaskProgress, parseTaskLine } from '../../src/shared/taskMarkdown';

describe('taskMarkdown', () => {
  it('parses open, done, and in-progress markers', () => {
    expect(parseTaskLine('- [ ] Todo')?.marker).toBe('open');
    expect(parseTaskLine('- [x] Done')?.done).toBe(true);
    expect(parseTaskLine('- [~] Working')?.inProgress).toBe(true);
    expect(parseTaskLine('- [～] Fullwidth tilde')?.inProgress).toBe(true);
    expect(parseTaskLine('- [~] Working')?.done).toBe(false);
    expect(parseTaskLine('- [ ~ ] Spaced tilde')?.inProgress).toBe(true);
  });

  it('counts progress with in-progress tasks as incomplete', () => {
    const content = [
      '- [x] Done',
      '- [ ] Open',
      '- [~] Working',
      '  - [ ] Nested',
    ].join('\n');
    expect(countTaskProgress(content)).toEqual({ completed: 1, total: 4 });
  });
});
