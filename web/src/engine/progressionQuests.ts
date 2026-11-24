/**
 * Progression Quests, Collectible Achievements & Researcher Rank Rewards Engine.
 *
 * Tracks incremental player actions alongside live world state (built rooms, floors,
 * station upgrades, garden harvests/almanac species, companion care/styling, neighbor
 * relationships, vehicle waves, proton pops, and growing town population) to award
 * claimable Lab Sparks, Researcher XP, Rank Level-Ups, and unlockable Titles.
 */

export type QuestChainId = "architect" | "science" | "botany" | "alchemy" | "companion" | "town";
export type AchievementRarity = "Common" | "Rare" | "Epic" | "Legendary";

export type ProgressionCounterKey =
  | "furnishActions"
  | "scienceActions"
  | "protonPops"
  | "plantsPlanted"
  | "petCareActions"
  | "petStyleActions"
  | "socialActions"
  | "neighborVisits"
  | "vehicleWaves"
  | "parkVisits"
  | "floorChanges"
  | "proofsAnchored"
  | "elixirsBrewed"
  | "starlightCrafted"
  | "goldenHarvests"
  | "petTricks"
  | "favorsFulfilled"
  | "bountiesClaimed";

export interface ProgressionCounters {
  furnishActions: number;
  scienceActions: number;
  protonPops: number;
  plantsPlanted: number;
  petCareActions: number;
  petStyleActions: number;
  socialActions: number;
  neighborVisits: number;
  vehicleWaves: number;
  parkVisits: number;
  floorChanges: number;
  proofsAnchored: number;
  elixirsBrewed: number;
  starlightCrafted: number;
  goldenHarvests: number;
  petTricks: number;
  favorsFulfilled: number;
  bountiesClaimed: number;
}

/** Live world snapshot merged with cumulative counters to evaluate every quest & achievement */
export interface ProgressionLiveMetrics {
  builtRoomsCount: number;
  houseSize: number;
  houseFloors: number;
  totalStationUpgrades: number;
  builtLabWingsCount: number;
  totalHarvests: number;
  uniqueSpeciesHarvested: number;
  totalMintedLabs: number;
  expansionBandsUnlocked: number;
  bestRelationScore: number;
}

export interface ProgressionState {
  counters: ProgressionCounters;
  claimedQuestIds: string[];
  claimedAchievementIds: string[];
  xp: number;
  totalSparksClaimed: number;
}

export interface QuestStepDef {
  id: string;
  chainId: QuestChainId;
  stepNumber: 1 | 2 | 3;
  title: string;
  desc: string;
  target: number;
  rewardSparks: number;
  rewardXp: number;
  accent: string;
  actionHint: "builder" | "research" | "gardens" | "alchemy" | "pet" | "town";
  measure: (counters: ProgressionCounters, live: ProgressionLiveMetrics) => number;
}

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  rarity: AchievementRarity;
  target: number;
  rewardSparks: number;
  rewardXp: number;
  accent: string;
  measure: (
    counters: ProgressionCounters,
    live: ProgressionLiveMetrics,
    state: ProgressionState
  ) => number;
}

export interface ResearcherRankInfo {
  level: number;
  title: string;
  xp: number;
  currentFloorXp: number;
  nextRankXp: number | null;
  progressPct: number;
  unlockedTitles: string[];
}

export interface EvaluatedQuestChain {
  chainId: QuestChainId;
  chainLabel: string;
  accent: string;
  activeStep: QuestStepDef;
  completedSteps: number;
  totalSteps: number;
  progress: number;
  target: number;
  pct: number;
  readyToClaim: boolean;
  allClaimed: boolean;
}

export interface EvaluatedAchievement {
  def: AchievementDef;
  progress: number;
  target: number;
  pct: number;
  unlocked: boolean;
  claimed: boolean;
  readyToClaim: boolean;
}

export const QUEST_CHAIN_META: Record<QuestChainId, { label: string; accent: string }> = {
  architect: { label: "Architect Homebuilder", accent: "#6366f1" },
  science: { label: "Open-Science Researcher", accent: "#38bdf8" },
  botany: { label: "Botanical Gardener", accent: "#10b981" },
  alchemy: { label: "Master Alchemist", accent: "#a855f7" },
  companion: { label: "Familiar Caretaker", accent: "#f472b6" },
  town: { label: "Neighborhood Socialite", accent: "#f59e0b" }
};

