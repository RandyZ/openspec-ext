import { isCursorHost } from './isCursorHost';

/**
 * OpenSpec CLI workset opener id for the current IDE host (see config openers:
 * typically `code` for VS Code, `cursor` for Cursor). Not the VS Code product
 * name "vscode".
 */
export function defaultHostWorksetOpenerTool(): 'code' | 'cursor' {
  return isCursorHost() ? 'cursor' : 'code';
}
