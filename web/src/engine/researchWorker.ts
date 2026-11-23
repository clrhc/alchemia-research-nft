/// <reference lib="webworker" />
import { ResearchComputeEngine, type ComputeSnapshot } from "./researchCompute";

type WorkerInMessage =
  | { type: "init"; seedHex: string; causeId: number; tokenId: number; benchmarkIndex?: number }
  | { type: "reseed"; seedHex: string; causeId: number; tokenId: number }
  | { type: "benchmark"; benchmarkIndex: number }
  | { type: "active"; active: boolean }
  | { type: "step"; iterations: number };

type WorkerOutMessage = {
  type: "snapshot";
  snapshot: ComputeSnapshot;
  discovered: boolean;
};

let engine: ResearchComputeEngine | null = null;

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;
  if (!msg) return;

  if (msg.type === "init") {
    engine = new ResearchComputeEngine(msg.seedHex, msg.causeId, undefined, msg.tokenId);
    if (typeof msg.benchmarkIndex === "number") {
      engine.selectBenchmark(msg.benchmarkIndex);
    }
    const out: WorkerOutMessage = {
      type: "snapshot",
      snapshot: engine.getSnapshot(),
      discovered: false
    };
    self.postMessage(out);
    return;
  }

  if (!engine) return;

  if (msg.type === "reseed") {
    engine.reseed(msg.seedHex, msg.causeId, msg.tokenId);
    self.postMessage({
      type: "snapshot",
      snapshot: engine.getSnapshot(),
      discovered: false
    } satisfies WorkerOutMessage);
  } else if (msg.type === "benchmark") {
    engine.selectBenchmark(msg.benchmarkIndex);
    self.postMessage({
      type: "snapshot",
      snapshot: engine.getSnapshot(),
      discovered: false
    } satisfies WorkerOutMessage);
  } else if (msg.type === "active") {
    engine.setActive(msg.active);
    self.postMessage({
      type: "snapshot",
      snapshot: engine.getSnapshot(),
      discovered: false
    } satisfies WorkerOutMessage);
  } else if (msg.type === "step") {
    const discovered = engine.stepCompute(msg.iterations);
    self.postMessage({
      type: "snapshot",
      snapshot: engine.getSnapshot(),
      discovered
    } satisfies WorkerOutMessage);
  }
};