export const RESEARCHER_RANKS: ReadonlyArray<{ level: number; minXp: number; title: string }> = [
  { level: 1, minXp: 0, title: "Apprentice Alchemist" },
  { level: 2, minXp: 60, title: "Lab Explorer" },
  { level: 3, minXp: 150, title: "Botanical Architect" },
  { level: 4, minXp: 280, title: "Molecular Weaver" },
  { level: 5, minXp: 450, title: "District Pioneer" },
  { level: 6, minXp: 680, title: "Conservatory Fellow" },
  { level: 7, minXp: 960, title: "Science Laureate" },
  { level: 8, minXp: 1300, title: "Alchemia Master" }
];

export const QUEST_STEPS: readonly QuestStepDef[] = [
  // Chain 1: Architect Homebuilder
  {
    id: "q-arch-1",
    chainId: "architect",
    stepNumber: 1,
    title: "First Touch of Home",
    desc: "Customize any home furnishing, floor style, or move a station inside your house.",
    target: 1,
    rewardSparks: 8,
    rewardXp: 25,
    accent: "#6366f1",
    actionHint: "builder",
    measure: (c, l) => c.furnishActions + l.builtRoomsCount
  },
  {
    id: "q-arch-2",
    chainId: "architect",
    stepNumber: 2,
    title: "Multi-Story Expansion",
    desc: "Build 2 homely rooms, expand your house size, or unlock the 3F Sky Penthouse.",
    target: 2,
    rewardSparks: 16,
    rewardXp: 45,
    accent: "#6366f1",
    actionHint: "builder",
    measure: (_, l) => l.builtRoomsCount + Math.max(0, l.houseSize - 1) + Math.max(0, l.houseFloors - 2)
  },
  {
    id: "q-arch-3",
    chainId: "architect",
    stepNumber: 3,
    title: "Grand Estate Architect",
    desc: "Reach 5 total home expansions, cozy rooms, and station upgrades combined.",
    target: 5,
    rewardSparks: 32,
    rewardXp: 85,
    accent: "#6366f1",
    actionHint: "builder",
    measure: (_, l) =>
      l.builtRoomsCount +
      Math.max(0, l.houseSize - 1) +
      Math.max(0, l.houseFloors - 2) +
      l.totalStationUpgrades
  },

  // Chain 2: Open-Science Researcher
  {
    id: "q-sci-1",
    chainId: "science",
    stepNumber: 1,
    title: "Catalytic Spark",
    desc: "Pop a floating 3D proton or wiggle/shake your live protein folding simulation.",
    target: 1,
    rewardSparks: 8,
    rewardXp: 25,
    accent: "#38bdf8",
    actionHint: "research",
    measure: (c) => c.scienceActions + c.protonPops
  },
  {
    id: "q-sci-2",
    chainId: "science",
    stepNumber: 2,
    title: "Molecular Discovery",
    desc: "Complete 5 science interactions (protein folds, proton pops, or research proofs).",
    target: 5,
    rewardSparks: 18,
    rewardXp: 50,
    accent: "#38bdf8",
    actionHint: "research",
    measure: (c) => c.scienceActions + c.protonPops + c.proofsAnchored * 2
  },
  {
    id: "q-sci-3",
    chainId: "science",
    stepNumber: 3,
    title: "Lab Wing Pioneer",
    desc: "Build 2 modular 3D lab wings or anchor a verified folding discovery proof.",
    target: 2,
    rewardSparks: 35,
    rewardXp: 90,
    accent: "#38bdf8",
    actionHint: "research",
    measure: (c, l) => l.builtLabWingsCount + c.proofsAnchored * 2
  },

  // Chain 3: Botanical Gardener
  {
    id: "q-bot-1",
    chainId: "botany",
    stepNumber: 1,
    title: "First Sprout",
    desc: "Plant a seed in your home courtyard or a Grand Botanical Park allotment bed.",
    target: 1,
    rewardSparks: 8,
    rewardXp: 25,
    accent: "#10b981",
    actionHint: "gardens",
    measure: (c, l) => c.plantsPlanted + l.totalHarvests
  },
  {
    id: "q-bot-2",
    chainId: "botany",
    stepNumber: 2,
    title: "Green Thumb Harvest",
    desc: "Harvest 3 blooming plants from your sunlit garden beds.",
    target: 3,
    rewardSparks: 18,
    rewardXp: 50,
    accent: "#10b981",
    actionHint: "gardens",
    measure: (_, l) => l.totalHarvests
  },
  {
    id: "q-bot-3",
    chainId: "botany",
    stepNumber: 3,
    title: "Master Botanist",
    desc: "Collect 4 distinct plant species in your Botanical Almanac.",
    target: 4,
    rewardSparks: 32,
    rewardXp: 85,
    accent: "#10b981",
    actionHint: "gardens",
    measure: (_, l) => l.uniqueSpeciesHarvested
  },

  // Chain 4: Master Alchemist (Botanical Brewing & Elixirs)
  {
    id: "q-alch-1",
    chainId: "alchemy",
    stepNumber: 1,
    title: "First Botanical Brew",
    desc: "Brew your first botanical tea, mining tonic, pet ambrosia, or flower bouquet.",
    target: 1,
    rewardSparks: 10,
    rewardXp: 30,
    accent: "#a855f7",
    actionHint: "alchemy",
    measure: (c) => c.elixirsBrewed
  },
  {
    id: "q-alch-2",
    chainId: "alchemy",
    stepNumber: 2,
    title: "Golden Apothecary",
    desc: "Brew 3 botanical elixirs or harvest a rare 2× Golden Bloom from your gardens.",
    target: 3,
    rewardSparks: 20,
    rewardXp: 55,
    accent: "#a855f7",
    actionHint: "alchemy",
    measure: (c) => c.elixirsBrewed + c.goldenHarvests * 3
  },
  {
    id: "q-alch-3",
    chainId: "alchemy",
    stepNumber: 3,
    title: "Philosopher's Starlight",
    desc: "Craft the legendary Philosopher's Starlight Elixir or brew 6 total botanical recipes.",
    target: 6,
    rewardSparks: 40,
    rewardXp: 100,
    accent: "#a855f7",
    actionHint: "alchemy",
    measure: (c) => c.elixirsBrewed + c.starlightCrafted * 6
  },

  // Chain 5: Familiar Caretaker
  {
    id: "q-pet-1",
    chainId: "companion",
    stepNumber: 1,
    title: "Happy Familiar",
    desc: "Pet, feed treats, or toss the glowing ball for your 3D cat or dog twice.",
    target: 2,
    rewardSparks: 8,
    rewardXp: 25,
    accent: "#f472b6",
    actionHint: "pet",
    measure: (c) => c.petCareActions
  },
  {
    id: "q-pet-2",
    chainId: "companion",
    stepNumber: 2,
    title: "Pet Boutique Debut",
    desc: "Style your companion in a new outfit, collar, hat, or wing accessory.",
    target: 1,
    rewardSparks: 15,
    rewardXp: 40,
    accent: "#f472b6",
    actionHint: "pet",
    measure: (c) => c.petStyleActions
  },
  {
    id: "q-pet-3",
    chainId: "companion",
    stepNumber: 3,
    title: "Devoted Caretaker",
    desc: "Share 8 caring moments with your lab companion.",
    target: 8,
    rewardSparks: 28,
    rewardXp: 75,
    accent: "#f472b6",
    actionHint: "pet",
    measure: (c) => c.petCareActions
  },

  // Chain 5: Neighborhood Socialite
  {
    id: "q-town-1",
    chainId: "town",
    stepNumber: 1,
    title: "Hello, Neighbor!",
    desc: "Chat with a neighbor, gift a spark, or wave at a passing EV on the boulevard twice.",
    target: 2,
    rewardSparks: 10,
    rewardXp: 30,
    accent: "#f59e0b",
    actionHint: "town",
    measure: (c) => c.socialActions + c.vehicleWaves
  },
  {
    id: "q-town-2",
    chainId: "town",
    stepNumber: 2,
    title: "Warm House Guest",
    desc: "Step inside a neighbor's 3D home or stroll over to a Town Park.",
    target: 1,
    rewardSparks: 18,
    rewardXp: 50,
    accent: "#f59e0b",
    actionHint: "town",
    measure: (c) => c.neighborVisits + c.parkVisits
  },
  {
    id: "q-town-3",
    chainId: "town",
    stepNumber: 3,
    title: "Thriving Alchemia Town",
    desc: "Grow Alchemia Town to 10+ minted labs so the Hover-Shuttle comes online!",
    target: 10,
    rewardSparks: 35,
    rewardXp: 95,
    accent: "#f59e0b",
    actionHint: "town",
    measure: (_, l) => l.totalMintedLabs
  }
];

