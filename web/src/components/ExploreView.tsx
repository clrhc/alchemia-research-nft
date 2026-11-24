import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Camera,
  Check,
  CloudSnow,
  Coins,
  DoorOpen,
  Download,
  FileJson,
  Flower2,
  Home,
  Layers,
  Link2,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  Volume2,
  VolumeX
} from "lucide-react";
import { ArtworkCanvas, type ArtworkCanvasHandle } from "./ArtworkCanvas";
import { LabPortrait } from "./LabPortrait";
import type { AtmosphereMode, CameraPreset, LightingMood } from "../engine/alchemy3DRenderer";
import { EXTRA_ROOM_DEFS } from "../engine/homeLayout";
import {
  getExpansionBandCount,
  getNeighborhoodGrowthStage,
  getNeighborhoodPlotSlot
} from "../engine/neighborhoodLayout";
import { deriveTraitsFromSeed } from "../engine/prng";
import {
  downloadPDBFromSnapshot,
  downloadScienceCertificateFromSnapshot,
  type ComputeSnapshot
} from "../engine/researchCompute";
import {
  assignSecondaryStructurePSEA,
  computeNativeContactFractionQ,
  downloadMMCIFFromSnapshot
} from "../engine/structuralAnalysis";
import { soundEngine } from "../engine/soundEngine";
import { complexityTierFromUsd, ethToUsd } from "../web3/config";
import { decodeExtraRoomsMask } from "../web3/estateCodec";
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

interface ExploreViewProps {
  state: CollectionState;
  lastPulseAt: number;
  selectedVessel: MintedVessel | null;
  onSelectVessel: (vessel: MintedVessel | null) => void;
  onOpenInMyLabs: (vessel: MintedVessel) => void;
  onVisitHomeInMyLabs?: (vessel: MintedVessel) => void;
}

type GalleryFilter = "all" | "estates" | "rooms" | "science" | "cats" | "dogs";

function getDistrictLabelForToken(tokenId: number): string {
  if (tokenId <= 1) return "Central Plaza";
  return getNeighborhoodPlotSlot(Math.max(0, tokenId - 2)).districtName;
}

function getEstateSummary(vessel: MintedVessel): {
  storyBadge: string;
  sizeLabel: string;
  homelyRooms: ReturnType<typeof decodeExtraRoomsMask>;
  harvests: number;
  estateScore: number;
} {
  const est = vessel.estate;
  const floors = est?.houseFloors ?? 2;
  const hasB1 = est ? est.hasBasement : true;
  const size = est?.houseSize ?? 1;
  const homelyRooms = est ? decodeExtraRoomsMask(est.extraRoomsMask) : [];
  const harvests = est?.gardenHarvests ?? 0;
  const sizeLabel = size === 3 ? "Grand Villa" : size === 2 ? "Courtyard" : "Studio";
  const storyBadge = `${hasB1 ? "B1+" : ""}${floors}F`;
  const estateScore =
    floors * 10 + size * 8 + homelyRooms.length * 6 + countSectors(vessel.sectorsMask) * 4 + harvests;
  return { storyBadge, sizeLabel, homelyRooms, harvests, estateScore };
}

const CAMERA_BUTTONS: Array<{ id: CameraPreset; label: string }> = [
  { id: "iso", label: "3D View" },
  { id: "top", label: "Top Plan" },
  { id: "pet", label: "Pet" },
  { id: "molecule", label: "Protein" }
];

const LIGHTING_ORDER: LightingMood[] = ["daylight", "golden", "silver", "moonlit"];
const LIGHTING_LABELS: Record<LightingMood, string> = {
  daylight: "Day",
  golden: "Golden",
  silver: "Silver",
  moonlit: "Mist"
};
const ATMOSPHERE_ORDER: AtmosphereMode[] = ["clear", "snow", "motes"];
const ATMOSPHERE_LABELS: Record<AtmosphereMode, string> = {
  clear: "Clear",
  snow: "Snow",
  motes: "Motes"
};

