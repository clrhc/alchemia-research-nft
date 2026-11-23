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
            <h3>1. Where the money goes</h3>
            <p>
              Every mint and upgrade splits ETH directly inside the smart contract in two phases:
            </p>
            <ul className="wp-list">
              <li>
                <strong>Phase 1 (Building coin liquidity):</strong> <strong>60%</strong> goes
                straight to the research wallet, <strong>25%</strong> goes straight to the dev
                wallet, and <strong>15%</strong> fills the ALCH liquidity reserve until it reaches{" "}
                {state.liquidityThresholdEth} ETH (~$
                {Math.round(ethToUsd(state.liquidityThresholdEth)).toLocaleString()}).
              </li>
              <li>
                <strong>Phase 2 (After liquidity is live):</strong> Once the reserve is paired with
                ALCH in the liquidity pool, every mint switches automatically to{" "}
                <strong>66.67% research</strong> and <strong>33.33% dev</strong>, with zero ETH
                left sitting in the contract.
              </li>
            </ul>

            <div className="wp-lp-box">
              <div className="wp-lp-row">
                <span>
                  {state.liquiditySeeded
                    ? "Liquidity live (66.67% research / 33.33% dev)"
                    : "Liquidity pool progress"}
                </span>
                <strong>
                  {state.liquidityReserveEth.toFixed(4)} / {state.liquidityThresholdEth.toFixed(2)}{" "}
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
              2. Clean, zero-tax ALCH coin
            </h3>
            <p>
              <code>AlchemiaCoin (ALCH)</code> is a plain OpenZeppelin ERC-20 with{" "}
              <strong>0% buy tax, 0% sell tax, and 0% transfer tax</strong>. There are no
              blacklists, pause switches, or hidden transfer hooks, and the 100M max supply and
              minter link are locked permanently. Labs earn ALCH over time, and you can send part of
              every claim or donate coins directly to researchers (
              <strong>{state.totalCoinsDonatedToResearch.toLocaleString()} ALCH</strong> shared so
              far).
            </p>
          </div>

          <div>
            <h3>3. Real protein folding inside each piece</h3>
            <p>
              Each lab folds real published mini-protein benchmarks from the Protein Data Bank—such
              as <strong>Trp-cage (1L2Y)</strong>, <strong>GB1 (1GB1)</strong>,{" "}
              <strong>Chignolin (1UAO)</strong>, and <strong>CLN025 (2RVD)</strong>—using a 3D
              Lennard-Jones + backbone-bending energy model. You can download a real{" "}
              <strong>.PDB file</strong> openable in PyMOL or ChimeraX, and anchor its SHA-256 hash
              on-chain. Metadata uses <strong>EIP-4906</strong> so wallets and marketplaces refresh
              automatically whenever you upgrade a lab.
            </p>
          </div>

          <div>
            <h3>4. Rooms, pets, and supply</h3>
            <p>
              A $1 piece is already a full 3D lab. Sliding higher adds extra detail on a single
              piece, and in <strong>My Labs</strong> you can add 6 rooms (Cold Room, Mining Room,
              Greenhouse, Pet Lounge, Particle Tower, Glass Dome) and feed, pet, or play with your
              cat or dog for up to a 1.4x speed boost. The contract supports either open infinite
              supply or a fixed cap that can be locked permanently on-chain.
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
                Download .PDB ({liveCompute.pdbBenchmarkId})
              </button>
            )}
            <a
              href={animationUrl}
              target="_blank"
              rel="noreferrer"
              className="subtle-pill-btn clickable"
              style={{ textDecoration: "none" }}
            >
              Open full-screen 3D view
              <ArrowUpRight size={13} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
