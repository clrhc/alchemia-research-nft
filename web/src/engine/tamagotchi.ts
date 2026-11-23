/**
 * Cozy, positive Tamagotchi Companion Mechanics for each NFT's 3D Cat / Dog pet.
 * Keeping your pet fed, happy, and playful directly accelerates protein folding
 * speed and coin mining output, and earns playable Lab Sparks that work smoothly
 * both in demo mode and while connected to Base Sepolia / Ethereum Mainnet.
 */

export interface CompanionVitals {
  energy: number; // 0..100 (Food)
  mood: number; // 0..100 (Happy)
  curiosity: number; // 0..100 (Play)
  level: number;
  careStreak: number;
  dailyStreak: number;
  lastCareDay: string; // YYYY-MM-DD
  petName: string;
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

export function companionAverageScore(v: CompanionVitals): number {
  return Math.round((v.energy + v.mood + v.curiosity) / 3);
}

export function companionBoostMultiplier(v: CompanionVitals): number {
  const avg = companionAverageScore(v);
  // Up to +40% boost to real folding compute & coin mining speed!
  return Number((1 + (avg / 100) * 0.4).toFixed(2));
}

export function companionMoodLabel(v: CompanionVitals): string {
  const avg = companionAverageScore(v);
  if (avg >= 85) return "Playful";
  if (avg >= 62) return "Happy";
  if (avg >= 40) return "Calm";
  return "Sleepy";
}
