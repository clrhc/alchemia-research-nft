import { BrowserProvider, Contract, JsonRpcProvider, ethers } from "ethers";
import { ALCHEMIA_ABI, ALCHEMIA_COIN_ABI } from "./abi";
import {
  BASE_MINT_PRICE_ETH,
  CHAIN_RPC_FALLBACKS,
  CHAIN_RPC_URLS,
  DEFAULT_CAUSES,
  IMPACT_SPLIT_PCT,
  TARGET_CHAIN_ID,
  TESTNET_COIN_ADDRESS,
  TESTNET_CONTRACT_ADDRESS,
  complexityTierFromUsd,
  ethToUsd,
  usdToEth,
  type AppNetworkMode,
  type ResearchCauseInfo
} from "./config";
import type { OnChainEstateBlueprint } from "./estateCodec";
import { randomSeedHex, SeededRNG } from "../engine/prng";
import { deterministicNeighborSeed } from "../engine/neighborhoodLayout";
import { stageFromEth } from "../engine/traits";

export interface MintedVessel {
  tokenId: number;
  seed: `0x${string}`;
  causeId: number;
  causeName: string;
  minter: string;
  ownedByUser: boolean;
  onChain?: boolean;
  valueUsd: number;
  impactEth: number;
  sectorsMask: number;
  workUnits: number;
  lastClaimMs: number;
  onChainPendingCoins?: number;
  onChainMiningRate?: number;
  syncedAtMs?: number;
  mintedAt: number;
  txHash?: string;
  estate?: OnChainEstateBlueprint;
}

export interface ResearchDiscoveryLog {
  tokenId: number;
  contributor: string;
  proofHash: string;
  bestEnergy: number;
  addedWorkUnits: number;
  txHash: string;
  blockNumber: number;
}

export interface CollectionState {
  connectedMode: "mainnet" | "sepolia" | "local" | "simulation";
  chainSynced?: boolean;
  chainId: number;
  contractAddress: string;
  coinAddress: string;
  walletAddress: string | null;
  totalSupply: number;
  maxSupply: number;
  supplyLocked: boolean;
  mintPriceEth: number;
  impactPct: number;
  globalDonatedEth: number;
  liquidityReserveEth: number;
  liquidityThresholdEth: number;
  liquiditySeeded: boolean;
  userCoinBalance: number;
  coinTotalSupply: number;
  totalCoinsDonatedToResearch: number;
  reactionStage: number;
  causes: ResearchCauseInfo[];
  vessels: MintedVessel[];
  recentDiscoveries: ResearchDiscoveryLog[];
}

const DEMO_STORAGE_KEY = "alchemia_ecosystem_v2";
const NETWORK_MODE_STORAGE_KEY = "alchemia_network_mode_v1";
const CHAIN_CACHE_PREFIX = "alchemia_chain_cache_v2_";

export function loadNetworkMode(): AppNetworkMode {
  if (typeof window === "undefined") return "example";
  try {
    const param = new URLSearchParams(window.location.search).get("mode")?.toLowerCase();
    if (param === "example" || param === "demo") return "example";
    if (param === "testnet" || param === "live" || param === "sepolia") return "testnet";
    const saved = window.localStorage.getItem(NETWORK_MODE_STORAGE_KEY);
    if (saved === "example" || saved === "testnet") return saved;
  } catch {
    // ignore storage errors
  }
  return "example";
}

export function saveNetworkMode(mode: AppNetworkMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NETWORK_MODE_STORAGE_KEY, mode);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", mode);
    window.history.replaceState({}, "", url.toString());
  } catch {
    // ignore storage/history errors inside sandboxed iframes
  }
}

function chainCacheKey(chainId: number, contractAddress: string): string {
  return `${CHAIN_CACHE_PREFIX}${chainId}_${contractAddress.toLowerCase()}`;
}

export function saveChainCache(state: CollectionState) {
  if (!state.contractAddress || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      chainCacheKey(state.chainId, state.contractAddress),
      JSON.stringify({
        totalSupply: state.totalSupply,
        maxSupply: state.maxSupply,
        supplyLocked: state.supplyLocked,
        mintPriceEth: state.mintPriceEth,
        globalDonatedEth: state.globalDonatedEth,
        liquidityReserveEth: state.liquidityReserveEth,
        liquidityThresholdEth: state.liquidityThresholdEth,
        liquiditySeeded: state.liquiditySeeded,
        coinTotalSupply: state.coinTotalSupply,
        totalCoinsDonatedToResearch: state.totalCoinsDonatedToResearch,
        reactionStage: state.reactionStage,
        causes: state.causes,
        vessels: state.vessels.slice(0, 72),
        recentDiscoveries: state.recentDiscoveries.slice(0, 8)
      })
    );
  } catch {
    // ignore storage errors
  }
}

/**
 * Merges incoming minted vessels with previously known vessels by `tokenId`, ensuring newer
 * on-chain updates (wings, tier, workUnits, ownership) overwrite stale snapshots while never
 * dropping older known minted neighbor labs as totalSupply grows!
 */
