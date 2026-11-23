import {
  ATOM_CONFIGS,
  ELEMENTS,
  FAMILIARS,
  PALETTES,
  VESSELS,
  type AlchemyTraits,
  type SubTraits
} from "./traits";

/**
 * Normalize any string or hex seed into a deterministic 32-byte 0x-prefixed hex string.
 */
export function normalizeSeed(seedInput: string): `0x${string}` {
  const cleaned = seedInput.trim().toLowerCase();
  if (/^0x[0-9a-f]{64}$/.test(cleaned)) {
    return cleaned as `0x${string}`;
  }
  // Deterministic 256-bit mixing fallback for human-readable seeds
  let h1 = 0xdeadbeef ^ cleaned.length;
  let h2 = 0x41c6ce57 ^ cleaned.length;
  let h3 = 0x9e3779b9;
  let h4 = 0x85ebca6b;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ (ch + i), 2246822519);
    h4 = Math.imul(h4 ^ (ch * 31), 3266489917);
  }
  const parts = [h1, h2, h3, h4, h1 ^ h3, h2 ^ h4, h1 + h4, h2 + h3].map((n) =>
    (n >>> 0).toString(16).padStart(8, "0")
  );
  return `0x${parts.join("")}` as `0x${string}`;
}

export function randomSeedHex(): `0x${string}` {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}` as `0x${string}`;
}

/**
 * Deterministic Mulberry32 PRNG seeded from the 256-bit on-chain seed.
 */
export class SeededRNG {
  private state: number;

  constructor(seedHex: string, salt = 0) {
    const hex = normalizeSeed(seedHex).slice(2);
    let acc = (0x9e3779b9 ^ salt) >>> 0;
    for (let i = 0; i < 64; i += 8) {
      const chunk = parseInt(hex.slice(i, i + 8), 16) >>> 0;
      acc = Math.imul(acc ^ chunk, 0x85ebca6b) >>> 0;
      acc = ((acc << 13) | (acc >>> 19)) >>> 0;
    }
    this.state = acc || 0x13579bdf;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 0.999999));
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  chance(p: number): boolean {
    return this.next() < p;
  }
}

/**
 * Derives primary traits BIT-FOR-BIT identically to AlchemiaOnChainSVG.sol `deriveTraits(bytes32 seed)`
 * plus rich algorithmic sub-traits so every mint generates a distinct stylized composition.
 */
export function deriveTraitsFromSeed(rawSeed: string): AlchemyTraits {
  const seed = normalizeSeed(rawSeed);
  const h = BigInt(seed);

  const vesselIdx = Number(h % 5n);
  const familiarRoll = Number((h >> 8n) % 100n);
  const paletteIdx = Number((h >> 16n) % 9n);
  const atomIdx = Number((h >> 24n) % 5n);
  const elementIdx = Number((h >> 32n) % 5n);

  let familiarIdx = 0;
  if (familiarRoll < 16) familiarIdx = 0;
  else if (familiarRoll < 32) familiarIdx = 1;
  else if (familiarRoll < 47) familiarIdx = 2;
  else if (familiarRoll < 63) familiarIdx = 3;
  else if (familiarRoll < 79) familiarIdx = 4;
  else if (familiarRoll < 94) familiarIdx = 5;
  else familiarIdx = 6; // Mythic Harmonic Cat & Dog Duo (6%)

  const rng = new SeededRNG(seed, 42);

  const sub: SubTraits = {
    orbitalCount: rng.int(2, 4),
    protonCount: rng.int(4, 9),
    neutronCount: rng.int(4, 8),
    hasCondenserTube: rng.chance(0.65),
    hasSideVials: rng.chance(0.75),
    hasAstrolabeGlyphs: rng.chance(0.88),
    hasDNAVapor: rng.chance(0.55),
    hasPrismHalo: rng.chance(0.5),
    companionSide: rng.chance(0.5) ? "right" : "left",
    companionAccessory: rng.pick(["goggles", "halo", "pendant", "monocle", "scarf"]),
    coatVariant: rng.int(0, 2),
    vesselScale: rng.range(0.95, 1.07),
    astrolabeTilt: rng.range(-0.35, 0.35),
    starCount: rng.int(18, 34),
    molecularNodes: rng.int(5, 9),
    sparkleHueShift: rng.range(-18, 18)
  };

  let rarityScore = 0;
  if (familiarIdx === 6) rarityScore += 55;
  if (paletteIdx === 8 || paletteIdx === 7) rarityScore += 22;
  if (vesselIdx === 4 || vesselIdx === 3) rarityScore += 12;
  if (sub.hasPrismHalo) rarityScore += 8;
  if (sub.hasDNAVapor) rarityScore += 6;

  const rarityTier =
    rarityScore >= 55
      ? "Mythic"
      : rarityScore >= 28
        ? "Arcane"
        : rarityScore >= 14
          ? "Catalytic"
          : "Atelier";

  return {
    seed,
    vesselIdx,
    familiarIdx,
    paletteIdx,
    atomIdx,
    elementIdx,
    vessel: VESSELS[vesselIdx],
    familiar: FAMILIARS[familiarIdx],
    palette: PALETTES[paletteIdx],
    atomConfig: ATOM_CONFIGS[atomIdx],
    element: ELEMENTS[elementIdx],
    rarityTier,
    sub
  };
}
