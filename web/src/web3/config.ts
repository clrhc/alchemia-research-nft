export interface ResearchCauseInfo {
  id: number;
  name: string;
  shortName: string;
  category: string;
  summary: string;
  recipientLabel: string;
  researchWallet?: string;
  raisedEth: number;
  mintCount: number;
  accent: string;
}

export const DEFAULT_CAUSES: ResearchCauseInfo[] = [
  {
    id: 0,
    name: "Animal Welfare & Vet Science",
    shortName: "Animal Welfare",
    category: "Animal Health",
    summary: "Funds shelter medicine, rescue care, and open dog and cat longevity research.",
    recipientLabel: "Animal Research Wallet",
    raisedEth: 1.485,
    mintCount: 44,
    accent: "#fb7185"
  },
  {
    id: 1,
    name: "Physics Research Grants",
    shortName: "Physics",
    category: "Physics",
    summary: "Supports open-access lab instruments and university micro-grants.",
    recipientLabel: "Physics Grant Wallet",
    raisedEth: 1.92,
    mintCount: 57,
    accent: "#5b8def"
  },
  {
    id: 2,
    name: "Open Medical Research",
    shortName: "Medicine",
    category: "Medicine",
    summary: "Backs rare-disease biology and public-domain drug screening.",
    recipientLabel: "Medical Research Wallet",
    raisedEth: 1.14,
    mintCount: 33,
    accent: "#8b5cf6"
  },
  {
    id: 3,
    name: "Clean Energy & Climate",
    shortName: "Clean Energy",
    category: "Climate",
    summary: "Supports green hydrogen catalysts, carbon capture, and clean air studies.",
    recipientLabel: "Climate Research Wallet",
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
  1: "Level 1 Lab",
  2: "Level 2 Lab",
  3: "Level 3 Lab",
  4: "Level 4 Lab",
  5: "Level 5 Lab"
};
