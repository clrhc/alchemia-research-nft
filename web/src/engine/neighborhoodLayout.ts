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
}

/** Walkable world radius covering Inner Boulevard, all 4 Canal Bridges & Ring 2 Canal Suburb Estates */
export const NEIGHBORHOOD_WALK_LIMIT = 26.5;

/** Maximum individually rendered neighborhood plots in the live 3D town (120+ minted NFTs!) */
export const MAX_NEIGHBORHOOD_PLOTS = 120;

/** Shared Community Research Fountain Plaza positioned cleanly on the South boulevard */
export const COMMUNITY_FOUNTAIN_POS: readonly [number, number] = [0, 5.45];

/** Grand Alchemia Botanical Park & Glass Conservatory center in the wide SE greenbelt */
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
 * 4 Walkable Quadrant Town Parks nested in wide 12.6m diagonal greenbelts across the Canal Bridges!
 */
export const TOWN_PARKS: readonly TownParkDef[] = [
  {
    id: "conservatory",
    name: "Grand Botanical Park",
    subtitle: "Glass Conservatory, 6 Community Garden Beds & Koi Pond",
    x: 15.2,
    z: 15.2,
    visitX: 13.6,
    visitZ: 12.6,
    accent: "#10b981"
  },
  {
    id: "sakura-park",
    name: "Sakura Picnic Park",
    subtitle: "Cherry Blossom Grove, Drifting Petals & Zen Lanterns",
    x: -15.2,
    z: 15.2,
    visitX: -13.2,
    visitZ: 13.0,
    accent: "#f472b6"
  },
  {
    id: "herb-orchard",
    name: "Sunlit Herb Orchard",
    subtitle: "Raised Cedar Planters, Potting Greenhouse & Fruit Trees",
    x: -15.2,
    z: -15.2,
    visitX: -13.0,
    visitZ: -13.0,
    accent: "#f59e0b"
  },
  {
    id: "rose-gardens",
    name: "Scented Rose & Lavender Park",
    subtitle: "Fragrant Lavender Terraces, Topiary Hedges & Glass Arbor",
    x: 15.2,
    z: -15.2,
    visitX: 13.0,
    visitZ: -13.0,
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
 * Curated quadrant-aligned Inner Boulevard lots (Ring 1, 8 plots) keeping all 4 cardinal
 * avenues (North, South, East, West) completely unobstructed toward the 4 Arched Canal Bridges!
 */
const INNER_RING_COORDS: ReadonlyArray<{ x: number; z: number; district: string }> = [
  { x: -8.2, z: 4.2, district: "West Boulevard" },
  { x: 8.2, z: 4.2, district: "East Boulevard" },
  { x: -8.2, z: -4.2, district: "North-West Terrace" },
  { x: 8.2, z: -4.2, district: "North-East Terrace" },
  { x: -4.6, z: -8.6, district: "North Gardens" },
  { x: 4.6, z: -8.6, district: "North Gardens" },
  { x: -5.0, z: 9.4, district: "South Plaza" },
  { x: 5.0, z: 9.4, district: "South Plaza" }
];

/**
 * Generates deterministic architectural plot coordinates for ANY plot index 0..119+:
 *  - 0..7:   Ring 1 Inner Boulevard (walkable, inside canal)
 *  - 8..23:  Ring 2 Canal-Side Suburb Estates (16 walkable homes across the 4 canal bridges!)
 *  - 24..∞:  Ring 3 Expanding Outer Research City Avenues (concentric structured city blocks)
 */
export function getNeighborhoodPlotSlot(plotIndex: number): PlotCoordSlot {
  if (plotIndex < INNER_RING_COORDS.length) {
    const slot = INNER_RING_COORDS[plotIndex];
    const rotY = Math.atan2(-slot.x, -slot.z);
    const len = Math.hypot(slot.x, slot.z) || 1;
    return {
      ring: 1,
      districtName: slot.district,
      x: slot.x,
      z: slot.z,
      rotY,
      visitX: slot.x - (slot.x / len) * 2.85,
      visitZ: slot.z - (slot.z / len) * 2.85
    };
  }

  // Ring 2: 16 Walkable Canal-Side Suburb Estates arranged cleanly in 4 quadrants (4 estates per quadrant)
  const ring2Idx = plotIndex - INNER_RING_COORDS.length;
  if (ring2Idx < 16) {
    const quadrant = ring2Idx % 4; // 0=SE, 1=SW, 2=NW, 3=NE (fills balanced around the whole town!)
    const posInQuad = Math.floor(ring2Idx / 4); // 0..3
    // Angles cleanly tucked near cardinal avenues, opening huge 12.6m diagonal greenbelts for the 4 Town Parks!
    const quadBaseAngle = quadrant * (Math.PI / 2);
    const localOffsets = [0.21, 0.46, 1.1, 1.35];
    const angle = quadBaseAngle + localOffsets[posInQuad];
    const radius = 21.8;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const rotY = Math.atan2(-x, -z);
    const len = Math.hypot(x, z) || 1;
    const quadNames = ["South-East Suburb", "South-West Suburb", "North-West Suburb", "North-East Suburb"];
    return {
      ring: 2,
      districtName: quadNames[quadrant],
      x,
      z,
      rotY,
      // Front driveway meeting the Outer Suburb Boulevard at r ≈ 18.7
      visitX: x - (x / len) * 3.1,
      visitZ: z - (z / len) * 3.1
    };
  }

  // Ring 3+: Ever-growing Outer Research City Skyline arranged in concentric urban rings!
  const outerIdx = ring2Idx - 16;
  const ringCapacity = 24;
  const band = Math.floor(outerIdx / ringCapacity); // 0, 1, 2, 3...
  const idxInBand = outerIdx % ringCapacity;
  const angle = ((idxInBand + (band % 2) * 0.5) / ringCapacity) * Math.PI * 2 + 0.12;
  const radius = 29.8 + band * 5.8 + (idxInBand % 2) * 1.1;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const rotY = Math.atan2(-x, -z);
  const len = Math.hypot(x, z) || 1;
  return {
    ring: 3,
    districtName: band === 0 ? "Skyline Heights" : band === 1 ? "Innovation Ridge" : "Horizon District",
    x,
    z,
    rotY,
    visitX: (x / len) * 24.5,
    visitZ: (z / len) * 24.5
  };
}

/**
 * Computes the town's civic growth milestone from total minted labs in the neighborhood!
 */
export function getNeighborhoodGrowthStage(totalMintedLabs: number): NeighborhoodGrowthStage {
  const n = Math.max(1, totalMintedLabs);
  if (n < 4) {
    return {
      level: 1,
      title: "Pioneer Plaza",
      subtitle: "Early founders settling around the Community Research Fountain",
      nextMilestone: 4,
      progressPct: Math.round((n / 4) * 100),
      transitUnlocked: false,
      skylineUnlocked: false
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
      skylineUnlocked: false
    };
  }
  if (n < 25) {
    return {
      level: 3,
      title: "Canal-Side Village",
      subtitle: "Suburb estates across the 4 canal bridges + Hover-Shuttle online",
      nextMilestone: 25,
      progressPct: Math.round(((n - 10) / 15) * 100),
      transitUnlocked: true,
      skylineUnlocked: false
    };
  }
  if (n < 50) {
    return {
      level: 4,
      title: "Alchemia Town",
      subtitle: "Outer Skyline Heights illuminated across the research valley",
      nextMilestone: 50,
      progressPct: Math.round(((n - 25) / 25) * 100),
      transitUnlocked: true,
      skylineUnlocked: true
    };
  }
  return {
    level: 5,
    title: "Research Metropolis",
    subtitle: "Thriving open-science city stretching across the sunlit horizon",
    nextMilestone: null,
    progressPct: 100,
    transitUnlocked: true,
    skylineUnlocked: true
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