export function mergeMintedVessels(
  existing: readonly MintedVessel[],
  incoming: readonly MintedVessel[],
  maxStored = 240
): MintedVessel[] {
  const byId = new Map<number, MintedVessel>();
  for (const v of existing) {
    if (v && Number.isFinite(v.tokenId) && v.tokenId > 0) {
      byId.set(v.tokenId, v);
    }
  }
  for (const v of incoming) {
    if (v && Number.isFinite(v.tokenId) && v.tokenId > 0) {
      const prev = byId.get(v.tokenId);
      byId.set(v.tokenId, prev ? { ...prev, ...v } : v);
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => b.tokenId - a.tokenId)
    .slice(0, maxStored);
}

/**
 * Creates deterministic newly minted neighbor MintedVessels for simulation / live town growth preview.
 */
export function createSimulatedNeighborVessels(
  startTokenId: number,
  count: number
): { vessels: MintedVessel[]; addedImpactEth: number } {
  const safeCount = Math.max(1, Math.min(25, Math.floor(count)));
  const nowSec = Math.floor(Date.now() / 1000);
  const nowMs = Date.now();
  const usdStops = [1, 5, 10, 25, 50, 100, 250];
  const created: MintedVessel[] = [];
  let addedImpactEth = 0;

  for (let i = 0; i < safeCount; i++) {
    const tokenId = startTokenId + i;
    const seed = deterministicNeighborSeed(tokenId);
    const rng = new SeededRNG(seed, 777 + tokenId);
    const causeId = tokenId % DEFAULT_CAUSES.length;
    const valueUsd = usdStops[Math.min(usdStops.length - 1, Math.floor(rng.next() * usdStops.length))];
    const tier = complexityTierFromUsd(valueUsd);
    let sectorsMask = 0;
    for (let bit = 0; bit < 6; bit++) {
      if (rng.next() < 0.28 + tier * 0.08) sectorsMask |= 1 << bit;
    }
    const impactEth = Number((usdToEth(valueUsd) * 0.6).toFixed(6));
    addedImpactEth += impactEth;
    created.push({
      tokenId,
      seed,
      causeId,
      causeName: DEFAULT_CAUSES[causeId].name,
      minter: `0x${seed.slice(2, 6)}…${seed.slice(-4)}`,
      ownedByUser: false,
      onChain: false,
      valueUsd,
      impactEth,
      sectorsMask,
      workUnits: Math.floor(rng.range(1, 20)),
      lastClaimMs: nowMs - 1000 * 60 * 45,
      mintedAt: nowSec - i * 12
    });
  }

  return {
    vessels: created,
    addedImpactEth: Number(addedImpactEth.toFixed(6))
  };
}

function createInitialDemoVessels(): MintedVessel[] {
  const nowSec = Math.floor(Date.now() / 1000);
  const nowMs = Date.now();
  const curated: Array<{
    seed: `0x${string}`;
    causeId: number;
    valueUsd: number;
    sectorsMask: number;
    workUnits: number;
    ownedByUser: boolean;
  }> = [
    {
      seed: "0x8a4f91e023c47b89d01f4e5276b98c31456fa234890bcdef1234567890ab0100",
      causeId: 0,
      valueUsd: 25,
      sectorsMask: 0b000011, // Cryo Wing + Mining Rig
      workUnits: 14,
      ownedByUser: true
    },
    {
      seed: "0x1c7d82a941e35b64c028a7f139d05b2468ace13579bdf02468ace13579bd0401",
      causeId: 1,
      valueUsd: 100,
      sectorsMask: 0b010110, // Mining Rig + Solar Dome + Proton Spire
      workUnits: 31,
      ownedByUser: false
    },
    {
      seed: "0x5f9b33d720a18c44e921b6a047c32e891029384756abcdef0192837465ab0604",
      causeId: 2,
      valueUsd: 5,
      sectorsMask: 0b000001, // Cryo Wing
      workUnits: 8,
      ownedByUser: false
    },
    {
      seed: "0x9e2177c450f83a19b472d5e801a49f63210fedcba9876543210fedcba9870203",
      causeId: 3,
      valueUsd: 500,
      sectorsMask: 0b111111, // Full 6-Wing Philosopher Magnum Opus Lab!
      workUnits: 74,
      ownedByUser: false
    },
    {
      seed: "0x3b60e4f812d95a07c834f1e290b67d54321987654abcdef0123456789abc0802",
      causeId: 0,
      valueUsd: 1,
      sectorsMask: 0,
      workUnits: 4,
      ownedByUser: false
    },
    {
      seed: "0x7d14a9b635c82e71f046a3b918d25e67890123456789abcdef01234567896200",
      causeId: 1,
      valueUsd: 50,
      sectorsMask: 0b001010, // Mining Rig + Companion Sanctuary
      workUnits: 19,
      ownedByUser: false
    }
  ];

  return curated.map((item, idx) => ({
    tokenId: idx + 1,
    seed: item.seed,
    causeId: item.causeId,
    causeName: DEFAULT_CAUSES[item.causeId].name,
    minter: item.ownedByUser ? "You" : `0x${(0x71a0 + idx * 913).toString(16)}…${(0x9c40 + idx * 317).toString(16)}`,
    ownedByUser: item.ownedByUser,
    valueUsd: item.valueUsd,
    impactEth: Number((usdToEth(item.valueUsd) * 0.6).toFixed(6)),
    sectorsMask: item.sectorsMask,
    workUnits: item.workUnits,
    lastClaimMs: nowMs - 1000 * 60 * 90,
    mintedAt: nowSec - (6 - idx) * 600
  }));
}

export function loadCollectionStateForMode(
  mode: AppNetworkMode,
  walletAddress: string | null = null
): CollectionState {
  const defaultTotal = DEFAULT_CAUSES.reduce((sum, c) => sum + c.raisedEth, 0);
  const isLiveChain = mode === "testnet" && Boolean(TESTNET_CONTRACT_ADDRESS);
  const activeContract = isLiveChain ? TESTNET_CONTRACT_ADDRESS : "";
  const activeCoin = isLiveChain ? TESTNET_COIN_ADDRESS : "";

  const base: CollectionState = {
    connectedMode: isLiveChain ? modeFromChainId(TARGET_CHAIN_ID) : "simulation",
    chainSynced: !isLiveChain,
    chainId: TARGET_CHAIN_ID,
    contractAddress: activeContract,
    coinAddress: activeCoin,
    walletAddress,
    totalSupply: isLiveChain ? 0 : 6,
    maxSupply: 0,
    supplyLocked: false,
    mintPriceEth: BASE_MINT_PRICE_ETH,
    impactPct: IMPACT_SPLIT_PCT,
    globalDonatedEth: isLiveChain ? 0 : Number(defaultTotal.toFixed(4)),
    liquidityReserveEth: isLiveChain ? 0 : 0.64,
    liquidityThresholdEth: 1.0,
    liquiditySeeded: false,
    userCoinBalance: isLiveChain ? 0 : 320,
    coinTotalSupply: isLiveChain ? 0 : 48200,
    totalCoinsDonatedToResearch: isLiveChain ? 0 : 4820,
    reactionStage: isLiveChain ? 1 : stageFromEth(defaultTotal),
    causes: DEFAULT_CAUSES.map((c) => ({ ...c, raisedEth: isLiveChain ? 0 : c.raisedEth })),
    vessels: isLiveChain ? [] : createInitialDemoVessels(),
    recentDiscoveries: []
  };

  if (typeof window !== "undefined") {
    try {
      if (isLiveChain) {
        const cached = window.localStorage.getItem(chainCacheKey(TARGET_CHAIN_ID, activeContract));
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed.globalDonatedEth === "number") {
            return {
              ...base,
              ...parsed,
              contractAddress: activeContract,
              coinAddress: activeCoin,
              chainSynced: true,
              walletAddress
            };
          }
        }
      } else {
        const saved = window.localStorage.getItem(DEMO_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && Array.isArray(parsed.vessels)) {
            const migratedSupply =
              parsed.totalSupply === 159 && parsed.vessels.length <= 6
                ? Math.max(6, parsed.vessels.length)
                : Math.max(Number(parsed.totalSupply || 0), parsed.vessels.length, 1);
            return {
              ...base,
              ...parsed,
              contractAddress: "",
              coinAddress: "",
              connectedMode: "simulation",
              totalSupply: migratedSupply,
              chainSynced: true,
              walletAddress
            };
          }
        }
      }
    } catch {
      // ignore storage errors
    }
  }
  return base;
}

