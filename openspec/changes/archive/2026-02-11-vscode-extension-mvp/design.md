# Design Document: OpenSpec VSCode Extension MVP

## Overview

This document describes the technical design for the OpenSpec VSCode Extension MVP. The extension provides a visual dashboard and interactive UI for OpenSpec workflows, integrating with the OpenSpec CLI while maintaining a clean separation of concerns.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VSCode Extension                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Extension Host (Node.js)                         │  │
│  │                                                               │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │  Commands & Providers                                   │ │  │
│  │  │  - Command handlers                                     │ │  │
│  │  │  - Webview provider                                     │ │  │
│  │  │  - Tree view provider                                   │ │  │
│  │  └──────────────┬──────────────────────────────────────────┘ │  │
│  │                 │                                             │  │
│  │                 ▼                                             │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │  Service Layer                                          │ │  │
│  │  │  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐ │ │  │
│  │  │  │ OpenSpecCli   │  │ FileManager  │  │ DataCache    │ │ │  │
│  │  │  │ Service       │  │ Service      │  │ Service      │ │ │  │
│  │  │  └───────────────┘  └──────────────┘  └──────────────┘ │ │  │
│  │  └──────────────┬──────────────────────────────────────────┘ │  │
│  │                 │                                             │  │
│  │                 ▼                                             │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │  External Resources                                     │ │  │
│  │  │  - OpenSpec CLI (child_process)                        │ │  │
│  │  │  - File System (openspec/ directory)                   │ │  │
│  │  │  - FileSystemWatcher                                   │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│                         ↕ Message Passing ↕                         │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Webview Panel (React)                            │  │
│  │                                                               │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │  React App                                              │ │  │
│  │  │  - App.tsx (router, message handler)                   │ │  │
│  │  │  - Views (Dashboard, ChangeDetail, SpecViewer)         │ │  │
│  │  │  - Components (TaskCheckbox, MarkdownRenderer, etc.)   │ │  │
│  │  │  - State Management (Context API or Zustand)           │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Extension Entry (`extension.ts`)

**Responsibilities:**
- Extension lifecycle management (activate/deactivate)
- Command registration
- Provider initialization
- Workspace detection

**Key Functions:**

```typescript
export async function activate(context: vscode.ExtensionContext) {
  // 1. Check CLI availability
  const cliAvailable = await checkCliAvailability();
  if (!cliAvailable) {
    showCliNotFoundError();
    return;
  }

  // 2. Detect workspace and openspec/ directory
  const workspaceRoot = getWorkspaceRoot();
  const openspecDir = path.join(workspaceRoot, 'openspec');
  if (!fs.existsSync(openspecDir)) {
    // Extension can still activate but show warning
    showNoOpenSpecWarning();
  }

  // 3. Initialize services
  const cliService = new OpenSpecCliService();
  const fileManager = new FileManagerService(openspecDir);
  const cache = new DataCacheService();

  // 4. Create providers
  const dashboardProvider = new DashboardProvider(context, cliService, fileManager, cache);
  const sidebarProvider = new SidebarProvider(cliService, fileManager);

  // 5. Register commands
  registerCommands(context, dashboardProvider, cliService, fileManager);

  // 6. Setup file watcher
  setupFileWatcher(context, openspecDir, dashboardProvider, sidebarProvider);

  // 7. Store in context for later access
  context.globalState.update('services', { cliService, fileManager, cache });
}

export function deactivate() {
  // Cleanup resources
  // Close watchers, dispose providers
}
```

### 2. OpenSpec CLI Service (`services/openspecCli.ts`)

**Responsibilities:**
- Execute openspec CLI commands
- Parse JSON output
- Handle errors and retries

**Interface:**

