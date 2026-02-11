import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import type { IAgentExecutorAdapter, TaskExecuteRequest, TaskExecuteResult } from '../services/agentExecutor.types';
import { logger } from '../utils/logger';

const ADAPTER_ID = 'cursor';
const DISPLAY_NAME = 'Cursor (agent CLI)';
const OUTPUT_CHANNEL_NAME = 'OpenSpec (Agent)';

function buildPromptText(request: TaskExecuteRequest): string {
  const refs = request.contextFiles.length
    ? `\n参考文档：\n${request.contextFiles.map((f) => `- ${f}`).join('\n')}`
    : '';
  return `请实现以下任务：

Change: ${request.changeName}
Task: ${request.taskText}
${refs}

完成后请按 OpenSpec 流程在 tasks.md 中标记该任务为已完成。`;
}

function checkAgentCli(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('which', ['agent'], { shell: true });
    let out = '';
    proc.stdout?.on('data', (d) => { out += d.toString(); });
    proc.on('close', (code) => resolve(code === 0 && out.trim().length > 0));
    proc.on('error', () => resolve(false));
  });
}

/** 转义路径用于在单引号内使用（Unix） */
function escapePathForSingleQuotes(p: string): string {
  return p.replace(/'/g, "'\"'\"'");
}

/** 转义路径用于双引号内使用（PowerShell） */
function escapePathForDoubleQuotes(p: string): string {
  return p.replace(/"/g, '`"');
}

const TMP_FILE_PREFIX = 'openspec-agent-prompt-';
const TMP_FILE_CLEANUP_DELAY_MS = 10_000;

/** 清理 os.tmpdir 下已有的 OpenSpec agent 临时 prompt 文件，避免堆积 */
async function cleanupOldPromptFiles(tmpDir: string): Promise<void> {
  try {
    const entries = await fs.promises.readdir(tmpDir, { withFileTypes: true });
    const toRemove = entries.filter(
      (e) => e.isFile() && e.name.startsWith(TMP_FILE_PREFIX) && e.name.endsWith('.txt')
    );
    await Promise.all(toRemove.map((e) => fs.promises.unlink(path.join(tmpDir, e.name)).catch(() => {})));
  } catch {
    // ignore
  }
}

/** 读取配置的 agent 模型；空或 "auto" 时返回字面量 "auto"，保证始终传 --model */
function getAgentModelOption(): string {
  const config = vscode.workspace.getConfiguration('openspec');
  const raw = config.get<string>('agentModel');
  const v = (raw ?? 'auto').trim().toLowerCase();
  return v === '' || v === 'auto' ? 'auto' : (raw ?? '').trim();
}

/** 构建 --model 参数片段（已加前导空格），始终传入至少 "auto" */
function buildModelArg(model: string, isWindows: boolean): string {
  const value = model || 'auto';
  const escaped = isWindows ? value.replace(/"/g, '`"') : value.replace(/"/g, '\\"');
  return ` --model "${escaped}"`;
}

export const cursorAdapter: IAgentExecutorAdapter = {
  id: ADAPTER_ID,
  displayName: DISPLAY_NAME,

  async isAvailable(): Promise<boolean> {
    return checkAgentCli();
  },

  async executeTask(request: TaskExecuteRequest): Promise<TaskExecuteResult> {
    const prompt = request.promptOverride ?? buildPromptText(request);
    const channel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
    channel.clear();
    channel.show(true);
    channel.appendLine(`[OpenSpec] 正在通过集成终端启动 Cursor agent: ${request.taskText}`);
    channel.appendLine(`[OpenSpec] Prompt 长度: ${prompt.length} 字符`);
    const modelOpt = getAgentModelOption();
    channel.appendLine(`[OpenSpec] 使用模型: ${modelOpt} (已传 --model)`);

    const isWindows = process.platform === 'win32';
    const tmpDir = os.tmpdir();
    await cleanupOldPromptFiles(tmpDir);
    const tmpFile = path.join(tmpDir, `${TMP_FILE_PREFIX}${Date.now()}.txt`);

    try {
      await fs.promises.writeFile(tmpFile, prompt, 'utf8');
    } catch (err) {
      const msg = (err as Error).message;
      channel.appendLine(`[OpenSpec] 写入临时文件失败: ${msg}`);
      logger.error('cursor-adapter: write temp file failed', err as Error);
      return { success: false, adapterId: ADAPTER_ID, message: msg };
    }

    const modelArg = buildModelArg(modelOpt, isWindows);
    const cmd = isWindows
      ? `agent -p --force${modelArg} (Get-Content -Raw -Path "${escapePathForDoubleQuotes(tmpFile)}")`
      : `agent -p --force${modelArg} "$(cat '${escapePathForSingleQuotes(tmpFile)}')"`;

    try {
      const terminal = vscode.window.createTerminal({
        cwd: request.workspaceRoot,
        name: 'OpenSpec Agent',
      });
      terminal.show(true);
      terminal.sendText(cmd);
      channel.appendLine('[OpenSpec] 已在集成终端中启动 agent，请在终端中查看输出。');
      channel.appendLine('---');
      vscode.window.showInformationMessage('已在集成终端中启动 Cursor agent，请在终端中查看执行过程。');
      // 命令发送后 shell 会立即展开 $(cat file)，再延迟删除临时文件，避免堆积
      setTimeout(() => {
        fs.promises.unlink(tmpFile).catch(() => {});
      }, TMP_FILE_CLEANUP_DELAY_MS);
      return { success: true, adapterId: ADAPTER_ID };
    } catch (err) {
      const msg = (err as Error).message;
      channel.appendLine(`[OpenSpec] 创建终端或发送命令失败: ${msg}`);
      logger.error('cursor-adapter: createTerminal/sendText failed', err as Error);
      try {
        await fs.promises.unlink(tmpFile);
      } catch {
        // ignore cleanup error
      }
      return { success: false, adapterId: ADAPTER_ID, message: msg };
    }
  },

  async fillChat(request: TaskExecuteRequest): Promise<TaskExecuteResult> {
    const text = request.promptOverride ?? buildPromptText(request);
    await vscode.env.clipboard.writeText(text);
    try {
      await vscode.commands.executeCommand('workbench.action.chat.open');
    } catch {
      // Chat 可能不可用（非 Cursor 或版本差异），忽略
    }
    vscode.window.showInformationMessage('已复制到剪贴板，Chat 已打开，请粘贴到输入框后发送。');
    return { success: true, adapterId: ADAPTER_ID, message: 'Copied to clipboard' };
  },
};
