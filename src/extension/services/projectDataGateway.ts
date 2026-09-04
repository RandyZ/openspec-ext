import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { OpenSpecCliService, type ScopeOption } from './openspecCli';
import { FileManagerService } from './fileManager';
import { extractProposalWhy } from './proposalWhy';
import {
  bindWorkflowSnapshot,
} from '../../shared/changeWorkflow';
import {
  ProjectDataAccessError,
  type OpenSpecContextResult,
  type OpenSpecRootBinding,
  type ProjectArchivedChangesData,
  type ProjectCanonicalSpecsData,
  type ProjectChangesData,
  type ProjectContext,
  type ProjectWorksetNavigationData,
  type ProjectReferencedStoreSpecsData,
  type ProjectSidebarWorkspaceData,
  type ReferencedStoreSpecGroup,
  type WorksetGitMetadata,
  type WorksetNavigationEntry,
  type WorksetNavigationMember,
  type WorksetStoreResolution,
} from './types';

type ProjectCli = Pick<OpenSpecCliService, 'getContext'> &
  Partial<Pick<OpenSpecCliService, 'listChanges' | 'listSpecs' | 'listStores' | 'listWorksets'>>;

type BoundReaders = {
  readonly binding: OpenSpecRootBinding;
  readonly context: OpenSpecContextResult;
  readonly cli: ProjectCli;
  readonly contentAccess: BoundContentAccess;
  readonly scope?: ScopeOption;
  /** True only when an explicit Store selector was actually passed for this binding. */
  readonly explicitStoreSelector: boolean;
};

type BoundContentAccess = Pick<FileManagerService, 'listArchivedChanges'>
  & Partial<Pick<FileManagerService, 'readArtifact'>>;

function safeToken(value: string): string {
  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[^a-zA-Z0-9._:@-]/g, '_')
    .slice(0, 80);
}

function safeReferencedStoreSpecsError(storeId: string): string {
  return `Unable to load Specs for referenced Store "${safeToken(storeId)}".`;
}

export interface ProjectDataGatewayOptions {
  createCli?: (cwd: string) => ProjectCli;
  /** Root resolution never invokes this factory. */
  createContentAccess?: (openspecPath: string) => BoundContentAccess;
  /** Injected in tests; Git metadata is display-only and best-effort. */
  readGitMetadata?: (projectPath: string) => Promise<WorksetGitMetadata>;
}

const execFileAsync = promisify(execFile);

async function readGitMetadataFromGit(projectPath: string): Promise<WorksetGitMetadata> {
  const options = { cwd: projectPath, timeout: 1500, maxBuffer: 64 * 1024 };
  const [repositoryResult, branchResult] = await Promise.allSettled([
    execFileAsync('git', ['rev-parse', '--git-common-dir'], options),
    execFileAsync('git', ['branch', '--show-current'], options),
  ]);

  const metadata: { repository?: string; branch?: string } = {};
  if (repositoryResult.status === 'fulfilled') {
    const commonDir = String(repositoryResult.value.stdout).trim();
    const resolvedCommonDir = path.isAbsolute(commonDir)
      ? commonDir
      : path.resolve(projectPath, commonDir);
    try {
      const repository = await fs.realpath(resolvedCommonDir);
      if (path.isAbsolute(repository)) metadata.repository = repository;
    } catch {
      // Git identity is display-only; an unavailable common directory must not hide a Project.
    }
  }
  if (branchResult.status === 'fulfilled') {
    const branch = String(branchResult.value.stdout).trim();
    if (branch) metadata.branch = branch;
  }
  return metadata;
}

export async function createProjectContext(label: string, projectPath: string): Promise<ProjectContext> {
  const canonicalProjectPath = await fs.realpath(path.resolve(projectPath));
  return {
    id: canonicalProjectPath,
    label,
    projectPath: canonicalProjectPath,
  };
}

