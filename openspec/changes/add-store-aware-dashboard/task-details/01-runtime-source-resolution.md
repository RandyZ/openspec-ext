# Task 1. Runtime Source Resolution

<!-- covers: Task 1.1, Task 1.2, Task 1.3, Task 1.4 -->

### Task 1.1: Add runtime source settings and package configuration tests

**Spec coverage:** openspec-scope-management / Requirement: OpenSpec runtime source selection / Scenarios: Default auto mode preserves existing installed CLI behavior, Custom path mode uses configured executable only, Local source mode uses configured source checkout

**Files:**
- Modify: `package.json`
- Modify: `test/extension/packageConfiguration.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/extension/packageConfiguration.test.ts
it('declares OpenSpec runtime source settings', () => {
  expect(properties['openspec.cliMode']).toMatchObject({
    type: 'string',
    enum: ['auto', 'installed', 'localSource', 'customPath'],
    default: 'auto',
  });
  expect(properties['openspec.localOpenSpecSourcePath']).toMatchObject({
    type: 'string',
    default: '',
  });
  expect(properties['openspec.localOpenSpecAutoBuild']).toMatchObject({
    type: 'string',
    enum: ['off', 'prompt', 'beforeUse'],
    default: 'off',
  });
});
```

- [ ] **Step 2: Run test - expect FAIL**

Run: `pnpm vitest run test/extension/packageConfiguration.test.ts`
Expected: FAIL because `openspec.cliMode` is missing from contributed configuration.

- [ ] **Step 3: Write minimal implementation**

```json
// package.json contributes.configuration.properties
"openspec.cliMode": {
  "type": "string",
  "enum": ["auto", "installed", "localSource", "customPath"],
  "default": "auto",
  "description": "OpenSpec CLI runtime source: auto, installed CLI, local OpenSpec source checkout, or custom executable path."
},
"openspec.localOpenSpecSourcePath": {
  "type": "string",
  "default": "",
  "description": "Path to a local OpenSpec source checkout used when openspec.cliMode is localSource."
},
"openspec.localOpenSpecAutoBuild": {
  "type": "string",
  "enum": ["off", "prompt", "beforeUse"],
  "default": "off",
  "description": "Whether the extension may offer to build a local OpenSpec source checkout when build output is missing."
}
```

- [ ] **Step 4: Run test - expect PASS**

Run: `pnpm vitest run test/extension/packageConfiguration.test.ts`
Expected: PASS.

---

### Task 1.2: Extend the CLI resolver with command argsPrefix and source metadata

**Spec coverage:** cli-integration / Requirement: CLI resolver supports runtime modes / Scenarios: Resolved command includes args prefix, Installed CLI has empty args prefix, Resolver cache accounts for runtime settings

**Files:**
- Modify: `src/extension/services/openspecCliResolver.ts`
- Modify: `test/extension/services/openspecCliResolver.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// test/extension/services/openspecCliResolver.test.ts
it('returns installed runtime metadata with an empty argsPrefix', async () => {
  vi.mocked(spawn).mockImplementation((command: string, args: string[]) => {
    calls.push({ command, args });
    return createProcess('1.4.1') as any;
  });

  const result = await new OpenSpecCliResolver('/workspace').resolve();

  expect(result).toMatchObject({
    command: 'openspec',
    argsPrefix: [],
    source: 'installed',
    sourceLabel: 'Installed CLI',
    version: '1.4.1',
  });
});

it('uses local source mode as node plus bin/openspec.js', async () => {
  cliMode = 'localSource';
  localOpenSpecSourcePath = '/src/OpenSpec';
  vi.mocked(spawn).mockImplementation((command: string, args: string[]) => {
    calls.push({ command, args });
    return createProcess('1.4.1') as any;
  });

  const result = await new OpenSpecCliResolver('/workspace').resolve();

  expect(result.command).toBe(process.execPath);
  expect(result.argsPrefix).toEqual(['/src/OpenSpec/bin/openspec.js']);
  expect(result.source).toBe('localSource');
  expect(calls[0]).toEqual({
    command: process.execPath,
    args: ['/src/OpenSpec/bin/openspec.js', '--version'],
  });
});
```

