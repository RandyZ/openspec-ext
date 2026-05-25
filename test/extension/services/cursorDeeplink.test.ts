import { describe, expect, it } from 'vitest';
import { buildCursorPromptDeeplink } from '@extension/services/cursorDeeplink';

describe('buildCursorPromptDeeplink', () => {
  it('encodes the command into the official Cursor prompt deeplink', () => {
    expect(buildCursorPromptDeeplink('/opsx-apply demo change')).toBe(
      'cursor://anysphere.cursor-deeplink/prompt?text=%2Fopsx-apply%20demo%20change'
    );
  });

  it('preserves special characters by URL encoding them', () => {
    expect(buildCursorPromptDeeplink('/opsx-verify demo?x=1&y=2')).toBe(
      'cursor://anysphere.cursor-deeplink/prompt?text=%2Fopsx-verify%20demo%3Fx%3D1%26y%3D2'
    );
  });
});
