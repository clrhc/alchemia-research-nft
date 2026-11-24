/**
 * Spacious Homely Multi-Story Estate Geometry, Free-Placement Station Layout,
 * House Size Expansions (Lv.1-3), Multi-Story Floors (1F / 2F / 3F),
 * 6 Unlockable Cozy Interior Rooms & Wall Finishes.
 */

import type { LabStationId } from "./labStations";

export type MovableItemId =
  | LabStationId
  | "seating"
  | "bar"
  | "hobby"
  | "patio";

export type HouseSizeLevel = 1 | 2 | 3;
export type HouseFloorCount = 1 | 2 | 3;
/** 0 = B1 Underground Architect Basement, 1 = 1F Main Living & Lab Atrium, 2 = 2F Mezzanine Loft, 3 = 3F Sky Penthouse */
export type FloorNumber = 0 | 1 | 2 | 3;

export const BASEMENT_Y = -2.2;

export function formatFloorLabel(floor: FloorNumber): string {
  if (floor === 0) return "B1";
  return `${floor}F`;
}

export interface StairFlightDef {
  id: "b1-1f" | "1f-2f" | "2f-3f";
  fromFloor: FloorNumber;
  toFloor: FloorNumber;
  minX: number;
  maxX: number;
  /** Z coordinate where the flight connects to `fromFloor` */
  startZ: number;
  /** Z coordinate where the flight connects to `toFloor` */
  endZ: number;
  fromY: number;
  toY: number;
  stepCount: number;
  label: string;
}

/**
 * Single source of truth for the 3 physically walkable architectural staircases connecting
 * B1 (Basement) <-> 1F (Ground) <-> 2F (Mezzanine Loft) <-> 3F (Sky Penthouse).
 * Shared by both HomeArchitecture3D (3D floating treads) and Alchemy3DRenderer (walking physics).
 */
export const STAIR_FLIGHTS: readonly StairFlightDef[] = [
  {
    id: "b1-1f",
    fromFloor: 1,
    toFloor: 0,
    minX: 2.22,
    maxX: 3.18,
    startZ: -0.15,
    endZ: -2.75,
    fromY: 0.12,
    toY: BASEMENT_Y,
    stepCount: 12,
    label: "Basement Stairs (1F ↔ B1)"
  },
  {
    id: "1f-2f",
    fromFloor: 1,
    toFloor: 2,
    minX: -3.18,
    maxX: -2.22,
    startZ: -0.15,
    endZ: -2.75,
    fromY: 0.12,
    toY: 2.68,
    stepCount: 13,
    label: "Main Architect Stairs (1F ↔ 2F)"
  },
  {
    id: "2f-3f",
    fromFloor: 2,
    toFloor: 3,
    minX: -2.14,
    maxX: -1.26,
    startZ: -2.75,
    endZ: -0.35,
    fromY: 2.68,
    toY: 4.68,
    stepCount: 11,
    label: "Penthouse Switchback Stairs (2F ↔ 3F)"
  }
];

export interface StairWalkResult {
  onStairs: boolean;
  y: number;
  nextFloor?: FloorNumber;
  flightId?: StairFlightDef["id"];
  progress: number;
}

/**
 * Evaluates physical step-by-step walking along any active architectural staircase!
 * Uses hysteresis (0.86 / 0.14) so crossing a landing smoothly transitions `activeFloor`
 * without ever flickering back and forth.
 */
