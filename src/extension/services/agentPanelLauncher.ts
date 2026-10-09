import * as vscode from 'vscode';
import { buildChatOpenLaunchArgs } from '../../shared/chatOpenLaunchArgs';
import { buildCursorPromptDeeplink } from './cursorDeeplink';
import { logger } from '../utils/logger';
import { t } from '../../i18n';

export type AgentLaunchLayer =
  | 'composerCreateNew'
  | 'chatOpen'
  | 'deeplink'
  | 'clipboard'
  | 'vscodeChat';

export type AgentLaunchOutcome = 'started' | 'prefilled' | 'submitted' | 'copied' | 'failed' | 'deduped';

export interface AgentLaunchResult {
  success: boolean;
  layer: AgentLaunchLayer;
  outcome: AgentLaunchOutcome;
  message?: string;
}

export interface AgentPanelLaunchRequest {
  text: string;
  /** Only honored when launching through Cursor `composer.createNew`. */
  autoSubmit: boolean;
}

export interface AgentPanelLauncherDeps {
  getCommands?: () => Promise<Set<string>>;
  executeCommand?: (command: string, ...rest: unknown[]) => Thenable<unknown>;
  openExternal?: (target: vscode.Uri) => Thenable<boolean>;
  writeClipboard?: (text: string) => Thenable<void>;
  sleep?: (ms: number) => Promise<void>;
  isCursorHost?: () => boolean;
  now?: () => number;
}

const COMPOSER_SUCCESS_WAIT_MS = 1500;
/** Only treat createNew as failed (chat fallback) if it rejects within this window. */
const COMPOSER_CREATE_NEW_QUICK_FAIL_MS = 50;

let cachedCommands: Set<string> | undefined;
let cachedCommandsAt = 0;
const COMMAND_CACHE_TTL_MS = 60_000;

function defaultIsCursorHost(): boolean {
  return (vscode.env.uriScheme ?? '').toLowerCase() === 'cursor'
    || (vscode.env.appName ?? '').toLowerCase().includes('cursor');
}

async function getAvailableCommands(deps: AgentPanelLauncherDeps): Promise<Set<string>> {
  const now = deps.now?.() ?? Date.now();
  if (cachedCommands && now - cachedCommandsAt < COMMAND_CACHE_TTL_MS) {
    return cachedCommands;
  }
  const list = await (deps.getCommands?.() ?? vscode.commands.getCommands(true));
  cachedCommands = new Set(list);
  cachedCommandsAt = now;
  return cachedCommands;
}

async function readComposerPaneIds(
  executeCommand: AgentPanelLauncherDeps['executeCommand'],
  cmds: Set<string>,
): Promise<string[] | undefined> {
  if (!cmds.has('composer.getOrderedSelectedComposerIds')) {
    return undefined;
  }
  try {
    const ids = await executeCommand?.('composer.getOrderedSelectedComposerIds');
    return Array.isArray(ids) ? ids.map(String) : undefined;
  } catch {
    return undefined;
  }
}

function composerIdsIncreased(before: string[] | undefined, after: string[] | undefined): boolean {
  if (!before || !after) return true;
  return after.length > before.length;
}

function findNewComposerId(before: string[] | undefined, after: string[] | undefined): string | undefined {
  if (!after?.length) return undefined;
  if (!before?.length) return after[after.length - 1];
  const beforeSet = new Set(before);
  const added = after.filter((id) => !beforeSet.has(id));
  return added[added.length - 1] ?? (after.length > before.length ? after[after.length - 1] : undefined);
}

const COMPOSER_FOCUS_COMMANDS = [
  'composer.openComposer',
  'composer.focusComposer',
  'composer.selectComposer',
] as const;

function tryFocusComposerById(
  composerId: string,
  cmds: Set<string>,
  executeCommand: NonNullable<AgentPanelLauncherDeps['executeCommand']>,
): void {
  for (const command of COMPOSER_FOCUS_COMMANDS) {
    if (!cmds.has(command)) continue;
    void executeCommand(command, { composerId }).then(undefined, () => undefined);
    void executeCommand(command, composerId).then(undefined, () => undefined);
    return;
  }
}

async function tryCursorComposerCreateNew(
  request: AgentPanelLaunchRequest,
  deps: AgentPanelLauncherDeps,
): Promise<AgentLaunchResult | undefined> {
  const cmds = await getAvailableCommands(deps);
  if (!cmds.has('composer.createNew')) {
    return undefined;
  }
  const executeCommand = deps.executeCommand ?? vscode.commands.executeCommand.bind(vscode.commands);

  const beforeIds = await readComposerPaneIds(executeCommand, cmds);
  const payload = {
    openInNewTab: true,
    view: 'pane',
    unifiedMode: 'agent',
    partialState: {
      text: request.text,
      richText: request.text,
      unifiedMode: 'agent',
    },
    ...(request.autoSubmit ? { autoSubmit: true } : {}),
  };

  const sleep = deps.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  let createNewPending: Thenable<unknown>;
  try {
    createNewPending = executeCommand('composer.createNew', payload);
  } catch (error) {
    logger.warn('composer.createNew failed', error as Error);
    return undefined;
  }

  const quickOutcome = await Promise.race([
    Promise.resolve(createNewPending).then(
      () => 'settled' as const,
      () => 'rejected' as const,
    ),
    sleep(COMPOSER_CREATE_NEW_QUICK_FAIL_MS).then(() => 'slow' as const),
  ]);

  if (quickOutcome === 'rejected') {
    logger.warn('composer.createNew rejected quickly');
    return undefined;
  }

  if (quickOutcome === 'slow') {
    void Promise.resolve(createNewPending).catch((error: unknown) => {
      logger.warn('composer.createNew failed after invoke', error as Error);
    });
  }

  void (async () => {
    await sleep(100);
    const earlyIds = await readComposerPaneIds(executeCommand, cmds);
    const newComposerId = findNewComposerId(beforeIds, earlyIds);
    if (newComposerId) {
      tryFocusComposerById(newComposerId, cmds, executeCommand);
    }

    await sleep(COMPOSER_SUCCESS_WAIT_MS);
    const afterIds = await readComposerPaneIds(executeCommand, cmds);
    if (!composerIdsIncreased(beforeIds, afterIds)) {
      logger.warn(
        `composer.createNew did not confirm a new pane within ${COMPOSER_SUCCESS_WAIT_MS}ms (background check)`,
      );
      void vscode.window.showWarningMessage(
        request.autoSubmit
          ? t('agentLaunch.submitNotConfirmed')
          : t('agentLaunch.panelNotConfirmed'),
      );
      void vscode.window.showInformationMessage?.(t('agentLaunch.cursorNewTabHint'));
    } else {
      const confirmedNewId = findNewComposerId(beforeIds, afterIds);
      if (confirmedNewId) {
        tryFocusComposerById(confirmedNewId, cmds, executeCommand);
      }
    }
  })();

  return {
    success: true,
    layer: 'composerCreateNew',
    outcome: request.autoSubmit ? 'submitted' : 'prefilled',
  };
}

