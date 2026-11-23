import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpCircle,
  ArrowUpRight,
  Award,
  Building2,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  CloudSnow,
  Coins,
  Cookie,
  Cpu,
  Download,
  FileJson,
  Flame,
  Grid2x2,
  Heart,
  HeartHandshake,
  ListChecks,
  Pencil,
  Pickaxe,
  ShieldCheck,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
  Wallet
} from "lucide-react";
import { ArtworkCanvas, type ArtworkCanvasHandle } from "./ArtworkCanvas";
import { ContactMapSvg } from "./ContactMapSvg";
import type { AtmosphereMode, CameraPreset, LightingMood } from "../engine/alchemy3DRenderer";
import { deriveTraitsFromSeed } from "../engine/prng";
import {
  PROTEIN_BENCHMARKS,
  downloadPDBFromSnapshot,
  downloadScienceCertificateFromSnapshot,
  type ComputeSnapshot
} from "../engine/researchCompute";
import {
  assignSecondaryStructurePSEA,
  computeContactMap,
  computeNativeContactFractionQ,
  downloadMMCIFFromSnapshot
} from "../engine/structuralAnalysis";
import { soundEngine } from "../engine/soundEngine";
import {
  applyTamagotchiAction,
  companionBoostMultiplier,
  companionMoodLabel,
  loadCompanionVitals,
  saveCompanionVitals,
  setCompanionPetName,
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
  labSparks: number;
  lastPulseAt: number;
  activeTokenId: number | null;
  onSelectTokenId: (tokenId: number) => void;
  onBuildSector: (vessel: MintedVessel, sectorId: number, payWithCoins: boolean) => Promise<void>;
  onUpgradeVessel: (vessel: MintedVessel, addedUsd: number) => Promise<void>;
  onClaimCoins: (vessel: MintedVessel, amount: number, researchTithePct: number) => Promise<void>;
  onDonateCoins: (vessel: MintedVessel, amount: number) => Promise<void>;
  onAnchorProof: (vessel: MintedVessel, snap: ComputeSnapshot) => Promise<void>;
  onAwardPlayBonus: (sparks: number) => void;
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

type GoalKey = "pet" | "proton" | "fold" | "claim" | "room";
const LAB_GOALS_KEY = "alchemia.lab.goals.v1";

function loadGoals(): Record<GoalKey, boolean> {
  const empty: Record<GoalKey, boolean> = {
    pet: false,
    proton: false,
    fold: false,
    claim: false,
    room: false
  };
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(LAB_GOALS_KEY);
    if (!raw) return empty;
    return { ...empty, ...(JSON.parse(raw) as Partial<Record<GoalKey, boolean>>) };
  } catch {
    return empty;
  }
}