Also extend the mocked VS Code configuration in the test file:

```ts
let cliMode = 'auto';
let localOpenSpecSourcePath = '';

get: vi.fn((key: string) => {
  if (key === 'cliPath') return cliPath;
  if (key === 'cliMode') return cliMode;
  if (key === 'localOpenSpecSourcePath') return localOpenSpecSourcePath;
  return undefined;
})
```

- [ ] **Step 2: Run test - expect FAIL**

Run: `pnpm vitest run test/extension/services/openspecCliResolver.test.ts`
Expected: FAIL because `argsPrefix`, `source`, and `sourceLabel` do not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export type OpenSpecRuntimeSource = 'installed' | 'customPath' | 'localSource';

export interface ResolvedOpenSpecCli {
  command: string;
  argsPrefix: string[];
  env: NodeJS.ProcessEnv;
  version: string;
  source: OpenSpecRuntimeSource;
  sourceLabel: string;
  diagnostics: string[];
}
```

Add a resolver branch before installed CLI discovery:

```ts
const cliMode = this.getConfiguredMode();
if (cliMode === 'localSource') {
  const sourceRoot = this.getConfiguredLocalSourcePath();
  const entrypoint = path.join(sourceRoot, 'bin', 'openspec.js');
  const resolved = await this.tryCommand(
    process.execPath,
    diagnostics,
    'local source',
    [entrypoint],
    { source: 'localSource', sourceLabel: 'Local Source' }
  );
  if (resolved) return this.cache(resolved);
  throw new OpenSpecCliResolutionError(`Local OpenSpec source is invalid: ${sourceRoot}`, diagnostics);
}
```

Update `tryCommand` and `spawnAndCollect` so validation args are `[...argsPrefix, '--version']`.

- [ ] **Step 4: Run test - expect PASS**

Run: `pnpm vitest run test/extension/services/openspecCliResolver.test.ts`
Expected: PASS.

---

### Task 1.3: Add local source readiness diagnostics

**Spec coverage:** openspec-scope-management / Requirement: Local source readiness diagnostics / Scenarios: Local source checkout is ready, Local source checkout is missing build output, Local source path is invalid; cli-integration / Requirement: Local source runtime validation

**Files:**
- Modify: `src/extension/services/openspecCliResolver.ts`
- Modify: `src/extension/services/cliActivationDiagnostic.ts`
- Modify: `src/extension/services/openspecCli.ts`
- Modify: `test/extension/services/openspecCliResolver.test.ts`
- Modify: `test/extension/services/cliActivationDiagnostic.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// test/extension/services/openspecCliResolver.test.ts
it('fails local source mode before fallback when source path is empty', async () => {
  cliMode = 'localSource';
  localOpenSpecSourcePath = '';

  await expect(new OpenSpecCliResolver('/workspace').resolve()).rejects.toThrow(
    'Local OpenSpec source path is not configured'
  );
  expect(vi.mocked(spawn)).not.toHaveBeenCalled();
});

