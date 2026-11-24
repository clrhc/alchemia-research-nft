import { useEffect } from "react";
import { ArrowUpRight, Download, FileJson, ShieldCheck, X } from "lucide-react";
import {
  downloadPDBFromSnapshot,
  downloadScienceCertificateFromSnapshot,
  type ComputeSnapshot
} from "../engine/researchCompute";
import { downloadMMCIFFromSnapshot } from "../engine/structuralAnalysis";
import {
  CHAIN_NAMES,
  TESTNET_COIN_ADDRESS,
  TESTNET_CONTRACT_ADDRESS,
  TESTNET_RENDERER_ADDRESS,
  ethToUsd,
  type AppNetworkMode
} from "../web3/config";
import type { CollectionState } from "../web3/contractService";

interface WhitePaperSheetProps {
  open: boolean;
  onClose: () => void;
  state: CollectionState;
  networkMode: AppNetworkMode;
  onSwitchNetworkMode: (mode: AppNetworkMode) => void;
  animationUrl: string;
  liveCompute: ComputeSnapshot | null;
  onSeedLiquidity?: () => Promise<void>;
}

export function WhitePaperSheet({
  open,
  onClose,
  state,
  networkMode,
  onSwitchNetworkMode,
  animationUrl,
  liveCompute,
  onSeedLiquidity
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

            <div className="wp-split-bar" aria-label="Phase 1 split: 60% research, 25% dev, 15% liquidity">
              <span style={{ width: "60%", background: "#5b8def" }}>60% Research</span>
              <span style={{ width: "25%", background: "#64748b" }}>25% Dev</span>
              <span style={{ width: "15%", background: "#10b981" }}>15% LP</span>
            </div>

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
              {!state.liquiditySeeded &&
                state.liquidityReserveEth >= state.liquidityThresholdEth &&
                onSeedLiquidity && (
                  <button
                    type="button"
                    className="btn-mint-minimal clickable"
                    style={{ marginTop: 10, padding: "8px 18px", fontSize: "0.78rem" }}
                    onClick={() => void onSeedLiquidity()}
                  >
                    Seed liquidity now
                  </button>
                )}
            </div>

            {state.causes.length > 0 && (
              <div className="wp-causes-grid">
                {state.causes.map((c) => (
                  <div key={c.id} className="wp-cause-item">
                    <span>
                      <span
                        className="cause-dot"
                        style={{ background: c.accent, marginRight: 6 }}
                      />
                      {c.shortName}
                    </span>
                    <strong>{c.raisedEth.toFixed(4)} ETH</strong>
                  </div>
                ))}
              </div>
            )}
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
              <strong>{state.totalCoinsDonatedToResearch.toLocaleString()} ALCH</strong> shared ·{" "}
              <strong>{Math.round(state.coinTotalSupply).toLocaleString()} / 100,000,000</strong>{" "}
              minted so far).
            </p>
            <div className="wp-safety-pills">
              <span>0% Buy Tax</span>
              <span>0% Sell Tax</span>
              <span>0% Transfer Tax</span>
              <span>100M Fixed Cap</span>
              <span>EIP-2612 Permit</span>
              <span>EIP-4906 Live Metadata</span>
              <span>ERC-7572 Collection</span>
            </div>
          </div>

          <div>
            <h3>3. Real protein folding inside every piece</h3>
            <p>
              Each 3D lab runs an off-thread Web Worker folding 8 published fast-folding benchmarks
              from the Protein Data Bank—<strong>Trp-cage (1L2Y, 2JOF)</strong>,{" "}
              <strong>GB1 (1GB1)</strong>, <strong>Chignolin (1UAO)</strong>,{" "}
              <strong>CLN025 (2RVD)</strong>, <strong>Villin Headpiece (1VII, 2F4K)</strong>, and{" "}
              <strong>BBA5 (1FME)</strong>. The solver uses Kyte-Doolittle hydropathy, salt-bridge
              electrostatics, aromatic stacking, P-SEA secondary structure assignment, and 4-replica
              parallel tempering. You can export standard <strong>.PDB</strong> and{" "}
              <strong>.CIF (mmCIF)</strong> files for PyMOL, ChimeraX, or RCSB Mol*, download a{" "}
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

          {state.recentDiscoveries.length > 0 && (
            <div>
              <h3>5. Verified on-chain research proofs</h3>
              <div className="wp-ledger">
                {state.recentDiscoveries.slice(0, 4).map((d) => {
                  const txBase =
                    state.chainId === 84532
                      ? "https://sepolia.basescan.org/tx/"
                      : state.chainId === 8453
                        ? "https://basescan.org/tx/"
                        : "https://etherscan.io/tx/";
                  return (
                    <a
                      key={d.txHash}
                      href={`${txBase}${d.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="wp-ledger-row"
                    >
                      <span>
                        Lab #{d.tokenId} · {d.addedWorkUnits} rounds · {d.bestEnergy.toFixed(1)} kcal/mol
                      </span>
                      <code>
                        {d.proofHash.slice(0, 10)}… <ArrowUpRight size={10} />
                      </code>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <h3>
              {state.recentDiscoveries.length > 0 ? "6" : "5"}. Deployed V2 Smart Contracts (
              {CHAIN_NAMES[state.chainId] || "Base Sepolia"})
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <span className="tama-sub">
                Active view: <strong>{networkMode === "testnet" ? "Live Base Sepolia Testnet" : "Example Sandbox"}</strong>
              </span>
              <button
                type="button"
                className="subtle-pill-btn clickable"
                style={{ padding: "3px 10px", fontSize: "0.72rem" }}
                onClick={() => onSwitchNetworkMode(networkMode === "testnet" ? "example" : "testnet")}
              >
                Switch to {networkMode === "testnet" ? "Example Sandbox" : "Base Sepolia Testnet"}
              </button>
            </div>
            <div className="wp-contracts">
              <a
                href={`${explorerBase}${state.contractAddress || TESTNET_CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
              >
                NFT V2: {(state.contractAddress || TESTNET_CONTRACT_ADDRESS).slice(0, 10)}…
                {(state.contractAddress || TESTNET_CONTRACT_ADDRESS).slice(-8)}
                <ArrowUpRight size={11} />
              </a>
              <a
                href={`${explorerBase}${state.coinAddress || TESTNET_COIN_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
              >
                ALCH: {(state.coinAddress || TESTNET_COIN_ADDRESS).slice(0, 10)}…
                {(state.coinAddress || TESTNET_COIN_ADDRESS).slice(-8)}
                <ArrowUpRight size={11} />
              </a>
              <a
                href={`${explorerBase}${TESTNET_RENDERER_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
              >
                Renderer V2: {TESTNET_RENDERER_ADDRESS.slice(0, 10)}…
                {TESTNET_RENDERER_ADDRESS.slice(-8)}
                <ArrowUpRight size={11} />
              </a>
            </div>
          </div>

          <div className="details-sheet-links">
            {liveCompute && (
              <>
                <button
                  type="button"
                  className="subtle-pill-btn clickable"
                  onClick={() => downloadPDBFromSnapshot(liveCompute)}
                >
                  <Download size={13} />
                  .PDB ({liveCompute.pdbBenchmarkId})
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
                  onClick={() => downloadScienceCertificateFromSnapshot(liveCompute)}
                >
                  <FileJson size={13} />
                  .JSON
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