```typescript
interface ChangeInfo {
  name: string;
  completedTasks: number;
  totalTasks: number;
  lastModified: string;
  status: 'draft' | 'active' | 'completed';
}

interface SpecInfo {
  id: string;
  requirementCount: number;
  path: string;
}

class OpenSpecCliService {
  // Core CLI operations
  async listChanges(): Promise<ChangeInfo[]>;
  async showChange(name: string): Promise<ChangeDetails>;
  async listSpecs(): Promise<SpecInfo[]>;
  async validateChange(name: string): Promise<ValidationResult>;
  
  // Command execution
  async createChange(name: string): Promise<void>;
  async archiveChange(name: string): Promise<void>;
  
  // Helper methods
  async checkAvailability(): Promise<boolean>;
  async getVersion(): Promise<string>;
  
  // Low-level exec
  private async execOpenSpec(args: string[]): Promise<string>;
  private parseCliOutput<T>(output: string): T;
}
```

**Implementation Details:**

```typescript
private async execOpenSpec(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('openspec', args, {
      cwd: this.workspaceRoot,
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data; });
    proc.stderr.on('data', (data) => { stderr += data; });

    proc.on('close', (code) => {
      if (code !== 0) {
        const error = new OpenSpecCliError(
          `Command failed with code ${code}`,
          code,
          stderr
        );
        reject(error);
      } else {
        resolve(stdout);
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      proc.kill();
      reject(new Error('Command timed out'));
    }, 30000);
  });
}

async listChanges(): Promise<ChangeInfo[]> {
  const output = await this.execOpenSpec(['list', '--json']);
  const data = JSON.parse(output);
  
  // Transform CLI output to our model
  return data.changes.map(c => ({
    name: c.name,
    completedTasks: c.completedTasks,
    totalTasks: c.totalTasks,
    lastModified: c.lastModified,
    status: this.determineStatus(c),
  }));
}

private determineStatus(change: any): 'draft' | 'active' | 'completed' {
  if (change.totalTasks === 0) return 'draft';
  if (change.completedTasks === change.totalTasks) return 'completed';
  return 'active';
}
```

### 3. File Manager Service (`services/fileManager.ts`)

**Responsibilities:**
- Direct file system operations
- Task markdown parsing and updating
- Artifact content reading

**Interface:**

```typescript
class FileManagerService {
  constructor(private openspecDir: string) {}

  // Artifact reading
  async readArtifact(changeName: string, artifactType: string): Promise<string>;
  async artifactExists(changeName: string, artifactType: string): Promise<boolean>;
  
  // Task operations
  async readTasks(changeName: string): Promise<Task[]>;
  async toggleTask(changeName: string, taskIndex: number): Promise<void>;
  async getTaskProgress(changeName: string): Promise<{ completed: number; total: number }>;
  
  // Spec operations
  async readSpec(specId: string): Promise<string>;
  async readDeltaSpec(changeName: string, specId: string): Promise<string | null>;
  
  // Utility
  getArtifactPath(changeName: string, artifactType: string): string;
}
```

**Task Parsing Implementation:**

```typescript
async readTasks(changeName: string): Promise<Task[]> {
  const tasksPath = path.join(
    this.openspecDir,
    'changes',
    changeName,
    'tasks.md'
  );

  if (!fs.existsSync(tasksPath)) {
    return [];
  }

  const content = await fs.promises.readFile(tasksPath, 'utf-8');
  return this.parseTasksMarkdown(content);
}

private parseTasksMarkdown(content: string): Task[] {
  const lines = content.split('\n');
  const tasks: Task[] = [];
  let lineIndex = 0;

  for (const line of lines) {
    const match = line.match(/^(\s*)- \[([ x])\] (.+)$/);
    if (match) {
      tasks.push({
        lineIndex,
        indent: match[1].length,
        done: match[2] === 'x',
        text: match[3],
        originalLine: line,
      });
    }
    lineIndex++;
  }

  return tasks;
}

async toggleTask(changeName: string, taskIndex: number): Promise<void> {
  const tasksPath = this.getArtifactPath(changeName, 'tasks');
  const content = await fs.promises.readFile(tasksPath, 'utf-8');
  const lines = content.split('\n');

  let taskCount = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^(\s*)- \[([ x])\]/.test(lines[i])) {
      taskCount++;
      if (taskCount === taskIndex) {
        // Toggle the checkbox
        lines[i] = lines[i].replace(/\[([ x])\]/, (_, char) => {
          return char === 'x' ? '[ ]' : '[x]';
        });
        break;
      }
    }
  }

  await fs.promises.writeFile(tasksPath, lines.join('\n'), 'utf-8');
}
```

