# Task 3. Scoped Data And Content Access

<!-- covers: Task 3.1, Task 3.2, Task 3.3, Task 3.4 -->

### Task 3.1: Make CLI state reads use the selected scope

**Spec coverage:** cli-integration / Requirement: Scope-aware CLI command execution; dashboard / Requirement: Store selection / Scenario: Selecting a store refreshes scoped data

**Files:**
- Modify: `src/extension/services/openspecCli.ts`
- Modify: `src/extension/services/stateReader.ts`
- Modify: `src/extension/services/dataManager.ts`
- Modify: `test/extension/services/openspecCli.test.ts`
- Modify: `test/extension/services/stateReader.test.ts`
- Modify: `test/extension/services/dataManager.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/extension/services/openspecCli.test.ts
it('appends --store for store-scoped list and status commands', async () => {
  const exec = vi.spyOn(OpenSpecCliService.prototype as any, 'execOpenSpec')
    .mockResolvedValueOnce(JSON.stringify({ changes: [{ name: 'store-change', completedTasks: 0, totalTasks: 0, lastModified: '2026-01-01' }] }))
    .mockResolvedValueOnce(JSON.stringify({ artifacts: [] }));
  const service = new OpenSpecCliService('/workspace');

  await service.listChanges({ scope: { storeId: 'team-plans' } as any });

  expect(exec).toHaveBeenNthCalledWith(1, ['list', '--json', '--store', 'team-plans']);
  expect(exec).toHaveBeenNthCalledWith(2, ['status', '--change', 'store-change', '--json', '--store', 'team-plans']);
});
```

- [ ] **Step 2: Run test - expect FAIL**

Run: `pnpm vitest run test/extension/services/openspecCli.test.ts`
Expected: FAIL because service methods do not accept scope options.

- [ ] **Step 3: Write minimal implementation**

```ts
interface CommandScopeOptions {
  scope?: { storeId?: string };
}

private withScope(args: string[], options: CommandScopeOptions = {}): string[] {
  return options.scope?.storeId ? [...args, '--store', options.scope.storeId] : args;
}

async listChanges(options: CommandScopeOptions = {}): Promise<ChangeInfo[]> {
  const output = await this.execOpenSpec(this.withScope(['list', '--json'], options));
  // Preserve the current JSON parsing and mapping behavior.
}
```

Apply the same option to `getChangeStatus`, `showChange`, `listSpecs`, `validateChange`, `createChange`, `archiveChange`, and `getInstructions`.

- [ ] **Step 4: Run tests - expect PASS**

Run: `pnpm vitest run test/extension/services/openspecCli.test.ts test/extension/services/stateReader.test.ts test/extension/services/dataManager.test.ts`
Expected: PASS after updating callers to pass selected scope.

---

### Task 3.2: Create scoped content access for artifacts and specs

**Spec coverage:** artifact-viewing / Requirement: Artifact access uses selected scope root / Scenarios: Read artifact from local root, Read artifact from store root, Read main spec from selected root

**Files:**
- Modify: `src/extension/services/contentAccess.ts`
- Modify: `src/extension/services/fileManager.ts`
- Modify: `src/extension/services/dataManager.ts`
- Modify: `test/extension/services/fileManager.test.ts`
- Modify: `test/extension/services/dataManager.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/extension/services/dataManager.test.ts
it('reads artifacts from the selected store root', async () => {
  const manager = new DataManager('/workspace');
  const storeContentAccess = { readArtifact: vi.fn().mockResolvedValue('# Store Proposal') };
  Object.assign(manager as any, {
    getContentAccessForScope: vi.fn(() => storeContentAccess),
    scopeManager: { getSelectedScope: vi.fn(() => ({ id: 'store:team-plans', rootPath: '/stores/team-plans', storeId: 'team-plans' })) },
  });

  await expect(manager.readArtifact('store-change', 'proposal')).resolves.toBe('# Store Proposal');
  expect((manager as any).getContentAccessForScope).toHaveBeenCalledWith(expect.objectContaining({ rootPath: '/stores/team-plans' }));
});
```

- [ ] **Step 2: Run test - expect FAIL**

Run: `pnpm vitest run test/extension/services/dataManager.test.ts`
Expected: FAIL because content access is a single instance.

- [ ] **Step 3: Write minimal implementation**

```ts
private scopedContentAccess = new Map<string, IOpenSpecContentAccess>();

private getContentAccessForScope(scope: OpenSpecScope): IOpenSpecContentAccess {
  const cached = this.scopedContentAccess.get(scope.id);
  if (cached) return cached;
  const access = new FileManagerService(path.join(scope.rootPath, 'openspec'));
  this.scopedContentAccess.set(scope.id, access);
  return access;
}

async readArtifact(changeName: string, artifactType: string, scope = this.scopeManager.getSelectedScope()): Promise<string> {
  return this.getContentAccessForScope(scope).readArtifact(changeName, artifactType);
}
```

