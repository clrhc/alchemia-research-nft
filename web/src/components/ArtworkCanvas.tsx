import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { Cpu, Move3d, Pause, Play } from "lucide-react";
import {
  Alchemy3DRenderer,
  type AtmosphereMode,
  type CameraPreset,
  type InteractiveEvent,
  type LightingMood
} from "../engine/alchemy3DRenderer";
import { type LiveImpactState } from "../engine/alchemyRenderer";
import type { ComputeSnapshot } from "../engine/researchCompute";
import type { TamagotchiAction } from "../engine/tamagotchi";

export interface ArtworkCanvasHandle {
  capturePhoto: () => string | null;
}

interface ArtworkCanvasProps {
  impact: LiveImpactState;
  showHud?: boolean;
  compact?: boolean;
  cameraPreset?: { preset: CameraPreset; seq: number } | null;
  tamagotchiSignal?: { action: TamagotchiAction; seq: number } | null;
  previewSectorId?: number | null;
  lightingMood?: LightingMood;
  atmosphereMode?: AtmosphereMode;
  highlightedResidueIdx?: number | null;
  benchmarkIndex?: number | null;
  foldSignal?: { action: "wiggle" | "shake" | "bury"; seq: number } | null;
  onComputeSnapshot?: (snap: ComputeSnapshot) => void;
  onInteractiveEvent?: (ev: InteractiveEvent) => void;
  onPulseClick?: () => void;
}

export const ArtworkCanvas = forwardRef<ArtworkCanvasHandle, ArtworkCanvasProps>(function ArtworkCanvas(
  {
    impact,
    showHud = false,
    compact = false,
    cameraPreset = null,
    tamagotchiSignal = null,
    previewSectorId = null,
    lightingMood = "daylight",
    atmosphereMode = "clear",
    highlightedResidueIdx = null,
    benchmarkIndex = null,
    foldSignal = null,
    onComputeSnapshot,
    onInteractiveEvent,
    onPulseClick
  },
  ref
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Alchemy3DRenderer | null>(null);
  const onComputeRef = useRef(onComputeSnapshot);
  onComputeRef.current = onComputeSnapshot;
  const onInteractRef = useRef(onInteractiveEvent);
  onInteractRef.current = onInteractiveEvent;

  useImperativeHandle(ref, () => ({
    capturePhoto: () => rendererRef.current?.captureSnapshotDataUrl() ?? null
  }));

  const [computeSnap, setComputeSnap] = useState<ComputeSnapshot | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new Alchemy3DRenderer(
      host,
      impact,
      (snap) => {
        setComputeSnap(snap);
        onComputeRef.current?.(snap);
      },
      (ev) => {
        onInteractRef.current?.(ev);
      }
    );
    rendererRef.current = renderer;
    renderer.setLightingMood(lightingMood);
    renderer.setAtmosphereMode(atmosphereMode);
    renderer.start();

    const observer = new ResizeObserver(() => renderer.resize());
    observer.observe(host);

    return () => {
      observer.disconnect();
      renderer.stop();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    rendererRef.current?.updateState(impact);
  }, [
    impact.seed,
    impact.tokenId,
    impact.causeId,
    impact.causeName,
    impact.tokenValueUsd,
    impact.complexityTier,
    impact.sectorsMask,
    impact.petLevel,
    impact.petMoodScore,
    impact.petAccessory,
    impact.petSleeping,
    impact.workUnits,
    impact.tokenImpactEth,
    impact.causeImpactEth,
    impact.globalImpactEth,
    impact.totalSupply,
    impact.maxSupply,
    impact.reactionStage,
    impact.lastPulseAt
  ]);

  useEffect(() => {
    if (tamagotchiSignal && tamagotchiSignal.seq > 0) {
      rendererRef.current?.triggerTamagotchiReaction(tamagotchiSignal.action);
    }
  }, [tamagotchiSignal]);

  useEffect(() => {
    if (cameraPreset && cameraPreset.seq > 0) {
      rendererRef.current?.setCameraPreset(cameraPreset.preset);
    }
  }, [cameraPreset]);

  useEffect(() => {
    rendererRef.current?.setPreviewSector(previewSectorId);
  }, [previewSectorId]);

  useEffect(() => {
    rendererRef.current?.setLightingMood(lightingMood);
  }, [lightingMood]);

  useEffect(() => {
    rendererRef.current?.setAtmosphereMode(atmosphereMode);
  }, [atmosphereMode]);

  useEffect(() => {
    rendererRef.current?.setHighlightedResidue(highlightedResidueIdx);
  }, [highlightedResidueIdx]);

  useEffect(() => {
    if (benchmarkIndex !== null && benchmarkIndex >= 0) {
      rendererRef.current?.selectBenchmark(benchmarkIndex);
    }
  }, [benchmarkIndex]);

  useEffect(() => {
    if (foldSignal && foldSignal.seq > 0) {
      rendererRef.current?.triggerFoldAction(foldSignal.action);
    }
  }, [foldSignal]);

  const toggleCompute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextActive = !(computeSnap?.active ?? true);
    rendererRef.current?.setComputeActive(nextActive);
  };

  return (
    <div
      className="artwork-frame"
      onDoubleClick={() => {
        rendererRef.current?.resetCamera();
        rendererRef.current?.triggerCatalyticPulse(0.95);
        onPulseClick?.();
      }}
    >
      <div ref={hostRef} className="artwork-canvas" />

      {showHud && (
        <>
          <div className="art-hud-top">
            <button
              type="button"
              className="art-hud-badge clickable"
              onClick={toggleCompute}
              style={{ cursor: "pointer" }}
            >
              <span
                className="live-dot"
                style={{
                  background: computeSnap?.active === false ? "#94a3b8" : "#10b981",
                  animation: computeSnap?.active === false ? "none" : undefined
                }}
              />
              <Cpu size={11} />
              {computeSnap?.active === false
                ? "Paused"
                : `${computeSnap?.pdbBenchmarkId || "1L2Y"} · ${computeSnap?.discoveries ?? 0} ${
                    computeSnap?.discoveries === 1 ? "fold" : "folds"
                  }`}
              {computeSnap?.active === false ? <Play size={10} /> : <Pause size={10} />}
            </button>

            <span className="art-hud-badge">
              <Move3d size={11} />
              {compact ? (
                `Level ${impact.complexityTier}`
              ) : (
                <>
                  <span className="hud-desktop-only">Drag to spin · </span>
                  Level {impact.complexityTier}
                </>
              )}
            </span>
          </div>

          {!compact && (
            <div className="art-hud-bottom">
              <div>
                <div style={{ fontWeight: 600, color: "#1a1f2c", fontSize: "0.78rem" }}>
                  {computeSnap?.taskTitle || "Trp-cage Mini-Protein (1L2Y)"}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.68rem",
                    color: "#5a6478",
                    marginTop: 2
                  }}
                >
                  {computeSnap
                    ? `${computeSnap.bestEnergy.toFixed(1)} kcal/mol · Rg ${computeSnap.radiusOfGyration.toFixed(1)}Å (${computeSnap.compactnessMatchPct}% fit)`
                    : "Folding 3D protein chain…"}
                </div>
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.7rem",
                  color: "#334155",
                  textAlign: "right",
                  flexShrink: 0
                }}
              >
                {impact.globalImpactEth.toFixed(3)} ETH
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});
