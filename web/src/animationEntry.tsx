import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Cookie, Download, Eye, EyeOff, Heart, Sparkles } from "lucide-react";
import { ArtworkCanvas } from "./components/ArtworkCanvas";
import { type LiveImpactState } from "./engine/alchemyRenderer";
import { deriveTraitsFromSeed, normalizeSeed } from "./engine/prng";
import { downloadPDBFromSnapshot, type ComputeSnapshot } from "./engine/researchCompute";
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

function StandaloneAnimationViewer() {
  const params = new URLSearchParams(window.location.search);
  const tokenId = Number(params.get("tokenId") || "1");
  const rawSeed =
    params.get("seed") ||
    "0x8a4f91e023c47b89d01f4e5276b98c31456fa234890bcdef1234567890ab0100";
  const seed = normalizeSeed(rawSeed);
  const causeId = Math.max(0, Math.min(3, Number(params.get("cause") || "0")));
  const contractAddress = params.get("contract") || "";
  const chainId = Number(params.get("chainId") || "1");
  const initialUsd = Math.max(1, Number(params.get("usd") || "1"));
  const initialTier = Math.max(
    1,
    Math.min(5, Number(params.get("tier") || String(complexityTierFromUsd(initialUsd))))
  );
  const initialSectors = Math.max(0, Math.min(63, Number(params.get("sectors") || "0")));
  const initialTokenEth = Number(params.get("tokenEth") || String(usdToEth(initialUsd) * 0.6));
  const initialGlobalEth = Number(params.get("globalEth") || "5.41");

  const [showHud, setShowHud] = useState(true);
  const [liveSnap, setLiveSnap] = useState<ComputeSnapshot | null>(null);
  const [tamaSignal, setTamaSignal] = useState<{ action: TamagotchiAction; seq: number } | null>(
    null
  );
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
        // Keep last known state
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
          impact={impact}
          showHud={showHud}
          tamagotchiSignal={tamaSignal}
          onComputeSnapshot={setLiveSnap}
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
              title="Download real .PDB Protein Data Bank structure computed by this NFT"
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
              bottom: 72,
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
              {countSectors(impact.sectorsMask ?? 0)}/6 Wings
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