it('reports missing local source build output from version failure', async () => {
  cliMode = 'localSource';
  localOpenSpecSourcePath = '/src/OpenSpec';
  vi.mocked(spawn).mockImplementation(() => createSpawnError('Cannot find module ../dist/cli/index.js') as any);

  await expect(new OpenSpecCliResolver('/workspace').resolve()).rejects.toMatchObject({
    name: 'OpenSpecCliResolutionError',
    diagnostics: expect.arrayContaining([
      expect.stringContaining('local source: failed'),
    ]),
  });
});
```

```ts
// test/extension/services/cliActivationDiagnostic.test.ts
it('classifies local source failures as local-source-invalid', () => {
  const diagnostic = buildCliActivationDiagnostic({
    category: 'local-source-invalid',
    message: 'Local OpenSpec source is invalid',
    rawDetails: ['local source: failed Cannot find module ../dist/cli/index.js'],
    platform: 'darwin',
    arch: 'arm64',
    workspaceName: 'openspec-ext',
    configuredCliPath: '',
  });

  expect(diagnostic.recoveryActions).toContain('open-settings');
  expect(diagnostic.recoveryActions).toContain('retry');
  expect(diagnostic.safeDetails.join(' ')).not.toContain(process.env.HOME ?? '/Users');
});
```

- [ ] **Step 2: Run tests - expect FAIL**

Run: `pnpm vitest run test/extension/services/openspecCliResolver.test.ts test/extension/services/cliActivationDiagnostic.test.ts`
Expected: FAIL because local source diagnostic category and path validation do not exist.

- [ ] **Step 3: Write minimal implementation**

Add diagnostic categories:

```ts
export type CliActivationDiagnosticCategory =
  | 'cli-not-found'
  | 'configured-path-invalid'
  | 'permission-denied'
  | 'shell-resolution-failed'
  | 'version-check-failed'
  | 'spawn-failed'
  | 'local-source-invalid'
  | 'unknown';
```

In resolver:

```ts
private getConfiguredLocalSourcePath(): string {
  return (vscode.workspace.getConfiguration('openspec').get<string>('localOpenSpecSourcePath') ?? '').trim();
}
```

Reject empty local source mode before fallback:

```ts
if (!sourceRoot) {
  throw new OpenSpecCliResolutionError('Local OpenSpec source path is not configured', diagnostics);
}
```

In `OpenSpecCliService.classifyResolutionError`, classify messages or diagnostics containing `Local OpenSpec source` or `local source:` as `local-source-invalid`.

- [ ] **Step 4: Run tests - expect PASS**

Run: `pnpm vitest run test/extension/services/openspecCliResolver.test.ts test/extension/services/cliActivationDiagnostic.test.ts`
Expected: PASS.

---

### Task 1.4: Execute CLI commands through the resolved runtime argsPrefix

**Spec coverage:** cli-integration / Requirement: CLI resolver supports runtime modes / Scenarios: Resolved command includes args prefix, Installed CLI has empty args prefix

**Files:**
- Modify: `src/extension/services/openspecCli.ts`
- Modify: `test/extension/services/openspecCli.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/extension/services/openspecCli.test.ts
it('prepends runtime argsPrefix when executing OpenSpec commands', async () => {
  const resolver = {
    resolve: vi.fn().mockResolvedValue({
      command: process.execPath,
      argsPrefix: ['/src/OpenSpec/bin/openspec.js'],
      env: process.env,
      version: '1.4.1',
      source: 'localSource',
      sourceLabel: 'Local Source',
      diagnostics: [],
    }),
    clearCache: vi.fn(),
  };
  vi.mocked(spawn).mockImplementation((_command: string, args: readonly string[]) => {
    expect(_command).toBe(process.execPath);
    expect(args).toEqual(['/src/OpenSpec/bin/openspec.js', 'list', '--json']);
    return createSpawnSuccessProcess(JSON.stringify({ changes: [] })) as any;
  });

  const service = new OpenSpecCliService('/workspace', resolver as any);
  await service.listChanges();
});
```

- [ ] **Step 2: Run test - expect FAIL**

Run: `pnpm vitest run test/extension/services/openspecCli.test.ts`
Expected: FAIL because `execOpenSpecOnce` spawns only requested args.

- [ ] **Step 3: Write minimal implementation**

```ts
this.resolver.resolve().then(({ command, argsPrefix, env }) => {
  const proc = spawn(command, [...(argsPrefix ?? []), ...args], {
    cwd: this.workspaceRoot,
    env,
    shell: process.platform === 'win32' && argsPrefix.length === 0,
    windowsHide: process.platform === 'win32',
  });
});
```

Keep `shell` disabled for local source mode because the command is the Node executable and arguments are explicit.

- [ ] **Step 4: Run test - expect PASS**

Run: `pnpm vitest run test/extension/services/openspecCli.test.ts`
Expected: PASS.
