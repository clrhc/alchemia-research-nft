/**
 * Interactive Botanical Gardening, Community Allotments & Plant Almanac Engine!
 *
 * Powers real-time growing 3D plants both at the player's own home courtyard (4 beds)
 * and inside Alchemia Town's Grand Botanical Park & Conservatory (6 beds).
 *
 * Sandbox-safe persistence (localStorage wrapped in try/catch with in-memory fallback).
 */

export type PlantSpeciesId =
  | "lavender"
  | "sunflower"
  | "sakura"
  | "orchid"
  | "rose"
  | "mint"
  | "fern"
  | "lotus";

export interface PlantSpeciesDef {
  id: PlantSpeciesId;
  name: string;
  desc: string;
  growSeconds: number;
  harvestSparks: number;
  petalHex: string;
  accentHex: string;
  leafHex: string;
  moodPerk: string;
  vibeDelta: { energy?: number; focus?: number; social?: number; fun?: number };
}

export const PLANT_SPECIES: readonly PlantSpeciesDef[] = [
  {
    id: "lavender",
    name: "Silver Lavender",
    desc: "Fragrant violet spikes calming the courtyard breeze",
    growSeconds: 35,
    harvestSparks: 4,
    petalHex: "#a78bfa",
    accentHex: "#ddd6fe",
    leafHex: "#6ee7b7",
    moodPerk: "+14 Energy",
    vibeDelta: { energy: 14, focus: 6 }
  },
  {
    id: "mint",
    name: "Frostleaf Mint",
    desc: "Crisp silver-veined culinary & tea herbs",
    growSeconds: 30,
    harvestSparks: 4,
    petalHex: "#34d399",
    accentHex: "#a7f3d0",
    leafHex: "#10b981",
    moodPerk: "+14 Focus",
    vibeDelta: { focus: 14, energy: 6 }
  },
  {
    id: "fern",
    name: "Starlight Fern",
    desc: "Feathery botanical fronds glistening with dew",
    growSeconds: 40,
    harvestSparks: 5,
    petalHex: "#2dd4bf",
    accentHex: "#99f6e4",
    leafHex: "#14b8a6",
    moodPerk: "+15 Energy",
    vibeDelta: { energy: 15, fun: 8 }
  },
  {
    id: "sunflower",
    name: "Sunbeam Sunflower",
    desc: "Radiant golden blooms turning toward the atrium light",
    growSeconds: 45,
    harvestSparks: 5,
    petalHex: "#fbbf24",
    accentHex: "#fde68a",
    leafHex: "#4ade80",
    moodPerk: "+16 Fun",
    vibeDelta: { fun: 16, energy: 8 }
  },
  {
    id: "rose",
    name: "Velvet Glass Rose",
    desc: "Clustered blush-crimson garden roses for neighbors",
    growSeconds: 50,
    harvestSparks: 6,
    petalHex: "#fb7185",
    accentHex: "#fecdd3",
    leafHex: "#34d399",
    moodPerk: "+16 Social",
    vibeDelta: { social: 16, fun: 10 }
  },
  {
    id: "sakura",
    name: "Mini Sakura Bonsai",
    desc: "Dwarf cherry blossom sapling showering soft pink petals",
    growSeconds: 55,
    harvestSparks: 6,
    petalHex: "#f472b6",
    accentHex: "#fbcfe8",
    leafHex: "#6ee7b7",
    moodPerk: "+18 Social",
    vibeDelta: { social: 18, energy: 10 }
  },
  {
    id: "orchid",
    name: "Crystal Lab Orchid",
    desc: "Rare translucent cyan petals thriving in glasshouses",
    growSeconds: 60,
    harvestSparks: 7,
    petalHex: "#38bdf8",
    accentHex: "#bae6fd",
    leafHex: "#2dd4bf",
    moodPerk: "+20 Focus",
    vibeDelta: { focus: 20, fun: 8 }
  },
  {
    id: "lotus",
    name: "Moonlight Lotus",
    desc: "Luminous pearl-indigo bloom prized by town botanists",
    growSeconds: 75,
    harvestSparks: 9,
    petalHex: "#818cf8",
    accentHex: "#e0e7ff",
    leafHex: "#34d399",
    moodPerk: "+20 Energy & Focus",
    vibeDelta: { energy: 20, focus: 20 }
  }
];