export class ProjectDataGateway {
  private readonly createCli: (cwd: string) => ProjectCli;
  private readonly createContentAccess: (openspecPath: string) => BoundContentAccess;

  constructor(options: ProjectDataGatewayOptions = {}) {
    this.createCli = options.createCli ?? ((cwd) => new OpenSpecCliService(cwd));
    this.createContentAccess = options.createContentAccess ?? ((openspecPath) => new FileManagerService(openspecPath));
    this.readGitMetadata = options.readGitMetadata ?? readGitMetadataFromGit;
  }

  private readonly readGitMetadata: (projectPath: string) => Promise<WorksetGitMetadata>;

  async loadWorksetNavigation(project: ProjectContext): Promise<ProjectWorksetNavigationData> {
    return this.loadWorksetNavigationFromCli(project, this.createCli(project.projectPath));
  }

  private async loadWorksetNavigationFromCli(
    project: ProjectContext,
    cli: ProjectCli,
  ): Promise<ProjectWorksetNavigationData> {
    const currentPath = await this.canonicalizeMemberPath(project.projectPath);
    if (!currentPath) return { project, worksets: [] };
    // The navigation's Project identity must be canonical: the webview locks
    // the current Project member in the creation form by this path, and the
    // folder picker returns canonical paths — a non-canonical alias here would
    // show two rows for one folder and break current-member detection.
    const canonicalProject: ProjectContext = project.projectPath === currentPath && project.id === currentPath
      ? project
      : { ...project, id: currentPath, projectPath: currentPath };
    const empty: ProjectWorksetNavigationData = { project: canonicalProject, worksets: [] };
    if (!cli.listWorksets) return empty;

    let worksetPayload: unknown;
    try {
      worksetPayload = await cli.listWorksets();
    } catch {
      return empty;
    }

    const rawWorksets = this.asArray(worksetPayload, 'worksets');
    const storeRoots = await this.loadCanonicalStoreRoots(cli);
    // Store membership is a trust boundary: without a successful official
    // Store inventory, a Store member could be misclassified as a selectable
    // Project. Hide topology navigation rather than guessing.
    if (!storeRoots) return empty;
    const worksets: WorksetNavigationEntry[] = [];

    for (const rawWorkset of rawWorksets) {
      if (!rawWorkset || typeof rawWorkset !== 'object') continue;
      const worksetRecord = rawWorkset as Record<string, unknown>;
      const name = typeof worksetRecord.name === 'string' && worksetRecord.name.trim()
        ? worksetRecord.name
        : undefined;
      const rawMembers = Array.isArray(worksetRecord.members) ? worksetRecord.members : [];
      if (!name) continue;

      const members = (
        await Promise.all(rawMembers.map((rawMember) => this.resolveWorksetMember(rawMember, storeRoots)))
      ).filter((member): member is WorksetNavigationMember => member !== undefined);
      if (!members.some((member) => member.path === currentPath)) continue;

      const tool = typeof worksetRecord.tool === 'string' && worksetRecord.tool.trim()
        ? worksetRecord.tool
        : undefined;
      worksets.push({
        name,
        ...(tool ? { tool } : {}),
        members,
      });
    }

    return { project: canonicalProject, worksets };
  }

  /**
   * Re-read official Workset membership before accepting a Webview selection.
   * The submitted path is only a hint and is canonicalized before comparison.
   */
  async resolveWorksetProject(
    project: ProjectContext,
    worksetName: string,
    memberPath: string
  ): Promise<ProjectContext | undefined> {
    if (!worksetName.trim()) return undefined;
    const canonicalMemberPath = await this.canonicalizeMemberPath(memberPath);
    if (!canonicalMemberPath) return undefined;
    const navigation = await this.loadWorksetNavigation(project);
    const workset = navigation.worksets.find((candidate) => candidate.name === worksetName);
    const member = workset?.members.find((candidate) => candidate.path === canonicalMemberPath);
    return member?.role === 'project' && member.selectable ? member.project : undefined;
  }

