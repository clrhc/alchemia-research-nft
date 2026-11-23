import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Check,
  Coins,
  Download,
  FileJson,
  FlaskConical,
  Link2,
  Search,
  Sun,
  Volume2,
  VolumeX
} from "lucide-react";
import { ArtworkCanvas } from "./ArtworkCanvas";
import type { CameraPreset, LightingMood } from "../engine/alchemy3DRenderer";
import { deriveTraitsFromSeed } from "../engine/prng";
import {
  downloadPDBFromSnapshot,
  downloadScienceCertificateFromSnapshot,
  type ComputeSnapshot
} from "../engine/researchCompute";
import { soundEngine } from "../engine/soundEngine";
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

interface ExploreViewProps {
  state: CollectionState;
  lastPulseAt: number;
  selectedVessel: MintedVessel | null;
  onSelectVessel: (vessel: MintedVessel | null) => void;
  onOpenInMyLabs: (vessel: MintedVessel) => void;
}

type GalleryFilter = "all" | "rooms" | "science" | "cats" | "dogs";

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

export function ExploreView({
  state,
  lastPulseAt,
  selectedVessel,
  onSelectVessel,
  onOpenInMyLabs
}: ExploreViewProps) {
  const [liveCompute, setLiveCompute] = useState<ComputeSnapshot | null>(null);
  const [camPreset, setCamPreset] = useState<{ preset: CameraPreset; seq: number } | null>(null);
  const [lightingMood, setLightingMood] = useState<LightingMood>("daylight");
  const [soundOn, setSoundOn] = useState(() => soundEngine.isEnabled());
  const [tapNote, setTapNote] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [searchId, setSearchId] = useState("");

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

    if (filter === "rooms") {
      list = [...list].sort((a, b) => countSectors(b.sectorsMask) - countSectors(a.sectorsMask));
    } else if (filter === "science") {
      list = [...list].sort((a, b) => b.workUnits - a.workUnits);
    }
    return list;
  }, [state.vessels, filter, searchId]);

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
      globalImpactEth: state.globalDonatedEth
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

            {selectedVessel.ownedByUser && (
              <button
                type="button"
                className="btn-mint-minimal clickable"
                style={{ padding: "10px 20px", fontSize: "0.84rem" }}
                onClick={() => onOpenInMyLabs(selectedVessel)}
              >
                <Building2 size={14} />
                Open in My Labs
              </button>
            )}

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
                showHud
                cameraPreset={camPreset}
                lightingMood={lightingMood}
                onComputeSnapshot={setLiveCompute}
                onInteractiveEvent={(ev) => {
                  setTapNote(
                    ev.kind === "pet-clicked"
                      ? "Your tap made the pet happy."
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
                <span>Detail level</span>
                <strong>Level {tier} of 5</strong>
              </div>
              <div className="mini-stat">
                <span>Coin rate</span>
                <strong>{miningRate} ALCH / hr</strong>
              </div>
              <div className="mini-stat">
                <span>Rooms built</span>
                <strong>{countSectors(selectedVessel.sectorsMask)} of 6</strong>
              </div>
            </div>

            <div className="single-section-label">Rooms in this lab</div>
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
                    Rg {liveCompute.radiusOfGyration.toFixed(2)}Å ({liveCompute.compactnessMatchPct}% fit) ·{" "}
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
                    onClick={() => downloadScienceCertificateFromSnapshot(liveCompute)}
                  >
                    <FileJson size={13} />
                    .JSON
                  </button>
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
      </header>

      <div className="gallery-toolbar">
        <div className="gallery-filters" role="tablist" aria-label="Filter gallery">
          {(
            [
              { id: "all", label: "All" },
              { id: "rooms", label: "Most Rooms" },
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
          <p className="single-desc">No labs match that filter.</p>
        </div>
      ) : (
        <div className="explore-grid">
          {filteredVessels.map((vessel) => {
            const traits = deriveTraitsFromSeed(vessel.seed);
            const tier = complexityTierFromUsd(vessel.valueUsd);
            const builtCount = countSectors(vessel.sectorsMask);
            const rate = computeMiningRatePerHour(tier, vessel.sectorsMask, vessel.workUnits);

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
                <div
                  className="explore-swatch"
                  style={{
                    background: `radial-gradient(circle at 30% 25%, #ffffff 0%, ${traits.palette.bgBottom} 58%, ${traits.palette.liquidTop}44 100%)`
                  }}
                >
                  <div className="explore-swatch-top">
                    <span className="swatch-pill">#{vessel.tokenId}</span>
                    <span className="swatch-pill">${vessel.valueUsd}</span>
                  </div>

                  <div className="explore-orb-visual" aria-hidden="true">
                    <div
                      className="explore-orb-ring"
                      style={{ borderColor: traits.palette.liquidMid + "66" }}
                    />
                    <div
                      className="explore-orb-core"
                      style={{
                        background: `linear-gradient(135deg, ${traits.palette.liquidTop}, ${traits.palette.liquidMid})`
                      }}
                    >
                      <FlaskConical size={22} color="#ffffff" />
                    </div>
                  </div>

                  <div className="explore-swatch-bottom">
                    <span className="swatch-pill">
                      <Building2 size={11} /> {builtCount}/6 rooms
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
                    {tier >= 4 || hasSector(vessel.sectorsMask, 3)
                      ? "Cat & Dog"
                      : traits.familiar.name}
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
                    <span>Level {tier}</span>
                    <span>{vessel.workUnits} folds saved</span>
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
