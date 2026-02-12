/**
 * Stub for "vscode" so Vitest/Vite can resolve the module at build time.
 * At test runtime, vi.mock('vscode', ...) replaces this; this file only satisfies resolution.
 * Named exports ensure "import * as vscode" gets vscode.window and vscode.env.
 */
const noop = (): void => {};
const noopAsync = (): Promise<void> => Promise.resolve();

export const window = {
  createOutputChannel: () => ({
    appendLine: noop,
    show: noop,
    dispose: noop,
  }),
  showErrorMessage: noopAsync,
  showInformationMessage: noopAsync,
};

export const env = {
  openExternal: noopAsync,
};

export default { window, env };
