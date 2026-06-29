# Task 5. Change Detail And Workflow Scope Binding

<!-- covers: Task 5.1, Task 5.2, Task 5.3, Task 5.4 -->

### Task 5.1: Bind change detail panels to the scope used to open them

**Spec coverage:** workflow-control / Requirement: Change detail inherits selected scope / Scenarios: Open change detail from store dashboard, Existing detail updates on scope refresh, Archived detail remains scoped

**Files:**
- Modify: `src/extension/providers/changeDetailPanelManager.ts`
- Modify: `src/extension/providers/dashboardViewProvider.ts`
- Modify: `src/webview/types/messages.ts`
- Modify: `src/webview/components/ChangeDetail.tsx`
- Modify: `test/webview/components/changeDetailRouting.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/webview/components/changeDetailRouting.test.ts
it('change detail context includes scope metadata', () => {
  const contextMessage = buildChangeDetailContextMessage({
    changeName: 'store-change',
    scope: { id: 'store:team-plans', label: 'team-plans', source: 'store', rootPath: '/stores/team-plans', storeId: 'team-plans', runtimeSource: 'localSource' },
  } as any);

  expect(contextMessage).toMatchObject({
    type: 'setContext',
    changeName: 'store-change',
    scope: expect.objectContaining({ id: 'store:team-plans', storeId: 'team-plans' }),
  });
});
```

- [ ] **Step 2: Run test - expect FAIL**

Run: `pnpm vitest run test/webview/components/changeDetailRouting.test.ts`
Expected: FAIL because change detail context does not include scope.

- [ ] **Step 3: Write minimal implementation**

Add scope to `setContext`:

```ts
| {
    type: 'setContext';
    view: 'changeDetail';
    changeName: string;
    scope?: OpenSpecScopeView;
    existingArtifactIds?: string[];
    debug?: boolean;
    initialTab?: ChangeDetailTabId;
    interactiveAction?: InteractiveWorkflowAction;
  }
```

Change panel open calls should capture the selected scope from `DataManager` and send it to the webview. `ChangeDetail` should render a small scope badge in the header when `scope.source !== 'local'`.

- [ ] **Step 4: Run test - expect PASS**

Run: `pnpm vitest run test/webview/components/changeDetailRouting.test.ts`
Expected: PASS.

---

### Task 5.2: Key artifact caches and artifact messages by scope

**Spec coverage:** artifact-viewing / Requirement: Scope change invalidates artifact caches / Scenarios: Change detail cache includes scope identity, Same change name in two roots is isolated

**Files:**
- Modify: `src/webview/components/ChangeDetail.tsx`
- Modify: `src/webview/types/messages.ts`
- Modify: `src/extension/providers/webviewMessageHandler.ts`
- Modify: `test/webview/components/changeDetailRouting.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/webview/components/changeDetailRouting.test.ts
it('artifact request messages include scope id', () => {
  expect(sendMessage.getArtifactContent('same-name', 'proposal', 'store:team-plans')).toEqual({
    type: 'getArtifactContent',
    changeName: 'same-name',
    artifactType: 'proposal',
    scopeId: 'store:team-plans',
  });
});
```

- [ ] **Step 2: Run test - expect FAIL**

Run: `pnpm vitest run test/webview/components/changeDetailRouting.test.ts`
Expected: FAIL because artifact messages have no `scopeId`.

- [ ] **Step 3: Write minimal implementation**

```ts
getArtifactContent: (changeName: string, artifactType: string, scopeId?: string): WebviewMessage => ({
  type: 'getArtifactContent',
  changeName,
  artifactType,
  ...(scopeId ? { scopeId } : {}),
})
```

Update `cacheKey`:

```ts
const cacheKey = (scopeId: string | undefined, type: string, specId?: string | null) =>
  `${scopeId ?? 'current'}:${type === 'specs' && specId ? `specs:${specId}` : type}`;
```

Handler resolves the supplied scope id and rejects high-impact actions if it does not match an available scope.

- [ ] **Step 4: Run tests - expect PASS**

Run: `pnpm vitest run test/webview/components/changeDetailRouting.test.ts test/extension/providers/webviewMessageHandler.test.ts`
Expected: PASS.

---

### Task 5.3: Make workflow and terminal actions scope-aware

**Spec coverage:** workflow-control / Requirement: Workflow actions use selected scope; Requirement: Interactive Verify and Archive are scope-aware