export const PLANT_SPECIES_BY_ID: Record<PlantSpeciesId, PlantSpeciesDef> = Object.fromEntries(
  PLANT_SPECIES.map((s) => [s.id, s])
) as Record<PlantSpeciesId, PlantSpeciesDef>;

export interface GardenPlotDef {
  id: string;
  label: string;
  zone: "home" | "park";
  x: number;
  z: number;
  standX: number;
  standZ: number;
  yaw: number;
}

/**
 * 10 Live Walkable 3D Garden Planter Beds:
 *  - 4 sunny Home Courtyard Beds flanking your front garden lawn
 *  - 6 Community Allotment Beds inside the Grand Botanical Park (SE Quadrant, (15.2, 15.2))
 */
export const GARDEN_PLOT_DEFS: readonly GardenPlotDef[] = [
  // Home Courtyard Front Garden Beds (flanking front porch steps, clear of Lv.1-3 doors & Inner Ring Road)
  { id: "home-1", label: "Front Garden West", zone: "home", x: -2.18, z: 3.92, standX: -2.18, standZ: 3.25, yaw: 0 },
  { id: "home-2", label: "Front Garden Porch W", zone: "home", x: -1.28, z: 3.98, standX: -1.28, standZ: 3.3, yaw: 0 },
  { id: "home-3", label: "Front Garden Porch E", zone: "home", x: 1.28, z: 3.98, standX: 1.28, standZ: 3.3, yaw: 0 },
  { id: "home-4", label: "Front Garden East", zone: "home", x: 2.18, z: 3.92, standX: 2.18, standZ: 3.25, yaw: 0 },

  // Grand Botanical Park Community Allotment Beds (beside the Glass Conservatory at (15.2, 15.2))
  { id: "park-1", label: "Park Bed #1", zone: "park", x: 12.6, z: 13.6, standX: 12.6, standZ: 12.85, yaw: 0 },
  { id: "park-2", label: "Park Bed #2", zone: "park", x: 13.8, z: 13.0, standX: 13.8, standZ: 12.25, yaw: 0 },
  { id: "park-3", label: "Park Bed #3", zone: "park", x: 12.4, z: 15.0, standX: 11.75, standZ: 15.0, yaw: Math.PI / 2 },
  { id: "park-4", label: "Park Bed #4", zone: "park", x: 17.6, z: 13.4, standX: 17.6, standZ: 12.65, yaw: 0 },
  { id: "park-5", label: "Park Bed #5", zone: "park", x: 18.0, z: 15.0, standX: 18.65, standZ: 15.0, yaw: -Math.PI / 2 },
  { id: "park-6", label: "Park Bed #6", zone: "park", x: 17.4, z: 16.6, standX: 17.4, standZ: 17.35, yaw: Math.PI }
];

export interface GardenPlotState {
  speciesId: PlantSpeciesId | null;
  plantedAtMs: number;
  lastWateredAtMs: number;
  /** Extra growth boost seconds accumulated from watering or crystal mist */
  boostSeconds: number;
  waterCount: number;
}

export interface GardenWorldState {
  plots: Record<string, GardenPlotState>;
  harvestedCounts: Partial<Record<PlantSpeciesId, number>>;
  goldenSpecies?: Partial<Record<PlantSpeciesId, number>>;
  goldenHarvests?: number;
  totalHarvests: number;
  selectedSeed: PlantSpeciesId;
}

export interface PlotGrowthSnapshot {
  species: PlantSpeciesDef | null;
  progress: number; // 0..1
  stage: 0 | 1 | 2 | 3; // 0 empty, 1 sprout, 2 budding, 3 full bloom
  readyToHarvest: boolean;
  needsWater: boolean;
  secondsLeft: number;
}

const GARDEN_STORAGE_PREFIX = "alchemia_garden_v1_";
const memoryGardenMap = new Map<number, GardenWorldState>();

