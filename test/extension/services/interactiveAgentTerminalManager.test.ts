import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import {
  buildInteractiveAgentCommand,
  InteractiveAgentTerminalManager,
} from '@extension/services/interactiveAgentTerminalManager';
import { setLocale, t } from '../../../src/i18n';

vi.mock('vscode', () => ({
  TerminalLocation: {
    Editor: 'editor',
  },
  window: {
    createTerminal: vi.fn(),
    onDidCloseTerminal: vi.fn(() => ({ dispose: vi.fn() })),
  },
}));

describe('InteractiveAgentTerminalManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('en');
  });

  it('starts verify terminal with interactive agent command', async () => {
    const terminal = createTerminalDouble('OpenSpec Verify: demo-change');
    vi.mocked(vscode.window.createTerminal).mockReturnValue(terminal as any);
    const manager = new InteractiveAgentTerminalManager({
      isAgentAvailable: vi.fn().mockResolvedValue(true),
      now: () => 123,
      getModel: () => 'auto',
    });

    const state = await manager.start({
      workspaceRoot: '/workspace/root',
      changeName: 'demo-change',
      action: 'verify',
    });

    expect(vscode.window.createTerminal).toHaveBeenCalledWith({
      name: 'OpenSpec Verify: demo-change',
      cwd: '/workspace/root',
      location: 'editor',
    });
    expect(terminal.show).toHaveBeenCalledWith(true);
    expect(terminal.sendText).toHaveBeenCalledWith(
      "agent --workspace '/workspace/root' --model 'auto' '/opsx-verify' 'demo-change'",
      true
    );
    expect(state.sessions.verify).toEqual({
      action: 'verify',
      status: 'running',
      terminalName: 'OpenSpec Verify: demo-change',
      lastCommand: "agent --workspace '/workspace/root' --model 'auto' '/opsx-verify' 'demo-change'",
      startedAt: 123,
    });
  });

  it('starts archive terminal independently from verify session', async () => {
    const verifyTerminal = createTerminalDouble('OpenSpec Verify: demo-change');
    const archiveTerminal = createTerminalDouble('OpenSpec Archive: demo-change');
    vi.mocked(vscode.window.createTerminal)
      .mockReturnValueOnce(verifyTerminal as any)
      .mockReturnValueOnce(archiveTerminal as any);
    const manager = new InteractiveAgentTerminalManager({
      isAgentAvailable: vi.fn().mockResolvedValue(true),
      now: () => 100,
      getModel: () => 'auto',
    });

    await manager.start({
      workspaceRoot: '/workspace/root',
      changeName: 'demo-change',
      action: 'verify',
    });
    const state = await manager.start({
      workspaceRoot: '/workspace/root',
      changeName: 'demo-change',
      action: 'archive',
    });

    expect(vscode.window.createTerminal).toHaveBeenCalledTimes(2);
    expect(state.sessions.verify?.status).toBe('running');
    expect(state.sessions.archive?.status).toBe('running');
  });

  it('reuses an existing running session and only reveals it', async () => {
    const terminal = createTerminalDouble('OpenSpec Verify: demo-change');
    vi.mocked(vscode.window.createTerminal).mockReturnValue(terminal as any);
    const manager = new InteractiveAgentTerminalManager({
      isAgentAvailable: vi.fn().mockResolvedValue(true),
      now: () => 100,
      getModel: () => 'auto',
    });

    await manager.start({
      workspaceRoot: '/workspace/root',
      changeName: 'demo-change',
      action: 'verify',
    });
    await manager.start({
      workspaceRoot: '/workspace/root',
      changeName: 'demo-change',
      action: 'verify',
    });

    expect(vscode.window.createTerminal).toHaveBeenCalledTimes(1);
    expect(terminal.sendText).toHaveBeenCalledTimes(1);
    expect(terminal.show).toHaveBeenCalledTimes(2);
  });

  it('reveals an existing terminal without changing session state', async () => {
    const terminal = createTerminalDouble('OpenSpec Archive: demo-change');
    vi.mocked(vscode.window.createTerminal).mockReturnValue(terminal as any);
    const manager = new InteractiveAgentTerminalManager({
      isAgentAvailable: vi.fn().mockResolvedValue(true),
      now: () => 100,
      getModel: () => 'auto',
    });

    await manager.start({
      workspaceRoot: '/workspace/root',
      changeName: 'demo-change',
      action: 'archive',
    });
    const state = manager.reveal('/workspace/root', 'demo-change', 'archive');

    expect(terminal.show).toHaveBeenCalledTimes(2);
    expect(state.sessions.archive?.status).toBe('running');
  });

  it('stops and clears a session by disposing the terminal', async () => {
    const verifyTerminal = createTerminalDouble('OpenSpec Verify: demo-change');
    const archiveTerminal = createTerminalDouble('OpenSpec Archive: demo-change');
    vi.mocked(vscode.window.createTerminal)
      .mockReturnValueOnce(verifyTerminal as any)
      .mockReturnValueOnce(archiveTerminal as any);
    const manager = new InteractiveAgentTerminalManager({
      isAgentAvailable: vi.fn().mockResolvedValue(true),
      now: () => 100,
      getModel: () => 'auto',
    });

    await manager.start({
      workspaceRoot: '/workspace/root',
      changeName: 'demo-change',
      action: 'verify',
    });
    await manager.start({
      workspaceRoot: '/workspace/root',
      changeName: 'demo-change',
      action: 'archive',
    });

    const afterStop = manager.stop('/workspace/root', 'demo-change', 'verify');
    const afterClear = manager.clear('/workspace/root', 'demo-change', 'archive');

    expect(verifyTerminal.dispose).toHaveBeenCalledTimes(1);
    expect(archiveTerminal.dispose).toHaveBeenCalledTimes(1);
    expect(afterStop.sessions.verify).toBeUndefined();
    expect(afterClear.sessions.archive).toBeUndefined();
  });

  it('returns an error state when agent cli is unavailable', async () => {
    const manager = new InteractiveAgentTerminalManager({
      isAgentAvailable: vi.fn().mockResolvedValue(false),
      getModel: () => 'auto',
    });

    const state = await manager.start({
      workspaceRoot: '/workspace/root',
      changeName: 'demo-change',
      action: 'verify',
    });

    expect(vscode.window.createTerminal).not.toHaveBeenCalled();
    expect(state.sessions.verify).toEqual({
      action: 'verify',
      status: 'error',
      message: t('verifyArchive.agentCliNotFound'),
    });
  });

  it('localizes the agent-not-found error message for zh-cn', async () => {
    setLocale('zh-cn');
    const manager = new InteractiveAgentTerminalManager({
      isAgentAvailable: vi.fn().mockResolvedValue(false),
      getModel: () => 'auto',
    });

    const state = await manager.start({
      workspaceRoot: '/workspace/root',
      changeName: 'demo-change',
      action: 'verify',
    });

    expect(state.sessions.verify?.message).toBe(t('verifyArchive.agentCliNotFound'));
    expect(state.sessions.verify?.message).not.toBe('Cursor Agent CLI not found.');
  });

  it('returns an error state when terminal creation fails', async () => {
    vi.mocked(vscode.window.createTerminal).mockImplementation(() => {
      throw new Error('terminal failed');
    });
    const manager = new InteractiveAgentTerminalManager({
      isAgentAvailable: vi.fn().mockResolvedValue(true),
      getModel: () => 'auto',
    });

    const state = await manager.start({
      workspaceRoot: '/workspace/root',
      changeName: 'demo-change',
      action: 'archive',
    });

    expect(state.sessions.archive).toEqual({
      action: 'archive',
      status: 'error',
      message: 'terminal failed',
    });
  });

  it('falls back to a localized message when terminal creation throws without a message', async () => {
    vi.mocked(vscode.window.createTerminal).mockImplementation(() => {
      throw {};
    });
    const manager = new InteractiveAgentTerminalManager({
      isAgentAvailable: vi.fn().mockResolvedValue(true),
      getModel: () => 'auto',
    });

    const state = await manager.start({
      workspaceRoot: '/workspace/root',
      changeName: 'demo-change',
      action: 'archive',
    });

    expect(state.sessions.archive?.message).toBe(t('verifyArchive.terminalCreateFailed'));
  });

  it('shell-quotes workspace path and change name safely', () => {
    const command = buildInteractiveAgentCommand({
      workspaceRoot: "/tmp/workspace with spaces/it's-real",
      model: 'auto',
      action: 'archive',
      changeName: "demo change's name",
    });

    expect(command).toBe(
      "agent --workspace '/tmp/workspace with spaces/it'\"'\"'s-real' --model 'auto' '/opsx-archive' 'demo change'\"'\"'s name'"
    );
  });

  it('shell-quotes with Windows double-quote escaping on win32', () => {
    const command = buildInteractiveAgentCommand({
      workspaceRoot: 'C:\\tmp\\workspace with spaces',
      model: 'auto',
      action: 'archive',
      changeName: 'demo change',
      platform: 'win32',
    });

    // Windows uses double-quote wrapping; spaces stay inside the quoted arg and
    // the command never uses POSIX single-quote escaping.
    expect(command).toBe(
      'agent --workspace "C:\\tmp\\workspace with spaces" --model "auto" "/opsx-archive" "demo change"'
    );
    expect(command).not.toContain("'");
  });

  it('shell-quotes embedded double quotes on Windows per CommandLineToArgvW', () => {
    const command = buildInteractiveAgentCommand({
      workspaceRoot: 'C:\\proj\\a "weird" path',
      model: 'auto',
      action: 'verify',
      changeName: 'demo',
      platform: 'win32',
    });

    // An embedded `"` becomes `\"` inside the double-quoted arg.
    expect(command).toContain('"C:\\proj\\a \\"weird\\" path"');
    expect(command).not.toContain("'");
  });
});

