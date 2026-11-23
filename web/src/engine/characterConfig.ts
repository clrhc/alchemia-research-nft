/**
 * Customizable 3D Researcher Character Configuration, Archetype Presets &
 * Sandbox-Safe Persistence (localStorage + in-memory + URL hash codec for NFT iframes).
 */

export type HairStyleId = "bob" | "bun" | "spiky" | "long" | "curly" | "buzz";
export type OutfitStyleId = "labcoat" | "tunic" | "hoodie" | "jumpsuit" | "cape";
export type EyewearId = "none" | "round" | "goggles" | "visor" | "shades";
export type HeadwearId = "none" | "beret" | "halo" | "headphones" | "cap";
export type BackpackId = "none" | "flaskpack" | "satchel" | "holodrone";
export type ExpressionId = "smile" | "focused" | "delighted" | "serene";
export type BuildScaleId = "compact" | "classic" | "tall";
export type PersonalityTraitId =
  | "genius"
  | "cheerful"
  | "creative"
  | "outgoing"
  | "bookworm"
  | "ambitious";

export interface PersonalityTraitOption {
  id: PersonalityTraitId;
  label: string;
  desc: string;
  accent: string;
}

export interface CharacterProfile {
  name: string;
  title: string;
  trait?: PersonalityTraitId;
  skinTone: string;
  eyeColor: string;
  expression: ExpressionId;
  buildScale: BuildScaleId;
  hairStyle: HairStyleId;
  hairColor: string;
  outfitStyle: OutfitStyleId;
  outfitAccent: string;
  eyewear: EyewearId;
  headwear: HeadwearId;
  backpack: BackpackId;
  createdAtMs: number;
}

export interface SwatchOption {
  id: string;
  label: string;
  hex: string;
}

export interface StyleOption<T extends string> {
  id: T;
  label: string;
}

export interface CharacterPreset {
  id: string;
  label: string;
  profile: Omit<CharacterProfile, "createdAtMs">;
}

export const RESEARCHER_TITLES: readonly string[] = [
  "Lead Alchemist",
  "Protein Architect",
  "Quantum Miner",
  "Bio-Curator",
  "Lab Explorer"
];

export const PERSONALITY_TRAITS: readonly PersonalityTraitOption[] = [
  { id: "genius", label: "Genius", desc: "Loves deep protein folds & Focus boosts", accent: "#38bdf8" },
  { id: "cheerful", label: "Cheerful", desc: "Radiates Playful energy & brightens rooms", accent: "#a855f7" },
  { id: "creative", label: "Creative", desc: "Often Inspired by lab architecture & decor", accent: "#10b981" },
  { id: "outgoing", label: "Outgoing", desc: "Bonds rapidly with neighbors & hosts", accent: "#f472b6" },
  { id: "bookworm", label: "Bookworm", desc: "Thrives in serene study & guestbook notes", accent: "#6366f1" },
  { id: "ambitious", label: "Ambitious", desc: "Energized by mining & growing the town", accent: "#f59e0b" }
];

export const SKIN_TONES: readonly SwatchOption[] = [
  { id: "porcelain", label: "Ivory", hex: "#f7dfd1" },
  { id: "peach", label: "Warm Peach", hex: "#f0c8a8" },
  { id: "golden", label: "Golden", hex: "#d9a476" },
  { id: "caramel", label: "Caramel", hex: "#b87c52" },
  { id: "chestnut", label: "Chestnut", hex: "#8c5738" },
  { id: "espresso", label: "Espresso", hex: "#5a3726" }
];

export const EYE_COLORS: readonly SwatchOption[] = [
  { id: "obsidian", label: "Obsidian", hex: "#141b2b" },
  { id: "sapphire", label: "Sapphire", hex: "#3b82f6" },
  { id: "emerald", label: "Emerald", hex: "#10b981" },
  { id: "amber", label: "Amber", hex: "#d97706" },
  { id: "violet", label: "Violet", hex: "#7c3aed" },
  { id: "rose", label: "Rose", hex: "#db2777" }
];

export const EXPRESSION_OPTIONS: readonly StyleOption<ExpressionId>[] = [
  { id: "smile", label: "Warm Smile" },
  { id: "delighted", label: "Joyful" },
  { id: "focused", label: "Focused" },
  { id: "serene", label: "Serene" }
];