**Files:**
- Modify: `src/extension/providers/webviewMessageHandler.ts`
- Modify: `src/extension/services/interactiveAgentTerminalManager.ts`
- Modify: `src/shared/workflowCommand.ts`
- Modify: `test/extension/services/interactiveAgentTerminalManager.test.ts`
- Modify: `test/shared/workflowCommand.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// test/extension/services/interactiveAgentTerminalManager.test.ts
it('starts store-scoped verify terminal from the store root', async () => {
  const terminal = createTerminalDouble('OpenSpec Verify: store-change');
  vi.mocked(vscode.window.createTerminal).mockReturnValue(terminal as any);
  const manager = new InteractiveAgentTerminalManager({
    isAgentAvailable: vi.fn().mockResolvedValue(true),
    now: () => 123,
    getModel: () => 'auto',
  });

  await manager.start({
    workspaceRoot: '/workspace/root',
    changeName: 'store-change',
    action: 'verify',
    scope: { rootPath: '/stores/team-plans', storeId: 'team-plans', label: 'team-plans' } as any,
  });

  expect(vscode.window.createTerminal).toHaveBeenCalledWith(expect.objectContaining({
    cwd: '/stores/team-plans',
  }));
  expect(terminal.sendText).toHaveBeenCalledWith(expect.stringContaining('team-plans'), true);
});
```

```ts
// test/shared/workflowCommand.test.ts
it('can include store context text for scoped workflow payloads', () => {
  expect(buildWorkflowLaunchPayload({ action: 'apply', changeName: 'store-change', target: 'clipboard', storeId: 'team-plans' }).command).toContain('team-plans');
});
```

- [ ] **Step 2: Run tests - expect FAIL**

Run: `pnpm vitest run test/extension/services/interactiveAgentTerminalManager.test.ts test/shared/workflowCommand.test.ts`
Expected: FAIL because workflow helpers do not accept scope.

- [ ] **Step 3: Write minimal implementation**

For terminal workflows, use `scope.rootPath` as cwd when present and include store context in the sent command or prompt wrapper:

```ts
const cwd = input.scope?.rootPath ?? input.workspaceRoot;
const storeNote = input.scope?.storeId ? ` --store ${shellQuote(input.scope.storeId)}` : '';
```

For clipboard/adapter launch payloads, keep existing slash command format but include scope metadata in the adapter payload so adapters that can use context receive it:

```ts
interface WorkflowLaunchPayload {
  command: string;
  scopeLabel?: string;
  storeId?: string;
}
```

When the extension itself runs OpenSpec CLI for the action, use scoped CLI methods from Task 3.1.

- [ ] **Step 4: Run tests - expect PASS**

Run: `pnpm vitest run test/extension/services/interactiveAgentTerminalManager.test.ts test/shared/workflowCommand.test.ts test/extension/providers/webviewMessageHandler.test.ts`
Expected: PASS.

---

### Task 5.4: Prevent referenced stores from exposing writable workflow controls

**Spec coverage:** workflow-control / Requirement: Referenced stores are not workflow targets; dashboard / Requirement: Read-only references panel / Scenario: References do not expose write actions

**Files:**
- Modify: `src/webview/components/ReferencesPanel.tsx`
- Modify: `src/webview/components/Dashboard.tsx`
- Modify: `test/webview/components/referencesPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// test/webview/components/referencesPanel.test.tsx
it('offers select-as-scope only for registered references and no workflow actions', () => {
  const html = renderToStaticMarkup(
    <ReferencesPanel
      references={[{ store_id: 'platform-reqs', root: '/stores/platform-reqs', specs: [], status: [] }]}
      onCopyFetch={vi.fn()}
      onSelectStoreScope={vi.fn()}
    />
  );

  expect(html).toContain('Work in this store');
  expect(html).not.toContain('Continue');
  expect(html).not.toContain('Verify');
  expect(html).not.toContain('Archive');
});
```

- [ ] **Step 2: Run test - expect FAIL**

Run: `pnpm vitest run test/webview/components/referencesPanel.test.tsx`
Expected: FAIL because select-as-scope behavior is missing.

- [ ] **Step 3: Write minimal implementation**

Add an optional button only when `reference.root` is present:

```tsx
{ref.root && onSelectStoreScope && (
  <button type="button" onClick={() => onSelectStoreScope(ref.store_id)}>
    Work in this store
  </button>
)}
```

Do not import or render `ActionBar`, `ChangeCard` workflow actions, or task toggles inside `ReferencesPanel`.

- [ ] **Step 4: Run test - expect PASS**

Run: `pnpm vitest run test/webview/components/referencesPanel.test.tsx`
Expected: PASS.