  /**
   * Re-read official Workset and Store inventories before accepting a Planning
   * root selection. The Webview-submitted Workset name and member path are
   * hints only: the member must still be a registered Store member of the named
   * Workset in fresh inventories, canonicalized before comparison. Store ids
   * supplied by the Webview are never trusted and no path is guessed; every
   * rejection fails closed with a resolve-phase ProjectDataAccessError.
   */
  async resolveWorksetStore(
    project: ProjectContext,
    worksetName: string,
    memberPath: string
  ): Promise<WorksetStoreResolution> {
    if (typeof worksetName !== 'string' || !worksetName.trim()) {
      throw this.resolveError(project, 'Workset name is required to select a Planning Store member');
    }
    if (typeof memberPath !== 'string') {
      throw this.resolveError(project, 'Workset Store member path must be a string');
    }
    const canonicalMemberPath = await this.canonicalizeMemberPath(memberPath);
    if (!canonicalMemberPath) {
      throw this.resolveError(project, 'Workset Store member path cannot be canonicalized');
    }

    const cli = this.createCli(project.projectPath);
    const storeRoots = await this.loadCanonicalStoreRoots(cli);
    if (!storeRoots) {
      throw this.resolveError(project, 'Planning Store inventory is unavailable');
    }
    const storeId = storeRoots.get(canonicalMemberPath);
    if (!storeId) {
      throw this.resolveError(
        project,
        `Workset member is not a registered Planning Store: ${safeToken(memberPath)}`
      );
    }

    if (!cli.listWorksets) {
      throw this.resolveError(project, 'Workset inventory is unavailable');
    }
    let worksetPayload: unknown;
    try {
      worksetPayload = await cli.listWorksets();
    } catch (cause) {
      throw new ProjectDataAccessError(
        'Workset inventory is unavailable',
        project.id,
        'resolve',
        undefined,
        cause
      );
    }
    const rawWorksets = this.asArray(worksetPayload, 'worksets');
    let memberConfirmed = false;
    for (const rawWorkset of rawWorksets) {
      if (!rawWorkset || typeof rawWorkset !== 'object') continue;
      const worksetRecord = rawWorkset as Record<string, unknown>;
      if (worksetRecord.name !== worksetName) continue;
      const rawMembers = Array.isArray(worksetRecord.members) ? worksetRecord.members : [];
      for (const rawMember of rawMembers) {
        if (!rawMember || typeof rawMember !== 'object') continue;
        const memberRecord = rawMember as Record<string, unknown>;
        const rawMemberPath = typeof memberRecord.path === 'string' ? memberRecord.path.trim() : '';
        if (!rawMemberPath) continue;
        const canonicalPath = await this.canonicalizeMemberPath(rawMemberPath);
        if (canonicalPath === canonicalMemberPath) {
          memberConfirmed = true;
          break;
        }
      }
      break;
    }
    if (!memberConfirmed) {
      throw this.resolveError(
        project,
        `Workset ${safeToken(worksetName)} does not include the submitted Planning Store member`
      );
    }

    return { storeId, canonicalRoot: canonicalMemberPath };
  }

  private async loadCanonicalStoreRoots(cli: ProjectCli): Promise<Map<string, string> | undefined> {
    if (!cli.listStores) return undefined;
    let storePayload: unknown;
    try {
      storePayload = await cli.listStores();
    } catch {
      return undefined;
    }

    if (!storePayload || typeof storePayload !== 'object'
      || !Array.isArray((storePayload as Record<string, unknown>).stores)) {
      return undefined;
    }

    const stores = this.asArray(storePayload, 'stores');
    const roots = new Map<string, string>();
    for (const rawStore of stores) {
      if (!rawStore || typeof rawStore !== 'object') return undefined;
      const record = rawStore as Record<string, unknown>;
      const id = typeof record.id === 'string' && record.id.trim() ? record.id : undefined;
      const root = typeof record.root === 'string' ? record.root : undefined;
      if (!id || !root) return undefined;
      const canonicalRoot = await this.canonicalizeMemberPath(root);
      if (!canonicalRoot) return undefined;
      roots.set(canonicalRoot, id);
    }
    return roots;
  }

