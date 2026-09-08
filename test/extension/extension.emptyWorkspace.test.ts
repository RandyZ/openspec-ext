import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  commandHandlers: new Map<string, () => unknown>(),
  dataManagerInitialize: vi.fn(),
  dataManagerConstructor: vi.fn(),
  executeCommand: vi.fn(),
  getOpenSpecProjectRoots: vi.fn(),
  getOpenSpecWorkspaceRoot: vi.fn(),
  registerCommand: vi.fn(),
  registerWebviewViewProvider: vi.fn(),
  showErrorMessage: vi.fn(),
  showInformationMessage: vi.fn(),
}));

vi.mock('vscode', () => ({
  env: { language: 'en' },
  commands: {
    executeCommand: mocks.executeCommand,
    registerCommand: mocks.registerCommand,
  },
  window: {
    registerWebviewViewProvider: mocks.registerWebviewViewProvider,
    showErrorMessage: mocks.showErrorMessage,
    showInformationMessage: mocks.showInformationMessage,
  },
  workspace: {
    workspaceFolders: undefined as any,
    getConfiguration: vi.fn(() => ({ get: vi.fn(() => false) })),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
  },
}));

vi.mock('@extension/utils/logger', () => ({
  initLogger: vi.fn(),
  logger: {
    dispose: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@extension/utils/workspaceRoot', () => ({
  getOpenSpecProjectRoots: mocks.getOpenSpecProjectRoots,
  getOpenSpecWorkspaceRoot: mocks.getOpenSpecWorkspaceRoot,
}));

vi.mock('@extension/services/dataManager', () => ({
  DataManager: class {
    initialize = mocks.dataManagerInitialize;
    onArtifactChanged = vi.fn(() => ({ dispose: vi.fn() }));
    dispose = vi.fn();

    constructor(...args: unknown[]) {
      mocks.dataManagerConstructor(...args);
    }
  },
}));

vi.mock('@extension/services/openSpecCacheService', () => ({
  OpenSpecCacheService: class {},
}));

vi.mock('@extension/services/projectDataGateway', () => ({
  createProjectContext: vi.fn(async (name: string, path: string) => ({ name, path })),
  ProjectDataGateway: class {},
}));

vi.mock('@extension/providers/dashboardViewProvider', () => ({
  DashboardViewProvider: class {
    static readonly viewType = 'openspec.dashboard';
    postWorkflowLaunchConfig = vi.fn();
    reveal = vi.fn();
  },
}));

vi.mock('@extension/providers/changeDetailPanelManager', () => ({
  ChangeDetailPanelManager: class {
    notifyArtifactChanged = vi.fn();
    postWorkflowLaunchConfig = vi.fn();
  },
}));

vi.mock('@extension/services/interactiveAgentTerminalManager', () => ({
  InteractiveAgentTerminalManager: class {
    dispose = vi.fn();
  },
}));

vi.mock('@extension/commands/commandManager', () => ({
  CommandManager: class {
    register = vi.fn();
  },
}));

const declaredCommands = [
  'openspec.openDashboard',
  'openspec.refreshData',
  'openspec.newChange',
];

function createContext() {
  return {
    extension: {
      packageJSON: {
        version: '0.2.1',
        contributes: {
          commands: declaredCommands.map((command) => ({ command })),
        },
      },
    },
    extensionPath: '/extension',
    globalStorageUri: { fsPath: '/cache' },
    globalState: {
      get: vi.fn(() => '0.2.1:openspec.dashboard'),
      update: vi.fn(),
    },
    subscriptions: [] as unknown[],
  };
}

describe('activate without a workspace', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.commandHandlers.clear();
    mocks.dataManagerInitialize.mockResolvedValue(undefined);
    mocks.getOpenSpecProjectRoots.mockResolvedValue([]);
    mocks.registerCommand.mockImplementation((command: string, handler: () => unknown) => {
      mocks.commandHandlers.set(command, handler);
      return { dispose: vi.fn() };
    });
    mocks.registerWebviewViewProvider.mockReturnValue({ dispose: vi.fn() });
    const vscode = await import('vscode');
    vscode.workspace.workspaceFolders = undefined;
  });

  it.each([
    ['undefined', undefined],
    ['empty', []],
  ])('shows the lightweight empty state for %s workspace folders', async (_name, folders) => {
    const vscode = await import('vscode');
    vscode.workspace.workspaceFolders = folders as any;
    mocks.getOpenSpecWorkspaceRoot.mockResolvedValue(null);
    const { activate } = await import('@extension/extension');

    await activate(createContext() as any);

    expect(mocks.showErrorMessage).not.toHaveBeenCalled();
    expect(mocks.dataManagerConstructor).not.toHaveBeenCalled();
    expect(mocks.dataManagerInitialize).not.toHaveBeenCalled();
    expect(mocks.registerWebviewViewProvider).toHaveBeenCalledWith(
      'openspec.dashboard',
      expect.any(Object)
    );
  });

  it('registers every declared OpenSpec command with one safe focus handler', async () => {
    mocks.getOpenSpecWorkspaceRoot.mockResolvedValue(null);
    const context = createContext();
    const { activate } = await import('@extension/extension');

    await activate(context as any);

    expect([...mocks.commandHandlers.keys()]).toEqual(declaredCommands);
    for (const handler of mocks.commandHandlers.values()) await handler();
    expect(mocks.executeCommand).toHaveBeenCalledTimes(declaredCommands.length);
    expect(mocks.executeCommand).toHaveBeenCalledWith('openspec.dashboard.focus');
  });

  it('keeps normal single-folder activation on the full service path', async () => {
    const vscode = await import('vscode');
    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: '/work/app' }, name: 'app', index: 0 },
    ];
    mocks.getOpenSpecWorkspaceRoot.mockResolvedValue('/work/app');
    mocks.getOpenSpecProjectRoots.mockResolvedValue([{ path: '/work/app', label: 'app' }]);
    const { activate } = await import('@extension/extension');

    await activate(createContext() as any);

    expect(mocks.dataManagerConstructor).toHaveBeenCalledOnce();
    expect(mocks.dataManagerInitialize).toHaveBeenCalledOnce();
  });

  it('keeps normal multi-folder activation bound to the detected OpenSpec project', async () => {
    const vscode = await import('vscode');
    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: '/work/notes' }, name: 'notes', index: 0 },
      { uri: { fsPath: '/work/app' }, name: 'app', index: 1 },
    ];
    const roots = [{ path: '/work/app', label: 'app' }];
    mocks.getOpenSpecWorkspaceRoot.mockResolvedValue('/work/app');
    mocks.getOpenSpecProjectRoots.mockResolvedValue(roots);
    const { activate } = await import('@extension/extension');

    await activate(createContext() as any);

    expect(mocks.dataManagerConstructor).toHaveBeenCalledWith(
      '/work/app',
      expect.objectContaining({ projectRoots: roots })
    );
  });

  it('preserves the existing CLI activation diagnostic', async () => {
    const vscode = await import('vscode');
    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: '/work/app' }, name: 'app', index: 0 },
    ];
    mocks.getOpenSpecWorkspaceRoot.mockResolvedValue('/work/app');
    mocks.dataManagerInitialize.mockRejectedValue(new Error('OpenSpec CLI not found'));
    const { activate } = await import('@extension/extension');

    await activate(createContext() as any);

    expect(mocks.showErrorMessage).toHaveBeenCalledWith(
      'OpenSpec extension failed to activate: OpenSpec CLI not found'
    );
  });
});
