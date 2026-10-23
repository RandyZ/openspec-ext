import { afterEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { defaultHostWorksetOpenerTool } from '@extension/utils/defaultHostWorksetOpenerTool';

describe('defaultHostWorksetOpenerTool', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses code on VS Code hosts', () => {
    vi.mocked(vscode.env).appName = 'Visual Studio Code';
    vi.mocked(vscode.env).uriScheme = 'vscode';
    expect(defaultHostWorksetOpenerTool()).toBe('code');
  });

  it('uses cursor on Cursor hosts', () => {
    vi.mocked(vscode.env).appName = 'Cursor';
    vi.mocked(vscode.env).uriScheme = 'cursor';
    expect(defaultHostWorksetOpenerTool()).toBe('cursor');
  });
});
