import * as vscode from 'vscode';
import { getCursorAgentModel } from './workflowLaunchConfig';
import type {
  InteractiveWorkflowAction,
  InteractiveWorkflowSessionState,
  InteractiveWorkflowState,
} from '../../shared/interactiveWorkflow';

interface InteractiveWorkflowSessionRecord {
  key: string;
  workspaceRoot: string;
  changeName: string;
  action: InteractiveWorkflowAction;
  terminal?: vscode.Terminal;
  state: InteractiveWorkflowSessionState;
}

interface InteractiveAgentTerminalManagerDeps {
  createTerminal?: (options: vscode.TerminalOptions) => vscode.Terminal;
  onDidCloseTerminal?: (
    listener: (terminal: vscode.Terminal) => unknown
  ) => vscode.Disposable;
  isAgentAvailable?: () => Promise<boolean>;
  now?: () => number;
  getModel?: () => string;
  terminalLocation?: vscode.TerminalLocation | vscode.TerminalEditorLocationOptions;
}

export interface StartInteractiveWorkflowRequest {
  workspaceRoot: string;
  changeName: string;
  action: InteractiveWorkflowAction;
}

function getSessionKey(
  workspaceRoot: string,
  changeName: string,
  action: InteractiveWorkflowAction
): string {
  return `${workspaceRoot}::${changeName}::${action}`;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

async function defaultIsAgentAvailable(): Promise<boolean> {
  const { spawn } = await import('child_process');
  return new Promise((resolve) => {
    const proc = spawn('which', ['agent'], { shell: true });
    let out = '';
    proc.stdout?.on('data', (chunk) => {
      out += chunk.toString();
    });
    proc.on('close', (code) => resolve(code === 0 && out.trim().length > 0));
    proc.on('error', () => resolve(false));
  });
}

export function buildInteractiveAgentCommand(params: {
  workspaceRoot: string;
  model: string;
  action: InteractiveWorkflowAction;
  changeName: string;
}): string {
  return [
    'agent',
    '--workspace',
    shellQuote(params.workspaceRoot),
    '--model',
    shellQuote(params.model),
    shellQuote(`/opsx-${params.action}`),
    shellQuote(params.changeName),
  ].join(' ');
}

export class InteractiveAgentTerminalManager implements vscode.Disposable {
  private readonly sessions = new Map<string, InteractiveWorkflowSessionRecord>();
  private readonly closeSubscription: vscode.Disposable;
  private readonly createTerminal: (options: vscode.TerminalOptions) => vscode.Terminal;
  private readonly isAgentAvailable: () => Promise<boolean>;
  private readonly now: () => number;
  private readonly getModel: () => string;
  private readonly terminalLocation: vscode.TerminalLocation | vscode.TerminalEditorLocationOptions;

  constructor(deps: InteractiveAgentTerminalManagerDeps = {}) {
    this.createTerminal = deps.createTerminal ?? ((options) => vscode.window.createTerminal(options));
    this.isAgentAvailable = deps.isAgentAvailable ?? defaultIsAgentAvailable;
    this.now = deps.now ?? Date.now;
    this.getModel = deps.getModel ?? getCursorAgentModel;
    this.terminalLocation = deps.terminalLocation ?? vscode.TerminalLocation.Editor;
    const subscribe =
      deps.onDidCloseTerminal ??
      ((listener: (terminal: vscode.Terminal) => unknown) =>
        vscode.window.onDidCloseTerminal(listener));
    this.closeSubscription = subscribe((terminal) => {
      for (const [key, session] of this.sessions.entries()) {
        if (session.terminal === terminal) {
          this.sessions.delete(key);
        }
      }
    });
  }

  dispose(): void {
    this.closeSubscription.dispose();
  }

  async start(request: StartInteractiveWorkflowRequest): Promise<InteractiveWorkflowState> {
    const key = getSessionKey(request.workspaceRoot, request.changeName, request.action);
    const existing = this.sessions.get(key);
    if (existing?.terminal && existing.state.status === 'running') {
      existing.terminal.show(true);
      return this.getState(request.workspaceRoot, request.changeName);
    }

    const available = await this.isAgentAvailable();
    if (!available) {
      this.sessions.set(key, {
        key,
        workspaceRoot: request.workspaceRoot,
        changeName: request.changeName,
        action: request.action,
        state: {
          action: request.action,
          status: 'error',
          message: 'Cursor Agent CLI not found.',
        },
      });
      return this.getState(request.workspaceRoot, request.changeName);
    }

    const model = this.getModel().trim() || 'auto';
    const command = buildInteractiveAgentCommand({
      workspaceRoot: request.workspaceRoot,
      model,
      action: request.action,
      changeName: request.changeName,
    });

    try {
      const terminal = this.createTerminal({
        name: this.getTerminalName(request.action, request.changeName),
        cwd: request.workspaceRoot,
        location: this.terminalLocation,
      });
      terminal.show(true);
      terminal.sendText(command, true);

      this.sessions.set(key, {
        key,
        workspaceRoot: request.workspaceRoot,
        changeName: request.changeName,
        action: request.action,
        terminal,
        state: {
          action: request.action,
          status: 'running',
          terminalName: terminal.name,
          lastCommand: command,
          startedAt: this.now(),
        },
      });
    } catch (error) {
      this.sessions.set(key, {
        key,
        workspaceRoot: request.workspaceRoot,
        changeName: request.changeName,
        action: request.action,
        state: {
          action: request.action,
          status: 'error',
          message: (error as Error).message || 'Failed to create interactive terminal.',
        },
      });
    }

    return this.getState(request.workspaceRoot, request.changeName);
  }

  reveal(
    workspaceRoot: string,
    changeName: string,
    action: InteractiveWorkflowAction
  ): InteractiveWorkflowState {
    const session = this.sessions.get(getSessionKey(workspaceRoot, changeName, action));
    session?.terminal?.show(true);
    return this.getState(workspaceRoot, changeName);
  }

  stop(
    workspaceRoot: string,
    changeName: string,
    action: InteractiveWorkflowAction
  ): InteractiveWorkflowState {
    return this.disposeSession(workspaceRoot, changeName, action);
  }

  clear(
    workspaceRoot: string,
    changeName: string,
    action: InteractiveWorkflowAction
  ): InteractiveWorkflowState {
    return this.disposeSession(workspaceRoot, changeName, action);
  }

  getState(workspaceRoot: string, changeName: string): InteractiveWorkflowState {
    const sessions: InteractiveWorkflowState['sessions'] = {};
    for (const action of ['verify', 'archive'] as const) {
      const session = this.sessions.get(getSessionKey(workspaceRoot, changeName, action));
      if (session) {
        sessions[action] = { ...session.state };
      }
    }
    return { changeName, sessions };
  }

  private disposeSession(
    workspaceRoot: string,
    changeName: string,
    action: InteractiveWorkflowAction
  ): InteractiveWorkflowState {
    const key = getSessionKey(workspaceRoot, changeName, action);
    const session = this.sessions.get(key);
    session?.terminal?.dispose();
    this.sessions.delete(key);
    return this.getState(workspaceRoot, changeName);
  }

  private getTerminalName(action: InteractiveWorkflowAction, changeName: string): string {
    const label = action === 'verify' ? 'Verify' : 'Archive';
    return `OpenSpec ${label}: ${changeName}`;
  }
}
