import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { Cpu, Move3d, Pause, Play } from "lucide-react";
import {
  Alchemy3DRenderer,
  type AtmosphereMode,
  type CameraMode,
  type CameraPreset,
  type CreatorFocusZone,
  type InteractiveEvent,
  type LightingMood,
  type SimsActionRequest,
  type WalkFrameTelemetry
} from "../engine/alchemy3DRenderer";
import { type LiveImpactState } from "../engine/alchemyRenderer";
import type { MoodBubbleKind } from "../engine/architectTextures";
import type { CharacterEmote } from "../engine/character3D";
import type { CharacterProfile } from "../engine/characterConfig";
import type { DiegeticMonitorTelemetry } from "../engine/diegeticPanels3D";
import type { GardenWorldState } from "../engine/gardenState";
import type { FloorNumber, MovableItemId } from "../engine/homeLayout";
import type { LabStationId } from "../engine/labStations";
import type { NeighborLabSummary } from "../engine/neighborhoodLayout";
import { deriveTraitsFromSeed } from "../engine/prng";
import type { ComputeSnapshot } from "../engine/researchCompute";
import type { LabDecorConfig, SimsObjectTarget } from "../engine/simsState";
import type { TamagotchiAction } from "../engine/tamagotchi";
import { LabThumbnailSvg } from "./LabThumbnailSvg";

export interface ArtworkCanvasHandle {
  capturePhoto: () => string | null;
  walkToStation: (stationId: LabStationId) => void;
  walkToNeighbor: (tokenId: number) => void;
  returnHome: () => void;
  setMoveInput: (dx: number, dz: number, sprint?: boolean) => void;
  triggerEmote: (emote: CharacterEmote) => void;
  setComputeActive: (active: boolean) => void;
  updateMonitorTelemetry: (data: DiegeticMonitorTelemetry) => void;
  flipCreatorView: (back: boolean) => void;
  performSimsAction: (req: SimsActionRequest) => void;
  getSimsFurnitureAnchor: (kind: "bench" | "espresso" | "microscope" | "harvester" | "hobby") => {
    x: number;
    z: number;
    yaw: number;
    floor: FloorNumber;
  };
  setActiveFloor: (floor: FloorNumber) => void;
  setMovingItem: (itemId: MovableItemId | null, snapGrid?: boolean) => void;
  waterGardenPlotFX: (plotId: string) => void;
  walkToPark: (parkId: string) => void;
  fireSocialBeamToNeighbor: (tokenId: number, colorHex?: string) => void;
  triggerVehicleHonk: (vehicleId: string) => void;
  triggerCatalyticPulse: (intensity?: number) => void;
  arriveAtFrontDoor: () => void;
  triggerHostReaction: (emote: CharacterEmote, bubble?: MoodBubbleKind) => void;
  syncNeighborNpcStatus: (
    tokenId: number,
    moodName: string,
    plumbobHex: string,
    tierLabel?: string,
    emote?: CharacterEmote,
    bubble?: MoodBubbleKind
  ) => void;
}

