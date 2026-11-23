import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { ArtworkCanvas } from "./components/ArtworkCanvas";
import { BackgroundCanvas } from "./components/BackgroundCanvas";
import { CustomCursor } from "./components/CustomCursor";
import { ExploreView } from "./components/ExploreView";
import { MyLabsView } from "./components/MyLabsView";
import { WhitePaperSheet } from "./components/WhitePaperSheet";
import { type LiveImpactState } from "./engine/alchemyRenderer";
import { randomSeedHex } from "./engine/prng";
import type { ComputeSnapshot } from "./engine/researchCompute";
import { stageFromEth } from "./engine/traits";
import {
  DEFAULT_CAUSES,
  complexityTierFromUsd,
  ethToUsd,
  usdToEth
} from "./web3/config";
import {
  buildAnimationUrl,
  connectInjectedWallet,
  executeOnChainBuildSector,
  executeOnChainClaimCoins,
  executeOnChainDonateCoins,
  executeOnChainMint,
  executeOnChainSubmitResearchProof,
  fetchOnChainCollectionSnapshot,
  loadInitialCollectionState,
  saveDemoState,
  type CollectionState,
  type MintedVessel
} from "./web3/contractService";
import { LAB_SECTORS, SLIDER_USD_STOPS } from "./web3/sectors";

type PageTab = "mint" | "explore" | "mylabs";