export const BUILD_SCALE_OPTIONS: readonly StyleOption<BuildScaleId>[] = [
  { id: "compact", label: "Compact" },
  { id: "classic", label: "Classic" },
  { id: "tall", label: "Tall" }
];

export const BUILD_SCALE_MULTIPLIER: Record<BuildScaleId, number> = {
  compact: 0.91,
  classic: 1.0,
  tall: 1.09
};

export const HAIR_STYLES: readonly StyleOption<HairStyleId>[] = [
  { id: "bob", label: "Sleek Bob" },
  { id: "bun", label: "Lab Bun" },
  { id: "spiky", label: "Swept" },
  { id: "long", label: "Flowing" },
  { id: "curly", label: "Curly Cloud" },
  { id: "buzz", label: "Cropped" }
];

export const HAIR_COLORS: readonly SwatchOption[] = [
  { id: "obsidian", label: "Obsidian", hex: "#1f2533" },
  { id: "espresso", label: "Espresso", hex: "#4a3228" },
  { id: "chestnut", label: "Auburn", hex: "#8b4a33" },
  { id: "blonde", label: "Honey", hex: "#d9b473" },
  { id: "silver", label: "Silver Frost", hex: "#cfd8e6" },
  { id: "rose", label: "Rose Quartz", hex: "#df88ad" },
  { id: "cobalt", label: "Cobalt Mist", hex: "#5b8def" }
];

export const OUTFIT_STYLES: readonly StyleOption<OutfitStyleId>[] = [
  { id: "labcoat", label: "Lab Coat" },
  { id: "tunic", label: "Atelier Tunic" },
  { id: "hoodie", label: "Studio Hoodie" },
  { id: "jumpsuit", label: "Flight Suit" },
  { id: "cape", label: "Scholar Cloak" }
];

export const OUTFIT_ACCENTS: readonly SwatchOption[] = [
  { id: "cobalt", label: "Cobalt", hex: "#5b8def" },
  { id: "emerald", label: "Mint", hex: "#10b981" },
  { id: "rose", label: "Rose", hex: "#f472b6" },
  { id: "violet", label: "Prism", hex: "#8b5cf6" },
  { id: "amber", label: "Amber", hex: "#f59e0b" },
  { id: "slate", label: "Slate", hex: "#475569" },
  { id: "cyan", label: "Glacier", hex: "#38bdf8" }
];

export const EYEWEAR_OPTIONS: readonly StyleOption<EyewearId>[] = [
  { id: "none", label: "None" },
  { id: "round", label: "Spectacles" },
  { id: "goggles", label: "Lab Goggles" },
  { id: "visor", label: "Glass Visor" },
  { id: "shades", label: "Shades" }
];

export const HEADWEAR_OPTIONS: readonly StyleOption<HeadwearId>[] = [
  { id: "none", label: "None" },
  { id: "beret", label: "Studio Beret" },
  { id: "halo", label: "Prism Halo" },
  { id: "headphones", label: "Headphones" },
  { id: "cap", label: "Lab Cap" }
];

export const BACKPACK_OPTIONS: readonly StyleOption<BackpackId>[] = [
  { id: "flaskpack", label: "Elixir Pack" },
  { id: "holodrone", label: "Holo Drone" },
  { id: "satchel", label: "Field Satchel" },
  { id: "none", label: "Minimal" }
];

