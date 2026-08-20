import { promises as fs } from 'fs';
import * as path from 'path';
import { OpenSpecCliService, type ScopeOption } from './openspecCli';
import { FileManagerService } from './fileManager';
import { extractProposalWhy } from './proposalWhy';
import {
  ProjectDataAccessError,
  type OpenSpecContextResult,
  type OpenSpecRootBinding,
  type ProjectArchivedChangesData,
  type ProjectCanonicalSpecsData,
  type ProjectChangesData,
  type ProjectContext,
  type ProjectReferencedStoreSpecsData,
  type ReferencedStoreSpecGroup,
} from './types';

type ProjectCli = Pick<OpenSpecCliService, 'getContext'> &
  Partial<Pick<OpenSpecCliService, 'listChanges' | 'listSpecs'>>;

type BoundReaders = {
  readonly binding: OpenSpecRootBinding;
  readonly context: OpenSpecContextResult;
  readonly cli: ProjectCli;
  readonly contentAccess: BoundContentAccess;
  readonly scope?: ScopeOption;
};

type BoundContentAccess = Pick<FileManagerService, 'listArchivedChanges'>
  & Partial<Pick<FileManagerService, 'readArtifact'>>;

function safeReferencedStoreSpecsError(storeId: string): string {
  const safeStoreId = storeId
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[^a-zA-Z0-9._:@-]/g, '_')
    .slice(0, 80);
  return `Unable to load Specs for referenced Store "${safeStoreId}".`;
}

export interface ProjectDataGatewayOptions {
  createCli?: (cwd: string) => ProjectCli;
  /** Root resolution never invokes this factory. */
  createContentAccess?: (openspecPath: string) => BoundContentAccess;
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
      const changes = await readers.cli.listChanges(readers.scope);
      return {
        project,
        binding,
        changes: await this.enrichChangesWithProposalWhy(changes, readers.contentAccess),
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
  ): Promise<{ binding: OpenSpecRootBinding; context: OpenSpecContextResult }> {
    if (explicitStoreId !== undefined && typeof explicitStoreId !== 'string') {
      throw this.resolveError(project, 'Explicit Store selector must be a string');
    }
    const storeId = explicitStoreId?.trim() ? explicitStoreId : undefined;
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

    return { binding, context };
  }

  private async bind(project: ProjectContext, explicitStoreId?: string): Promise<BoundReaders> {
    const resolved = await this.resolveBindingContext(project, explicitStoreId);
    const { binding } = resolved;
    const scope = binding.storeId ? { storeId: binding.storeId } : undefined;
    const cli = this.createCli(binding.commandCwd);
    const contentAccess = this.createContentAccess(path.join(binding.rootPath, 'openspec'));
    return { binding, context: resolved.context, cli, contentAccess, scope };
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

  private resolveError(
    project: ProjectContext,
    message: string,
    binding?: OpenSpecRootBinding
  ): ProjectDataAccessError {
    return new ProjectDataAccessError(message, project.id, 'resolve', binding);
  }
}
