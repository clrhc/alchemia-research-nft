/**
 * Deterministic Unbounded Living NFT Neighborhood Masterplan & Town Growth Engine.
 *
 * As more users mint ALCHEMIA NFTs, the entire architectural Sims town visibly grows
 * outward block-by-block around the viewer's Home Lab at (0, 0):
 *  - Ring 1 (Plots 0..7): Walkable Inner Boulevard (8 quadrant plots flanking 4 cardinal avenues).
 *  - Canal Ring (r = 12.8..14.9): Shimmering water ring spanned by 4 Arched Alabaster Bridges.
 *  - Ring 2 (Plots 8..23): Walkable Canal-Side Suburb Estates (16 full-detail homes with lawns,
 *    driveways, mailboxes & strolling NPCs along the Outer Suburb Boulevard!).
 *  - Ring 3 (Plots 24..119+): Ever-growing Outer Research City Skyline stretching to the horizon!
 *  - Upcoming Blueprint Lots: Surveyed "Next Mint" lots ahead of totalSupply that transform live
 *    into real minted 3D labs whenever someone mints!
 */

import {
  BACKPACK_OPTIONS,
  BOTTOM_COLORS,
  BOTTOM_STYLES,
  BUILD_SCALE_OPTIONS,
  EXPRESSION_OPTIONS,
  EYEWEAR_OPTIONS,
  EYE_COLORS,
  FOOTWEAR_STYLES,
  HAIR_COLORS,
  HAIR_STYLES,
  HEADWEAR_OPTIONS,
  NECKWEAR_OPTIONS,
  OUTFIT_ACCENTS,
  OUTFIT_BASE_COLORS,
  OUTFIT_STYLES,
  PERSONALITY_TRAITS,
  RESEARCHER_TITLES,
  SKIN_TONES,
  type CharacterProfile
} from "./characterConfig";
import { SeededRNG } from "./prng";
import { complexityTierFromUsd } from "../web3/config";

export interface NeighborLabSummary {
  tokenId: number;
  seed: string;
  causeId: number;
  causeName: string;
  minter: string;
  valueUsd: number;
  complexityTier: number;
  sectorsMask: number;
  workUnits: number;
  ownedByUser?: boolean;
}

export interface NeighborhoodPlotPlacement {
  plotIndex: number;
  ring: 1 | 2 | 3;
  districtName: string;
  x: number;
  z: number;
  /** Facing angle toward nearest avenue / central plaza */
  rotY: number;
  /** Walk-up greeting pad in front of the neighbor's front steps */
  visitX: number;
  visitZ: number;
  lab: NeighborLabSummary;
}

export interface UpcomingBlueprintLot {
  plotIndex: number;
  lotNumber: number;
  ring: 1 | 2 | 3;
  districtName: string;
  x: number;
  z: number;
  rotY: number;
}

export interface NeighborhoodGrowthStage {
  level: 1 | 2 | 3 | 4 | 5;
  title: string;
  subtitle: string;
  nextMilestone: number | null;
  progressPct: number;
  transitUnlocked: boolean;
  skylineUnlocked: boolean;
  expansionBandsUnlocked: number;
}

/** Base walkable world radius covering Ring 1 + Ring 2 + 4 Block Parks inside the reflecting canal */
export const NEIGHBORHOOD_WALK_LIMIT = 29.5;

/** Maximum individually rendered neighborhood plots in the live 3D town (240+ minted NFTs across 9 expansion rings!) */
export const MAX_NEIGHBORHOOD_PLOTS = 240;

/** Outer Expansion Ring Road geometry constants (shared by 3D paved roads, plots & District Mini-Map!) */
export const EXPANSION_BAND_FIRST_SPAN = 35.4;
export const EXPANSION_BAND_STEP = 10.6;
export const EXPANSION_PLOTS_PER_BAND = 24;

/** Centerline half-span of Outer Expansion Ring Avenue `bandIndex` (0 -> 35.4m, 1 -> 46.0m, 2 -> 56.6m...) */
export function getExpansionBandAvenueSpan(bandIndex: number): number {
  return Number((EXPANSION_BAND_FIRST_SPAN + Math.max(0, bandIndex) * EXPANSION_BAND_STEP).toFixed(2));
}

/**
 * Computes how many Outer Expansion Ring Road bands beyond the canal (Ring 3+) should be paved
 * to serve `totalPlotsWithSurveyed` neighbor plots + upcoming blueprint lots.
 */
