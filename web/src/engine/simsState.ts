/**
 * Sims-Style Interactive Needs, Dynamic Moods & Moodlets, Social Relationships,
 * Architectural Decor Customization, Guestbook & Contextual Radial Pie Menu Definitions.
 */

import { PERSONALITY_TRAITS, type PersonalityTraitId } from "./characterConfig";
import { SeededRNG } from "./prng";

export type FloorStyleId = "terrazzo" | "travertine" | "basalt" | "marble";
export type PatioDecorId = "bonsai" | "fountain" | "prism" | "lanterns";

export interface LabDecorConfig {
  floorStyle: FloorStyleId;
  patioDecor: PatioDecorId;
}

export interface FloorStyleOption {
  id: FloorStyleId;
  label: string;
  swatch: string;
  tint: string;
}

export interface PatioDecorOption {
  id: PatioDecorId;
  label: string;
  desc: string;
}

export const FLOOR_STYLES: readonly FloorStyleOption[] = [
  { id: "terrazzo", label: "Alabaster", swatch: "#f4f7fb", tint: "#f4f7fb" },
  { id: "travertine", label: "Warm Stone", swatch: "#ebe3d5", tint: "#f2eadc" },
  { id: "basalt", label: "Slate", swatch: "#64748b", tint: "#94a3b8" },
  { id: "marble", label: "Rose Quartz", swatch: "#f5e6ec", tint: "#f8ebf0" }
];

export const PATIO_DECORS: readonly PatioDecorOption[] = [
  { id: "bonsai", label: "Ceramic Bonsai", desc: "Sculpted silver-leaf studio planter" },
  { id: "fountain", label: "Zen Basin", desc: "Tiered alabaster reflecting fountain" },
  { id: "prism", label: "Prism Totem", desc: "Levitating crystal obelisk sculpture" },
  { id: "lanterns", label: "Glass Lanterns", desc: "Warm architectural patio glow bollards" }
];

export interface SimsVibes {
  energy: number; // 0..100 (Recharged by Bench / Espresso / Power Rest)
  focus: number;  // 0..100 (Boosted by Folding / Microscope / Collaborating)
  social: number; // 0..100 (Boosted by Chatting / Visiting / Petting / Sparks)
  fun: number;    // 0..100 (Boosted by Jokes / Playing / Proton Catch / Exploring)
}

export type SimsMoodName =
  | "Inspired"
  | "Focused"
  | "Energized"
  | "Playful"
  | "Social"
  | "Relaxed"
  | "Drowsy";

export interface SimsMoodVisual {
  name: SimsMoodName;
  plumbobHex: string;
  glowHex: string;
  tagline: string;
}

export interface SimsMoodlet {
  id: string;
  label: string;
  mood: SimsMoodName;
  source: string;
  expiresAtMs: number;
}

export const SIMS_MOOD_VISUALS: Record<SimsMoodName, SimsMoodVisual> = {
  Inspired: {
    name: "Inspired",
    plumbobHex: "#10b981",
    glowHex: "#6ee7b7",
    tagline: "Breakthrough ideas sparkling!"
  },
  Focused: {
    name: "Focused",
    plumbobHex: "#38bdf8",
    glowHex: "#bae6fd",
    tagline: "Locked into molecular precision"
  },
  Energized: {
    name: "Energized",
    plumbobHex: "#6366f1",
    glowHex: "#c7d2fe",
    tagline: "Charged up & ready to explore"
  },
  Playful: {
    name: "Playful",
    plumbobHex: "#a855f7",
    glowHex: "#e9d5ff",
    tagline: "Lighthearted & cracking lab jokes"
  },
  Social: {
    name: "Social",
    plumbobHex: "#f472b6",
    glowHex: "#fbcfe8",
    tagline: "Feeling connected with neighbors"
  },
  Relaxed: {
    name: "Relaxed",
    plumbobHex: "#34d399",
    glowHex: "#a7f3d0",
    tagline: "Peaceful sunlit studio flow"
  },
  Drowsy: {
    name: "Drowsy",
    plumbobHex: "#f59e0b",
    glowHex: "#fde68a",
    tagline: "Could use espresso or bench rest"
  }
};

