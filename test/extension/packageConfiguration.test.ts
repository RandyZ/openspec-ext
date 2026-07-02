import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json';

const properties = packageJson.contributes.configuration.properties;

describe('OpenSpec package configuration', () => {
  it('activates when the dashboard webview is opened from the activity bar', () => {
    expect(packageJson.activationEvents).toContain('onView:openspec.dashboard');
  });

  it('contributes a visible dashboard webview in the OpenSpec activity bar container', () => {
    expect(packageJson.contributes.views.openspec).toContainEqual(
      expect.objectContaining({
        id: 'openspec.dashboard',
        type: 'webview',
        visibility: 'visible',
      })
    );
  });

  it('declares preferredAgentAdapter as a finite enum defaulting to clipboard', () => {
    expect(properties['openspec.preferredAgentAdapter']).toMatchObject({
      type: 'string',
      enum: ['clipboard', 'cursor', 'vscode-copilot', 'claude-code', 'opencode'],
      default: 'clipboard',
    });
  });

  it('declares workflow and Cursor launch settings', () => {
    expect(properties['openspec.workflowLaunchMode']).toMatchObject({
      type: 'string',
      enum: ['clipboard', 'adapter'],
      default: 'clipboard',
    });
    expect(properties['openspec.cursorLaunchMode']).toMatchObject({
      type: 'string',
      enum: ['clipboard', 'deeplink', 'chatCommand', 'agentCli'],
      default: 'clipboard',
    });
    expect(properties['openspec.cursorLaunchMode'].enumDescriptions).toHaveLength(4);
    expect(properties['openspec.cursorLaunchMode'].description).toContain('headless');
    expect(properties['openspec.cursorLaunchMode'].markdownDescription).toContain('`deeplink`');
    expect(properties['openspec.cursorLaunchMode'].markdownDescription).toContain('`agentCli`');
    expect(properties['openspec.cursorAgentModel']).toMatchObject({
      type: 'string',
      default: 'auto',
    });
  });

  it('contributes cache management commands to the command palette', () => {
    expect(packageJson.contributes.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({
        command: 'openspec.openCacheFolder',
        title: 'OpenSpec: Open Cache Folder',
        category: 'OpenSpec',
      }),
      expect.objectContaining({
        command: 'openspec.copyCachePath',
        title: 'OpenSpec: Copy Cache Path',
        category: 'OpenSpec',
      }),
      expect.objectContaining({
        command: 'openspec.clearCache',
        title: 'OpenSpec: Clear Cache',
        category: 'OpenSpec',
      }),
      expect.objectContaining({
        command: 'openspec.showCacheDetails',
        title: 'OpenSpec: Show Cache Details',
        category: 'OpenSpec',
      }),
    ]));
  });
});
