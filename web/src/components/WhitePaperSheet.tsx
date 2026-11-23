import { ArrowUpRight, Download, ShieldCheck, X } from "lucide-react";
import { downloadPDBFromSnapshot, type ComputeSnapshot } from "../engine/researchCompute";
import { ethToUsd } from "../web3/config";
import type { CollectionState } from "../web3/contractService";

interface WhitePaperSheetProps {
  open: boolean;
  onClose: () => void;
  state: CollectionState;
  animationUrl: string;
  liveCompute: ComputeSnapshot | null;
}

export function WhitePaperSheet({
  open,
  onClose,
  state,
  animationUrl,
  liveCompute
}: WhitePaperSheetProps) {
  if (!open) return null;

  const lpPct = state.liquiditySeeded
    ? 100
    : Math.min(100, (state.liquidityReserveEth / Math.max(0.01, state.liquidityThresholdEth)) * 100);

  return (
    <div
      className="sheet-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="White Paper"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-panel details-sheet">
        <div className="details-sheet-head">
          <h2>White Paper</h2>
          <button
            type="button"
            className="subtle-pill-btn clickable"
            onClick={onClose}
            aria-label="Close White Paper"
          >
            <X size={14} />
            Close
          </button>
        </div>

        <div className="details-sheet-body">
          <div>
            <h3>1. Two-Phase Funding Split &amp; Automatic $ALCH Liquidity Threshold</h3>
            <p>
              To launch deep, fair liquidity for <strong>$ALCH</strong> without taking taxes on
              token trades, mint and upgrade proceeds follow an automated two-phase on-chain split:
            </p>
            <ul className="wp-list">
              <li>
                <strong>Phase 1 (Bootstrapping Liquidity):</strong> <strong>60%</strong> goes
                immediately to the verified Research Wallet, <strong>25%</strong> immediately to
                the Dev Wallet, and <strong>15%</strong> accumulates inside the contract&apos;s
                on-chain Liquidity Reserve until the activation threshold (
                {state.liquidityThresholdEth} ETH ≈ $
                {Math.round(ethToUsd(state.liquidityThresholdEth)).toLocaleString()}) is reached.
              </li>
              <li>
                <strong>Phase 2 (Post-Liquidity Seeding):</strong> Once{" "}
                <code>seedLiquidity()</code> pairs the reserve ETH with initial <code>$ALCH</code>{" "}
                directly into the Liquidity Vault, every mint and upgrade automatically shifts to{" "}
                <strong>66.67% immediate Research</strong> and <strong>33.33% immediate Dev</strong>{" "}
                with 0 ETH retained in contract.
              </li>
            </ul>

            <div className="wp-lp-box">
              <div className="wp-lp-row">
                <span>
                  {state.liquiditySeeded
                    ? "Liquidity Pool Seeded — Phase 2 (66.67% / 33.33%) Active"
                    : "Phase 1 Liquidity Reserve Progress"}
                </span>
                <strong>
                  {state.liquidityReserveEth.toFixed(3)} / {state.liquidityThresholdEth.toFixed(2)}{" "}
                  ETH
                </strong>
              </div>
              <div className="mini-track" style={{ height: 7 }}>
                <div className="mini-fill" style={{ width: `${lpPct}%`, background: "#5b8def" }} />
              </div>
            </div>
          </div>

          <div>
            <h3>
              <ShieldCheck size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />
              2. Zero-Tax, Blockaid-Safe $ALCH Coin &amp; Lab Mining Game
            </h3>
            <p>
              <code>AlchemiaCoin ($ALCH)</code> is a pure standard OpenZeppelin ERC-20 +
              ERC-20Burnable + ERC-20Permit contract with <strong>0% buy tax, 0% sell tax, and 0%
              transfer tax</strong>, no blacklists, no pause switches, an immutable 100M max supply,
              and a one-time locked NFT minter binding so security scanners verify clean transfers.
              Labs mine <code>$ALCH</code> according to their complexity tier, built architectural
              wings, verified research work units, and Tamagotchi companion care—with an optional
              research tithe on claims and direct researcher coin donations (
              <strong>{state.totalCoinsDonatedToResearch.toLocaleString()} $ALCH</strong> donated so
              far).
            </p>
          </div>

          <div>
            <h3>3. Real Open-Science Technology Inside Every NFT</h3>
            <p>
              Each Alchemia Lab claims a deterministic scientific parameter slice from its on-chain
              seed and runs genuine <strong>Stillinger 3D Off-Lattice AB-Model Protein Folding</strong>{" "}
              (Lennard-Jones 12-6 + backbone bending energy minimization via Metropolis-Hastings
              simulated annealing) right inside its interactive 3D artwork. Results export as
              standard <strong>.PDB (Protein Data Bank)</strong> coordinate files openable in PyMOL,
              UCSF ChimeraX, and RCSB Mol*, hashed via Web Crypto <code>SHA-256</code> and
              anchorable on-chain through <code>submitResearchProof(...)</code>—designed to bridge
              into open DeSci repositories (BOINC, Folding@home, IPFS datasets).
            </p>
          </div>

          <div>
            <h3>4. Sims-Style 3D Modular Wings &amp; Tamagotchi Companions</h3>
            <p>
              Every $1 mint is already a full, grand 3D architectural model. Sliding higher at mint
              or adding 6 modular wings inside <strong>My Labs</strong> (Cryo-Folding Wing, Quantum
              Mining Pavilion, Solar Catalysis Dome, Companion Sanctuary, Proton Accelerator Spire,
              Philosopher Observatory) physically expands the 3D building, increases real folding
              throughput, and powers up <code>$ALCH</code> mining. Feeding, petting, and playing with
              your 3D Cat or Dog familiar grants up to a <strong>1.4x</strong> laboratory boost.
            </p>
          </div>

          <div>
            <h3>5. Supply Architecture</h3>
            <p>
              Supports either infinite open-edition minting (<code>maxSupply = 0</code>) or a strict
              supply cap, permanently freezeable on-chain via <code>lockSupplyConfig()</code>.
              Ready for Ethereum Mainnet and Base Sepolia testing.
            </p>
          </div>

          <div className="details-sheet-links">
            {liveCompute && (
              <button
                type="button"
                className="subtle-pill-btn clickable"
                onClick={() => downloadPDBFromSnapshot(liveCompute)}
              >
                <Download size={13} />
                Download Live .PDB Dataset
              </button>
            )}
            <a
              href={animationUrl}
              target="_blank"
              rel="noreferrer"
              className="subtle-pill-btn clickable"
              style={{ textDecoration: "none" }}
            >
              Open standalone 3D animation_url
              <ArrowUpRight size={13} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