export interface MoodShiftAction {
  id: string;
  mood: SimsMoodName;
  label: string;
  moodletLabel: string;
  vibeDelta: Partial<SimsVibes>;
  emote: "wave" | "spin" | "hop";
}

export const MOOD_SHIFT_ACTIONS: readonly MoodShiftAction[] = [
  {
    id: "shift-inspired",
    mood: "Inspired",
    label: "Eureka Sketch",
    moodletLabel: "Creative Spark",
    vibeDelta: { focus: 12, fun: 10 },
    emote: "hop"
  },
  {
    id: "shift-focused",
    mood: "Focused",
    label: "Deep Focus",
    moodletLabel: "In The Zone",
    vibeDelta: { focus: 20 },
    emote: "wave"
  },
  {
    id: "shift-energized",
    mood: "Energized",
    label: "Power Stretch",
    moodletLabel: "Pumped Up",
    vibeDelta: { energy: 20, fun: 6 },
    emote: "hop"
  },
  {
    id: "shift-playful",
    mood: "Playful",
    label: "Silly Spin",
    moodletLabel: "Goofy Vibes",
    vibeDelta: { fun: 24, social: 6 },
    emote: "spin"
  },
  {
    id: "shift-social",
    mood: "Social",
    label: "Friendly Vibe",
    moodletLabel: "Warm & Welcoming",
    vibeDelta: { social: 18, fun: 8 },
    emote: "wave"
  },
  {
    id: "shift-relaxed",
    mood: "Relaxed",
    label: "Zen Breath",
    moodletLabel: "Serene Calm",
    vibeDelta: { energy: 14, focus: 8 },
    emote: "wave"
  }
];

export type RelationshipTier =
  | "Stranger"
  | "Acquaintance"
  | "Lab Buddy"
  | "Good Friend"
  | "Best Friend"
  | "Research Soulmate";

export interface RelationshipTierInfo {
  tier: RelationshipTier;
  color: string;
  minScore: number;
  nextScore: number | null;
}

export const RELATIONSHIP_TIERS: readonly RelationshipTierInfo[] = [
  { tier: "Stranger", color: "#94a3b8", minScore: 0, nextScore: 15 },
  { tier: "Acquaintance", color: "#38bdf8", minScore: 15, nextScore: 35 },
  { tier: "Lab Buddy", color: "#10b981", minScore: 35, nextScore: 55 },
  { tier: "Good Friend", color: "#6366f1", minScore: 55, nextScore: 75 },
  { tier: "Best Friend", color: "#f472b6", minScore: 75, nextScore: 90 },
  { tier: "Research Soulmate", color: "#f59e0b", minScore: 90, nextScore: null }
];

export function getRelationshipTier(score: number): RelationshipTierInfo {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  for (let i = RELATIONSHIP_TIERS.length - 1; i >= 0; i--) {
    if (clamped >= RELATIONSHIP_TIERS[i].minScore) return RELATIONSHIP_TIERS[i];
  }
  return RELATIONSHIP_TIERS[0];
}

export interface StoredNeighborRelation {
  tokenId: number;
  score: number;
  interactions: number;
  mood?: SimsMoodName;
  activity?: string;
  lastInteractionMs: number;
}

export interface NeighborSimsStatus {
  tokenId: number;
  trait: PersonalityTraitId;
  traitLabel: string;
  mood: SimsMoodName;
  plumbobHex: string;
  activity: string;
  score: number;
  tier: RelationshipTier;
  tierColor: string;
  nextTierScore: number | null;
  interactions: number;
}

export type NeighborSocialAction =
  | "chat"
  | "joke"
  | "spark"
  | "collaborate"
  | "toast"
  | "visit"
  | "guestbook";

