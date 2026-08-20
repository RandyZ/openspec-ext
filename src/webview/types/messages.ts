import type { WorkflowAction } from '../../shared/workflowCommand';
import type { WorkflowLaunchConfigView } from '../../shared/workflowLaunchConfig';
import type {
  ChangeDetailTabId,
  InteractiveWorkflowAction,
  InteractiveWorkflowState,
} from '../../shared/interactiveWorkflow';
import type {
  ActiveChangeLifecycleStatus,
  ChangeAttention,
  ChangeStatusCounts,
} from '../../shared/changeLifecycle';
import type {
  OpenSpecRootBinding,
  ProjectContext,
  ProjectWorksetNavigationData,
} from '../../extension/services/types';

export type { OpenSpecRootBinding, ProjectContext, ProjectWorksetNavigationData } from '../../extension/services/types';

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
  | { type: 'getProjectSidebarData' }
  | { type: 'selectWorksetProject'; worksetName: string; memberPath: string }
  | { type: 'selectCurrentProject' }
  | { type: 'openChangesExplorer'; project: ProjectContext; binding: OpenSpecRootBinding }
  | { type: 'openSpecsExplorer'; project: ProjectContext; binding: OpenSpecRootBinding }
  | { type: 'getCacheStats'; force?: boolean }
  | { type: 'cacheAction'; action: CacheAction }
  | { type: 'refresh' }
  | { type: 'toggleTask'; changeName: string; taskIndex: number; scopeId?: string }
  | { type: 'openChange'; changeName: string }
  | { type: 'openArtifact'; changeName: string; artifactType: string; scopeId?: string }
  | { type: 'createChange'; name: string; scopeId?: string }
  | { type: 'requestNewChange'; scopeId?: string }
  | { type: 'copyToClipboard'; text: string }
  | { type: 'openSpec'; path: string }
  | { type: 'openDeltaSpec'; changeName: string; specId: string; scopeId?: string }
  | { type: 'archiveChange'; name: string; scopeId?: string }
  | { type: 'getArtifactContent'; changeName: string; artifactType: string; scopeId?: string }
  | { type: 'listDeltaSpecs'; changeName: string; scopeId?: string }
  | { type: 'getDeltaSpecContent'; changeName: string; specId: string; scopeId?: string }
  | {
    type: 'openChangeDetailInEditor';
    changeName: string;
    initialTab?: ChangeDetailTabId;
    interactiveAction?: InteractiveWorkflowAction;
    scopeId?: string;
    project?: ProjectContext;
    binding?: OpenSpecRootBinding;
  }
  | { type: 'getArchivedChanges'; scopeId?: string }
  | { type: 'revealSidebar' }
  | { type: 'executeTask'; changeName: string; taskIndex: number; taskText: string; scopeId?: string }
  | { type: 'getAgentAdapters' }
  | { type: 'getWorkflowLaunchConfig' }
  | { type: 'setPreferredAgentAdapter'; adapterId: string }
  | { type: 'requestCreateArtifact'; changeName: string; artifactType: string; scopeId?: string }
  | { type: 'runCommand'; commandId: string; argsJson?: string; changeName?: string }
  | { type: 'fillChat'; prompt: string }
  | { type: 'launchWorkflowAction'; action: WorkflowAction; changeName: string; scopeId?: string }
  | { type: 'getSpecContent'; specId: string; scopeId?: string }
  | { type: 'getSpecRequirements'; specId: string; scopeId?: string }
  | {
    type: 'openSpecInEditor';
    specId: string;
    requirementIndex?: number;
    scopeId?: string;
    project?: ProjectContext;
    binding?: OpenSpecRootBinding;
  }
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
  | { type: 'removeWorkset'; name: string }
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
    project?: ProjectContext;
    binding?: OpenSpecRootBinding;
  }
  | { type: 'setContext'; view: 'sidebar'; data: ProjectSidebarData }
  | { type: 'setContext'; view: 'changesExplorer'; data: ProjectChangesExplorerData }
  | { type: 'setContext'; view: 'specsExplorer'; data: ProjectSpecsExplorerData }
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
  changeStatusCounts: ChangeStatusCounts;
  lastRefresh: number;
}

export interface ProjectSidebarData {
  readonly project: ProjectContext;
  readonly binding: OpenSpecRootBinding;
  readonly changes: readonly ChangeInfo[];
  readonly cliDiagnostic?: CliActivationDiagnosticView;
  readonly cache?: WebviewCacheMeta;
  readonly workflowLaunchConfig?: WorkflowLaunchConfigView;
  readonly worksetNavigation?: ProjectWorksetNavigationData;
  readonly lastRefresh?: number;
}

export type ProjectPageContextMessage =
  | { type: 'setContext'; view: 'sidebar'; data: ProjectSidebarData }
  | { type: 'setContext'; view: 'changesExplorer'; data: ProjectChangesExplorerData }
  | { type: 'setContext'; view: 'specsExplorer'; data: ProjectSpecsExplorerData };

export interface ProjectChangesExplorerData {
  readonly project: ProjectContext;
  readonly binding: OpenSpecRootBinding;
  readonly changes: readonly ChangeInfo[];
  readonly archivedChanges: readonly ArchivedChangeInfo[];
}

export interface ReferencedStoreSpecGroup {
  readonly storeId: string;
  /** Host-created binding for the referenced Store; error groups may lack one if resolution failed. */
  readonly binding?: OpenSpecRootBinding;
  readonly specs: readonly SpecInfo[];
  readonly error?: string;
}

