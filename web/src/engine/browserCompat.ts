import * as THREE from "three";

export type PerfTier = "high" | "balanced" | "mobile";

export interface DevicePerfProfile {
  tier: PerfTier;
  maxPixelRatio: number;
  minPixelRatio: number;
  shadowMapSize: number;
  enableShadows: boolean;
  enableHeroTransmission: boolean;
  antialias: boolean;
  maxTrafficVehicles: number;
  maxNpcResearchers: number;
  maxDetailPlaques: number;
  telemetryIntervalMs: number;
  hoverRaycastIntervalMs: number;
  reducedMotion: boolean;
}

let polyfillsInstalled = false;

/**
 * Installs lightweight cross-browser polyfills so Canvas2D textures & UI work identically
 * across Chrome, Firefox, Edge, Safari 14+, iOS WebKit, Android Chrome, and wallet WebViews.
 */
export function installBrowserCompatPolyfills(): void {
  if (polyfillsInstalled) return;
  polyfillsInstalled = true;

  if (typeof CanvasRenderingContext2D === "undefined") return;
  const proto = CanvasRenderingContext2D.prototype as CanvasRenderingContext2D & {
    roundRect?: (
      x: number,
      y: number,
      w: number,
      h: number,
      radii?: number | DOMPointInit | Iterable<number | DOMPointInit>
    ) => void;
  };
  if (typeof proto.roundRect === "function") return;

  proto.roundRect = function (
    x: number,
    y: number,
    w: number,
    h: number,
    radii: number | DOMPointInit | Iterable<number | DOMPointInit> = 0
  ) {
    const parseRadius = (r: number | DOMPointInit | undefined): number => {
      if (typeof r === "number") return Math.max(0, r);
      if (r && typeof r.x === "number") return Math.max(0, r.x);
      return 0;
    };
    let tl = 0;
    let tr = 0;
    let br = 0;
    let bl = 0;
    if (typeof radii === "number" || (radii && !Symbol.iterator && typeof radii === "object")) {
      const r = parseRadius(radii as number | DOMPointInit);
      tl = tr = br = bl = r;
    } else if (radii && typeof (radii as Iterable<number | DOMPointInit>)[Symbol.iterator] === "function") {
      const arr = Array.from(radii as Iterable<number | DOMPointInit>).map(parseRadius);
      if (arr.length === 1) {
        tl = tr = br = bl = arr[0];
      } else if (arr.length === 2) {
        tl = br = arr[0];
        tr = bl = arr[1];
      } else if (arr.length === 3) {
        tl = arr[0];
        tr = bl = arr[1];
        br = arr[2];
      } else if (arr.length >= 4) {
        [tl, tr, br, bl] = arr;
      }
    }
    const maxR = Math.min(Math.abs(w) * 0.5, Math.abs(h) * 0.5);
    tl = Math.min(tl, maxR);
    tr = Math.min(tr, maxR);
    br = Math.min(br, maxR);
    bl = Math.min(bl, maxR);

    this.moveTo(x + tl, y);
    this.lineTo(x + w - tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + tr);
    this.lineTo(x + w, y + h - br);
    this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    this.lineTo(x + bl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - bl);
    this.lineTo(x, y + tl);
    this.quadraticCurveTo(x, y, x + tl, y);
    this.closePath();
  };
}

/**
 * Classifies the current browser & device hardware into an optimal 3D performance tier
 * so ALCHEMIA runs smoothly on iPhones, Androids, iPads, Safari, Firefox, laptops & desktops.
 */
