import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import { Compass, Footprints, Home, Sparkles, Users, Wallet } from "lucide-react";
import { ArtworkCanvas } from "./components/ArtworkCanvas";
import { BackgroundCanvas } from "./components/BackgroundCanvas";
import { CustomCursor } from "./components/CustomCursor";

const ExploreView = lazy(() =>
  import("./components/ExploreView").then((m) => ({ default: m.ExploreView }))
);
const MyLabsView = lazy(() =>
  import("./components/MyLabsView").then((m) => ({ default: m.MyLabsView }))
);
const WalletModal = lazy(() =>
  import("./components/WalletModal").then((m) => ({ default: m.WalletModal }))
);
const WhitePaperSheet = lazy(() =>
  import("./components/WhitePaperSheet").then((m) => ({ default: m.WhitePaperSheet }))
);
import { type LiveImpactState } from "./engine/alchemyRenderer";
import type { NeighborLabSummary } from "./engine/neighborhoodLayout";
import { randomSeedHex } from "./engine/prng";
import type { ComputeSnapshot } from "./engine/researchCompute";
import { loadLabSparks, saveLabSparks } from "./engine/tamagotchi";
import { stageFromEth } from "./engine/traits";
import {
  DEFAULT_CAUSES,
  complexityTierFromUsd,
  ethToUsd,
  usdToEth
} from "./web3/config";
import {
  buildAnimationUrl,
  clearSelectedWalletProvider,
  connectInjectedWallet,
  executeOnChainBuildSector,
  executeOnChainClaimCoins,
  executeOnChainDonateCoins,
  executeOnChainMint,
  executeOnChainSeedLiquidity,
  executeOnChainSubmitResearchProof,
  executeOnChainUpgradeVessel,
  fetchOnChainCollectionSnapshot,
  fetchRecentResearchDiscoveries,
  loadInitialCollectionState,
  saveChainCache,
  saveDemoState,
  subscribeWalletEvents,
  type CollectionState,
  type MintedVessel
} from "./web3/contractService";
import { LAB_SECTORS, SLIDER_USD_STOPS } from "./web3/sectors";

type PageTab = "mint" | "explore" | "mylabs";

function sliderDetailLabel(usd: number): string {
  if (usd >= 500) return "4D crystal crown";
  if (usd >= 100) return "Cat & dog pair";
  if (usd >= 25) return "Orbiting celestial rings";
  if (usd >= 5) return "Dual glass condensers";
  return "Full base 3D lab";
}