export function App() {
  const [page, setPage] = useState<PageTab>("mint");
  const [state, setState] = useState<CollectionState>(() => loadInitialCollectionState());
  const [sliderIndex, setSliderIndex] = useState<number>(0); // 0 -> $1
  const [currentSeed, setCurrentSeed] = useState<`0x${string}`>(
    "0x8a4f91e023c47b89d01f4e5276b98c31456fa234890bcdef1234567890ab0100"
  );
  const [currentTokenId, setCurrentTokenId] = useState<number>(1);
  const [currentCauseId, setCurrentCauseId] = useState<number>(0);
  const [exploreSelected, setExploreSelected] = useState<MintedVessel | null>(null);
  const [myLabTokenId, setMyLabTokenId] = useState<number | null>(1);
  const [liveCompute, setLiveCompute] = useState<ComputeSnapshot | null>(null);

  const [showWhitePaper, setShowWhitePaper] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastPulseAt, setLastPulseAt] = useState(() => Date.now());
  const [bgPulseSignal, setBgPulseSignal] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel !== "undefined") {
      channelRef.current = new BroadcastChannel("alchemia-live-impact");
    }
    return () => channelRef.current?.close();
  }, []);

  useEffect(() => {
    if (!state.contractAddress) return;
    let active = true;
    const sync = async () => {
      try {
        const snap = await fetchOnChainCollectionSnapshot(
          state.contractAddress,
          state.chainId,
          state.walletAddress
        );
        if (!active || !snap) return;
        setState((prev) => {
          const grew =
            typeof snap.globalDonatedEth === "number" &&
            snap.globalDonatedEth > prev.globalDonatedEth + 1e-7;
          if (grew) {
            setLastPulseAt(Date.now());
            setBgPulseSignal((n) => n + 1);
          }
          return { ...prev, ...snap };
        });
      } catch {
        // Keep current view smoothly if public RPC throttles
      }
    };
    sync();
    const id = window.setInterval(sync, 12000);
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

  const handleMint = async () => {
    if (busy) return;
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
        valueUsd: amountUsd,
        impactEth: Number((totalEth * (state.liquiditySeeded ? 0.6667 : 0.6)).toFixed(6)),
        sectorsMask: 0,
        workUnits: 1,
        lastClaimMs: Date.now(),
        mintedAt: Math.floor(Date.now() / 1000),
        txHash
      };

      setCurrentTokenId(tokenId);
      setCurrentSeed(seed);
      setCurrentCauseId(nextCauseId);
      setMyLabTokenId(tokenId);

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
      setNotice(`Minted Lab #${tokenId}! Open My Labs to build wings, mine $ALCH, or care for your companion.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Transaction cancelled.");
    } finally {
      setBusy(false);
    }
  };

  const handleConnectWallet = async () => {
    try {
      const { address, chainId } = await connectInjectedWallet();
      setState((prev) => ({ ...prev, walletAddress: address, chainId }));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Wallet connection cancelled.");
    }
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

    setState((prev) => {
      const next: CollectionState = {
        ...prev,
        userCoinBalance: Number((prev.userCoinBalance + toHolder).toFixed(2)),
        totalCoinsDonatedToResearch: Number((prev.totalCoinsDonatedToResearch + toResearch).toFixed(2)),
        vessels: prev.vessels.map((v) =>
          v.tokenId === vessel.tokenId ? { ...v, lastClaimMs: Date.now() } : v
        )
      };
      saveDemoState(next);
      return next;
    });
    setBgPulseSignal((n) => n + 1);
  };

  const handleDonateCoins = async (vessel: MintedVessel, amount: number) => {
    if (state.contractAddress && state.coinAddress && vessel.ownedByUser) {
      await executeOnChainDonateCoins({
        coinAddress: state.coinAddress,
        researchWallet: state.causes[vessel.causeId]?.recipientLabel || state.contractAddress,
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

  const handleSpendCoinsForTreat = (cost: number): boolean => {
    if (state.userCoinBalance < cost) return false;
    setState((prev) => {
      const next = {
        ...prev,
        userCoinBalance: Number((prev.userCoinBalance - cost).toFixed(2))
      };
      saveDemoState(next);
      return next;
    });
    return true;
  };

  return (
    <>
      <BackgroundCanvas impactPulseSignal={bgPulseSignal} />
      <CustomCursor />

      <div className="open-stage">
        {/* Whisper-Quiet Floating Navigation Links (Zero Panel Box) */}
        <nav className="quiet-nav" aria-label="Site navigation">
          <button
            type="button"
            className={`nav-link clickable ${page === "mint" ? "active" : ""}`}
            onClick={() => {
              setPage("mint");
              setExploreSelected(null);
            }}
          >
            Mint
          </button>
          <button
            type="button"
            className={`nav-link clickable ${page === "explore" ? "active" : ""}`}
            onClick={() => setPage("explore")}
          >
            Explore
          </button>
          <button
            type="button"
            className={`nav-link clickable ${page === "mylabs" ? "active" : ""}`}
            onClick={() => setPage("mylabs")}
          >
            My Labs
          </button>
        </nav>

        {page === "mint" && (
          <main className="open-stack">
            {/* 1. Interactive 3D Architectural Model Card on Top */}
            <div className="floating-model-card" aria-label="Interactive 3D living alchemical artwork">
              <ArtworkCanvas
                impact={previewImpact}
                showHud={false}
                onComputeSnapshot={setLiveCompute}
                onPulseClick={() => setBgPulseSignal((n) => n + 1)}
              />
            </div>

            {/* 2. Running Total + Hero + Human-Legible Explainer (No Panels) */}
            <header className="open-hero">
              <div className="running-total-line" aria-live="polite">
                <span className="live-dot" />
                <span>{formattedResearchTotal} raised for research so far</span>
              </div>

              <h1 className="open-hero-title">
                Help fund <em>real research.</em>
              </h1>

              <p className="open-explainer">
                Turn and explore your own living 3D alchemical laboratory—complete with sculpted
                glass vessels, a small companion you can care for, and real molecular folding
                quietly running inside. Start with a dollar, or slide higher to build an even
                richer world in a single piece.
              </p>
            </header>

            {/* 3. Pure Silvery Slider ($1 -> $500) + Mint Button Underneath (No Box, No Preset Buttons) */}
            <div className="open-mint-area">
              <div className="slider-wrap">
                <div className="slider-readout">
                  <span className="slider-dollar">${amountUsd}</span>
                  <span className="slider-hint">slide to grow complexity</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={SLIDER_USD_STOPS.length - 1}
                  step={1}
                  value={sliderIndex}
                  onChange={(e) => setSliderIndex(Number(e.target.value))}
                  className="silver-slider"
                  aria-label="Choose contribution from $1 to $500"
                />
                <div className="slider-bounds">
                  <span>$1</span>
                  <span>$500</span>
                </div>
              </div>

              <button
                type="button"
                className="btn-mint-minimal clickable"
                disabled={busy}
                onClick={handleMint}
              >
                <Sparkles size={16} />
                {busy ? "Minting…" : "Mint"}
              </button>

              {notice && <p className="minimal-note">{notice}</p>}
            </div>
          </main>
        )}

        {page === "explore" && (
          <ExploreView
            state={state}
            lastPulseAt={lastPulseAt}
            selectedVessel={exploreSelected}
            onSelectVessel={setExploreSelected}
            onOpenInMyLabs={(v) => {
              setMyLabTokenId(v.tokenId);
              setPage("mylabs");
            }}
          />
        )}

        {page === "mylabs" && (
          <MyLabsView
            state={state}
            lastPulseAt={lastPulseAt}
            activeTokenId={myLabTokenId}
            onSelectTokenId={setMyLabTokenId}
            onBuildSector={handleBuildSector}
            onClaimCoins={handleClaimCoins}
            onDonateCoins={handleDonateCoins}
            onAnchorProof={handleAnchorProof}
            onConnectWallet={handleConnectWallet}
            onSpendCoinsForTreat={handleSpendCoinsForTreat}
            onGoMint={() => setPage("mint")}
          />
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

      <WhitePaperSheet
        open={showWhitePaper}
        onClose={() => setShowWhitePaper(false)}
        state={state}
        animationUrl={previewAnimationUrl}
        liveCompute={liveCompute}
      />
    </>
  );
}

export default App;
