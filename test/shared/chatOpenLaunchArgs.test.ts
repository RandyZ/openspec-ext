import { describe, expect, it } from 'vitest';
import { buildChatOpenLaunchArgs } from '../../src/shared/chatOpenLaunchArgs';

describe('buildChatOpenLaunchArgs', () => {
  it('prefills when autoSubmit is false', () => {
    expect(buildChatOpenLaunchArgs('/opsx:verify demo', false)).toEqual({
      query: '/opsx:verify demo',
      isPartialQuery: true,
      mode: 'agent',
    });
  });

  it('submits when autoSubmit is true', () => {
    expect(buildChatOpenLaunchArgs('/opsx:verify demo', true)).toEqual({
      query: '/opsx:verify demo',
      isPartialQuery: false,
      mode: 'agent',
    });
  });
});
