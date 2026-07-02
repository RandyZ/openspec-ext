/**
 * OpenSpec scope types and scope manager.
 *
 * A scope identifies a writable OpenSpec root. The local workspace root is always
 * a valid default. Additional store scopes are loaded from the OpenSpec CLI when
 * store support is available.
 */

import type { OpenSpecCapabilities } from './openspecFeatures';
import type { OpenSpecRuntimeSource } from './openspecCliResolver';

// ── Types ────────────────────────────────────────────────────────────────────

export type OpenSpecScopeSource = 'local' | 'store' | 'declared';

export interface OpenSpecScope {
  id: string;
  label: string;
  rootPath: string;
  source: OpenSpecScopeSource;
  storeId?: string;
  /** How the OpenSpec CLI runtime was resolved for this scope (installed/customPath/localSource). */
  runtimeSource: OpenSpecRuntimeSource;
  capabilities: OpenSpecCapabilities;
  diagnostics: {
    code: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
  }[];
}

// ── Factories ────────────────────────────────────────────────────────────────

export function createLocalScope(
  rootPath: string,
  capabilities: OpenSpecCapabilities,
  runtimeSource: OpenSpecRuntimeSource = 'installed',
): OpenSpecScope {
  return {
    id: `local:${rootPath}`,
    label: 'Local Root',
    rootPath,
    source: 'local',
    runtimeSource,
    capabilities,
    diagnostics: [],
  };
}

export function createStoreScope(
  store: { id: string; root: string },
  capabilities: OpenSpecCapabilities,
  runtimeSource: OpenSpecRuntimeSource = 'installed',
): OpenSpecScope {
  return {
    id: `store:${store.id}`,
    label: store.id,
    rootPath: store.root,
    source: 'store',
    storeId: store.id,
    runtimeSource,
    capabilities,
    diagnostics: [],
  };
}

// ── Scope Manager ────────────────────────────────────────────────────────────

export interface OpenSpecRuntimeLike {
  resolveRuntime(): Promise<{ source: OpenSpecRuntimeSource }>;
}

export class OpenSpecScopeManager {
  private selectedScopeId: string | null = null;
  private scopeOptions: OpenSpecScope[] = [];
  private listeners = new Set<() => void>();
  /** Cached runtime source so scope factories carry it without re-resolving per scope. */
  private cachedRuntimeSource: OpenSpecRuntimeSource = 'installed';

  constructor(
    private workspaceRoot: string,
    private cli: { runJson: (args: string[]) => Promise<unknown> },
    private capabilities: OpenSpecCapabilities,
    private runtime?: OpenSpecRuntimeLike,
  ) {
    // Default: local root
    this.selectedScopeId = `local:${workspaceRoot}`;
  }

  async loadScopeOptions(): Promise<OpenSpecScope[]> {
    // Resolve the runtime source once so every scope carries it (local source vs installed).
    if (this.runtime) {
      try {
        this.cachedRuntimeSource = (await this.runtime.resolveRuntime()).source;
      } catch {
        // Keep 'installed' default; runtime resolution diagnostics surface elsewhere.
      }
    }

    const scopes: OpenSpecScope[] = [
      createLocalScope(this.workspaceRoot, this.capabilities, this.cachedRuntimeSource),
    ];

    if (this.capabilities.stores) {
      try {
        const payload = (await this.cli.runJson(['store', 'list', '--json'])) as {
          stores?: { id: string; root: string }[];
          status?: unknown[];
        };
        for (const store of payload.stores ?? []) {
          scopes.push(createStoreScope(store, this.capabilities, this.cachedRuntimeSource));
        }
      } catch {
        // Store probe failure is already captured in capabilities diagnostics
      }
    }

    this.scopeOptions = scopes;
    return scopes;
  }

  getSelectedScope(): OpenSpecScope {
    const found = this.scopeOptions.find((s) => s.id === this.selectedScopeId);
    if (found) return found;
    // Fallback to local root
    return createLocalScope(this.workspaceRoot, this.capabilities, this.cachedRuntimeSource);
  }

  getScopeOptions(): OpenSpecScope[] {
    return this.scopeOptions;
  }

  selectScope(id: string): void {
    if (this.selectedScopeId === id) return;
    this.selectedScopeId = id;
    for (const listener of this.listeners) {
      listener();
    }
  }

  onDidChangeScope(listener: () => void): { dispose(): void } {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  }
}

// ── Relationship loading ─────────────────────────────────────────────────────

export interface RelationshipHealthView {
  root: { path: string; healthy: boolean; status: unknown[] };
  references: ReferenceIndexEntryView[];
  status: unknown[];
}

export interface ReferenceIndexEntryView {
  store_id: string;
  specs?: { id: string; summary?: string }[];
  fetch?: string;
  status: { severity: string; code: string; message: string; fix?: string }[];
}

function withScopeArgs(base: string[], scope: OpenSpecScope): string[] {
  return scope.storeId ? [...base, '--store', scope.storeId] : base;
}

export async function loadScopeRelationships(
  cli: { runJson: (args: string[]) => Promise<unknown> },
  scope: OpenSpecScope,
): Promise<{
  context: unknown;
  health: RelationshipHealthView;
  references: ReferenceIndexEntryView[];
  status: unknown[];
}> {
  const [context, health] = await Promise.all([
    cli.runJson(withScopeArgs(['context', '--json'], scope)),
    cli.runJson(withScopeArgs(['doctor', '--json'], scope)) as Promise<RelationshipHealthView>,
  ]);

  return {
    context,
    health,
    references: health.references ?? [],
    status: [
      ...((context as { status?: unknown[] }).status ?? []),
      ...(health.status ?? []),
    ],
  };
}