export function loadInitialCollectionState(): CollectionState {
  return loadCollectionStateForMode(loadNetworkMode(), null);
}

export function saveDemoState(state: CollectionState) {
  if (state.contractAddress || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      DEMO_STORAGE_KEY,
      JSON.stringify({
        totalSupply: state.totalSupply,
        maxSupply: state.maxSupply,
        globalDonatedEth: state.globalDonatedEth,
        liquidityReserveEth: state.liquidityReserveEth,
        liquidityThresholdEth: state.liquidityThresholdEth,
        liquiditySeeded: state.liquiditySeeded,
        userCoinBalance: state.userCoinBalance,
        totalCoinsDonatedToResearch: state.totalCoinsDonatedToResearch,
        reactionStage: state.reactionStage,
        causes: state.causes,
        vessels: state.vessels.slice(0, 80)
      })
    );
  } catch {
    // ignore storage errors
  }
}

export function modeFromChainId(chainId: number): CollectionState["connectedMode"] {
  if (chainId === 1 || chainId === 8453) return "mainnet";
  if (chainId === 11155111 || chainId === 84532) return "sepolia";
  if (chainId === 31337) return "local";
  return "simulation";
}

export function buildAnimationUrl(params: {
  tokenId: number;
  seed: string;
  causeId: number;
  complexityTier?: number;
  sectorsMask?: number;
  tokenValueUsd?: number;
  totalSupply?: number;
  contractAddress?: string;
  chainId?: number;
  tokenImpactEth?: number;
  globalImpactEth?: number;
}): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://alchemia.art";
  const url = new URL("/animation.html", origin);
  url.searchParams.set("tokenId", String(params.tokenId));
  url.searchParams.set("seed", params.seed);
  url.searchParams.set("cause", String(params.causeId));
  if (params.complexityTier) url.searchParams.set("tier", String(params.complexityTier));
  if (params.sectorsMask !== undefined) url.searchParams.set("sectors", String(params.sectorsMask));
  if (params.tokenValueUsd !== undefined) url.searchParams.set("usd", String(params.tokenValueUsd));
  if (params.totalSupply !== undefined && params.totalSupply > 0) {
    url.searchParams.set("supply", String(params.totalSupply));
  }
  if (params.contractAddress) {
    url.searchParams.set("contract", params.contractAddress);
    url.searchParams.set("chainId", String(params.chainId || 1));
  } else {
    if (params.tokenImpactEth !== undefined) url.searchParams.set("tokenEth", params.tokenImpactEth.toFixed(5));
    if (params.globalImpactEth !== undefined) url.searchParams.set("globalEth", params.globalImpactEth.toFixed(4));
  }
  return url.toString();
}

let activeEip1193Provider: ethers.Eip1193Provider | null = null;
const readProviderCache = new Map<string, JsonRpcProvider>();

// Canonical Multicall3 address deployed identically across Ethereum, Base, Base Sepolia & Sepolia
const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";
const MULTICALL3_ABI = [
  "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[])"
];

function getReadProvider(chainId: number, customUrl?: string): JsonRpcProvider {
  const rpcUrl = customUrl || CHAIN_RPC_URLS[chainId] || CHAIN_RPC_URLS[1];
  const key = `${chainId}:${rpcUrl}`;
  const existing = readProviderCache.get(key);
  if (existing) return existing;
  const network = ethers.Network.from(chainId);
  const provider = new JsonRpcProvider(rpcUrl, network, {
    staticNetwork: network,
    batchMaxCount: 1
  });
  readProviderCache.set(key, provider);
  return provider;
}

async function runMulticall3(
  provider: JsonRpcProvider,
  calls: Array<{ target: string; callData: string }>
): Promise<Array<{ success: boolean; returnData: string }>> {
  const mc = new Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);
  const payload = calls.map((c) => ({ target: c.target, allowFailure: true, callData: c.callData }));
  return (await mc.aggregate3.staticCall(payload)) as Array<{
    success: boolean;
    returnData: string;
  }>;
}

function getSelectedProvider(): ethers.Eip1193Provider | undefined {
  return (
    activeEip1193Provider ||
    (window as unknown as { ethereum?: ethers.Eip1193Provider }).ethereum
  );
}

export function clearSelectedWalletProvider() {
  activeEip1193Provider = null;
}

