import * as vscode from 'vscode';
import { logger } from '../utils/logger';

export type FileChangeEventType = 'create' | 'change' | 'delete';

export interface FileChangeEvent {
  type: FileChangeEventType;
  uri: vscode.Uri;
  timestamp: number;
}

export class FileWatcherService {
  private watchers: vscode.FileSystemWatcher[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private pendingEvents: FileChangeEvent[] = [];
  private changeCallback: ((events: FileChangeEvent[]) => void) | null = null;

  constructor(
    private workspaceRoot: string,
    private debounceMs: number = 300
  ) {}

  /**
   * Start watching OpenSpec files
   */
  start(callback: (events: FileChangeEvent[]) => void): void {
    this.changeCallback = callback;

    // Watch markdown files
    const mdWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.workspaceRoot, 'openspec/**/*.md')
    );

    // Watch YAML files
    const yamlWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.workspaceRoot, 'openspec/**/*.yaml')
    );

    // Setup event handlers for both watchers
    [mdWatcher, yamlWatcher].forEach((watcher) => {
      watcher.onDidCreate((uri) => this.handleFileEvent('create', uri));
      watcher.onDidChange((uri) => this.handleFileEvent('change', uri));
      watcher.onDidDelete((uri) => this.handleFileEvent('delete', uri));
    });

    this.watchers.push(mdWatcher, yamlWatcher);
    logger.info('File watcher started');
  }

  /**
   * Stop watching files
   */
  stop(): void {
    this.watchers.forEach((watcher) => watcher.dispose());
    this.watchers = [];

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    logger.info('File watcher stopped');
  }

  /**
   * Handle file system events with debouncing
   */
  private handleFileEvent(type: FileChangeEventType, uri: vscode.Uri): void {
    this.pendingEvents.push({
      type,
      uri,
      timestamp: Date.now(),
    });

    logger.debug(`File ${type}: ${uri.fsPath}`);

    // Debounce: wait for events to settle before notifying
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flushEvents();
    }, this.debounceMs);
  }

  /**
   * Flush pending events and notify callback
   */
  private flushEvents(): void {
    if (this.pendingEvents.length === 0 || !this.changeCallback) {
      return;
    }

    const events = [...this.pendingEvents];
    this.pendingEvents = [];

    logger.info(`Processing ${events.length} file change event(s)`);
    this.changeCallback(events);
  }

  /**
   * Get pending event count (for testing)
   */
  getPendingEventCount(): number {
    return this.pendingEvents.length;
  }
}
