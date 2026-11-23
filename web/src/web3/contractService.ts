import { BrowserProvider, Contract, JsonRpcProvider, ethers } from "ethers";
import { ALCHEMIA_ABI, ALCHEMIA_COIN_ABI } from "./abi";
import {
  BASE_MINT_PRICE_ETH,
  CHAIN_RPC_FALLBACKS,
  CHAIN_RPC_URLS,
  COIN_CONTRACT_ADDRESS,
  CONTRACT_ADDRESS,
  DEFAULT_CAUSES,
  IMPACT_SPLIT_PCT,
  TARGET_CHAIN_ID,
  complexityTierFromUsd,
  ethToUsd,
  usdToEth,
  type ResearchCauseInfo
} from "./config";
import { randomSeedHex } from "../engine/prng";
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
const CHAIN_CACHE_PREFIX = "alchemia_chain_cache_v1_";
const COIN_ADDRESS = COIN_CONTRACT_ADDRESS;

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
        vessels: state.vessels.slice(0, 24),
        recentDiscoveries: state.recentDiscoveries.slice(0, 8)
      })
    );
  } catch {
    // ignore storage errors
  }
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

export function loadInitialCollectionState(): CollectionState {
  const defaultTotal = DEFAULT_CAUSES.reduce((sum, c) => sum + c.raisedEth, 0);
  const isLiveChain = Boolean(CONTRACT_ADDRESS);

  const base: CollectionState = {
    connectedMode: isLiveChain ? modeFromChainId(TARGET_CHAIN_ID) : "simulation",
    chainSynced: !isLiveChain,
    chainId: TARGET_CHAIN_ID,
    contractAddress: CONTRACT_ADDRESS,
    coinAddress: COIN_ADDRESS,
    walletAddress: null,
    totalSupply: isLiveChain ? 0 : 159,
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
        const cached = window.localStorage.getItem(chainCacheKey(TARGET_CHAIN_ID, CONTRACT_ADDRESS));
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed.globalDonatedEth === "number") {
            return { ...base, ...parsed, chainSynced: true, walletAddress: null };
          }
        }
      } else {
        const saved = window.localStorage.getItem(DEMO_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && Array.isArray(parsed.vessels)) {
            return { ...base, ...parsed, chainSynced: true, walletAddress: null };
          }
        }
      }
    } catch {
      // ignore storage errors
    }
  }
  return base;
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
        vessels: state.vessels.slice(0, 40)
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

  // Fetch up to 24 most recently minted live NFTs + $ALCH supply/balance in ONE single Multicall3 eth_call!
  const supNum = Number(totalSupply);
  const fetchCount = Math.min(supNum, 24);
  const ids: number[] = [];
  for (let id = supNum; id >= Math.max(1, supNum - fetchCount + 1); id--) {
    ids.push(id);
  }

  let vessels: MintedVessel[] = [];
  let userCoinBalance = 0;
  let coinTotalSupply = 0;
  let directCoinDonations = 0;
  const hasCoin = ethers.isAddress(String(coinAddr));
  const hasWallet = Boolean(walletAddress && ethers.isAddress(walletAddress));

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
    owner: string
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
      mintedAt: Number(snap.mintedAt)
    };
  };

  if (useMulticall && (ids.length > 0 || hasCoin)) {
    const batchCalls: Array<{ target: string; callData: string }> = [];
    for (const id of ids) {
      batchCalls.push({
        target: contractAddress,
        callData: nftIface.encodeFunctionData("getLiveImpactSnapshot", [id])
      });
      batchCalls.push({
        target: contractAddress,
        callData: nftIface.encodeFunctionData("ownerOf", [id])
      });
    }
    const coinStartIdx = batchCalls.length;
    if (hasCoin) {
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

    const res = await runMulticall3(provider, batchCalls);
    for (let i = 0; i < ids.length; i++) {
      const snapRes = res[i * 2];
      const ownRes = res[i * 2 + 1];
      if (!snapRes?.success || !ownRes?.success) continue;
      const snap = nftIface.decodeFunctionResult("getLiveImpactSnapshot", snapRes.returnData)[0];
      const owner = String(nftIface.decodeFunctionResult("ownerOf", ownRes.returnData)[0]);
      vessels.push(formatVessel(ids[i], snap, owner));
    }
    if (hasCoin) {
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

export { complexityTierFromUsd, ethToUsd, usdToEth };