export function subscribeWalletEvents(
  onAccountsChanged: (accounts: string[]) => void,
  onChainChanged: (chainId: number) => void
): () => void {
  const eth = getSelectedProvider() as
    | (ethers.Eip1193Provider & {
        on?: (event: string, listener: (...args: unknown[]) => void) => void;
        removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
      })
    | undefined;
  if (!eth?.on) return () => {};

  const handleAccounts = (raw: unknown) => {
    const arr = Array.isArray(raw) ? raw.map((a) => String(a)) : [];
    onAccountsChanged(arr);
  };
  const handleChain = (raw: unknown) => {
    const parsed = typeof raw === "string" ? Number.parseInt(raw, 16) : Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) onChainChanged(parsed);
  };

  eth.on("accountsChanged", handleAccounts);
  eth.on("chainChanged", handleChain);
  return () => {
    eth.removeListener?.("accountsChanged", handleAccounts);
    eth.removeListener?.("chainChanged", handleChain);
  };
}

export async function ensureTargetNetwork(
  targetChainId: number,
  customProvider?: unknown
): Promise<void> {
  const eth = (customProvider || getSelectedProvider()) as
    | (ethers.Eip1193Provider & {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      })
    | undefined;
  if (!eth?.request) return;

  const hexChain = `0x${targetChainId.toString(16)}`;
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChain }]
    });
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 4902 && targetChainId === 84532) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0x14a34",
            chainName: "Base Sepolia",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://sepolia.base.org"],
            blockExplorerUrls: ["https://sepolia.basescan.org"]
          }
        ]
      });
    }
  }
}

export async function connectInjectedWallet(customProvider?: unknown): Promise<{
  address: string;
  chainId: number;
  provider: BrowserProvider;
}> {
  const eth = (customProvider || getSelectedProvider()) as ethers.Eip1193Provider | undefined;
  if (!eth) {
    throw new Error("No Ethereum wallet detected. Install Coinbase Wallet, MetaMask, or Rabby.");
  }
  activeEip1193Provider = eth;
  await ensureTargetNetwork(TARGET_CHAIN_ID, eth);
  const provider = new BrowserProvider(eth);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const network = await provider.getNetwork();
  return {
    address: await signer.getAddress(),
    chainId: Number(network.chainId),
    provider
  };
}