export function getExpansionBandCount(totalPlotsWithSurveyed: number): number {
  const outer = Math.max(0, totalPlotsWithSurveyed - 24);
  if (outer <= 0) return 0;
  return Math.ceil(outer / EXPANSION_PLOTS_PER_BAND);
}

/**
 * Computes the dynamic walkable town boundary radius as more people mint NFTs and new
 * Outer Expansion Ring Roads & canal bridges form!
 */
export function getNeighborhoodWalkLimit(totalMintedLabs: number): number {
  const occupiedNeighbors = Math.max(0, totalMintedLabs - 1);
  const bands = getExpansionBandCount(Math.min(MAX_NEIGHBORHOOD_PLOTS, occupiedNeighbors + 4));
  if (bands <= 0) return NEIGHBORHOOD_WALK_LIMIT;
  return Math.min(132, Number((getExpansionBandAvenueSpan(bands - 1) + 7.5).toFixed(2)));
}

/**
 * Orthogonal Neighborhood Street Grid Coordinates (single source of truth shared by
 * 3D Paved Streets, Sidewalks, Streetlamps, Plot Placement & the District Mini-Map!).
 */
export const TOWN_STREETS = {
  ns: [-21.2, -6.8, 6.8, 21.2] as readonly number[],
  ew: [-21.2, -6.8, 8.4, 21.6] as readonly number[],
  roadWidth: 2.2,
  sidewalkTotalWidth: 3.3
};

/** Shared Community Research Fountain Plaza positioned cleanly on the South boulevard */
export const COMMUNITY_FOUNTAIN_POS: readonly [number, number] = [0, 5.45];

/** Grand Alchemia Botanical Park & Glass Conservatory center inside the SE City Block */
export const TOWN_PARK_CENTER: readonly [number, number] = [15.2, 15.2];

export interface TownParkDef {
  id: "conservatory" | "sakura-park" | "herb-orchard" | "rose-gardens";
  name: string;
  subtitle: string;
  x: number;
  z: number;
  visitX: number;
  visitZ: number;
  accent: string;
}

/**
 * 4 Dedicated City-Block Town Parks framed cleanly on all 4 sides by paved neighborhood streets!
 */
export const TOWN_PARKS: readonly TownParkDef[] = [
  {
    id: "conservatory",
    name: "Grand Botanical Park",
    subtitle: "Glass Conservatory, 6 Community Garden Beds & Koi Pond",
    x: 15.2,
    z: 15.2,
    visitX: 12.2,
    visitZ: 10.6,
    accent: "#10b981"
  },
  {
    id: "sakura-park",
    name: "Sakura Picnic Park",
    subtitle: "Cherry Blossom Grove, Drifting Petals & Zen Lanterns",
    x: -15.2,
    z: 15.2,
    visitX: -12.2,
    visitZ: 10.6,
    accent: "#f472b6"
  },
  {
    id: "herb-orchard",
    name: "Sunlit Herb Orchard",
    subtitle: "Raised Cedar Planters, Potting Greenhouse & Fruit Trees",
    x: -15.2,
    z: -15.2,
    visitX: -12.2,
    visitZ: -10.4,
    accent: "#f59e0b"
  },
  {
    id: "rose-gardens",
    name: "Scented Rose & Lavender Park",
    subtitle: "Fragrant Lavender Terraces, Topiary Hedges & Glass Arbor",
    x: 15.2,
    z: -15.2,
    visitX: 12.2,
    visitZ: -10.4,
    accent: "#a78bfa"
  }
];

interface PlotCoordSlot {
  ring: 1 | 2 | 3;
  districtName: string;
  x: number;
  z: number;
  rotY: number;
  visitX: number;
  visitZ: number;
}

/**
 * Proper Orthogonal Street-Facing Neighborhood Plots (Ring 1, 8 Lots) lined neatly
 * along Willow Lane (x=-6.8), Maple Lane (x=+6.8), Oakwood Street (z=-6.8) & Main Street (z=+8.4)!
 * Every house sits squarely at 90° facing the paved street right in front of its driveway!
 */
