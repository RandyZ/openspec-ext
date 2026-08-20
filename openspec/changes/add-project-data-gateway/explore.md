<!-- Exploration output for add-project-data-gateway — input for proposal, not the contract. -->

## Clarified requirements and constraints

### Problem to solve

The extension currently uses `OpenSpecScope` and a global `selectedScope` for two different concerns:

- which code project the user is viewing;
- which OpenSpec root the CLI and file readers use.

Those concerns are not equivalent. A project can resolve its planning data to its own local root, a Store-backed root, or another CLI-selected root. The current implementation can construct the CLI service from one scope while independently constructing `FileManagerService` from `scope.rootPath/openspec`. That leaves a correctness risk: CLI state and artifact content can come from different roots.

The next-generation UX is Project-first. Project is the stable UI context; OpenSpec root is a data binding resolved for that project. Store and Workset are related resources and navigation aids, not peer dashboard modes.

### Required outcomes

- Introduce an explicit Project-oriented read path without rewriting `DataManager` or the existing webview/panel host.
- Resolve OpenSpec location through official CLI JSON from the project working directory.
- Bind CLI calls and `ContentAccess` to the same resolved root for the lifetime of one request/session.
- Return small, purpose-specific DTOs instead of extending the all-in-one `DashboardData` contract.
- Keep opened consumers capable of holding an immutable Project/root identity; later sidebar selection must not silently retarget them.
- Preserve existing CLI resolution, Store/Workset capability probes, cache service, file access, watcher, and Workset removal correctness where their semantics remain valid.
- Keep the new path additive until parity is proven, then migrate consumers incrementally.

### Source-of-truth boundaries

- VS Code workspace folders identify candidate code projects.
- OpenSpec CLI owns root resolution, Store registry, Workset registry, Changes, canonical Specs, status, instructions, and reference health.
- `ContentAccess` reads or writes artifact bodies only after being constructed from the CLI-resolved binding.
- Plugin cache is disposable acceleration, never a fact source.
- Plugin-maintained global data is out of scope unless OpenSpec has no official query; no Store or Workset registry will be duplicated.

### Scope of this Change

This Change covers the first migration slice only:

- `ProjectContext` identity for the current workspace project;
- `OpenSpecRootBinding` produced from CLI resolution;
- a read-only `ProjectDataGateway` that loads current-project Changes and Specs through explicit binding;
- focused correctness and compatibility tests;
- a narrow bridge that permits later UI migration without changing the current Dashboard UX in this Change.

This Change does not redesign the Sidebar, add Workset project navigation, introduce Git worktree identity, replace panel management, change workflow delivery/adapters, or eagerly watch every project. It also does not archive or merge the frozen `polish-workset-store-root-management-ui` Change. Its reusable Workset-remove and capability-probe behavior remains available, while its root-selector/Store-card information architecture is not adopted as the new model.

## Considered approaches

### 1. Rewrite `DataManager` and Dashboard around Project-first data immediately

This gives a direct end state but combines root correctness, data contracts, cache migration, panels, and a large UI rewrite. The blast radius includes extension activation, message handling, Dashboard, Change Detail, tests, and file watching. A failure would be hard to isolate, and rollback would discard unrelated working behavior.

**Decision:** Rejected for the first milestone.

### 2. Rename `OpenSpecScope` to Project and keep `selectedScope`

This is the smallest code diff, but it preserves the underlying semantic error. Store remains a peer selectable context, consumers still depend on mutable global selection, and CLI/file roots can still drift. It would make the old model harder to remove because the new names would hide rather than fix it.

**Decision:** Rejected.

### 3. Add a Project data gateway beside the existing path

The gateway accepts an explicit Project context, asks the CLI to resolve its OpenSpec root, creates all readers from one immutable binding, and returns page-specific data. Existing `DataManager` remains operational while consumers move one at a time. This adds temporary duplication, but the duplication is bounded and testable.

**Decision:** Selected. It provides the correctness boundary needed by later UX Changes with the smallest reversible implementation.

## Agreed design direction

```text
VS Code workspace folder
        |
        v
ProjectContext
  id, label, projectPath
        |
        v
ProjectDataGateway
  run CLI from projectPath
  resolve root/context
        |
        v
OpenSpecRootBinding
  commandCwd
  resolvedRootPath/source
  explicit Store selector only when user-selected
        |
        +-----------------------+
        |                       |
        v                       v
OpenSpecCliService        ContentAccess
same binding/selector     resolvedRootPath/openspec
        |                       |
        +-----------+-----------+
                    v
          purpose-specific data
          Project overview / Changes / Specs
```

`ProjectContext` represents what the user is looking at. `OpenSpecRootBinding` represents where planning data is located. Neither replaces the other.

The gateway will not consult or mutate global `selectedScope`. Each read receives an explicit context or binding. A lightweight bound-reader object may be used internally, but no new registry or lifecycle framework is required in this Change.

Root resolution must stay selector-free for an ordinary project. A Store selector is attached only after explicit Store selection. CLI-returned root path and source remain authoritative, including future source values. The same binding constructs both CLI and file-backed access.

Canonical Specs and Change delta Specs remain separate concepts. Project-level canonical Specs should come from the official canonical-spec surface; delta Specs remain attached to their Change and must not be merged into the project Specs list merely because files exist under active Changes. Referenced Store Specs will be a separate source/group in the later Project-first UI.

The migration follows a strangler pattern:

1. Add and test the explicit Project/binding gateway.
2. Compare its Current Project results with the existing dashboard path where semantics overlap.
3. Move the redesigned Sidebar and Explorer pages to the gateway in a later Change.
4. Remove `selectedScope`, the root selector, and obsolete aggregate DTO fields only after no consumer depends on them.

## Key decisions

- **Project is UI context; root is data location.** They must never be represented by one mutable selection value.
- **CLI owns root resolution.** The plugin does not infer a root from repository layout or copy OpenSpec Store/Workset state.
- **CLI and file access share one binding.** No request may combine CLI data from one root with artifacts from another.
- **Bindings are explicit and immutable for consumers.** An opened panel must not change target when sidebar context changes.
- **The first gateway is read-only and Current-Project focused.** Mutation migration, Workset navigation, Git identity, watcher registries, and workflow delivery remain separate milestones.
- **Existing services are reused.** `OpenSpecCliService`, `StateReader`, `ContentAccess`, `OpenSpecCacheService`, and providers are adapted or composed; they are not replaced wholesale.
- **DTOs follow the consuming page.** The new path does not create another universal `DashboardData` object.
- **Spec semantics stay explicit.** Canonical, delta, and referenced Store Specs are different sources and must remain distinguishable.
- **The old polish Change is reference material, not the new product contract.** Keep non-destructive Workset removal, JSON CLI usage, cache refresh, and capability-driven behavior; supersede root-centric UI in later UX specs.

Deferred questions belong to later Changes: Git repository/worktree identity, reverse Workset membership, Project registry for Store consumers, on-demand watcher lifetime, Explorer panel routing, and workflow delivery selection.
