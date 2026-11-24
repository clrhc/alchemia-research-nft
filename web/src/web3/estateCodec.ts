/**
 * Deterministic 64-bit bit-packer for on-chain `EstateBlueprint.stylePacked` & 6-bit
 * `extraRoomsMask`, ensuring that home furnishings, wall/floor finishes, multi-story floors,
 * and homely rooms round-trip cleanly between the 3D Architect House and `AlchemiaImpactNFT` V2!
 */

import { EXTRA_ROOM_DEFS, type ExtraRoomId } from "../engine/homeLayout";
import {
  BAR_STYLES,
  FLOOR_STYLES,
  HOBBY_PROPS,
  LIGHTING_FIXTURES,
  PATIO_DECORS,
  PLANT_PACKS,
  RUG_STYLES,
  SEATING_STYLES,
  type LabDecorConfig
} from "../engine/simsState";
import { WALL_STYLES } from "../engine/homeLayout";

export interface OnChainEstateBlueprint {
  houseSize: 1 | 2 | 3;
  houseFloors: 1 | 2 | 3;
  hasBasement: boolean;
  extraRoomsMask: number;
  gardenHarvests: number;
  /** Hex-encoded uint64 (JSON & BroadcastChannel safe!) */
  stylePackedHex: string;
  profileCode?: string;
}

const ROOM_ORDER: readonly ExtraRoomId[] = EXTRA_ROOM_DEFS.map((r) => r.id);

export function encodeExtraRoomsMask(rooms: readonly ExtraRoomId[]): number {
  let mask = 0;
  for (let i = 0; i < ROOM_ORDER.length; i++) {
    if (rooms.includes(ROOM_ORDER[i])) {
      mask |= 1 << i;
    }
  }
  return mask;
}

export function decodeExtraRoomsMask(mask: number): ExtraRoomId[] {
  const out: ExtraRoomId[] = [];
  for (let i = 0; i < ROOM_ORDER.length; i++) {
    if ((mask & (1 << i)) !== 0) {
      out.push(ROOM_ORDER[i]);
    }
  }
  return out;
}

function indexOfId<T extends { id: string }>(arr: readonly T[], id: string): bigint {
  const idx = arr.findIndex((item) => item.id === id);
  return BigInt(idx >= 0 ? idx & 0x0f : 0);
}

/**
 * Packs 9 home decor / architectural style selectors into a compact `uint64` (4 bits each = 36 bits used,
 * plus bit 40 sentinel = 1 so stylePacked === 0 unambiguously means "unset / default").
 */
export function packLabStyleBits(decor: LabDecorConfig): bigint {
  let bits = 1n << 40n; // Sentinel bit marking explicit customization
  bits |= indexOfId(FLOOR_STYLES, decor.floorStyle) << 0n;
  bits |= indexOfId(WALL_STYLES, decor.wallStyle) << 4n;
  bits |= indexOfId(PATIO_DECORS, decor.patioDecor) << 8n;
  bits |= indexOfId(SEATING_STYLES, decor.seatingStyle) << 12n;
  bits |= indexOfId(BAR_STYLES, decor.barStyle) << 16n;
  bits |= indexOfId(HOBBY_PROPS, decor.hobbyProp) << 20n;
  bits |= indexOfId(RUG_STYLES, decor.rugStyle) << 24n;
  bits |= indexOfId(PLANT_PACKS, decor.plantPack) << 28n;
  bits |= indexOfId(LIGHTING_FIXTURES, decor.lightingFixture) << 32n;
  return bits;
}

function pickAt<T extends { id: string }>(arr: readonly T[], bits: bigint, shift: bigint): T["id"] {
  const idx = Number((bits >> shift) & 0x0fn);
  return (arr[idx] ?? arr[0]).id;
}