### 4. Data Cache Service (`services/dataCache.ts`)

**Responsibilities:**
- Cache CLI output to reduce redundant calls
- Invalidate cache on file changes
- TTL management

**Interface:**

```typescript
class DataCacheService {
  private cache: Map<string, CacheEntry>;
  private defaultTTL: number = 10000; // 10 seconds

  get<T>(key: string): T | null;
  set<T>(key: string, value: T, ttl?: number): void;
  invalidate(key: string): void;
  invalidateAll(): void;
  invalidatePattern(pattern: RegExp): void;
}

interface CacheEntry {
  value: any;
  timestamp: number;
  ttl: number;
}
```

**Usage:**

```typescript
// In OpenSpecCliService
async listChanges(): Promise<ChangeInfo[]> {
  const cacheKey = 'changes:list';
  const cached = this.cache.get<ChangeInfo[]>(cacheKey);
  if (cached) return cached;

  const output = await this.execOpenSpec(['list', '--json']);
  const changes = this.parseChanges(output);
  
  this.cache.set(cacheKey, changes);
  return changes;
}
```

### 5. Dashboard Provider (`providers/dashboardProvider.ts`)

**Responsibilities:**
- Create and manage webview panel
- Handle messages from webview
- Send data updates to webview

**Key Methods:**

```typescript
class DashboardProvider {
  private panel: vscode.WebviewPanel | undefined;

  async show(): Promise<void> {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'openspecDashboard',
      'OpenSpec Dashboard',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.context.extensionPath, 'dist', 'webview'))
        ],
      }
    );

    this.panel.webview.html = this.getWebviewContent();
    this.setupMessageHandler();
    await this.sendInitialData();
  }

  private setupMessageHandler(): void {
    this.panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'requestData':
          await this.sendData();
          break;
        case 'toggleTask':
          await this.handleToggleTask(message.payload);
          break;
        case 'openChange':
          await this.handleOpenChange(message.payload);
          break;
        case 'copyCommand':
          await this.handleCopyCommand(message.payload);
          break;
        case 'createChange':
          await this.handleCreateChange(message.payload);
          break;
        case 'archiveChange':
          await this.handleArchiveChange(message.payload);
          break;
      }
    });
  }

  async sendData(): Promise<void> {
    const changes = await this.cliService.listChanges();
    const specs = await this.cliService.listSpecs();

    this.panel.webview.postMessage({
      type: 'updateData',
      payload: { changes, specs },
    });
  }

  private async handleToggleTask(payload: any): Promise<void> {
    const { changeName, taskIndex } = payload;
    await this.fileManager.toggleTask(changeName, taskIndex);
    
    // File watcher will trigger refresh, but we can also
    // optimistically update the UI
    await this.sendData();
  }

  private getWebviewContent(): string {
    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'dist', 'webview', 'index.js'))
    );
    const styleUri = this.panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'dist', 'webview', 'index.css'))
    );

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleUri}" rel="stylesheet">
        <title>OpenSpec Dashboard</title>
      </head>
      <body>
        <div id="root"></div>
        <script src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}
```

### 6. File Watcher Setup

**Responsibilities:**
- Watch openspec/ directory for changes
- Trigger data refresh on file events
- Debounce rapid events

**Implementation:**