interface ArtworkCanvasProps {
  impact: LiveImpactState;
  showHud?: boolean;
  compact?: boolean;
  fillContainer?: boolean;
  walkMode?: boolean;
  characterProfile?: CharacterProfile | null;
  visitingHost?: {
    profile: CharacterProfile;
    tokenId: number;
    moodName?: string;
    plumbobHex?: string;
    tierLabel?: string;
  } | null;
  characterEmoteSignal?: { emote: CharacterEmote; seq: number } | null;
  creatorCameraMode?: boolean;
  creatorFocusZone?: CreatorFocusZone;
  creatorTurntable?: boolean;
  cameraMode?: CameraMode;
  activeStationHighlight?: LabStationId | null;
  neighbors?: NeighborLabSummary[];
  labDecor?: LabDecorConfig;
  gardenState?: GardenWorldState;
  activeFloor?: FloorNumber;
  movingItem?: MovableItemId | null;
  moveSnapGrid?: boolean;
  plumbobColor?: string;
  playerMoodName?: string;
  controlsEnabled?: boolean;
  cameraPreset?: { preset: CameraPreset; seq: number } | null;
  tamagotchiSignal?: { action: TamagotchiAction; seq: number } | null;
  previewSectorId?: number | null;
  lightingMood?: LightingMood;
  atmosphereMode?: AtmosphereMode;
  highlightedResidueIdx?: number | null;
  showBestFold?: boolean;
  autoRotate?: boolean;
  benchmarkIndex?: number | null;
  foldSignal?: { action: "wiggle" | "shake" | "bury"; seq: number } | null;
  onComputeSnapshot?: (snap: ComputeSnapshot) => void;
  onInteractiveEvent?: (ev: InteractiveEvent) => void;
  onWalkTelemetry?: (telemetry: WalkFrameTelemetry) => void;
  onNearStationChange?: (stationId: LabStationId | null) => void;
  onStationArrived?: (stationId: LabStationId) => void;
  onSimsObjectClick?: (target: SimsObjectTarget, screenX: number, screenY: number) => void;
  onPlaceMovedItem?: (itemId: MovableItemId, x: number, z: number, floor: FloorNumber) => void;
  onActiveFloorChange?: (floor: FloorNumber) => void;
  onPulseClick?: () => void;
}

