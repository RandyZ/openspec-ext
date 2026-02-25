import { spawn } from 'child_process';
import * as vscode from 'vscode';
import type {
  IAgentExecutorAdapter,
  TaskExecuteRequest,
  TaskExecuteResult,
} from '../services/agentExecutor.types';
import { logger } from '../utils/logger';
import { t } from '../../i18n';

const ADAPTER_ID = 'cursor';
const DISPLAY_NAME = 'Cursor (agent CLI)';
const OUTPUT_CHANNEL_NAME = 'OpenSpec (Agent)';

let _outputChannel: vscode.OutputChannel | undefined;

function buildPromptText(request: TaskExecuteRequest): string {
  return `/opsx:apply ${request.changeName}`;
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
  const config = vscode.workspace.getConfiguration('openspec');
  const raw = config.get<string>('agentModel');
  const v = (raw ?? 'auto').trim().toLowerCase();
  return v === '' || v === 'auto' ? 'auto' : (raw ?? '').trim();
}

export const cursorAdapter: IAgentExecutorAdapter = {
  id: ADAPTER_ID,
  displayName: DISPLAY_NAME,

  async isAvailable(): Promise<boolean> {
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

    const args = ['-p', '--force', '--model', modelOpt, prompt];
    const child = spawn('agent', args, {
      cwd: request.workspaceRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout?.on('data', (chunk: Buffer | string) => {
      channel.append(chunk.toString());
    });
    child.stderr?.on('data', (chunk: Buffer | string) => {
      channel.append(chunk.toString());
    });

    return new Promise<TaskExecuteResult>((resolve) => {
      child.on('error', (err) => {
        const msg = (err as Error).message;
        channel.appendLine(`[OpenSpec] ${t('cursor.spawnFailed', { error: msg })}`);
        logger.error('cursor-adapter: spawn failed', err as Error);
        resolve({ success: false, adapterId: ADAPTER_ID, message: msg });
      });

      child.on('close', (code, signal) => {
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
    try {
      await vscode.commands.executeCommand('workbench.action.chat.open');
    } catch {
      // Chat 可能不可用（非 Cursor 或版本差异），忽略
    }
    vscode.window.showInformationMessage(t('clipboard.copiedCursorChat'));
    return { success: true, adapterId: ADAPTER_ID, message: 'Copied to clipboard' };
  },
};
