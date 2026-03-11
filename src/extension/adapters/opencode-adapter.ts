import { spawn } from 'child_process';
import * as vscode from 'vscode';
import type {
  IAgentExecutorAdapter,
  TaskExecuteRequest,
  TaskExecuteResult,
} from '../services/agentExecutor.types';
import { logger } from '../utils/logger';
import { t } from '../../i18n';

const ADAPTER_ID = 'opencode';
const DISPLAY_NAME = 'OpenCode';
const OUTPUT_CHANNEL_NAME = 'OpenSpec (OpenCode)';

let _outputChannel: vscode.OutputChannel | undefined;

function checkOpencodeCli(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('which', ['opencode'], { shell: true });
    let out = '';
    proc.stdout?.on('data', (d) => { out += d.toString(); });
    proc.on('close', (code) => resolve(code === 0 && out.trim().length > 0));
    proc.on('error', () => resolve(false));
  });
}

/**
 * OpenCode uses hyphen command format: /opsx-apply instead of /opsx:apply
 */
function toHyphenFormat(command: string): string {
  return command.replace(/\/opsx:/g, '/opsx-');
}

export const opencodeAdapter: IAgentExecutorAdapter = {
  id: ADAPTER_ID,
  displayName: DISPLAY_NAME,

  async isAvailable(): Promise<boolean> {
    return checkOpencodeCli();
  },

  async executeTask(request: TaskExecuteRequest): Promise<TaskExecuteResult> {
    const rawPrompt = request.promptOverride ?? `/opsx:apply ${request.changeName}`;
    const prompt = toHyphenFormat(rawPrompt);
    if (!_outputChannel) {
      _outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
    }
    const channel = _outputChannel;
    channel.clear();
    channel.show(true);
    channel.appendLine(`[OpenSpec] ${t('cursor.executing', { task: prompt })}`);
    channel.appendLine('---');

    const args = ['run', prompt];
    const child = spawn('opencode', args, {
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
        logger.error('opencode-adapter: spawn failed', err as Error);
        resolve({ success: false, adapterId: ADAPTER_ID, message: msg });
      });

      child.on('close', (code, signal) => {
        channel.appendLine('---');
        if (code === 0) {
          channel.appendLine(`[OpenSpec] ${t('cursor.done')}`);
          resolve({ success: true, adapterId: ADAPTER_ID });
        } else {
          const msg = signal
            ? t('cursor.signal', { signal })
            : t('cursor.exitCode', { code: code ?? -1 });
          channel.appendLine(`[OpenSpec] ${t('cursor.finished', { msg })}`);
          resolve({ success: false, adapterId: ADAPTER_ID, message: msg });
        }
      });
    });
  },

  async fillChat(request: TaskExecuteRequest): Promise<TaskExecuteResult> {
    const rawPrompt = request.promptOverride ?? `/opsx:apply ${request.changeName}`;
    const prompt = toHyphenFormat(rawPrompt);
    await vscode.env.clipboard.writeText(prompt);
    vscode.window.showInformationMessage(t('clipboard.copiedChat'));
    return { success: true, adapterId: ADAPTER_ID, message: 'Copied to clipboard' };
  },
};