export interface ProjectSpecsExplorerData {
  readonly project: ProjectContext;
  readonly binding: OpenSpecRootBinding;
  readonly projectSpecs: readonly SpecInfo[];
  readonly referencedStoreSpecs: readonly ReferencedStoreSpecGroup[];
}

export interface ChangeInfo {
  name: string;
  completedTasks: number;
  totalTasks: number;
  lastModified: string;
  createdAt?: string;
  status: 'draft' | 'in-progress' | 'complete';
  /** Host-derived lifecycle; required on production refresh paths. */
  lifecycleStatus: ActiveChangeLifecycleStatus;
  attention?: ChangeAttention;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasProjectBinding(value: unknown): value is { project: ProjectContext; binding: OpenSpecRootBinding } {
  if (!isRecord(value) || !isRecord(value.project) || !isRecord(value.binding)) {
    return false;
  }
  const project = value.project;
  const binding = value.binding;
  return [project.id, project.label, project.projectPath].every((field) => typeof field === 'string' && field.length > 0)
    && typeof binding.projectId === 'string'
    && binding.projectId === project.id
    && typeof binding.commandCwd === 'string'
    && typeof binding.rootPath === 'string'
    && binding.rootPath.length > 0
    && typeof binding.rootSource === 'string';
}

export function isProjectPageContext(message: unknown): message is ProjectPageContextMessage {
  if (!isRecord(message) || message.type !== 'setContext' || !hasProjectBinding(message.data)) {
    return false;
  }

  const data = message.data as Record<string, unknown>;
  const projectId = isRecord(data.project) ? data.project.id : undefined;

  switch (message.view) {
    case 'sidebar':
      return Array.isArray(data.changes);
    case 'changesExplorer':
      return Array.isArray(data.changes) && Array.isArray(data.archivedChanges);
    case 'specsExplorer':
      return Array.isArray(data.projectSpecs)
        && Array.isArray(data.referencedStoreSpecs)
        && data.referencedStoreSpecs.every(
          (group) => {
            if (!isRecord(group) || typeof group.storeId !== 'string' || !Array.isArray(group.specs)) {
              return false;
            }
            if (group.binding === undefined) return true;
            if (!isRecord(group.binding)) return false;
            return group.binding.projectId === projectId
              && group.binding.storeId === group.storeId
              && typeof group.binding.commandCwd === 'string'
              && typeof group.binding.rootPath === 'string'
              && typeof group.binding.rootSource === 'string';
          }
        );
    default:
      return false;
  }
}

// Helper functions for sending messages
export const sendMessage = {
  getDashboardData: (): WebviewMessage => ({
    type: 'getDashboardData',
  }),

  getProjectSidebarData: (): WebviewMessage => ({
    type: 'getProjectSidebarData',
  }),

  selectWorksetProject: (worksetName: string, memberPath: string): WebviewMessage => ({
    type: 'selectWorksetProject',
    worksetName,
    memberPath,
  }),

  selectCurrentProject: (): WebviewMessage => ({
    type: 'selectCurrentProject',
  }),

  openChangesExplorer: (project: ProjectContext, binding: OpenSpecRootBinding): WebviewMessage => ({
    type: 'openChangesExplorer',
    project,
    binding,
  }),

  openSpecsExplorer: (project: ProjectContext, binding: OpenSpecRootBinding): WebviewMessage => ({
    type: 'openSpecsExplorer',
    project,
    binding,
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

  createChange: (name: string, scopeId?: string): WebviewMessage => ({
    type: 'createChange',
    name,
    ...(scopeId ? { scopeId } : {}),
  }),

  requestNewChange: (scopeId?: string): WebviewMessage => ({
    type: 'requestNewChange',
    ...(scopeId ? { scopeId } : {}),
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

  archiveChange: (name: string, scopeId?: string): WebviewMessage => ({
    type: 'archiveChange',
    name,
    ...(scopeId ? { scopeId } : {}),
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
    scopeId?: string,
    project?: ProjectContext,
    binding?: OpenSpecRootBinding
  ): WebviewMessage => ({
    type: 'openChangeDetailInEditor',
    changeName,
    ...(initialTab !== undefined ? { initialTab } : {}),
    ...(interactiveAction !== undefined ? { interactiveAction } : {}),
    ...(scopeId ? { scopeId } : {}),
    ...(project ? { project } : {}),
    ...(binding ? { binding } : {}),
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

  requestCreateArtifact: (changeName: string, artifactType: string, scopeId?: string): WebviewMessage => ({
    type: 'requestCreateArtifact',
    changeName,
    artifactType,
    ...(scopeId ? { scopeId } : {}),
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

  openSpecInEditor: (
    specId: string,
    requirementIndex?: number,
    scopeId?: string,
    project?: ProjectContext,
    binding?: OpenSpecRootBinding
  ): WebviewMessage => ({
    type: 'openSpecInEditor',
    specId,
    ...(requirementIndex !== undefined ? { requirementIndex } : {}),
    ...(scopeId ? { scopeId } : {}),
    ...(project ? { project } : {}),
    ...(binding ? { binding } : {}),
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

  removeWorkset: (name: string): WebviewMessage => ({
    type: 'removeWorkset',
    name,
  }),

  requestRegisterStore: (): WebviewMessage => ({
    type: 'requestRegisterStore',
  }),

  requestSetupStore: (): WebviewMessage => ({
    type: 'requestSetupStore',
  }),
};
