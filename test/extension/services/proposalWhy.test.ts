import { describe, expect, it } from 'vitest';
import { extractProposalWhy } from '@extension/services/proposalWhy';

describe('extractProposalWhy', () => {
  it('extracts only the Why section before the next heading', () => {
    const result = extractProposalWhy([
      '## Why',
      '',
      'This solves the slow dashboard.',
      '',
      '## What Changes',
      'Other content',
    ].join('\n'));

    expect(result.fullText).toBe('This solves the slow dashboard.');
    expect(result.summary).toBe('This solves the slow dashboard.');
  });

  it('normalizes markdown markers and extra whitespace', () => {
    const result = extractProposalWhy('## Why\n\n**Slow**   _sidebar_ with `reload` friction.\n\n');

    expect(result.fullText).toBe('Slow sidebar with reload friction.');
  });

  it('truncates long text to 150 characters plus ellipsis', () => {
    const text = 'a'.repeat(151);
    const result = extractProposalWhy(`## Why\n${text}`);

    expect(result.summary).toBe(`${'a'.repeat(150)}...`);
    expect(result.fullText).toBe(text);
  });

  it('returns empty strings when Why is missing', () => {
    expect(extractProposalWhy('## What Changes\n- A').summary).toBe('');
    expect(extractProposalWhy('').fullText).toBe('');
  });
});