export async function fetchOnChainCollectionSnapshot(
  contractAddress: string,
  chainId: number,
  walletAddress?: string | null
): Promise<Partial<CollectionState> | null> {
  if (!contractAddress || !ethers.isAddress(contractAddress)) return null;

  const candidates = Array.from(
    new Set([CHAIN_RPC_URLS[chainId] || CHAIN_RPC_URLS[1], ...(CHAIN_RPC_FALLBACKS[chainId] || [])])
  );

  let lastErr: unknown = null;
  for (const rpcUrl of candidates) {
    try {
      return await fetchCollectionWithProvider(
        getReadProvider(chainId, rpcUrl),
        contractAddress,
        chainId,
        walletAddress
      );
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

async function fetchCollectionWithProvider(
  provider: JsonRpcProvider,
  contractAddress: string,
  chainId: number,
  walletAddress?: string | null
): Promise<Partial<CollectionState>> {
  const contract = new Contract(contractAddress, ALCHEMIA_ABI, provider);
  const nftIface = contract.interface;
  const coinIface = new ethers.Interface(ALCHEMIA_COIN_ABI);
  const useMulticall = chainId !== 31337;

  let totalSupply: bigint;
  let maxSupply: bigint;
  let supplyLocked: boolean;
  let mintPriceWei: bigint;
  let totalDonatedWei: bigint;
  let liquidityReserveWei: bigint;
  let liquidityThresholdWei: bigint;
  let liquiditySeeded: boolean;
  let totalCoinsTithed: bigint;
  let reactionStage: bigint;
  let rawCauses: Array<{
    name: string;
    category: string;
    researchWallet: string;
    totalRaisedWei: bigint;
    mintCount: bigint;
  }>;
  let coinAddr: string;

  if (useMulticall) {
    // Pack all 12 global contract reads into ONE single Multicall3 eth_call!
    const globalFns = [
      "totalSupply",
      "maxSupply",
      "supplyConfigLocked",
      "mintPriceWei",
      "totalDonatedWei",
      "liquidityReserveWei",
      "liquidityThresholdWei",
      "liquiditySeeded",
      "totalCoinsTithedToResearch",
      "currentReactionStage",
      "getAllCauses",
      "coin"
    ] as const;
    const mcRes = await runMulticall3(
      provider,
      globalFns.map((fn) => ({ target: contractAddress, callData: nftIface.encodeFunctionData(fn) }))
    );
    if (mcRes.some((r) => !r.success)) {
      throw new Error("Multicall3 global read failed");
    }
    totalSupply = nftIface.decodeFunctionResult("totalSupply", mcRes[0].returnData)[0];
    maxSupply = nftIface.decodeFunctionResult("maxSupply", mcRes[1].returnData)[0];
    supplyLocked = nftIface.decodeFunctionResult("supplyConfigLocked", mcRes[2].returnData)[0];
    mintPriceWei = nftIface.decodeFunctionResult("mintPriceWei", mcRes[3].returnData)[0];
    totalDonatedWei = nftIface.decodeFunctionResult("totalDonatedWei", mcRes[4].returnData)[0];
    liquidityReserveWei = nftIface.decodeFunctionResult("liquidityReserveWei", mcRes[5].returnData)[0];
    liquidityThresholdWei = nftIface.decodeFunctionResult("liquidityThresholdWei", mcRes[6].returnData)[0];
    liquiditySeeded = nftIface.decodeFunctionResult("liquiditySeeded", mcRes[7].returnData)[0];
    totalCoinsTithed = nftIface.decodeFunctionResult("totalCoinsTithedToResearch", mcRes[8].returnData)[0];
    reactionStage = nftIface.decodeFunctionResult("currentReactionStage", mcRes[9].returnData)[0];
    rawCauses = nftIface.decodeFunctionResult("getAllCauses", mcRes[10].returnData)[0];
    coinAddr = String(nftIface.decodeFunctionResult("coin", mcRes[11].returnData)[0]);
  } else {
    [
      totalSupply,
      maxSupply,
      supplyLocked,
      mintPriceWei,
      totalDonatedWei,
      liquidityReserveWei,
      liquidityThresholdWei,
      liquiditySeeded,
      totalCoinsTithed,
      reactionStage,
      rawCauses,
      coinAddr
    ] = await Promise.all([
      contract.totalSupply(),
      contract.maxSupply(),
      contract.supplyConfigLocked(),
      contract.mintPriceWei(),
      contract.totalDonatedWei(),
      contract.liquidityReserveWei(),
      contract.liquidityThresholdWei(),
      contract.liquiditySeeded(),
      contract.totalCoinsTithedToResearch(),
      contract.currentReactionStage(),
      contract.getAllCauses(),
      contract.coin()
    ]);
  }

  const causes: ResearchCauseInfo[] = rawCauses.map((c, i) => {
    const fb = DEFAULT_CAUSES[i % DEFAULT_CAUSES.length];
    return {
      id: i,
      name: c.name,
      shortName: fb.shortName,
      category: c.category,
      summary: fb.summary,
      recipientLabel: `${c.researchWallet.slice(0, 6)}…${c.researchWallet.slice(-4)}`,
      researchWallet: c.researchWallet,
      raisedEth: Number(ethers.formatEther(c.totalRaisedWei)),
      mintCount: Number(c.mintCount),
      accent: fb.accent
    };
  });

  // Collect up to 72 real on-chain NFTs so the living neighborhood displays real minted plots
  // across Ring 1, Ring 2, and Ring 3 Expansion Districts:
  //  1) Connected wallet's own tokens (via ERC721Enumerable balanceOf / tokenOfOwnerByIndex)
  //  2) Newest 64 minted tokens (supNum down to supNum - 63)
  //  3) Pioneer founder tokens #1..#8 so Inner Boulevard always shows real founders!
  const supNum = Number(totalSupply);
  const idSet = new Set<number>();
  const hasCoin = ethers.isAddress(String(coinAddr));
  const hasWallet = Boolean(walletAddress && ethers.isAddress(walletAddress));

  if (hasWallet && walletAddress && supNum > 0) {
    try {
      const rawBal = (await contract.balanceOf(walletAddress)) as bigint;
      const ownedCount = Math.min(Number(rawBal), 16);
      if (ownedCount > 0) {
        if (useMulticall) {
          const ownCalls: Array<{ target: string; callData: string }> = [];
          for (let idx = 0; idx < ownedCount; idx++) {
            ownCalls.push({
              target: contractAddress,
              callData: nftIface.encodeFunctionData("tokenOfOwnerByIndex", [walletAddress, idx])
            });
          }
          const ownRes = await runMulticall3(provider, ownCalls);
          for (const r of ownRes) {
            if (!r.success) continue;
            const tid = Number(nftIface.decodeFunctionResult("tokenOfOwnerByIndex", r.returnData)[0]);
            if (tid >= 1 && tid <= supNum) idSet.add(tid);
          }
        } else {
          const ownedIds = await Promise.all(
            Array.from({ length: ownedCount }, (_, idx) =>
              contract.tokenOfOwnerByIndex(walletAddress, idx)
            )
          );
          for (const rawTid of ownedIds) {
            const tid = Number(rawTid);
            if (tid >= 1 && tid <= supNum) idSet.add(tid);
          }
        }
      }
    } catch {
      // non-fatal if RPC rejects enumeration call
    }
  }

  const recentCount = Math.min(supNum, 64);
  for (let id = supNum; id >= Math.max(1, supNum - recentCount + 1); id--) {
    idSet.add(id);
  }
  const pioneerCount = Math.min(supNum, 8);
  for (let id = 1; id <= pioneerCount; id++) {
    idSet.add(id);
  }
  const ids = Array.from(idSet)
    .sort((a, b) => b - a)
    .slice(0, 72);

  let vessels: MintedVessel[] = [];
  let userCoinBalance = 0;
  let coinTotalSupply = 0;
  let directCoinDonations = 0;

  const formatVessel = (
    id: number,
    snap: {
      seed: string;
      causeId: bigint;
      mintedAt: bigint;
      tokenTotalValueWei: bigint;
      tokenImpactWei: bigint;
      sectorsMask: bigint;
      pendingCoins: bigint;
      miningRatePerHour: bigint;
      workUnits: bigint;
      causeName: string;
    },
    owner: string,
    estate?: OnChainEstateBlueprint
  ): MintedVessel => {
    const valEth = Number(ethers.formatEther(snap.tokenTotalValueWei));
    const pendingCoinsNum = Number(ethers.formatEther(snap.pendingCoins));
    const miningRateNum = Number(ethers.formatEther(snap.miningRatePerHour));
    const nowMs = Date.now();
    const approxElapsedMs =
      miningRateNum > 0 ? Math.round((pendingCoinsNum / miningRateNum) * 3600000) : 0;
    const isMine =
      Boolean(walletAddress) && String(owner).toLowerCase() === String(walletAddress).toLowerCase();
    return {
      tokenId: id,
      seed: String(snap.seed) as `0x${string}`,
      causeId: Number(snap.causeId),
      causeName: String(snap.causeName),
      minter: isMine ? "You" : `${String(owner).slice(0, 6)}…${String(owner).slice(-4)}`,
      ownedByUser: isMine,
      onChain: true,
      valueUsd: Math.max(1, Math.round(ethToUsd(valEth))),
      impactEth: Number(ethers.formatEther(snap.tokenImpactWei)),
      sectorsMask: Number(snap.sectorsMask),
      workUnits: Number(snap.workUnits),
      lastClaimMs: nowMs - approxElapsedMs,
      onChainPendingCoins: pendingCoinsNum,
      onChainMiningRate: miningRateNum,
      syncedAtMs: nowMs,
      mintedAt: Number(snap.mintedAt),
      estate
    };
  };

  const decodeEstateTuple = (rawBp: {
    houseSize: bigint;
    houseFloors: bigint;
    extraRoomsMask: bigint;
    hasBasement: boolean;
    gardenHarvests: bigint;
    stylePacked: bigint;
  }, profileCode: string): OnChainEstateBlueprint => {
    const sz = Number(rawBp.houseSize);
    const fl = Number(rawBp.houseFloors);
    return {
      houseSize: (sz === 3 ? 3 : sz === 2 ? 2 : 1) as 1 | 2 | 3,
      houseFloors: (fl === 3 ? 3 : fl === 1 ? 1 : 2) as 1 | 2 | 3,
      hasBasement: Boolean(rawBp.hasBasement),
      extraRoomsMask: Number(rawBp.extraRoomsMask),
      gardenHarvests: Number(rawBp.gardenHarvests),
      stylePackedHex: `0x${BigInt(rawBp.stylePacked).toString(16)}`,
      profileCode: profileCode || undefined
    };
  };

  if (useMulticall && (ids.length > 0 || hasCoin)) {
    // Chunk Multicall3 batches safely (<= 24 tokens × 3 calls = 72 calls per aggregate3)
    const CHUNK_TOKENS = 24;
    const chunks: number[][] = [];
    for (let start = 0; start < ids.length; start += CHUNK_TOKENS) {
      chunks.push(ids.slice(start, start + CHUNK_TOKENS));
    }
    if (chunks.length === 0) chunks.push([]);

    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      const chunkIds = chunks[cIdx];
      const includeCoin = cIdx === 0 && hasCoin;
      const batchCalls: Array<{ target: string; callData: string }> = [];
      for (const id of chunkIds) {
        batchCalls.push({
          target: contractAddress,
          callData: nftIface.encodeFunctionData("getLiveImpactSnapshot", [id])
        });
        batchCalls.push({
          target: contractAddress,
          callData: nftIface.encodeFunctionData("ownerOf", [id])
        });
        batchCalls.push({
          target: contractAddress,
          callData: nftIface.encodeFunctionData("getEstateBlueprint", [id])
        });
      }
      const coinStartIdx = batchCalls.length;
      if (includeCoin) {
        batchCalls.push({ target: coinAddr, callData: coinIface.encodeFunctionData("totalSupply") });
        batchCalls.push({
          target: coinAddr,
          callData: coinIface.encodeFunctionData("totalDonatedToResearch")
        });
        if (hasWallet && walletAddress) {
          batchCalls.push({
            target: coinAddr,
            callData: coinIface.encodeFunctionData("balanceOf", [walletAddress])
          });
        }
      }
      if (batchCalls.length === 0) continue;

      const res = await runMulticall3(provider, batchCalls);
      for (let i = 0; i < chunkIds.length; i++) {
        const snapRes = res[i * 3];
        const ownRes = res[i * 3 + 1];
        const estRes = res[i * 3 + 2];
        if (!snapRes?.success || !ownRes?.success) continue;
        const snap = nftIface.decodeFunctionResult("getLiveImpactSnapshot", snapRes.returnData)[0];
        const owner = String(nftIface.decodeFunctionResult("ownerOf", ownRes.returnData)[0]);
        let estate: OnChainEstateBlueprint | undefined;
        if (estRes?.success) {
          try {
            const decoded = nftIface.decodeFunctionResult("getEstateBlueprint", estRes.returnData);
            estate = decodeEstateTuple(decoded[0], String(decoded[1] || ""));
          } catch {
            // Backward-compatible with V1 contracts
          }
        }
        vessels.push(formatVessel(chunkIds[i], snap, owner, estate));
      }
      if (includeCoin) {
        if (res[coinStartIdx]?.success) {
          coinTotalSupply = Number(
            ethers.formatEther(coinIface.decodeFunctionResult("totalSupply", res[coinStartIdx].returnData)[0])
          );
        }
        if (res[coinStartIdx + 1]?.success) {
          directCoinDonations = Number(
            ethers.formatEther(
              coinIface.decodeFunctionResult("totalDonatedToResearch", res[coinStartIdx + 1].returnData)[0]
            )
          );
        }
        if (hasWallet && res[coinStartIdx + 2]?.success) {
          userCoinBalance = Number(
            ethers.formatEther(coinIface.decodeFunctionResult("balanceOf", res[coinStartIdx + 2].returnData)[0])
          );
        }
      }
    }
  } else {
    vessels = await Promise.all(
      ids.map(async (id) => {
        const [snap, owner] = await Promise.all([
          contract.getLiveImpactSnapshot(id),
          contract.ownerOf(id)
        ]);
        return formatVessel(id, snap, String(owner));
      })
    );
    if (hasCoin) {
      const coin = new Contract(String(coinAddr), ALCHEMIA_COIN_ABI, provider);
      const [rawSup, rawDirect] = await Promise.all([
        coin.totalSupply(),
        coin.totalDonatedToResearch()
      ]);
      coinTotalSupply = Number(ethers.formatEther(rawSup));
      directCoinDonations = Number(ethers.formatEther(rawDirect));
      if (hasWallet && walletAddress) {
        const rawBal = await coin.balanceOf(walletAddress);
        userCoinBalance = Number(ethers.formatEther(rawBal));
      }
    }
  }

  return {
    connectedMode: modeFromChainId(chainId),
    chainSynced: true,
    chainId,
    contractAddress,
    coinAddress: String(coinAddr),
    totalSupply: supNum,
    maxSupply: Number(maxSupply),
    supplyLocked: Boolean(supplyLocked),
    mintPriceEth: Number(ethers.formatEther(mintPriceWei)),
    globalDonatedEth: Number(ethers.formatEther(totalDonatedWei)),
    liquidityReserveEth: Number(ethers.formatEther(liquidityReserveWei)),
    liquidityThresholdEth: Number(ethers.formatEther(liquidityThresholdWei)),
    liquiditySeeded: Boolean(liquiditySeeded),
    userCoinBalance,
    coinTotalSupply,
    totalCoinsDonatedToResearch:
      Number(ethers.formatEther(totalCoinsTithed)) + directCoinDonations,
    reactionStage: Number(reactionStage),
    causes,
    vessels
  };
}

/**
 * Fetches recent on-chain ResearchDiscoveryAnchored proof events independently
 * so initial Home / Gallery hydration stays sub-second (~300ms via Multicall3).
 */
export async function fetchRecentResearchDiscoveries(
  contractAddress: string,
  chainId: number
): Promise<ResearchDiscoveryLog[]> {
  if (!contractAddress || !ethers.isAddress(contractAddress)) return [];
  const candidates = Array.from(
    new Set([CHAIN_RPC_URLS[chainId] || CHAIN_RPC_URLS[1], ...(CHAIN_RPC_FALLBACKS[chainId] || [])])
  );
  for (const rpcUrl of candidates) {
    try {
      const provider = getReadProvider(chainId, rpcUrl);
      const contract = new Contract(contractAddress, ALCHEMIA_ABI, provider);
      const latestBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - 5000);
      const logs = await contract.queryFilter(
        contract.filters.ResearchDiscoveryAnchored(),
        fromBlock,
        latestBlock
      );
      return logs
        .slice(-8)
        .reverse()
        .map((log) => {
          const parsed = contract.interface.parseLog(log);
          return {
            tokenId: Number(parsed?.args?.tokenId || 0),
            contributor: String(parsed?.args?.contributor || ""),
            proofHash: String(parsed?.args?.proofHash || ""),
            bestEnergy: Number(parsed?.args?.bestEnergyMicro || 0n) / 1e6,
            addedWorkUnits: Number(parsed?.args?.addedWorkUnits || 0),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber
          };
        });
    } catch {
      // Try next fallback RPC silently
    }
  }
  return [];
}

export async function fetchTokenLiveSnapshotOnChain(
  contractAddress: string,
  chainId: number,
  tokenId: number
) {
  const provider = getReadProvider(chainId);
  const contract = new Contract(contractAddress, ALCHEMIA_ABI, provider);
  const snap = await contract.getLiveImpactSnapshot(tokenId);
  return {
    seed: String(snap.seed),
    causeId: Number(snap.causeId),
    mintedAt: Number(snap.mintedAt),
    tokenTotalValueEth: Number(ethers.formatEther(snap.tokenTotalValueWei)),
    tokenImpactEth: Number(ethers.formatEther(snap.tokenImpactWei)),
    causeImpactEth: Number(ethers.formatEther(snap.causeTotalWei)),
    globalImpactEth: Number(ethers.formatEther(snap.globalTotalDonatedWei)),
    totalSupply: Number(snap.currentSupply),
    maxSupply: Number(snap.currentMaxSupply),
    isSupplyLocked: Boolean(snap.isSupplyLocked),
    reactionStage: Number(snap.reactionStage),
    complexityTier: Number(snap.complexityTier),
    sectorsMask: Number(snap.sectorsMask),
    pendingCoins: Number(ethers.formatEther(snap.pendingCoins)),
    miningRatePerHour: Number(ethers.formatEther(snap.miningRatePerHour)),
    workUnits: Number(snap.workUnits),
    causeName: String(snap.causeName)
  };
}

export async function executeOnChainMint(params: {
  contractAddress: string;
  quantity: number;
  causeId: number;
  totalEth: number;
}): Promise<{ txHash: string; tokenId: number; seed: `0x${string}` }> {
  const eth = getSelectedProvider();
  if (!eth) throw new Error("Ethereum wallet not connected");

  const provider = new BrowserProvider(eth);
  const signer = await provider.getSigner();
  const contract = new Contract(params.contractAddress, ALCHEMIA_ABI, signer);

  const tx = await contract.mint(params.quantity, params.causeId, {
    value: ethers.parseEther(params.totalEth.toFixed(6))
  });
  const receipt = await tx.wait();

  let mintedTokenId = 1;
  let mintedSeed: `0x${string}` = randomSeedHex();
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === "VesselMinted") {
        mintedTokenId = Number(parsed.args.tokenId);
        mintedSeed = String(parsed.args.seed) as `0x${string}`;
        break;
      }
    } catch {
      // ignore non-matching logs
    }
  }
  return { txHash: tx.hash, tokenId: mintedTokenId, seed: mintedSeed };
}