export const ACHIEVEMENT_DEFS: readonly AchievementDef[] = [
  {
    id: "ach-stairs",
    title: "Multi-Story Explorer",
    desc: "Walk or switch between B1 Basement, 1F Atrium, and upper loft floors.",
    rarity: "Common",
    target: 1,
    rewardSparks: 10,
    rewardXp: 30,
    accent: "#38bdf8",
    measure: (c) => c.floorChanges
  },
  {
    id: "ach-protons",
    title: "Proton Pop Champion",
    desc: "Pop 5 floating glowing protons inside your 3D glass lab.",
    rarity: "Common",
    target: 5,
    rewardSparks: 12,
    rewardXp: 35,
    accent: "#8b5cf6",
    measure: (c) => c.protonPops
  },
  {
    id: "ach-traffic",
    title: "Beep Beep Boulevard",
    desc: "Wave at or honk a friendly beep at any passing electric vehicle.",
    rarity: "Common",
    target: 1,
    rewardSparks: 10,
    rewardXp: 30,
    accent: "#0ea5e9",
    measure: (c) => c.vehicleWaves
  },
  {
    id: "ach-parks",
    title: "Botanical Park Wanderer",
    desc: "Stroll over to any of the 4 landscaped City-Block Town Parks.",
    rarity: "Rare",
    target: 1,
    rewardSparks: 14,
    rewardXp: 40,
    accent: "#10b981",
    measure: (c) => c.parkVisits
  },
  {
    id: "ach-cozy",
    title: "Cozy Home Designer",
    desc: "Build 3 homely rooms (Bedroom, Kitchen, Library, Sunroom, Studio, or Music).",
    rarity: "Rare",
    target: 3,
    rewardSparks: 22,
    rewardXp: 60,
    accent: "#f472b6",
    measure: (_, l) => l.builtRoomsCount
  },
  {
    id: "ach-bloom",
    title: "Greenhouse Harvest",
    desc: "Harvest 5 blooming flowers across your courtyard & conservatory beds.",
    rarity: "Rare",
    target: 5,
    rewardSparks: 20,
    rewardXp: 55,
    accent: "#22c55e",
    measure: (_, l) => l.totalHarvests
  },
  {
    id: "ach-expansion",
    title: "Skyline Heights Pioneer",
    desc: "Expand Alchemia Town across the canal bridges onto Outer Ring Road #1 (22+ labs).",
    rarity: "Epic",
    target: 1,
    rewardSparks: 30,
    rewardXp: 85,
    accent: "#6366f1",
    measure: (_, l) => l.expansionBandsUnlocked
  },
  {
    id: "ach-bestie",
    title: "Neighborhood Lab Buddy",
    desc: "Build a Lab Buddy friendship (40+ relationship score) with any neighbor.",
    rarity: "Epic",
    target: 40,
    rewardSparks: 25,
    rewardXp: 70,
    accent: "#ec4899",
    measure: (_, l) => l.bestRelationScore
  },
  {
    id: "ach-upgrades",
    title: "Precision Lab Upgrades",
    desc: "Upgrade lab stations 3 times to unlock high-tier research & mining boosts.",
    rarity: "Epic",
    target: 3,
    rewardSparks: 30,
    rewardXp: 85,
    accent: "#f59e0b",
    measure: (_, l) => l.totalStationUpgrades
  },
  {
    id: "ach-brewer",
    title: "Master Elixir Brewer",
    desc: "Craft 3 botanical elixirs, bouquets, or treats at the Alchemy Brewing Bench.",
    rarity: "Rare",
    target: 3,
    rewardSparks: 18,
    rewardXp: 50,
    accent: "#a855f7",
    measure: (c) => c.elixirsBrewed
  },
  {
    id: "ach-golden",
    title: "Golden Bloom Alchemist",
    desc: "Harvest a rare 2× shimmering Golden Bloom from your home or park gardens.",
    rarity: "Epic",
    target: 1,
    rewardSparks: 24,
    rewardXp: 65,
    accent: "#f59e0b",
    measure: (c) => c.goldenHarvests
  },
  {
    id: "ach-tricks",
    title: "Familiar Trick Trainer",
    desc: "Perform 4 trained tricks with your 3D cat or dog companion.",
    rarity: "Rare",
    target: 4,
    rewardSparks: 16,
    rewardXp: 45,
    accent: "#f472b6",
    measure: (c) => c.petTricks
  },
  {
    id: "ach-benefactor",
    title: "Alchemia Town Benefactor",
    desc: "Fulfill 3 daily bounties or neighbor favor requests across Alchemia Town.",
    rarity: "Epic",
    target: 3,
    rewardSparks: 26,
    rewardXp: 75,
    accent: "#10b981",
    measure: (c) => c.favorsFulfilled + c.bountiesClaimed
  },
  {
    id: "ach-legend",
    title: "Alchemia Town Legend",
    desc: "Claim 10 total quests and achievement badges across your journey.",
    rarity: "Legendary",
    target: 10,
    rewardSparks: 50,
    rewardXp: 140,
    accent: "#a855f7",
    measure: (_, __, s) => s.claimedQuestIds.length + s.claimedAchievementIds.length
  }
];