async function tryCursorChatOpen(
  request: AgentPanelLaunchRequest,
  deps: AgentPanelLauncherDeps,
): Promise<AgentLaunchResult | undefined> {
  const cmds = await getAvailableCommands(deps);
  if (!cmds.has('workbench.action.chat.open')) {
    return undefined;
  }
  const executeCommand = deps.executeCommand ?? vscode.commands.executeCommand.bind(vscode.commands);

  try {
    const chatArgs = buildChatOpenLaunchArgs(request.text, request.autoSubmit);
    await executeCommand('workbench.action.chat.open', chatArgs);
    if (cmds.has('composerMode.agent')) {
      void executeCommand('composerMode.agent').then(undefined, () => undefined);
    }
    return {
      success: true,
      layer: 'chatOpen',
      outcome: request.autoSubmit ? 'submitted' : 'prefilled',
    };
  } catch (error) {
    logger.warn('workbench.action.chat.open failed on Cursor', error as Error);
    return undefined;
  }
}

async function tryDeeplink(
  request: AgentPanelLaunchRequest,
  deps: AgentPanelLauncherDeps,
): Promise<AgentLaunchResult | undefined> {
  const openExternal = deps.openExternal ?? vscode.env.openExternal.bind(vscode.env);
  try {
    const opened = await openExternal(vscode.Uri.parse(buildCursorPromptDeeplink(request.text)));
    if (!opened) return undefined;
    return {
      success: true,
      layer: 'deeplink',
      outcome: 'prefilled',
    };
  } catch (error) {
    logger.warn('Cursor deeplink launch failed', error as Error);
    return undefined;
  }
}

async function tryVsCodeChatOpen(
  request: AgentPanelLaunchRequest,
  deps: AgentPanelLauncherDeps,
): Promise<AgentLaunchResult | undefined> {
  const cmds = await getAvailableCommands(deps);
  if (!cmds.has('workbench.action.chat.open')) {
    return undefined;
  }
  const executeCommand = deps.executeCommand ?? vscode.commands.executeCommand.bind(vscode.commands);

  const chatArgs = buildChatOpenLaunchArgs(request.text, request.autoSubmit);
  try {
    await executeCommand('workbench.action.chat.open', chatArgs);
    return {
      success: true,
      layer: 'vscodeChat',
      outcome: request.autoSubmit ? 'submitted' : 'prefilled',
    };
  } catch (error) {
    if (request.autoSubmit) {
      logger.warn('workbench.action.chat.open submit failed; falling back to prefill', error as Error);
      try {
        await executeCommand('workbench.action.chat.open', buildChatOpenLaunchArgs(request.text, false));
        return {
          success: true,
          layer: 'vscodeChat',
          outcome: 'prefilled',
        };
      } catch (fallbackError) {
        logger.warn('workbench.action.chat.open prefill fallback failed on VS Code', fallbackError as Error);
        return undefined;
      }
    }
    logger.warn('workbench.action.chat.open failed on VS Code', error as Error);
    return undefined;
  }
}

async function clipboardFallback(
  request: AgentPanelLaunchRequest,
  deps: AgentPanelLauncherDeps,
): Promise<AgentLaunchResult> {
  const writeClipboard = deps.writeClipboard ?? vscode.env.clipboard.writeText.bind(vscode.env.clipboard);
  await writeClipboard(request.text);
  return {
    success: true,
    layer: 'clipboard',
    outcome: 'copied',
  };
}

export function resetAgentPanelLauncherCommandCache(): void {
  cachedCommands = undefined;
  cachedCommandsAt = 0;
}

export async function launchAgentPanelPrompt(
  request: AgentPanelLaunchRequest,
  deps: AgentPanelLauncherDeps = {},
): Promise<AgentLaunchResult> {
  const isCursor = deps.isCursorHost?.() ?? defaultIsCursorHost();

  if (isCursor) {
    const composerResult = await tryCursorComposerCreateNew(request, deps);
    if (composerResult) return composerResult;

    const chatResult = await tryCursorChatOpen(request, deps);
    if (chatResult) return chatResult;

    const deeplinkResult = await tryDeeplink(request, deps);
    if (deeplinkResult) return deeplinkResult;

    return clipboardFallback(request, deps);
  }

  const vscodeResult = await tryVsCodeChatOpen(request, deps);
  if (vscodeResult) return vscodeResult;

  return clipboardFallback(request, deps);
}
