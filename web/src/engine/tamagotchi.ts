/**
 * Cozy, positive Tamagotchi Companion Mechanics for each NFT's 3D Cat / Dog pet.
 * Keeping your pet fed, happy, and playful directly accelerates protein folding
 * speed and coin mining output, and earns playable Lab Sparks that work smoothly
 * both in demo mode and while connected to Base Sepolia / Ethereum Mainnet.
 */

export type PetAccessory =
  | "auto"
  | "bowtie"
  | "beret"
  | "goggles"
  | "halo"
  | "crown"
  | "scarf"
  | "beanie"
  | "flower"
  | "wizard"
  | "shades"
  | "bandana"
  | "none";

export type PetOutfitId =
  | "none"
  | "sweater"
  | "labcoat"
  | "hoodie"
  | "raincoat"
  | "cape"
  | "tutu"
  | "puffer";

export type PetBackGearId = "none" | "wings" | "backpack" | "ribbon";

export const PET_ACCESSORY_ORDER: readonly PetAccessory[] = [
  "auto",
  "bowtie",
  "beret",
  "goggles",
  "halo",
  "crown",
  "scarf",
  "beanie",
  "flower",
  "wizard",
  "shades",
  "bandana",
  "none"
];

export const PET_ACCESSORY_LABELS: Record<PetAccessory, string> = {
  auto: "Auto",
  bowtie: "Bowtie",
  beret: "Beret",
  goggles: "Goggles",
  halo: "Halo",
  crown: "Crown",
  scarf: "Knit Scarf",
  beanie: "Pom Beanie",
  flower: "Blossom",
  wizard: "Wizard Hat",
  shades: "Tiny Shades",
  bandana: "Bandana",
  none: "None"
};

export const PET_OUTFIT_OPTIONS: ReadonlyArray<{ id: PetOutfitId; label: string }> = [
  { id: "none", label: "Natural Fur" },
  { id: "sweater", label: "Knit Sweater" },
  { id: "labcoat", label: "Mini Lab Coat" },
  { id: "hoodie", label: "Cozy Hoodie" },
  { id: "raincoat", label: "Raincoat" },
  { id: "cape", label: "Star Cape" },
  { id: "tutu", label: "Cloud Tutu" },
  { id: "puffer", label: "Puffer Vest" }
];

export const PET_BACK_GEAR_OPTIONS: ReadonlyArray<{ id: PetBackGearId; label: string }> = [
  { id: "none", label: "None" },
  { id: "wings", label: "Fairy Wings" },
  { id: "backpack", label: "Treat Pack" },
  { id: "ribbon", label: "Silk Bow" }
];

export const PET_COLOR_SWATCHES: ReadonlyArray<{ id: string; label: string; hex: string }> = [
  { id: "rose", label: "Rose Pink", hex: "#f472b6" },
  { id: "sky", label: "Sky Blue", hex: "#38bdf8" },
  { id: "mint", label: "Mint Sage", hex: "#10b981" },
  { id: "lilac", label: "Lilac Mist", hex: "#a78bfa" },
  { id: "pearl", label: "Pearl White", hex: "#f8fafd" },
  { id: "slate", label: "Silver Slate", hex: "#64748b" },
  { id: "butter", label: "Buttercup", hex: "#fbbf24" },
  { id: "sakura", label: "Sakura Blush", hex: "#f9a8d4" }
];

export interface CompanionVitals {
  energy: number; // 0..100 (Food)
  mood: number; // 0..100 (Happy)
  curiosity: number; // 0..100 (Play)
  level: number;
  careStreak: number;
  dailyStreak: number;
  lastCareDay: string; // YYYY-MM-DD
  petName: string;
  accessory: PetAccessory;
  outfit?: PetOutfitId;
  backGear?: PetBackGearId;
  outfitColor?: string;
  sleeping: boolean;
  lastUpdatedMs: number;
}

export type TamagotchiAction = "feed" | "pet" | "play";

const STORAGE_PREFIX = "alchemia_tama_v2_";
const SPARKS_STORAGE_KEY = "alchemia_lab_sparks_v1";