export function evaluateStairWalk(
  x: number,
  z: number,
  currentFloor: FloorNumber,
  houseFloors: HouseFloorCount,
  hasBasement: boolean
): StairWalkResult {
  for (const fl of STAIR_FLIGHTS) {
    if (fl.id === "b1-1f" && !hasBasement) continue;
    if (fl.id === "1f-2f" && houseFloors < 2) continue;
    if (fl.id === "2f-3f" && houseFloors < 3) continue;
    if (currentFloor !== fl.fromFloor && currentFloor !== fl.toFloor) continue;

    if (x < fl.minX - 0.08 || x > fl.maxX + 0.08) continue;
    const minZ = Math.min(fl.startZ, fl.endZ);
    const maxZ = Math.max(fl.startZ, fl.endZ);
    if (z < minZ - 0.08 || z > maxZ + 0.08) continue;

    const rawU = (z - fl.startZ) / (fl.endZ - fl.startZ);
    const u = Math.max(0, Math.min(1, rawU));
    const y = fl.fromY + u * (fl.toY - fl.fromY);

    let nextFloor: FloorNumber | undefined;
    if (currentFloor === fl.fromFloor && u >= 0.86) {
      nextFloor = fl.toFloor;
    } else if (currentFloor === fl.toFloor && u <= 0.14) {
      nextFloor = fl.fromFloor;
    }

    return {
      onStairs: true,
      y,
      nextFloor,
      flightId: fl.id,
      progress: u
    };
  }
  return { onStairs: false, y: getUpperFloorY(currentFloor), progress: 0 };
}

export const HOUSE_BASEMENT_DEF = {
  floor: 0 as FloorNumber,
  title: "B1 · Sunken Architect Basement",
  elevationY: BASEMENT_Y,
  desc: "Cutaway subterranean concrete lounge, elixir specimen vault & walkable descending stairs"
} as const;

export type ExtraRoomId =
  | "bedroom"
  | "kitchen"
  | "spa"
  | "hearth"
  | "pergola"
  | "music";

export type WallStyleId =
  | "alabaster-glass"
  | "nordic-wood"
  | "blush-plaster"
  | "silver-slate"
  | "sage-plaster";

export interface PlacedTransform {
  x: number;
  z: number;
  yaw: number;
  floor: FloorNumber;
}

export type CustomLayoutMap = Partial<Record<MovableItemId, PlacedTransform>>;

export interface HouseSizeDef {
  level: HouseSizeLevel;
  title: string;
  footprintLabel: string;
  halfExtent: number;
  costSparks: number;
  desc: string;
}

export const HOUSE_SIZE_DEFS: readonly HouseSizeDef[] = [
  {
    level: 1,
    title: "Studio Cottage",
    footprintLabel: "7.4m × 7.4m",
    halfExtent: 3.7,
    costSparks: 0,
    desc: "Airy sunlit promenade deck with porch steps & front garden"
  },
  {
    level: 2,
    title: "Courtyard Residence",
    footprintLabel: "8.4m × 8.4m",
    halfExtent: 4.2,
    costSparks: 15,
    desc: "Wraparound timber-glass veranda, glowing wall screens & garden hedges"
  },
  {
    level: 3,
    title: "Grand Villa Estate",
    footprintLabel: "9.2m × 9.2m",
    halfExtent: 4.6,
    costSparks: 35,
    desc: "Full villa terrace, twin entrance porticos & glowing corner lanterns"
  }
];

export interface HouseFloorDef {
  floors: HouseFloorCount;
  title: string;
  elevationY: number;
  costSparks: number;
  desc: string;
}

export const HOUSE_FLOOR_DEFS: readonly HouseFloorDef[] = [
  {
    floors: 1,
    title: "1F · Main Living & Lab Atrium",
    elevationY: 0.12,
    costSparks: 0,
    desc: "Panoramic glass cutaway living hall, center tabletop NFT island & descending basement stairs"
  },
  {
    floors: 2,
    title: "2F · Architect Mezzanine Loft",
    elevationY: 2.68,
    costSparks: 0,
    desc: "Walkable 2nd-story glass loft balcony overlooking the atrium with real floating oak steps"
  },
  {
    floors: 3,
    title: "3F · Starlight Sky Penthouse",
    elevationY: 4.68,
    costSparks: 45,
    desc: "Walkable rooftop conservatory deck, switchback stairs, telescope & festoon light arches"
  }
];

