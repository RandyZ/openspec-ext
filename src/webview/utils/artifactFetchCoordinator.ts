export type ArtifactFetchCoordinatorOptions = {
  debounceMs?: number;
  isVisible?: () => boolean;
};

/** Coalesces artifact fetches: debounced scheduling, one in-flight request per key. */
export class ArtifactFetchCoordinator {
  private readonly debounceMs: number;
  private panelVisible = true;
  private readonly isDocumentVisible: () => boolean;
  private readonly inFlight = new Set<string>();
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pendingRuns = new Map<string, () => void>();
  private readonly dirtyKeys = new Set<string>();
  private readonly rerunAfterComplete = new Set<string>();

  constructor(options: ArtifactFetchCoordinatorOptions = {}) {
    this.debounceMs = options.debounceMs ?? 400;
    this.isDocumentVisible = options.isVisible ?? (() =>
      typeof document === 'undefined' || document.visibilityState !== 'hidden');
  }

  setPanelVisible(visible: boolean): void {
    this.panelVisible = visible;
    if (visible) {
      this.flushDirtyKeys();
    }
  }

  private isVisible(): boolean {
    return this.panelVisible && this.isDocumentVisible();
  }

  get hasInFlight(): boolean {
    return this.inFlight.size > 0;
  }

  isInFlight(key: string): boolean {
    return this.inFlight.has(key);
  }

  isDirty(key: string): boolean {
    return this.dirtyKeys.has(key);
  }

  schedule(key: string, run: () => void): void {
    this.pendingRuns.set(key, run);
    if (!this.isVisible()) {
      this.dirtyKeys.add(key);
      return;
    }
    const existing = this.debounceTimers.get(key);
    if (existing) clearTimeout(existing);
    this.debounceTimers.set(
      key,
      setTimeout(() => {
        this.debounceTimers.delete(key);
        this.startRun(key);
      }, this.debounceMs),
    );
  }

  private startRun(key: string): void {
    if (!this.isVisible()) {
      this.dirtyKeys.add(key);
      return;
    }
    if (this.inFlight.has(key)) {
      this.rerunAfterComplete.add(key);
      return;
    }
    const run = this.pendingRuns.get(key);
    if (!run) return;
    this.inFlight.add(key);
    run();
  }

  private flushDirtyKeys(): void {
    for (const key of Array.from(this.dirtyKeys)) {
      this.dirtyKeys.delete(key);
      const existing = this.debounceTimers.get(key);
      if (existing) clearTimeout(existing);
      this.debounceTimers.set(
        key,
        setTimeout(() => {
          this.debounceTimers.delete(key);
          this.startRun(key);
        }, this.debounceMs),
      );
    }
  }

  complete(key: string): void {
    this.inFlight.delete(key);
    if (this.rerunAfterComplete.has(key)) {
      this.rerunAfterComplete.delete(key);
      this.startRun(key);
    }
  }

  reset(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.inFlight.clear();
    this.dirtyKeys.clear();
    this.rerunAfterComplete.clear();
    this.pendingRuns.clear();
  }
}
