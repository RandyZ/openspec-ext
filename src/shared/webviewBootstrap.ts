export type WebviewBootstrapView = 'agentUnavailable';

export interface WebviewBootstrap {
  view: WebviewBootstrapView;
  workspacePath?: string;
}

export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

export function buildWebviewRootAttributes(bootstrap?: WebviewBootstrap): string {
  if (!bootstrap) return '';
  if (bootstrap.view === 'agentUnavailable') {
    const workspacePath = bootstrap.workspacePath
      ? ` data-workspace-path="${escapeHtmlAttribute(bootstrap.workspacePath)}"`
      : '';
    return ` data-openspec-view="agentUnavailable"${workspacePath}`;
  }
  return '';
}

export function readWebviewBootstrap(root: HTMLElement | null): WebviewBootstrap | null {
  if (!root || root.dataset.openspecView !== 'agentUnavailable') {
    return null;
  }
  return {
    view: 'agentUnavailable',
    ...(root.dataset.workspacePath ? { workspacePath: root.dataset.workspacePath } : {}),
  };
}