```typescript
function setupFileWatcher(
  context: vscode.ExtensionContext,
  openspecDir: string,
  dashboardProvider: DashboardProvider,
  sidebarProvider: SidebarProvider
): void {
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(openspecDir, '**/*.{md,yaml}')
  );

  // Debounce refresh to avoid too many updates
  let refreshTimeout: NodeJS.Timeout | undefined;
  const debouncedRefresh = () => {
    if (refreshTimeout) clearTimeout(refreshTimeout);
    refreshTimeout = setTimeout(async () => {
      await dashboardProvider.sendData();
      sidebarProvider.refresh();
    }, 300);
  };

  watcher.onDidChange(debouncedRefresh);
  watcher.onDidCreate(debouncedRefresh);
  watcher.onDidDelete(debouncedRefresh);

  context.subscriptions.push(watcher);
}
```

## Frontend Design (React Webview)

### Component Hierarchy

```
App
├── Router
│   ├── Dashboard View
│   │   ├── ChangesSection
│   │   │   ├── ChangeCard (multiple)
│   │   │   └── EmptyState
│   │   ├── SpecsSection
│   │   │   └── SpecCard (multiple)
│   │   └── ArchiveSection
│   │       └── ArchiveCard (multiple)
│   │
│   └── Change Detail View
│       ├── Tabs (Proposal, Specs, Design, Tasks)
│       ├── ArtifactViewer
│       │   ├── MarkdownRenderer
│       │   └── TaskList
│       └── ActionBar
│           └── QuickActionButton (multiple)
│
└── Global Components
    ├── Header
    ├── LoadingSpinner
    └── ErrorBoundary
```

### State Management

**Use React Context API for simplicity:**

```typescript
interface AppState {
  changes: ChangeInfo[];
  specs: SpecInfo[];
  selectedChange: string | null;
  loading: boolean;
  error: string | null;
}

const AppContext = React.createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
}>(null);

// Actions
type Action =
  | { type: 'SET_CHANGES'; payload: ChangeInfo[] }
  | { type: 'SET_SPECS'; payload: SpecInfo[] }
  | { type: 'SELECT_CHANGE'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };
```

### VSCode API Hook

```typescript
// hooks/useVscode.ts
function useVscode() {
  const vscode = React.useMemo(() => {
    return acquireVsCodeApi();
  }, []);

  const postMessage = React.useCallback((type: string, payload: any) => {
    vscode.postMessage({ type, payload });
  }, [vscode]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      // Handle messages from extension
      switch (message.type) {
        case 'updateData':
          // Update state
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return { postMessage, vscode };
}
```

### Task Checkbox Component

```typescript
interface TaskCheckboxProps {
  task: Task;
  changeName: string;
  taskIndex: number;
  onToggle: () => void;
}

const TaskCheckbox: React.FC<TaskCheckboxProps> = ({
  task,
  changeName,
  taskIndex,
  onToggle,
}) => {
  const { postMessage } = useVscode();
  const [isToggling, setIsToggling] = React.useState(false);

  const handleClick = async () => {
    setIsToggling(true);
    postMessage('toggleTask', { changeName, taskIndex });
    
    // Optimistic update
    onToggle();
    
    // Reset after animation
    setTimeout(() => setIsToggling(false), 300);
  };

  return (
    <div className="flex items-center gap-2 py-1" style={{ paddingLeft: `${task.indent * 16}px` }}>
      <input
        type="checkbox"
        checked={task.done}
        onChange={handleClick}
        disabled={isToggling}
        className="cursor-pointer"
      />
      <span className={task.done ? 'line-through text-gray-500' : ''}>
        {task.text}
      </span>
    </div>
  );
};
```

## Data Flow Diagrams

### Initial Load

```
User opens extension
        ↓
activate() called
        ↓
Check CLI availability
        ↓
Initialize services
        ↓
Create Dashboard Provider
        ↓
dashboardProvider.show()
        ↓
Create webview panel
        ↓
Load React app
        ↓
React app posts "requestData"
        ↓
Extension calls cliService.listChanges()
        ↓
CLI executed: openspec list --json
        ↓
Parse JSON response
        ↓
Cache result
        ↓
Post message to webview: { type: 'updateData', payload: { changes, specs } }
        ↓
React app updates state
        ↓
Dashboard renders
```

### Task Toggle Flow