const PROGRESSION_STORAGE_KEY = "alchemia.progression.v1";
let memoryProgression: ProgressionState | null = null;

export function createInitialProgressionState(): ProgressionState {
  return {
    counters: {
      furnishActions: 0,
      scienceActions: 0,
      protonPops: 0,
      plantsPlanted: 0,
      petCareActions: 0,
      petStyleActions: 0,
      socialActions: 0,
      neighborVisits: 0,
      vehicleWaves: 0,
      parkVisits: 0,
      floorChanges: 0,
      proofsAnchored: 0,
      elixirsBrewed: 0,
      starlightCrafted: 0,
      goldenHarvests: 0,
      petTricks: 0,
      favorsFulfilled: 0,
      bountiesClaimed: 0
    },
    claimedQuestIds: [],
    claimedAchievementIds: [],
    xp: 0,
    totalSparksClaimed: 0
  };
}

export function loadProgressionState(): ProgressionState {
  if (memoryProgression) return memoryProgression;
  const fallback = createInitialProgressionState();
  if (typeof window === "undefined") {
    memoryProgression = fallback;
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(PROGRESSION_STORAGE_KEY);
    if (!raw) {
      memoryProgression = fallback;
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<ProgressionState>;
    const clean: ProgressionState = {
      counters: {
        ...fallback.counters,
        ...(parsed.counters ?? {})
      },
      claimedQuestIds: Array.isArray(parsed.claimedQuestIds)
        ? parsed.claimedQuestIds.filter((x): x is string => typeof x === "string")
        : [],
      claimedAchievementIds: Array.isArray(parsed.claimedAchievementIds)
        ? parsed.claimedAchievementIds.filter((x): x is string => typeof x === "string")
        : [],
      xp: typeof parsed.xp === "number" && Number.isFinite(parsed.xp) ? Math.max(0, Math.round(parsed.xp)) : 0,
      totalSparksClaimed:
        typeof parsed.totalSparksClaimed === "number" && Number.isFinite(parsed.totalSparksClaimed)
          ? Math.max(0, Math.round(parsed.totalSparksClaimed))
          : 0
    };
    memoryProgression = clean;
    return clean;
  } catch {
    memoryProgression = fallback;
    return fallback;
  }
}

export function saveProgressionState(state: ProgressionState): ProgressionState {
  memoryProgression = state;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // safe inside sandboxed NFT iframes
    }
  }
  return state;
}

