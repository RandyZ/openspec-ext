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
    return readInlineWebviewBootstrap();
  }
  return {
    view: 'agentUnavailable',
    ...(root.dataset.workspacePath ? { workspacePath: root.dataset.workspacePath } : {}),
  };
}

export function readInlineWebviewBootstrap(): WebviewBootstrap | null {
  const candidate = (globalThis as typeof globalThis & {
    __OPENSPEC_BOOTSTRAP__?: WebviewBootstrap;
  }).__OPENSPEC_BOOTSTRAP__;
  if (candidate?.view === 'agentUnavailable') {
    return candidate;
  }
  return null;
}

export function buildInlineBootstrapScript(bootstrap?: WebviewBootstrap): string {
  if (!bootstrap || bootstrap.view !== 'agentUnavailable') {
    return '';
  }
  const payload = JSON.stringify(bootstrap).replace(/</g, '\\u003c');
  return `<script>window.__OPENSPEC_BOOTSTRAP__=${payload};</script>`;
}