export const CHARACTER_PRESETS: readonly CharacterPreset[] = [
  {
    id: "alchemist",
    label: "Alchemist",
    profile: {
      name: "Dr. Aria",
      title: "Lead Alchemist",
      trait: "genius",
      skinTone: "#f0c8a8",
      eyeColor: "#3b82f6",
      expression: "smile",
      buildScale: "classic",
      hairStyle: "bob",
      hairColor: "#1f2533",
      outfitStyle: "labcoat",
      outfitAccent: "#5b8def",
      eyewear: "round",
      headwear: "none",
      backpack: "flaskpack"
    }
  },
  {
    id: "architect",
    label: "Architect",
    profile: {
      name: "Sora",
      title: "Protein Architect",
      trait: "creative",
      skinTone: "#d9a476",
      eyeColor: "#10b981",
      expression: "serene",
      buildScale: "tall",
      hairStyle: "bun",
      hairColor: "#cfd8e6",
      outfitStyle: "tunic",
      outfitAccent: "#10b981",
      eyewear: "visor",
      headwear: "halo",
      backpack: "holodrone"
    }
  },
  {
    id: "miner",
    label: "Miner",
    profile: {
      name: "Kai",
      title: "Quantum Miner",
      trait: "ambitious",
      skinTone: "#b87c52",
      eyeColor: "#d97706",
      expression: "focused",
      buildScale: "classic",
      hairStyle: "spiky",
      hairColor: "#4a3228",
      outfitStyle: "jumpsuit",
      outfitAccent: "#8b5cf6",
      eyewear: "goggles",
      headwear: "headphones",
      backpack: "holodrone"
    }
  },
  {
    id: "curator",
    label: "Curator",
    profile: {
      name: "Lyra",
      title: "Bio-Curator",
      trait: "cheerful",
      skinTone: "#f7dfd1",
      eyeColor: "#db2777",
      expression: "delighted",
      buildScale: "compact",
      hairStyle: "long",
      hairColor: "#df88ad",
      outfitStyle: "cape",
      outfitAccent: "#f472b6",
      eyewear: "none",
      headwear: "beret",
      backpack: "satchel"
    }
  },
  {
    id: "explorer",
    label: "Explorer",
    profile: {
      name: "Milo",
      title: "Lab Explorer",
      trait: "outgoing",
      skinTone: "#8c5738",
      eyeColor: "#141b2b",
      expression: "smile",
      buildScale: "classic",
      hairStyle: "curly",
      hairColor: "#1f2533",
      outfitStyle: "hoodie",
      outfitAccent: "#38bdf8",
      eyewear: "shades",
      headwear: "cap",
      backpack: "flaskpack"
    }
  }
];

const CHARACTER_STORAGE_KEY = "alchemia_researcher_avatar_v1";
const SAMPLE_NAMES = ["Dr. Aria", "Kai", "Dr. Nova", "Sora", "Milo", "Lyra", "Ren", "Zoe"];

/** In-memory fallback so strict sandboxed NFT iframes (blocked localStorage) stay stateful */
let memoryProfileCache: CharacterProfile | null = null;

function pickValid<T extends string>(val: unknown, list: readonly { id: T }[], fallback: T): T {
  return typeof val === "string" && list.some((item) => item.id === val) ? (val as T) : fallback;
}