const INNER_RING_SLOTS: ReadonlyArray<Omit<PlotCoordSlot, "ring">> = [
  { x: -11.2, z: -2.2, rotY: Math.PI / 2, visitX: -8.2, visitZ: -2.2, districtName: "Willow Lane" },
  { x: 11.2, z: -2.2, rotY: -Math.PI / 2, visitX: 8.2, visitZ: -2.2, districtName: "Maple Lane" },
  { x: -11.2, z: 3.6, rotY: Math.PI / 2, visitX: -8.2, visitZ: 3.6, districtName: "Willow Lane" },
  { x: 11.2, z: 3.6, rotY: -Math.PI / 2, visitX: 8.2, visitZ: 3.6, districtName: "Maple Lane" },
  { x: -3.0, z: -11.2, rotY: 0, visitX: -3.0, visitZ: -8.3, districtName: "Oakwood Street" },
  { x: 3.0, z: -11.2, rotY: 0, visitX: 3.0, visitZ: -8.3, districtName: "Oakwood Street" },
  { x: -3.0, z: 12.8, rotY: Math.PI, visitX: -3.0, visitZ: 9.9, districtName: "Main Street" },
  { x: 3.0, z: 12.8, rotY: Math.PI, visitX: 3.0, visitZ: 9.9, districtName: "Main Street" }
];

/**
 * Proper Suburban Block Plots (Ring 2, 16 Walkable Lots) lined neatly along the 4 Perimeter
 * Park Boulevards (West Park Blvd, East Park Blvd, North Orchard Ave & South Blossom Ave),
 * overlooking the 4 City-Block Parks with clean 90° street-facing driveways & sidewalks!
 */
const OUTER_SUBURB_SLOTS: ReadonlyArray<Omit<PlotCoordSlot, "ring">> = [
  // East Park Blvd (facing West onto x = +21.2)
  { x: 25.6, z: 15.2, rotY: -Math.PI / 2, visitX: 22.6, visitZ: 15.2, districtName: "East Park Blvd" },
  { x: 25.6, z: 3.6, rotY: -Math.PI / 2, visitX: 22.6, visitZ: 3.6, districtName: "East Park Blvd" },
  { x: 25.6, z: -2.6, rotY: -Math.PI / 2, visitX: 22.6, visitZ: -2.6, districtName: "East Park Blvd" },
  { x: 25.6, z: -15.2, rotY: -Math.PI / 2, visitX: 22.6, visitZ: -15.2, districtName: "East Park Blvd" },
  // South Blossom Ave (facing North onto z = +21.6)
  { x: 15.2, z: 26.0, rotY: Math.PI, visitX: 15.2, visitZ: 23.0, districtName: "South Blossom Ave" },
  { x: 3.0, z: 26.0, rotY: Math.PI, visitX: 3.0, visitZ: 23.0, districtName: "South Blossom Ave" },
  { x: -3.0, z: 26.0, rotY: Math.PI, visitX: -3.0, visitZ: 23.0, districtName: "South Blossom Ave" },
  { x: -15.2, z: 26.0, rotY: Math.PI, visitX: -15.2, visitZ: 23.0, districtName: "South Blossom Ave" },
  // West Park Blvd (facing East onto x = -21.2)
  { x: -25.6, z: 15.2, rotY: Math.PI / 2, visitX: -22.6, visitZ: 15.2, districtName: "West Park Blvd" },
  { x: -25.6, z: 3.6, rotY: Math.PI / 2, visitX: -22.6, visitZ: 3.6, districtName: "West Park Blvd" },
  { x: -25.6, z: -2.6, rotY: Math.PI / 2, visitX: -22.6, visitZ: -2.6, districtName: "West Park Blvd" },
  { x: -25.6, z: -15.2, rotY: Math.PI / 2, visitX: -22.6, visitZ: -15.2, districtName: "West Park Blvd" },
  // North Orchard Ave (facing South onto z = -21.2)
  { x: -15.2, z: -25.6, rotY: 0, visitX: -15.2, visitZ: -22.6, districtName: "North Orchard Ave" },
  { x: -3.0, z: -25.6, rotY: 0, visitX: -3.0, visitZ: -22.6, districtName: "North Orchard Ave" },
  { x: 3.0, z: -25.6, rotY: 0, visitX: 3.0, visitZ: -22.6, districtName: "North Orchard Ave" },
  { x: 15.2, z: -25.6, rotY: 0, visitX: 15.2, visitZ: -22.6, districtName: "North Orchard Ave" }
];