function todayKey(nowMs = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function dayDiff(prevDay: string, nextDay: string): number {
  if (!prevDay || !nextDay) return 0;
  const a = Date.parse(`${prevDay}T00:00:00Z`);
  const b = Date.parse(`${nextDay}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

export function loadLabSparks(): number {
  if (typeof window === "undefined") return 25;
  try {
    const raw = window.localStorage.getItem(SPARKS_STORAGE_KEY);
    if (raw === null) return 25;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 25;
  } catch {
    return 25;
  }
}

export function saveLabSparks(sparks: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SPARKS_STORAGE_KEY, String(Math.max(0, Math.round(sparks))));
  } catch {
    // ignore storage limits
  }
}

export function loadCompanionVitals(tokenId: number, nowMs = Date.now()): CompanionVitals {
  const fallback: CompanionVitals = {
    energy: 82,
    mood: 86,
    curiosity: 78,
    level: 1,
    careStreak: 1,
    dailyStreak: 1,
    lastCareDay: todayKey(nowMs),
    petName: "",
    accessory: "auto",
    outfit: "none",
    backGear: "none",
    outfitColor: "#f472b6",
    sleeping: false,
    lastUpdatedMs: nowMs
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw =
      window.localStorage.getItem(`${STORAGE_PREFIX}${tokenId}`) ||
      window.localStorage.getItem(`alchemia_tama_v1_${tokenId}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<CompanionVitals>;
    return applyGentleDecay(
      {
        ...fallback,
        ...parsed
      },
      nowMs
    );
  } catch {
    return fallback;
  }
}

export function saveCompanionVitals(tokenId: number, vitals: CompanionVitals) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${tokenId}`, JSON.stringify(vitals));
  } catch {
    // ignore
  }
}

/**
 * Gentle, cozy time decay (pets never die—they just get sleepy until you visit again).
 */
export function applyGentleDecay(v: CompanionVitals, nowMs = Date.now()): CompanionVitals {
  // Classic cozy Tamagotchi sleep: napping pauses vitals decay so your pet rests peacefully!
  if (v.sleeping) {
    return { ...v, lastUpdatedMs: nowMs };
  }
  const hoursElapsed = Math.max(0, (nowMs - v.lastUpdatedMs) / 3600000);
  if (hoursElapsed < 0.01) return v;

  return {
    ...v,
    energy: Math.max(18, Math.round(v.energy - hoursElapsed * 4.2)),
    mood: Math.max(22, Math.round(v.mood - hoursElapsed * 3.5)),
    curiosity: Math.max(20, Math.round(v.curiosity - hoursElapsed * 3.0)),
    lastUpdatedMs: nowMs
  };
}

export function applyTamagotchiAction(
  current: CompanionVitals,
  action: TamagotchiAction,
  nowMs = Date.now()
): CompanionVitals {
  const next = applyGentleDecay(current, nowMs);
  next.sleeping = false;

  if (action === "feed") {
    next.energy = Math.min(100, next.energy + 28);
    next.mood = Math.min(100, next.mood + 10);
  } else if (action === "pet") {
    next.mood = Math.min(100, next.mood + 26);
    next.curiosity = Math.min(100, next.curiosity + 8);
  } else {
    next.curiosity = Math.min(100, next.curiosity + 30);
    next.mood = Math.min(100, next.mood + 16);
    next.energy = Math.max(15, next.energy - 6);
  }

  const today = todayKey(nowMs);
  const diff = dayDiff(next.lastCareDay, today);
  if (diff === 1) {
    next.dailyStreak = (next.dailyStreak || 1) + 1;
  } else if (diff > 1) {
    next.dailyStreak = 1;
  }
  next.lastCareDay = today;

  next.careStreak += 1;
  next.level = 1 + Math.floor(next.careStreak / 6);
  next.lastUpdatedMs = nowMs;
  return next;
}

export function setCompanionPetName(current: CompanionVitals, rawName: string): CompanionVitals {
  const cleaned = rawName.trim().slice(0, 22);
  return { ...current, petName: cleaned };
}

export function toggleCompanionSleep(current: CompanionVitals, nowMs = Date.now()): CompanionVitals {
  const decayed = applyGentleDecay(current, nowMs);
  return {
    ...decayed,
    sleeping: !decayed.sleeping,
    lastUpdatedMs: nowMs
  };
}

export function cycleCompanionAccessory(current: CompanionVitals): CompanionVitals {
  const idx = PET_ACCESSORY_ORDER.indexOf(current.accessory || "auto");
  const next = PET_ACCESSORY_ORDER[(idx + 1) % PET_ACCESSORY_ORDER.length];
  return { ...current, accessory: next };
}

export function setCompanionAccessory(
  current: CompanionVitals,
  accessory: PetAccessory
): CompanionVitals {
  return { ...current, accessory };
}

export function setCompanionOutfit(
  current: CompanionVitals,
  outfit: PetOutfitId
): CompanionVitals {
  return { ...current, outfit };
}

export function setCompanionBackGear(
  current: CompanionVitals,
  backGear: PetBackGearId
): CompanionVitals {
  return { ...current, backGear };
}

export function setCompanionOutfitColor(
  current: CompanionVitals,
  outfitColor: string
): CompanionVitals {
  const clean = /^#[0-9a-fA-F]{6}$/.test(outfitColor) ? outfitColor : "#f472b6";
  return { ...current, outfitColor: clean };
}

export function randomizeCompanionWardrobe(current: CompanionVitals): CompanionVitals {
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const outfits = PET_OUTFIT_OPTIONS.filter((o) => o.id !== "none");
  const hats = PET_ACCESSORY_ORDER.filter((a) => a !== "none" && a !== "auto");
  return {
    ...current,
    outfit: pick(outfits).id,
    accessory: pick(hats),
    backGear: pick(PET_BACK_GEAR_OPTIONS).id,
    outfitColor: pick(PET_COLOR_SWATCHES).hex
  };
}

export function companionAverageScore(v: CompanionVitals): number {
  return Math.round((v.energy + v.mood + v.curiosity) / 3);
}

export function companionBoostMultiplier(v: CompanionVitals): number {
  const avg = companionAverageScore(v);
  // Up to +40% boost to real folding compute & coin mining speed!
  return Number((1 + (avg / 100) * 0.4).toFixed(2));
}

export function companionMoodLabel(v: CompanionVitals): string {
  if (v.sleeping) return "Napping";
  const avg = companionAverageScore(v);
  if (avg >= 85) return "Playful";
  if (avg >= 62) return "Happy";
  if (avg >= 40) return "Calm";
  return "Sleepy";
}