function pickHex(val: unknown, list: readonly SwatchOption[], fallback: string): string {
  if (typeof val === "string" && /^#[0-9a-fA-F]{6}$/.test(val)) return val;
  return list[0]?.hex || fallback;
}

export function createDefaultCharacterProfile(): CharacterProfile {
  return {
    ...CHARACTER_PRESETS[0].profile,
    createdAtMs: Date.now()
  };
}

export function sanitizeCharacterProfile(raw: Partial<CharacterProfile>): CharacterProfile {
  const base = createDefaultCharacterProfile();
  const cleanName =
    typeof raw.name === "string" && raw.name.trim().length > 0
      ? raw.name.trim().slice(0, 20)
      : base.name;
  const cleanTitle =
    typeof raw.title === "string" && RESEARCHER_TITLES.includes(raw.title)
      ? raw.title
      : base.title;

  return {
    name: cleanName,
    title: cleanTitle,
    trait: pickValid(raw.trait, PERSONALITY_TRAITS, base.trait || "genius"),
    skinTone: pickHex(raw.skinTone, SKIN_TONES, base.skinTone),
    eyeColor: pickHex(raw.eyeColor, EYE_COLORS, base.eyeColor),
    expression: pickValid(raw.expression, EXPRESSION_OPTIONS, base.expression),
    buildScale: pickValid(raw.buildScale, BUILD_SCALE_OPTIONS, base.buildScale),
    hairStyle: pickValid(raw.hairStyle, HAIR_STYLES, base.hairStyle),
    hairColor: pickHex(raw.hairColor, HAIR_COLORS, base.hairColor),
    outfitStyle: pickValid(raw.outfitStyle, OUTFIT_STYLES, base.outfitStyle),
    outfitAccent: pickHex(raw.outfitAccent, OUTFIT_ACCENTS, base.outfitAccent),
    eyewear: pickValid(raw.eyewear, EYEWEAR_OPTIONS, base.eyewear),
    headwear: pickValid(raw.headwear, HEADWEAR_OPTIONS, base.headwear),
    backpack: pickValid(raw.backpack, BACKPACK_OPTIONS, base.backpack),
    createdAtMs: typeof raw.createdAtMs === "number" ? raw.createdAtMs : Date.now()
  };
}

export function randomizeCharacterProfile(keepName?: string): CharacterProfile {
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const trimmed = keepName?.trim().slice(0, 20);
  return {
    name: trimmed && trimmed.length > 0 ? trimmed : pick(SAMPLE_NAMES),
    title: pick(RESEARCHER_TITLES),
    trait: pick(PERSONALITY_TRAITS).id,
    skinTone: pick(SKIN_TONES).hex,
    eyeColor: pick(EYE_COLORS).hex,
    expression: pick(EXPRESSION_OPTIONS).id,
    buildScale: pick(BUILD_SCALE_OPTIONS).id,
    hairStyle: pick(HAIR_STYLES).id,
    hairColor: pick(HAIR_COLORS).hex,
    outfitStyle: pick(OUTFIT_STYLES).id,
    outfitAccent: pick(OUTFIT_ACCENTS).hex,
    eyewear: pick(EYEWEAR_OPTIONS).id,
    headwear: pick(HEADWEAR_OPTIONS).id,
    backpack: pick(BACKPACK_OPTIONS).id,
    createdAtMs: Date.now()
  };
}

/** Compact URL-safe encoding so designed characters can be embedded in share links or iframe hashes */
export function encodeCharacterCode(profile: CharacterProfile): string {
  const clean = sanitizeCharacterProfile(profile);
  const payload = JSON.stringify({
    n: clean.name,
    t: RESEARCHER_TITLES.indexOf(clean.title),
    tr: clean.trait || "genius",
    sk: clean.skinTone,
    ec: clean.eyeColor,
    ex: clean.expression,
    bs: clean.buildScale,
    hs: clean.hairStyle,
    hc: clean.hairColor,
    os: clean.outfitStyle,
    oa: clean.outfitAccent,
    ew: clean.eyewear,
    hw: clean.headwear,
    bp: clean.backpack
  });
  return encodeURIComponent(payload);
}

export function decodeCharacterCode(code: string): CharacterProfile | null {
  try {
    const obj = JSON.parse(decodeURIComponent(code)) as Record<string, unknown>;
    if (!obj || typeof obj !== "object") return null;
    const titleIdx = typeof obj.t === "number" ? obj.t : 0;
    return sanitizeCharacterProfile({
      name: typeof obj.n === "string" ? obj.n : undefined,
      title: RESEARCHER_TITLES[titleIdx] || RESEARCHER_TITLES[0],
      trait: obj.tr as PersonalityTraitId,
      skinTone: typeof obj.sk === "string" ? obj.sk : undefined,
      eyeColor: typeof obj.ec === "string" ? obj.ec : undefined,
      expression: obj.ex as ExpressionId,
      buildScale: obj.bs as BuildScaleId,
      hairStyle: obj.hs as HairStyleId,
      hairColor: typeof obj.hc === "string" ? obj.hc : undefined,
      outfitStyle: obj.os as OutfitStyleId,
      outfitAccent: typeof obj.oa === "string" ? obj.oa : undefined,
      eyewear: obj.ew as EyewearId,
      headwear: obj.hw as HeadwearId,
      backpack: obj.bp as BackpackId
    });
  } catch {
    return null;
  }
}

export function loadCharacterProfile(): CharacterProfile | null {
  if (typeof window === "undefined") return memoryProfileCache;
  // Support optional ?char=... or #char=... deep-linked character inside standalone NFT iframes
  try {
    const searchChar = new URLSearchParams(window.location.search).get("char");
    if (searchChar) {
      const decoded = decodeCharacterCode(searchChar);
      if (decoded) {
        memoryProfileCache = decoded;
        return decoded;
      }
    }
  } catch {
    // ignore URL parse issues in opaque iframe origins
  }
  try {
    const raw = window.localStorage.getItem(CHARACTER_STORAGE_KEY);
    if (!raw) return memoryProfileCache;
    const parsed = JSON.parse(raw) as Partial<CharacterProfile>;
    const clean = sanitizeCharacterProfile(parsed);
    memoryProfileCache = clean;
    return clean;
  } catch {
    return memoryProfileCache;
  }
}

export function saveCharacterProfile(profile: CharacterProfile): CharacterProfile {
  const clean = sanitizeCharacterProfile(profile);
  memoryProfileCache = clean;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(clean));
    } catch {
      // Safe no-op in strict sandboxed NFT iframes; memoryProfileCache retains session state
    }
  }
  return clean;
}
