import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Camera,
  CloudSnow,
  Cookie,
  Download,
  Eye,
  EyeOff,
  Heart,
  RefreshCw,
  Sparkles,
  Sun,
  Volume2,
  VolumeX
} from "lucide-react";
import { ArtworkCanvas, type ArtworkCanvasHandle } from "./components/ArtworkCanvas";
import type { AtmosphereMode, CameraPreset, LightingMood } from "./engine/alchemy3DRenderer";
import { type LiveImpactState } from "./engine/alchemyRenderer";
import { deriveTraitsFromSeed, normalizeSeed } from "./engine/prng";
import { downloadPDBFromSnapshot, type ComputeSnapshot } from "./engine/researchCompute";
import { soundEngine } from "./engine/soundEngine";
import type { TamagotchiAction } from "./engine/tamagotchi";
import { stageFromEth } from "./engine/traits";
import {
  DEFAULT_CAUSES,
  complexityTierFromUsd,
  ethToUsd,
  usdToEth
} from "./web3/config";
import { fetchTokenLiveSnapshotOnChain, modeFromChainId } from "./web3/contractService";
import { countSectors } from "./web3/sectors";
import "./styles/global.css";

const LIGHTING_ORDER: LightingMood[] = ["daylight", "silver", "moonlit"];
const LIGHTING_LABELS: Record<LightingMood, string> = {
  daylight: "Day",
  silver: "Silver",
  moonlit: "Mist"
};
const ATMOSPHERE_ORDER: AtmosphereMode[] = ["clear", "snow", "motes"];
const ATMOSPHERE_LABELS: Record<AtmosphereMode, string> = {
  clear: "Clear",
  snow: "Snow",
  motes: "Motes"
};
const CAM_PRESETS: Array<{ id: CameraPreset; label: string }> = [
  { id: "iso", label: "3D" },
  { id: "top", label: "Plan" },
  { id: "pet", label: "Pet" },
  { id: "molecule", label: "Fold" }
];

