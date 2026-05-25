import { describe, expect, it } from 'vitest';
import {
  buildWorkflowLaunchPayload,
  buildWorkflowCommand,
  getWorkflowCommandTargetForAdapter,
  type WorkflowAction,
  type WorkflowCommandTarget,
} from '@/shared/workflowCommand';

describe('buildWorkflowCommand', () => {
  const actions: WorkflowAction[] = [
    'explore',
    'continue',
    'ff',
    'apply',
    'verify',
    'archive',
    'sync',
  ];

  it('uses hyphen format for Cursor and OpenCode targets', () => {
    for (const action of actions) {
      expect(buildWorkflowCommand({ action, changeName: 'demo-change', target: 'cursor' })).toBe(
        `/opsx-${action} demo-change`
      );
      expect(buildWorkflowCommand({ action, changeName: 'demo-change', target: 'opencode' })).toBe(
        `/opsx-${action} demo-change`
      );
    }
  });

  it('uses colon format for clipboard, copilot, generic, and unknown targets', () => {
    const targets: WorkflowCommandTarget[] = ['clipboard', 'copilot', 'generic', 'unknown'];

    for (const target of targets) {
      for (const action of actions) {
        expect(buildWorkflowCommand({ action, changeName: 'demo-change', target })).toBe(
          `/opsx:${action} demo-change`
        );
      }
    }
  });

  it('supports commands without a change name', () => {
    expect(buildWorkflowCommand({ action: 'continue', target: 'clipboard' })).toBe('/opsx:continue');
    expect(buildWorkflowCommand({ action: 'apply', target: 'cursor' })).toBe('/opsx-apply');
  });

  it('maps adapter ids to command targets', () => {
    expect(getWorkflowCommandTargetForAdapter('cursor')).toBe('cursor');
    expect(getWorkflowCommandTargetForAdapter('opencode')).toBe('opencode');
    expect(getWorkflowCommandTargetForAdapter('vscode-copilot')).toBe('copilot');
    expect(getWorkflowCommandTargetForAdapter('clipboard')).toBe('clipboard');
    expect(getWorkflowCommandTargetForAdapter('claude-code')).toBe('generic');
    expect(getWorkflowCommandTargetForAdapter('missing-adapter')).toBe('unknown');
    expect(getWorkflowCommandTargetForAdapter(null)).toBe('unknown');
  });

  it('builds clipboard launch payload regardless of preferred adapter in clipboard mode', () => {
    expect(
      buildWorkflowLaunchPayload({
        action: 'apply',
        changeName: 'demo-change',
        workflowLaunchMode: 'clipboard',
        adapterId: 'cursor',
      })
    ).toEqual({
      action: 'apply',
      changeName: 'demo-change',
      workflowLaunchMode: 'clipboard',
      target: 'clipboard',
      command: '/opsx:apply demo-change',
    });
  });

  it('builds adapter launch payload using the adapter command target in adapter mode', () => {
    expect(
      buildWorkflowLaunchPayload({
        action: 'apply',
        changeName: 'demo-change',
        workflowLaunchMode: 'adapter',
        adapterId: 'cursor',
      })
    ).toEqual({
      action: 'apply',
      changeName: 'demo-change',
      workflowLaunchMode: 'adapter',
      target: 'cursor',
      command: '/opsx-apply demo-change',
    });
  });

  it('builds Cursor archive workflow commands without changing archive UI behavior', () => {
    expect(
      buildWorkflowLaunchPayload({
        action: 'archive',
        changeName: 'demo-change',
        workflowLaunchMode: 'adapter',
        adapterId: 'cursor',
      })
    ).toMatchObject({
      action: 'archive',
      target: 'cursor',
      command: '/opsx-archive demo-change',
    });
  });
});
