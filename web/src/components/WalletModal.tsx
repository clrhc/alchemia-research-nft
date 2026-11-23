import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, LogOut, Sparkles, Wallet, X } from "lucide-react";
import { CHAIN_NAMES, TARGET_CHAIN_ID } from "../web3/config";

export interface DiscoveredProvider {
  id: string;
  name: string;
  icon?: string;
  provider: unknown;
}

interface WalletModalProps {
  open: boolean;
  onClose: () => void;
  walletAddress: string | null;
  chainId: number;
  connecting: boolean;
  error: string | null;
  onConnectProvider: (selectedProvider?: unknown) => Promise<void>;
  onDisconnect: () => void;
}

export function WalletModal({
  open,
  onClose,
  walletAddress,
  chainId,
  connecting,
  error,
  onConnectProvider,
  onDisconnect
}: WalletModalProps) {
  const [providers, setProviders] = useState<DiscoveredProvider[]>([]);
  const [copied, setCopied] = useState(false);

  // EIP-6963 automatic browser wallet discovery (MetaMask, Rabby, Coinbase, Rainbow, Phantom, etc.)
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const found = new Map<string, DiscoveredProvider>();

    const onAnnounce = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          info: { uuid: string; name: string; icon?: string };
          provider: unknown;
        }>
      ).detail;
      if (!detail?.info?.name || !detail.provider) return;
      found.set(detail.info.uuid || detail.info.name, {
        id: detail.info.uuid || detail.info.name,
        name: detail.info.name,
        icon: detail.info.icon,
        provider: detail.provider
      });
      setProviders(Array.from(found.values()));
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    // Fallback check for legacy window.ethereum
    const winEth = (window as unknown as { ethereum?: { isMetaMask?: boolean; isCoinbaseWallet?: boolean; isRabby?: boolean } }).ethereum;
    if (winEth && found.size === 0) {
      const label = winEth.isRabby
        ? "Rabby Wallet"
        : winEth.isCoinbaseWallet
          ? "Coinbase Wallet"
          : winEth.isMetaMask
            ? "MetaMask"
            : "Browser Wallet";
      setProviders([{ id: "injected", name: label, provider: winEth }]);
    }

    return () => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
    };
  }, [open]);

  if (!open) return null;

  const explorerBase =
    chainId === 84532
      ? "https://sepolia.basescan.org/address/"
      : chainId === 8453
        ? "https://basescan.org/address/"
        : "https://etherscan.io/address/";

  const handleCopy = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard restrictions
    }
  };

  return (
    <div
      className="sheet-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Connect Wallet"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-panel wallet-modal">
        <button
          type="button"
          className="wallet-close-btn clickable"
          onClick={onClose}
          aria-label="Close wallet dialog"
        >
          <X size={15} />
        </button>

        {/* Cute Stylized Alchemical Companion + Flask Crest */}
        <div className="wallet-crest" aria-hidden="true">
          <svg viewBox="0 0 96 96" width="68" height="68" fill="none">
            <circle cx="48" cy="48" r="42" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 5" />
            <ellipse
              cx="48"
              cy="48"
              rx="38"
              ry="15"
              transform="rotate(-24 48 48)"
              stroke="#5b8def"
              strokeOpacity="0.45"
              strokeWidth="1.2"
            />
            <ellipse
              cx="48"
              cy="48"
              rx="38"
              ry="15"
              transform="rotate(24 48 48)"
              stroke="#f472b6"
              strokeOpacity="0.45"
              strokeWidth="1.2"
            />
            {/* Tiny cute cat-eared glass flask emblem */}
            <path
              d="M37 33 L33 22 L43 28 L53 28 L63 22 L59 33 C65 40 67 52 63 60 C60 66 54 68 48 68 C42 68 36 66 33 60 C29 52 31 40 37 33 Z"
              fill="url(#wGrad)"
              stroke="#475569"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Cute eyes */}
            <circle cx="42.5" cy="47" r="2.4" fill="#1e293b" />
            <circle cx="53.5" cy="47" r="2.4" fill="#1e293b" />
            <circle cx="41.8" cy="46.2" r="0.8" fill="#ffffff" />
            <circle cx="52.8" cy="46.2" r="0.8" fill="#ffffff" />
            {/* Tiny smile */}
            <path d="M45.5 52 Q48 54.5 50.5 52" stroke="#475569" strokeWidth="1.4" strokeLinecap="round" />
            {/* Orbiting mini proton & electron */}
            <circle cx="79" cy="36" r="4" fill="#f472b6" />
            <circle cx="17" cy="60" r="3.5" fill="#5b8def" />
            <defs>
              <linearGradient id="wGrad" x1="32" y1="26" x2="64" y2="68" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="55%" stopColor="#e0ecff" />
                <stop offset="100%" stopColor="#c7d8fa" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <h2 className="wallet-modal-title">
          {walletAddress ? "Your Lab Wallet" : "Step Into the Lab"}
        </h2>
        <p className="wallet-modal-sub">
          {walletAddress
            ? `Connected on ${CHAIN_NAMES[chainId] || `Chain ${chainId}`}`
            : `Choose a wallet to mint on ${CHAIN_NAMES[TARGET_CHAIN_ID] || "Base Sepolia"} & grow your 3D lab.`}
        </p>

        {walletAddress ? (
          <div className="wallet-connected-box">
            <div className="wallet-addr-row">
              <span className="live-dot" />
              <code>
                {walletAddress.slice(0, 8)}…{walletAddress.slice(-6)}
              </code>
              <button
                type="button"
                className="wallet-icon-btn clickable"
                onClick={handleCopy}
                title="Copy address"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
              <a
                href={`${explorerBase}${walletAddress}`}
                target="_blank"
                rel="noreferrer"
                className="wallet-icon-btn clickable"
                title="View on explorer"
              >
                <ExternalLink size={13} />
              </a>
            </div>

            <button
              type="button"
              className="subtle-pill-btn clickable"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => {
                onDisconnect();
                onClose();
              }}
            >
              <LogOut size={14} />
              Disconnect
            </button>
          </div>
        ) : (
          <div className="wallet-list">
            {providers.length > 0 ? (
              providers.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="wallet-option clickable"
                  disabled={connecting}
                  onClick={() => void onConnectProvider(item.provider)}
                >
                  <span className="wallet-option-left">
                    {item.icon ? (
                      <img src={item.icon} alt="" className="wallet-option-icon" />
                    ) : (
                      <span className="wallet-option-fallback">
                        <Wallet size={16} />
                      </span>
                    )}
                    <span>{item.name}</span>
                  </span>
                  <span className="wallet-option-tag">
                    {connecting ? "Connecting…" : "Detected"}
                  </span>
                </button>
              ))
            ) : (
              <>
                <button
                  type="button"
                  className="wallet-option clickable"
                  disabled={connecting}
                  onClick={() => void onConnectProvider(undefined)}
                >
                  <span className="wallet-option-left">
                    <span className="wallet-option-fallback">
                      <Sparkles size={16} />
                    </span>
                    <span>Browser Wallet</span>
                  </span>
                  <span className="wallet-option-tag">Connect</span>
                </button>
                <div className="wallet-install-links">
                  <span>Need a wallet?</span>
                  <a href="https://www.coinbase.com/wallet" target="_blank" rel="noreferrer">
                    Coinbase Wallet
                  </a>
                  <span>·</span>
                  <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">
                    MetaMask
                  </a>
                </div>
              </>
            )}
          </div>
        )}

        {error && <p className="wallet-error">{error}</p>}

        <div className="wallet-footnote">
          Auto-switches to <strong>{CHAIN_NAMES[TARGET_CHAIN_ID] || "Base Sepolia"}</strong> ·
          Zero-tax ERC-20 &amp; verified transfers
        </div>
      </div>
    </div>
  );
}