function StandaloneAnimationViewer() {
  const params = new URLSearchParams(window.location.search);
  const tokenId = Number(params.get("tokenId") || "1");
  const rawSeed =
    params.get("seed") ||
    "0x8a4f91e023c47b89d01f4e5276b98c31456fa234890bcdef1234567890ab0100";
  const seed = normalizeSeed(rawSeed);
  const causeId = Math.max(0, Math.min(3, Number(params.get("cause") || "0")));
  const contractAddress = params.get("contract") || "";
  const chainId = Number(params.get("chainId") || "84532");
  const initialUsd = Math.max(1, Number(params.get("usd") || "1"));
  const initialTier = Math.max(
    1,
    Math.min(5, Number(params.get("tier") || String(complexityTierFromUsd(initialUsd))))
  );
  const initialSectors = Math.max(0, Math.min(63, Number(params.get("sectors") || "0")));
  const initialTokenEth = Number(params.get("tokenEth") || String(usdToEth(initialUsd) * 0.6));
  const initialGlobalEth = Number(params.get("globalEth") || "5.41");

  const artworkRef = useRef<ArtworkCanvasHandle>(null);
  const [showHud, setShowHud] = useState(true);
  const [lightingMood, setLightingMood] = useState<LightingMood>("daylight");
  const [atmosphereMode, setAtmosphereMode] = useState<AtmosphereMode>("clear");
  const [autoSpin, setAutoSpin] = useState(true);
  const [soundOn, setSoundOn] = useState(() => soundEngine.isEnabled());
  const [camPreset, setCamPreset] = useState<{ preset: CameraPreset; seq: number } | null>(null);
  const [liveSnap, setLiveSnap] = useState<ComputeSnapshot | null>(null);
  const [tamaSignal, setTamaSignal] = useState<{ action: TamagotchiAction; seq: number } | null>(
    null
  );
  const [toast, setToast] = useState<string | null>(null);
  const [impact, setImpact] = useState<LiveImpactState>({
    tokenId,
    seed,
    causeId,
    causeName: DEFAULT_CAUSES[causeId]?.name || "Open Research",
    tokenValueUsd: initialUsd,
    complexityTier: initialTier,
    sectorsMask: initialSectors,
    tokenImpactEth: initialTokenEth,
    causeImpactEth: DEFAULT_CAUSES[causeId]?.raisedEth || 1.4,
    globalImpactEth: initialGlobalEth,
    totalSupply: 159,
    maxSupply: 0,
    reactionStage: stageFromEth(initialGlobalEth),
    mode: contractAddress ? modeFromChainId(chainId) : "simulation",
    lastPulseAt: Date.now()
  });

  const traits = deriveTraitsFromSeed(impact.seed);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Whisper-quiet keyboard shortcuts for full-screen / OpenSea iframe viewing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "1") setCamPreset((p) => ({ preset: "iso", seq: (p?.seq || 0) + 1 }));
      else if (e.key === "2") setCamPreset((p) => ({ preset: "top", seq: (p?.seq || 0) + 1 }));
      else if (e.key === "3") setCamPreset((p) => ({ preset: "pet", seq: (p?.seq || 0) + 1 }));
      else if (e.key === "4") setCamPreset((p) => ({ preset: "molecule", seq: (p?.seq || 0) + 1 }));
      else if (e.key.toLowerCase() === "m") setSoundOn(soundEngine.toggle());
      else if (e.key.toLowerCase() === "h") setShowHud((v) => !v);
      else if (e.code === "Space" && tag !== "BUTTON" && tag !== "A") {
        e.preventDefault();
        setTamaSignal((prev) => ({ action: "play", seq: (prev?.seq || 0) + 1 }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!contractAddress) return;
    let active = true;
    const poll = async () => {
      try {
        const snap = await fetchTokenLiveSnapshotOnChain(contractAddress, chainId, tokenId);
        if (!active) return;
        setImpact((prev) => ({
          ...prev,
          seed: snap.seed,
          causeId: snap.causeId,
          causeName: snap.causeName,
          tokenValueUsd: Math.max(1, Math.round(ethToUsd(snap.tokenTotalValueEth))),
          complexityTier: snap.complexityTier,
          sectorsMask: snap.sectorsMask,
          tokenImpactEth: snap.tokenImpactEth,
          causeImpactEth: snap.causeImpactEth,
          globalImpactEth: snap.globalImpactEth,
          totalSupply: snap.totalSupply,
          maxSupply: snap.maxSupply,
          reactionStage: snap.reactionStage,
          mode: modeFromChainId(chainId),
          lastPulseAt:
            snap.globalImpactEth > prev.globalImpactEth ||
            snap.sectorsMask !== prev.sectorsMask
              ? Date.now()
              : prev.lastPulseAt
        }));
      } catch {
        // Keep last known state smoothly
      }
    };
    poll();
    const timer = window.setInterval(poll, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [contractAddress, chainId, tokenId]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("alchemia-live-impact");
    channel.onmessage = (event) => {
      const msg = event.data;
      if (!msg || msg.type !== "IMPACT_UPDATE") return;
      setImpact((prev) => ({
        ...prev,
        tokenValueUsd:
          msg.tokenId === prev.tokenId && typeof msg.tokenValueUsd === "number"
            ? msg.tokenValueUsd
            : prev.tokenValueUsd,
        complexityTier:
          msg.tokenId === prev.tokenId && typeof msg.complexityTier === "number"
            ? msg.complexityTier
            : prev.complexityTier,
        sectorsMask:
          msg.tokenId === prev.tokenId && typeof msg.sectorsMask === "number"
            ? msg.sectorsMask
            : prev.sectorsMask,
        globalImpactEth: msg.globalDonatedEth ?? prev.globalImpactEth,
        reactionStage: stageFromEth(msg.globalDonatedEth ?? prev.globalImpactEth),
        lastPulseAt: Date.now()
      }));
    };
    return () => channel.close();
  }, []);

  const triggerCare = (action: TamagotchiAction) => {
    setTamaSignal((prev) => ({ action, seq: (prev?.seq || 0) + 1 }));
    setToast(
      action === "feed"
        ? "Treats dropped on the patio."
        : action === "pet"
          ? "Your pet loved that."
          : "Ball tossed. Watch them chase it."
    );
  };

  const cycleLighting = () => {
    const idx = (LIGHTING_ORDER.indexOf(lightingMood) + 1) % LIGHTING_ORDER.length;
    setLightingMood(LIGHTING_ORDER[idx]);
    soundEngine.playTap(987.77);
  };

  const cycleAtmosphere = () => {
    const idx = (ATMOSPHERE_ORDER.indexOf(atmosphereMode) + 1) % ATMOSPHERE_ORDER.length;
    setAtmosphereMode(ATMOSPHERE_ORDER[idx]);
    soundEngine.playTap(1046.5);
  };

  const handleSavePhoto = () => {
    const dataUrl = artworkRef.current?.capturePhoto();
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `alchemia-lab-${impact.tokenId}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    soundEngine.playTap(1318.5);
    setToast(`Saved PNG photo of Lab #${impact.tokenId}.`);
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#ffffff"
      }}
    >
      <div style={{ width: "min(100vw, 100vh)", height: "min(100vw, 100vh)", position: "relative" }}>
        <ArtworkCanvas
          ref={artworkRef}
          impact={impact}
          showHud={showHud}
          cameraPreset={camPreset}
          lightingMood={lightingMood}
          atmosphereMode={atmosphereMode}
          autoRotate={autoSpin}
          tamagotchiSignal={tamaSignal}
          onComputeSnapshot={setLiveSnap}
          onInteractiveEvent={(ev) => {
            setToast(
              ev.kind === "pet-clicked"
                ? "Your tap made the pet happy."
                : ev.kind === "room-clicked"
                  ? `Tapped ${ev.roomName || "lab room"}.`
                  : "Popped a floating proton."
            );
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 52,
            right: 12,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            zIndex: 10
          }}
        >
          <button
            type="button"
            className="art-hud-badge clickable"
            onClick={() => setShowHud((v) => !v)}
            style={{ cursor: "pointer" }}
          >
            {showHud ? <EyeOff size={12} /> : <Eye size={12} />}
            {showHud ? "Clean" : "HUD"}
          </button>

          <button
            type="button"
            className="art-hud-badge clickable"
            onClick={cycleLighting}
            style={{ cursor: "pointer" }}
          >
            <Sun size={12} />
            {LIGHTING_LABELS[lightingMood]}
          </button>

          <button
            type="button"
            className="art-hud-badge clickable"
            onClick={cycleAtmosphere}
            style={{ cursor: "pointer" }}
          >
            <CloudSnow size={12} />
            {ATMOSPHERE_LABELS[atmosphereMode]}
          </button>

          <button
            type="button"
            className="art-hud-badge clickable"
            onClick={() => {
              setAutoSpin((v) => !v);
              soundEngine.playTap(880);
            }}
            style={{ cursor: "pointer" }}
          >
            <RefreshCw size={12} />
            {autoSpin ? "Spin on" : "Spin off"}
          </button>

          <button
            type="button"
            className="art-hud-badge clickable"
            onClick={handleSavePhoto}
            style={{ cursor: "pointer" }}
          >
            <Camera size={12} />
            Photo
          </button>

          <button
            type="button"
            className="art-hud-badge clickable"
            onClick={() => setSoundOn(soundEngine.toggle())}
            style={{ cursor: "pointer" }}
          >
            {soundOn ? <Volume2 size={12} /> : <VolumeX size={12} />}
            {soundOn ? "Sound" : "Muted"}
          </button>

          <button
            type="button"
            className="art-hud-badge clickable"
            onClick={() => triggerCare("feed")}
            style={{ cursor: "pointer" }}
          >
            <Cookie size={12} />
            Feed
          </button>

          <button
            type="button"
            className="art-hud-badge clickable"
            onClick={() => triggerCare("pet")}
            style={{ cursor: "pointer" }}
          >
            <Heart size={12} />
            Pet
          </button>

          <button
            type="button"
            className="art-hud-badge clickable"
            onClick={() => triggerCare("play")}
            style={{ cursor: "pointer" }}
          >
            <Sparkles size={12} />
            Play
          </button>

          {liveSnap && (
            <button
              type="button"
              className="art-hud-badge clickable"
              onClick={() => downloadPDBFromSnapshot(liveSnap)}
              title="Download real .PDB structure computed by this lab"
              style={{ cursor: "pointer" }}
            >
              <Download size={12} />
              .PDB
            </button>
          )}
        </div>

        {showHud && (
          <div
            style={{
              position: "absolute",
              top: 52,
              left: 12,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              zIndex: 10
            }}
          >
            {CAM_PRESETS.map((c) => (
              <button
                key={c.id}
                type="button"
                className="art-hud-badge clickable"
                onClick={() => {
                  soundEngine.playTap(880);
                  setCamPreset((prev) => ({ preset: c.id, seq: (prev?.seq || 0) + 1 }));
                }}
                style={{ cursor: "pointer" }}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {toast && (
          <div
            style={{
              position: "absolute",
              top: 52,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 12,
              pointerEvents: "none"
            }}
          >
            <span className="art-hud-badge">{toast}</span>
          </div>
        )}

        {showHud && (
          <div
            style={{
              position: "absolute",
              bottom: 74,
              left: 12,
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              pointerEvents: "none"
            }}
          >
            <span className="art-hud-badge">{traits.vessel}</span>
            <span className="art-hud-badge">{traits.familiar.name}</span>
            <span className="art-hud-badge">
              {countSectors(impact.sectorsMask ?? 0)}/6 Rooms
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("animation-root")!).render(
  <StrictMode>
    <StandaloneAnimationViewer />
  </StrictMode>
);