export async function executeOnChainUpgradeVessel(params: {
  contractAddress: string;
  tokenId: number;
  addedEth: number;
}): Promise<string> {
  const eth = getSelectedProvider();
  if (!eth) throw new Error("Ethereum wallet not connected");

  const provider = new BrowserProvider(eth);
  const signer = await provider.getSigner();
  const contract = new Contract(params.contractAddress, ALCHEMIA_ABI, signer);
  const tx = await contract.upgradeVessel(params.tokenId, {
    value: ethers.parseEther(params.addedEth.toFixed(6))
  });
  await tx.wait();
  return tx.hash;
}

export async function executeOnChainBuildSector(params: {
  contractAddress: string;
  coinAddress?: string;
  tokenId: number;
  sectorId: number;
  payWithCoins: boolean;
  coinCost?: number;
  ethAmount?: number;
}): Promise<string> {
  const eth = getSelectedProvider();
  if (!eth) throw new Error("Ethereum wallet not connected");

  const provider = new BrowserProvider(eth);
  const signer = await provider.getSigner();
  const contract = new Contract(params.contractAddress, ALCHEMIA_ABI, signer);

  if (params.payWithCoins) {
    const coinAddr = params.coinAddress || (await contract.coin());
    const coin = new Contract(coinAddr, ALCHEMIA_COIN_ABI, signer);
    const needed = ethers.parseEther(String(params.coinCost || 1000));
    const currentAllowance: bigint = await coin.allowance(await signer.getAddress(), params.contractAddress);
    if (currentAllowance < needed) {
      const approveTx = await coin.approve(params.contractAddress, needed);
      await approveTx.wait();
    }
    const tx = await contract.buildLabSectorWithCoins(params.tokenId, params.sectorId);
    await tx.wait();
    return tx.hash;
  }

  const tx = await contract.buildLabSectorWithEth(params.tokenId, params.sectorId, {
    value: ethers.parseEther((params.ethAmount || 0.002).toFixed(6))
  });
  await tx.wait();
  return tx.hash;
}