export function App() {
  const [page, setPage] = useState<PageTab>("mint");
  const [state, setState] = useState<CollectionState>(() => loadInitialCollectionState());
  const [labSparks, setLabSparks] = useState<number>(() => loadLabSparks());
  const [sliderIndex, setSliderIndex] = useState<number>(0); // 0 -> $1
  const [currentSeed, setCurrentSeed] = useState<`0x${string}`>(
    "0x8a4f91e023c47b89d01f4e5276b98c31456fa234890bcdef1234567890ab0100"
  );
  const [currentTokenId, setCurrentTokenId] = useState<number>(1);
  const [currentCauseId, setCurrentCauseId] = useState<number>(0);
  const [exploreSelected, setExploreSelected] = useState<MintedVessel | null>(null);
  const [myLabTokenId, setMyLabTokenId] = useState<number | null>(1);
  const [visitHomeLab, setVisitHomeLab] = useState<NeighborLabSummary | null>(null);
  const [liveCompute, setLiveCompute] = useState<ComputeSnapshot | null>(null);

  const [showWhitePaper, setShowWhitePaper] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastPulseAt, setLastPulseAt] = useState(() => Date.now());
  const [bgPulseSignal, setBgPulseSignal] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const channelRef = useRef<BroadcastChannel | null>(null);
  const deepLinkAppliedRef = useRef(false);

  useEffect(() => {
    if (typeof BroadcastChannel !== "undefined") {
      channelRef.current = new BroadcastChannel("alchemia-live-impact");
    }
    return () => channelRef.current?.close();
  }, []);

  // Support shareable ?lab=<tokenId> deep links opening straight into Gallery single view
  useEffect(() => {
    if (deepLinkAppliedRef.current || typeof window === "undefined") return;
    const labParam = new URLSearchParams(window.location.search).get("lab");
    if (!labParam) return;
    const wantedId = Number(labParam);
    if (!Number.isFinite(wantedId) || wantedId <= 0) return;
    const match = state.vessels.find((v) => v.tokenId === wantedId);
    if (match) {
      deepLinkAppliedRef.current = true;
      setExploreSelected(match);
      setPage("explore");
    }
  }, [state.vessels]);

  // Sync browser address bar ?lab=<tokenId> cleanly when inspecting a lab in Gallery Single View
  const selectGalleryVessel = (vessel: MintedVessel | null) => {
    setExploreSelected(vessel);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (vessel) url.searchParams.set("lab", String(vessel.tokenId));
      else url.searchParams.delete("lab");
      window.history.replaceState({}, "", url.toString());
    }
  };

  const navigateTab = (nextPage: PageTab) => {
    setPage(nextPage);
    if (nextPage !== "explore") {
      selectGalleryVessel(null);
    }
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  };

  // Subscribe to EIP-1193 MetaMask/Rabby/Coinbase account & chain switch events
  useEffect(() => {
    if (!state.walletAddress) return;
    return subscribeWalletEvents(
      (accounts) => {
        const nextAddr = accounts[0] || null;
        setState((prev) => ({ ...prev, walletAddress: nextAddr }));
      },
      (nextChainId) => {
        setState((prev) => ({ ...prev, chainId: nextChainId }));
      }
    );
  }, [state.walletAddress]);

  useEffect(() => {
    if (!state.contractAddress) return;
    let active = true;
    const sync = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const snap = await fetchOnChainCollectionSnapshot(
          state.contractAddress,
          state.chainId,
          state.walletAddress
        );
        if (!active || !snap) return;
        setState((prev) => {
          const grew =
            prev.chainSynced &&
            typeof snap.globalDonatedEth === "number" &&
            snap.globalDonatedEth > prev.globalDonatedEth + 1e-7;
          if (grew) {
            setLastPulseAt(Date.now());
            setBgPulseSignal((n) => n + 1);
          }
          const next = { ...prev, ...snap, chainSynced: true };
          saveChainCache(next);
          return next;
        });
      } catch {
        // Keep current view smoothly if public RPC throttles
      }
      // Load optional proof-ledger logs asynchronously without blocking live Home/Gallery hydration
      fetchRecentResearchDiscoveries(state.contractAddress, state.chainId)
        .then((logs) => {
          if (!active || logs.length === 0) return;
          setState((prev) => ({ ...prev, recentDiscoveries: logs }));
        })
        .catch(() => {
          // non-fatal
        });
    };
    sync();
    const id = window.setInterval(sync, 20000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [state.contractAddress, state.chainId, state.walletAddress]);

  const amountUsd = SLIDER_USD_STOPS[sliderIndex] ?? 1;
  const complexityTier = complexityTierFromUsd(amountUsd);
  const activeCause = state.causes[currentCauseId] || DEFAULT_CAUSES[0];

  const totalResearchUsd = ethToUsd(state.globalDonatedEth);
  const formattedResearchTotal = totalResearchUsd.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  });

  const previewImpact: LiveImpactState = {
    tokenId: currentTokenId,
    seed: currentSeed,
    causeId: currentCauseId,
    causeName: activeCause.name,
    tokenValueUsd: amountUsd,
    complexityTier,
    sectorsMask: 0,
    tokenImpactEth: usdToEth(amountUsd) * (state.liquiditySeeded ? 0.6667 : 0.6),
    causeImpactEth: activeCause.raisedEth,
    globalImpactEth: state.globalDonatedEth,
    totalSupply: state.totalSupply,
    maxSupply: state.maxSupply,
    reactionStage: state.reactionStage,
    mode: state.connectedMode,
    lastPulseAt
  };

  const previewAnimationUrl = buildAnimationUrl({
    tokenId: currentTokenId,
    seed: currentSeed,
    causeId: currentCauseId,
    complexityTier,
    sectorsMask: 0,
    tokenValueUsd: amountUsd,
    totalSupply: state.totalSupply,
    contractAddress: state.contractAddress || undefined,
    chainId: state.chainId,
    tokenImpactEth: previewImpact.tokenImpactEth,
    globalImpactEth: state.globalDonatedEth
  });

  const broadcastUpdate = (
    next: CollectionState,
    tokenId?: number,
    tokenValueUsd?: number,
    sectorsMask?: number
  ) => {
    channelRef.current?.postMessage({
      type: "IMPACT_UPDATE",
      globalDonatedEth: next.globalDonatedEth,
      totalSupply: next.totalSupply,
      maxSupply: next.maxSupply,
      vessels: next.vessels.slice(0, 28),
      tokenId,
      tokenValueUsd,
      complexityTier: tokenValueUsd ? complexityTierFromUsd(tokenValueUsd) : undefined,
      sectorsMask
    });
  };

  const applySplitToState = (prev: CollectionState, paidEth: number) => {
    if (!prev.liquiditySeeded) {
      const researchAdded = Number((paidEth * 0.6).toFixed(6));
      const lpAdded = Number((paidEth * 0.15).toFixed(6));
      const nextReserve = Number((prev.liquidityReserveEth + lpAdded).toFixed(6));
      const seededNow = nextReserve >= prev.liquidityThresholdEth;
      return {
        researchAdded,
        nextGlobal: Number((prev.globalDonatedEth + researchAdded).toFixed(6)),
        nextReserve: seededNow ? 0 : nextReserve,
        nextSeeded: seededNow
      };
    }
    const researchAdded = Number((paidEth * 0.6667).toFixed(6));
    return {
      researchAdded,
      nextGlobal: Number((prev.globalDonatedEth + researchAdded).toFixed(6)),
      nextReserve: prev.liquidityReserveEth,
      nextSeeded: true
    };
  };

  const awardSparks = (delta: number) => {
    setLabSparks((prev) => {
      const next = Math.max(0, Math.round(prev + delta));
      saveLabSparks(next);
      return next;
    });
  };

  const handleMint = async () => {
    if (busy) return;
    if (state.contractAddress && !state.walletAddress) {
      setWalletError(null);
      setShowWalletModal(true);
      return;
    }
    setBusy(true);
    setNotice(null);

    const totalEth = usdToEth(amountUsd);
    const nextCauseId = (currentCauseId + 1) % state.causes.length;
    const cause = state.causes[nextCauseId] || DEFAULT_CAUSES[0];

    try {
      let tokenId = state.totalSupply + 1;
      let seed: `0x${string}` = randomSeedHex();
      let txHash: string | undefined;

      if (state.contractAddress) {
        if (!state.walletAddress) {
          const { address, chainId } = await connectInjectedWallet();
          setState((prev) => ({ ...prev, walletAddress: address, chainId }));
        }
        const res = await executeOnChainMint({
          contractAddress: state.contractAddress,
          quantity: 1,
          causeId: nextCauseId,
          totalEth
        });
        tokenId = res.tokenId;
        seed = res.seed;
        txHash = res.txHash;
      }

      const newVessel: MintedVessel = {
        tokenId,
        seed,
        causeId: nextCauseId,
        causeName: cause.name,
        minter: "You",
        ownedByUser: true,
        onChain: Boolean(state.contractAddress),
        valueUsd: amountUsd,
        impactEth: Number((totalEth * (state.liquiditySeeded ? 0.6667 : 0.6)).toFixed(6)),
        sectorsMask: 0,
        workUnits: 1,
        lastClaimMs: Date.now(),
        onChainPendingCoins: 0,
        onChainMiningRate: complexityTier * 5,
        syncedAtMs: Date.now(),
        mintedAt: Math.floor(Date.now() / 1000),
        txHash
      };

      setCurrentTokenId(tokenId);
      setCurrentSeed(seed);
      setCurrentCauseId(nextCauseId);
      setMyLabTokenId(tokenId);
      awardSparks(15);

      setState((prev) => {
        const split = applySplitToState(prev, totalEth);
        const next: CollectionState = {
          ...prev,
          totalSupply: Math.max(prev.totalSupply + 1, tokenId),
          globalDonatedEth: split.nextGlobal,
          liquidityReserveEth: split.nextReserve,
          liquiditySeeded: split.nextSeeded,
          reactionStage: stageFromEth(split.nextGlobal),
          vessels: [newVessel, ...prev.vessels]
        };
        saveDemoState(next);
        broadcastUpdate(next, tokenId, amountUsd, 0);
        return next;
      });

      setLastPulseAt(Date.now());
      setBgPulseSignal((n) => n + 1);
      setNotice(`Lab #${tokenId} is ready. Open My Labs to build rooms and care for your pet.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Transaction cancelled.");
    } finally {
      setBusy(false);
    }
  };

  const handleConnectWallet = async () => {
    setWalletError(null);
    setShowWalletModal(true);
  };

  const handleConnectProvider = async (selectedProvider?: unknown) => {
    setWalletConnecting(true);
    setWalletError(null);
    try {
      const { address, chainId } = await connectInjectedWallet(selectedProvider);
      setState((prev) => ({ ...prev, walletAddress: address, chainId }));
      setShowWalletModal(false);
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : "Wallet connection cancelled.");
    } finally {
      setWalletConnecting(false);
    }
  };

  const handleDisconnectWallet = () => {
    clearSelectedWalletProvider();
    setState((prev) => ({ ...prev, walletAddress: null }));
  };

  const handleAnchorProof = async (vessel: MintedVessel, snap: ComputeSnapshot) => {
    if (state.contractAddress && vessel.ownedByUser) {
      if (!state.walletAddress) {
        const { address, chainId } = await connectInjectedWallet();
        setState((prev) => ({ ...prev, walletAddress: address, chainId }));
      }
      await executeOnChainSubmitResearchProof({
        contractAddress: state.contractAddress,
        tokenId: vessel.tokenId,
        proofHash: snap.proofHash,
        bestEnergy: snap.bestEnergy,
        workUnits: Math.max(1, snap.workUnitsCompleted)
      });
    }
    awardSparks(10);
    setState((prev) => ({
      ...prev,
      vessels: prev.vessels.map((v) =>
        v.tokenId === vessel.tokenId
          ? { ...v, workUnits: v.workUnits + Math.max(1, snap.workUnitsCompleted) }
          : v
      )
    }));
    setLastPulseAt(Date.now());
    setBgPulseSignal((n) => n + 1);
  };

  const handleUpgradeVessel = async (vessel: MintedVessel, addedUsd: number) => {
    const addedEth = usdToEth(addedUsd);
    if (state.contractAddress && vessel.ownedByUser) {
      if (!state.walletAddress) {
        const { address, chainId } = await connectInjectedWallet();
        setState((prev) => ({ ...prev, walletAddress: address, chainId }));
      }
      await executeOnChainUpgradeVessel({
        contractAddress: state.contractAddress,
        tokenId: vessel.tokenId,
        addedEth
      });
    }

    awardSparks(25);
    setState((prev) => {
      const split = applySplitToState(prev, addedEth);
      const nextVessels = prev.vessels.map((v) =>
        v.tokenId === vessel.tokenId
          ? {
              ...v,
              valueUsd: v.valueUsd + addedUsd,
              impactEth: Number((v.impactEth + split.researchAdded).toFixed(6))
            }
          : v
      );
      const next: CollectionState = {
        ...prev,
        globalDonatedEth: split.nextGlobal,
        liquidityReserveEth: split.nextReserve,
        liquiditySeeded: split.nextSeeded,
        reactionStage: stageFromEth(split.nextGlobal),
        vessels: nextVessels
      };
      saveDemoState(next);
      broadcastUpdate(next, vessel.tokenId, vessel.valueUsd + addedUsd, vessel.sectorsMask);
      return next;
    });
    setLastPulseAt(Date.now());
    setBgPulseSignal((n) => n + 1);
  };

  const handleBuildSector = async (
    vessel: MintedVessel,
    sectorId: number,
    payWithCoins: boolean
  ) => {
    const sector = LAB_SECTORS[sectorId];
    if (!sector) return;

    if (state.contractAddress && vessel.ownedByUser) {
      if (!state.walletAddress) {
        const { address, chainId } = await connectInjectedWallet();
        setState((prev) => ({ ...prev, walletAddress: address, chainId }));
      }
      await executeOnChainBuildSector({
        contractAddress: state.contractAddress,
        coinAddress: state.coinAddress || undefined,
        tokenId: vessel.tokenId,
        sectorId,
        payWithCoins,
        coinCost: sector.coinCost,
        ethAmount: payWithCoins ? undefined : usdToEth(sector.ethCostUsd)
      });
    }

    const newMask = vessel.sectorsMask | (1 << sectorId);
    awardSparks(20);
    setState((prev) => {
      let nextGlobal = prev.globalDonatedEth;
      let nextReserve = prev.liquidityReserveEth;
      let nextSeeded = prev.liquiditySeeded;
      let nextCoins = prev.userCoinBalance;
      let nextCoinsDonated = prev.totalCoinsDonatedToResearch;
      let addedUsd = 0;

      if (payWithCoins) {
        if (prev.userCoinBalance < sector.coinCost) return prev;
        nextCoins = Number((prev.userCoinBalance - sector.coinCost).toFixed(2));
        nextCoinsDonated = Number((prev.totalCoinsDonatedToResearch + sector.coinCost * 0.2).toFixed(1));
      } else {
        addedUsd = sector.ethCostUsd;
        const split = applySplitToState(prev, usdToEth(sector.ethCostUsd));
        nextGlobal = split.nextGlobal;
        nextReserve = split.nextReserve;
        nextSeeded = split.nextSeeded;
      }

      const nextVessels = prev.vessels.map((v) =>
        v.tokenId === vessel.tokenId
          ? {
              ...v,
              sectorsMask: newMask,
              valueUsd: v.valueUsd + addedUsd
            }
          : v
      );

      const next: CollectionState = {
        ...prev,
        globalDonatedEth: nextGlobal,
        liquidityReserveEth: nextReserve,
        liquiditySeeded: nextSeeded,
        userCoinBalance: nextCoins,
        totalCoinsDonatedToResearch: nextCoinsDonated,
        reactionStage: stageFromEth(nextGlobal),
        vessels: nextVessels
      };
      saveDemoState(next);
      broadcastUpdate(next, vessel.tokenId, vessel.valueUsd + addedUsd, newMask);
      return next;
    });

    setLastPulseAt(Date.now());
    setBgPulseSignal((n) => n + 1);
  };

  const handleClaimCoins = async (
    vessel: MintedVessel,
    amount: number,
    researchTithePct: number
  ) => {
    if (state.contractAddress && vessel.ownedByUser) {
      await executeOnChainClaimCoins({
        contractAddress: state.contractAddress,
        tokenId: vessel.tokenId,
        researchTithePct
      });
    }

    const toResearch = Number(((amount * researchTithePct) / 100).toFixed(2));
    const toHolder = Number((amount - toResearch).toFixed(2));
    const nowMs = Date.now();

    setState((prev) => {
      const next: CollectionState = {
        ...prev,
        userCoinBalance: Number((prev.userCoinBalance + toHolder).toFixed(2)),
        totalCoinsDonatedToResearch: Number((prev.totalCoinsDonatedToResearch + toResearch).toFixed(2)),
        vessels: prev.vessels.map((v) =>
          v.tokenId === vessel.tokenId
            ? { ...v, lastClaimMs: nowMs, onChainPendingCoins: 0, syncedAtMs: nowMs }
            : v
        )
      };
      saveDemoState(next);
      return next;
    });
    setBgPulseSignal((n) => n + 1);
  };

  const handleDonateCoins = async (vessel: MintedVessel, amount: number) => {
    if (state.contractAddress && state.coinAddress && vessel.ownedByUser) {
      const causeWallet = state.causes[vessel.causeId]?.researchWallet;
      if (!causeWallet || !ethers.isAddress(causeWallet)) {
        throw new Error("Research wallet address is still loading. Try again in a moment.");
      }
      await executeOnChainDonateCoins({
        coinAddress: state.coinAddress,
        researchWallet: causeWallet,
        amountCoins: amount
      });
    }

    setState((prev) => {
      if (prev.userCoinBalance < amount) return prev;
      const next: CollectionState = {
        ...prev,
        userCoinBalance: Number((prev.userCoinBalance - amount).toFixed(2)),
        totalCoinsDonatedToResearch: Number((prev.totalCoinsDonatedToResearch + amount).toFixed(2))
      };
      saveDemoState(next);
      return next;
    });
    setLastPulseAt(Date.now());
    setBgPulseSignal((n) => n + 1);
  };

  const handleAwardPlayBonus = (sparks: number) => {
    awardSparks(sparks);
  };

  const handleSpendSparksForTreat = (cost: number): boolean => {
    if (labSparks >= cost) {
      awardSparks(-cost);
      return true;
    }
    if (!state.contractAddress && state.userCoinBalance >= cost) {
      setState((prev) => {
        const next = {
          ...prev,
          userCoinBalance: Number((prev.userCoinBalance - cost).toFixed(2))
        };
        saveDemoState(next);
        return next;
      });
      return true;
    }
    return false;
  };

  return (
    <>
      <BackgroundCanvas impactPulseSignal={bgPulseSignal} />
      <CustomCursor />

      <div className={`open-stage ${page === "mylabs" ? "is-mylabs-world" : ""}`}>
        {/* Floating Cutesy Silver-White Glassmorphism Navigation Capsule */}
        <nav className="quiet-nav" aria-label="Site navigation">
          <button
            type="button"
            className={`nav-link clickable ${page === "mint" ? "active" : ""}`}
            onClick={() => navigateTab("mint")}
          >
            <span className="cute-icon-bubble is-xs">
              <Sparkles size={11} />
            </span>
            <span>Home</span>
          </button>
          <button
            type="button"
            className={`nav-link clickable ${page === "explore" ? "active" : ""}`}
            onClick={() => navigateTab("explore")}
          >
            <span className="cute-icon-bubble is-xs">
              <Compass size={11} />
            </span>
            <span>Gallery</span>
          </button>
          <button
            type="button"
            className={`nav-link clickable ${page === "mylabs" ? "active" : ""}`}
            onClick={() => navigateTab("mylabs")}
          >
            <span className="cute-icon-bubble is-xs">
              <Home size={11} />
            </span>
            <span>My Labs</span>
            <span className="nav-world-badge">3D Town</span>
          </button>
          <button
            type="button"
            className="nav-link clickable"
            onClick={() => {
              setWalletError(null);
              setShowWalletModal(true);
            }}
          >
            <span className="cute-icon-bubble is-xs">
              <Wallet size={11} />
            </span>
            <span>
              {state.walletAddress
                ? `${state.walletAddress.slice(0, 6)}…${state.walletAddress.slice(-4)}`
                : "Connect"}
            </span>
          </button>
        </nav>

        {page === "mint" && (
          <main className="open-stack">
            {/* 1. Interactive 3D Architectural Model Card on Top */}
            <div className="floating-model-card" aria-label="Interactive 3D lab model">
              <ArtworkCanvas
                impact={previewImpact}
                showHud={false}
                onComputeSnapshot={setLiveCompute}
                onInteractiveEvent={(ev) => {
                  awardSparks(ev.bonusCoins);
                  setNotice(
                    ev.kind === "pet-clicked"
                      ? `Petted in 3D. +${ev.bonusCoins} spark.`
                      : ev.kind === "room-clicked"
                        ? `Tapped ${ev.roomName || "lab room"} in 3D. +${ev.bonusCoins} spark.`
                        : `Popped a floating proton. +${ev.bonusCoins} sparks.`
                  );
                }}
                onPulseClick={() => setBgPulseSignal((n) => n + 1)}
              />
            </div>

            {/* 2. Running Total + Hero + Plain Human Explainer */}
            <header className="open-hero">
              <div className="running-total-line" aria-live="polite">
                <span className="live-dot" />
                <span>
                  {state.chainSynced === false
                    ? "Syncing live research total…"
                    : `${formattedResearchTotal} sent to research`}
                </span>
                <span className="running-total-sep" aria-hidden="true" />
                <span className="running-total-town">
                  <Users size={11} /> {state.totalSupply} labs in town
                </span>
              </div>

              <h1 className="open-hero-title">
                Art that <em>funds science.</em>
              </h1>

              <p className="open-explainer">
                Start at $1. Design your researcher, walk around your 3D glass lab, care for your
                pet, fold real proteins, and visit neighbors as every new mint grows the town.
              </p>
            </header>

            {/* 3. Pure Silvery Slider ($1 -> $500) + Mint & Enter 3D World Actions */}
            <div className="open-mint-area">
              <div className="slider-wrap">
                <div className="slider-readout">
                  <span className="slider-dollar">${amountUsd}</span>
                  <span className="slider-hint">{sliderDetailLabel(amountUsd)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={SLIDER_USD_STOPS.length - 1}
                  step={1}
                  value={sliderIndex}
                  onChange={(e) => setSliderIndex(Number(e.target.value))}
                  className="silver-slider"
                  aria-label="Choose price from $1 to $500"
                />
                <div className="slider-bounds">
                  <span>$1</span>
                  <span>$500</span>
                </div>
              </div>

              <div className="open-cta-row">
                <button
                  type="button"
                  className="btn-mint-minimal clickable"
                  disabled={busy}
                  onClick={handleMint}
                >
                  <Sparkles size={16} />
                  {busy ? "Minting…" : "Mint Lab"}
                </button>
                <button
                  type="button"
                  className="btn-silver-glass clickable"
                  onClick={() => navigateTab("mylabs")}
                >
                  <Footprints size={15} />
                  Enter 3D Town
                </button>
              </div>

              {notice && <p className="minimal-note">{notice}</p>}
            </div>
          </main>
        )}

        {page === "explore" && (
          <Suspense fallback={null}>
            <ExploreView
              state={state}
              lastPulseAt={lastPulseAt}
              selectedVessel={exploreSelected}
              onSelectVessel={selectGalleryVessel}
              onOpenInMyLabs={(v) => {
                setVisitHomeLab(null);
                setMyLabTokenId(v.tokenId);
                navigateTab("mylabs");
              }}
              onVisitHomeInMyLabs={(v) => {
                setVisitHomeLab({
                  tokenId: v.tokenId,
                  seed: v.seed,
                  causeId: v.causeId,
                  causeName: v.causeName,
                  minter: v.minter,
                  valueUsd: v.valueUsd,
                  complexityTier: complexityTierFromUsd(v.valueUsd),
                  sectorsMask: v.sectorsMask,
                  workUnits: v.workUnits,
                  ownedByUser: v.ownedByUser
                });
                navigateTab("mylabs");
              }}
            />
          </Suspense>
        )}

        {page === "mylabs" && (
          <Suspense fallback={null}>
            <MyLabsView
              state={state}
              labSparks={labSparks}
              lastPulseAt={lastPulseAt}
              activeTokenId={myLabTokenId}
              initialVisitLab={visitHomeLab}
              onClearInitialVisit={() => setVisitHomeLab(null)}
              onSelectTokenId={setMyLabTokenId}
              onBuildSector={handleBuildSector}
              onUpgradeVessel={handleUpgradeVessel}
              onClaimCoins={handleClaimCoins}
              onDonateCoins={handleDonateCoins}
              onAnchorProof={handleAnchorProof}
              onAwardPlayBonus={handleAwardPlayBonus}
              onConnectWallet={handleConnectWallet}
              onSpendCoinsForTreat={handleSpendSparksForTreat}
              onGoMint={() => setPage("mint")}
            />
          </Suspense>
        )}

        {/* Quiet White Paper Link Pinned at the Very Bottom of the Site */}
        <footer className="quiet-footer">
          <button
            type="button"
            className="footer-link clickable"
            onClick={() => setShowWhitePaper(true)}
          >
            White Paper
          </button>
        </footer>
      </div>

      {showWhitePaper && (
        <Suspense fallback={null}>
          <WhitePaperSheet
            open={showWhitePaper}
            onClose={() => setShowWhitePaper(false)}
            state={state}
            animationUrl={previewAnimationUrl}
            liveCompute={liveCompute}
            onSeedLiquidity={async () => {
              if (!state.contractAddress) return;
              if (!state.walletAddress) {
                setShowWalletModal(true);
                return;
              }
              await executeOnChainSeedLiquidity(state.contractAddress);
              setState((prev) => ({ ...prev, liquiditySeeded: true, liquidityReserveEth: 0 }));
            }}
          />
        </Suspense>
      )}

      {showWalletModal && (
        <Suspense fallback={null}>
          <WalletModal
            open={showWalletModal}
            onClose={() => setShowWalletModal(false)}
            walletAddress={state.walletAddress}
            chainId={state.chainId}
            connecting={walletConnecting}
            error={walletError}
            onConnectProvider={handleConnectProvider}
            onDisconnect={handleDisconnectWallet}
          />
        </Suspense>
      )}
    </>
  );
}

export default App;
