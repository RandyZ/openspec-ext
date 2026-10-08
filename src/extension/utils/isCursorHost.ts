import * as vscode from 'vscode';

export function isCursorHost(): boolean {
  return (vscode.env.uriScheme ?? '').toLowerCase() === 'cursor'
    || (vscode.env.appName ?? '').toLowerCase().includes('cursor');
}