export interface ExtraRoomDef {
  id: ExtraRoomId;
  name: string;
  desc: string;
  perk: string;
  costSparks: number;
  accent: string;
  x: number;
  z: number;
  yaw: number;
  standX: number;
  standZ: number;
}

export const EXTRA_ROOM_DEFS: readonly ExtraRoomDef[] = [
  {
    id: "bedroom",
    name: "Cozy Bedroom Nook",
    desc: "Canopy bed, plush duvet, glowing bedside lamp & soft sheer drapes",
    perk: "+35 Energy · Power Nap",
    costSparks: 12,
    accent: "#a78bfa",
    x: -3.85,
    z: 1.65,
    yaw: Math.PI / 2,
    standX: -3.05,
    standZ: 1.65
  },
  {
    id: "kitchen",
    name: "Warm Kitchenette",
    desc: "Alabaster island, steaming kettle, pendant lights & cafe stools",
    perk: "+25 Energy & +15 Social",
    costSparks: 12,
    accent: "#f59e0b",
    x: 0.0,
    z: -3.95,
    yaw: 0,
    standX: 0.0,
    standZ: -3.25
  },
  {
    id: "spa",
    name: "Onsen Soaking Spa",
    desc: "Steaming cedar-and-stone soaking tub with floating sakura petals",
    perk: "Relaxed Mood · +30 Energy",
    costSparks: 15,
    accent: "#38bdf8",
    x: 3.85,
    z: -3.35,
    yaw: -0.55,
    standX: 3.25,
    standZ: -2.95
  },
  {
    id: "hearth",
    name: "Glass Fireplace Den",
    desc: "Modern floating glass hearth with animated glowing embers & ottoman",
    perk: "Relaxed Mood · +25 Fun",
    costSparks: 15,
    accent: "#fb7185",
    x: -3.85,
    z: -1.65,
    yaw: Math.PI / 2,
    standX: -3.15,
    standZ: -1.65
  },
  {
    id: "pergola",
    name: "Wisteria Garden Arbor",
    desc: "Sun-dappled timber & silver pergola draped in blooming vines",
    perk: "Inspired Mood · +20 Focus",
    costSparks: 15,
    accent: "#10b981",
    x: -3.45,
    z: 3.55,
    yaw: 0.78,
    standX: -2.65,
    standZ: 2.95
  },
  {
    id: "music",
    name: "Piano Conservatory",
    desc: "Sculptural white-and-silver mini grand piano & illuminated score stand",
    perk: "Playful Mood · +30 Fun",
    costSparks: 18,
    accent: "#f472b6",
    x: 3.85,
    z: 1.65,
    yaw: -Math.PI / 2,
    standX: 3.05,
    standZ: 1.65
  }
];

export interface WallStyleOption {
  id: WallStyleId;
  label: string;
  wallHex: string;
  trimHex: string;
  swatch: string;
}

export const WALL_STYLES: readonly WallStyleOption[] = [
  { id: "alabaster-glass", label: "Silver Glass", wallHex: "#f4f7fb", trimHex: "#cbd5e1", swatch: "#e2e8f0" },
  { id: "nordic-wood", label: "Nordic Timber", wallHex: "#f3ece1", trimHex: "#c9b394", swatch: "#dfd0ba" },
  { id: "blush-plaster", label: "Blush Cream", wallHex: "#fdf2f8", trimHex: "#e2c6d4", swatch: "#fce7f3" },
  { id: "silver-slate", label: "Graphite Chic", wallHex: "#e2e8f0", trimHex: "#64748b", swatch: "#94a3b8" },
  { id: "sage-plaster", label: "Botanical Sage", wallHex: "#ecfdf5", trimHex: "#94c5ae", swatch: "#d1fae5" }
];

export interface MovableItemMeta {
  id: MovableItemId;
  label: string;
  category: "station" | "furniture";
  accent: string;
}

