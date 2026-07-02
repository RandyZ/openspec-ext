import type { WorkflowAction } from '../../shared/workflowCommand';
import type { WorkflowLaunchConfigView } from '../../shared/workflowLaunchConfig';
import type {
  ChangeDetailTabId,
  InteractiveWorkflowAction,
  InteractiveWorkflowState,
} from '../../shared/interactiveWorkflow';

export type LoadingReason =
  | 'initial'
  | 'refresh'
  | 'scope-switch'
  | 'store-register'
  | 'store-setup'
  | 'background-refresh';

// Message types from webview to extension
export type WebviewMessage =
  | { type: 'getDashboardData' }
  | { type: 'getCacheStats'; force?: boolean }
  | { type: 'cacheAction'; action: CacheAction }
  | { type: 'refresh' }
  | { type: 'toggleTask'; changeName: string; taskIndex: number; scopeId?: string }
  | { type: 'openChange'; changeName: string }
  | { type: 'openArtifact'; changeName: string; artifactType: string; scopeId?: string }
  | { type: 'createChange'; name: string }
  | { type: 'requestNewChange' }
  | { type: 'copyToClipboard'; text: string }
  | { type: 'openSpec'; path: string }
  | { type: 'openDeltaSpec'; changeName: string; specId: string; scopeId?: string }
  | { type: 'archiveChange'; name: string }
  | { type: 'getArtifactContent'; changeName: string; artifactType: string; scopeId?: string }
  | { type: 'listDeltaSpecs'; changeName: string; scopeId?: string }
  | { type: 'getDeltaSpecContent'; changeName: string; specId: string; scopeId?: string }
  | {
    type: 'openChangeDetailInEditor';
    changeName: string;
    initialTab?: ChangeDetailTabId;
    interactiveAction?: InteractiveWorkflowAction;
    scopeId?: string;
  }
  | { type: 'getArchivedChanges'; scopeId?: string }
  | { type: 'revealSidebar' }
  | { type: 'executeTask'; changeName: string; taskIndex: number; taskText: string; scopeId?: string }
  | { type: 'getAgentAdapters' }
  | { type: 'getWorkflowLaunchConfig' }
  | { type: 'setPreferredAgentAdapter'; adapterId: string }
  | { type: 'requestCreateArtifact'; changeName: string; artifactType: string }
  | { type: 'runCommand'; commandId: string; argsJson?: string; changeName?: string }
  | { type: 'fillChat'; prompt: string }
  | { type: 'launchWorkflowAction'; action: WorkflowAction; changeName: string; scopeId?: string }
  | { type: 'getSpecContent'; specId: string; scopeId?: string }
  | { type: 'getSpecRequirements'; specId: string; scopeId?: string }
  | { type: 'openSpecInEditor'; specId: string; requirementIndex?: number; scopeId?: string }
  | { type: 'getTaskExecutionState'; changeName: string; scopeId?: string }
  | { type: 'runInteractiveWorkflow'; changeName: string; action: InteractiveWorkflowAction; scopeId?: string }
  | { type: 'revealInteractiveWorkflow'; changeName: string; action: InteractiveWorkflowAction; scopeId?: string }
  | { type: 'stopInteractiveWorkflow'; changeName: string; action: InteractiveWorkflowAction; scopeId?: string }
  | { type: 'clearInteractiveWorkflow'; changeName: string; action: InteractiveWorkflowAction; scopeId?: string }
  | { type: 'getInteractiveWorkflowState'; changeName: string; scopeId?: string }
  | { type: 'retryCliDetection' }
  | { type: 'openCliPathSettings' }
  | { type: 'copyCliDiagnostic' }
  | { type: 'openCliInstallDocs' }
  | { type: 'selectScope'; scopeId: string }
  | { type: 'openWorkset'; name: string }
  | { type: 'requestRegisterStore' }
  | { type: 'requestSetupStore' };

// Message types from extension to webview
export interface WebviewCacheMeta {
  source: 'memory' | 'disk' | 'fresh';
  stale: boolean;
  generatedAt?: number;
}

export type CacheAction = 'openFolder' | 'copyPath' | 'clear' | 'showDetails';

export interface CacheStatsView {
  rootPath: string;
  totalBytes: number;
  formattedSize: string;
  fileCount: number;
  calculatedAt: number;
  isCalculating: boolean;
  error?: string;
}