export function recordProgressionAction(
  state: ProgressionState,
  key: ProgressionCounterKey,
  delta = 1
): ProgressionState {
  const safeDelta = Math.max(1, Math.round(delta));
  return {
    ...state,
    counters: {
      ...state.counters,
      [key]: (state.counters[key] || 0) + safeDelta
    }
  };
}

export function getResearcherRank(xp: number): ResearcherRankInfo {
  const safeXp = Math.max(0, Math.round(xp));
  let current = RESEARCHER_RANKS[0];
  let next: (typeof RESEARCHER_RANKS)[number] | null = null;
  for (let i = 0; i < RESEARCHER_RANKS.length; i++) {
    if (safeXp >= RESEARCHER_RANKS[i].minXp) {
      current = RESEARCHER_RANKS[i];
      next = RESEARCHER_RANKS[i + 1] ?? null;
    }
  }
  const progressPct = next
    ? Math.min(100, Math.round(((safeXp - current.minXp) / Math.max(1, next.minXp - current.minXp)) * 100))
    : 100;
  return {
    level: current.level,
    title: current.title,
    xp: safeXp,
    currentFloorXp: current.minXp,
    nextRankXp: next ? next.minXp : null,
    progressPct,
    unlockedTitles: RESEARCHER_RANKS.filter((r) => safeXp >= r.minXp).map((r) => r.title)
  };
}