export const MOVABLE_ITEMS: readonly MovableItemMeta[] = [
  { id: "research", label: "Protein Microscope", category: "station", accent: "#38bdf8" },
  { id: "mining", label: "ALCH Harvester", category: "station", accent: "#6366f1" },
  { id: "pet", label: "Pet Sanctuary", category: "station", accent: "#f472b6" },
  { id: "builder", label: "Architect Studio", category: "station", accent: "#10b981" },
  { id: "console", label: "Profile Console", category: "station", accent: "#8b5cf6" },
  { id: "seating", label: "Lounge Seating", category: "furniture", accent: "#a855f7" },
  { id: "bar", label: "Refreshment Bar", category: "furniture", accent: "#f59e0b" },
  { id: "hobby", label: "Hobby Nook Prop", category: "furniture", accent: "#0ea5e9" },
  { id: "patio", label: "Patio Sculpture", category: "furniture", accent: "#34d399" }
];

/**
 * Spacious, airy default coordinates across the architect house floorplan so
 * every tabletop station, lounge set, and both walkable staircases have wide navigable hallways!
 */
export const DEFAULT_SPACIOUS_LAYOUT: Record<MovableItemId, PlacedTransform> = {
  research: { x: -1.35, z: -2.55, yaw: 0.2, floor: 1 },
  mining: { x: 1.35, z: -2.55, yaw: -0.2, floor: 1 },
  pet: { x: 1.85, z: 2.15, yaw: -0.6, floor: 1 },
  builder: { x: -1.45, z: 2.55, yaw: 0.35, floor: 1 },
  console: { x: 2.55, z: 0.95, yaw: -1.35, floor: 1 },
  seating: { x: -2.55, z: 1.15, yaw: 1.35, floor: 1 },
  bar: { x: 0.0, z: -2.85, yaw: 0, floor: 1 },
  hobby: { x: -2.85, z: 2.65, yaw: 0.65, floor: 1 },
  patio: { x: 2.85, z: 2.85, yaw: 0, floor: 1 }
};

export function getHouseBoundsRadius(size: HouseSizeLevel): number {
  return HOUSE_SIZE_DEFS.find((s) => s.level === size)?.halfExtent ?? 3.7;
}

export function getUpperFloorY(floor: FloorNumber): number {
  if (floor === 0) return BASEMENT_Y;
  if (floor === 3) return 4.68;
  if (floor === 2) return 2.68;
  return 0.12;
}

export function getGroundElevationForFloor(
  floor: FloorNumber,
  x: number,
  z: number,
  houseSize: HouseSizeLevel = 1
): number {
  if (floor === 0) return BASEMENT_Y;
  if (floor === 2) return 2.68;
  if (floor === 3) return 4.68;
  const deckHalf = getHouseBoundsRadius(houseSize);
  if (Math.abs(x) <= deckHalf && Math.abs(z) <= deckHalf) return 0.12;
  return 0.03;
}

export function resolveItemPlacement(
  itemId: MovableItemId,
  customLayout?: CustomLayoutMap | null
): PlacedTransform {
  const custom = customLayout?.[itemId];
  const fallback = DEFAULT_SPACIOUS_LAYOUT[itemId];
  if (!custom || !Number.isFinite(custom.x) || !Number.isFinite(custom.z)) {
    return { ...fallback };
  }
  const floor: FloorNumber =
    custom.floor === 0 || custom.floor === 2 || custom.floor === 3 ? custom.floor : 1;
  return {
    x: custom.x,
    z: custom.z,
    yaw: Number.isFinite(custom.yaw) ? custom.yaw : fallback.yaw,
    floor
  };
}

/**
 * Clamps a user-placed station or furniture coordinate safely inside the home footprint
 * (across B1 Basement, 1F Living Atrium, 2F Mezzanine Loft, and 3F Sky Penthouse),
 * clear of the central tabletop NFT island & stairwells, with optional 0.25m snapping!
 */
