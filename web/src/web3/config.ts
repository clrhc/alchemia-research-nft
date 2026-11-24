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
  84532: import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || "https://base-sepolia-rpc.publicnode.com",
  8453: import.meta.env.VITE_BASE_RPC_URL || "https://base-rpc.publicnode.com",
  31337: "http://127.0.0.1:8545"
};

export const CHAIN_RPC_FALLBACKS: Record<number, string[]> = {
  1: ["https://ethereum-rpc.publicnode.com", "https://eth.llamarpc.com"],
  11155111: ["https://ethereum-sepolia-rpc.publicnode.com"],
  84532: ["https://base-sepolia-rpc.publicnode.com", "https://sepolia.base.org"],
  8453: ["https://base-rpc.publicnode.com", "https://mainnet.base.org"],
  31337: ["http://127.0.0.1:8545"]
};

export const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum Mainnet",
  11155111: "Ethereum Sepolia",
  84532: "Base Sepolia",
  8453: "Base Mainnet",
  31337: "Local Hardhat Node"
};

export type AppNetworkMode = "example" | "testnet";

export const TESTNET_CONTRACT_ADDRESS = (
  import.meta.env.VITE_CONTRACT_ADDRESS || "0x34765BAD704E355906DA16476E90Ea25866f2d5F"
).trim();
export const TESTNET_COIN_ADDRESS = (
  import.meta.env.VITE_COIN_ADDRESS || "0xFD204815cE4A66c9A539551c03B5944F6069851a"
).trim();
export const TESTNET_RENDERER_ADDRESS = (
  import.meta.env.VITE_RENDERER_ADDRESS || "0x676FC571c4381EA47f0D0C86ec3c9872015d77c1"
).trim();

export const CONTRACT_ADDRESS = TESTNET_CONTRACT_ADDRESS;
export const COIN_CONTRACT_ADDRESS = TESTNET_COIN_ADDRESS;
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