export function createInitialGardenState(nowMs = Date.now()): GardenWorldState {
  const plots: Record<string, GardenPlotState> = {};
  for (const def of GARDEN_PLOT_DEFS) {
    plots[def.id] = {
      speciesId: null,
      plantedAtMs: 0,
      lastWateredAtMs: 0,
      boostSeconds: 0,
      waterCount: 0
    };
  }
  // Pre-seed a welcoming starter courtyard + vibrant Botanical Park beds so the town blooms right away!
  plots["home-1"] = {
    speciesId: "lavender",
    plantedAtMs: nowMs - 40_000,
    lastWateredAtMs: nowMs - 10_000,
    boostSeconds: 10,
    waterCount: 1
  };
  plots["home-4"] = {
    speciesId: "sunflower",
    plantedAtMs: nowMs - 24_000,
    lastWateredAtMs: nowMs - 24_000,
    boostSeconds: 0,
    waterCount: 0
  };
  plots["park-1"] = {
    speciesId: "sakura",
    plantedAtMs: nowMs - 65_000,
    lastWateredAtMs: nowMs - 5_000,
    boostSeconds: 10,
    waterCount: 1
  };
  plots["park-2"] = {
    speciesId: "orchid",
    plantedAtMs: nowMs - 70_000,
    lastWateredAtMs: nowMs - 5_000,
    boostSeconds: 10,
    waterCount: 1
  };
  plots["park-4"] = {
    speciesId: "rose",
    plantedAtMs: nowMs - 55_000,
    lastWateredAtMs: nowMs - 5_000,
    boostSeconds: 10,
    waterCount: 1
  };
  plots["park-6"] = {
    speciesId: "lotus",
    plantedAtMs: nowMs - 40_000,
    lastWateredAtMs: nowMs - 25_000,
    boostSeconds: 0,
    waterCount: 0
  };

  return {
    plots,
    harvestedCounts: {},
    goldenSpecies: {},
    goldenHarvests: 0,
    totalHarvests: 0,
    selectedSeed: "lavender"
  };
}

export function sanitizeGardenState(raw: Partial<GardenWorldState> | null | undefined): GardenWorldState {
  const base = createInitialGardenState();
  if (!raw || typeof raw !== "object") return base;

  const validSpecies = new Set(PLANT_SPECIES.map((s) => s.id));
  const plots: Record<string, GardenPlotState> = {};
  for (const def of GARDEN_PLOT_DEFS) {
    const p = raw.plots?.[def.id];
    if (p && (p.speciesId === null || validSpecies.has(p.speciesId))) {
      plots[def.id] = {
        speciesId: p.speciesId,
        plantedAtMs: Number.isFinite(p.plantedAtMs) ? p.plantedAtMs : 0,
        lastWateredAtMs: Number.isFinite(p.lastWateredAtMs) ? p.lastWateredAtMs : 0,
        boostSeconds: Number.isFinite(p.boostSeconds) ? Math.max(0, p.boostSeconds) : 0,
        waterCount: Number.isFinite(p.waterCount) ? Math.max(0, p.waterCount) : 0
      };
    } else {
      plots[def.id] = base.plots[def.id];
    }
  }

  const harvestedCounts: Partial<Record<PlantSpeciesId, number>> = {};
  if (raw.harvestedCounts && typeof raw.harvestedCounts === "object") {
    for (const sp of PLANT_SPECIES) {
      const cnt = raw.harvestedCounts[sp.id];
      if (typeof cnt === "number" && Number.isFinite(cnt) && cnt > 0) {
        harvestedCounts[sp.id] = Math.floor(cnt);
      }
    }
  }

  const goldenSpecies: Partial<Record<PlantSpeciesId, number>> = {};
  if (raw.goldenSpecies && typeof raw.goldenSpecies === "object") {
    for (const sp of PLANT_SPECIES) {
      const cnt = raw.goldenSpecies[sp.id];
      if (typeof cnt === "number" && Number.isFinite(cnt) && cnt > 0) {
        goldenSpecies[sp.id] = Math.floor(cnt);
      }
    }
  }

  return {
    plots,
    harvestedCounts,
    goldenSpecies,
    goldenHarvests:
      typeof raw.goldenHarvests === "number" && Number.isFinite(raw.goldenHarvests)
        ? Math.max(0, Math.floor(raw.goldenHarvests))
        : 0,
    totalHarvests:
      typeof raw.totalHarvests === "number" && Number.isFinite(raw.totalHarvests)
        ? Math.max(0, Math.floor(raw.totalHarvests))
        : 0,
    selectedSeed:
      raw.selectedSeed && validSpecies.has(raw.selectedSeed) ? raw.selectedSeed : "lavender"
  };
}

