/**
 * Living Town Weather, Rotating UTC Daily Bounties, Neighbor Daily Favors
 * & Best-Friend Town Synergy Multiplier Engine.
 *
 * Keeps Alchemia Town feeling alive every time a player returns:
 *  - 4 dynamic weather profiles with real gameplay buffs (e.g., Gentle Crystal Rain
 *    auto-waters outdoor garden beds and speeds plant growth by +50%!)
 *  - 3 deterministic daily UTC town bounties awarding claimable Sparks & Researcher XP
 *  - Neighbor daily favor desires (e.g., gifting a crafted Blossom Bouquet or co-folding)
 *  - Neighborhood Best-Friend Synergy bonus scaling ALCH mining & research output
 */

import type { AtmosphereMode, LightingMood } from "./alchemy3DRenderer";
import type { StoredNeighborRelation } from "./simsState";

// ============================================================================
// 1. Dynamic Town Weather System
// ============================================================================

export type TownWeatherId =
  | "sunlit-breeze"
  | "sakura-shower"
  | "gentle-rain"
  | "starlight-aurora";

export interface TownWeatherDef {
  id: TownWeatherId;
  label: string;
  shortLabel: string;
  desc: string;
  perkLabel: string;
  accent: string;
  lightingMood: LightingMood;
  atmosphereMode: AtmosphereMode;
  gardenGrowthMult: number;
  miningMult: number;
  goldenChanceBonus: number;
  socialBonus: number;
  autoWatersGardens: boolean;
}

export const TOWN_WEATHERS: readonly TownWeatherDef[] = [
  {
    id: "sunlit-breeze",
    label: "Sunlit Breeze",
    shortLabel: "Sunlit",
    desc: "Bright alabaster sky with calm courtyard light",
    perkLabel: "+10% Focus clarity",
    accent: "#38bdf8",
    lightingMood: "daylight",
    atmosphereMode: "clear",
    gardenGrowthMult: 1.0,
    miningMult: 1.0,
    goldenChanceBonus: 0,
    socialBonus: 0,
    autoWatersGardens: false
  },
  {
    id: "sakura-shower",
    label: "Sakura Breeze",
    shortLabel: "Petals",
    desc: "Golden hour light with drifting crystal petals",
    perkLabel: "+15% Garden · +3 Social",
    accent: "#f472b6",
    lightingMood: "golden",
    atmosphereMode: "motes",
    gardenGrowthMult: 1.15,
    miningMult: 1.0,
    goldenChanceBonus: 0.06,
    socialBonus: 3,
    autoWatersGardens: false
  },
  {
    id: "gentle-rain",
    label: "Crystal Rain",
    shortLabel: "Rain",
    desc: "Soft silver mist showering all town gardens",
    perkLabel: "+50% Garden Growth · Auto-Waters!",
    accent: "#0ea5e9",
    lightingMood: "silver",
    atmosphereMode: "snow",
    gardenGrowthMult: 1.5,
    miningMult: 1.0,
    goldenChanceBonus: 0.08,
    socialBonus: 0,
    autoWatersGardens: true
  },
  {
    id: "starlight-aurora",
    label: "Starlight Aurora",
    shortLabel: "Aurora",
    desc: "Luminous twilight sky charged with optical resonance",
    perkLabel: "+15% ALCH Mining · +15% Golden Blooms",
    accent: "#818cf8",
    lightingMood: "moonlit",
    atmosphereMode: "motes",
    gardenGrowthMult: 1.2,
    miningMult: 1.15,
    goldenChanceBonus: 0.15,
    socialBonus: 2,
    autoWatersGardens: false
  }
];

export const TOWN_WEATHER_BY_ID: Record<TownWeatherId, TownWeatherDef> = Object.fromEntries(
  TOWN_WEATHERS.map((w) => [w.id, w])
) as Record<TownWeatherId, TownWeatherDef>;