export const ArtworkCanvas = forwardRef<ArtworkCanvasHandle, ArtworkCanvasProps>(function ArtworkCanvas(
  {
    impact,
    showHud = false,
    compact = false,
    fillContainer = false,
    walkMode = false,
    characterProfile = null,
    visitingHost = null,
    characterEmoteSignal = null,
    creatorCameraMode = false,
    creatorFocusZone = "full",
    creatorTurntable = false,
    cameraMode = "follow",
    activeStationHighlight = null,
    neighbors,
    labDecor,
    gardenState,
    activeFloor = 1,
    movingItem = null,
    moveSnapGrid = true,
    plumbobColor = "#10b981",
    playerMoodName = "Inspired",
    controlsEnabled = true,
    cameraPreset = null,
    tamagotchiSignal = null,
    previewSectorId = null,
    lightingMood = "daylight",
    atmosphereMode = "clear",
    highlightedResidueIdx = null,
    showBestFold = true,
    autoRotate,
    benchmarkIndex = null,
    foldSignal = null,
    onComputeSnapshot,
    onInteractiveEvent,
    onWalkTelemetry,
    onNearStationChange,
    onStationArrived,
    onSimsObjectClick,
    onPlaceMovedItem,
    onActiveFloorChange,
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
  const onTelemetryRef = useRef(onWalkTelemetry);
  onTelemetryRef.current = onWalkTelemetry;
  const onNearStationRef = useRef(onNearStationChange);
  onNearStationRef.current = onNearStationChange;
  const onStationArrivedRef = useRef(onStationArrived);
  onStationArrivedRef.current = onStationArrived;
  const onSimsObjectClickRef = useRef(onSimsObjectClick);
  onSimsObjectClickRef.current = onSimsObjectClick;
  const onPlaceMovedItemRef = useRef(onPlaceMovedItem);
  onPlaceMovedItemRef.current = onPlaceMovedItem;
  const onActiveFloorChangeRef = useRef(onActiveFloorChange);
  onActiveFloorChangeRef.current = onActiveFloorChange;

  useImperativeHandle(ref, () => ({
    capturePhoto: () => rendererRef.current?.captureSnapshotDataUrl() ?? null,
    walkToStation: (stationId) => rendererRef.current?.walkToStation(stationId),
    walkToNeighbor: (tokenId) => rendererRef.current?.walkToNeighbor(tokenId),
    returnHome: () => rendererRef.current?.returnHome(),
    setMoveInput: (dx, dz, sprint = false) => rendererRef.current?.setMoveInput(dx, dz, sprint),
    triggerEmote: (emote) => rendererRef.current?.triggerCharacterEmote(emote),
    setComputeActive: (active) => rendererRef.current?.setComputeActive(active),
    updateMonitorTelemetry: (data) => rendererRef.current?.updateMonitorTelemetry(data),
    flipCreatorView: (back) => rendererRef.current?.flipCreatorView(back),
    performSimsAction: (req) => rendererRef.current?.performSimsAction(req),
    getSimsFurnitureAnchor: (kind) =>
      rendererRef.current?.getSimsFurnitureAnchor(kind) ?? { x: 0, z: 1.38, yaw: 0, floor: 1 },
    setActiveFloor: (floor) => rendererRef.current?.setActiveFloor(floor),
    setMovingItem: (itemId, snapGrid = true) => rendererRef.current?.setMovingItem(itemId, snapGrid),
    waterGardenPlotFX: (plotId) => rendererRef.current?.waterGardenPlotFX(plotId),
    walkToPark: (parkId) => rendererRef.current?.walkToPark(parkId),
    fireSocialBeamToNeighbor: (tokenId, colorHex) =>
      rendererRef.current?.fireSocialBeamToNeighbor(tokenId, colorHex),
    triggerVehicleHonk: (vehicleId) => rendererRef.current?.triggerVehicleHonk(vehicleId),
    triggerCatalyticPulse: (intensity = 1.0) =>
      rendererRef.current?.triggerCatalyticPulse(intensity),
    arriveAtFrontDoor: () => rendererRef.current?.arriveAtFrontDoor(),
    triggerHostReaction: (emote, bubble) => rendererRef.current?.triggerHostReaction(emote, bubble),
    syncNeighborNpcStatus: (tokenId, moodName, plumbobHex, tierLabel, emote, bubble) =>
      rendererRef.current?.syncNeighborNpcStatus(
        tokenId,
        moodName,
        plumbobHex,
        tierLabel,
        emote,
        bubble
      )
  }));

  const [computeSnap, setComputeSnap] = useState<ComputeSnapshot | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: Alchemy3DRenderer;
    try {
      renderer = new Alchemy3DRenderer(
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
    } catch {
      setWebglUnavailable(true);
      return;
    }
    rendererRef.current = renderer;
    renderer.setLightingMood(lightingMood);
    renderer.setAtmosphereMode(atmosphereMode);
    renderer.setWalkCallbacks({
      onTelemetry: (telemetry) => onTelemetryRef.current?.(telemetry),
      onNearStationChange: (stationId) => onNearStationRef.current?.(stationId),
      onStationArrived: (stationId) => onStationArrivedRef.current?.(stationId),
      onSimsObjectClick: (target, sx, sy) => onSimsObjectClickRef.current?.(target, sx, sy),
      onPlaceMovedItem: (itemId, x, z, floor) => onPlaceMovedItemRef.current?.(itemId, x, z, floor),
      onActiveFloorChange: (floor) => onActiveFloorChangeRef.current?.(floor)
    });
    if (walkMode) {
      if (labDecor) renderer.setLabDecor(labDecor);
      if (gardenState) renderer.setGardenState(gardenState);
      if (neighbors) renderer.setNeighbors(neighbors);
      renderer.setWalkMode(true);
      renderer.setCameraMode(cameraMode);
      if (characterProfile) {
        renderer.setCharacterProfile(characterProfile);
      }
      renderer.setPlumbobColor(plumbobColor, playerMoodName);
      if (visitingHost) {
        renderer.setVisitingHost(visitingHost);
      }
      if (creatorCameraMode) {
        renderer.setCreatorCameraMode(true);
      }
    }
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
    impact.petOutfit,
    impact.petBackGear,
    impact.petOutfitColor,
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
    rendererRef.current?.setShowBestFold(showBestFold);
  }, [showBestFold]);

  useEffect(() => {
    if (typeof autoRotate === "boolean") {
      rendererRef.current?.setAutoRotate(autoRotate);
    }
  }, [autoRotate]);

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

  useEffect(() => {
    rendererRef.current?.setWalkMode(walkMode);
  }, [walkMode]);

  useEffect(() => {
    rendererRef.current?.setCharacterProfile(characterProfile ?? null);
  }, [
    characterProfile?.skinTone,
    characterProfile?.eyeColor,
    characterProfile?.expression,
    characterProfile?.buildScale,
    characterProfile?.hairStyle,
    characterProfile?.hairColor,
    characterProfile?.outfitStyle,
    characterProfile?.outfitBaseColor,
    characterProfile?.outfitAccent,
    characterProfile?.bottomStyle,
    characterProfile?.bottomColor,
    characterProfile?.footwearStyle,
    characterProfile?.neckwear,
    characterProfile?.eyewear,
    characterProfile?.headwear,
    characterProfile?.backpack,
    Boolean(characterProfile)
  ]);

  useEffect(() => {
    if (characterEmoteSignal && characterEmoteSignal.seq > 0) {
      rendererRef.current?.triggerCharacterEmote(characterEmoteSignal.emote);
    }
  }, [characterEmoteSignal]);

  useEffect(() => {
    rendererRef.current?.setCreatorCameraMode(creatorCameraMode);
  }, [creatorCameraMode]);

  useEffect(() => {
    rendererRef.current?.setCreatorFocusZone(creatorFocusZone);
  }, [creatorFocusZone]);

  useEffect(() => {
    rendererRef.current?.setCreatorTurntable(creatorTurntable);
  }, [creatorTurntable]);

  useEffect(() => {
    rendererRef.current?.setCameraMode(cameraMode);
  }, [cameraMode]);

  useEffect(() => {
    rendererRef.current?.setActiveStationHighlight(activeStationHighlight ?? null);
  }, [activeStationHighlight]);

  useEffect(() => {
    if (neighbors) rendererRef.current?.setNeighbors(neighbors);
  }, [neighbors]);

  const labDecorKey = labDecor ? JSON.stringify(labDecor) : "";
  useEffect(() => {
    if (labDecor) rendererRef.current?.setLabDecor(labDecor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labDecorKey]);

  useEffect(() => {
    rendererRef.current?.setActiveFloor(activeFloor);
  }, [activeFloor]);

  useEffect(() => {
    rendererRef.current?.setMovingItem(movingItem, moveSnapGrid);
  }, [movingItem, moveSnapGrid]);

  useEffect(() => {
    if (gardenState) rendererRef.current?.setGardenState(gardenState);
  }, [gardenState]);

  useEffect(() => {
    rendererRef.current?.setPlumbobColor(plumbobColor, playerMoodName);
  }, [plumbobColor, playerMoodName, characterProfile?.name]);

  useEffect(() => {
    rendererRef.current?.setControlsEnabled(controlsEnabled);
  }, [controlsEnabled]);

  useEffect(() => {
    rendererRef.current?.setVisitingHost(visitingHost ?? null);
  }, [
    visitingHost?.tokenId,
    visitingHost?.profile.name,
    visitingHost?.moodName,
    visitingHost?.plumbobHex,
    visitingHost?.tierLabel,
    Boolean(visitingHost)
  ]);

  const toggleCompute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextActive = !(computeSnap?.active ?? true);
    rendererRef.current?.setComputeActive(nextActive);
  };

  return (
    <div
      className={`artwork-frame ${fillContainer ? "is-fill" : ""}`}
      onDoubleClick={() => {
        if (!walkMode) {
          rendererRef.current?.resetCamera();
        }
        rendererRef.current?.triggerCatalyticPulse(0.95);
        onPulseClick?.();
      }}
    >
      {webglUnavailable ? (
        <div className="webgl-fallback">
          <LabThumbnailSvg
            traits={deriveTraitsFromSeed(impact.seed)}
            tier={impact.complexityTier}
            sectorsMask={impact.sectorsMask ?? 0}
          />
          <span>3D WebGL is off in this browser — showing live 2D lab blueprint</span>
        </div>
      ) : (
        <div ref={hostRef} className="artwork-canvas" />
      )}

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
