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
  | { type: 'openChangeDetailInEditor'; changeName: string };

// Message types from extension to webview
export type ExtensionMessage =
  | { type: 'dashboardData'; data: DashboardData }
  | { type: 'error'; message: string }
  | { type: 'artifactContent'; changeName: string; artifactType: string; content: string }
  | { type: 'artifactContentError'; changeName: string; artifactType: string; message: string; code?: string }
  | { type: 'deltaSpecList'; changeName: string; specIds: string[] }
  | { type: 'deltaSpecContent'; changeName: string; specId: string; content: string }
  | { type: 'deltaSpecContentError'; changeName: string; specId: string; message: string }
  | { type: 'setContext'; view: 'changeDetail'; changeName: string };

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
};
