import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Award,
  Building2,
  Check,
  Coins,
  Cookie,
  Download,
  Heart,
  HeartHandshake,
  Pickaxe,
  ShieldCheck,
  Sparkles,
  Wallet
} from "lucide-react";
import { ArtworkCanvas } from "./ArtworkCanvas";
import type { CameraPreset } from "../engine/alchemy3DRenderer";
import { deriveTraitsFromSeed } from "../engine/prng";
import { downloadPDBFromSnapshot, type ComputeSnapshot } from "../engine/researchCompute";
import {
  applyTamagotchiAction,
  companionBoostMultiplier,
  companionMoodLabel,
  loadCompanionVitals,
  saveCompanionVitals,
  type CompanionVitals,
  type TamagotchiAction
} from "../engine/tamagotchi";
import { complexityTierFromUsd } from "../web3/config";
import {
  buildAnimationUrl,
  type CollectionState,
  type MintedVessel
} from "../web3/contractService";
import {
  LAB_SECTORS,
  computeMiningRatePerHour,
  countSectors,
  hasSector
} from "../web3/sectors";

interface MyLabsViewProps {
  state: CollectionState;
  lastPulseAt: number;
  activeTokenId: number | null;
  onSelectTokenId: (tokenId: number) => void;
  onBuildSector: (vessel: MintedVessel, sectorId: number, payWithCoins: boolean) => Promise<void>;
  onClaimCoins: (vessel: MintedVessel, amount: number, researchTithePct: number) => Promise<void>;
  onDonateCoins: (vessel: MintedVessel, amount: number) => Promise<void>;
  onAnchorProof: (vessel: MintedVessel, snap: ComputeSnapshot) => Promise<void>;
  onAwardPlayBonus: (coins: number) => void;
  onConnectWallet: () => Promise<void>;
  onSpendCoinsForTreat: (cost: number) => boolean;
  onGoMint: () => void;
}

const CAMERA_BUTTONS: Array<{ id: CameraPreset; label: string }> = [
  { id: "iso", label: "3D View" },
  { id: "top", label: "Top Plan" },
  { id: "pet", label: "Pet" },
  { id: "molecule", label: "Protein" }
];

