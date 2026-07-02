import * as vscode from 'vscode';
import process from 'node:process';
import { getCursorAgentModel } from './workflowLaunchConfig';
import { t } from '../../i18n';
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

export interface InteractiveWorkflowScope {
  id?: string;
  rootPath: string;
  storeId?: string;
  label?: string;
}

export interface StartInteractiveWorkflowRequest {
  workspaceRoot: string;
  changeName: string;
  action: InteractiveWorkflowAction;
  /** Scope this workflow is bound to. Terminal cwd uses scope.rootPath when set. */
  scope?: InteractiveWorkflowScope;
}

function getSessionKey(
  workspaceRoot: string,
  changeName: string,
  action: InteractiveWorkflowAction,
  scopeId?: string
): string {
  return `${scopeId ?? workspaceRoot}::${changeName}::${action}`;
}

function isWindowsPlatform(platform: string = process.platform): boolean {
  return platform === 'win32';
}

/**
 * POSIX single-quote escaping. Safe for bash/zsh/dash: wraps the value in
 * single quotes and escapes any embedded single quote via the `'"'"'` idiom.
 */
function posixQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

/**
 * Windows quoting for cmd.exe / PowerShell. Wraps the value in double quotes
 * and escapes embedded double quotes and backslashes per the standard
 * `CommandLineToArgvW` rules so a path/name with spaces stays a single arg.
 */
function windowsQuote(value: string): string {
  let escaped = value.replace(/(\\*)"/g, '$1$1\\"');
  escaped = escaped.replace(/(\\*)$/, '$1$1');
  return `"${escaped}"`;
}

function shellQuote(value: string, platform: string = process.platform): string {
  return isWindowsPlatform(platform) ? windowsQuote(value) : posixQuote(value);
}

async function defaultIsAgentAvailable(): Promise<boolean> {
  const { spawn } = await import('child_process');
  const lookupCmd = isWindowsPlatform() ? 'where' : 'which';
  return new Promise((resolve) => {
    const proc = spawn(lookupCmd, ['agent'], { shell: true });
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
  platform?: string;
  storeId?: string;
}): string {
  const platform = params.platform ?? process.platform;
  const q = (value: string) => shellQuote(value, platform);
  const base = [
    'agent',
    '--workspace',
    q(params.workspaceRoot),
    '--model',
    q(params.model),
    q(`/opsx-${params.action}`),
    q(params.changeName),
  ];
  // When bound to a store scope, forward --store so the agent runs the workflow
  // against the store root rather than the workspace root.
  if (params.storeId) {
    base.push('--store', q(params.storeId));
  }
  return base.join(' ');
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
    const scope = request.scope;
    const effectiveRoot = scope?.rootPath ?? request.workspaceRoot;
    const key = getSessionKey(request.workspaceRoot, request.changeName, request.action, scope?.id);
    const existing = this.sessions.get(key);
    if (existing?.terminal && existing.state.status === 'running') {
      existing.terminal.show(true);
      return this.getState(request.workspaceRoot, request.changeName, scope);
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
          message: t('verifyArchive.agentCliNotFound'),
        },
      });
      return this.getState(request.workspaceRoot, request.changeName, scope);
    }

    const model = this.getModel().trim() || 'auto';
    const command = buildInteractiveAgentCommand({
      workspaceRoot: effectiveRoot,
      model,
      action: request.action,
      changeName: request.changeName,
      storeId: scope?.storeId,
    });

    try {
      const terminal = this.createTerminal({
        name: this.getTerminalName(request.action, request.changeName),
        cwd: effectiveRoot,
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
          message: (error as Error).message || t('verifyArchive.terminalCreateFailed'),
        },
      });
    }

    return this.getState(request.workspaceRoot, request.changeName, scope);
  }

  reveal(
    workspaceRoot: string,
    changeName: string,
    action: InteractiveWorkflowAction,
    scope?: InteractiveWorkflowScope
  ): InteractiveWorkflowState {
    const session = this.sessions.get(getSessionKey(workspaceRoot, changeName, action, scope?.id));
    session?.terminal?.show(true);
    return this.getState(workspaceRoot, changeName, scope);
  }

  stop(
    workspaceRoot: string,
    changeName: string,
    action: InteractiveWorkflowAction,
    scope?: InteractiveWorkflowScope
  ): InteractiveWorkflowState {
    return this.disposeSession(workspaceRoot, changeName, action, scope);
  }

  clear(
    workspaceRoot: string,
    changeName: string,
    action: InteractiveWorkflowAction,
    scope?: InteractiveWorkflowScope
  ): InteractiveWorkflowState {
    return this.disposeSession(workspaceRoot, changeName, action, scope);
  }

  getState(
    workspaceRoot: string,
    changeName: string,
    scope?: InteractiveWorkflowScope
  ): InteractiveWorkflowState {
    const sessions: InteractiveWorkflowState['sessions'] = {};
    for (const action of ['verify', 'archive'] as const) {
      const session = this.sessions.get(getSessionKey(workspaceRoot, changeName, action, scope?.id));
      if (session) {
        sessions[action] = { ...session.state };
      }
    }
    return { changeName, sessions };
  }

  private disposeSession(
    workspaceRoot: string,
    changeName: string,
    action: InteractiveWorkflowAction,
    scope?: InteractiveWorkflowScope
  ): InteractiveWorkflowState {
    const key = getSessionKey(workspaceRoot, changeName, action, scope?.id);
    const session = this.sessions.get(key);
    session?.terminal?.dispose();
    this.sessions.delete(key);
    return this.getState(workspaceRoot, changeName, scope);
  }

  private getTerminalName(action: InteractiveWorkflowAction, changeName: string): string {
    const label = action === 'verify' ? 'Verify' : 'Archive';
    return `OpenSpec ${label}: ${changeName}`;
  }
}
