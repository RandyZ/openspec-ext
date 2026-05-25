import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { TaskExecutorService } from '@extension/services/taskExecutorService';

const fillChat = vi.fn();
const executeTask = vi.fn();

vi.mock('vscode', () => ({
  window: {
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
  },
  workspace: {
    getConfiguration: vi.fn(),
  },
  env: {
    clipboard: {
      writeText: vi.fn(),
    },
  },
}));

vi.mock('@extension/adapters', () => ({
  getCurrentAdapter: vi.fn(async () => ({
    id: 'cursor',
    displayName: 'Cursor',
    isAvailable: vi.fn(),
    fillChat,
    executeTask,
  })),
}));

vi.mock('@extension/utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

const getConfiguration = vi.mocked(vscode.workspace.getConfiguration);

function mockConfig(values: Record<string, unknown>) {
  getConfiguration.mockReturnValue({
    get: vi.fn((key: string) => values[key]),
  } as any);
}

describe('TaskExecutorService workflow command generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fillChat.mockResolvedValue({ success: true, adapterId: 'cursor' });
    executeTask.mockResolvedValue({ success: true, adapterId: 'cursor' });
  });

  it('uses Cursor hyphen command when fillChat routes through Cursor adapter', async () => {
    mockConfig({
      taskExecutionMode: 'fillChat',
      taskDependencyPolicy: 'block',
      workflowLaunchMode: 'adapter',
      preferredAgentAdapter: 'cursor',
    });

    const service = new TaskExecutorService('/workspace', {
      readTasks: vi.fn(async () => [{ done: false, text: 'Task', indent: 0 }]),
      getDirectChildIndices: vi.fn(() => []),
      autoCompleteParents: vi.fn(),
    } as any);

    await service.execute('demo-change', 0, 'Task');

    expect(fillChat).toHaveBeenCalledWith(
      expect.objectContaining({
        promptOverride: '/opsx-apply demo-change',
      })
    );
  });

  it('uses clipboard colon command by default without invoking adapter fillChat', async () => {
    const writeText = vi.mocked(vscode.env.clipboard.writeText);
    mockConfig({
      taskExecutionMode: 'fillChat',
      taskDependencyPolicy: 'block',
    });

    const service = new TaskExecutorService('/workspace', {
      readTasks: vi.fn(async () => [{ done: false, text: 'Task', indent: 0 }]),
      getDirectChildIndices: vi.fn(() => []),
      autoCompleteParents: vi.fn(),
    } as any);

    await service.execute('demo-change', 0, 'Task');

    expect(writeText).toHaveBeenCalledWith('/opsx:apply demo-change');
    expect(fillChat).not.toHaveBeenCalled();
  });

  it('keeps auto mode on executeTask and uses builder prompt for the selected adapter', async () => {
    mockConfig({
      taskExecutionMode: 'auto',
      taskDependencyPolicy: 'block',
      workflowLaunchMode: 'clipboard',
      preferredAgentAdapter: 'cursor',
    });

    const service = new TaskExecutorService('/workspace', {
      readTasks: vi.fn(async () => [{ done: false, text: 'Task', indent: 0 }]),
      getDirectChildIndices: vi.fn(() => []),
      autoCompleteParents: vi.fn(),
    } as any);

    await service.execute('demo-change', 0, 'Task');

    expect(executeTask).toHaveBeenCalledWith(
      expect.objectContaining({
        promptOverride: '/opsx-apply demo-change',
      })
    );
    expect(fillChat).not.toHaveBeenCalled();
  });
});
