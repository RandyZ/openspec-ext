/**
 * Workflow-layer handler: produces the prompt for an opsx command.
 * OpenSpec skills are self-contained — they read context files, tasks,
 * and instructions via CLI. The prompt only needs command + change name.
 */

export type FlowType = 'apply';

export interface GetPromptForFlowParams {
  flow: FlowType;
  changeName: string;
  taskIndex?: number;
  taskText?: string;
  contextFiles?: string[];
  workspaceRoot: string;
}

export async function getPromptForFlow(
  params: GetPromptForFlowParams,
  _cliService: unknown
): Promise<string> {
  return `/opsx:apply ${params.changeName}`;
}
