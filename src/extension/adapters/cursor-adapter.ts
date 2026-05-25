import { spawn } from 'child_process';
import * as vscode from 'vscode';
import type {
  IAgentExecutorAdapter,
  TaskExecuteRequest,
  TaskExecuteResult,
} from '../services/agentExecutor.types';
import { logger } from '../utils/logger';
import { t } from '../../i18n';
import { buildWorkflowCommand } from '../../shared/workflowCommand';
import { buildCursorPromptDeeplink } from '../services/cursorDeeplink';
import { getCursorAgentModel, getWorkflowLaunchConfig } from '../services/workflowLaunchConfig';

const ADAPTER_ID = 'cursor';
const DISPLAY_NAME = 'Cursor (agent CLI)';
const OUTPUT_CHANNEL_NAME = 'OpenSpec (Agent)';
const NO_OUTPUT_NOTICE_MS = 10000;
const STILL_RUNNING_NOTICE_MS = 30000;

let _outputChannel: vscode.OutputChannel | undefined;

function buildPromptText(request: TaskExecuteRequest): string {
  return buildWorkflowCommand({
    action: 'apply',
    changeName: request.changeName,
    target: 'cursor',
  });
}

function checkAgentCli(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('which', ['agent'], { shell: true });
    let out = '';
    proc.stdout?.on('data', (d) => {
      out += d.toString();
    });
    proc.on('close', (code) => resolve(code === 0 && out.trim().length > 0));
    proc.on('error', () => resolve(false));
  });
}

/**
 * Cursor use auto model by default, so we need to return 'auto' if the config is 'auto' or empty.
 * @returns The model option for the agent.
 */
function getAgentModelOption(): string {
  const raw = getCursorAgentModel();
  const v = raw.trim().toLowerCase();
  return v === '' || v === 'auto' ? 'auto' : raw.trim();
}

