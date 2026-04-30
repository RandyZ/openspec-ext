export interface ChangeInfo {
  name: string;
  completedTasks: number;
  totalTasks: number;
  lastModified: string;
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
