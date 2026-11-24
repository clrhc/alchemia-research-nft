import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { LabWorldExperience } from "./components/LabWorldExperience";
import { installBrowserCompatPolyfills } from "./engine/browserCompat";
import { type LiveImpactState } from "./engine/alchemyRenderer";
import { normalizeSeed } from "./engine/prng";
import { loadLabSparks, saveLabSparks } from "./engine/tamagotchi";
import { stageFromEth } from "./engine/traits";
import {
  DEFAULT_CAUSES,
  complexityTierFromUsd,
  ethToUsd,
  usdToEth
} from "./web3/config";
import {
  fetchOnChainCollectionSnapshot,
  fetchTokenLiveSnapshotOnChain,
  mergeMintedVessels,
  modeFromChainId,
  type MintedVessel
} from "./web3/contractService";
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
  const chainId = Number(params.get("chainId") || "84532");
  const initialUsd = Math.max(1, Number(params.get("usd") || "1"));
  const initialTier = Math.max(
    1,
    Math.min(5, Number(params.get("tier") || String(complexityTierFromUsd(initialUsd))))
  );
  const initialSectors = Math.max(0, Math.min(63, Number(params.get("sectors") || "0")));
  const initialSupply = Math.max(1, Number(params.get("supply") || "12"));
  const initialTokenEth = Number(params.get("tokenEth") || String(usdToEth(initialUsd) * 0.6));
  const initialGlobalEth = Number(params.get("globalEth") || "5.41");

  const [labSparks, setLabSparks] = useState<number>(() => loadLabSparks());
  const [chainNeighbors, setChainNeighbors] = useState<MintedVessel[]>([]);
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
    totalSupply: initialSupply,
    maxSupply: 0,
    reactionStage: stageFromEth(initialGlobalEth),
    mode: contractAddress ? modeFromChainId(chainId) : "simulation",
    lastPulseAt: Date.now()
  });

  useEffect(() => {
    if (!contractAddress) return;
    let active = true;
    const poll = async () => {
      try {
        const [snap, collection] = await Promise.all([
          fetchTokenLiveSnapshotOnChain(contractAddress, chainId, tokenId),
          fetchOnChainCollectionSnapshot(contractAddress, chainId, null).catch(() => null)
        ]);
        if (!active) return;
        if (collection?.vessels && collection.vessels.length > 0) {
          setChainNeighbors((prev) => mergeMintedVessels(prev, collection.vessels!));
        }
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
          totalSupply: Math.max(prev.totalSupply, snap.totalSupply, collection?.totalSupply ?? 0),
          maxSupply: snap.maxSupply,
          reactionStage: snap.reactionStage,
          mode: modeFromChainId(chainId),
          lastPulseAt:
            snap.globalImpactEth > prev.globalImpactEth ||
            snap.sectorsMask !== prev.sectorsMask ||
            snap.totalSupply > prev.totalSupply
              ? Date.now()
              : prev.lastPulseAt
        }));
      } catch {
        // Keep last known state smoothly
      }
    };
    poll();
    const timer = window.setInterval(poll, 12000);
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
      if (Array.isArray(msg.vessels) && msg.vessels.length > 0) {
        setChainNeighbors((prev) => mergeMintedVessels(prev, msg.vessels as MintedVessel[]));
      }
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
        totalSupply:
          typeof msg.totalSupply === "number"
            ? Math.max(prev.totalSupply, msg.totalSupply)
            : prev.totalSupply,
        globalImpactEth: msg.globalDonatedEth ?? prev.globalImpactEth,
        reactionStage: stageFromEth(msg.globalDonatedEth ?? prev.globalImpactEth),
        lastPulseAt: Date.now()
      }));
    };
    return () => channel.close();
  }, []);

  const vessel: MintedVessel = {
    tokenId: impact.tokenId,
    seed: impact.seed as `0x${string}`,
    causeId: impact.causeId,
    causeName: impact.causeName,
    minter: "Holder",
    ownedByUser: false,
    onChain: Boolean(contractAddress),
    valueUsd: impact.tokenValueUsd,
    impactEth: impact.tokenImpactEth,
    sectorsMask: impact.sectorsMask ?? 0,
    workUnits: impact.workUnits ?? 1,
    lastClaimMs: Date.now() - 1800000,
    mintedAt: Math.floor(Date.now() / 1000) - 3600
  };

  const handleAwardSparks = (delta: number) => {
    setLabSparks((prev) => {
      const next = Math.max(0, Math.round(prev + delta));
      saveLabSparks(next);
      return next;
    });
  };

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
      <LabWorldExperience
        vessel={vessel}
        allVessels={chainNeighbors}
        totalSupply={impact.totalSupply}
        impact={impact}
        userCoinBalance={0}
        totalCoinsDonatedToResearch={0}
        labSparks={labSparks}
        standaloneMode
        creatorTriggerMode="on-first-interaction"
        onAwardPlayBonus={handleAwardSparks}
        onSimulateNewNeighbor={(count = 1) => {
          setImpact((prev) => ({
            ...prev,
            totalSupply: prev.totalSupply + count,
            globalImpactEth: Number((prev.globalImpactEth + 0.015 * count).toFixed(4)),
            lastPulseAt: Date.now()
          }));
        }}
      />
    </div>
  );
}

installBrowserCompatPolyfills();

createRoot(document.getElementById("animation-root")!).render(
  <StrictMode>
    <StandaloneAnimationViewer />
  </StrictMode>
);