export type ExtensionMessage =
  | { type: 'dashboardData'; data: DashboardData; debug?: boolean; cache?: WebviewCacheMeta }
  | { type: 'cacheStats'; stats: CacheStatsView }
  | { type: 'cacheActionResult'; action: CacheAction; success: boolean; message?: string }
  | { type: 'error'; message: string }
  | { type: 'artifactContent'; changeName: string; artifactType: string; content: string; cache?: WebviewCacheMeta }
  | { type: 'artifactContentError'; changeName: string; artifactType: string; message: string; code?: string }
  | { type: 'deltaSpecList'; changeName: string; specIds: string[] }
  | { type: 'deltaSpecContent'; changeName: string; specId: string; content: string; cache?: WebviewCacheMeta }
  | { type: 'deltaSpecContentError'; changeName: string; specId: string; message: string }
  | {
    type: 'setContext';
    view: 'changeDetail';
    changeName: string;
    existingArtifactIds?: string[];
    debug?: boolean;
    initialTab?: ChangeDetailTabId;
    interactiveAction?: InteractiveWorkflowAction;
    scope?: OpenSpecScopeView;
  }
  | { type: 'archivedChanges'; items: ArchivedChangeInfo[]; scopeId?: string }
  | { type: 'agentAdapters'; available: { id: string; displayName: string }[]; currentId: string | null }
  | { type: 'workflowLaunchConfig'; config: WorkflowLaunchConfigView }
  | { type: 'taskExecutionFinished'; changeName: string; taskIndex: number; success: boolean; executionState?: Record<number, { success: boolean; timestamp: number }> }
  | { type: 'taskExecutionState'; changeName: string; executionState: Record<number, { success: boolean; timestamp: number }> }
  | { type: 'runCommandResult'; success: boolean; message?: string }
  | { type: 'specContent'; specId: string; content: string; cache?: WebviewCacheMeta }
  | { type: 'specContentError'; specId: string; message: string }
  | { type: 'specRequirements'; specId: string; requirements: string[] }
  | { type: 'artifactInvalidated'; changeName: string; artifactTypes: string[] }
  | { type: 'interactiveWorkflowState'; changeName: string; state: InteractiveWorkflowState }
  | { type: 'cliActivationDiagnostic'; diagnostic: CliActivationDiagnosticView; mode: 'blocking' | 'warning' };

// Data types
export interface CliActivationDiagnosticView {
  category: string;
  message: string;
  recoveryActions: string[];
  safeDetails: string[];
  copyText: string;
  canRetry: boolean;
  normalizedMessage: string;
}

export interface OpenSpecScopeView {
  id: string;
  label: string;
  source: 'local' | 'store' | 'declared';
  rootPath: string;
  storeId?: string;
  runtimeSource: 'installed' | 'customPath' | 'localSource';
  capabilities?: {
    stores: boolean;
    context: boolean;
    doctor: boolean;
    worksets: boolean;
    diagnostics: { code: string; message: string; severity: 'info' | 'warning' | 'error' }[];
  };
}

export interface ReferenceIndexEntryView {
  store_id: string;
  specs?: { id: string; summary?: string }[];
  fetch?: string;
  status: { severity: string; code: string; message: string; fix?: string }[];
}

export interface RelationshipPanelData {
  references: ReferenceIndexEntryView[];
  health?: { root: { path: string; healthy: boolean; status: unknown[] } };
}

export interface FeatureDiagnosticView {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface WorksetView {
  name: string;
  tool?: string;
  members: { name: string; path: string }[];
}

export interface DashboardData {
  scope?: OpenSpecScopeView;
  scopes?: OpenSpecScopeView[];
  relationships?: RelationshipPanelData;
  featureDiagnostics?: FeatureDiagnosticView[];
  worksets?: WorksetView[];
  changes: ChangeInfo[];
  specs: SpecInfo[];
  archivedChanges?: ArchivedChangeInfo[];
  lastRefresh: number;
}

export interface ChangeInfo {
  name: string;
  completedTasks: number;
  totalTasks: number;
  lastModified: string;
  createdAt?: string;
  status: 'draft' | 'in-progress' | 'complete';
  artifacts?: ArtifactStatus[];
  proposalWhySummary?: string;
  proposalWhyFullText?: string;
  searchText?: string;
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

  getCacheStats: (force = false): WebviewMessage => (
    force ? { type: 'getCacheStats', force: true } : { type: 'getCacheStats' }
  ),

  cacheAction: (action: CacheAction): WebviewMessage => ({
    type: 'cacheAction',
    action,
  }),

  refresh: (): WebviewMessage => ({
    type: 'refresh',
  }),

  toggleTask: (changeName: string, taskIndex: number, scopeId?: string): WebviewMessage => ({
    type: 'toggleTask',
    changeName,
    taskIndex,
    ...(scopeId ? { scopeId } : {}),
  }),

  openChange: (changeName: string): WebviewMessage => ({
    type: 'openChange',
    changeName,
  }),

