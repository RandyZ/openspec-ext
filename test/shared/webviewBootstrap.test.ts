import { describe, expect, it } from 'vitest';
import {
  buildInlineBootstrapScript,
  buildWebviewRootAttributes,
  escapeHtmlAttribute,
  readInlineWebviewBootstrap,
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

  it('reads inline bootstrap when root attributes are missing', () => {
    (globalThis as typeof globalThis & { __OPENSPEC_BOOTSTRAP__?: unknown }).__OPENSPEC_BOOTSTRAP__ = {
      view: 'agentUnavailable',
      workspacePath: '/tmp/ws-b',
    };
    expect(readWebviewBootstrap({ dataset: {} } as unknown as HTMLElement)).toEqual({
      view: 'agentUnavailable',
      workspacePath: '/tmp/ws-b',
    });
    delete (globalThis as typeof globalThis & { __OPENSPEC_BOOTSTRAP__?: unknown }).__OPENSPEC_BOOTSTRAP__;
  });

  it('builds inline bootstrap script for agent unavailable view', () => {
    expect(buildInlineBootstrapScript({
      view: 'agentUnavailable',
      workspacePath: '/tmp/ws-b',
    })).toContain('window.__OPENSPEC_BOOTSTRAP__=');
  });
});
