import { useEffect, useRef, useState } from "react";
import { Cpu, Move3d, Pause, Play } from "lucide-react";
import { Alchemy3DRenderer } from "../engine/alchemy3DRenderer";
import { type LiveImpactState } from "../engine/alchemyRenderer";
import type { ComputeSnapshot } from "../engine/researchCompute";
import type { TamagotchiAction } from "../engine/tamagotchi";

interface ArtworkCanvasProps {
  impact: LiveImpactState;
  showHud?: boolean;
  compact?: boolean;
  tamagotchiSignal?: { action: TamagotchiAction; seq: number } | null;
  onComputeSnapshot?: (snap: ComputeSnapshot) => void;
  onPulseClick?: () => void;
}

export function ArtworkCanvas({
  impact,
  showHud = false,
  compact = false,
  tamagotchiSignal = null,
  onComputeSnapshot,
  onPulseClick
}: ArtworkCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Alchemy3DRenderer | null>(null);
  const onComputeRef = useRef(onComputeSnapshot);
  onComputeRef.current = onComputeSnapshot;
  const [computeSnap, setComputeSnap] = useState<ComputeSnapshot | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new Alchemy3DRenderer(host, impact, (snap) => {
      setComputeSnap(snap);
      onComputeRef.current?.(snap);
    });
    rendererRef.current = renderer;
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
                : `Folding · ${computeSnap?.discoveries ?? 0} finds`}
              {computeSnap?.active === false ? <Play size={10} /> : <Pause size={10} />}
            </button>

            <span className="art-hud-badge">
              <Move3d size={11} />
              {compact
                ? `Tier ${impact.complexityTier}`
                : `Drag 3D · Tier ${impact.complexityTier}`}
            </span>
          </div>

          {!compact && (
            <div className="art-hud-bottom">
              <div>
                <div style={{ fontWeight: 600, color: "#1a1f2c", fontSize: "0.78rem" }}>
                  {computeSnap?.taskTitle || "3D AB-Model Protein Fold"} · WU #
                  {computeSnap?.workUnitsCompleted ?? 0}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.68rem",
                    color: "#5a6478",
                    marginTop: 2
                  }}
                >
                  {computeSnap?.lastDiscoveryLabel || "Annealing 3D molecular conformation…"}
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
}