export function unpackLabStyleBits(
  stylePacked: bigint
): Partial<
  Pick<
    LabDecorConfig,
    | "floorStyle"
    | "wallStyle"
    | "patioDecor"
    | "seatingStyle"
    | "barStyle"
    | "hobbyProp"
    | "rugStyle"
    | "plantPack"
    | "lightingFixture"
  >
> {
  if (stylePacked === 0n) return {};
  return {
    floorStyle: pickAt(FLOOR_STYLES, stylePacked, 0n) as LabDecorConfig["floorStyle"],
    wallStyle: pickAt(WALL_STYLES, stylePacked, 4n) as LabDecorConfig["wallStyle"],
    patioDecor: pickAt(PATIO_DECORS, stylePacked, 8n) as LabDecorConfig["patioDecor"],
    seatingStyle: pickAt(SEATING_STYLES, stylePacked, 12n) as LabDecorConfig["seatingStyle"],
    barStyle: pickAt(BAR_STYLES, stylePacked, 16n) as LabDecorConfig["barStyle"],
    hobbyProp: pickAt(HOBBY_PROPS, stylePacked, 20n) as LabDecorConfig["hobbyProp"],
    rugStyle: pickAt(RUG_STYLES, stylePacked, 24n) as LabDecorConfig["rugStyle"],
    plantPack: pickAt(PLANT_PACKS, stylePacked, 28n) as LabDecorConfig["plantPack"],
    lightingFixture: pickAt(LIGHTING_FIXTURES, stylePacked, 32n) as LabDecorConfig["lightingFixture"]
  };
}

/**
 * Merges on-chain `EstateBlueprint` state cleanly onto a base `LabDecorConfig`.
 */
export function parseStylePackedBigInt(raw?: string | bigint): bigint {
  if (typeof raw === "bigint") return raw;
  if (!raw) return 0n;
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

export function applyOnChainEstateToDecor(
  base: LabDecorConfig,
  estate?: OnChainEstateBlueprint
): LabDecorConfig {
  if (!estate) return base;
  const styleOverrides = unpackLabStyleBits(parseStylePackedBigInt(estate.stylePackedHex));
  const onChainRooms = decodeExtraRoomsMask(estate.extraRoomsMask);
  const mergedRooms = Array.from(new Set([...base.extraRooms, ...onChainRooms]));
  return {
    ...base,
    ...styleOverrides,
    houseSize: Math.max(base.houseSize, estate.houseSize) as 1 | 2 | 3,
    houseFloors: Math.max(base.houseFloors, estate.houseFloors) as 1 | 2 | 3,
    hasBasement: base.hasBasement || estate.hasBasement,
    extraRooms: mergedRooms
  };
}

/**
 * Computes the incremental $ALCH coin cost & ETH cost units for expanding an on-chain estate
 * (mirrors `AlchemiaImpactNFT._computeEstateExpansion` exactly!).
 */
export function estimateEstateExpansionCost(
  current: Pick<OnChainEstateBlueprint, "houseSize" | "houseFloors" | "hasBasement" | "extraRoomsMask">,
  target: Pick<OnChainEstateBlueprint, "houseSize" | "houseFloors" | "hasBasement" | "extraRoomsMask">
): { coinCost: number; ethUnits: number; mergedRoomsMask: number } {
  const addedSizes = Math.max(0, target.houseSize - current.houseSize);
  const addedFloors = Math.max(0, target.houseFloors - current.houseFloors);
  const addedBasement = target.hasBasement && !current.hasBasement ? 1 : 0;
  const mergedRoomsMask = current.extraRoomsMask | target.extraRoomsMask;
  const newBits = mergedRoomsMask ^ current.extraRoomsMask;
  let addedRooms = 0;
  for (let i = 0; i < 6; i++) {
    if ((newBits & (1 << i)) !== 0) addedRooms++;
  }
  const ethUnits = addedSizes + addedFloors + addedBasement + addedRooms;
  const coinCost = addedSizes * 80 + (addedFloors + addedBasement) * 90 + addedRooms * 45;
  return { coinCost, ethUnits, mergedRoomsMask };
}
