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
export type FloorNumber = 1 | 2 | 3;

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
    title: "1F · Ground Atrium",
    elevationY: 0.12,
    costSparks: 0,
    desc: "Open sunlit rotunda, porch deck & garden courtyard"
  },
  {
    floors: 2,
    title: "2F · Sunlit Mezzanine Loft",
    elevationY: 2.68,
    costSparks: 20,
    desc: "Walkable 2nd-story glass loft balcony & brushed-silver spiral staircase"
  },
  {
    floors: 3,
    title: "3F · Starlight Sky Penthouse",
    elevationY: 4.68,
    costSparks: 45,
    desc: "Walkable rooftop conservatory deck, telescope & festoon light arches"
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
    x: -3.25,
    z: -2.65,
    yaw: 0.45,
    standX: -2.45,
    standZ: -2.15
  },
  {
    id: "kitchen",
    name: "Warm Kitchenette",
    desc: "Alabaster island, steaming kettle, pendant lights & cafe stools",
    perk: "+25 Energy & +15 Social",
    costSparks: 12,
    accent: "#f59e0b",
    x: 0.05,
    z: -3.35,
    yaw: 0,
    standX: 0.05,
    standZ: -2.55
  },
  {
    id: "spa",
    name: "Onsen Soaking Spa",
    desc: "Steaming cedar-and-stone soaking tub with floating sakura petals",
    perk: "Relaxed Mood · +30 Energy",
    costSparks: 15,
    accent: "#38bdf8",
    x: 3.35,
    z: -2.55,
    yaw: -0.55,
    standX: 2.55,
    standZ: -2.05
  },
  {
    id: "hearth",
    name: "Glass Fireplace Den",
    desc: "Modern floating glass hearth with animated glowing embers & ottoman",
    perk: "Relaxed Mood · +25 Fun",
    costSparks: 15,
    accent: "#fb7185",
    x: -3.45,
    z: 0.25,
    yaw: Math.PI / 2,
    standX: -2.65,
    standZ: 0.25
  },
  {
    id: "pergola",
    name: "Wisteria Garden Arbor",
    desc: "Sun-dappled timber & silver pergola draped in blooming vines",
    perk: "Inspired Mood · +20 Focus",
    costSparks: 15,
    accent: "#10b981",
    x: -3.15,
    z: 3.15,
    yaw: 0.78,
    standX: -2.35,
    standZ: 2.55
  },
  {
    id: "music",
    name: "Piano Conservatory",
    desc: "Sculptural white-and-silver mini grand piano & illuminated score stand",
    perk: "Playful Mood · +30 Fun",
    costSparks: 18,
    accent: "#f472b6",
    x: 3.35,
    z: 1.55,
    yaw: -1.15,
    standX: 2.55,
    standZ: 1.45
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
 * Spacious, airy default coordinates across the expanded home courtyard so
 * every station, furniture set, and living zone has generous walking room!
 */
export const DEFAULT_SPACIOUS_LAYOUT: Record<MovableItemId, PlacedTransform> = {
  research: { x: -2.42, z: -1.18, yaw: 1.45, floor: 1 },
  mining: { x: 2.58, z: -0.36, yaw: -1.5, floor: 1 },
  pet: { x: 1.88, z: 1.86, yaw: -0.55, floor: 1 },
  builder: { x: -1.62, z: 2.52, yaw: 0.25, floor: 1 },
  console: { x: 1.96, z: -1.88, yaw: -2.35, floor: 1 },
  seating: { x: -2.48, z: 1.18, yaw: 1.2, floor: 1 },
  bar: { x: -1.52, z: -2.38, yaw: 0.65, floor: 1 },
  hobby: { x: 2.54, z: -2.42, yaw: -0.65, floor: 1 },
  patio: { x: 2.86, z: 2.66, yaw: 0, floor: 1 }
};

export function getHouseBoundsRadius(size: HouseSizeLevel): number {
  return HOUSE_SIZE_DEFS.find((s) => s.level === size)?.halfExtent ?? 3.7;
}

export function getUpperFloorY(floor: FloorNumber): number {
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
  if (floor === 2) return 2.68;
  if (floor === 3) return 4.68;
  const r = Math.hypot(x, z);
  if (r <= 1.84) return 0.39;
  if (r < 2.2) {
    const u = (r - 1.84) / (2.2 - 1.84);
    return 0.39 * (1 - u) + 0.23 * u;
  }
  if (Math.abs(x) <= 2.32 && Math.abs(z) <= 2.32) return 0.23;
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
  const floor: FloorNumber = custom.floor === 3 || custom.floor === 2 ? custom.floor : 1;
  return {
    x: custom.x,
    z: custom.z,
    yaw: Number.isFinite(custom.yaw) ? custom.yaw : fallback.yaw,
    floor
  };
}

/**
 * Clamps a user-placed station or furniture coordinate safely inside the home footprint,
 * outside the central glass reactor pedestal, and optionally snaps cleanly to a 0.25m grid!
 */
export function clampPlacementPoint(
  x: number,
  z: number,
  houseSize: HouseSizeLevel,
  floor: FloorNumber,
  snapGrid = true
): { x: number; z: number } {
  const maxHalf = floor === 1 ? getHouseBoundsRadius(houseSize) - 0.38 : 3.25;
  let nx = Math.max(-maxHalf, Math.min(maxHalf, x));
  let nz = Math.max(-maxHalf, Math.min(maxHalf, z));

  if (snapGrid) {
    nx = Math.round(nx * 4) / 4;
    nz = Math.round(nz * 4) / 4;
  }

  // Keep cleanly outside central borosilicate glass reactor / open atrium shaft
  const minCenterR = floor === 1 ? 1.24 : 2.05;
  const r = Math.hypot(nx, nz);
  if (r < minCenterR) {
    const ang = r > 0.001 ? Math.atan2(nz, nx) : Math.PI * 0.5;
    nx = Math.cos(ang) * minCenterR;
    nz = Math.sin(ang) * minCenterR;
  }

  // On 2F/3F C-shaped loft balcony, keep out of the front cutaway window (z > 1.75 & |x| < 1.9)
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
    const floor: FloorNumber = entry.floor === 3 || entry.floor === 2 ? entry.floor : 1;
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