export function awardBonusProgressionXp(
  state: ProgressionState,
  xpDelta: number,
  sparksDelta = 0
): { nextState: ProgressionState; leveledUp: boolean; newRank: ResearcherRankInfo } {
  const prevRank = getResearcherRank(state.xp);
  const nextState: ProgressionState = {
    ...state,
    xp: state.xp + Math.max(0, Math.round(xpDelta)),
    totalSparksClaimed: state.totalSparksClaimed + Math.max(0, Math.round(sparksDelta))
  };
  const newRank = getResearcherRank(nextState.xp);
  return {
    nextState,
    leveledUp: newRank.level > prevRank.level,
    newRank
  };
}

export function evaluateQuestChains(
  state: ProgressionState,
  live: ProgressionLiveMetrics
): EvaluatedQuestChain[] {
  const claimedSet = new Set(state.claimedQuestIds);
  const chainOrder: QuestChainId[] = ["architect", "science", "botany", "alchemy", "companion", "town"];

  return chainOrder.map((chainId) => {
    const steps = QUEST_STEPS.filter((q) => q.chainId === chainId);
    const meta = QUEST_CHAIN_META[chainId];
    const completedSteps = steps.filter((s) => claimedSet.has(s.id)).length;
    const activeStep = steps.find((s) => !claimedSet.has(s.id)) ?? steps[steps.length - 1];
    const allClaimed = completedSteps >= steps.length;
    const rawProgress = activeStep.measure(state.counters, live);
    const progress = Math.min(activeStep.target, Math.max(0, rawProgress));
    const pct = Math.min(100, Math.round((progress / Math.max(1, activeStep.target)) * 100));
    const readyToClaim = !allClaimed && progress >= activeStep.target;

    return {
      chainId,
      chainLabel: meta.label,
      accent: meta.accent,
      activeStep,
      completedSteps,
      totalSteps: steps.length,
      progress,
      target: activeStep.target,
      pct,
      readyToClaim,
      allClaimed
    };
  });
}

export function evaluateAchievements(
  state: ProgressionState,
  live: ProgressionLiveMetrics
): EvaluatedAchievement[] {
  const claimedSet = new Set(state.claimedAchievementIds);
  return ACHIEVEMENT_DEFS.map((def) => {
    const rawProgress = def.measure(state.counters, live, state);
    const progress = Math.min(def.target, Math.max(0, rawProgress));
    const pct = Math.min(100, Math.round((progress / Math.max(1, def.target)) * 100));
    const unlocked = progress >= def.target;
    const claimed = claimedSet.has(def.id);
    return {
      def,
      progress,
      target: def.target,
      pct,
      unlocked,
      claimed,
      readyToClaim: unlocked && !claimed
    };
  });
}

