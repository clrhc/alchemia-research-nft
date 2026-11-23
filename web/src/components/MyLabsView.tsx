import { Sparkles } from "lucide-react";
import { LabWorldExperience } from "./LabWorldExperience";
import type { NeighborLabSummary } from "../engine/neighborhoodLayout";
import type { ComputeSnapshot } from "../engine/researchCompute";
import { complexityTierFromUsd } from "../web3/config";
import {
  buildAnimationUrl,
  type CollectionState,
  type MintedVessel
} from "../web3/contractService";

interface MyLabsViewProps {
  state: CollectionState;
  labSparks: number;
  lastPulseAt: number;
  activeTokenId: number | null;
  initialVisitLab?: NeighborLabSummary | null;
  onClearInitialVisit?: () => void;
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

export function MyLabsView({
  state,
  labSparks,
  lastPulseAt,
  activeTokenId,
  initialVisitLab,
  onClearInitialVisit,
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

  if (!selected) {
    return (
      <section className="subpage-shell" style={{ textAlign: "center", paddingTop: 60 }}>
        <h2 className="subpage-title">
          {state.chainSynced === false ? "Loading your labs…" : "No labs yet"}
        </h2>
        <p className="subpage-sub" style={{ margin: "10px auto 24px" }}>
          {state.chainSynced === false
            ? "Syncing live labs and ALCH balances from Base Sepolia."
            : "Mint your first 3D lab starting at $1 to walk inside, meet your minted neighborhood, mine ALCH, and care for your pet."}
        </p>
        {state.chainSynced !== false && (
          <button type="button" className="btn-mint-minimal clickable" onClick={onGoMint}>
            <Sparkles size={16} />
            Mint your first lab
          </button>
        )}
      </section>
    );
  }

  const tier = complexityTierFromUsd(selected.valueUsd);
  const animationUrl = buildAnimationUrl({
    tokenId: selected.tokenId,
    seed: selected.seed,
    causeId: selected.causeId,
    complexityTier: tier,
    sectorsMask: selected.sectorsMask,
    tokenValueUsd: selected.valueUsd,
    totalSupply: state.totalSupply,
    contractAddress: state.contractAddress || undefined,
    chainId: state.chainId,
    tokenImpactEth: selected.impactEth,
    globalImpactEth: state.globalDonatedEth
  });

  return (
    <section className="mylabs-world-shell" aria-label="My Labs Interactive 3D World">
      <LabWorldExperience
        vessel={selected}
        allVessels={state.vessels}
        totalSupply={state.totalSupply}
        initialVisitLab={initialVisitLab}
        onClearInitialVisit={onClearInitialVisit}
        switchableVessels={displayVessels}
        onSelectTokenId={onSelectTokenId}
        impact={{
          tokenId: selected.tokenId,
          seed: selected.seed,
          causeId: selected.causeId,
          causeName: selected.causeName,
          tokenValueUsd: selected.valueUsd,
          complexityTier: tier,
          sectorsMask: selected.sectorsMask,
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
        userCoinBalance={state.userCoinBalance}
        totalCoinsDonatedToResearch={state.totalCoinsDonatedToResearch}
        labSparks={labSparks}
        walletAddress={state.walletAddress}
        isPreviewLab={isPreviewLab}
        animationUrl={animationUrl}
        creatorTriggerMode="immediate"
        onBuildSector={onBuildSector}
        onUpgradeVessel={onUpgradeVessel}
        onClaimCoins={onClaimCoins}
        onDonateCoins={onDonateCoins}
        onAnchorProof={onAnchorProof}
        onAwardPlayBonus={onAwardPlayBonus}
        onConnectWallet={onConnectWallet}
        onSpendCoinsForTreat={onSpendCoinsForTreat}
        onGoMint={onGoMint}
      />
    </section>
  );
}
