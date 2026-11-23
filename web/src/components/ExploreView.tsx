import { useState } from "react";
import { ArrowLeft, ArrowUpRight, Building2, Coins, Download, FlaskConical } from "lucide-react";
import { ArtworkCanvas } from "./ArtworkCanvas";
import { deriveTraitsFromSeed } from "../engine/prng";
import { downloadPDBFromSnapshot, type ComputeSnapshot } from "../engine/researchCompute";
import {
  COMPLEXITY_TIER_NAMES,
  complexityTierFromUsd,
  usdToEth
} from "../web3/config";
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

export function ExploreView({
  state,
  lastPulseAt,
  selectedVessel,
  onSelectVessel,
  onOpenInMyLabs
}: ExploreViewProps) {
  const [liveCompute, setLiveCompute] = useState<ComputeSnapshot | null>(null);

  // Single NFT Detail View showing live interactive 3D animation_url
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

    return (
      <section className="subpage-shell" aria-label={`Single view for Lab #${selectedVessel.tokenId}`}>
        <div className="subpage-top-row">
          <button
            type="button"
            className="subtle-pill-btn clickable"
            onClick={() => onSelectVessel(null)}
          >
            <ArrowLeft size={14} />
            All Labs
          </button>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {selectedVessel.ownedByUser && (
              <button
                type="button"
                className="btn-mint-minimal clickable"
                style={{ padding: "10px 20px", fontSize: "0.84rem" }}
                onClick={() => onOpenInMyLabs(selectedVessel)}
              >
                <Building2 size={14} />
                Upgrade in My Labs
              </button>
            )}
            <a
              href={animationUrl}
              target="_blank"
              rel="noreferrer"
              className="subtle-pill-btn clickable"
              style={{ textDecoration: "none" }}
            >
              Open animation_url
              <ArrowUpRight size={13} />
            </a>
          </div>
        </div>

        <div className="single-view-grid">
          <div className="floating-model-card">
            <ArtworkCanvas
              showHud
              onComputeSnapshot={setLiveCompute}
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

          <div className="glass-panel single-info-panel">
            <div className="single-kicker">
              Alchemia Lab #{selectedVessel.tokenId} · Owned by {selectedVessel.minter}
            </div>
            <h2 className="single-title">
              {traits.vessel} &amp;{" "}
              {tier >= 4 || hasSector(selectedVessel.sectorsMask, 3)
                ? "Harmonic Cat & Dog Duo"
                : traits.familiar.name}
            </h2>
            <p className="single-desc">
              This living 3D architectural lab contributes to{" "}
              <strong>{selectedVessel.causeName}</strong> while continuously computing real
              open-science 3D protein folding conformations and mining <strong>$ALCH</strong>.
            </p>

            <div className="single-stats-row">
              <div className="mini-stat">
                <span>Contribution</span>
                <strong>${selectedVessel.valueUsd}</strong>
              </div>
              <div className="mini-stat">
                <span>Complexity</span>
                <strong>{COMPLEXITY_TIER_NAMES[tier]}</strong>
              </div>
              <div className="mini-stat">
                <span>Mining Output</span>
                <strong>{miningRate} $ALCH/hr</strong>
              </div>
              <div className="mini-stat">
                <span>Built Wings</span>
                <strong>{countSectors(selectedVessel.sectorsMask)} / 6</strong>
              </div>
            </div>

            <div className="single-section-label">Installed Architectural Wings</div>
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

            <div className="single-section-label">Live Open-Science Research Export</div>
            <div className="research-export-box">
              <div className="research-proof-line">
                <span>
                  {liveCompute
                    ? `ΔG ${liveCompute.bestEnergy.toFixed(2)} kcal/mol · Rg ${liveCompute.radiusOfGyration.toFixed(1)}Å · ${liveCompute.opsPerSecond} evals/s`
                    : "Running 3D AB-Model Protein Folding…"}
                </span>
                {liveCompute && (
                  <code>SHA-256: {liveCompute.proofHash.slice(0, 18)}…</code>
                )}
              </div>
              {liveCompute && (
                <button
                  type="button"
                  className="subtle-pill-btn clickable"
                  onClick={() => downloadPDBFromSnapshot(liveCompute)}
                >
                  <Download size={13} />
                  Download .PDB Structure
                </button>
              )}
            </div>

            <div className="single-section-label">Direct ERC-721 animation_url</div>
            <div className="url-readout">{animationUrl}</div>
          </div>
        </div>
      </section>
    );
  }

  // All NFTs Gallery Grid
  return (
    <section className="subpage-shell" aria-label="Explore all Alchemia Labs">
      <header className="subpage-header">
        <h2 className="subpage-title">Explore All Living Labs</h2>
        <p className="subpage-sub">
          Click any laboratory to open its live interactive 3D artwork, inspect its built wings, and
          download its real computed protein-folding data.
        </p>
      </header>

      <div className="explore-grid">
        {state.vessels.map((vessel) => {
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
              {/* Crisp Stylized Architectural Card Preview Swatch */}
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

                {/* Minimal Architectural Concentric Orb & Wing Indicator */}
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
                    <Building2 size={11} /> {builtCount}/6 Wings
                  </span>
                  <span className="swatch-pill">
                    <Coins size={11} /> {rate}/hr
                  </span>
                </div>
              </div>

              <div className="explore-card-body">
                <div className="explore-card-title">
                  {traits.vessel}
                  {vessel.ownedByUser && <span className="owned-tag">Yours</span>}
                </div>
                <div className="explore-card-meta">
                  {tier >= 4 || hasSector(vessel.sectorsMask, 3)
                    ? "Harmonic Cat & Dog Duo"
                    : traits.familiar.name}{" "}
                  · {vessel.causeName.split(" ")[0]}
                </div>
                <div className="explore-card-foot">
                  <span>Tier {tier}/5</span>
                  <span>{(usdToEth(vessel.valueUsd) * 0.6).toFixed(4)} ETH → lab</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