```
User clicks task checkbox
        ↓
TaskCheckbox component
        ↓
postMessage({ type: 'toggleTask', payload: { changeName, taskIndex } })
        ↓
Extension receives message
        ↓
dashboardProvider.handleToggleTask()
        ↓
fileManager.toggleTask(changeName, taskIndex)
        ↓
Read tasks.md
        ↓
Parse markdown
        ↓
Toggle checkbox [ ] ↔ [x]
        ↓
Write back to tasks.md
        ↓
FileSystemWatcher detects change
        ↓
debouncedRefresh() triggered
        ↓
Cache invalidated
        ↓
sendData() called
        ↓
Read fresh data
        ↓
Post message to webview
        ↓
React app updates
        ↓
UI reflects new state
```

## Build Configuration

### Extension Build (esbuild)

```javascript
// esbuild.config.js
require('esbuild').build({
  entryPoints: ['src/extension/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  minify: process.env.NODE_ENV === 'production',
}).catch(() => process.exit(1));
```

### Webview Build (Vite)

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist/webview',
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
        assetFileNames: 'index.css',
      },
    },
  },
});
```

## Error Handling Strategy

### Levels of Error Handling

1. **CLI Errors**: Caught in OpenSpecCliService, logged, user notified
2. **File System Errors**: Caught in FileManagerService, graceful degradation
3. **Extension Errors**: Caught at command level, show error notification
4. **Webview Errors**: ErrorBoundary in React, fallback UI

### Example Error Handler

```typescript
async function executeWithErrorHandling<T>(
  operation: () => Promise<T>,
  errorMessage: string
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    console.error(errorMessage, error);
    vscode.window.showErrorMessage(`${errorMessage}: ${error.message}`);
    return null;
  }
}

// Usage
const changes = await executeWithErrorHandling(
  () => cliService.listChanges(),
  'Failed to load changes'
);
```

## Testing Strategy

### Unit Tests
- OpenSpecCliService: Mock child_process
- FileManagerService: Use temp directories
- Task parsing: Test edge cases

### Integration Tests
- Extension activation: Test in VSCode test environment
- Command execution: Test with real CLI
- File watching: Test with real file changes

### E2E Tests
- Open extension, verify dashboard loads
- Toggle task, verify file updated
- Create change, verify appears in list

## Performance Optimizations

1. **Lazy Loading**: Only load artifact content when viewed
2. **Caching**: Cache CLI output for 10 seconds
3. **Debouncing**: Debounce file watcher events (300ms)
4. **Virtual Scrolling**: For large lists (future)
5. **Optimistic Updates**: Update UI before file write completes

## Security Considerations

1. **Command Injection**: Never pass user input directly to CLI without validation
2. **Path Traversal**: Validate all file paths are within openspec/ directory
3. **XSS in Webview**: Sanitize markdown content before rendering
4. **Resource Limits**: Limit file sizes, timeout CLI commands

## Open Questions & Decisions

| Question | Status | Decision |
|----------|--------|----------|
| Bundle CLI with extension? | Decided | No, require separate install |
| State management library? | Decided | React Context (keep simple) |
| Markdown rendering library? | Pending | Evaluate marked vs markdown-it |
| Syntax highlighting? | Pending | Use VSCode's or Prism.js? |
| Task toggle: atomic or batched? | Decided | Atomic (immediate save) |

## Future Enhancements

**Phase 2:**
- Sidebar tree view
- Spec diff viewer
- Archive browser
- File navigation

**Phase 3:**
- Comment system
- AI integration
- Multi-language
- Keyboard shortcuts

## Conclusion

This design provides a solid foundation for the MVP while leaving room for future enhancements. The key architectural principles are:

- **Separation of Concerns**: Clear boundaries between CLI, file system, and UI
- **Extensibility**: Easy to add new commands and views
- **Performance**: Caching and debouncing for responsiveness
- **Reliability**: Error handling at every layer
- **Maintainability**: Simple state management, clear data flow

Next step: Create tasks.md to break down implementation into actionable items.
