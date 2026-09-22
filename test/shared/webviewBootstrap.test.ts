import { describe, expect, it } from 'vitest';
import {
  buildWebviewRootAttributes,
  escapeHtmlAttribute,
  readWebviewBootstrap,
} from '../../src/shared/webviewBootstrap';

describe('webviewBootstrap', () => {
  it('escapes HTML attribute values', () => {
    expect(escapeHtmlAttribute('a&b"c')).toBe('a&amp;b&quot;c');
  });

  it('builds agent unavailable root attributes', () => {
    expect(buildWebviewRootAttributes({
      view: 'agentUnavailable',
      workspacePath: '/tmp/ws-b',
    })).toBe(' data-openspec-view="agentUnavailable" data-workspace-path="/tmp/ws-b"');
  });

  it('reads agent unavailable bootstrap from the DOM root', () => {
    const root = {
      dataset: {
        openspecView: 'agentUnavailable',
        workspacePath: '/tmp/ws-b',
      },
    } as unknown as HTMLElement;

    expect(readWebviewBootstrap(root)).toEqual({
      view: 'agentUnavailable',
      workspacePath: '/tmp/ws-b',
    });
  });

  it('returns null when bootstrap view is absent', () => {
    expect(readWebviewBootstrap({ dataset: {} } as unknown as HTMLElement)).toBeNull();
  });
});