export type SimsObjectTarget =
  | { kind: "pet"; label: string; worldX: number; worldZ: number }
  | { kind: "flask"; label: string; worldX: number; worldZ: number }
  | { kind: "bench"; label: string; worldX: number; worldZ: number }
  | { kind: "espresso"; label: string; worldX: number; worldZ: number }
  | { kind: "microscope"; label: string; worldX: number; worldZ: number }
  | { kind: "harvester"; label: string; worldX: number; worldZ: number }
  | { kind: "player"; label: string; worldX: number; worldZ: number }
  | { kind: "fountain"; label: string; worldX: number; worldZ: number }
  | { kind: "neighbor-lab"; label: string; tokenId: number; worldX: number; worldZ: number }
  | { kind: "neighbor-npc"; label: string; tokenId: number; npcName: string; worldX: number; worldZ: number }
  | { kind: "visiting-host"; label: string; tokenId: number; hostName: string; worldX: number; worldZ: number }
  | { kind: "blueprint-lot"; label: string; lotNumber: number; worldX: number; worldZ: number };

export interface SimsPieAction {
  id: string;
  label: string;
  sublabel?: string;
  accent: string;
}

export interface LabGuestbookEntry {
  id: string;
  authorName: string;
  authorTitle: string;
  message: string;
  accent: string;
  timestampMs: number;
}

const DECOR_STORAGE_PREFIX = "alchemia_lab_decor_v1_";
const memoryDecorMap = new Map<number, LabDecorConfig>();

export function defaultLabDecor(): LabDecorConfig {
  return { floorStyle: "terrazzo", patioDecor: "bonsai" };
}

export function deriveNeighborLabDecor(seed: string): LabDecorConfig {
  const rng = new SeededRNG(seed, 4123);
  const floorStyle = FLOOR_STYLES[Math.floor(rng.next() * FLOOR_STYLES.length)].id;
  const patioDecor = PATIO_DECORS[Math.floor(rng.next() * PATIO_DECORS.length)].id;
  return { floorStyle, patioDecor };
}

