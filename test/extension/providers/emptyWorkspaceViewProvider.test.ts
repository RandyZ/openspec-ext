import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../../src/i18n';

vi.mock('vscode', () => ({}));

describe('EmptyWorkspaceViewProvider', () => {
  afterEach(() => setLocale('en'));

  it('renders escaped localized copy with a native open-folder command link', async () => {
    const { createEmptyWorkspaceHtml } = await import(
      '@extension/providers/emptyWorkspaceViewProvider'
    );

    const html = createEmptyWorkspaceHtml(
      'Open <unsafe> & "workspace"',
      'Open <folder>'
    );

    expect(html).toContain('Open &lt;unsafe&gt; &amp; &quot;workspace&quot;');
    expect(html).toContain('Open &lt;folder&gt;');
    expect(html).toContain('href="command:vscode.openFolder"');
    expect(html).toContain("default-src 'none'");
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<unsafe>');
  });

  it('uses safe webview options without scripts or local resource access', async () => {
    const { EmptyWorkspaceViewProvider } = await import(
      '@extension/providers/emptyWorkspaceViewProvider'
    );
    const provider = new EmptyWorkspaceViewProvider();
    const webview = { html: '', options: undefined as unknown };

    provider.resolveWebviewView({ webview } as any);

    expect(webview.options).toEqual({
      enableScripts: false,
      enableCommandUris: ['vscode.openFolder'],
      localResourceRoots: [],
    });
    expect(webview.html).toContain('var(--vscode-foreground)');
    expect(webview.html).toContain('focus-visible');
  });

  it('marks the localized Chinese empty state with the current document language', async () => {
    const { EmptyWorkspaceViewProvider } = await import(
      '@extension/providers/emptyWorkspaceViewProvider'
    );
    const provider = new EmptyWorkspaceViewProvider();
    const webview = { html: '', options: undefined as unknown };
    setLocale('zh-cn');

    provider.resolveWebviewView({ webview } as any);

    expect(webview.html).toContain('<html lang="zh-cn">');
    expect(webview.html).toContain('请先打开项目文件夹以使用 OpenSpec');
    expect(webview.html).toContain('打开文件夹');
  });
});