export async function executeOnChainClaimCoins(params: {
  contractAddress: string;
  tokenId: number;
  researchTithePct: number;
}): Promise<string> {
  const eth = getSelectedProvider();
  if (!eth) throw new Error("Ethereum wallet not connected");

  const provider = new BrowserProvider(eth);
  const signer = await provider.getSigner();
  const contract = new Contract(params.contractAddress, ALCHEMIA_ABI, signer);
  const bps = Math.max(0, Math.min(10000, Math.round(params.researchTithePct * 100)));
  const tx = await contract.claimMinedCoins(params.tokenId, bps);
  await tx.wait();
  return tx.hash;
}

export async function executeOnChainDonateCoins(params: {
  coinAddress: string;
  researchWallet: string;
  amountCoins: number;
}): Promise<string> {
  const eth = getSelectedProvider();
  if (!eth) throw new Error("Ethereum wallet not connected");

  const provider = new BrowserProvider(eth);
  const signer = await provider.getSigner();
  const coin = new Contract(params.coinAddress, ALCHEMIA_COIN_ABI, signer);
  const tx = await coin.donateToResearch(
    params.researchWallet,
    ethers.parseEther(params.amountCoins.toFixed(4))
  );
  await tx.wait();
  return tx.hash;
}

export async function executeOnChainSubmitResearchProof(params: {
  contractAddress: string;
  tokenId: number;
  proofHash: string;
  bestEnergy: number;
  workUnits: number;
}): Promise<string> {
  const eth = getSelectedProvider();
  if (!eth) throw new Error("Ethereum wallet not connected");

  const provider = new BrowserProvider(eth);
  const signer = await provider.getSigner();
  const contract = new Contract(params.contractAddress, ALCHEMIA_ABI, signer);
  const bestEnergyMicro = BigInt(Math.round(params.bestEnergy * 1e6));
  const wus = Math.max(1, Math.round(params.workUnits));
  const tx = await contract.submitResearchProof(
    params.tokenId,
    params.proofHash,
    bestEnergyMicro,
    wus,
    `pdb://alchemia-lab-${params.tokenId}`
  );
  await tx.wait();
  return tx.hash;
}