export function ExploreView({
  state,
  lastPulseAt,
  selectedVessel,
  onSelectVessel,
  onOpenInMyLabs,
  onVisitHomeInMyLabs
}: ExploreViewProps) {
  const artworkRef = useRef<ArtworkCanvasHandle>(null);
  const [liveCompute, setLiveCompute] = useState<ComputeSnapshot | null>(null);
  const [camPreset, setCamPreset] = useState<{ preset: CameraPreset; seq: number } | null>(null);
  const [lightingMood, setLightingMood] = useState<LightingMood>("daylight");
  const [atmosphereMode, setAtmosphereMode] = useState<AtmosphereMode>("clear");
  const [autoSpin, setAutoSpin] = useState(true);
  const [soundOn, setSoundOn] = useState(() => soundEngine.isEnabled());
  const [tapNote, setTapNote] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [searchId, setSearchId] = useState("");

  useEffect(() => {
    if (!selectedVessel) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "1") setCamPreset((p) => ({ preset: "iso", seq: (p?.seq || 0) + 1 }));
      else if (e.key === "2") setCamPreset((p) => ({ preset: "top", seq: (p?.seq || 0) + 1 }));
      else if (e.key === "3") setCamPreset((p) => ({ preset: "pet", seq: (p?.seq || 0) + 1 }));
      else if (e.key === "4") setCamPreset((p) => ({ preset: "molecule", seq: (p?.seq || 0) + 1 }));
      else if (e.key.toLowerCase() === "m") setSoundOn(soundEngine.toggle());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedVessel]);

  const filteredVessels = useMemo(() => {
    const query = searchId.trim().replace(/^#/, "");
    let list = state.vessels.filter((v) => {
      if (query && !String(v.tokenId).includes(query)) return false;
      const traits = deriveTraitsFromSeed(v.seed);
      const tier = complexityTierFromUsd(v.valueUsd);
      const isDuo = tier >= 4 || hasSector(v.sectorsMask, 3) || traits.familiar.species === "Duo";
      if (filter === "cats") return traits.familiar.species === "Cat" || isDuo;
      if (filter === "dogs") return traits.familiar.species === "Dog" || isDuo;
      return true;
    });

    if (filter === "estates") {
      list = [...list].sort((a, b) => getEstateSummary(b).estateScore - getEstateSummary(a).estateScore);
    } else if (filter === "rooms") {
      list = [...list].sort((a, b) => countSectors(b.sectorsMask) - countSectors(a.sectorsMask));
    } else if (filter === "science") {
      list = [...list].sort((a, b) => b.workUnits - a.workUnits);
    }
    return list;
  }, [state.vessels, filter, searchId]);

  const townStage = useMemo(
    () => getNeighborhoodGrowthStage(Math.max(1, state.totalSupply)),
    [state.totalSupply]
  );
  const expansionBands = useMemo(
    () => getExpansionBandCount(Math.max(0, state.totalSupply - 1) + 4),
    [state.totalSupply]
  );
  const totalCollectionFolds = useMemo(
    () => state.vessels.reduce((sum, v) => sum + (v.workUnits || 0), 0),
    [state.vessels]
  );

  if (selectedVessel) {
    const traits = deriveTraitsFromSeed(selectedVessel.seed);
    const tier = complexityTierFromUsd(selectedVessel.valueUsd);
    const miningRate = computeMiningRatePerHour(
      tier,
      selectedVessel.sectorsMask,
      selectedVessel.workUnits
    );
    const animationUrl = buildAnimationUrl({
      tokenId: selectedVessel.tokenId,
      seed: selectedVessel.seed,
      causeId: selectedVessel.causeId,
      complexityTier: tier,
      sectorsMask: selectedVessel.sectorsMask,
      tokenValueUsd: selectedVessel.valueUsd,
      contractAddress: state.contractAddress || undefined,
      chainId: state.chainId,
      tokenImpactEth: selectedVessel.impactEth,
      globalImpactEth: state.globalDonatedEth,
      totalSupply: state.totalSupply
    });

    const handleCopyShareLink = async () => {
      if (typeof window === "undefined") return;
      const shareUrl = new URL(window.location.href);
      shareUrl.searchParams.set("lab", String(selectedVessel.tokenId));
      try {
        await navigator.clipboard.writeText(shareUrl.toString());
        setCopiedLink(true);
        window.setTimeout(() => setCopiedLink(false), 1800);
      } catch {
        // ignore clipboard blocks
      }
    };

    const cycleLighting = () => {
      const nextIdx = (LIGHTING_ORDER.indexOf(lightingMood) + 1) % LIGHTING_ORDER.length;
      setLightingMood(LIGHTING_ORDER[nextIdx]);
      soundEngine.playTap(987.77);
    };

    const cycleAtmosphere = () => {
      const nextIdx = (ATMOSPHERE_ORDER.indexOf(atmosphereMode) + 1) % ATMOSPHERE_ORDER.length;
      setAtmosphereMode(ATMOSPHERE_ORDER[nextIdx]);
      soundEngine.playTap(1046.5);
    };

    const handleSavePhoto = () => {
      const dataUrl = artworkRef.current?.capturePhoto();
      if (!dataUrl) return;
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `alchemia-lab-${selectedVessel.tokenId}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      soundEngine.playTap(1318.5);
      setTapNote(`Saved photo of Lab #${selectedVessel.tokenId}.`);
    };

    const singleCoords = liveCompute?.bestResidues?.length
      ? liveCompute.bestResidues
      : liveCompute?.residues || [];
    const singleNativeQ =
      liveCompute && singleCoords.length >= 6
        ? computeNativeContactFractionQ(liveCompute.pdbBenchmarkId, singleCoords)
        : null;
    const singleSS = singleCoords.length >= 4 ? assignSecondaryStructurePSEA(singleCoords) : null;

    return (
      <section className="subpage-shell" aria-label={`Lab #${selectedVessel.tokenId}`}>
        <div className="subpage-top-row">
          <button
            type="button"
            className="subtle-pill-btn clickable"
            onClick={() => onSelectVessel(null)}
          >
            <ArrowLeft size={14} />
            Back to gallery
          </button>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="subtle-pill-btn clickable"
              onClick={handleCopyShareLink}
            >
              {copiedLink ? <Check size={13} /> : <Link2 size={13} />}
              {copiedLink ? "Link copied" : "Share lab"}
            </button>

            {selectedVessel.ownedByUser ? (
              <button
                type="button"
                className="btn-mint-minimal clickable"
                style={{ padding: "10px 20px", fontSize: "0.84rem" }}
                onClick={() => onOpenInMyLabs(selectedVessel)}
              >
                <Building2 size={14} />
                Open in My Labs
              </button>
            ) : onVisitHomeInMyLabs ? (
              <button
                type="button"
                className="btn-mint-minimal clickable"
                style={{ padding: "10px 20px", fontSize: "0.84rem" }}
                onClick={() => onVisitHomeInMyLabs(selectedVessel)}
              >
                <DoorOpen size={14} />
                Visit Home in 3D
              </button>
            ) : null}

            <a
              href={animationUrl}
              target="_blank"
              rel="noreferrer"
              className="subtle-pill-btn clickable"
              style={{ textDecoration: "none" }}
            >
              Full screen
              <ArrowUpRight size={13} />
            </a>
          </div>
        </div>

        <div className="single-view-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="floating-model-card">
              <ArtworkCanvas
                ref={artworkRef}
                showHud
                cameraPreset={camPreset}
                lightingMood={lightingMood}
                atmosphereMode={atmosphereMode}
                autoRotate={autoSpin}
                onComputeSnapshot={setLiveCompute}
                onInteractiveEvent={(ev) => {
                  setTapNote(
                    ev.kind === "pet-clicked"
                      ? "Your tap made the pet happy."
                      : ev.kind === "room-clicked"
                        ? `Tapped ${ev.roomName || "lab room"} in 3D.`
                        : ev.combo && ev.combo > 1
                          ? `Proton combo x${ev.combo}.`
                          : "You popped a floating proton."
                  );
                }}
                impact={{
                  tokenId: selectedVessel.tokenId,
                  seed: selectedVessel.seed,
                  causeId: selectedVessel.causeId,
                  causeName: selectedVessel.causeName,
                  tokenValueUsd: selectedVessel.valueUsd,
                  complexityTier: tier,
                  sectorsMask: selectedVessel.sectorsMask,
                  workUnits: selectedVessel.workUnits,
                  tokenImpactEth: selectedVessel.impactEth,
                  causeImpactEth: state.causes[selectedVessel.causeId]?.raisedEth || 0,
                  globalImpactEth: state.globalDonatedEth,
                  totalSupply: state.totalSupply,
                  maxSupply: state.maxSupply,
                  reactionStage: state.reactionStage,
                  mode: state.connectedMode,
                  lastPulseAt
                }}
              />
            </div>

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
                className={`preset-chip clickable ${autoSpin ? "active" : ""}`}
                onClick={() => {
                  setAutoSpin((v) => !v);
                  soundEngine.playTap(880);
                }}
                title="Toggle smooth 3D turntable orbit"
              >
                <RefreshCw size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />
                Spin
              </button>
              <button
                type="button"
                className="preset-chip clickable"
                onClick={handleSavePhoto}
                title="Save PNG snapshot of this 3D lab"
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
            {tapNote && <div className="tap-toast">{tapNote}</div>}
          </div>

          <div className="glass-panel single-info-panel">
            <div className="single-kicker">
              Lab #{selectedVessel.tokenId} · Owner {selectedVessel.minter}
              {selectedVessel.onChain ? " · On-Chain" : ""}
            </div>
            <h2 className="single-title">
              {traits.vessel} with{" "}
              {tier >= 4 || hasSector(selectedVessel.sectorsMask, 3)
                ? "Cat & Dog"
                : traits.familiar.name}
            </h2>
            <p className="single-desc">
              Supports <strong>{selectedVessel.causeName}</strong>. Tap the pet or floating
              particles inside the 3D scene, or switch views to inspect every room.
            </p>

            <div className="single-stats-row">
              <div className="mini-stat">
                <span>Put in</span>
                <strong>${selectedVessel.valueUsd}</strong>
              </div>
              <div className="mini-stat">
                <span>Town District</span>
                <strong>{getDistrictLabelForToken(selectedVessel.tokenId)}</strong>
              </div>
              <div className="mini-stat">
                <span>Architecture</span>
                <strong>
                  {getEstateSummary(selectedVessel).storyBadge} · {getEstateSummary(selectedVessel).sizeLabel}
                </strong>
              </div>
              <div className="mini-stat">
                <span>Coin rate</span>
                <strong>{miningRate} ALCH / hr</strong>
              </div>
            </div>

            {(() => {
              const estInfo = getEstateSummary(selectedVessel);
              return (
                <>
                  <div className="single-section-label">
                    Architect Estate &amp; Homely Rooms ({estInfo.homelyRooms.length}/6 built ·{" "}
                    {estInfo.harvests} garden harvests)
                  </div>
                  <div className="wing-tags">
                    {EXTRA_ROOM_DEFS.map((rm) => {
                      const built = estInfo.homelyRooms.includes(rm.id);
                      return (
                        <span key={rm.id} className={`wing-tag ${built ? "built" : ""}`}>
                          {built ? "● " : "○ "}
                          {rm.name}
                        </span>
                      );
                    })}
                  </div>
                </>
              );
            })()}

            <div className="single-section-label">Lab Wings ({countSectors(selectedVessel.sectorsMask)}/6)</div>
            <div className="wing-tags">
              {LAB_SECTORS.map((sec) => {
                const built = hasSector(selectedVessel.sectorsMask, sec.id);
                return (
                  <span key={sec.id} className={`wing-tag ${built ? "built" : ""}`}>
                    {built ? "● " : "○ "}
                    {sec.shortName}
                  </span>
                );
              })}
            </div>

            <div className="single-section-label">Live protein folding data</div>
            <div className="research-export-box">
              <div className="research-proof-line">
                <span>
                  {liveCompute
                    ? `${liveCompute.taskTitle} · Best ${liveCompute.bestEnergy.toFixed(2)} kcal/mol`
                    : "Starting 3D fold…"}
                </span>
                {liveCompute && (
                  <code>
                    Rg {liveCompute.radiusOfGyration.toFixed(2)}Å ({liveCompute.compactnessMatchPct}% fit)
                    {singleNativeQ !== null ? ` · Native Q ${singleNativeQ}%` : ""} ·{" "}
                    {liveCompute.contactCount} contacts · {liveCompute.proofHash.slice(0, 12)}…
                  </code>
                )}
              </div>
              {liveCompute && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="subtle-pill-btn clickable"
                    onClick={() => downloadPDBFromSnapshot(liveCompute)}
                  >
                    <Download size={13} />
                    .PDB
                  </button>
                  <button
                    type="button"
                    className="subtle-pill-btn clickable"
                    onClick={() => downloadMMCIFFromSnapshot(liveCompute)}
                  >
                    <Download size={13} />
                    .CIF
                  </button>
                  <button
                    type="button"
                    className="subtle-pill-btn clickable"
                    onClick={() =>
                      downloadScienceCertificateFromSnapshot(liveCompute, {
                        nativeContactQ: singleNativeQ ?? undefined,
                        helixPct: singleSS?.helixPct,
                        sheetPct: singleSS?.sheetPct
                      })
                    }
                  >
                    <FileJson size={13} />
                    .JSON
                  </button>
                  <a
                    href={`https://www.rcsb.org/structure/${liveCompute.pdbBenchmarkId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="subtle-pill-btn clickable"
                    style={{ textDecoration: "none" }}
                  >
                    RCSB {liveCompute.pdbBenchmarkId}
                    <ArrowUpRight size={12} />
                  </a>
                </div>
              )}
            </div>

            <div className="single-section-label">Live animation link</div>
            <div className="url-readout">{animationUrl}</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="subpage-shell" aria-label="Gallery">
      <header className="subpage-header">
        <h2 className="subpage-title">Gallery</h2>
        <p className="subpage-sub">
          Open any lab to spin it in 3D, check its rooms, or download its live protein fold.
        </p>
        {state.chainSynced !== false && (
          <div className="explore-town-strip" aria-label="Alchemia Town live collection overview">
            <div className="explore-town-stat">
              <span>Network</span>
              <strong>
                <span
                  className={`mode-dot ${state.connectedMode === "simulation" ? "is-example" : "is-testnet"}`}
                  style={{ display: "inline-block", marginRight: 6 }}
                />
                {state.connectedMode === "simulation"
                  ? "Example Mode"
                  : state.connectedMode === "mainnet"
                    ? "Ethereum Mainnet"
                    : "Base Sepolia Testnet"}
              </strong>
            </div>
            <div className="explore-town-stat">
              <span>Town Stage</span>
              <strong>
                Stage {townStage.level}/5 · {townStage.title}
              </strong>
            </div>
            <div className="explore-town-stat">
              <span>Minted Homes</span>
              <strong>
                {state.totalSupply.toLocaleString()} {state.totalSupply === 1 ? "lab" : "labs"}
                {expansionBands > 0 ? ` · ${expansionBands} outer ring${expansionBands === 1 ? "" : "s"}` : ""}
              </strong>
            </div>
            <div className="explore-town-stat">
              <span>Research Funded</span>
              <strong>
                {ethToUsd(state.globalDonatedEth).toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 2
                })}
              </strong>
            </div>
            <div className="explore-town-stat">
              <span>Verified Folds</span>
              <strong>{totalCollectionFolds.toLocaleString()} units</strong>
            </div>
          </div>
        )}
      </header>

      <div className="gallery-toolbar">
        <div className="gallery-filters" role="tablist" aria-label="Filter gallery">
          {(
            [
              { id: "all", label: "All" },
              { id: "estates", label: "Top Estates" },
              { id: "rooms", label: "Most Wings" },
              { id: "science", label: "Top Science" },
              { id: "cats", label: "Cats" },
              { id: "dogs", label: "Dogs" }
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              className={`preset-chip clickable ${filter === tab.id ? "active" : ""}`}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <label className="gallery-search">
          <Search size={13} />
          <input
            type="text"
            inputMode="numeric"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            placeholder="Find #…"
            aria-label="Search by lab number"
          />
        </label>
      </div>

      {filteredVessels.length === 0 ? (
        <div className="glass-panel" style={{ padding: 28, textAlign: "center" }}>
          <p className="single-desc">
            {state.chainSynced === false
              ? "Loading live labs from the blockchain…"
              : "No labs match that filter."}
          </p>
        </div>
      ) : (
        <div className="explore-grid">
          {filteredVessels.map((vessel) => {
            const traits = deriveTraitsFromSeed(vessel.seed);
            const tier = complexityTierFromUsd(vessel.valueUsd);
            const builtCount = countSectors(vessel.sectorsMask);
            const rate = computeMiningRatePerHour(tier, vessel.sectorsMask, vessel.workUnits);
            const districtName = getDistrictLabelForToken(vessel.tokenId);
            const estInfo = getEstateSummary(vessel);

            return (
              <article
                key={`${vessel.tokenId}-${vessel.seed}`}
                className="glass-panel explore-card clickable"
                role="button"
                tabIndex={0}
                onClick={() => onSelectVessel(vessel)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectVessel(vessel);
                  }
                }}
              >
                <div className="explore-swatch">
                  <LabPortrait
                    traits={traits}
                    tier={tier}
                    alt={`${traits.vessel} #${vessel.tokenId}`}
                    request={{
                      tokenId: vessel.tokenId,
                      seed: vessel.seed,
                      causeId: vessel.causeId,
                      valueUsd: vessel.valueUsd,
                      sectorsMask: vessel.sectorsMask,
                      workUnits: vessel.workUnits,
                      globalImpactEth: state.globalDonatedEth,
                      totalSupply: state.totalSupply
                    }}
                  />

                  <div className="explore-swatch-top">
                    <span className="swatch-pill">#{vessel.tokenId}</span>
                    <span className="swatch-pill">
                      <Layers size={10} /> {estInfo.storyBadge}
                    </span>
                    <span className="swatch-pill">${vessel.valueUsd}</span>
                  </div>

                  <div className="explore-swatch-bottom">
                    <span className="swatch-pill">
                      <Building2 size={11} /> {builtCount}/6 wings
                    </span>
                    <span className="swatch-pill">
                      <Coins size={11} /> {rate}/hr
                    </span>
                  </div>
                </div>

                <div className="explore-card-body">
                  <div className="explore-card-title">
                    <span>{traits.vessel}</span>
                    <span style={{ display: "inline-flex", gap: 4 }}>
                      {vessel.ownedByUser && <span className="owned-tag">Yours</span>}
                      {vessel.onChain && !vessel.ownedByUser && (
                        <span className="chain-tag">On-Chain</span>
                      )}
                    </span>
                  </div>
                  <div className="explore-card-meta">
                    <MapPin size={10} style={{ verticalAlign: "-1px", marginRight: 3 }} />
                    {districtName} ·{" "}
                    {tier >= 4 || hasSector(vessel.sectorsMask, 3)
                      ? "Cat & Dog"
                      : traits.familiar.name}
                  </div>
                  <div className="explore-estate-pills">
                    <span>
                      <Home size={10} /> {estInfo.sizeLabel}
                    </span>
                    {estInfo.homelyRooms.length > 0 && (
                      <span>
                        <Sparkles size={10} /> {estInfo.homelyRooms.length} cozy{" "}
                        {estInfo.homelyRooms.length === 1 ? "room" : "rooms"}
                      </span>
                    )}
                    {estInfo.harvests > 0 && (
                      <span>
                        <Flower2 size={10} /> {estInfo.harvests} blooms
                      </span>
                    )}
                  </div>
                  <div className="room-pip-strip" aria-label={`${builtCount} of 6 rooms built`}>
                    {LAB_SECTORS.map((s) => (
                      <span
                        key={s.id}
                        className="room-pip"
                        style={{
                          background: hasSector(vessel.sectorsMask, s.id)
                            ? s.accent
                            : "rgba(148, 163, 184, 0.28)"
                        }}
                      />
                    ))}
                  </div>
                  <div className="explore-card-foot">
                    <span>
                      Lv.{tier} · {vessel.workUnits} folds
                    </span>
                    <button
                      type="button"
                      className="explore-visit-mini clickable"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (vessel.ownedByUser) onOpenInMyLabs(vessel);
                        else if (onVisitHomeInMyLabs) onVisitHomeInMyLabs(vessel);
                        else onSelectVessel(vessel);
                      }}
                    >
                      <DoorOpen size={11} />
                      {vessel.ownedByUser ? "My Lab" : "Visit 3D"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