  private async resolveWorksetMember(
    rawMember: unknown,
    storeRoots: ReadonlyMap<string, string>
  ): Promise<WorksetNavigationMember | undefined> {
    if (!rawMember || typeof rawMember !== 'object') return undefined;
    const record = rawMember as Record<string, unknown>;
    const rawPath = typeof record.path === 'string' ? record.path.trim() : '';
    if (!rawPath) return undefined;
    const canonicalPath = await this.canonicalizeMemberPath(rawPath);
    if (!canonicalPath) return undefined;
    const name = typeof record.name === 'string' && record.name.trim()
      ? record.name
      : path.basename(canonicalPath);
    const storeId = storeRoots.get(canonicalPath);
    if (storeId) {
      return {
        name,
        path: canonicalPath,
        role: 'store',
        selectable: false,
        storeId,
      };
    }

    let git: WorksetGitMetadata | undefined;
    try {
      const candidate = await this.readGitMetadata(canonicalPath);
      const repository = typeof candidate?.repository === 'string' && candidate.repository.trim()
        ? candidate.repository
        : undefined;
      const branch = typeof candidate?.branch === 'string' && candidate.branch.trim()
        ? candidate.branch
        : undefined;
      if (repository || branch) git = { ...(repository ? { repository } : {}), ...(branch ? { branch } : {}) };
    } catch {
      // Git metadata is display-only; an unavailable Git command must not hide a Project.
    }

    const memberProject: ProjectContext = {
      id: canonicalPath,
      label: name,
      projectPath: canonicalPath,
    };
    return {
      name,
      path: canonicalPath,
      role: 'project',
      selectable: true,
      project: memberProject,
      ...(git ? { git } : {}),
    };
  }

  private async canonicalizeMemberPath(rawPath: string): Promise<string | undefined> {
    if (!path.isAbsolute(rawPath)) return undefined;
    try {
      return await fs.realpath(rawPath);
    } catch {
      return undefined;
    }
  }

  private asArray(payload: unknown, key: string): unknown[] {
    if (!payload || typeof payload !== 'object') return [];
    const value = (payload as Record<string, unknown>)[key];
    return Array.isArray(value) ? value : [];
  }

  async resolveBinding(project: ProjectContext, explicitStoreId?: string): Promise<OpenSpecRootBinding> {
    const { binding } = await this.resolveBindingContext(project, explicitStoreId);
    return binding;
  }

  async loadChanges(project: ProjectContext, explicitStoreId?: string): Promise<ProjectChangesData> {
    let binding: OpenSpecRootBinding | undefined;
    try {
      const readers = await this.bind(project, explicitStoreId);
      binding = readers.binding;
      if (!readers.cli.listChanges) {
        throw new Error('Bound CLI does not support listChanges');
      }
      const changes = await readers.cli.listChanges(readers.scope, binding);
      return {
        project,
        binding,
        changes: await this.enrichChangesWithProposalWhy(
          this.bindWorkflowSnapshots(changes, binding),
          readers.contentAccess
        ),
      };
    } catch (cause) {
      throw new ProjectDataAccessError(
        `Failed to load changes for project ${project.id}`,
        project.id,
        'changes',
        binding ?? (cause instanceof ProjectDataAccessError ? cause.binding : undefined),
        cause
      );
    }
  }