function EnergySparkline({ history }: { history: number[] }) {
  if (history.length < 3) return null;
  const minE = Math.min(...history) - 0.5;
  const maxE = Math.max(...history) + 0.5;
  const span = Math.max(1, maxE - minE);
  const w = 220;
  const h = 38;
  const pts = history
    .map((val, i) => {
      const x = (i / (history.length - 1)) * w;
      const y = h - 4 - ((val - minE) / span) * (h - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="energy-sparkline"
      aria-label="Live protein energy curve"
    >
      <polyline
        fill="none"
        stroke="#5b8def"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
}

export function MyLabsView({
  state,
  labSparks,
  lastPulseAt,
  activeTokenId,
  onSelectTokenId,
  onBuildSector,
  onUpgradeVessel,
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

  const artworkRef = useRef<ArtworkCanvasHandle>(null);
  const [tithePct, setTithePct] = useState(20);
  const [donateAmt, setDonateAmt] = useState(25);
  const [liveSnap, setLiveSnap] = useState<ComputeSnapshot | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [camPreset, setCamPreset] = useState<{ preset: CameraPreset; seq: number } | null>(null);
  const [lightingMood, setLightingMood] = useState<LightingMood>("daylight");
  const [atmosphereMode, setAtmosphereMode] = useState<AtmosphereMode>("clear");
  const [soundOn, setSoundOn] = useState(() => soundEngine.isEnabled());
  const [previewSectorId, setPreviewSectorId] = useState<number | null>(null);
  const [selectedBenchmark, setSelectedBenchmark] = useState<number | null>(null);
  const [foldSignal, setFoldSignal] = useState<{ action: "wiggle" | "shake"; seq: number } | null>(
    null
  );
  const [showContactMap, setShowContactMap] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [goals, setGoals] = useState<Record<GoalKey, boolean>>(() => loadGoals());
  const [editingPetName, setEditingPetName] = useState(false);
  const [petNameDraft, setPetNameDraft] = useState("");
  const [vitals, setVitals] = useState<CompanionVitals>(() =>
    loadCompanionVitals(selected?.tokenId ?? 1)
  );
  const [tamaSignal, setTamaSignal] = useState<{ action: TamagotchiAction; seq: number } | null>(
    null
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  const markGoalDone = (key: GoalKey) => {
    setGoals((prev) => {
      if (prev[key]) return prev;
      const next = { ...prev, [key]: true };
      try {
        window.localStorage.setItem(LAB_GOALS_KEY, JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      if (Object.values(next).every(Boolean)) {
        onAwardPlayBonus(5);
        setFeedback("All 5 lab goals finished. +5 bonus sparks.");
      }
      return next;
    });
  };

  useEffect(() => {
    if (selected) {
      const loaded = loadCompanionVitals(selected.tokenId);
      setVitals(loaded);
      setPetNameDraft(loaded.petName);
      setEditingPetName(false);
      setSelectedBenchmark(null);
      setPreviewSectorId(null);
    }
  }, [selected?.tokenId]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Whisper-quiet keyboard shortcuts (1-4 camera views, M sound, Space play ball)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "1") setCamPreset((p) => ({ preset: "iso", seq: (p?.seq || 0) + 1 }));
      else if (e.key === "2") setCamPreset((p) => ({ preset: "top", seq: (p?.seq || 0) + 1 }));
      else if (e.key === "3") setCamPreset((p) => ({ preset: "pet", seq: (p?.seq || 0) + 1 }));
      else if (e.key === "4") setCamPreset((p) => ({ preset: "molecule", seq: (p?.seq || 0) + 1 }));
      else if (e.key.toLowerCase() === "m") setSoundOn(soundEngine.toggle());
      else if (e.code === "Space" && tag !== "BUTTON" && tag !== "A") {
        e.preventDefault();
        setTamaSignal((prev) => ({ action: "play", seq: (prev?.seq || 0) + 1 }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const structuralStats = useMemo(() => {
    const coords = liveSnap?.bestResidues?.length ? liveSnap.bestResidues : liveSnap?.residues || [];
    if (coords.length < 4 || !liveSnap) return null;
    return {
      ss: assignSecondaryStructurePSEA(coords),
      contacts: computeContactMap(coords),
      nativeQ: computeNativeContactFractionQ(liveSnap.pdbBenchmarkId, coords)
    };
  }, [liveSnap]);

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

  // Exact on-chain pending interpolation when synced from Base Sepolia / Mainnet
  let pendingCoins: number;
  if (
    selected.onChain &&
    typeof selected.onChainPendingCoins === "number" &&
    typeof selected.syncedAtMs === "number"
  ) {
    const sinceSyncHours = Math.max(0, (nowTick - selected.syncedAtMs) / 3600000);
    const rate = selected.onChainMiningRate ?? baseRate;
    pendingCoins = Number((selected.onChainPendingCoins + rate * sinceSyncHours).toFixed(4));
  } else {
    const elapsedHours = Math.max(0, (nowTick - selected.lastClaimMs) / 3600000);
    pendingCoins = Number((effectiveMiningRate * Math.max(0.05, elapsedHours * 6)).toFixed(2));
  }

  const defaultPetLabel =
    tier >= 4 || hasSector(selected.sectorsMask, 3) ? "Cat & Dog" : traits.familiar.name;
  const petDisplayName = vitals.petName || defaultPetLabel;

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
        setFeedback("You need 5 sparks for treats. Tap your pet or pop floating protons in 3D.");
        return;
      }
      setFeedback("Treats dropped on the patio. Watch your pet trot over.");
    } else if (action === "pet") {
      onAwardPlayBonus(1);
      markGoalDone("pet");
      setFeedback("Your pet loved that. +1 spark.");
    } else {
      onAwardPlayBonus(2);
      markGoalDone("pet");
      setFeedback("Tossed a glowing ball onto the patio. +2 sparks.");
    }
    const next = applyTamagotchiAction(vitals, action);
    setVitals(next);
    saveCompanionVitals(selected.tokenId, next);
    setTamaSignal((prev) => ({ action, seq: (prev?.seq || 0) + 1 }));
  };

  const handleSavePetName = () => {
    const next = setCompanionPetName(vitals, petNameDraft);
    setVitals(next);
    saveCompanionVitals(selected.tokenId, next);
    setEditingPetName(false);
    soundEngine.playTap(1046.5);
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
    a.download = `alchemia-lab-${selected.tokenId}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    soundEngine.playTap(1318.5);
    setFeedback(`Saved PNG photo of Lab #${selected.tokenId}.`);
  };

  const petMoodScore = Math.round((vitals.energy + vitals.mood + vitals.curiosity) / 3);
  const effectiveGoals: Record<GoalKey, boolean> = {
    ...goals,
    room: goals.room || builtCount >= 1
  };
  const goalsDoneCount = Object.values(effectiveGoals).filter(Boolean).length;

  const badges = [
    { label: "First Room", earned: builtCount >= 1 },
    { label: "Pet Keeper", earned: vitals.careStreak >= 3 },
    { label: "Protein Folder", earned: selected.workUnits >= 5 },
    { label: "Coin Sharer", earned: state.totalCoinsDonatedToResearch > 0 },
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
          <div className="coin-balance-pill" title="Play sparks earned by petting and popping protons">
            <Sparkles size={13} />
            <strong>{labSparks} sparks</strong>
          </div>
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
          <button type="button" onClick={() => setFeedback(null)} aria-label="Dismiss notice">
            ×
          </button>
        </div>
      )}

      <div className="mylabs-grid">
        {/* Left: Interactive 3D Lab + Studio Controls + Pet Care */}
        <div className="mylabs-left">
          <div className="floating-model-card">
            <ArtworkCanvas
              ref={artworkRef}
              showHud
              cameraPreset={camPreset}
              lightingMood={lightingMood}
              atmosphereMode={atmosphereMode}
              previewSectorId={previewSectorId}
              benchmarkIndex={selectedBenchmark}
              foldSignal={foldSignal}
              tamagotchiSignal={tamaSignal}
              onComputeSnapshot={setLiveSnap}
              onInteractiveEvent={(ev) => {
                if (ev.kind === "pet-clicked") {
                  const next = applyTamagotchiAction(vitals, "pet");
                  setVitals(next);
                  saveCompanionVitals(selected.tokenId, next);
                  onAwardPlayBonus(ev.bonusCoins);
                  markGoalDone("pet");
                  setFeedback(`Petted ${petDisplayName} in 3D. +${ev.bonusCoins} spark.`);
                } else {
                  onAwardPlayBonus(ev.bonusCoins);
                  markGoalDone("proton");
                  setFeedback(
                    ev.combo && ev.combo > 1
                      ? `Proton combo x${ev.combo}. +${ev.bonusCoins} sparks.`
                      : `Popped a floating proton. +${ev.bonusCoins} sparks.`
                  );
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
                petLevel: vitals.level,
                petMoodScore,
                workUnits: selected.workUnits,
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

          {/* Camera Views + Studio Lighting + Atmosphere + Photo + Sound */}
          <div className="camera-bar">
            {CAMERA_BUTTONS.map((btn) => (
              <button
                key={btn.id}
                type="button"
                className="preset-chip clickable"
                onClick={() => {
                  soundEngine.playTap(880);
                  setCamPreset((prev) => ({ preset: btn.id, seq: (prev?.seq || 0) + 1 }));
                }}
              >
                {btn.label}
              </button>
            ))}
            <button type="button" className="preset-chip clickable" onClick={cycleLighting}>
              <Sun size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />
              {LIGHTING_LABELS[lightingMood]}
            </button>
            <button type="button" className="preset-chip clickable" onClick={cycleAtmosphere}>
              <CloudSnow size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />
              {ATMOSPHERE_LABELS[atmosphereMode]}
            </button>
            <button
              type="button"
              className="preset-chip clickable"
              onClick={handleSavePhoto}
              title="Save PNG snapshot of your 3D lab"
            >
              <Camera size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />
              Photo
            </button>
            <button
              type="button"
              className="preset-chip clickable"
              onClick={() => setSoundOn(soundEngine.toggle())}
              aria-label={soundOn ? "Mute sound" : "Enable sound"}
            >
              {soundOn ? <Volume2 size={12} /> : <VolumeX size={12} />}
            </button>
          </div>

          {/* Pet Care Card */}
          <div className="glass-panel tama-card">
            <div className="tama-head">
              <div>
                {editingPetName ? (
                  <form
                    className="pet-name-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSavePetName();
                    }}
                  >
                    <input
                      type="text"
                      value={petNameDraft}
                      maxLength={22}
                      placeholder={defaultPetLabel}
                      onChange={(e) => setPetNameDraft(e.target.value)}
                      autoFocus
                      className="pet-name-input"
                      aria-label="Pet name"
                    />
                    <button type="submit" className="sector-btn clickable">
                      Save
                    </button>
                  </form>
                ) : (
                  <div className="tama-title-row">
                    <span className="tama-title">{petDisplayName}</span>
                    <button
                      type="button"
                      className="inline-icon-btn clickable"
                      onClick={() => {
                        setPetNameDraft(vitals.petName);
                        setEditingPetName(true);
                      }}
                      title="Rename pet"
                      aria-label="Rename pet"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                )}
                <div className="tama-sub">
                  Level {vitals.level} · {companionMoodLabel(vitals)} ·{" "}
                  <strong>{tamaBoost}x</strong> lab speed ·{" "}
                  <Flame size={11} style={{ verticalAlign: "-1px" }} /> {vitals.dailyStreak}d streak
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
                Feed (5 sparks)
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

        {/* Right: Lab Goals + Coin Mining + Protein Workbench + Sims Room Builder */}
        <div className="mylabs-right">
          {/* Compact Collapsible First-Visit Lab Goals */}
          <div className="glass-panel goals-card">
            <button
              type="button"
              className="goals-toggle clickable"
              onClick={() => setShowGoals((v) => !v)}
              aria-expanded={showGoals}
            >
              <span className="goals-toggle-left">
                <ListChecks size={14} />
                <span>
                  Lab goals · <strong>{goalsDoneCount} of 5</strong>
                </span>
              </span>
              {showGoals ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showGoals && (
              <div className="goals-list">
                {(
                  [
                    { key: "pet", label: "Pet or play with your lab companion" },
                    { key: "proton", label: "Pop a floating proton inside the 3D view" },
                    { key: "fold", label: "Wiggle or shake the live protein chain" },
                    { key: "claim", label: "Claim mined ALCH coins" },
                    { key: "room", label: "Build your first architectural room" }
                  ] as const
                ).map((g) => (
                  <div key={g.key} className={`goal-row ${effectiveGoals[g.key] ? "done" : ""}`}>
                    <span className="goal-check">{effectiveGoals[g.key] ? <Check size={11} /> : null}</span>
                    <span>{g.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coin Mining & Researcher Sharing */}
          <div className="glass-panel mining-panel">
            <div className="mining-head">
              <div>
                <div className="single-kicker">
                  <Pickaxe size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                  Coin Mining · 0% Tax ALCH
                </div>
                <div className="mining-big">
                  {pendingCoins.toFixed(2)} <span>ALCH ready</span>
                </div>
              </div>
              <div className="mining-rate-badge">{effectiveMiningRate} ALCH / hr</div>
            </div>

            <div className="tithe-slider-row">
              <div className="tithe-label">
                <span>Share part of your claim with researchers</span>
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
                  try {
                    await onClaimCoins(selected, pendingCoins, tithePct);
                    soundEngine.playTap(1174.66);
                    markGoalDone("claim");
                    setFeedback(
                      `Claimed ${(pendingCoins * (1 - tithePct / 100)).toFixed(1)} ALCH and sent ${(
                        pendingCoins *
                        (tithePct / 100)
                      ).toFixed(1)} ALCH to researchers.`
                    );
                  } catch (err) {
                    setFeedback(err instanceof Error ? err.message : "Could not claim right now.");
                  }
                }}
              >
                <Coins size={15} />
                Claim ALCH
              </button>

              <div className="donate-quick-group">
                {([10, 25, 100] as const).map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className={`donate-chip clickable ${donateAmt === amt ? "active" : ""}`}
                    onClick={() => setDonateAmt(amt)}
                  >
                    {amt}
                  </button>
                ))}
                <button
                  type="button"
                  className="subtle-pill-btn clickable"
                  onClick={async () => {
                    if (state.userCoinBalance < donateAmt) {
                      setFeedback(`Claim at least ${donateAmt} ALCH first to donate.`);
                      return;
                    }
                    try {
                      await onDonateCoins(selected, donateAmt);
                      soundEngine.playPet();
                      setFeedback(`Sent ${donateAmt} ALCH straight to the research wallet.`);
                    } catch (err) {
                      setFeedback(err instanceof Error ? err.message : "Donation cancelled.");
                    }
                  }}
                >
                  <HeartHandshake size={14} />
                  Donate {donateAmt} ALCH
                </button>
              </div>
            </div>
          </div>

          {/* Real Open-Science Protein Folding Workbench */}
          <div className="glass-panel science-panel">
            <div className="science-head">
              <div>
                <div className="single-kicker">
                  <Cpu size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                  Live Protein Folding
                </div>
                <div className="science-title">
                  {liveSnap ? liveSnap.taskTitle : "Loading protein benchmark…"}
                </div>
              </div>

              <select
                className="protein-select clickable"
                value={selectedBenchmark ?? liveSnap?.benchmarkIndex ?? 0}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  setSelectedBenchmark(idx);
                  soundEngine.playTap(987.77);
                }}
                aria-label="Choose protein benchmark"
              >
                {PROTEIN_BENCHMARKS.map((b) => (
                  <option key={b.pdbId} value={b.id}>
                    {b.shortName} · {b.sequence.length} aa
                  </option>
                ))}
              </select>
            </div>

            {liveSnap && (
              <>
                <p className="science-summary">
                  {PROTEIN_BENCHMARKS[liveSnap.benchmarkIndex]?.humanSummary}
                </p>

                <div className="science-metrics-row">
                  <div className="science-metric">
                    <span>Best energy</span>
                    <strong>{liveSnap.bestEnergy.toFixed(1)} kcal/mol</strong>
                  </div>
                  <div className="science-metric" title="Best-Hummer-Eaton fraction of native protein contacts Q(X)">
                    <span>Native fold Q</span>
                    <strong>{structuralStats ? `${structuralStats.nativeQ}%` : "—"}</strong>
                  </div>
                  <div className="science-metric">
                    <span>Size fit</span>
                    <strong>
                      {liveSnap.radiusOfGyration.toFixed(1)}Å ({liveSnap.compactnessMatchPct}%)
                    </strong>
                  </div>
                  <div className="science-metric">
                    <span>Core burial</span>
                    <strong>{liveSnap.hydrophobicBurialPct}%</strong>
                  </div>
                </div>

                <div className="sparkline-row">
                  <EnergySparkline history={liveSnap.energyHistory} />
                  <div className="sparkline-meta">
                    <span>
                      {liveSnap.opsPerSecond.toLocaleString()} steps/s · {liveSnap.contactCount} contacts
                    </span>
                    {structuralStats ? (
                      <span>
                        Helix {structuralStats.ss.helixPct}% · Sheet {structuralStats.ss.sheetPct}% ·{" "}
                        {liveSnap.replicaSwaps} swaps
                      </span>
                    ) : (
                      <span>
                        {liveSnap.replicaSwaps} swaps · {liveSnap.workUnitsCompleted} rounds
                      </span>
                    )}
                  </div>
                </div>

                {showContactMap && structuralStats && (
                  <ContactMapSvg
                    residueCount={liveSnap.sequenceCode.length}
                    contacts={structuralStats.contacts}
                  />
                )}

                <div className="mining-buttons">
                  <button
                    type="button"
                    className="sector-btn clickable"
                    onClick={() => {
                      setFoldSignal((prev) => ({ action: "wiggle", seq: (prev?.seq || 0) + 1 }));
                      onAwardPlayBonus(1);
                      markGoalDone("fold");
                      setFeedback("Wiggled protein backbone to lower energy. +1 spark.");
                    }}
                  >
                    Wiggle
                  </button>
                  <button
                    type="button"
                    className="sector-btn eth clickable"
                    onClick={() => {
                      setFoldSignal((prev) => ({ action: "shake", seq: (prev?.seq || 0) + 1 }));
                      onAwardPlayBonus(1);
                      markGoalDone("fold");
                      setFeedback("Shook protein chain to explore a fresh fold. +1 spark.");
                    }}
                  >
                    Shake
                  </button>
                  <button
                    type="button"
                    className="subtle-pill-btn clickable"
                    onClick={() => downloadPDBFromSnapshot(liveSnap)}
                  >
                    <Download size={13} />
                    .PDB
                  </button>
                  <button
                    type="button"
                    className="subtle-pill-btn clickable"
                    onClick={() => downloadMMCIFFromSnapshot(liveSnap)}
                  >
                    <Download size={13} />
                    .CIF
                  </button>
                  <button
                    type="button"
                    className="subtle-pill-btn clickable"
                    onClick={() =>
                      downloadScienceCertificateFromSnapshot(liveSnap, {
                        nativeContactQ: structuralStats?.nativeQ,
                        helixPct: structuralStats?.ss.helixPct,
                        sheetPct: structuralStats?.ss.sheetPct
                      })
                    }
                  >
                    <FileJson size={13} />
                    .JSON
                  </button>
                  <button
                    type="button"
                    className="subtle-pill-btn clickable"
                    onClick={() => setShowContactMap((v) => !v)}
                  >
                    <Grid2x2 size={13} />
                    {showContactMap ? "Hide map" : "Contact map"}
                  </button>
                  <a
                    href={`https://www.rcsb.org/structure/${liveSnap.pdbBenchmarkId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="subtle-pill-btn clickable"
                    style={{ textDecoration: "none" }}
                  >
                    RCSB
                    <ArrowUpRight size={12} />
                  </a>
                  <button
                    type="button"
                    className="subtle-pill-btn clickable"
                    onClick={async () => {
                      try {
                        await onAnchorProof(selected, liveSnap);
                        soundEngine.playBuildRoom();
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
                    <ShieldCheck size={13} />
                    Save proof
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Sims-Style Room Builder with 3D Hover Ghost Preview */}
          <div className="glass-panel builder-panel">
            <div className="builder-head">
              <h3>
                <Building2 size={16} /> Build new rooms
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span>{builtCount} of 6 built</span>
                {tier < 5 && (
                  <button
                    type="button"
                    className="sector-btn eth clickable"
                    onClick={async () => {
                      const nextTargetUsd = tier === 1 ? 5 : tier === 2 ? 25 : tier === 3 ? 100 : 500;
                      const delta = Math.max(1, nextTargetUsd - selected.valueUsd);
                      try {
                        await onUpgradeVessel(selected, delta);
                        soundEngine.playBuildRoom();
                        setFeedback(
                          `Upgraded Lab #${selected.tokenId} to Level ${tier + 1} (+$${delta}).`
                        );
                      } catch (err) {
                        setFeedback(err instanceof Error ? err.message : "Upgrade cancelled.");
                      }
                    }}
                  >
                    <ArrowUpCircle size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />
                    Level {tier + 1} (+$
                    {Math.max(
                      1,
                      (tier === 1 ? 5 : tier === 2 ? 25 : tier === 3 ? 100 : 500) -
                        selected.valueUsd
                    )}
                    )
                  </button>
                )}
              </div>
            </div>

            <div className="sector-grid">
              {LAB_SECTORS.map((sector) => {
                const built = hasSector(selected.sectorsMask, sector.id);
                const canAffordCoins = state.userCoinBalance >= sector.coinCost;

                return (
                  <div
                    key={sector.id}
                    className={`sector-card ${built ? "is-built" : ""} ${
                      previewSectorId === sector.id ? "is-previewing" : ""
                    }`}
                    onMouseEnter={() => {
                      if (!built) setPreviewSectorId(sector.id);
                    }}
                    onMouseLeave={() => {
                      if (previewSectorId === sector.id) setPreviewSectorId(null);
                    }}
                    onFocus={() => {
                      if (!built) setPreviewSectorId(sector.id);
                    }}
                    onBlur={() => {
                      if (previewSectorId === sector.id) setPreviewSectorId(null);
                    }}
                  >
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
                              try {
                                await onBuildSector(selected, sector.id, true);
                                setPreviewSectorId(null);
                                markGoalDone("room");
                                setFeedback(`Added ${sector.name} to Lab #${selected.tokenId}.`);
                              } catch (err) {
                                setFeedback(
                                  err instanceof Error ? err.message : "Could not build room."
                                );
                              }
                            }}
                          >
                            {sector.coinCost} ALCH
                          </button>
                          <button
                            type="button"
                            className="sector-btn eth clickable"
                            onClick={async () => {
                              try {
                                await onBuildSector(selected, sector.id, false);
                                setPreviewSectorId(null);
                                markGoalDone("room");
                                setFeedback(`Added ${sector.name} to Lab #${selected.tokenId}.`);
                              } catch (err) {
                                setFeedback(
                                  err instanceof Error ? err.message : "Could not build room."
                                );
                              }
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
