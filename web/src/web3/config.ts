export interface ResearchCauseInfo {
  id: number;
  name: string;
  shortName: string;
  category: string;
  summary: string;
  recipientLabel: string;
  raisedEth: number;
  mintCount: number;
  accent: string;
}

export const DEFAULT_CAUSES: ResearchCauseInfo[] = [
  {
    id: 0,
    name: "Companion Animal Welfare & Biology",
    shortName: "Animal Welfare",
    category: "Charity & Vet Science",
    summary: "Funds shelter medicine, rescue sanctuaries, and open canine/feline longevity biology.",
    recipientLabel: "Verified Animal Research Vault",
    raisedEth: 1.485,
    mintCount: 44,
    accent: "#fb7185"
  },
  {
    id: 1,
    name: "Particle & Quantum Physics Grants",
    shortName: "Quantum Physics",
    category: "Fundamental Research",
    summary: "Supports open-access proton, subatomic instrumentation, and university micro-grants.",
    recipientLabel: "Open Physics Endowment",
    raisedEth: 1.92,
    mintCount: 57,
    accent: "#5b8def"
  },
  {
    id: 2,
    name: "Biomedical & Cellular Alchemy",
    shortName: "Biomedical",
    category: "Open Medicine",
    summary: "Accelerates rare-disease molecular chemistry and public-domain therapeutic screening.",
    recipientLabel: "Cellular Discovery Fund",
    raisedEth: 1.14,
    mintCount: 33,
    accent: "#8b5cf6"
  },
  {
    id: 3,
    name: "Clean Energy & Climate Catalysis",
    shortName: "Clean Catalysis",
    category: "Climate Science",
    summary: "Directs ETH toward green hydrogen catalysts, carbon capture chemistry, and clean air.",
    recipientLabel: "Climate Catalysis Treasury",
    raisedEth: 0.865,
    mintCount: 25,
    accent: "#14b8a6"
  }
];

export const CHAIN_RPC_URLS: Record<number, string> = {
  1: import.meta.env.VITE_MAINNET_RPC_URL || "https://ethereum-rpc.publicnode.com",
  11155111: import.meta.env.VITE_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
  84532: import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
  8453: import.meta.env.VITE_BASE_RPC_URL || "https://mainnet.base.org",
  31337: "http://127.0.0.1:8545"
};

export const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum Mainnet",
  11155111: "Ethereum Sepolia",
  84532: "Base Sepolia",
  8453: "Base Mainnet",
  31337: "Local Hardhat Node"
};

export const CONTRACT_ADDRESS = (
  import.meta.env.VITE_CONTRACT_ADDRESS || "0x6f6D4c12EF3b3de964E2C8C84Bed4eBb8a83677F"
).trim();
export const COIN_CONTRACT_ADDRESS = (
  import.meta.env.VITE_COIN_ADDRESS || "0x4Da32048ab4Fc630FED0ECc5a48D6cE3c31Ea382"
).trim();
export const TARGET_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || "84532");
export const BASE_MINT_PRICE_ETH = Number(import.meta.env.VITE_MINT_PRICE_ETH || "0.0004");
export const ETH_USD_RATE = Number(import.meta.env.VITE_ETH_USD_RATE || "2500"); // 0.0004 ETH = $1.00
export const IMPACT_SPLIT_PCT = 66.67;
export const DEV_SPLIT_PCT = 33.33;

export function usdToEth(usd: number): number {
  return Number((Math.max(1, usd) / ETH_USD_RATE).toFixed(6));
}

export function ethToUsd(eth: number): number {
  return eth * ETH_USD_RATE;
}

export function complexityTierFromUsd(usd: number): 1 | 2 | 3 | 4 | 5 {
  if (usd >= 500) return 5;
  if (usd >= 100) return 4;
  if (usd >= 25) return 3;
  if (usd >= 5) return 2;
  return 1;
}

export const COMPLEXITY_TIER_NAMES: Record<number, string> = {
  1: "I · Grand Atelier",
  2: "II · Harmonic Synthesis",
  3: "III · Celestial Observatory",
  4: "IV · Sovereign Transmutation",
  5: "V · Philosopher's Magnum Opus"
};
