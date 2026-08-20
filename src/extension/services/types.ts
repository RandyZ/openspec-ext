import type {
  ActiveChangeLifecycleStatus,
  ChangeAttention,
} from '../../shared/changeLifecycle';

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
  status: 'done' | 'ready' | 'blocked';
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