export function loadGardenState(tokenId: number): GardenWorldState {
  const cached = memoryGardenMap.get(tokenId);
  if (cached) return cached;
  if (typeof window === "undefined") {
    const fresh = createInitialGardenState();
    memoryGardenMap.set(tokenId, fresh);
    return fresh;
  }
  try {
    const raw = window.localStorage.getItem(`${GARDEN_STORAGE_PREFIX}${tokenId}`);
    if (!raw) {
      const fresh = createInitialGardenState();
      memoryGardenMap.set(tokenId, fresh);
      return fresh;
    }
    const clean = sanitizeGardenState(JSON.parse(raw) as Partial<GardenWorldState>);
    memoryGardenMap.set(tokenId, clean);
    return clean;
  } catch {
    const fresh = createInitialGardenState();
    memoryGardenMap.set(tokenId, fresh);
    return fresh;
  }
}

export function saveGardenState(tokenId: number, state: GardenWorldState): GardenWorldState {
  const clean = sanitizeGardenState(state);
  memoryGardenMap.set(tokenId, clean);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(`${GARDEN_STORAGE_PREFIX}${tokenId}`, JSON.stringify(clean));
    } catch {
      // safe in sandboxed NFT iframes
    }
  }
  return clean;
}

export function computePlotGrowth(
  plot: GardenPlotState | undefined,
  nowMs = Date.now(),
  growthMultiplier = 1
): PlotGrowthSnapshot {
  if (!plot || !plot.speciesId) {
    return {
      species: null,
      progress: 0,
      stage: 0,
      readyToHarvest: false,
      needsWater: false,
      secondsLeft: 0
    };
  }
  const safeMult = Math.max(0.5, Number.isFinite(growthMultiplier) ? growthMultiplier : 1);
  const species = PLANT_SPECIES_BY_ID[plot.speciesId];
  const elapsedSec = Math.max(0, (nowMs - plot.plantedAtMs) / 1000) * safeMult + plot.boostSeconds;
  const progress = Math.max(0, Math.min(1, elapsedSec / species.growSeconds));
  const stage: 1 | 2 | 3 = progress >= 1 ? 3 : progress >= 0.42 ? 2 : 1;
  const readyToHarvest = progress >= 1;
  const needsWater = !readyToHarvest && nowMs - plot.lastWateredAtMs > 12_000;
  const secondsLeft = Math.max(0, Math.ceil((species.growSeconds - elapsedSec) / safeMult));
  return { species, progress, stage, readyToHarvest, needsWater, secondsLeft };
}

export function plantSeedInPlot(
  state: GardenWorldState,
  plotId: string,
  speciesId: PlantSpeciesId,
  nowMs = Date.now()
): GardenWorldState {
  if (!state.plots[plotId]) return state;
  return {
    ...state,
    selectedSeed: speciesId,
    plots: {
      ...state.plots,
      [plotId]: {
        speciesId,
        plantedAtMs: nowMs,
        lastWateredAtMs: nowMs,
        boostSeconds: 0,
        waterCount: 0
      }
    }
  };
}

export function waterGardenPlot(
  state: GardenWorldState,
  plotId: string,
  nowMs = Date.now()
): { nextState: GardenWorldState; boosted: boolean } {
  const cur = state.plots[plotId];
  if (!cur || !cur.speciesId) return { nextState: state, boosted: false };
  const sp = PLANT_SPECIES_BY_ID[cur.speciesId];
  const snap = computePlotGrowth(cur, nowMs);
  if (snap.readyToHarvest) return { nextState: state, boosted: false };

  const addSec = Math.round(sp.growSeconds * 0.36);
  return {
    boosted: true,
    nextState: {
      ...state,
      plots: {
        ...state.plots,
        [plotId]: {
          ...cur,
          lastWateredAtMs: nowMs,
          boostSeconds: cur.boostSeconds + addSec,
          waterCount: cur.waterCount + 1
        }
      }
    }
  };
}

export function fertilizeGardenPlot(
  state: GardenWorldState,
  plotId: string,
  nowMs = Date.now()
): GardenWorldState {
  const cur = state.plots[plotId];
  if (!cur || !cur.speciesId) return state;
  const sp = PLANT_SPECIES_BY_ID[cur.speciesId];
  return {
    ...state,
    plots: {
      ...state.plots,
      [plotId]: {
        ...cur,
        lastWateredAtMs: nowMs,
        boostSeconds: sp.growSeconds + 5,
        waterCount: cur.waterCount + 1
      }
    }
  };
}