export function getAutoTownWeather(nowMs = Date.now()): TownWeatherDef {
  // Rotates gently every 3 hours UTC so the town atmosphere shifts naturally across the day
  const bucket = Math.floor(nowMs / (3 * 3600_000));
  return TOWN_WEATHERS[bucket % TOWN_WEATHERS.length];
}

// ============================================================================
// 2. Rotating UTC Daily Alchemia Town Bounties (3 Fresh Missions Daily)
// ============================================================================

export type DailyBountyMetricKey =
  | "harvests"
  | "brews"
  | "petTricks"
  | "science"
  | "social"
  | "furnish"
  | "favors";

export interface DailyBountyDef {
  id: string;
  title: string;
  desc: string;
  metric: DailyBountyMetricKey;
  target: number;
  rewardSparks: number;
  rewardXp: number;
  accent: string;
  actionHint: "gardens" | "alchemy" | "pet" | "research" | "town" | "builder";
}

export const DAILY_BOUNTY_POOL: readonly DailyBountyDef[] = [
  {
    id: "db-brew",
    title: "Apothecary Fresh Batch",
    desc: "Brew 1 botanical elixir, tea, bouquet, or pet ambrosia.",
    metric: "brews",
    target: 1,
    rewardSparks: 12,
    rewardXp: 30,
    accent: "#a855f7",
    actionHint: "alchemy"
  },
  {
    id: "db-harvest",
    title: "Morning Bloom Harvest",
    desc: "Harvest 2 blooming flowers from your home or park beds.",
    metric: "harvests",
    target: 2,
    rewardSparks: 12,
    rewardXp: 30,
    accent: "#10b981",
    actionHint: "gardens"
  },
  {
    id: "db-tricks",
    title: "Companion Trick Training",
    desc: "Perform 2 playful tricks with your 3D cat or dog.",
    metric: "petTricks",
    target: 2,
    rewardSparks: 10,
    rewardXp: 25,
    accent: "#f472b6",
    actionHint: "pet"
  },
  {
    id: "db-science",
    title: "Lab Discovery Sprint",
    desc: "Complete 3 protein folding moves or pop 3 glowing protons.",
    metric: "science",
    target: 3,
    rewardSparks: 12,
    rewardXp: 30,
    accent: "#38bdf8",
    actionHint: "research"
  },
  {
    id: "db-social",
    title: "Boulevard Good Neighbor",
    desc: "Share 2 friendly chats, jokes, sparks, or neighbor visits.",
    metric: "social",
    target: 2,
    rewardSparks: 10,
    rewardXp: 25,
    accent: "#f59e0b",
    actionHint: "town"
  },
  {
    id: "db-furnish",
    title: "Interior Stylist Touch",
    desc: "Customize 1 furnishing, wall finish, or move a station.",
    metric: "furnish",
    target: 1,
    rewardSparks: 10,
    rewardXp: 25,
    accent: "#6366f1",
    actionHint: "builder"
  },
  {
    id: "db-favor",
    title: "Town Helping Hand",
    desc: "Fulfill 1 neighbor's daily favor request across Alchemia Town.",
    metric: "favors",
    target: 1,
    rewardSparks: 16,
    rewardXp: 40,
    accent: "#ec4899",
    actionHint: "town"
  }
];

export interface DailyBountyState {
  dateKey: string;
  counts: Record<DailyBountyMetricKey, number>;
  claimedIds: string[];
  fulfilledFavorTokenIds: number[];
}

export interface EvaluatedDailyBounty {
  def: DailyBountyDef;
  progress: number;
  target: number;
  pct: number;
  readyToClaim: boolean;
  claimed: boolean;
}

const DAILY_BOUNTY_STORAGE_KEY = "alchemia.daily.bounties.v1";
let memoryDailyState: DailyBountyState | null = null;