- [ ] **Step 4: Run tests - expect PASS**

Run: `pnpm vitest run test/extension/services/dataManager.test.ts test/extension/services/fileManager.test.ts`
Expected: PASS.

---

### Task 3.3: Harden editor-open path checks against the selected root

**Spec coverage:** artifact-viewing / Requirement: Scoped editor opens / Scenarios: Open store artifact in editor, Reject path outside selected root, Explorer reveal is best effort for external store roots

**Files:**
- Modify: `src/extension/providers/webviewMessageHandler.ts`
- Create: `src/extension/utils/pathSafety.ts`
- Modify: `test/extension/providers/webviewMessageHandler.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/extension/providers/webviewMessageHandler.test.ts
it('allows opening a store artifact under the selected store root outside workspace', async () => {
  const dataManager = createDataManagerStub({
    workspaceRoot: '/workspace',
    selectedScope: { id: 'store:team-plans', rootPath: '/stores/team-plans', storeId: 'team-plans' },
  });

  await handleWebviewMessage(
    { type: 'openArtifact', changeName: 'store-change', artifactType: 'proposal', scopeId: 'store:team-plans' } as any,
    webview,
    dataManager as any
  );

  expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith('/stores/team-plans/openspec/changes/store-change/proposal.md');
});
```

Also add a rejection test:

```ts
it('rejects artifact paths that escape selected root', () => {
  expect(isPathUnderRoot('/stores/team-plans/../secret.txt', '/stores/team-plans')).toBe(false);
});
```

- [ ] **Step 2: Run tests - expect FAIL**

Run: `pnpm vitest run test/extension/providers/webviewMessageHandler.test.ts`
Expected: FAIL because message handling checks only workspace root.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/extension/utils/pathSafety.ts
import * as path from 'path';

export function isPathUnderRoot(candidatePath: string, rootPath: string): boolean {
  const normalized = path.resolve(candidatePath);
  const root = path.resolve(rootPath);
  const rel = path.relative(root, normalized);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}
```

Use selected scope root for artifact/spec open checks. Keep workspace-root checks only for workspace-local scope.

- [ ] **Step 4: Run tests - expect PASS**

Run: `pnpm vitest run test/extension/providers/webviewMessageHandler.test.ts`
Expected: PASS.

---

### Task 3.4: Keep task toggles and execution state scoped to the selected root

**Spec coverage:** artifact-viewing / Requirement: Scoped task state and toggles / Scenarios: Toggle task in store-scoped change, Task execution state follows selected root, Archived store change remains read-only

**Files:**
- Modify: `src/extension/services/dataManager.ts`
- Modify: `src/extension/services/stateReader.ts`
- Modify: `src/extension/services/taskExecutorService.ts`
- Modify: `test/extension/services/dataManager.test.ts`
- Modify: `test/extension/services/taskExecutorService.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/extension/services/dataManager.test.ts
it('toggles tasks through scoped content access', async () => {
  const manager = new DataManager('/workspace');
  const scopedAccess = { toggleTask: vi.fn().mockResolvedValue(undefined), readArtifact: vi.fn() };
  Object.assign(manager as any, {
    getContentAccessForScope: vi.fn(() => scopedAccess),
    scopeManager: { getSelectedScope: vi.fn(() => ({ id: 'store:team-plans', rootPath: '/stores/team-plans', storeId: 'team-plans' })) },
    refresh: vi.fn().mockResolvedValue({ changes: [], specs: [], lastRefresh: 1 }),
  });

  await manager.toggleTask('store-change', 2);

  expect(scopedAccess.toggleTask).toHaveBeenCalledWith('store-change', 2);
});
```

- [ ] **Step 2: Run test - expect FAIL**

Run: `pnpm vitest run test/extension/services/dataManager.test.ts test/extension/services/taskExecutorService.test.ts`
Expected: FAIL because task operations use the single root.

- [ ] **Step 3: Write minimal implementation**

```ts
async toggleTask(changeName: string, taskIndex: number, scope = this.scopeManager.getSelectedScope()): Promise<void> {
  await this.getContentAccessForScope(scope).toggleTask(changeName, taskIndex);
  await this.refresh();
}
```

Thread scope into task execution state reads/writes by resolving `.openspec.yaml` through scoped content access.

- [ ] **Step 4: Run tests - expect PASS**

Run: `pnpm vitest run test/extension/services/dataManager.test.ts test/extension/services/taskExecutorService.test.ts`
Expected: PASS.
