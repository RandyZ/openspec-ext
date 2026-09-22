import { describe, expect, it } from 'vitest';
import { buildAgentInitPrompt, OPENSPEC_INIT_COMMAND } from '../../src/shared/agentInit';

describe('agentInit', () => {
  it('builds an agent init prompt without raw UI command titles', () => {
    const prompt = buildAgentInitPrompt('/work/app');
    expect(prompt).toContain('/work/app');
    expect(prompt).toContain(OPENSPEC_INIT_COMMAND);
    expect(prompt.toLowerCase()).toContain('initialize openspec');
  });
});