export function utcDateKey(nowMs = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function hashDayKey(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export function getDailyTownBounties(nowMs = Date.now()): DailyBountyDef[] {
  const key = utcDateKey(nowMs);
  const seed = hashDayKey(`alchemia-bounties-${key}`);
  const pool = [...DAILY_BOUNTY_POOL];
  const picked: DailyBountyDef[] = [];
  let cursor = seed;
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    cursor = Math.imul(cursor ^ 0x9e3779b9, 2246822519) >>> 0;
    const idx = cursor % pool.length;
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

export function createInitialDailyBountyState(nowMs = Date.now()): DailyBountyState {
  return {
    dateKey: utcDateKey(nowMs),
    counts: {
      harvests: 0,
      brews: 0,
      petTricks: 0,
      science: 0,
      social: 0,
      furnish: 0,
      favors: 0
    },
    claimedIds: [],
    fulfilledFavorTokenIds: []
  };
}

export function loadDailyBountyState(nowMs = Date.now()): DailyBountyState {
  const today = utcDateKey(nowMs);
  if (memoryDailyState && memoryDailyState.dateKey === today) return memoryDailyState;
  const fresh = createInitialDailyBountyState(nowMs);
  if (typeof window === "undefined") {
    memoryDailyState = fresh;
    return fresh;
  }
  try {
    const raw = window.localStorage.getItem(DAILY_BOUNTY_STORAGE_KEY);
    if (!raw) {
      memoryDailyState = fresh;
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<DailyBountyState>;
    if (parsed.dateKey !== today) {
      memoryDailyState = fresh;
      return fresh;
    }
    const clean: DailyBountyState = {
      dateKey: today,
      counts: { ...fresh.counts, ...(parsed.counts ?? {}) },
      claimedIds: Array.isArray(parsed.claimedIds)
        ? parsed.claimedIds.filter((s): s is string => typeof s === "string")
        : [],
      fulfilledFavorTokenIds: Array.isArray(parsed.fulfilledFavorTokenIds)
        ? parsed.fulfilledFavorTokenIds.filter((n): n is number => typeof n === "number")
        : []
    };
    memoryDailyState = clean;
    return clean;
  } catch {
    memoryDailyState = fresh;
    return fresh;
  }
}

export function saveDailyBountyState(state: DailyBountyState): DailyBountyState {
  memoryDailyState = state;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(DAILY_BOUNTY_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // safe inside sandboxed iframes
    }
  }
  return state;
}

export function recordDailyBountyAction(
  state: DailyBountyState,
  metric: DailyBountyMetricKey,
  delta = 1,
  nowMs = Date.now()
): DailyBountyState {
  const today = utcDateKey(nowMs);
  const base = state.dateKey === today ? state : createInitialDailyBountyState(nowMs);
  return {
    ...base,
    counts: {
      ...base.counts,
      [metric]: (base.counts[metric] || 0) + Math.max(1, Math.round(delta))
    }
  };
}

export function evaluateDailyTownBounties(
  state: DailyBountyState,
  nowMs = Date.now()
): EvaluatedDailyBounty[] {
  const today = utcDateKey(nowMs);
  const effective = state.dateKey === today ? state : createInitialDailyBountyState(nowMs);
  const bounties = getDailyTownBounties(nowMs);
  const claimedSet = new Set(effective.claimedIds);

  return bounties.map((def) => {
    const progress = Math.min(def.target, Math.max(0, effective.counts[def.metric] || 0));
    const pct = Math.min(100, Math.round((progress / Math.max(1, def.target)) * 100));
    const claimed = claimedSet.has(def.id);
    return {
      def,
      progress,
      target: def.target,
      pct,
      claimed,
      readyToClaim: !claimed && progress >= def.target
    };
  });
}

export function claimDailyBounty(
  state: DailyBountyState,
  bountyId: string,
  nowMs = Date.now()
): {
  nextState: DailyBountyState;
  claimed: boolean;
  sparksAwarded: number;
  xpAwarded: number;
} {
  const evals = evaluateDailyTownBounties(state, nowMs);
  const found = evals.find((e) => e.def.id === bountyId);
  if (!found || !found.readyToClaim) {
    return { nextState: state, claimed: false, sparksAwarded: 0, xpAwarded: 0 };
  }
  const today = utcDateKey(nowMs);
  const base = state.dateKey === today ? state : createInitialDailyBountyState(nowMs);
  return {
    nextState: {
      ...base,
      claimedIds: [...base.claimedIds, bountyId]
    },
    claimed: true,
    sparksAwarded: found.def.rewardSparks,
    xpAwarded: found.def.rewardXp
  };
}

// ============================================================================
// 3. Neighbor Daily Favors & Best-Friend Town Synergy Multiplier
// ============================================================================

export type NeighborFavorKind = "bouquet" | "spark" | "joke" | "chat";

export interface NeighborDailyFavor {
  kind: NeighborFavorKind;
  prompt: string;
  rewardSparks: number;
  rewardXp: number;
  rewardFriendship: number;
}

const FAVOR_TEMPLATES: readonly NeighborDailyFavor[] = [
  {
    kind: "bouquet",
    prompt: "Would love a Blossom Bouquet!",
    rewardSparks: 12,
    rewardXp: 35,
    rewardFriendship: 25
  },
  {
    kind: "spark",
    prompt: "Seeking a research spark!",
    rewardSparks: 8,
    rewardXp: 25,
    rewardFriendship: 18
  },
  {
    kind: "joke",
    prompt: "Could use a science pun laugh!",
    rewardSparks: 8,
    rewardXp: 25,
    rewardFriendship: 16
  },
  {
    kind: "chat",
    prompt: "Hopeful for a friendly chat!",
    rewardSparks: 8,
    rewardXp: 25,
    rewardFriendship: 15
  }
];

export function getNeighborDailyFavor(
  tokenId: number,
  seed: string,
  nowMs = Date.now()
): NeighborDailyFavor {
  const key = `${utcDateKey(nowMs)}-${tokenId}-${seed.slice(0, 10)}`;
  const idx = hashDayKey(key) % FAVOR_TEMPLATES.length;
  return FAVOR_TEMPLATES[idx];
}

export function isNeighborFavorFulfilled(
  dailyState: DailyBountyState,
  tokenId: number,
  nowMs = Date.now()
): boolean {
  if (dailyState.dateKey !== utcDateKey(nowMs)) return false;
  return dailyState.fulfilledFavorTokenIds.includes(tokenId);
}

export function markNeighborFavorFulfilled(
  dailyState: DailyBountyState,
  tokenId: number,
  nowMs = Date.now()
): DailyBountyState {
  const today = utcDateKey(nowMs);
  const base = dailyState.dateKey === today ? dailyState : createInitialDailyBountyState(nowMs);
  if (base.fulfilledFavorTokenIds.includes(tokenId)) return base;
  return {
    ...base,
    counts: {
      ...base.counts,
      favors: (base.counts.favors || 0) + 1
    },
    fulfilledFavorTokenIds: [...base.fulfilledFavorTokenIds, tokenId]
  };
}

export interface TownFriendshipSynergy {
  goodFriendCount: number;
  bestFriendCount: number;
  miningMultiplier: number;
  bonusPct: number;
}

/**
 * Rewards building real relationships across Alchemia Town:
 *  - Every Good Friend (score 55..74) grants +3% Town Mining Synergy
 *  - Every Best Friend / Research Soulmate (score 75+) grants +6% Town Mining Synergy
 *  - Capped cleanly at +30% (1.30x)
 */
export function computeTownFriendshipSynergy(
  relationsMap: Record<number, StoredNeighborRelation>
): TownFriendshipSynergy {
  let goodFriendCount = 0;
  let bestFriendCount = 0;
  for (const rel of Object.values(relationsMap)) {
    if (rel.score >= 75) bestFriendCount++;
    else if (rel.score >= 55) goodFriendCount++;
  }
  const rawPct = Math.min(30, goodFriendCount * 3 + bestFriendCount * 6);
  return {
    goodFriendCount,
    bestFriendCount,
    bonusPct: rawPct,
    miningMultiplier: Number((1 + rawPct / 100).toFixed(2))
  };
}