export function clampPlacementPoint(
  x: number,
  z: number,
  houseSize: HouseSizeLevel,
  floor: FloorNumber,
  snapGrid = true
): { x: number; z: number } {
  const maxHalf =
    floor === 1 ? getHouseBoundsRadius(houseSize) - 0.38 : floor === 0 ? 3.05 : 3.25;
  let nx = Math.max(-maxHalf, Math.min(maxHalf, x));
  let nz = Math.max(-maxHalf, Math.min(maxHalf, z));

  if (snapGrid) {
    nx = Math.round(nx * 4) / 4;
    nz = Math.round(nz * 4) / 4;
  }

  if (floor === 0) {
    // Keep clear of the East descending Basement Stairwell footprint (x > 2.0, z < 0.05)
    if (nx > 1.95 && nz < 0.1) {
      nx = 1.95;
    }
    return {
      x: Number(nx.toFixed(2)),
      z: Number(nz.toFixed(2))
    };
  }

  // Keep cleanly outside central tabletop NFT display island (1F) or open double-height atrium shaft (2F/3F)
  const minCenterR = floor === 1 ? 1.24 : 2.05;
  const r = Math.hypot(nx, nz);
  if (r < minCenterR) {
    const ang = r > 0.001 ? Math.atan2(nz, nx) : Math.PI * 0.5;
    nx = Math.cos(ang) * minCenterR;
    nz = Math.sin(ang) * minCenterR;
  }

  // On 1F, avoid placing tables directly inside either open staircase flight
  if (floor === 1 && nz > -2.85 && nz < -0.05) {
    if (nx > 2.05 && nx < 3.3) nx = 1.95;
    if (nx < -2.05 && nx > -3.3) nx = -1.95;
  }

  // On 2F/3F cutaway loft balcony, keep out of the front open atrium edge (z > 1.65 & |x| < 1.95)
  if (floor >= 2 && nz > 1.65 && Math.abs(nx) < 1.95) {
    nz = 1.65;
  }

  return {
    x: Number(nx.toFixed(2)),
    z: Number(nz.toFixed(2))
  };
}

export function sanitizeCustomLayout(raw: unknown): CustomLayoutMap {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, Partial<PlacedTransform> | undefined>;
  const out: CustomLayoutMap = {};
  for (const item of MOVABLE_ITEMS) {
    const entry = src[item.id];
    if (!entry || typeof entry.x !== "number" || typeof entry.z !== "number") continue;
    if (!Number.isFinite(entry.x) || !Number.isFinite(entry.z)) continue;
    const floor: FloorNumber =
      entry.floor === 0 || entry.floor === 2 || entry.floor === 3 ? entry.floor : 1;
    out[item.id] = {
      x: Math.max(-4.5, Math.min(4.5, Number(entry.x.toFixed(2)))),
      z: Math.max(-4.5, Math.min(4.5, Number(entry.z.toFixed(2)))),
      yaw: typeof entry.yaw === "number" && Number.isFinite(entry.yaw) ? entry.yaw : DEFAULT_SPACIOUS_LAYOUT[item.id].yaw,
      floor
    };
  }
  return out;
}

export function findNearestStationWithLayout(
  charX: number,
  charZ: number,
  charFloor: FloorNumber,
  customLayout?: CustomLayoutMap | null,
  triggerRadius = 0.86
): LabStationId | null {
  const stationIds: LabStationId[] = ["research", "mining", "pet", "builder", "console"];
  let bestId: LabStationId | null = null;
  let bestDist = Infinity;
  for (const id of stationIds) {
    const pos = resolveItemPlacement(id, customLayout);
    if (pos.floor !== charFloor) continue;
    const d = Math.hypot(charX - pos.x, charZ - pos.z);
    if (d <= triggerRadius && d < bestDist) {
      bestDist = d;
      bestId = id;
    }
  }
  return bestId;
}
