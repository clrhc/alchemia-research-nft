/**
 * Botanical Alchemy & Elixir Brewing Engine.
 *
 * Interconnects Alchemia Town's 8 growable garden flower species with every
 * major system in the world: Protein Folding Focus buffs, ALCH Mining Tonics,
 * Neighbor Friendship Bouquets, Gourmet Pet Ambrosia, Instant Crystal Garden
 * Bloom Fertilizer, and the legendary Philosopher's Starlight Elixir!
 *
 * Sandbox-safe persistence (localStorage wrapped in try/catch with in-memory fallback).
 */

import { PLANT_SPECIES, type PlantSpeciesId } from "./gardenState";

export type ElixirId =
  | "mint-focus-tea"
  | "sunbeam-mining-tonic"
  | "blossom-bouquet"
  | "pet-ambrosia"
  | "crystal-fertilizer"
  | "starlight-elixir";

export type ElixirBuffKind = "focus" | "mining" | "starlight";

export interface AlchemyRecipeDef {
  id: ElixirId;
  name: string;
  tagline: string;
  effectLabel: string;
  category: "buff" | "gift" | "pet" | "garden" | "legendary";
  accent: string;
  ingredients: Partial<Record<PlantSpeciesId, number>>;
  /** Optional timed buff duration in minutes when consumed */
  buffDurationMin?: number;
  buffKind?: ElixirBuffKind;
  /** Instant sparks granted on craft/use if applicable */
  bonusSparks?: number;
  bonusXp?: number;
}

export const ALCHEMY_RECIPES: readonly AlchemyRecipeDef[] = [
  {
    id: "mint-focus-tea",
    name: "Mint Focus Tea",
    tagline: "Crisp frostleaf & violet infusion for molecular clarity",
    effectLabel: "+40% Focus gain for 10m · Focused mood",
    category: "buff",
    accent: "#38bdf8",
    ingredients: { mint: 1, lavender: 1 },
    buffDurationMin: 10,
    buffKind: "focus"
  },
  {
    id: "sunbeam-mining-tonic",
    name: "Sunbeam Mining Tonic",
    tagline: "Golden solar distillate that overclocks the ALCH crystal",
    effectLabel: "+25% ALCH Mining Rate for 10m · Energized",
    category: "buff",
    accent: "#f59e0b",
    ingredients: { sunflower: 1, fern: 1 },
    buffDurationMin: 10,
    buffKind: "mining"
  },
  {
    id: "blossom-bouquet",
    name: "Blossom Friendship Bouquet",
    tagline: "Hand-tied glass roses & cherry blossoms for neighbors",
    effectLabel: "Gift to any Neighbor: +25 Friend & +8 Sparks",
    category: "gift",
    accent: "#f472b6",
    ingredients: { rose: 1, sakura: 1 }
  },
  {
    id: "pet-ambrosia",
    name: "Gourmet Pet Ambrosia",
    tagline: "Wholesome sunbeam & mint artisan treat for your familiar",
    effectLabel: "100% Pet Food/Happy/Play + 2 Care XP (Free!)",
    category: "pet",
    accent: "#10b981",
    ingredients: { sunflower: 1, mint: 1 }
  },
  {
    id: "crystal-fertilizer",
    name: "Crystal Bloom Elixir",
    tagline: "Concentrated orchid-dew mist for instant full blooms",
    effectLabel: "Instantly blooms ALL planted garden beds",
    category: "garden",
    accent: "#a855f7",
    ingredients: { orchid: 1, fern: 1 }
  },
  {
    id: "starlight-elixir",
    name: "Philosopher's Starlight",
    tagline: "Masterwork resonance brewed from rare moonlight petals",
    effectLabel: "+25 Sparks, +40 XP & +35% All-Synergy (15m)",
    category: "legendary",
    accent: "#6366f1",
    ingredients: { lotus: 1, orchid: 1, sakura: 1 },
    buffDurationMin: 15,
    buffKind: "starlight",
    bonusSparks: 25,
    bonusXp: 40
  }
];

export const ALCHEMY_RECIPE_BY_ID: Record<ElixirId, AlchemyRecipeDef> = Object.fromEntries(
  ALCHEMY_RECIPES.map((r) => [r.id, r])
) as Record<ElixirId, AlchemyRecipeDef>;

export interface ActiveElixirBuff {
  id: ElixirBuffKind;
  label: string;
  accent: string;
  expiresAtMs: number;
  miningBonus: number; // e.g., 0.25 for +25%
  focusBonus: number; // e.g., 0.4 for +40%
}

export interface AlchemyPouchState {
  flowers: Partial<Record<PlantSpeciesId, number>>;
  crafted: Partial<Record<ElixirId, number>>;
  activeBuffs: ActiveElixirBuff[];
  totalBrewed: number;
  goldenBloomsCollected: number;
  starlightCrafted: number;
}

const ALCHEMY_STORAGE_PREFIX = "alchemia_alchemy_pouch_v1_";
const memoryAlchemyMap = new Map<number, AlchemyPouchState>();

