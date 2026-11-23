import { Alchemy3DRenderer } from "./alchemy3DRenderer";
import type { LiveImpactState } from "./alchemyRenderer";
import { stageFromEth } from "./traits";
import { DEFAULT_CAUSES, complexityTierFromUsd } from "../web3/config";

export interface LabPortraitRequest {
  tokenId: number;
  seed: string;
  causeId: number;
  valueUsd: number;
  sectorsMask: number;
  workUnits: number;
  globalImpactEth: number;
  totalSupply: number;
  petLevel?: number;
}

const portraitCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string | null>>();

interface QueueEntry {
  key: string;
  req: LabPortraitRequest;
  resolve: (url: string | null) => void;
}

const renderQueue: QueueEntry[] = [];
let processing = false;
let webglUnavailable = false;
let sharedRenderer: Alchemy3DRenderer | null = null;
let sharedHost: HTMLDivElement | null = null;
let idleCleanupTimer: number | null = null;

export function getLabPortraitKey(req: LabPortraitRequest): string {
  const tier = complexityTierFromUsd(req.valueUsd);
  return `${req.seed}:${req.causeId}:${tier}:${req.sectorsMask}:${req.workUnits}:${req.petLevel ?? 1}`;
}

export function getCachedLabPortrait(req: LabPortraitRequest): string | null {
  return portraitCache.get(getLabPortraitKey(req)) ?? null;
}

function buildLiveImpactForPortrait(req: LabPortraitRequest): LiveImpactState {
  const tier = complexityTierFromUsd(req.valueUsd);
  const cause = DEFAULT_CAUSES[req.causeId % DEFAULT_CAUSES.length] || DEFAULT_CAUSES[0];
  return {
    seed: req.seed,
    tokenId: req.tokenId,
    causeId: req.causeId,
    causeName: cause.name,
    tokenValueUsd: req.valueUsd,
    complexityTier: tier,
    sectorsMask: req.sectorsMask,
    petLevel: req.petLevel ?? Math.max(1, Math.min(5, Math.floor(req.workUnits / 4) + 1)),
    workUnits: req.workUnits,
    tokenImpactEth: Math.max(0.004, req.valueUsd / 2600),
    causeImpactEth: Math.max(0.02, req.globalImpactEth * 0.35),
    globalImpactEth: Math.max(0.05, req.globalImpactEth),
    totalSupply: Math.max(1, req.totalSupply),
    maxSupply: 10000,
    reactionStage: stageFromEth(Math.max(0.05, req.globalImpactEth)),
    mode: "sepolia",
    lastPulseAt: 0
  };
}

function disposeSharedRenderer() {
  if (idleCleanupTimer !== null) {
    window.clearTimeout(idleCleanupTimer);
    idleCleanupTimer = null;
  }
  if (sharedRenderer) {
    try {
      sharedRenderer.stop();
    } catch {
      // ignore cleanup errors
    }
    sharedRenderer = null;
  }
  if (sharedHost && sharedHost.parentNode) {
    sharedHost.parentNode.removeChild(sharedHost);
  }
  sharedHost = null;
}

function scheduleIdleCleanup() {
  if (idleCleanupTimer !== null) window.clearTimeout(idleCleanupTimer);
  idleCleanupTimer = window.setTimeout(() => {
    if (!processing && renderQueue.length === 0) {
      disposeSharedRenderer();
    }
  }, 2600);
}

function ensureSharedRenderer(initialState: LiveImpactState): Alchemy3DRenderer | null {
  if (webglUnavailable || typeof document === "undefined") return null;
  if (sharedRenderer) return sharedRenderer;

  try {
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.position = "fixed";
    host.style.left = "-9999px";
    host.style.top = "-9999px";
    host.style.width = "560px";
    host.style.height = "560px";
    host.style.overflow = "hidden";
    host.style.pointerEvents = "none";
    host.style.visibility = "hidden";
    document.body.appendChild(host);
    sharedHost = host;

    sharedRenderer = new Alchemy3DRenderer(host, initialState, undefined, undefined, {
      staticPreview: true
    });
    return sharedRenderer;
  } catch {
    webglUnavailable = true;
    disposeSharedRenderer();
    return null;
  }
}

function drainQueue() {
  if (processing) return;
  const next = renderQueue.shift();
  if (!next) {
    scheduleIdleCleanup();
    return;
  }
  processing = true;
  if (idleCleanupTimer !== null) {
    window.clearTimeout(idleCleanupTimer);
    idleCleanupTimer = null;
  }

  const run = () => {
    let result: string | null = portraitCache.get(next.key) ?? null;
    if (!result && !webglUnavailable) {
      const impact = buildLiveImpactForPortrait(next.req);
      const renderer = ensureSharedRenderer(impact);
      if (renderer) {
        try {
          result = renderer.renderStaticPortrait(impact);
          if (result) {
            portraitCache.set(next.key, result);
          }
        } catch {
          webglUnavailable = true;
          disposeSharedRenderer();
          result = null;
        }
      }
    }

    inFlight.delete(next.key);
    next.resolve(result);
    processing = false;

    if (renderQueue.length > 0) {
      drainQueue();
    } else {
      scheduleIdleCleanup();
    }
  };

  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(run);
  } else {
    setTimeout(run, 0);
  }
}

export function requestLabPortrait(req: LabPortraitRequest): Promise<string | null> {
  const key = getLabPortraitKey(req);
  const cached = portraitCache.get(key);
  if (cached) return Promise.resolve(cached);
  if (webglUnavailable || typeof window === "undefined") return Promise.resolve(null);

  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = new Promise<string | null>((resolve) => {
    renderQueue.push({ key, req, resolve });
    drainQueue();
  });
  inFlight.set(key, promise);
  return promise;
}