// Clean non-overlapping along-avenue lot centers for Ring 3+ Expansion Bands (6 per side = 24/band),
// spaced strictly clear of the 4 cardinal connector roads (x = ±6.8, z = -6.8 & +8.4) and corner junctions!
const EXPANSION_EW_SIDE_ZS: readonly number[] = [-26.2, -19.0, -11.8, 0.8, 14.2, 22.4];
const EXPANSION_NS_SIDE_XS: readonly number[] = [-25.6, -18.4, -11.6, 11.6, 18.4, 25.6];

const EXPANSION_DISTRICT_NAMES = [
  "Skyline Heights",
  "Innovation Ridge",
  "Horizon Estates",
  "Starlight Commons"
] as const;

/**
 * Generates deterministic orthogonal residential plot coordinates for ANY plot index 0..239+:
 *  - 0..7:   Ring 1 Inner Neighborhood Streets (8 walkable fenced plots on Willow, Maple, Oakwood & Main)
 *  - 8..23:  Ring 2 Suburb Park Boulevards (16 walkable fenced estates overlooking the 4 City-Block Parks!)
 *  - 24..∞:  Ring 3+ Dynamically Paved Outer Expansion Ring Avenues (24 street-facing plots per ring band,
 *            cleanly aligned onto each newly formed Expansion Avenue across the canal bridges!)
 */
export function getNeighborhoodPlotSlot(plotIndex: number): PlotCoordSlot {
  if (plotIndex < INNER_RING_SLOTS.length) {
    return { ring: 1, ...INNER_RING_SLOTS[plotIndex] };
  }

  const ring2Idx = plotIndex - INNER_RING_SLOTS.length;
  if (ring2Idx < OUTER_SUBURB_SLOTS.length) {
    // Interleave across all 4 avenues so the town expands evenly on every side!
    const side = ring2Idx % 4;
    const posOnSide = Math.floor(ring2Idx / 4);
    const slot = OUTER_SUBURB_SLOTS[side * 4 + posOnSide];
    return { ring: 2, ...slot };
  }

  // Ring 3+: Dynamically Paved Orthogonal Outer Expansion Ring Avenues!
  const outerIdx = ring2Idx - OUTER_SUBURB_SLOTS.length;
  const band = Math.floor(outerIdx / EXPANSION_PLOTS_PER_BAND);
  const idxInBand = outerIdx % EXPANSION_PLOTS_PER_BAND;
  // Interleave across East (0), South (1), West (2), North (3) so outer districts grow symmetrically!
  const side = idxInBand % 4;
  const posOnSide = Math.floor(idxInBand / 4); // 0..5

  const avenueSpan = getExpansionBandAvenueSpan(band);
  const houseSpan = Number((avenueSpan + 4.35).toFixed(2));
  const visitSpan = Number((avenueSpan + 1.55).toFixed(2));

  let x = 0;
  let z = 0;
  let visitX = 0;
  let visitZ = 0;
  let rotY = 0;
  if (side === 0) {
    // East Expansion Avenue (house faces West onto x = +avenueSpan)
    x = houseSpan;
    z = EXPANSION_EW_SIDE_ZS[posOnSide];
    visitX = visitSpan;
    visitZ = z;
    rotY = -Math.PI / 2;
  } else if (side === 1) {
    // South Expansion Avenue (house faces North onto z = +avenueSpan)
    x = EXPANSION_NS_SIDE_XS[posOnSide];
    z = houseSpan;
    visitX = x;
    visitZ = visitSpan;
    rotY = Math.PI;
  } else if (side === 2) {
    // West Expansion Avenue (house faces East onto x = -avenueSpan)
    x = -houseSpan;
    z = EXPANSION_EW_SIDE_ZS[posOnSide];
    visitX = -visitSpan;
    visitZ = z;
    rotY = Math.PI / 2;
  } else {
    // North Expansion Avenue (house faces South onto z = -avenueSpan)
    x = EXPANSION_NS_SIDE_XS[posOnSide];
    z = -houseSpan;
    visitX = x;
    visitZ = -visitSpan;
    rotY = 0;
  }

  const districtName =
    band < EXPANSION_DISTRICT_NAMES.length
      ? EXPANSION_DISTRICT_NAMES[band]
      : `Frontier Sector ${band - EXPANSION_DISTRICT_NAMES.length + 1}`;

  return {
    ring: 3,
    districtName,
    x,
    z,
    rotY,
    visitX,
    visitZ
  };
}

/**
 * Computes the town's civic growth milestone from total minted labs in the neighborhood!
 */
