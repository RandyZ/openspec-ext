// Message types from webview to extension
export type WebviewMessage =
  | { type: 'getDashboardData' }
  | { type: 'refresh' }
  | { type: 'toggleTask'; changeName: string; taskIndex: number }
  | { type: 'openChange'; changeName: string }
  | { type: 'openArtifact'; changeName: string; artifactType: string }
  | { type: 'createChange'; name: string }
  | { type: 'requestNewChange' }
  | { type: 'copyToClipboard'; text: string }
  | { type: 'openSpec'; path: string }
  | { type: 'archiveChange'; name: string }
  | { type: 'getArtifactContent'; changeName: string; artifactType: string }
  | { type: 'listDeltaSpecs'; changeName: string }
  | { type: 'getDeltaSpecContent'; changeName: string; specId: string }
  | { type: 'openChangeDetailInEditor'; changeName: string }
  | { type: 'getArchivedChanges' }
  | { type: 'revealSidebar' }
  | { type: 'executeTask'; changeName: string; taskIndex: number; taskText: string }
  | { type: 'getAgentAdapters' }
  | { type: 'setPreferredAgentAdapter'; adapterId: string }
  | { type: 'requestCreateArtifact'; changeName: string; artifactType: string }
  | { type: 'runCommand'; commandId: string; argsJson?: string; changeName?: string }
  | { type: 'getTaskExecutionState'; changeName: string };

// Message types from extension to webview
export type ExtensionMessage =
  | { type: 'dashboardData'; data: DashboardData; debug?: boolean }
  | { type: 'error'; message: string }
  | { type: 'artifactContent'; changeName: string; artifactType: string; content: string }
  | { type: 'artifactContentError'; changeName: string; artifactType: string; message: string; code?: string }
  | { type: 'deltaSpecList'; changeName: string; specIds: string[] }
  | { type: 'deltaSpecContent'; changeName: string; specId: string; content: string }
  | { type: 'deltaSpecContentError'; changeName: string; specId: string; message: string }
  | { type: 'setContext'; view: 'changeDetail'; changeName: string; existingArtifactIds?: string[]; debug?: boolean }
  | { type: 'archivedChanges'; items: ArchivedChangeInfo[] }
  | { type: 'agentAdapters'; available: { id: string; displayName: string }[]; currentId: string | null }
  | { type: 'taskExecutionFinished'; changeName: string; taskIndex: number; success: boolean; executionState?: Record<number, { success: boolean; timestamp: number }> }
  | { type: 'taskExecutionState'; changeName: string; executionState: Record<number, { success: boolean; timestamp: number }> }
  | { type: 'runCommandResult'; success: boolean; message?: string };

// Data types
export interface DashboardData {
  changes: ChangeInfo[];
  specs: SpecInfo[];
  lastRefresh: number;
}

export interface ChangeInfo {
  name: string;
  completedTasks: number;
  totalTasks: number;
  lastModified: string;
  status: 'draft' | 'in-progress' | 'complete';
  artifacts?: ArtifactStatus[];
}

export interface ArtifactStatus {
  id: string;
  outputPath: string;
  status: 'done' | 'ready' | 'blocked';
}

export interface SpecInfo {
  id: string;
  requirementCount: number;
  path?: string;
}

export interface ArchivedChangeInfo {
  directoryName: string;
  name: string;
  archiveDate: string;
}

// Helper functions for sending messages
export const sendMessage = {
  getDashboardData: (): WebviewMessage => ({
    type: 'getDashboardData',
  }),

  refresh: (): WebviewMessage => ({
    type: 'refresh',
  }),

  toggleTask: (changeName: string, taskIndex: number): WebviewMessage => ({
    type: 'toggleTask',
    changeName,
    taskIndex,
  }),

  openChange: (changeName: string): WebviewMessage => ({
    type: 'openChange',
    changeName,
  }),

  openArtifact: (changeName: string, artifactType: string): WebviewMessage => ({
    type: 'openArtifact',
    changeName,
    artifactType,
  }),

  createChange: (name: string): WebviewMessage => ({
    type: 'createChange',
    name,
  }),

  requestNewChange: (): WebviewMessage => ({
    type: 'requestNewChange',
  }),

  copyToClipboard: (text: string): WebviewMessage => ({
    type: 'copyToClipboard',
    text,
  }),

  openSpec: (path: string): WebviewMessage => ({
    type: 'openSpec',
    path,
  }),

  archiveChange: (name: string): WebviewMessage => ({
    type: 'archiveChange',
    name,
  }),

  getArtifactContent: (changeName: string, artifactType: string): WebviewMessage => ({
    type: 'getArtifactContent',
    changeName,
    artifactType,
  }),

  listDeltaSpecs: (changeName: string): WebviewMessage => ({
    type: 'listDeltaSpecs',
    changeName,
  }),

  getDeltaSpecContent: (changeName: string, specId: string): WebviewMessage => ({
    type: 'getDeltaSpecContent',
    changeName,
    specId,
  }),

  openChangeDetailInEditor: (changeName: string): WebviewMessage => ({
    type: 'openChangeDetailInEditor',
    changeName,
  }),

  getArchivedChanges: (): WebviewMessage => ({
    type: 'getArchivedChanges',
  }),

  revealSidebar: (): WebviewMessage => ({
    type: 'revealSidebar',
  }),

  executeTask: (changeName: string, taskIndex: number, taskText: string): WebviewMessage => ({
    type: 'executeTask',
    changeName,
    taskIndex,
    taskText,
  }),

  getAgentAdapters: (): WebviewMessage => ({
    type: 'getAgentAdapters',
  }),

  setPreferredAgentAdapter: (adapterId: string): WebviewMessage => ({
    type: 'setPreferredAgentAdapter',
    adapterId,
  }),

  requestCreateArtifact: (changeName: string, artifactType: string): WebviewMessage => ({
    type: 'requestCreateArtifact',
    changeName,
    artifactType,
  }),

  runCommand: (commandId: string, argsJson?: string, changeName?: string): WebviewMessage => ({
    type: 'runCommand',
    commandId,
    ...(argsJson !== undefined && argsJson !== '' ? { argsJson } : {}),
    ...(changeName !== undefined ? { changeName } : {}),
  }),

  getTaskExecutionState: (changeName: string): WebviewMessage => ({
    type: 'getTaskExecutionState',
    changeName,
  }),
};
