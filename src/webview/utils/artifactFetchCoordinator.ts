export type ArtifactFetchCoordinatorOptions = {
  debounceMs?: number;
  isVisible?: () => boolean;
};

/** Coalesces artifact fetches: debounced scheduling, one in-flight request per key. */
export class ArtifactFetchCoordinator {
  private readonly debounceMs: number;
  private readonly isVisible: () => boolean;
  private readonly inFlight = new Set<string>();
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(options: ArtifactFetchCoordinatorOptions = {}) {
    this.debounceMs = options.debounceMs ?? 400;
    this.isVisible = options.isVisible ?? (() =>
      typeof document === 'undefined' || document.visibilityState !== 'hidden');
  }

  get hasInFlight(): boolean {
    return this.inFlight.size > 0;
  }

  isInFlight(key: string): boolean {
    return this.inFlight.has(key);
  }

  schedule(key: string, run: () => void): void {
    if (!this.isVisible()) return;
    const existing = this.debounceTimers.get(key);
    if (existing) clearTimeout(existing);
    this.debounceTimers.set(
      key,
      setTimeout(() => {
        this.debounceTimers.delete(key);
        if (!this.isVisible() || this.inFlight.has(key)) return;
        this.inFlight.add(key);
        run();
      }, this.debounceMs),
    );
  }

  complete(key: string): void {
    this.inFlight.delete(key);
  }

  reset(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.inFlight.clear();
  }
}