export const cursorAdapter: IAgentExecutorAdapter = {
  id: ADAPTER_ID,
  displayName: DISPLAY_NAME,

  async isAvailable(): Promise<boolean> {
    if (vscode.env.appName.toLowerCase().includes('cursor')) {
      return true;
    }
    return checkAgentCli();
  },

  async executeTask(request: TaskExecuteRequest): Promise<TaskExecuteResult> {
    const prompt = request.promptOverride ?? buildPromptText(request);
    if (!_outputChannel) {
      _outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
    }
    const channel = _outputChannel;
    channel.clear();
    channel.show(true);
    channel.appendLine(`[OpenSpec] ${t('cursor.executing', { task: request.taskText })}`);
    channel.appendLine(`[OpenSpec] ${t('cursor.promptLength', { length: prompt.length })}`);
    const modelOpt = getAgentModelOption();
    channel.appendLine(`[OpenSpec] ${t('cursor.model', { model: modelOpt })}`);
    const debug = vscode.workspace.getConfiguration('openspec').get<boolean>('debug') ?? false;
    if (debug) {
      channel.appendLine(`[OpenSpec] ${t('cursor.debugPromptStart')}`);
      channel.appendLine(prompt);
      channel.appendLine(`[OpenSpec] ${t('cursor.debugPromptEnd')}`);
    }
    channel.appendLine('---');

    const args = ['-p', '--trust', '--force', '--model', modelOpt, prompt];
    const child = spawn('agent', args, {
      cwd: request.workspaceRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    channel.appendLine(`[OpenSpec] ${t('cursor.agentStarted', { pid: child.pid ?? 'unknown' })}`);
    channel.appendLine(`[OpenSpec] ${t('cursor.waitingForOutput')}`);

    const startedAt = Date.now();
    let receivedOutput = false;
    let noOutputTimer: NodeJS.Timeout | undefined = setTimeout(() => {
      if (!receivedOutput) {
        channel.appendLine(`[OpenSpec] ${t('cursor.noOutputYet')}`);
      }
      noOutputTimer = undefined;
    }, NO_OUTPUT_NOTICE_MS);
    let stillRunningTimer: NodeJS.Timeout | undefined = setInterval(() => {
      if (!receivedOutput) {
        const seconds = Math.round((Date.now() - startedAt) / 1000);
        channel.appendLine(`[OpenSpec] ${t('cursor.stillRunningNoOutput', { seconds })}`);
      }
    }, STILL_RUNNING_NOTICE_MS);

    const clearOutputTimers = () => {
      if (noOutputTimer) {
        clearTimeout(noOutputTimer);
        noOutputTimer = undefined;
      }
      if (stillRunningTimer) {
        clearInterval(stillRunningTimer);
        stillRunningTimer = undefined;
      }
    };

    child.stdout?.on('data', (chunk: Buffer | string) => {
      receivedOutput = true;
      clearOutputTimers();
      channel.append(chunk.toString());
    });
    child.stderr?.on('data', (chunk: Buffer | string) => {
      receivedOutput = true;
      clearOutputTimers();
      channel.append(chunk.toString());
    });

    return new Promise<TaskExecuteResult>((resolve) => {
      child.on('error', (err) => {
        clearOutputTimers();
        const msg = (err as Error).message;
        channel.appendLine(`[OpenSpec] ${t('cursor.spawnFailed', { error: msg })}`);
        logger.error('cursor-adapter: spawn failed', err as Error);
        resolve({ success: false, adapterId: ADAPTER_ID, message: msg });
      });

      child.on('close', (code, signal) => {
        clearOutputTimers();
        channel.appendLine('---');
        if (code === 0) {
          channel.appendLine(`[OpenSpec] ${t('cursor.done')}`);
          resolve({ success: true, adapterId: ADAPTER_ID });
        } else {
          const msg = signal ? t('cursor.signal', { signal }) : t('cursor.exitCode', { code: code ?? -1 });
          channel.appendLine(`[OpenSpec] ${t('cursor.finished', { msg })}`);
          resolve({ success: false, adapterId: ADAPTER_ID, message: msg });
        }
      });
    });
  },

  async fillChat(request: TaskExecuteRequest): Promise<TaskExecuteResult> {
    const text = request.promptOverride ?? buildPromptText(request);
    await vscode.env.clipboard.writeText(text);
    const { cursorLaunchMode } = getWorkflowLaunchConfig();

    if (cursorLaunchMode === 'agentCli') {
      vscode.window.showInformationMessage(t('cursor.copiedRunningAgent', { command: text }));
      return this.executeTask(request);
    }

    if (cursorLaunchMode === 'clipboard') {
      vscode.window.showInformationMessage(t('workflow.copiedCommand', { command: text }));
      return { success: true, adapterId: ADAPTER_ID, message: 'Copied to clipboard' };
    }

    if (cursorLaunchMode === 'chatCommand') {
      try {
        await vscode.commands.executeCommand('workbench.action.chat.open', {
          query: text,
          isPartialQuery: true,
        });
        vscode.window.showInformationMessage(t('cursor.chatOpenedCopied', { command: text }));
        return { success: true, adapterId: ADAPTER_ID, message: 'Chat opened with prompt' };
      } catch {
        vscode.window.showInformationMessage(t('cursor.chatOpenFailedCopied', { command: text }));
        return { success: true, adapterId: ADAPTER_ID, message: 'Copied to clipboard' };
      }
    }

    try {
      await vscode.env.openExternal(vscode.Uri.parse(buildCursorPromptDeeplink(text)));
      vscode.window.showInformationMessage(t('cursor.promptOpenedCopied', { command: text }));
      return { success: true, adapterId: ADAPTER_ID, message: 'Cursor prompt opened' };
    } catch {
      vscode.window.showInformationMessage(t('cursor.openFailedCopied', { command: text }));
      return { success: true, adapterId: ADAPTER_ID, message: 'Copied to clipboard' };
    }
  },
};