export function getNeighborhoodGrowthStage(totalMintedLabs: number): NeighborhoodGrowthStage {
  const n = Math.max(1, totalMintedLabs);
  const expansionBandsUnlocked = getExpansionBandCount(Math.max(0, n - 1) + 4);
  if (n < 4) {
    return {
      level: 1,
      title: "Pioneer Plaza",
      subtitle: "Early founders settling around the Community Research Fountain",
      nextMilestone: 4,
      progressPct: Math.round((n / 4) * 100),
      transitUnlocked: false,
      skylineUnlocked: false,
      expansionBandsUnlocked
    };
  }
  if (n < 10) {
    return {
      level: 2,
      title: "Boulevard Hamlet",
      subtitle: "Inner Boulevard bustling with strolling neighbor researchers",
      nextMilestone: 10,
      progressPct: Math.round(((n - 4) / 6) * 100),
      transitUnlocked: false,
      skylineUnlocked: false,
      expansionBandsUnlocked
    };
  }
  if (n < 25) {
    return {
      level: 3,
      title: "Canal-Side Village",
      subtitle: "Suburb estates along the 4 park boulevards + Hover-Shuttle online",
      nextMilestone: 25,
      progressPct: Math.round(((n - 10) / 15) * 100),
      transitUnlocked: true,
      skylineUnlocked: false,
      expansionBandsUnlocked
    };
  }
  if (n < 50) {
    return {
      level: 4,
      title: "Alchemia Town",
      subtitle: "Arched canal bridges & Outer Skyline Heights expansion avenues open!",
      nextMilestone: 50,
      progressPct: Math.round(((n - 25) / 25) * 100),
      transitUnlocked: true,
      skylineUnlocked: true,
      expansionBandsUnlocked
    };
  }
  return {
    level: 5,
    title: "Research Metropolis",
    subtitle: `Thriving open-science metropolis with ${Math.max(1, expansionBandsUnlocked)} outer expansion road ring${expansionBandsUnlocked === 1 ? "" : "s"}!`,
    nextMilestone: null,
    progressPct: 100,
    transitUnlocked: true,
    skylineUnlocked: true,
    expansionBandsUnlocked
  };
}

const CAUSE_NAMES = [
  "Cancer & Precision Oncology",
  "Longevity & Cellular Repair",
  "Clean Water & Ocean Ecology",
  "Open-Source Neurobiology"
];

const NPC_FIRST_NAMES = [
  "Dr. Lin",
  "Mateo",
  "Nadia",
  "Kenji",
  "Clara",
  "Theo",
  "Yuki",
  "Elena",
  "Devon",
  "Amara",
  "Soren",
  "Priya",
  "Hana",
  "Lucas",
  "Maya",
  "Rohan"
];

/**
 * Builds deterministic neighbor labs when totalSupply exceeds explicitly known vessels
 * (for example inside standalone animation.html or offline demo mode), scaling up to 120+ plots!
 */
export function buildNeighborhoodRoster(
  activeTokenId: number,
  knownVessels: readonly NeighborLabSummary[],
  totalSupply: number,
  maxPlots = MAX_NEIGHBORHOOD_PLOTS
): NeighborLabSummary[] {
  const seen = new Set<number>([activeTokenId]);
  const roster: NeighborLabSummary[] = [];

  // Prioritize real on-chain / app-minted neighbor NFTs first
  for (const v of knownVessels) {
    if (seen.has(v.tokenId)) continue;
    seen.add(v.tokenId);
    roster.push({
      ...v,
      complexityTier: v.complexityTier || complexityTierFromUsd(v.valueUsd)
    });
    if (roster.length >= maxPlots) return roster;
  }

  // Synthesize deterministic minted neighborhood tokens matching totalSupply so the city visibly grows!
  const cappedTotal = Math.min(Math.max(totalSupply, roster.length + 1), maxPlots + 1);
  for (let id = 1; id <= cappedTotal && roster.length < maxPlots; id++) {
    if (seen.has(id)) continue;
    seen.add(id);
    const seedHex = deterministicNeighborSeed(id);
    const rng = new SeededRNG(seedHex, 777 + id);
    const causeId = id % 4;
    const usdStops = [1, 5, 10, 25, 50, 100, 250, 500];
    const valueUsd =
      usdStops[Math.min(usdStops.length - 1, Math.floor(rng.next() * usdStops.length))];
    const tier = complexityTierFromUsd(valueUsd);
    let sectorsMask = 0;
    for (let bit = 0; bit < 6; bit++) {
      if (rng.next() < 0.32 + tier * 0.08) sectorsMask |= 1 << bit;
    }
    roster.push({
      tokenId: id,
      seed: seedHex,
      causeId,
      causeName: CAUSE_NAMES[causeId],
      minter: `0x${seedHex.slice(2, 6)}…${seedHex.slice(-4)}`,
      valueUsd,
      complexityTier: tier,
      sectorsMask,
      workUnits: Math.floor(rng.range(1, 24))
    });
  }

  return roster;
}

