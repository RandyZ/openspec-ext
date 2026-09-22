/** Agent init launch prompt + clipboard command for P0-B. */

export const OPENSPEC_INIT_COMMAND = 'openspec init';

export function buildAgentInitPrompt(workspacePath?: string): string {
  const target = workspacePath?.trim();
  if (target) {
    return `Please initialize OpenSpec in this repository (${target}). Run \`${OPENSPEC_INIT_COMMAND}\` and set up the standard openspec/ layout when needed.`;
  }
  return `Please initialize OpenSpec in this workspace. Run \`${OPENSPEC_INIT_COMMAND}\` and set up the standard openspec/ layout when needed.`;
}
