import { ResearchComputeEngine, type ComputeSnapshot } from "./researchCompute";

/**
 * Off-main-thread Open-Science Compute Runner.
 * Uses a dedicated Web Worker for 4-replica Parallel Tempering protein folding so WebGL
 * stays locked at 60fps even on 36-residue Villin HP36, with automatic synchronous fallback.
 */
export class ResearchComputeRunner {
  private worker: Worker | null = null;
  private fallback: ResearchComputeEngine | null = null;
  private latestSnapshot: ComputeSnapshot;
  private active = true;
  private inFlight = false;
  private onDiscovery?: (snap: ComputeSnapshot) => void;
  private onSnapshot?: (snap: ComputeSnapshot) => void;

  constructor(
    seedHex: string,
    causeId: number,
    tokenId: number,
    onDiscovery?: (snap: ComputeSnapshot) => void,
    onSnapshot?: (snap: ComputeSnapshot) => void
  ) {
    this.onDiscovery = onDiscovery;
    this.onSnapshot = onSnapshot;

    // Build an immediate initial snapshot synchronously so the 3D scene has residue coordinates on frame 0
    const bootstrap = new ResearchComputeEngine(seedHex, causeId, undefined, tokenId);
    this.latestSnapshot = bootstrap.getSnapshot();

    if (typeof Worker !== "undefined") {
      try {
        this.worker = new Worker(new URL("./researchWorker.ts", import.meta.url), {
          type: "module"
        });
        this.worker.onmessage = (event: MessageEvent<{ type: string; snapshot: ComputeSnapshot; discovered: boolean }>) => {
          this.inFlight = false;
          const data = event.data;
          if (!data || data.type !== "snapshot") return;
          this.latestSnapshot = data.snapshot;
          this.onSnapshot?.(data.snapshot);
          if (data.discovered) {
            this.onDiscovery?.(data.snapshot);
          }
        };
        this.worker.onerror = () => {
          this.worker?.terminate();
          this.worker = null;
          this.fallback = bootstrap;
        };
        this.worker.postMessage({ type: "init", seedHex, causeId, tokenId });
        return;
      } catch {
        this.worker = null;
      }
    }

    this.fallback = bootstrap;
  }

  public isActive(): boolean {
    return this.active;
  }

  public setActive(enabled: boolean) {
    this.active = enabled;
    if (this.worker) {
      this.worker.postMessage({ type: "active", active: enabled });
    } else if (this.fallback) {
      this.fallback.setActive(enabled);
      this.latestSnapshot = this.fallback.getSnapshot();
      this.onSnapshot?.(this.latestSnapshot);
    }
  }

  public reseed(seedHex: string, causeId: number, tokenId: number) {
    if (this.worker) {
      this.inFlight = false;
      this.worker.postMessage({ type: "reseed", seedHex, causeId, tokenId });
      // Also update immediate local coords so 3D protein switches instantaneously
      const quick = new ResearchComputeEngine(seedHex, causeId, undefined, tokenId);
      this.latestSnapshot = quick.getSnapshot();
    } else if (this.fallback) {
      this.fallback.reseed(seedHex, causeId, tokenId);
      this.latestSnapshot = this.fallback.getSnapshot();
    }
  }

  public selectBenchmark(benchmarkIndex: number) {
    if (this.worker) {
      this.inFlight = false;
      this.worker.postMessage({ type: "benchmark", benchmarkIndex });
    } else if (this.fallback) {
      this.fallback.selectBenchmark(benchmarkIndex);
      this.latestSnapshot = this.fallback.getSnapshot();
      this.onSnapshot?.(this.latestSnapshot);
    }
  }

  public triggerFoldAction(action: "wiggle" | "shake" | "bury") {
    if (this.worker) {
      this.inFlight = false;
      this.worker.postMessage({ type: action });
    } else if (this.fallback) {
      const discovered =
        action === "wiggle"
          ? this.fallback.wigglePolish()
          : action === "bury"
            ? this.fallback.buryCore()
            : this.fallback.shakePerturb();
      this.latestSnapshot = this.fallback.getSnapshot();
      this.onSnapshot?.(this.latestSnapshot);
      if (discovered) this.onDiscovery?.(this.latestSnapshot);
    }
  }

  public requestStep(iterations: number) {
    if (!this.active) return;
    if (this.worker) {
      if (this.inFlight) return;
      this.inFlight = true;
      this.worker.postMessage({ type: "step", iterations });
    } else if (this.fallback) {
      const discovered = this.fallback.stepCompute(iterations);
      this.latestSnapshot = this.fallback.getSnapshot();
      if (discovered) this.onDiscovery?.(this.latestSnapshot);
    }
  }

  public getSnapshot(): ComputeSnapshot {
    return this.latestSnapshot;
  }

  public dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.fallback = null;
  }
}