export function deterministicNeighborSeed(tokenId: number): `0x${string}` {
  let h1 = (tokenId * 2654435761) >>> 0;
  let h2 = ((tokenId + 17) * 2246822519) >>> 0;
  let hex = "";
  for (let i = 0; i < 8; i++) {
    h1 = Math.imul(h1 ^ (h1 >>> 15), 0x85ebca6b) >>> 0;
    h2 = Math.imul(h2 ^ (h2 >>> 13), 0xc2b2ae35) >>> 0;
    hex += ((h1 ^ h2) >>> 0).toString(16).padStart(8, "0");
  }
  return `0x${hex}`;
}

/**
 * Computes clean, collision-free 3D world plot coordinates for every minted neighbor lab.
 */
export function computeNeighborhoodPlacements(
  neighbors: readonly NeighborLabSummary[]
): NeighborhoodPlotPlacement[] {
  return neighbors.map((lab, i) => {
    const slot = getNeighborhoodPlotSlot(i);
    return {
      plotIndex: i,
      ring: slot.ring,
      districtName: slot.districtName,
      x: slot.x,
      z: slot.z,
      rotY: slot.rotY,
      visitX: slot.visitX,
      visitZ: slot.visitZ,
      lab
    };
  });
}

/**
 * Computes the next `count` surveyed "For-Mint" holographic blueprint lots waiting down the
 * neighborhood avenues so players literally watch empty lots become real homes as NFTs mint!
 */
export function computeUpcomingBlueprintLots(
  occupiedNeighborCount: number,
  count = 4
): UpcomingBlueprintLot[] {
  const lots: UpcomingBlueprintLot[] = [];
  for (let offset = 0; offset < count; offset++) {
    const plotIndex = occupiedNeighborCount + offset;
    if (plotIndex >= MAX_NEIGHBORHOOD_PLOTS) break;
    const slot = getNeighborhoodPlotSlot(plotIndex);
    lots.push({
      plotIndex,
      lotNumber: plotIndex + 2, // Home Lab is #1, first neighbor is #2, etc.
      ring: slot.ring,
      districtName: slot.districtName,
      x: slot.x,
      z: slot.z,
      rotY: slot.rotY
    });
  }
  return lots;
}

/**
 * Deterministically derives a stylish 3D Neighbor Researcher NPC avatar from any minted NFT's seed!
 */
export function deriveNeighborCharacterProfile(lab: NeighborLabSummary): CharacterProfile {
  const rng = new SeededRNG(lab.seed, 909 + lab.tokenId);
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng.next() * arr.length)];
  return {
    name: pick(NPC_FIRST_NAMES),
    title: pick(RESEARCHER_TITLES),
    trait: pick(PERSONALITY_TRAITS).id,
    skinTone: pick(SKIN_TONES).hex,
    eyeColor: pick(EYE_COLORS).hex,
    expression: pick(EXPRESSION_OPTIONS).id,
    buildScale: pick(BUILD_SCALE_OPTIONS).id,
    hairStyle: pick(HAIR_STYLES).id,
    hairColor: pick(HAIR_COLORS).hex,
    outfitStyle: pick(OUTFIT_STYLES).id,
    outfitBaseColor: pick(OUTFIT_BASE_COLORS).hex,
    outfitAccent: pick(OUTFIT_ACCENTS).hex,
    bottomStyle: pick(BOTTOM_STYLES).id,
    bottomColor: pick(BOTTOM_COLORS).hex,
    footwearStyle: pick(FOOTWEAR_STYLES).id,
    neckwear: pick(NECKWEAR_OPTIONS).id,
    eyewear: pick(EYEWEAR_OPTIONS).id,
    headwear: pick(HEADWEAR_OPTIONS).id,
    backpack: pick(BACKPACK_OPTIONS).id,
    createdAtMs: 0
  };
}