export async function executeOnChainSeedLiquidity(contractAddress: string): Promise<string> {
  const eth = getSelectedProvider();
  if (!eth) throw new Error("Ethereum wallet not connected");

  const provider = new BrowserProvider(eth);
  const signer = await provider.getSigner();
  const contract = new Contract(contractAddress, ALCHEMIA_ABI, signer);
  const tx = await contract.seedLiquidity();
  await tx.wait();
  return tx.hash;
}

export async function executeOnChainExpandEstate(params: {
  contractAddress: string;
  coinAddress?: string;
  tokenId: number;
  targetSize: 1 | 2 | 3;
  targetFloors: 1 | 2 | 3;
  enableBasement: boolean;
  extraRoomsMask: number;
  payWithCoins: boolean;
  coinCost?: number;
  ethAmount?: number;
}): Promise<string> {
  const eth = getSelectedProvider();
  if (!eth) throw new Error("Ethereum wallet not connected");

  const provider = new BrowserProvider(eth);
  const signer = await provider.getSigner();
  const contract = new Contract(params.contractAddress, ALCHEMIA_ABI, signer);

  if (params.payWithCoins) {
    const coinAddr = params.coinAddress || (await contract.coin());
    const coin = new Contract(coinAddr, ALCHEMIA_COIN_ABI, signer);
    const needed = ethers.parseEther(String(Math.max(1, params.coinCost || 45)));
    const currentAllowance: bigint = await coin.allowance(
      await signer.getAddress(),
      params.contractAddress
    );
    if (currentAllowance < needed) {
      const approveTx = await coin.approve(params.contractAddress, needed);
      await approveTx.wait();
    }
    const tx = await contract.expandEstateWithCoins(
      params.tokenId,
      params.targetSize,
      params.targetFloors,
      params.enableBasement,
      params.extraRoomsMask
    );
    await tx.wait();
    return tx.hash;
  }

  const tx = await contract.expandEstateWithEth(
    params.tokenId,
    params.targetSize,
    params.targetFloors,
    params.enableBasement,
    params.extraRoomsMask,
    {
      value: ethers.parseEther(Math.max(0.0008, params.ethAmount || 0.0008).toFixed(6))
    }
  );
  await tx.wait();
  return tx.hash;
}

export async function executeOnChainSyncEstateCustomization(params: {
  contractAddress: string;
  tokenId: number;
  stylePacked: bigint;
  gardenHarvests: number;
  profileCode: string;
}): Promise<string> {
  const eth = getSelectedProvider();
  if (!eth) throw new Error("Ethereum wallet not connected");

  const provider = new BrowserProvider(eth);
  const signer = await provider.getSigner();
  const contract = new Contract(params.contractAddress, ALCHEMIA_ABI, signer);
  const safeCode = params.profileCode.slice(0, 250);
  const tx = await contract.syncEstateCustomization(
    params.tokenId,
    params.stylePacked,
    Math.max(0, Math.floor(params.gardenHarvests)),
    safeCode
  );
  await tx.wait();
  return tx.hash;
}

export { complexityTierFromUsd, ethToUsd, usdToEth };
