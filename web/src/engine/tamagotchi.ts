/**
 * Cozy, positive Tamagotchi Companion Mechanics for each NFT's 3D Cat / Dog familiar.
 * Keeping your laboratory familiar fed, petted, and playful directly accelerates
 * both open-science protein folding speed and $ALCH coin mining yield!
 */

export interface CompanionVitals {
  energy: number;    // 0..100 (fed via Elixir Treats)
  mood: number;      // 0..100 (boosted via Petting & Playing)
  curiosity: number; // 0..100 (boosted via Playing Proton Catch & Research Discoveries)
  level: number;
  careStreak: number;
  lastUpdatedMs: number;
}

export type TamagotchiAction = "feed" | "pet" | "play";

const STORAGE_PREFIX = "alchemia_tama_v1_";

export function loadCompanionVitals(tokenId: number): CompanionVitals {
  const fallback: CompanionVitals = {
    energy: 82,
    mood: 86,
    curiosity: 78,
    level: 1,
    careStreak: 1,
    lastUpdatedMs: Date.now()
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${tokenId}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as CompanionVitals;
    return applyGentleDecay(parsed);
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
 * Gentle, cozy time decay (companions never die—they just get a bit sleepy until cared for).
 */
export function applyGentleDecay(v: CompanionVitals): CompanionVitals {
  const now = Date.now();
  const hoursElapsed = Math.max(0, (now - v.lastUpdatedMs) / 3600000);
  if (hoursElapsed < 0.01) return v;

  return {
    ...v,
    energy: Math.max(18, Math.round(v.energy - hoursElapsed * 4.5)),
    mood: Math.max(22, Math.round(v.mood - hoursElapsed * 3.8)),
    curiosity: Math.max(20, Math.round(v.curiosity - hoursElapsed * 3.2)),
    lastUpdatedMs: now
  };
}

export function applyTamagotchiAction(
  current: CompanionVitals,
  action: TamagotchiAction
): CompanionVitals {
  const next = applyGentleDecay(current);
  const now = Date.now();

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

  next.careStreak += 1;
  next.level = 1 + Math.floor(next.careStreak / 6);
  next.lastUpdatedMs = now;
  return next;
}

export function companionAverageScore(v: CompanionVitals): number {
  return Math.round((v.energy + v.mood + v.curiosity) / 3);
}

export function companionBoostMultiplier(v: CompanionVitals): number {
  const avg = companionAverageScore(v);
  // Up to +40% boost to real folding compute & $ALCH mining rate!
  return Number((1 + (avg / 100) * 0.4).toFixed(2));
}

export function companionMoodLabel(v: CompanionVitals): string {
  const avg = companionAverageScore(v);
  if (avg >= 82) return "Thriving";
  if (avg >= 55) return "Content";
  return "Sleepy";
}