export function MyLabsView({
  state,
  lastPulseAt,
  activeTokenId,
  onSelectTokenId,
  onBuildSector,
  onClaimCoins,
  onDonateCoins,
  onAnchorProof,
  onAwardPlayBonus,
  onConnectWallet,
  onSpendCoinsForTreat,
  onGoMint
}: MyLabsViewProps) {
  const userVessels = state.vessels.filter((v) => v.ownedByUser);
  const displayVessels = userVessels.length > 0 ? userVessels : state.vessels.slice(0, 2);
  const isPreviewLab = userVessels.length === 0;
  const selected =
    displayVessels.find((v) => v.tokenId === activeTokenId) || displayVessels[0] || null;

  const [tithePct, setTithePct] = useState(20);
  const [liveSnap, setLiveSnap] = useState<ComputeSnapshot | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [camPreset, setCamPreset] = useState<{ preset: CameraPreset; seq: number } | null>(null);
  const [vitals, setVitals] = useState<CompanionVitals>(() =>
    loadCompanionVitals(selected?.tokenId ?? 1)
  );
  const [tamaSignal, setTamaSignal] = useState<{ action: TamagotchiAction; seq: number } | null>(
    null
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (selected) setVitals(loadCompanionVitals(selected.tokenId));
  }, [selected?.tokenId]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!selected) {
    return (
      <section className="subpage-shell" style={{ textAlign: "center", paddingTop: 60 }}>
        <h2 className="subpage-title">No labs yet</h2>
        <p className="subpage-sub" style={{ margin: "10px auto 24px" }}>
          Mint your first 3D lab starting at $1 to build rooms, mine ALCH coins, and care for your
          pet.
        </p>
        <button type="button" className="btn-mint-minimal clickable" onClick={onGoMint}>
          <Sparkles size={16} />
          Mint your first lab
        </button>
      </section>
    );
  }

  const traits = deriveTraitsFromSeed(selected.seed);
  const tier = complexityTierFromUsd(selected.valueUsd);
  const tamaBoost = companionBoostMultiplier(vitals);
  const baseRate = computeMiningRatePerHour(tier, selected.sectorsMask, selected.workUnits);
  const effectiveMiningRate = Number((baseRate * tamaBoost).toFixed(1));
  const builtCount = countSectors(selected.sectorsMask);

  const elapsedHours = Math.max(0, (nowTick - selected.lastClaimMs) / 3600000);
  const pendingCoins = Number(
    (effectiveMiningRate * Math.max(0.05, elapsedHours * (state.contractAddress ? 1 : 6))).toFixed(2)
  );

  const animationUrl = buildAnimationUrl({
    tokenId: selected.tokenId,
    seed: selected.seed,
    causeId: selected.causeId,
    complexityTier: tier,
    sectorsMask: selected.sectorsMask,
    tokenValueUsd: selected.valueUsd,
    contractAddress: state.contractAddress || undefined,
    chainId: state.chainId,
    tokenImpactEth: selected.impactEth,
    globalImpactEth: state.globalDonatedEth
  });

  const handleTamagotchi = (action: TamagotchiAction) => {
    if (action === "feed") {
      const ok = onSpendCoinsForTreat(5);
      if (!ok) {
        setFeedback("You need 5 ALCH for a treat. Claim your mined coins first.");
        return;
      }
      setFeedback("Treat given. Your pet has more energy now.");
    } else if (action === "pet") {
      setFeedback("Your pet loved that. Mood went up.");
    } else {
      setFeedback("Tossed a glowing ball onto the patio. Watch them play!");
    }
    const next = applyTamagotchiAction(vitals, action);
    setVitals(next);
    saveCompanionVitals(selected.tokenId, next);
    setTamaSignal((prev) => ({ action, seq: (prev?.seq || 0) + 1 }));
  };

  // Playful interactive lab badges
  const badges = [
    { label: "First Room", earned: builtCount >= 1 },
    { label: "Pet Keeper", earned: vitals.careStreak >= 3 },
    { label: "Research Helper", earned: selected.workUnits >= 5 },
    { label: "Full Campus", earned: builtCount === 6 }
  ];

  return (
    <section className="subpage-shell" aria-label="My Labs">
      <div className="mylabs-topbar">
        <div className="mylabs-switcher">
          {displayVessels.map((v) => (
            <button
              key={v.tokenId}
              type="button"
              className={`preset-chip clickable ${v.tokenId === selected.tokenId ? "active" : ""}`}
              onClick={() => onSelectTokenId(v.tokenId)}
            >
              Lab #{v.tokenId} ({countSectors(v.sectorsMask)}/6)
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div className="coin-balance-pill">
            <Coins size={14} />
            <strong>{state.userCoinBalance.toFixed(1)} ALCH</strong>
          </div>
          {!state.walletAddress ? (
            <button
              type="button"
              className="subtle-pill-btn clickable"
              onClick={() => void onConnectWallet()}
            >
              <Wallet size={13} />
              Connect wallet
            </button>
          ) : (
            <span className="coin-balance-pill" style={{ fontSize: "0.75rem" }}>
              {state.walletAddress.slice(0, 6)}…{state.walletAddress.slice(-4)}
            </span>
          )}
        </div>
      </div>

      {isPreviewLab && (
        <div className="mylabs-feedback" role="status">
          <span>
            Trying live Base Sepolia Lab #{selected.tokenId}. Connect your wallet or{" "}
            <button
              type="button"
              onClick={onGoMint}
              style={{
                fontSize: "inherit",
                textDecoration: "underline",
                color: "var(--ink-primary)",
                padding: 0
              }}
            >
              mint your own for $1
            </button>{" "}
            to keep your rooms on-chain.
          </span>
        </div>
      )}

      {feedback && (
        <div className="mylabs-feedback" role="status">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)}>
            ×
          </button>
        </div>
      )}

      <div className="mylabs-grid">
        {/* Left: Interactive 3D Lab + Camera Presets + Pet Care */}
        <div className="mylabs-left">
          <div className="floating-model-card">
            <ArtworkCanvas
              showHud
              cameraPreset={camPreset}
              tamagotchiSignal={tamaSignal}
              onComputeSnapshot={setLiveSnap}
              onInteractiveEvent={(ev) => {
                if (ev.kind === "pet-clicked") {
                  const next = applyTamagotchiAction(vitals, "pet");
                  setVitals(next);
                  saveCompanionVitals(selected.tokenId, next);
                  onAwardPlayBonus(ev.bonusCoins);
                  setFeedback(`Petted in 3D! Mood up and +${ev.bonusCoins} ALCH spark.`);
                } else {
                  onAwardPlayBonus(ev.bonusCoins);
                  setFeedback(`Popped a floating proton! +${ev.bonusCoins} ALCH spark.`);
                }
              }}
              impact={{
                tokenId: selected.tokenId,
                seed: selected.seed,
                causeId: selected.causeId,
                causeName: selected.causeName,
                tokenValueUsd: selected.valueUsd,
                complexityTier: tier,
                sectorsMask: selected.sectorsMask,
                tokenImpactEth: selected.impactEth,
                causeImpactEth: state.causes[selected.causeId]?.raisedEth || 0,
                globalImpactEth: state.globalDonatedEth,
                totalSupply: state.totalSupply,
                maxSupply: state.maxSupply,
                reactionStage: state.reactionStage,
                mode: state.connectedMode,
                lastPulseAt
              }}
            />
          </div>

          {/* Architect Camera Presets */}
          <div className="camera-bar">
            {CAMERA_BUTTONS.map((btn) => (
              <button
                key={btn.id}
                type="button"
                className="preset-chip clickable"
                onClick={() =>
                  setCamPreset((prev) => ({ preset: btn.id, seq: (prev?.seq || 0) + 1 }))
                }
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Pet Care Card */}
          <div className="glass-panel tama-card">
            <div className="tama-head">
              <div>
                <div className="tama-title">
                  {tier >= 4 || hasSector(selected.sectorsMask, 3)
                    ? "Cat & Dog"
                    : traits.familiar.name}
                </div>
                <div className="tama-sub">
                  Level {vitals.level} · {companionMoodLabel(vitals)} ·{" "}
                  <strong>{tamaBoost}x</strong> lab speed
                </div>
              </div>
              <a
                href={animationUrl}
                target="_blank"
                rel="noreferrer"
                className="subtle-pill-btn clickable"
                style={{ textDecoration: "none", padding: "7px 12px", fontSize: "0.75rem" }}
              >
                Full screen
                <ArrowUpRight size={12} />
              </a>
            </div>

            <div className="tama-bars">
              <div className="tama-bar-item">
                <span>Food</span>
                <div className="mini-track">
                  <div className="mini-fill" style={{ width: `${vitals.energy}%`, background: "#10b981" }} />
                </div>
              </div>
              <div className="tama-bar-item">
                <span>Happy</span>
                <div className="mini-track">
                  <div className="mini-fill" style={{ width: `${vitals.mood}%`, background: "#f472b6" }} />
                </div>
              </div>
              <div className="tama-bar-item">
                <span>Play</span>
                <div className="mini-track">
                  <div className="mini-fill" style={{ width: `${vitals.curiosity}%`, background: "#5b8def" }} />
                </div>
              </div>
            </div>

            <div className="tama-actions">
              <button
                type="button"
                className="subtle-pill-btn clickable"
                onClick={() => handleTamagotchi("feed")}
              >
                <Cookie size={13} />
                Feed (5 ALCH)
              </button>
              <button
                type="button"
                className="subtle-pill-btn clickable"
                onClick={() => handleTamagotchi("pet")}
              >
                <Heart size={13} />
                Pet
              </button>
              <button
                type="button"
                className="subtle-pill-btn clickable"
                onClick={() => handleTamagotchi("play")}
              >
                <Sparkles size={13} />
                Play
              </button>
            </div>

            <div className="badge-row">
              {badges.map((b) => (
                <span key={b.label} className={`badge-chip ${b.earned ? "earned" : ""}`}>
                  <Award size={11} />
                  {b.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Coin Mining + Build New Rooms */}
        <div className="mylabs-right">
          <div className="glass-panel mining-panel">
            <div className="mining-head">
              <div>
                <div className="single-kicker">
                  <Pickaxe size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                  Coin Mining &amp; Protein Folding
                </div>
                <div className="mining-big">
                  {pendingCoins.toFixed(2)} <span>ALCH ready</span>
                </div>
              </div>
              <div className="mining-rate-badge">{effectiveMiningRate} ALCH / hr</div>
            </div>

            <div className="tithe-slider-row">
              <div className="tithe-label">
                <span>Send part of your claim to researchers</span>
                <strong>{tithePct}% to research</strong>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                step={5}
                value={tithePct}
                onChange={(e) => setTithePct(Number(e.target.value))}
                className="silver-slider"
                aria-label="Percent of mined coins shared with researchers"
              />
            </div>

            <div className="mining-buttons">
              <button
                type="button"
                className="btn-mint-minimal clickable"
                style={{ padding: "11px 22px", fontSize: "0.86rem" }}
                onClick={async () => {
                  await onClaimCoins(selected, pendingCoins, tithePct);
                  setFeedback(
                    `Claimed ${(pendingCoins * (1 - tithePct / 100)).toFixed(1)} ALCH and sent ${(
                      pendingCoins *
                      (tithePct / 100)
                    ).toFixed(1)} ALCH to researchers.`
                  );
                }}
              >
                <Coins size={15} />
                Claim ALCH
              </button>

              <button
                type="button"
                className="subtle-pill-btn clickable"
                onClick={async () => {
                  if (state.userCoinBalance < 25) {
                    setFeedback("Claim at least 25 ALCH first to donate.");
                    return;
                  }
                  await onDonateCoins(selected, 25);
                  setFeedback("Sent 25 ALCH straight to the research wallet.");
                }}
              >
                <HeartHandshake size={14} />
                Donate 25 ALCH
              </button>

              {liveSnap && (
                <>
                  <button
                    type="button"
                    className="subtle-pill-btn clickable"
                    onClick={() => downloadPDBFromSnapshot(liveSnap)}
                  >
                    <Download size={14} />
                    Download .PDB
                  </button>
                  <button
                    type="button"
                    className="subtle-pill-btn clickable"
                    onClick={async () => {
                      try {
                        await onAnchorProof(selected, liveSnap);
                        setFeedback(
                          `Saved fold proof (${liveSnap.proofHash.slice(0, 12)}…) on-chain.`
                        );
                      } catch (err) {
                        setFeedback(
                          err instanceof Error ? err.message : "Connect the owner wallet to save on-chain."
                        );
                      }
                    }}
                  >
                    <ShieldCheck size={14} />
                    Save proof
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Sims-Style Room Builder */}
          <div className="glass-panel builder-panel">
            <div className="builder-head">
              <h3>
                <Building2 size={16} /> Build new rooms
              </h3>
              <span>{builtCount} of 6 built</span>
            </div>

            <div className="sector-grid">
              {LAB_SECTORS.map((sector) => {
                const built = hasSector(selected.sectorsMask, sector.id);
                const canAffordCoins = state.userCoinBalance >= sector.coinCost;

                return (
                  <div key={sector.id} className={`sector-card ${built ? "is-built" : ""}`}>
                    <div className="sector-top">
                      <span className="sector-name">
                        <span className="cause-dot" style={{ background: sector.accent }} />
                        {sector.name}
                      </span>
                      <span className="sector-bonus">+{sector.miningBonusPerHour} ALCH/hr</span>
                    </div>

                    <p className="sector-desc">{sector.role}</p>

                    <div className="sector-bottom">
                      <span className="sector-effect">{sector.researchEffect}</span>
                      {built ? (
                        <span className="built-pill">
                          <Check size={12} /> Built
                        </span>
                      ) : (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            className="sector-btn clickable"
                            disabled={!canAffordCoins}
                            onClick={async () => {
                              await onBuildSector(selected, sector.id, true);
                              setFeedback(`Added ${sector.name} to Lab #${selected.tokenId}.`);
                            }}
                          >
                            {sector.coinCost} ALCH
                          </button>
                          <button
                            type="button"
                            className="sector-btn eth clickable"
                            onClick={async () => {
                              await onBuildSector(selected, sector.id, false);
                              setFeedback(`Added ${sector.name} to Lab #${selected.tokenId}.`);
                            }}
                          >
                            ${sector.ethCostUsd}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