  async loadCanonicalSpecs(project: ProjectContext, explicitStoreId?: string): Promise<ProjectCanonicalSpecsData> {
    let binding: OpenSpecRootBinding | undefined;
    try {
      const readers = await this.bind(project, explicitStoreId);
      binding = readers.binding;
      if (!readers.cli.listSpecs) {
        throw new Error('Bound CLI does not support listSpecs');
      }
      const specs = await readers.cli.listSpecs(readers.scope);
      return { project, binding, specs };
    } catch (cause) {
      throw new ProjectDataAccessError(
        `Failed to load canonical specs for project ${project.id}`,
        project.id,
        'specs',
        binding ?? (cause instanceof ProjectDataAccessError ? cause.binding : undefined),
        cause
      );
    }
  }

  async loadArchivedChanges(
    project: ProjectContext,
    explicitStoreId?: string
  ): Promise<ProjectArchivedChangesData> {
    let binding: OpenSpecRootBinding | undefined;
    try {
      const readers = await this.bind(project, explicitStoreId);
      binding = readers.binding;
      const archivedChanges = await readers.contentAccess.listArchivedChanges();
      return { project, binding, archivedChanges };
    } catch (cause) {
      throw new ProjectDataAccessError(
        `Failed to load archived changes for project ${project.id}`,
        project.id,
        'archived-changes',
        binding ?? (cause instanceof ProjectDataAccessError ? cause.binding : undefined),
        cause
      );
    }
  }

  async loadReferencedStoreSpecs(project: ProjectContext): Promise<ProjectReferencedStoreSpecsData> {
    let binding: OpenSpecRootBinding | undefined;
    try {
      const readers = await this.bind(project);
      binding = readers.binding;
      const groups = await this.loadReferencedStoreSpecsFromReaders(project, readers);
      return { project, binding, groups };
    } catch (cause) {
      throw new ProjectDataAccessError(
        `Failed to load referenced Store Specs for project ${project.id}`,
        project.id,
        'referenced-store-specs',
        binding ?? (cause instanceof ProjectDataAccessError ? cause.binding : undefined),
        cause
      );
    }
  }

  async loadProjectSidebarData(
    project: ProjectContext,
    explicitStoreId?: string
  ): Promise<ProjectSidebarWorkspaceData> {
    let binding: OpenSpecRootBinding | undefined;
    try {
      const readers = await this.bind(project, explicitStoreId);
      binding = readers.binding;
      if (!readers.cli.listChanges || !readers.cli.listSpecs) {
        throw new Error('Bound CLI does not support Project Sidebar data');
      }

      const [rawChanges, archivedChanges, projectSpecs, referencedStoreSpecs, worksetNavigation] = await Promise.all([
        readers.cli.listChanges(readers.scope, binding),
        readers.contentAccess.listArchivedChanges(),
        readers.cli.listSpecs(readers.scope),
        this.loadReferencedStoreSpecsFromReaders(project, readers),
        this.loadWorksetNavigationFromCli(project, readers.cli).catch(() => undefined),
      ]);

      return {
        project,
        binding,
        explicitStoreSelector: readers.explicitStoreSelector,
        changes: await this.enrichChangesWithProposalWhy(
          this.bindWorkflowSnapshots(rawChanges, binding),
          readers.contentAccess
        ),
        archivedChanges,
        projectSpecs,
        referencedStoreSpecs,
        ...(worksetNavigation ? { worksetNavigation } : {}),
      };
    } catch (cause) {
      throw new ProjectDataAccessError(
        `Failed to load Project Sidebar data for project ${project.id}`,
        project.id,
        'sidebar',
        binding ?? (cause instanceof ProjectDataAccessError ? cause.binding : undefined),
        cause
      );
    }
  }