describe('InteractiveAgentTerminalManager scope-aware behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('en');
  });

  it('uses scope.rootPath as terminal cwd for a store scope', async () => {
    const terminal = createTerminalDouble('OpenSpec Verify: demo-change');
    vi.mocked(vscode.window.createTerminal).mockReturnValue(terminal as any);
    const manager = new InteractiveAgentTerminalManager({
      isAgentAvailable: vi.fn().mockResolvedValue(true),
      now: () => 1,
      getModel: () => 'auto',
    });

    await manager.start({
      workspaceRoot: '/workspace/root',
      changeName: 'demo-change',
      action: 'verify',
      scope: { id: 'store:team-plans', rootPath: '/stores/team-plans', storeId: 'team-plans' },
    });

    // Terminal cwd must be the store root, not the workspace root.
    expect(vscode.window.createTerminal).toHaveBeenCalledWith({
      name: 'OpenSpec Verify: demo-change',
      cwd: '/stores/team-plans',
      location: 'editor',
    });
    // Command must run against the store root and forward --store.
    expect(terminal.sendText).toHaveBeenCalledWith(
      "agent --workspace '/stores/team-plans' --model 'auto' '/opsx-verify' 'demo-change' --store 'team-plans'",
      true
    );
  });

  it('includes --store in the agent command for a store scope', () => {
    const command = buildInteractiveAgentCommand({
      workspaceRoot: '/stores/team-plans',
      model: 'auto',
      action: 'archive',
      changeName: 'demo-change',
      storeId: 'team-plans',
    });
    expect(command).toBe(
      "agent --workspace '/stores/team-plans' --model 'auto' '/opsx-archive' 'demo-change' --store 'team-plans'"
    );
  });

  it('keeps separate sessions per scope (same change name, different roots)', async () => {
    const localTerminal = createTerminalDouble('OpenSpec Verify: shared');
    const storeTerminal = createTerminalDouble('OpenSpec Verify: shared');
    vi.mocked(vscode.window.createTerminal)
      .mockReturnValueOnce(localTerminal as any)
      .mockReturnValueOnce(storeTerminal as any);
    const manager = new InteractiveAgentTerminalManager({
      isAgentAvailable: vi.fn().mockResolvedValue(true),
      now: () => 1,
      getModel: () => 'auto',
    });

    await manager.start({
      workspaceRoot: '/workspace/root',
      changeName: 'shared',
      action: 'verify',
    });
    await manager.start({
      workspaceRoot: '/workspace/root',
      changeName: 'shared',
      action: 'verify',
      scope: { id: 'store:team-plans', rootPath: '/stores/team-plans', storeId: 'team-plans' },
    });

    // Two distinct terminals because the scope id differs the session key.
    expect(vscode.window.createTerminal).toHaveBeenCalledTimes(2);
  });
});

function createTerminalDouble(name: string) {
  return {
    name,
    show: vi.fn(),
    sendText: vi.fn(),
    dispose: vi.fn(),
  };
}