  openArtifact: (changeName: string, artifactType: string, scopeId?: string): WebviewMessage => ({
    type: 'openArtifact',
    changeName,
    artifactType,
    ...(scopeId ? { scopeId } : {}),
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

  openDeltaSpec: (changeName: string, specId: string, scopeId?: string): WebviewMessage => ({
    type: 'openDeltaSpec',
    changeName,
    specId,
    ...(scopeId ? { scopeId } : {}),
  }),

  archiveChange: (name: string): WebviewMessage => ({
    type: 'archiveChange',
    name,
  }),

  getArtifactContent: (changeName: string, artifactType: string, scopeId?: string): WebviewMessage => ({
    type: 'getArtifactContent',
    changeName,
    artifactType,
    ...(scopeId ? { scopeId } : {}),
  }),

  listDeltaSpecs: (changeName: string, scopeId?: string): WebviewMessage => ({
    type: 'listDeltaSpecs',
    changeName,
    ...(scopeId ? { scopeId } : {}),
  }),

  getDeltaSpecContent: (changeName: string, specId: string, scopeId?: string): WebviewMessage => ({
    type: 'getDeltaSpecContent',
    changeName,
    specId,
    ...(scopeId ? { scopeId } : {}),
  }),

  openChangeDetailInEditor: (
    changeName: string,
    initialTab?: ChangeDetailTabId,
    interactiveAction?: InteractiveWorkflowAction,
    scopeId?: string
  ): WebviewMessage => ({
    type: 'openChangeDetailInEditor',
    changeName,
    ...(initialTab !== undefined ? { initialTab } : {}),
    ...(interactiveAction !== undefined ? { interactiveAction } : {}),
    ...(scopeId ? { scopeId } : {}),
  }),

  getArchivedChanges: (scopeId?: string): WebviewMessage => ({
    type: 'getArchivedChanges',
    ...(scopeId ? { scopeId } : {}),
  }),

  revealSidebar: (): WebviewMessage => ({
    type: 'revealSidebar',
  }),

  executeTask: (changeName: string, taskIndex: number, taskText: string, scopeId?: string): WebviewMessage => ({
    type: 'executeTask',
    changeName,
    taskIndex,
    taskText,
    ...(scopeId ? { scopeId } : {}),
  }),

  getAgentAdapters: (): WebviewMessage => ({
    type: 'getAgentAdapters',
  }),

  getWorkflowLaunchConfig: (): WebviewMessage => ({
    type: 'getWorkflowLaunchConfig',
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

  fillChat: (prompt: string): WebviewMessage => ({
    type: 'fillChat',
    prompt,
  }),

  launchWorkflowAction: (action: WorkflowAction, changeName: string, scopeId?: string): WebviewMessage => ({
    type: 'launchWorkflowAction',
    action,
    changeName,
    ...(scopeId ? { scopeId } : {}),
  }),

  getSpecContent: (specId: string, scopeId?: string): WebviewMessage => ({
    type: 'getSpecContent',
    specId,
    ...(scopeId ? { scopeId } : {}),
  }),

  getSpecRequirements: (specId: string, scopeId?: string): WebviewMessage => ({
    type: 'getSpecRequirements',
    specId,
    ...(scopeId ? { scopeId } : {}),
  }),

  openSpecInEditor: (specId: string, requirementIndex?: number, scopeId?: string): WebviewMessage => ({
    type: 'openSpecInEditor',
    specId,
    ...(requirementIndex !== undefined ? { requirementIndex } : {}),
    ...(scopeId ? { scopeId } : {}),
  }),

  getTaskExecutionState: (changeName: string, scopeId?: string): WebviewMessage => ({
    type: 'getTaskExecutionState',
    changeName,
    ...(scopeId ? { scopeId } : {}),
  }),

  runInteractiveWorkflow: (changeName: string, action: InteractiveWorkflowAction, scopeId?: string): WebviewMessage => ({
    type: 'runInteractiveWorkflow',
    changeName,
    action,
    ...(scopeId ? { scopeId } : {}),
  }),

  revealInteractiveWorkflow: (changeName: string, action: InteractiveWorkflowAction, scopeId?: string): WebviewMessage => ({
    type: 'revealInteractiveWorkflow',
    changeName,
    action,
    ...(scopeId ? { scopeId } : {}),
  }),

  stopInteractiveWorkflow: (changeName: string, action: InteractiveWorkflowAction, scopeId?: string): WebviewMessage => ({
    type: 'stopInteractiveWorkflow',
    changeName,
    action,
    ...(scopeId ? { scopeId } : {}),
  }),

  clearInteractiveWorkflow: (changeName: string, action: InteractiveWorkflowAction, scopeId?: string): WebviewMessage => ({
    type: 'clearInteractiveWorkflow',
    changeName,
    action,
    ...(scopeId ? { scopeId } : {}),
  }),

  getInteractiveWorkflowState: (changeName: string, scopeId?: string): WebviewMessage => ({
    type: 'getInteractiveWorkflowState',
    changeName,
    ...(scopeId ? { scopeId } : {}),
  }),

  retryCliDetection: (): WebviewMessage => ({
    type: 'retryCliDetection',
  }),

  openCliPathSettings: (): WebviewMessage => ({
    type: 'openCliPathSettings',
  }),

  copyCliDiagnostic: (): WebviewMessage => ({
    type: 'copyCliDiagnostic',
  }),

  openCliInstallDocs: (): WebviewMessage => ({
    type: 'openCliInstallDocs',
  }),

  selectScope: (scopeId: string): WebviewMessage => ({
    type: 'selectScope',
    scopeId,
  }),

  openWorkset: (name: string): WebviewMessage => ({
    type: 'openWorkset',
    name,
  }),

  requestRegisterStore: (): WebviewMessage => ({
    type: 'requestRegisterStore',
  }),

  requestSetupStore: (): WebviewMessage => ({
    type: 'requestSetupStore',
  }),
};