export function loadLabDecor(tokenId: number, fallbackSeed?: string): LabDecorConfig {
  const fallback =
    memoryDecorMap.get(tokenId) ||
    (fallbackSeed ? deriveNeighborLabDecor(fallbackSeed) : defaultLabDecor());
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(`${DECOR_STORAGE_PREFIX}${tokenId}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<LabDecorConfig>;
    const floorStyle = FLOOR_STYLES.some((f) => f.id === parsed.floorStyle)
      ? (parsed.floorStyle as FloorStyleId)
      : "terrazzo";
    const patioDecor = PATIO_DECORS.some((p) => p.id === parsed.patioDecor)
      ? (parsed.patioDecor as PatioDecorId)
      : "bonsai";
    const clean = { floorStyle, patioDecor };
    memoryDecorMap.set(tokenId, clean);
    return clean;
  } catch {
    return fallback;
  }
}

export function saveLabDecor(tokenId: number, decor: LabDecorConfig): LabDecorConfig {
  memoryDecorMap.set(tokenId, decor);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(`${DECOR_STORAGE_PREFIX}${tokenId}`, JSON.stringify(decor));
    } catch {
      // safe in sandboxed NFT iframes
    }
  }
  return decor;
}

export function initialSimsVibes(): SimsVibes {
  return { energy: 84, focus: 78, social: 80, fun: 82 };
}

export function applySimsVibeDelta(
  current: SimsVibes,
  delta: Partial<SimsVibes>
): SimsVibes {
  const clamp = (v: number) => Math.max(12, Math.min(100, Math.round(v)));
  return {
    energy: clamp(current.energy + (delta.energy ?? 0)),
    focus: clamp(current.focus + (delta.focus ?? 0)),
    social: clamp(current.social + (delta.social ?? 0)),
    fun: clamp(current.fun + (delta.fun ?? 0))
  };
}

/**
 * Computes iconic Sims Plumbob crystal color & mood label from Researcher Needs + Active Moodlet.
 */
export function computeSimsMood(
  vibes: SimsVibes,
  activeMoodlet?: SimsMoodlet | null,
  nowMs = Date.now()
): SimsMoodVisual {
  if (vibes.energy < 32) {
    return SIMS_MOOD_VISUALS.Drowsy;
  }
  if (activeMoodlet && activeMoodlet.expiresAtMs > nowMs) {
    return SIMS_MOOD_VISUALS[activeMoodlet.mood] || SIMS_MOOD_VISUALS.Inspired;
  }
  const avg = (vibes.energy + vibes.focus + vibes.social + vibes.fun) / 4;
  if (avg >= 86) return SIMS_MOOD_VISUALS.Inspired;
  if (vibes.fun >= vibes.focus && vibes.fun >= vibes.social && vibes.fun >= 78) {
    return SIMS_MOOD_VISUALS.Playful;
  }
  if (vibes.focus >= vibes.social && vibes.focus >= 75) return SIMS_MOOD_VISUALS.Focused;
  if (vibes.social >= 78) return SIMS_MOOD_VISUALS.Social;
  if (vibes.energy >= 82) return SIMS_MOOD_VISUALS.Energized;
  return SIMS_MOOD_VISUALS.Relaxed;
}

// ============================================================================
// Neighborhood Sims Statuses & Persistent Relationships (0..100 across 6 tiers)
// ============================================================================
const REL_STORAGE_KEY = "alchemia_sims_relationships_v1";
let memoryRelationships: Record<number, StoredNeighborRelation> | null = null;

const NPC_INITIAL_MOODS: readonly SimsMoodName[] = [
  "Inspired",
  "Focused",
  "Energized",
  "Playful",
  "Social",
  "Relaxed"
];

const NPC_ACTIVITIES_BY_MOOD: Record<SimsMoodName, readonly string[]> = {
  Inspired: ["Sketching new glass wing", "Admiring helix symmetry", "Dreaming up breakthroughs"],
  Focused: ["Analyzing 1L2Y fold", "Calibrating microscope", "Tuning ALCH harvester"],
  Energized: ["Sipping quantum espresso", "Power-walking the canal", "Testing catalyst beams"],
  Playful: ["Tossing glowing protons", "Joking with neighbors", "Playing with lab companion"],
  Social: ["Waving on the boulevard", "Hosting patio visitors", "Sharing science stories"],
  Relaxed: ["Resting by the canal", "Tending ceramic bonsai", "Watching sunlit clouds"],
  Drowsy: ["Taking a studio breather", "Brewing decaf elixir", "Dozing on terrazzo bench"]
};

export function loadRelationshipsMap(): Record<number, StoredNeighborRelation> {
  if (memoryRelationships) return { ...memoryRelationships };
  if (typeof window === "undefined") {
    memoryRelationships = {};
    return {};
  }
  try {
    const raw = window.localStorage.getItem(REL_STORAGE_KEY);
    if (!raw) {
      memoryRelationships = {};
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, StoredNeighborRelation>;
    const clean: Record<number, StoredNeighborRelation> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const id = Number(k);
      if (Number.isFinite(id) && v && typeof v.score === "number") {
        clean[id] = {
          tokenId: id,
          score: Math.max(0, Math.min(100, Math.round(v.score))),
          interactions: Math.max(0, Math.round(v.interactions || 0)),
          mood: v.mood && SIMS_MOOD_VISUALS[v.mood] ? v.mood : undefined,
          activity: typeof v.activity === "string" ? v.activity : undefined,
          lastInteractionMs: typeof v.lastInteractionMs === "number" ? v.lastInteractionMs : Date.now()
        };
      }
    }
    memoryRelationships = clean;
    return { ...clean };
  } catch {
    memoryRelationships = {};
    return {};
  }
}

export function saveRelationshipsMap(map: Record<number, StoredNeighborRelation>) {
  memoryRelationships = { ...map };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(REL_STORAGE_KEY, JSON.stringify(map));
    } catch {
      // safe inside sandboxed NFT iframes
    }
  }
}

export function getNeighborSimsStatus(
  tokenId: number,
  seed: string,
  relationsMap: Record<number, StoredNeighborRelation>
): NeighborSimsStatus {
  const rng = new SeededRNG(seed, 5201 + tokenId);
  const traitOpt = PERSONALITY_TRAITS[Math.floor(rng.next() * PERSONALITY_TRAITS.length)];
  const baseMood = NPC_INITIAL_MOODS[Math.floor(rng.next() * NPC_INITIAL_MOODS.length)];
  const stored = relationsMap[tokenId];
  const mood = stored?.mood || baseMood;
  const activities = NPC_ACTIVITIES_BY_MOOD[mood];
  const activity = stored?.activity || activities[Math.floor(rng.next() * activities.length)];
  const score = stored?.score ?? 0;
  const tierInfo = getRelationshipTier(score);
  const moodVis = SIMS_MOOD_VISUALS[mood];

  return {
    tokenId,
    trait: traitOpt.id,
    traitLabel: traitOpt.label,
    mood,
    plumbobHex: moodVis.plumbobHex,
    activity,
    score,
    tier: tierInfo.tier,
    tierColor: tierInfo.color,
    nextTierScore: tierInfo.nextScore,
    interactions: stored?.interactions ?? 0
  };
}

export interface NeighborSocialOutcome {
  nextMap: Record<number, StoredNeighborRelation>;
  status: NeighborSimsStatus;
  delta: number;
  leveledUp: boolean;
  previousTier: RelationshipTier;
  playerMood: SimsMoodName;
  playerVibeDelta: Partial<SimsVibes>;
  moodletLabel: string;
}

const SOCIAL_ACTION_CONFIG: Record<
  NeighborSocialAction,
  {
    delta: number;
    npcMood: SimsMoodName;
    npcActivity: string;
    playerMood: SimsMoodName;
    moodletLabel: string;
    vibeDelta: Partial<SimsVibes>;
  }
> = {
  chat: {
    delta: 8,
    npcMood: "Social",
    npcActivity: "Chatting warmly with you",
    playerMood: "Social",
    moodletLabel: "Friendly Chat",
    vibeDelta: { social: 14, fun: 6 }
  },
  joke: {
    delta: 11,
    npcMood: "Playful",
    npcActivity: "Laughing at your science pun",
    playerMood: "Playful",
    moodletLabel: "Shared a Laugh",
    vibeDelta: { fun: 20, social: 12 }
  },
  spark: {
    delta: 14,
    npcMood: "Inspired",
    npcActivity: "Energized by your research spark",
    playerMood: "Inspired",
    moodletLabel: "Generous Spark",
    vibeDelta: { social: 16, focus: 8, fun: 8 }
  },
  collaborate: {
    delta: 15,
    npcMood: "Focused",
    npcActivity: "Co-folding a protein helix",
    playerMood: "Focused",
    moodletLabel: "Lab Teamwork",
    vibeDelta: { focus: 20, social: 12 }
  },
  toast: {
    delta: 12,
    npcMood: "Relaxed",
    npcActivity: "Toasting golden elixir together",
    playerMood: "Relaxed",
    moodletLabel: "Elixir Toast",
    vibeDelta: { energy: 14, social: 16, fun: 10 }
  },
  visit: {
    delta: 6,
    npcMood: "Social",
    npcActivity: "Welcoming you to their home",
    playerMood: "Social",
    moodletLabel: "Warm Welcome",
    vibeDelta: { social: 12, fun: 8 }
  },
  guestbook: {
    delta: 10,
    npcMood: "Inspired",
    npcActivity: "Reading your guestbook note",
    playerMood: "Inspired",
    moodletLabel: "Kind Words",
    vibeDelta: { social: 14, fun: 6 }
  }
};

export function applyNeighborSocialAction(
  relationsMap: Record<number, StoredNeighborRelation>,
  tokenId: number,
  seed: string,
  action: NeighborSocialAction,
  playerTrait?: PersonalityTraitId
): NeighborSocialOutcome {
  const prevStatus = getNeighborSimsStatus(tokenId, seed, relationsMap);
  const cfg = SOCIAL_ACTION_CONFIG[action];
  const outgoingBonus = playerTrait === "outgoing" ? 3 : 0;
  const delta = cfg.delta + outgoingBonus;
  const nextScore = Math.min(100, prevStatus.score + delta);

  const nextMap: Record<number, StoredNeighborRelation> = {
    ...relationsMap,
    [tokenId]: {
      tokenId,
      score: nextScore,
      interactions: prevStatus.interactions + 1,
      mood: cfg.npcMood,
      activity: cfg.npcActivity,
      lastInteractionMs: Date.now()
    }
  };
  saveRelationshipsMap(nextMap);

  const nextStatus = getNeighborSimsStatus(tokenId, seed, nextMap);
  return {
    nextMap,
    status: nextStatus,
    delta,
    leveledUp: nextStatus.tier !== prevStatus.tier,
    previousTier: prevStatus.tier,
    playerMood: cfg.playerMood,
    playerVibeDelta: cfg.vibeDelta,
    moodletLabel: cfg.moodletLabel
  };
}

/**
 * Returns contextual Sims-style Radial Pie Menu actions for any clicked 3D entity in the world.
 */
export function getSimsPieActions(
  target: SimsObjectTarget,
  options?: { petSleeping?: boolean; standalone?: boolean }
): SimsPieAction[] {
  switch (target.kind) {
    case "pet":
      return [
        { id: "pet-cuddle", label: "Pet", sublabel: "+1 spark", accent: "#f472b6" },
        { id: "pet-feed", label: "Drop Treats", sublabel: options?.standalone ? "Yum" : "5 sparks", accent: "#10b981" },
        { id: "pet-play", label: "Toss Ball", sublabel: "+2 sparks", accent: "#38bdf8" },
        {
          id: "pet-nap",
          label: options?.petSleeping ? "Wake Up" : "Cozy Nap",
          accent: "#8b5cf6"
        },
        { id: "pet-style", label: "Dress Up", accent: "#f59e0b" },
        { id: "open-pet", label: "Pet Panel", accent: "#64748b" }
      ];
    case "flask":
      return [
        { id: "fold-wiggle", label: "Wiggle Fold", sublabel: "+1 spark", accent: "#38bdf8" },
        { id: "fold-shake", label: "Shake Chain", sublabel: "+1 spark", accent: "#6366f1" },
        { id: "fold-bury", label: "Bury Core", sublabel: "+1 spark", accent: "#10b981" },
        { id: "flask-pulse", label: "Catalytic Pulse", accent: "#f472b6" },
        { id: "open-research", label: "Folding Lab", accent: "#475569" }
      ];
    case "bench":
      return [
        { id: "bench-sit", label: "Sit & Rest", sublabel: "+Energy", accent: "#10b981" },
        { id: "bench-meditate", label: "Stargaze Fold", sublabel: "+Focus", accent: "#38bdf8" },
        { id: "open-builder", label: "Decorate Patio", accent: "#8b5cf6" }
      ];
    case "espresso":
      return [
        { id: "espresso-brew", label: "Brew Elixir", sublabel: "Energized!", accent: "#f59e0b" },
        { id: "espresso-share", label: "Toast Science", sublabel: "+Social", accent: "#f472b6" },
        { id: "open-console", label: "Sims Status", accent: "#64748b" }
      ];
    case "microscope":
      return [
        { id: "micro-analyze", label: "Analyze Fold", sublabel: "Focused!", accent: "#38bdf8" },
        { id: "fold-wiggle", label: "Wiggle", sublabel: "+1 spark", accent: "#10b981" },
        { id: "open-research", label: "Open Workbench", accent: "#6366f1" }
      ];
    case "harvester":
      return [
        { id: "mine-overclock", label: "Spin Blades", sublabel: "+Focus", accent: "#6366f1" },
        { id: "open-mining", label: "Claim ALCH", accent: "#f59e0b" },
        { id: "open-builder", label: "Add Rooms", accent: "#10b981" }
      ];
    case "player":
      return [
        { id: "open-moods", label: "Moods & Friends", sublabel: "Change vibe", accent: "#10b981" },
        { id: "emote-wave", label: "Wave", sublabel: "+Social", accent: "#38bdf8" },
        { id: "emote-spin", label: "Silly Twirl", sublabel: "Playful!", accent: "#a855f7" },
        { id: "open-creator", label: "Name & Look", accent: "#8b5cf6" },
        { id: "go-home", label: "Return Home", accent: "#64748b" }
      ];
    case "fountain":
      return [
        { id: "fountain-wish", label: "Make Science Wish", sublabel: "Inspired!", accent: "#38bdf8" },
        { id: "fountain-pulse", label: "Light District", sublabel: "+Social", accent: "#f59e0b" },
        { id: "open-neighborhood", label: "Town Map", accent: "#6366f1" }
      ];
    case "neighbor-lab":
      return [
        { id: "neighbor-enter", label: "Enter Home", sublabel: "Visit inside", accent: "#10b981" },
        { id: "neighbor-visit", label: "Walk Outside", accent: "#38bdf8" },
        { id: "neighbor-spark", label: "Gift Spark", sublabel: "+14 Friend", accent: "#f59e0b" },
        { id: "neighbor-inspect", label: "Inspect Lab", accent: "#6366f1" },
        { id: "neighbor-chat", label: "Say Hello", sublabel: "+8 Friend", accent: "#f472b6" }
      ];
    case "neighbor-npc":
      return [
        { id: "neighbor-chat", label: "Friendly Chat", sublabel: "+8 Friend", accent: "#f472b6" },
        { id: "neighbor-joke", label: "Tell Joke", sublabel: "+11 Playful", accent: "#a855f7" },
        { id: "neighbor-spark", label: "Gift Spark", sublabel: "+14 Friend", accent: "#f59e0b" },
        { id: "neighbor-enter", label: "Enter Home", sublabel: "Visit inside", accent: "#10b981" },
        { id: "neighbor-inspect", label: "View Status", accent: "#6366f1" }
      ];
    case "visiting-host":
      return [
        { id: "host-chat", label: "Friendly Chat", sublabel: "+8 Friend", accent: "#f472b6" },
        { id: "host-joke", label: "Tell Joke", sublabel: "+11 Playful", accent: "#a855f7" },
        { id: "host-spark", label: "Gift Spark", sublabel: "+14 Friend", accent: "#f59e0b" },
        { id: "host-fold", label: "Help Fold", sublabel: "+15 Friend", accent: "#38bdf8" },
        { id: "host-guestbook", label: "Sign Guestbook", sublabel: "+10 Friend", accent: "#10b981" },
        { id: "return-home", label: "Return Home", accent: "#64748b" }
      ];
    case "blueprint-lot":
      return [
        { id: "lot-preview-mint", label: "Build Next Mint", sublabel: "+1 Lab", accent: "#10b981" },
        { id: "lot-mint-wave", label: "Mint Wave (+5)", sublabel: "Grow town!", accent: "#38bdf8" },
        { id: "open-neighborhood", label: "Town Map", accent: "#6366f1" }
      ];
  }
}

const GUESTBOOK_PREFIX = "alchemia_lab_guestbook_v1_";
const memoryGuestbookMap = new Map<number, LabGuestbookEntry[]>();

const SEEDED_GUESTBOOK_NOTES = [
  "Incredible borosilicate glow! Left a folding boost for your helix.",
  "Stopped by from across the boulevard — your companion is adorable!",
  "Love the sunlit stone finish and golden hour reflection here.",
  "Shared an espresso toast on your patio. Great open-science energy!",
  "Dropped a research spark by the flask — see you at the Community Fountain!"
];

const SEEDED_GUESTBOOK_AUTHORS: ReadonlyArray<{ name: string; title: string; accent: string }> = [
  { name: "Dr. Lin", title: "Bio-Alchemist", accent: "#38bdf8" },
  { name: "Mateo", title: "Lab Architect", accent: "#10b981" },
  { name: "Nadia", title: "Protein Folder", accent: "#f472b6" },
  { name: "Kenji", title: "Quantum Miner", accent: "#6366f1" },
  { name: "Clara", title: "Pet Keeper", accent: "#f59e0b" }
];

function createSeededGuestbookEntries(tokenId: number, seed: string): LabGuestbookEntry[] {
  const rng = new SeededRNG(seed, 8801 + tokenId);
  const a1 = SEEDED_GUESTBOOK_AUTHORS[Math.floor(rng.next() * SEEDED_GUESTBOOK_AUTHORS.length)];
  const a2 =
    SEEDED_GUESTBOOK_AUTHORS[
      (SEEDED_GUESTBOOK_AUTHORS.indexOf(a1) + 1 + Math.floor(rng.next() * 3)) %
        SEEDED_GUESTBOOK_AUTHORS.length
    ];
  const m1 = SEEDED_GUESTBOOK_NOTES[Math.floor(rng.next() * SEEDED_GUESTBOOK_NOTES.length)];
  const m2 =
    SEEDED_GUESTBOOK_NOTES[
      (SEEDED_GUESTBOOK_NOTES.indexOf(m1) + 1 + Math.floor(rng.next() * 3)) %
        SEEDED_GUESTBOOK_NOTES.length
    ];
  const baseNow = Date.now();
  return [
    {
      id: `seed-${tokenId}-1`,
      authorName: a1.name,
      authorTitle: a1.title,
      message: m1,
      accent: a1.accent,
      timestampMs: baseNow - 3600_000 * 3
    },
    {
      id: `seed-${tokenId}-2`,
      authorName: a2.name,
      authorTitle: a2.title,
      message: m2,
      accent: a2.accent,
      timestampMs: baseNow - 3600_000 * 14
    }
  ];
}

export function loadGuestbookEntries(tokenId: number, seed: string): LabGuestbookEntry[] {
  const mem = memoryGuestbookMap.get(tokenId);
  if (mem) return mem;
  const seeded = createSeededGuestbookEntries(tokenId, seed);
  if (typeof window === "undefined") {
    memoryGuestbookMap.set(tokenId, seeded);
    return seeded;
  }
  try {
    const raw = window.localStorage.getItem(`${GUESTBOOK_PREFIX}${tokenId}`);
    if (!raw) {
      memoryGuestbookMap.set(tokenId, seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as LabGuestbookEntry[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      memoryGuestbookMap.set(tokenId, parsed);
      return parsed;
    }
  } catch {
    // safe fallback inside sandboxed NFT iframes
  }
  memoryGuestbookMap.set(tokenId, seeded);
  return seeded;
}

export function addGuestbookEntry(
  tokenId: number,
  seed: string,
  entry: Omit<LabGuestbookEntry, "id" | "timestampMs">
): LabGuestbookEntry[] {
  const cleanMsg = entry.message.trim().slice(0, 140);
  if (!cleanMsg) return loadGuestbookEntries(tokenId, seed);
  const existing = loadGuestbookEntries(tokenId, seed);
  const next: LabGuestbookEntry[] = [
    {
      id: `note-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      authorName: entry.authorName.trim() || "Researcher",
      authorTitle: entry.authorTitle.trim() || "Visitor",
      message: cleanMsg,
      accent: entry.accent || "#5b8def",
      timestampMs: Date.now()
    },
    ...existing
  ].slice(0, 20);
  memoryGuestbookMap.set(tokenId, next);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(`${GUESTBOOK_PREFIX}${tokenId}`, JSON.stringify(next));
    } catch {
      // safe in sandboxed NFT iframes
    }
  }
  return next;
}