export function claimQuestReward(
  state: ProgressionState,
  live: ProgressionLiveMetrics,
  questId: string
): {
  nextState: ProgressionState;
  claimed: boolean;
  sparksAwarded: number;
  xpAwarded: number;
  leveledUp: boolean;
  newRank: ResearcherRankInfo;
} {
  const prevRank = getResearcherRank(state.xp);
  if (state.claimedQuestIds.includes(questId)) {
    return {
      nextState: state,
      claimed: false,
      sparksAwarded: 0,
      xpAwarded: 0,
      leveledUp: false,
      newRank: prevRank
    };
  }
  const chain = evaluateQuestChains(state, live).find((c) => c.activeStep.id === questId);
  if (!chain || !chain.readyToClaim) {
    return {
      nextState: state,
      claimed: false,
      sparksAwarded: 0,
      xpAwarded: 0,
      leveledUp: false,
      newRank: prevRank
    };
  }

  const nextState: ProgressionState = {
    ...state,
    claimedQuestIds: [...state.claimedQuestIds, questId],
    xp: state.xp + chain.activeStep.rewardXp,
    totalSparksClaimed: state.totalSparksClaimed + chain.activeStep.rewardSparks
  };
  const newRank = getResearcherRank(nextState.xp);
  return {
    nextState,
    claimed: true,
    sparksAwarded: chain.activeStep.rewardSparks,
    xpAwarded: chain.activeStep.rewardXp,
    leveledUp: newRank.level > prevRank.level,
    newRank
  };
}

export function claimAchievementReward(
  state: ProgressionState,
  live: ProgressionLiveMetrics,
  achievementId: string
): {
  nextState: ProgressionState;
  claimed: boolean;
  sparksAwarded: number;
  xpAwarded: number;
  leveledUp: boolean;
  newRank: ResearcherRankInfo;
} {
  const prevRank = getResearcherRank(state.xp);
  if (state.claimedAchievementIds.includes(achievementId)) {
    return {
      nextState: state,
      claimed: false,
      sparksAwarded: 0,
      xpAwarded: 0,
      leveledUp: false,
      newRank: prevRank
    };
  }
  const ach = evaluateAchievements(state, live).find((a) => a.def.id === achievementId);
  if (!ach || !ach.readyToClaim) {
    return {
      nextState: state,
      claimed: false,
      sparksAwarded: 0,
      xpAwarded: 0,
      leveledUp: false,
      newRank: prevRank
    };
  }

  const nextState: ProgressionState = {
    ...state,
    claimedAchievementIds: [...state.claimedAchievementIds, achievementId],
    xp: state.xp + ach.def.rewardXp,
    totalSparksClaimed: state.totalSparksClaimed + ach.def.rewardSparks
  };
  const newRank = getResearcherRank(nextState.xp);
  return {
    nextState,
    claimed: true,
    sparksAwarded: ach.def.rewardSparks,
    xpAwarded: ach.def.rewardXp,
    leveledUp: newRank.level > prevRank.level,
    newRank
  };
}

export function claimAllReadyRewards(
  state: ProgressionState,
  live: ProgressionLiveMetrics
): {
  nextState: ProgressionState;
  claimedCount: number;
  sparksAwarded: number;
  xpAwarded: number;
  leveledUp: boolean;
  newRank: ResearcherRankInfo;
} {
  const prevRank = getResearcherRank(state.xp);
  let cur = state;
  let claimedCount = 0;
  let sparksAwarded = 0;
  let xpAwarded = 0;

  // Loop up to 3 passes so cascading quests or "Alchemia Town Legend" unlock cleanly too
  for (let pass = 0; pass < 3; pass++) {
    let progressed = false;
    for (const chain of evaluateQuestChains(cur, live)) {
      if (chain.readyToClaim) {
        const r = claimQuestReward(cur, live, chain.activeStep.id);
        if (r.claimed) {
          cur = r.nextState;
          claimedCount++;
          sparksAwarded += r.sparksAwarded;
          xpAwarded += r.xpAwarded;
          progressed = true;
        }
      }
    }
    for (const ach of evaluateAchievements(cur, live)) {
      if (ach.readyToClaim) {
        const r = claimAchievementReward(cur, live, ach.def.id);
        if (r.claimed) {
          cur = r.nextState;
          claimedCount++;
          sparksAwarded += r.sparksAwarded;
          xpAwarded += r.xpAwarded;
          progressed = true;
        }
      }
    }
    if (!progressed) break;
  }

  const newRank = getResearcherRank(cur.xp);
  return {
    nextState: cur,
    claimedCount,
    sparksAwarded,
    xpAwarded,
    leveledUp: newRank.level > prevRank.level,
    newRank
  };
}
