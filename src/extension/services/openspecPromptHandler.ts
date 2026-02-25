/**
 * Workflow-layer handler: produces the formatted prompt for an opsx command
 * by loading the template and substituting variables from openspec instructions JSON.
 * Does not depend on any adapter.
 */

import * as path from 'path';
import { logger } from '../utils/logger';
import type { OpenSpecCliService } from './openspecCli';

const DEFAULT_APPLY_TEMPLATE = `/opsx:apply {{changeName}}`;

export type FlowType = 'apply';

export interface GetPromptForFlowParams {
  flow: FlowType;
  changeName: string;
  taskIndex?: number;
  taskText?: string;
  contextFiles?: string[];
  workspaceRoot: string;
}

/**
 * Replace {{key}} in template with values from vars. Keys not in vars become empty string.
 */
function substituteTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

/**
 * Fallback when CLI or JSON fails: static prompt compatible with current adapter behavior.
 */
function buildFallbackApplyPrompt(changeName: string, _taskText: string, _contextFiles: string[]): string {
  return `/opsx:apply ${changeName}`;
}

/**
 * Map instructions apply JSON and request context to template variables.
 * OpenSpec CLI may return: instruction, contextFiles, tasks, change, schema/schemaName, state, etc.
 */
function mapApplyInstructionsToVars(
  json: Record<string, unknown>,
  changeName: string,
  taskIndex: number | undefined,
  taskText: string | undefined
): Record<string, string> {
  const instruction = typeof json.instruction === 'string' ? json.instruction : '';
  const schemaName =
    typeof json.schemaName === 'string'
      ? json.schemaName
      : typeof (json as any).schema === 'string'
        ? (json as any).schema
        : '';

  let contextFiles = '';
  if (Array.isArray(json.contextFiles)) {
    contextFiles = (json.contextFiles as string[]).map((f) => `- ${f}`).join('\n');
  } else if (typeof json.contextFiles === 'string') {
    contextFiles = json.contextFiles;
  }

  let taskList = '';
  if (Array.isArray(json.tasks)) {
    taskList = (json.tasks as { text?: string; done?: boolean }[])
      .map((t, i) => {
        const check = t.done ? '[x]' : '[ ]';
        const text = typeof t.text === 'string' ? t.text : '';
        return `${i + 1}. ${check} ${text}`;
      })
      .join('\n');
  } else if (Array.isArray((json as any).taskList)) {
    taskList = ((json as any).taskList as string[]).join('\n');
  }

  let currentTask = '';
  if (taskText) {
    currentTask =
      taskIndex !== undefined ? `Task ${(taskIndex + 1).toString()}: ${taskText}` : taskText;
  }

  return {
    changeName,
    schemaName,
    instruction,
    contextFiles,
    taskList,
    currentTask,
  };
}

/**
 * Get the formatted prompt for the given flow (opsx command).
 * Uses template + openspec instructions JSON variable substitution.
 * On CLI/JSON failure, returns a fallback static prompt.
 */
export async function getPromptForFlow(
  params: GetPromptForFlowParams,
  cliService: OpenSpecCliService
): Promise<string> {
  const { flow, changeName, taskIndex, taskText, contextFiles = [], workspaceRoot: _ } = params;

  if (flow !== 'apply') {
    return buildFallbackApplyPrompt(changeName, taskText ?? '', contextFiles);
  }

  try {
    const raw = await cliService.getInstructions('apply', changeName);
    const json = JSON.parse(raw) as Record<string, unknown>;
    const vars = mapApplyInstructionsToVars(json, changeName, taskIndex, taskText);
    const prompt = substituteTemplate(DEFAULT_APPLY_TEMPLATE, vars);
    return prompt.trim();
  } catch (err) {
    logger.debug('openspecPromptHandler: getInstructions failed, using fallback', err as Error);
    return buildFallbackApplyPrompt(changeName, taskText ?? '', contextFiles);
  }
}
