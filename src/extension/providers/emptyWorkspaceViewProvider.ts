import * as vscode from 'vscode';
import { getLocale, t } from '../../i18n';

function escapeHtml(value: string): string {
  const replacements: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (character) => replacements[character]);
}

export function createEmptyWorkspaceHtml(message: string, openFolderLabel: string): string {
  return `<!DOCTYPE html>
<html lang="${escapeHtml(getLocale())}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { color: var(--vscode-foreground); padding: 16px; }
    a { display: inline-block; color: var(--vscode-button-foreground); background: var(--vscode-button-background); padding: 6px 12px; text-decoration: none; }
    a:hover { background: var(--vscode-button-hoverBackground); }
    a:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 2px; }
  </style>
</head>
<body>
  <p>${escapeHtml(message)}</p>
  <a href="command:vscode.openFolder">${escapeHtml(openFolderLabel)}</a>
</body>
</html>`;
}

export class EmptyWorkspaceViewProvider implements vscode.WebviewViewProvider {
  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: false,
      enableCommandUris: ['vscode.openFolder'],
      localResourceRoots: [],
    };
    webviewView.webview.html = createEmptyWorkspaceHtml(
      t('extension.emptyWorkspaceMessage'),
      t('extension.openFolder')
    );
  }
}