  private async loadReferencedStoreSpecsFromReaders(
    project: ProjectContext,
    readers: BoundReaders,
  ): Promise<readonly ReferencedStoreSpecGroup[]> {
      const references = readers.context.references ?? this.referencesFromMembers(readers.context.members);
      if (references !== undefined && !Array.isArray(references)) {
        throw new Error('CLI context references must be an array');
      }

      const groups: ReferencedStoreSpecGroup[] = [];
      const seenStoreIds = new Set<string>();
      for (const [index, reference] of (references ?? []).entries()) {
        if (
          !reference
          || typeof reference !== 'object'
          || typeof reference.store_id !== 'string'
          || reference.store_id.trim().length === 0
        ) {
          throw new Error(`CLI context reference at index ${index} is malformed`);
        }
        const storeId = reference.store_id;
        if (seenStoreIds.has(storeId)) continue;
        seenStoreIds.add(storeId);
        let storeBinding: OpenSpecRootBinding | undefined;
        try {
          const resolvedStore = await this.resolveBindingContext(project, storeId);
          storeBinding = resolvedStore.binding;
          const storeCli = this.createCli(storeBinding.commandCwd);
          if (!storeCli.listSpecs) {
            throw new Error('Bound CLI does not support listSpecs');
          }
          const specs = await storeCli.listSpecs({ storeId });
          groups.push({ storeId, binding: storeBinding, specs });
        } catch {
          groups.push({
            storeId,
            ...(storeBinding ? { binding: storeBinding } : {}),
            specs: [],
            error: safeReferencedStoreSpecsError(storeId),
          });
        }
      }

    return groups;
  }

  private referencesFromMembers(
    members: OpenSpecContextResult['members']
  ): Array<{ store_id: string }> | undefined {
    if (members === undefined) return undefined;
    if (!Array.isArray(members)) throw new Error('CLI context members must be an array');
    return members
      .filter((member) => member?.role === 'referenced_store')
      .map((member, index) => {
        const storeId = typeof member.id === 'string' && member.id.trim().length > 0
          ? member.id
          : member.store_id;
        if (typeof storeId !== 'string' || storeId.trim().length === 0) {
          throw new Error(`CLI context referenced Store member at index ${index} is malformed`);
        }
        return { store_id: storeId };
      });
  }

  private async resolveBindingContext(
    project: ProjectContext,
    explicitStoreId?: string
  ): Promise<{
    binding: OpenSpecRootBinding;
    context: OpenSpecContextResult;
    explicitStoreSelector: boolean;
  }> {
    if (explicitStoreId !== undefined && typeof explicitStoreId !== 'string') {
      throw this.resolveError(project, 'Explicit Store selector must be a string');
    }
    const storeId = explicitStoreId?.trim() ? explicitStoreId : undefined;
    // Authoritative "explicit selector active" fact: a binding may carry a
    // storeId inherited from the CLI's root.store_id (the project default root
    // IS a Store root) without any explicit selector having been passed.
    const explicitStoreSelector = storeId !== undefined;
    const scope: ScopeOption | undefined = storeId ? { storeId } : undefined;
    let context: OpenSpecContextResult;

    try {
      context = await this.createCli(project.projectPath).getContext(scope);
    } catch (cause) {
      throw new ProjectDataAccessError(
        `Failed to resolve OpenSpec root for project ${project.id}`,
        project.id,
        'resolve',
        undefined,
        cause
      );
    }

    const root = context?.root;
    if (!root || typeof root.path !== 'string' || root.path.length === 0) {
      throw this.resolveError(project, 'CLI context is missing root.path');
    }
    if (typeof root.source !== 'string' || root.source.trim().length === 0) {
      throw this.resolveError(project, 'CLI context is missing root.source');
    }
    if (root.store_id !== undefined
      && (typeof root.store_id !== 'string' || root.store_id.trim().length === 0)) {
      throw this.resolveError(project, 'CLI context root.store_id is malformed');
    }
    if (storeId && root.store_id !== undefined && storeId !== root.store_id) {
      throw this.resolveError(
        project,
        `CLI context root.store_id conflicts with explicit Store selector: ${root.store_id}`
      );
    }
    if (!path.isAbsolute(root.path)) {
      throw this.resolveError(project, `CLI root is not absolute: ${root.path}`);
    }

    let rootPath: string;
    try {
      rootPath = await fs.realpath(root.path);
    } catch (cause) {
      throw new ProjectDataAccessError(
        `Cannot canonicalize OpenSpec root for project ${project.id}`,
        project.id,
        'resolve',
        undefined,
        cause
      );
    }

    const binding: OpenSpecRootBinding = {
      projectId: project.id,
      commandCwd: project.projectPath,
      rootPath,
      rootSource: root.source,
      ...((storeId ?? root.store_id) ? { storeId: storeId ?? root.store_id } : {}),
    };

    let contentPath: string;
    try {
      contentPath = await fs.realpath(path.join(rootPath, 'openspec'));
    } catch (cause) {
      throw new ProjectDataAccessError(
        `Cannot canonicalize OpenSpec content for project ${project.id}`,
        project.id,
        'resolve',
        binding,
        cause
      );
    }

    const relativeContentPath = path.relative(rootPath, contentPath);
    if (
      path.isAbsolute(relativeContentPath)
      || relativeContentPath === '..'
      || relativeContentPath.startsWith(`..${path.sep}`)
    ) {
      throw this.resolveError(project, 'OpenSpec content path escapes the resolved root', binding);
    }

    return { binding, context, explicitStoreSelector };
  }

