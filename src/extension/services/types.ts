import type {
  ActiveChangeLifecycleStatus,
  ChangeAttention,
} from '../../shared/changeLifecycle';
import type {
  ChangeWorkflowSnapshot,
  WorkflowArtifactStatus,
} from '../../shared/changeWorkflow';

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
  workflowSnapshot?: ChangeWorkflowSnapshot;
  proposalWhySummary?: string;
  proposalWhyFullText?: string;
  searchText?: string;
}

export interface OpenSpecContextResult {
  readonly root: {
    readonly path: string;
    readonly source: string;
    readonly store_id?: string;
  };
  readonly references?: readonly OpenSpecReferenceEntry[];
  readonly members?: readonly OpenSpecContextMember[];
  readonly [key: string]: unknown;
}

export interface OpenSpecReferenceEntry {
  readonly store_id: string;
  readonly [key: string]: unknown;
}

export interface OpenSpecContextMember {
  readonly role?: string;
  readonly id?: string;
  readonly store_id?: string;
  readonly [key: string]: unknown;
}

export interface OpenSpecWorksetMember {
  readonly name: string;
  readonly path: string;
}

export interface OpenSpecWorkset {
  readonly name: string;
  readonly tool?: string;
  readonly members: readonly OpenSpecWorksetMember[];
}

export interface OpenSpecWorksetListResult {
  readonly worksets: readonly OpenSpecWorkset[];
}

export interface OpenSpecStore {
  readonly id: string;
  readonly root: string;
}

export interface OpenSpecStoreListResult {
  readonly stores: readonly OpenSpecStore[];
}

export interface WorksetGitMetadata {
  readonly repository?: string;
  readonly branch?: string;
}

export type WorksetNavigationMemberRole = 'project' | 'store';

export interface WorksetNavigationMember {
  readonly name: string;
  readonly path: string;
  readonly role: WorksetNavigationMemberRole;
  readonly selectable: boolean;
  readonly project?: ProjectContext;
  readonly storeId?: string;
  readonly git?: WorksetGitMetadata;
}

export interface WorksetNavigationEntry {
  readonly name: string;
  readonly tool?: string;
  readonly members: readonly WorksetNavigationMember[];
}

export interface ProjectWorksetNavigationData {
  readonly project: ProjectContext;
  readonly worksets: readonly WorksetNavigationEntry[];
}

/**
 * Fresh-validated Workset Planning Store identity. `storeId` is the id from a
 * freshly read official Store inventory; `canonicalRoot` is the canonicalized
 * registered root of that Store member. Webview-submitted ids are never trusted.
 */
export interface WorksetStoreResolution {
  readonly storeId: string;
  readonly canonicalRoot: string;
}

export interface ProjectContext {
  readonly id: string;
  readonly label: string;
  readonly projectPath: string;
}

export interface OpenSpecRootBinding {
  readonly projectId: string;
  readonly commandCwd: string;
  readonly rootPath: string;
  readonly rootSource: string;
  readonly storeId?: string;
}

export class ProjectDataAccessError extends Error {
  readonly projectId: string;
  readonly phase: string;
  readonly binding?: OpenSpecRootBinding;
  readonly cause?: unknown;

  constructor(
    message: string,
    projectId: string,
    phase: string,
    binding?: OpenSpecRootBinding,
    cause?: unknown
  ) {
    super(message);
    this.name = 'ProjectDataAccessError';
    this.projectId = projectId;
    this.phase = phase;
    this.binding = binding;
    this.cause = cause;
  }
}

export interface ProjectChangesData {
  readonly project: ProjectContext;
  readonly binding: OpenSpecRootBinding;
  readonly changes: readonly ChangeInfo[];
}

export interface ProjectCanonicalSpecsData {
  readonly project: ProjectContext;
  readonly binding: OpenSpecRootBinding;
  readonly specs: readonly SpecInfo[];
}

export interface ProjectArchivedChangesData {
  readonly project: ProjectContext;
  readonly binding: OpenSpecRootBinding;
  readonly archivedChanges: readonly ArchivedChangeInfo[];
}

export interface ReferencedStoreSpecGroup {
  readonly storeId: string;
  /** Host-resolved binding for this referenced Store; absent only when resolution failed. */
  readonly binding?: OpenSpecRootBinding;
  readonly specs: readonly SpecInfo[];
  readonly error?: string;
}

export interface ProjectReferencedStoreSpecsData {
  readonly project: ProjectContext;
  readonly binding: OpenSpecRootBinding;
  readonly groups: readonly ReferencedStoreSpecGroup[];
}

/** Binding-scoped data shared by the Project-first Sidebar tabs. */
export interface ProjectSidebarWorkspaceData {
  readonly project: ProjectContext;
  readonly binding: OpenSpecRootBinding;
  /**
   * True only when an explicit Planning Store selector drove this binding.
   * A selector-free default binding may still carry `binding.storeId` when the
   * CLI's `root.store_id` is set (the project default root IS a Store root);
   * the webview must gate selector-dependent recovery on this flag, never on
   * `binding.storeId`.
   */
  readonly explicitStoreSelector?: boolean;
  readonly changes: readonly ChangeInfo[];
  readonly archivedChanges?: readonly ArchivedChangeInfo[];
  readonly projectSpecs?: readonly SpecInfo[];
  readonly referencedStoreSpecs?: readonly ReferencedStoreSpecGroup[];
  readonly worksetNavigation?: ProjectWorksetNavigationData;
  /**
   * Host-resolved Workset capability fact (from DataManager.getCapabilities()).
   * `true`/`false` gate Workset creation affordances; `undefined` only appears
   * in legacy cached payloads and is treated as available by the webview.
   */
  readonly worksetCapabilityAvailable?: boolean;
}

export interface ArtifactStatus {
  id: string;
  outputPath: string;
  status: WorkflowArtifactStatus;
}

export interface SpecInfo {
  id: string;
  requirementCount: number;
  path?: string;
}

/** Archived change: directory name is YYYY-MM-DD-<name> under openspec/changes/archive */
export interface ArchivedChangeInfo {
  directoryName: string;
  name: string;
  archiveDate: string;
}

export interface ChangeDetails {
  name: string;
  schema: string;
  artifacts: ArtifactInfo[];
  tasks?: TaskInfo[];
  metadata?: ChangeMetadata;
}

export interface ArtifactInfo {
  id: string;
  outputPath: string;
  status: WorkflowArtifactStatus;
}

export interface TaskInfo {
  id: string;
  description: string;
  done: boolean;
}

export interface ChangeMetadata {
  created?: string;
  updated?: string;
  author?: string;
  [key: string]: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class OpenSpecCliError extends Error {
  constructor(
    message: string,
    public exitCode: number,
    public stderr: string
  ) {
    super(message);
    this.name = 'OpenSpecCliError';
  }
}