export function detectDevicePerfProfile(overrides?: {
  userAgent?: string;
  cores?: number;
  deviceMemory?: number;
  coarsePointer?: boolean;
  screenWidth?: number;
  reducedMotion?: boolean;
}): DevicePerfProfile {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const win = typeof window !== "undefined" ? window : undefined;

  const ua = overrides?.userAgent ?? nav?.userAgent ?? "";
  const cores = overrides?.cores ?? nav?.hardwareConcurrency ?? 8;
  const mem =
    overrides?.deviceMemory ??
    ((nav as unknown as { deviceMemory?: number } | undefined)?.deviceMemory ?? 8);
  const coarsePointer =
    overrides?.coarsePointer ??
    Boolean(win?.matchMedia?.("(pointer: coarse)")?.matches);
  const screenWidth = overrides?.screenWidth ?? (win?.innerWidth || 1280);
  const reducedMotion =
    overrides?.reducedMotion ??
    Boolean(win?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

  const isMobileUA = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua);
  const isFirefox = /Firefox/i.test(ua);
  const isMobile = isMobileUA || (coarsePointer && screenWidth <= 920);
  const isLowEndMobile = isMobile && (cores <= 4 || mem <= 3);

  if (isMobile) {
    return {
      tier: "mobile",
      maxPixelRatio: isLowEndMobile ? 1.15 : 1.4,
      minPixelRatio: 0.85,
      shadowMapSize: 512,
      enableShadows: !isLowEndMobile,
      enableHeroTransmission: false,
      antialias: !isLowEndMobile,
      maxTrafficVehicles: isLowEndMobile ? 4 : 6,
      maxNpcResearchers: isLowEndMobile ? 4 : 6,
      maxDetailPlaques: 24,
      telemetryIntervalMs: 64,
      hoverRaycastIntervalMs: 90,
      reducedMotion
    };
  }

  if (isSafari || isFirefox || cores <= 4 || mem <= 4) {
    return {
      tier: "balanced",
      maxPixelRatio: 1.65,
      minPixelRatio: 1.0,
      shadowMapSize: 1024,
      enableShadows: true,
      enableHeroTransmission: !isSafari,
      antialias: true,
      maxTrafficVehicles: 9,
      maxNpcResearchers: 8,
      maxDetailPlaques: 40,
      telemetryIntervalMs: 40,
      hoverRaycastIntervalMs: 48,
      reducedMotion
    };
  }

  return {
    tier: "high",
    maxPixelRatio: 2.0,
    minPixelRatio: 1.0,
    shadowMapSize: 1024,
    enableShadows: true,
    enableHeroTransmission: true,
    antialias: true,
    maxTrafficVehicles: 12,
    maxNpcResearchers: 10,
    maxDetailPlaques: 56,
    telemetryIntervalMs: 32,
    hoverRaycastIntervalMs: 40,
    reducedMotion
  };
}

/**
 * Automatic rolling-average DPR controller that silently protects 60fps smoothness on any GPU
 * by gently trimming render resolution under sustained heavy frames and restoring when headroom returns.
 */
export class AdaptivePixelRatioController {
  private currentDpr: number;
  private readonly minDpr: number;
  private readonly maxDpr: number;
  private emaMs = 16.6;
  private lowFpsAccum = 0;
  private highFpsAccum = 0;

  constructor(nativeDpr: number, minDpr: number, maxDpr: number) {
    this.minDpr = Math.max(0.75, minDpr);
    this.maxDpr = Math.max(this.minDpr, Math.min(nativeDpr || 1, maxDpr));
    this.currentDpr = this.maxDpr;
  }

  public getPixelRatio(): number {
    return this.currentDpr;
  }

  /**
   * Feeds a frame delta (seconds). Returns the new pixel ratio ONLY when an adjustment is needed.
   */
  public recordFrame(dtSec: number): number | null {
    if (!Number.isFinite(dtSec) || dtSec <= 0 || dtSec > 0.25) return null;
    const ms = dtSec * 1000;
    this.emaMs = this.emaMs * 0.92 + ms * 0.08;

    if (this.emaMs > 26.5) {
      this.lowFpsAccum += dtSec;
      this.highFpsAccum = 0;
      if (this.lowFpsAccum >= 2.2 && this.currentDpr > this.minDpr + 0.01) {
        this.lowFpsAccum = 0;
        this.currentDpr = Math.max(this.minDpr, Number((this.currentDpr - 0.15).toFixed(2)));
        return this.currentDpr;
      }
    } else if (this.emaMs < 17.8) {
      this.highFpsAccum += dtSec;
      this.lowFpsAccum = 0;
      if (this.highFpsAccum >= 4.5 && this.currentDpr < this.maxDpr - 0.01) {
        this.highFpsAccum = 0;
        this.currentDpr = Math.min(this.maxDpr, Number((this.currentDpr + 0.1).toFixed(2)));
        return this.currentDpr;
      }
    } else {
      this.lowFpsAccum = Math.max(0, this.lowFpsAccum - dtSec * 0.5);
      this.highFpsAccum = Math.max(0, this.highFpsAccum - dtSec * 0.5);
    }
    return null;
  }
}

/**
 * Creates a crisp reflective architectural glass material that uses ZERO extra full-scene
 * WebGL transmission render passes — dramatically faster on Safari, Firefox, Mobile & iGPUs!
 */
export function createFastArchitecturalGlass(opts?: {
  color?: string;
  opacity?: number;
  roughness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  side?: THREE.Side;
}): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: opts?.color ?? "#e8f3ff",
    emissive: opts?.emissive ?? "#000000",
    emissiveIntensity: opts?.emissiveIntensity ?? 0,
    roughness: opts?.roughness ?? 0.08,
    metalness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.45,
    transparent: true,
    opacity: opts?.opacity ?? 0.54,
    depthWrite: false,
    side: opts?.side ?? THREE.FrontSide
  });
}