  private async bind(project: ProjectContext, explicitStoreId?: string): Promise<BoundReaders> {
    const resolved = await this.resolveBindingContext(project, explicitStoreId);
    const { binding } = resolved;
    const scope = binding.storeId ? { storeId: binding.storeId } : undefined;
    const cli = this.createCli(binding.commandCwd);
    const contentAccess = this.createContentAccess(path.join(binding.rootPath, 'openspec'));
    return {
      binding,
      context: resolved.context,
      cli,
      contentAccess,
      scope,
      explicitStoreSelector: resolved.explicitStoreSelector,
    };
  }

  private async enrichChangesWithProposalWhy(
    changes: readonly ProjectChangesData['changes'][number][],
    contentAccess: BoundContentAccess,
  ): Promise<readonly ProjectChangesData['changes'][number][]> {
    return await Promise.all(changes.map(async (change) => {
      const artifactSearchText = (change.artifacts ?? [])
        .map((artifact) => `${artifact.id} ${artifact.status}`)
        .join(' ');
      const createdSearchText = change.createdAt ? `created ${change.createdAt.split('T')[0]}` : '';
      const baseSearchText = [
        change.name,
        change.status,
        artifactSearchText,
        createdSearchText,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!contentAccess.readArtifact) {
        return { ...change, searchText: baseSearchText };
      }

      try {
        const proposal = await contentAccess.readArtifact(change.name, 'proposal');
        const why = extractProposalWhy(proposal);
        return {
          ...change,
          proposalWhySummary: why.summary,
          proposalWhyFullText: why.fullText,
          searchText: [baseSearchText, why.summary, why.fullText]
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
        };
      } catch {
        return { ...change, searchText: baseSearchText };
      }
    }));
  }

  private bindWorkflowSnapshots(
    changes: readonly ProjectChangesData['changes'][number][],
    binding: OpenSpecRootBinding
  ): readonly ProjectChangesData['changes'][number][] {
    return changes.map((change) => {
      if (change.workflowSnapshot === undefined) return change;
      const workflowSnapshot = bindWorkflowSnapshot(
        change.workflowSnapshot,
        binding,
        change.name
      );
      if (workflowSnapshot) return { ...change, workflowSnapshot };

      const { workflowSnapshot: _ignored, ...withoutSnapshot } = change;
      const reasons = new Set(change.attention?.reasons ?? []);
      reasons.add('invalid-artifact-status');
      return {
        ...withoutSnapshot,
        attention: { required: true, reasons: [...reasons] },
      };
    });
  }

  private resolveError(
    project: ProjectContext,
    message: string,
    binding?: OpenSpecRootBinding
  ): ProjectDataAccessError {
    return new ProjectDataAccessError(message, project.id, 'resolve', binding);
  }
}