export interface HarvestOptions {
  hasPergola?: boolean;
  weatherGoldenBonus?: number;
  growthMultiplier?: number;
  forceGolden?: boolean;
}

export function harvestGardenPlot(
  state: GardenWorldState,
  plotId: string,
  nowMs = Date.now(),
  options?: HarvestOptions
): {
  nextState: GardenWorldState;
  harvested: PlantSpeciesDef | null;
  sparksEarned: number;
  isGolden: boolean;
  yieldCount: number;
} {
  const cur = state.plots[plotId];
  const snap = computePlotGrowth(cur, nowMs, options?.growthMultiplier ?? 1);
  if (!cur || !cur.speciesId || !snap.readyToHarvest || !snap.species) {
    return { nextState: state, harvested: null, sparksEarned: 0, isGolden: false, yieldCount: 0 };
  }
  const sp = snap.species;
  const prevCount = state.harvestedCounts[sp.id] ?? 0;

  // Golden Bloom Roll: 12% base + 8% if tended/watered + 18% with Wisteria Pergola + weather bonus!
  const goldenChance = Math.min(
    0.75,
    0.12 +
      (cur.waterCount > 0 ? 0.08 : 0) +
      (options?.hasPergola ? 0.18 : 0) +
      (options?.weatherGoldenBonus ?? 0)
  );
  const isGolden =
    typeof options?.forceGolden === "boolean" ? options.forceGolden : Math.random() < goldenChance;
  const yieldCount = isGolden ? 2 : 1;
  const sparksEarned = isGolden ? Math.ceil(sp.harvestSparks * 1.5) : sp.harvestSparks;

  const prevGoldenSpecies = state.goldenSpecies ?? {};
  return {
    harvested: sp,
    sparksEarned,
    isGolden,
    yieldCount,
    nextState: {
      ...state,
      totalHarvests: state.totalHarvests + 1,
      goldenHarvests: (state.goldenHarvests ?? 0) + (isGolden ? 1 : 0),
      harvestedCounts: {
        ...state.harvestedCounts,
        [sp.id]: prevCount + yieldCount
      },
      goldenSpecies: isGolden
        ? {
            ...prevGoldenSpecies,
            [sp.id]: (prevGoldenSpecies[sp.id] ?? 0) + 1
          }
        : prevGoldenSpecies,
      plots: {
        ...state.plots,
        [plotId]: {
          speciesId: null,
          plantedAtMs: 0,
          lastWateredAtMs: 0,
          boostSeconds: 0,
          waterCount: 0
        }
      }
    }
  };
}

/**
 * Instantly blooms ALL currently planted, growing beds across home & park
 * (powered by the crafted Crystal Bloom Elixir!).
 */
export function bloomAllPlantedPlots(
  state: GardenWorldState,
  nowMs = Date.now()
): { nextState: GardenWorldState; bloomedPlotIds: string[] } {
  const bloomedPlotIds: string[] = [];
  let cur = state;
  for (const def of GARDEN_PLOT_DEFS) {
    const plot = cur.plots[def.id];
    if (!plot || !plot.speciesId) continue;
    if (computePlotGrowth(plot, nowMs).readyToHarvest) continue;
    cur = fertilizeGardenPlot(cur, def.id, nowMs);
    bloomedPlotIds.push(def.id);
  }
  return { nextState: cur, bloomedPlotIds };
}

/**
 * Waters one growing garden plot automatically (used by the Lv.3 Garden Helper Pet Trick!).
 */
export function waterRandomGrowingPlot(
  state: GardenWorldState,
  nowMs = Date.now()
): { nextState: GardenWorldState; wateredPlotId: string | null } {
  for (const def of GARDEN_PLOT_DEFS) {
    const plot = state.plots[def.id];
    if (!plot || !plot.speciesId) continue;
    if (computePlotGrowth(plot, nowMs).readyToHarvest) continue;
    const res = waterGardenPlot(state, def.id, nowMs);
    if (res.boosted) return { nextState: res.nextState, wateredPlotId: def.id };
  }
  return { nextState: state, wateredPlotId: null };
}
