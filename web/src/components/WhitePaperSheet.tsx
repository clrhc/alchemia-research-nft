import { useEffect } from "react";
import { ArrowUpRight, Download, FileJson, ShieldCheck, X } from "lucide-react";
import {
  downloadPDBFromSnapshot,
  downloadScienceCertificateFromSnapshot,
  type ComputeSnapshot
} from "../engine/researchCompute";
import { CHAIN_NAMES, ethToUsd } from "../web3/config";
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const lpPct = state.liquiditySeeded
    ? 100
    : Math.min(100, (state.liquidityReserveEth / Math.max(0.01, state.liquidityThresholdEth)) * 100);

  const explorerBase =
    state.chainId === 84532
      ? "https://sepolia.basescan.org/address/"
      : state.chainId === 8453
        ? "https://basescan.org/address/"
        : "https://etherscan.io/address/";

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
              Every mint and room upgrade splits ETH automatically inside the smart contract in two
              phases:
            </p>
            <ul className="wp-list">
              <li>
                <strong>Phase 1 (Bootstrapping ALCH liquidity):</strong> <strong>60%</strong> goes
                straight to the research wallet, <strong>25%</strong> goes straight to the dev
                wallet, and <strong>15%</strong> fills the on-chain liquidity reserve until it hits{" "}
                {state.liquidityThresholdEth} ETH (~$
                {Math.round(ethToUsd(state.liquidityThresholdEth)).toLocaleString()}).
              </li>
              <li>
                <strong>Phase 2 (After liquidity is live):</strong> Once <code>seedLiquidity()</code>{" "}
                pairs reserve ETH with ALCH in the pool, every mint shifts permanently to{" "}
                <strong>66.67% research</strong> and <strong>33.33% dev</strong>, leaving zero ETH
                sitting in the contract.
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
              2. Zero-tax, scanner-safe ALCH coin
            </h3>
            <p>
              <code>AlchemiaCoin (ALCH)</code> is a clean OpenZeppelin ERC-20 with{" "}
              <strong>0% buy tax, 0% sell tax, and 0% transfer tax</strong>, plus EIP-2612 permit
              support. There are no blacklists, pause toggles, or transfer hooks. The 100M max
              supply and one-time minter link lock permanently, and contract ownership can be
              renounced after launch. Labs earn ALCH over time, and holders can share part of any
              claim or send coins straight to researchers (
              <strong>{state.totalCoinsDonatedToResearch.toLocaleString()} ALCH</strong> shared so
              far).
            </p>
          </div>

          <div>
            <h3>3. Real protein folding inside every piece</h3>
            <p>
              Each 3D lab runs an off-thread Web Worker folding 8 published fast-folding benchmarks
              from the Protein Data Bank—<strong>Trp-cage (1L2Y, 2JOF)</strong>,{" "}
              <strong>GB1 (1GB1)</strong>, <strong>Chignolin (1UAO)</strong>,{" "}
              <strong>CLN025 (2RVD)</strong>, <strong>Villin Headpiece (1VII, 2F4K)</strong>, and{" "}
              <strong>BBA5 (1FME)</strong>. The solver uses Kyte-Doolittle hydropathy, salt-bridge
              electrostatics, aromatic stacking, and 4-replica parallel tempering. You can export a
              strict wwPDB v3.30 <strong>.PDB file</strong> for PyMOL, ChimeraX, or Mol*, download a{" "}
              <strong>.JSON science certificate</strong>, and anchor its SHA-256 hash on-chain.
            </p>
          </div>

          <div>
            <h3>4. Rooms, pets, metadata &amp; supply</h3>
            <p>
              A $1 piece is already a complete 3D lab. Sliding higher adds detail on a single piece.
              In <strong>My Labs</strong>, hover any of the 6 rooms (Cold Room, Mining Room,
              Greenhouse, Pet Lounge, Particle Tower, Glass Dome) to preview its glass wireframe on
              your building before adding it. Feed, pet, or play with your 3D cat or dog for up to a
              1.4x speed boost. Metadata emits <strong>EIP-4906</strong> refresh events on every
              upgrade, supports permanent URL freezing, and supports either open supply or a fixed
              cap locked forever on-chain.
            </p>
          </div>

          {state.contractAddress && (
            <div>
              <h3>5. Live contracts ({CHAIN_NAMES[state.chainId] || `Chain ${state.chainId}`})</h3>
              <div className="wp-contracts">
                <a
                  href={`${explorerBase}${state.contractAddress}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  NFT: {state.contractAddress.slice(0, 10)}…{state.contractAddress.slice(-8)}
                  <ArrowUpRight size={11} />
                </a>
                {state.coinAddress && (
                  <a
                    href={`${explorerBase}${state.coinAddress}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    ALCH: {state.coinAddress.slice(0, 10)}…{state.coinAddress.slice(-8)}
                    <ArrowUpRight size={11} />
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="details-sheet-links">
            {liveCompute && (
              <>
                <button
                  type="button"
                  className="subtle-pill-btn clickable"
                  onClick={() => downloadPDBFromSnapshot(liveCompute)}
                >
                  <Download size={13} />
                  Download .PDB ({liveCompute.pdbBenchmarkId})
                </button>
                <button
                  type="button"
                  className="subtle-pill-btn clickable"
                  onClick={() => downloadScienceCertificateFromSnapshot(liveCompute)}
                >
                  <FileJson size={13} />
                  .JSON Proof
                </button>
              </>
            )}
            <a
              href={animationUrl}
              target="_blank"
              rel="noreferrer"
              className="subtle-pill-btn clickable"
              style={{ textDecoration: "none" }}
            >
              Full-screen 3D view
              <ArrowUpRight size={13} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