export function createInitialAlchemyState(): AlchemyPouchState {
  return {
    // Cozy starter herb pouch so players can immediately try brewing alongside harvesting!
    flowers: {
      lavender: 2,
      mint: 2,
      fern: 1,
      sunflower: 1,
      rose: 1
    },
    crafted: {},
    activeBuffs: [],
    totalBrewed: 0,
    goldenBloomsCollected: 0,
    starlightCrafted: 0
  };
}

export function sanitizeAlchemyState(
  raw: Partial<AlchemyPouchState> | null | undefined
): AlchemyPouchState {
  const base = createInitialAlchemyState();
  if (!raw || typeof raw !== "object") return base;

  const flowers: Partial<Record<PlantSpeciesId, number>> = {};
  if (raw.flowers && typeof raw.flowers === "object") {
    for (const sp of PLANT_SPECIES) {
      const cnt = raw.flowers[sp.id];
      if (typeof cnt === "number" && Number.isFinite(cnt) && cnt > 0) {
        flowers[sp.id] = Math.floor(cnt);
      }
    }
  } else {
    Object.assign(flowers, base.flowers);
  }

  const crafted: Partial<Record<ElixirId, number>> = {};
  if (raw.crafted && typeof raw.crafted === "object") {
    for (const r of ALCHEMY_RECIPES) {
      const cnt = raw.crafted[r.id];
      if (typeof cnt === "number" && Number.isFinite(cnt) && cnt > 0) {
        crafted[r.id] = Math.floor(cnt);
      }
    }
  }

  const validKinds = new Set<ElixirBuffKind>(["focus", "mining", "starlight"]);
  const activeBuffs: ActiveElixirBuff[] = Array.isArray(raw.activeBuffs)
    ? raw.activeBuffs.filter(
        (b): b is ActiveElixirBuff =>
          Boolean(b) &&
          validKinds.has(b.id) &&
          typeof b.expiresAtMs === "number" &&
          Number.isFinite(b.expiresAtMs)
      )
    : [];

  return {
    flowers,
    crafted,
    activeBuffs,
    totalBrewed:
      typeof raw.totalBrewed === "number" && Number.isFinite(raw.totalBrewed)
        ? Math.max(0, Math.floor(raw.totalBrewed))
        : 0,
    goldenBloomsCollected:
      typeof raw.goldenBloomsCollected === "number" && Number.isFinite(raw.goldenBloomsCollected)
        ? Math.max(0, Math.floor(raw.goldenBloomsCollected))
        : 0,
    starlightCrafted:
      typeof raw.starlightCrafted === "number" && Number.isFinite(raw.starlightCrafted)
        ? Math.max(0, Math.floor(raw.starlightCrafted))
        : 0
  };
}

export function loadAlchemyState(tokenId: number): AlchemyPouchState {
  const cached = memoryAlchemyMap.get(tokenId);
  if (cached) return cached;
  const fresh = createInitialAlchemyState();
  if (typeof window === "undefined") {
    memoryAlchemyMap.set(tokenId, fresh);
    return fresh;
  }
  try {
    const raw = window.localStorage.getItem(`${ALCHEMY_STORAGE_PREFIX}${tokenId}`);
    if (!raw) {
      memoryAlchemyMap.set(tokenId, fresh);
      return fresh;
    }
    const clean = sanitizeAlchemyState(JSON.parse(raw) as Partial<AlchemyPouchState>);
    memoryAlchemyMap.set(tokenId, clean);
    return clean;
  } catch {
    memoryAlchemyMap.set(tokenId, fresh);
    return fresh;
  }
}

export function saveAlchemyState(tokenId: number, state: AlchemyPouchState): AlchemyPouchState {
  const clean = sanitizeAlchemyState(state);
  memoryAlchemyMap.set(tokenId, clean);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(`${ALCHEMY_STORAGE_PREFIX}${tokenId}`, JSON.stringify(clean));
    } catch {
      // safe inside sandboxed NFT iframes
    }
  }
  return clean;
}

export function addHarvestedBotanicals(
  state: AlchemyPouchState,
  speciesId: PlantSpeciesId,
  quantity = 1,
  isGolden = false
): AlchemyPouchState {
  const add = Math.max(1, Math.floor(quantity));
  return {
    ...state,
    flowers: {
      ...state.flowers,
      [speciesId]: (state.flowers[speciesId] ?? 0) + add
    },
    goldenBloomsCollected: state.goldenBloomsCollected + (isGolden ? 1 : 0)
  };
}

export function canCraftRecipe(state: AlchemyPouchState, recipeId: ElixirId): boolean {
  const recipe = ALCHEMY_RECIPE_BY_ID[recipeId];
  if (!recipe) return false;
  for (const [speciesId, need] of Object.entries(recipe.ingredients)) {
    const have = state.flowers[speciesId as PlantSpeciesId] ?? 0;
    if (have < (need ?? 0)) return false;
  }
  return true;
}

export interface CraftRecipeResult {
  nextState: AlchemyPouchState;
  crafted: boolean;
  yieldCount: number;
  kitchenBonusTriggered: boolean;
  kitchenBonusSparks: number;
  recipe: AlchemyRecipeDef;
}

