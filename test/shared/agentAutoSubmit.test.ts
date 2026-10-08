import { describe, expect, it } from 'vitest';
import {
  isReadOnlyWorkflowAction,
  shouldAutoSubmitWorkflowAction,
} from '../../src/shared/agentAutoSubmit';

describe('agentAutoSubmit', () => {
  it('treats explore and verify as read-only', () => {
    expect(isReadOnlyWorkflowAction('explore')).toBe(true);
    expect(isReadOnlyWorkflowAction('verify')).toBe(true);
    expect(isReadOnlyWorkflowAction('apply')).toBe(false);
    expect(isReadOnlyWorkflowAction('archive')).toBe(false);
  });

  it('respects auto-submit mode', () => {
    expect(shouldAutoSubmitWorkflowAction('verify', 'never')).toBe(false);
    expect(shouldAutoSubmitWorkflowAction('verify', 'readOnly')).toBe(true);
    expect(shouldAutoSubmitWorkflowAction('apply', 'readOnly')).toBe(false);
    expect(shouldAutoSubmitWorkflowAction('apply', 'always')).toBe(true);
  });
});