export function craftAlchemyRecipe(
  state: AlchemyPouchState,
  recipeId: ElixirId,
  options?: { hasKitchen?: boolean; forceKitchenDouble?: boolean }
): CraftRecipeResult {
  const recipe = ALCHEMY_RECIPE_BY_ID[recipeId];
  if (!recipe || !canCraftRecipe(state, recipeId)) {
    return {
      nextState: state,
      crafted: false,
      yieldCount: 0,
      kitchenBonusTriggered: false,
      kitchenBonusSparks: 0,
      recipe
    };
  }

  const nextFlowers: Partial<Record<PlantSpeciesId, number>> = { ...state.flowers };
  for (const [speciesId, need] of Object.entries(recipe.ingredients)) {
    const key = speciesId as PlantSpeciesId;
    const rem = (nextFlowers[key] ?? 0) - (need ?? 0);
    if (rem > 0) nextFlowers[key] = rem;
    else delete nextFlowers[key];
  }

  // Warm Kitchenette synergy: +1 bonus spark on every brew & 35% chance for a 2x batch!
  const kitchenBonusTriggered = Boolean(
    options?.hasKitchen && (options.forceKitchenDouble || Math.random() < 0.35)
  );
  const yieldCount = kitchenBonusTriggered ? 2 : 1;
  const kitchenBonusSparks = options?.hasKitchen ? 1 : 0;

  const nextState: AlchemyPouchState = {
    ...state,
    flowers: nextFlowers,
    crafted: {
      ...state.crafted,
      [recipeId]: (state.crafted[recipeId] ?? 0) + yieldCount
    },
    totalBrewed: state.totalBrewed + 1,
    starlightCrafted: state.starlightCrafted + (recipeId === "starlight-elixir" ? 1 : 0)
  };

  return {
    nextState,
    crafted: true,
    yieldCount,
    kitchenBonusTriggered,
    kitchenBonusSparks,
    recipe
  };
}

export function getActiveElixirBuffs(
  state: AlchemyPouchState,
  nowMs = Date.now()
): ActiveElixirBuff[] {
  return state.activeBuffs.filter((b) => b.expiresAtMs > nowMs);
}

export function computeElixirMiningMultiplier(
  state: AlchemyPouchState,
  nowMs = Date.now()
): number {
  const active = getActiveElixirBuffs(state, nowMs);
  const totalBonus = active.reduce((sum, b) => sum + b.miningBonus, 0);
  return Number((1 + totalBonus).toFixed(2));
}

export function computeElixirFocusMultiplier(
  state: AlchemyPouchState,
  nowMs = Date.now()
): number {
  const active = getActiveElixirBuffs(state, nowMs);
  const totalBonus = active.reduce((sum, b) => sum + b.focusBonus, 0);
  return Number((1 + totalBonus).toFixed(2));
}

export function consumeCraftedItem(
  state: AlchemyPouchState,
  recipeId: ElixirId,
  nowMs = Date.now()
): {
  nextState: AlchemyPouchState;
  consumed: boolean;
  buffActivated: ActiveElixirBuff | null;
  recipe: AlchemyRecipeDef;
} {
  const recipe = ALCHEMY_RECIPE_BY_ID[recipeId];
  const count = state.crafted[recipeId] ?? 0;
  if (!recipe || count <= 0) {
    return { nextState: state, consumed: false, buffActivated: null, recipe };
  }

  const nextCrafted: Partial<Record<ElixirId, number>> = { ...state.crafted };
  if (count > 1) nextCrafted[recipeId] = count - 1;
  else delete nextCrafted[recipeId];

  let buffActivated: ActiveElixirBuff | null = null;
  let nextBuffs = getActiveElixirBuffs(state, nowMs);

  if (recipe.buffKind && recipe.buffDurationMin) {
    const durationMs = recipe.buffDurationMin * 60_000;
    buffActivated = {
      id: recipe.buffKind,
      label:
        recipe.buffKind === "focus"
          ? "Mint Focus (+40%)"
          : recipe.buffKind === "mining"
            ? "Sunbeam Mining (+25%)"
            : "Starlight Synergy (+35%)",
      accent: recipe.accent,
      expiresAtMs: nowMs + durationMs,
      miningBonus:
        recipe.buffKind === "mining" ? 0.25 : recipe.buffKind === "starlight" ? 0.35 : 0,
      focusBonus:
        recipe.buffKind === "focus" ? 0.4 : recipe.buffKind === "starlight" ? 0.35 : 0
    };
    nextBuffs = [...nextBuffs.filter((b) => b.id !== recipe.buffKind), buffActivated];
  }

  return {
    nextState: {
      ...state,
      crafted: nextCrafted,
      activeBuffs: nextBuffs
    },
    consumed: true,
    buffActivated,
    recipe
  };
}

export function countTotalBotanicals(state: AlchemyPouchState): number {
  return Object.values(state.flowers).reduce((s, n) => s + (n ?? 0), 0);
}
