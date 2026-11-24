/**
 * Sims-Style Interactive Needs, Dynamic Moods & Moodlets, Social Relationships,
 * Architectural Decor Customization, Guestbook & Contextual Radial Pie Menu Definitions.
 */

import { PERSONALITY_TRAITS, type PersonalityTraitId } from "./characterConfig";
import {
  EXTRA_ROOM_DEFS,
  WALL_STYLES,
  formatFloorLabel,
  sanitizeCustomLayout,
  type CustomLayoutMap,
  type ExtraRoomId,
  type FloorNumber,
  type HouseFloorCount,
  type HouseSizeLevel,
  type MovableItemId,
  type WallStyleId
} from "./homeLayout";
import { SeededRNG } from "./prng";

export type FloorStyleId = "terrazzo" | "travertine" | "basalt" | "marble" | "oak" | "obsidian";
export type PatioDecorId = "bonsai" | "fountain" | "prism" | "lanterns" | "cherry-tree" | "mini-orrery";
export type SeatingStyleId = "bench" | "plush-sofa" | "egg-chair" | "daybed" | "tatami";
export type BarStyleId = "espresso" | "matcha" | "smoothie" | "boba" | "samovar";
export type RugStyleId = "none" | "cloud-rug" | "silver-ring" | "pastel-terrazzo" | "star-weave";
export type HobbyPropId = "none" | "bookshelf" | "aquarium" | "vinyl" | "easel" | "arcade";
export type PlantPackId = "minimal" | "monstera" | "bamboo" | "succulents" | "blossom-vases";
export type LightingFixtureId = "none" | "halo-ring" | "crystal-drops" | "fairy-orbs" | "aurora-arc";

export type UpgradeableStationId = "research" | "mining" | "pet" | "builder" | "lounge";
export type StationUpgradeLevel = 1 | 2 | 3;
export type StationUpgradesMap = Record<UpgradeableStationId, StationUpgradeLevel>;

export interface LabDecorConfig {
  floorStyle: FloorStyleId;
  patioDecor: PatioDecorId;
  seatingStyle: SeatingStyleId;
  barStyle: BarStyleId;
  rugStyle: RugStyleId;
  hobbyProp: HobbyPropId;
  plantPack: PlantPackId;
  lightingFixture: LightingFixtureId;
  stationUpgrades: StationUpgradesMap;
  houseSize: HouseSizeLevel;
  houseFloors: HouseFloorCount;
  hasBasement: boolean;
  wallStyle: WallStyleId;
  extraRooms: ExtraRoomId[];
  customLayout: CustomLayoutMap;
}

export interface FloorStyleOption {
  id: FloorStyleId;
  label: string;
  swatch: string;
  tint: string;
}

export interface FurnishCatalogOption<T extends string = string> {
  id: T;
  label: string;
  desc: string;
  swatch: string;
}

export type PatioDecorOption = FurnishCatalogOption<PatioDecorId>;

export const FLOOR_STYLES: readonly FloorStyleOption[] = [
  { id: "terrazzo", label: "Alabaster", swatch: "#f4f7fb", tint: "#f4f7fb" },
  { id: "travertine", label: "Warm Stone", swatch: "#ebe3d5", tint: "#f2eadc" },
  { id: "basalt", label: "Slate", swatch: "#64748b", tint: "#94a3b8" },
  { id: "marble", label: "Rose Quartz", swatch: "#f5e6ec", tint: "#f8ebf0" },
  { id: "oak", label: "Nordic Oak", swatch: "#e8dfd1", tint: "#f3ece1" },
  { id: "obsidian", label: "Pearl Graphite", swatch: "#475569", tint: "#cbd5e1" }
];

export const SEATING_STYLES: readonly FurnishCatalogOption<SeatingStyleId>[] = [
  { id: "bench", label: "Terrazzo Bench", desc: "Minimalist stone & pearl cushion", swatch: "#e2e8f0" },
  { id: "plush-sofa", label: "Cloud Sofa", desc: "Tufted silver-bouclé loveseat & pillows", swatch: "#f1f5f9" },
  { id: "egg-chair", label: "Glass Egg Pod", desc: "Suspended crystal bubble lounge chair", swatch: "#bae6fd" },
  { id: "daybed", label: "Studio Daybed", desc: "Plush bolster chaise & warm reading lamp", swatch: "#ddd6fe" },
  { id: "tatami", label: "Zen Tatami", desc: "Woven reed mat, floor pillows & tea tray", swatch: "#d1fae5" }
];

export const BAR_STYLES: readonly FurnishCatalogOption<BarStyleId>[] = [
  { id: "espresso", label: "Espresso Bar", desc: "Brushed-chrome quantum elixir brewer", swatch: "#f59e0b" },
  { id: "matcha", label: "Matcha Bar", desc: "Ceramic chawan bowl, whisk & jade glow", swatch: "#10b981" },
  { id: "smoothie", label: "Berry Juicer", desc: "Twin crystal fruit-elixir blenders", swatch: "#f472b6" },
  { id: "boba", label: "Boba Tap Bar", desc: "Pearlescent milk-tea dispenser & straws", swatch: "#c084fc" },
  { id: "samovar", label: "Silver Samovar", desc: "Sculpted titanium tea urn & porcelain cups", swatch: "#94a3b8" }
];

export const HOBBY_PROPS: readonly FurnishCatalogOption<HobbyPropId>[] = [
  { id: "bookshelf", label: "Science Library", desc: "Silver shelving & glowing alchemy tomes", swatch: "#64748b" },
  { id: "aquarium", label: "Jellyfish Tank", desc: "Lit glass cylinder with floating jellies", swatch: "#38bdf8" },
  { id: "vinyl", label: "Vinyl Deck", desc: "Spinning hi-fi turntable & dual speakers", swatch: "#818cf8" },
  { id: "easel", label: "Studio Easel", desc: "Architectural tripod & luminous canvas", swatch: "#f472b6" },
  { id: "arcade", label: "Mini Arcade", desc: "Cutesy silver-glass pixel game cabinet", swatch: "#10b981" },
  { id: "none", label: "Open Nook", desc: "Keep the front-left terrace airy & clear", swatch: "#e2e8f0" }
];

export const RUG_STYLES: readonly FurnishCatalogOption<RugStyleId>[] = [
  { id: "cloud-rug", label: "Cloud Plush", desc: "Scalloped pearl-white tufted lounge rug", swatch: "#f8fafc" },
  { id: "silver-ring", label: "Silver Halo", desc: "Concentric brushed-silver woven circle", swatch: "#cbd5e1" },
  { id: "pastel-terrazzo", label: "Blush Quartz", desc: "Soft rose-and-silver studio oval mat", swatch: "#fce7f3" },
  { id: "star-weave", label: "Celestial Mat", desc: "Subtle star-compass architectural rug", swatch: "#dbeafe" },
  { id: "none", label: "Bare Stone", desc: "Showcase your pure architectural floor", swatch: "#e2e8f0" }
];

export const PATIO_DECORS: readonly PatioDecorOption[] = [
  { id: "bonsai", label: "Ceramic Bonsai", desc: "Sculpted silver-leaf studio planter", swatch: "#10b981" },
  { id: "fountain", label: "Zen Basin", desc: "Tiered alabaster reflecting fountain", swatch: "#38bdf8" },
  { id: "prism", label: "Prism Totem", desc: "Levitating crystal obelisk sculpture", swatch: "#818cf8" },
  { id: "lanterns", label: "Glass Lanterns", desc: "Warm architectural patio glow bollards", swatch: "#fbbf24" },
  { id: "cherry-tree", label: "Sakura Tree", desc: "Blooming cherry canopy & floating petals", swatch: "#f9a8d4" },
  { id: "mini-orrery", label: "Mini Orrery", desc: "Orbiting silver rings & crystal planets", swatch: "#94a3b8" }
];

export const PLANT_PACKS: readonly FurnishCatalogOption<PlantPackId>[] = [
  { id: "minimal", label: "Gallery Minimal", desc: "Open architectural rotunda edges", swatch: "#e2e8f0" },
  { id: "monstera", label: "Monstera Pots", desc: "Lush tropical leaves in ceramic urns", swatch: "#10b981" },
  { id: "bamboo", label: "Zen Bamboo", desc: "Tall frosted-glass bamboo stalk screens", swatch: "#34d399" },
  { id: "succulents", label: "Crystal Domes", desc: "Faceted glass succulent terrariums", swatch: "#38bdf8" },
  { id: "blossom-vases", label: "Blossom Vases", desc: "Sculpted porcelain sakura amphorae", swatch: "#f472b6" }
];

export const LIGHTING_FIXTURES: readonly FurnishCatalogOption<LightingFixtureId>[] = [
  { id: "none", label: "Open Skylight", desc: "Unobstructed sunlit glass atrium", swatch: "#e2e8f0" },
  { id: "halo-ring", label: "Silver Halo", desc: "Suspended brushed-titanium LED ring", swatch: "#cbd5e1" },
  { id: "crystal-drops", label: "Crystal Drops", desc: "Cascading frosted glass prism pendants", swatch: "#bae6fd" },
  { id: "fairy-orbs", label: "Pearl Fireflies", desc: "Orbiting luminous warm glass spheres", swatch: "#fde68a" },
  { id: "aurora-arc", label: "Aurora Arch", desc: "Iridescent prismatic overhead light arc", swatch: "#c4b5fd" }
];

export interface RoomThemePreset {
  id: string;
  label: string;
  swatch: string;
  decor: Pick<
    LabDecorConfig,
    | "floorStyle"
    | "patioDecor"
    | "seatingStyle"
    | "barStyle"
    | "rugStyle"
    | "hobbyProp"
    | "plantPack"
    | "lightingFixture"
    | "wallStyle"
  >;
}

export const ROOM_THEME_PRESETS: readonly RoomThemePreset[] = [
  {
    id: "silver-zen",
    label: "Silver Zen",
    swatch: "#cbd5e1",
    decor: {
      floorStyle: "terrazzo",
      patioDecor: "fountain",
      seatingStyle: "tatami",
      barStyle: "matcha",
      rugStyle: "silver-ring",
      hobbyProp: "aquarium",
      plantPack: "bamboo",
      lightingFixture: "halo-ring",
      wallStyle: "alabaster-glass"
    }
  },
  {
    id: "sakura-cozy",
    label: "Sakura Cozy",
    swatch: "#f9a8d4",
    decor: {
      floorStyle: "oak",
      patioDecor: "cherry-tree",
      seatingStyle: "plush-sofa",
      barStyle: "boba",
      rugStyle: "pastel-terrazzo",
      hobbyProp: "easel",
      plantPack: "blossom-vases",
      lightingFixture: "fairy-orbs",
      wallStyle: "blush-plaster"
    }
  },
  {
    id: "cosmic-atrium",
    label: "Cosmic Lab",
    swatch: "#818cf8",
    decor: {
      floorStyle: "obsidian",
      patioDecor: "mini-orrery",
      seatingStyle: "egg-chair",
      barStyle: "espresso",
      rugStyle: "star-weave",
      hobbyProp: "arcade",
      plantPack: "succulents",
      lightingFixture: "aurora-arc",
      wallStyle: "silver-slate"
    }
  }
];

export interface StationUpgradeTierInfo {
  level: StationUpgradeLevel;
  title: string;
  hardware: string;
  perk: string;
}

export interface StationUpgradeDef {
  id: UpgradeableStationId;
  name: string;
  accent: string;
  tiers: readonly [StationUpgradeTierInfo, StationUpgradeTierInfo, StationUpgradeTierInfo];
}

export const STATION_UPGRADE_DEFS: readonly StationUpgradeDef[] = [
  {
    id: "research",
    name: "Protein Microscope",
    accent: "#38bdf8",
    tiers: [
      {
        level: 1,
        title: "Optical Scope",
        hardware: "Single titanium lens & frosted plate",
        perk: "Base folding analysis"
      },
      {
        level: 2,
        title: "Cryo-EM Dual Array",
        hardware: "Twin glowing cryo-lenses & wide holo arc",
        perk: "+25% Focus from folding"
      },
      {
        level: 3,
        title: "Quantum Helix Lab",
        hardware: "Levitating 3D DNA helix & dual emitters",
        perk: "+50% Focus & +1 spark/fold"
      }
    ]
  },
  {
    id: "mining",
    name: "ALCH Harvester",
    accent: "#6366f1",
    tiers: [
      {
        level: 1,
        title: "Quartz Core",
        hardware: "Single hovering harvester crystal",
        perk: "Base ALCH yield rate"
      },
      {
        level: 2,
        title: "Dual Gyro Core",
        hardware: "Counter-rotating brushed titanium rings",
        perk: "+15% ALCH yield boost"
      },
      {
        level: 3,
        title: "Quantum Prism Crown",
        hardware: "Triple prism crown, beam & orbiting motes",
        perk: "+35% ALCH yield boost"
      }
    ]
  },
  {
    id: "pet",
    name: "Pet Sanctuary",
    accent: "#f472b6",
    tiers: [
      {
        level: 1,
        title: "Porcelain Cushion",
        hardware: "Sunlit patio resting pad",
        perk: "Base companion boost"
      },
      {
        level: 2,
        title: "Cloud Bed & Bowls",
        hardware: "Tufted plush pet cloud & twin ceramic bowls",
        perk: "+0.10x pet lab speed"
      },
      {
        level: 3,
        title: "Silver Cat Tower",
        hardware: "Multi-tier glass perch & dangling star toy",
        perk: "+0.25x pet lab speed"
      }
    ]
  },
  {
    id: "builder",
    name: "Architect Studio",
    accent: "#10b981",
    tiers: [
      {
        level: 1,
        title: "Drafting Pad",
        hardware: "Floor beacon & spatial tools",
        perk: "Full room & decor editor"
      },
      {
        level: 2,
        title: "Blueprint Table",
        hardware: "Frosted-glass CAD desk & glowing floorplan",
        perk: "+5% ALCH & +15% Focus"
      },
      {
        level: 3,
        title: "Holo Town Table",
        hardware: "Spinning 3D Alchemia Town miniature hologram",
        perk: "+12% ALCH & +30% Focus"
      }
    ]
  },
  {
    id: "lounge",
    name: "Comfort Lounge",
    accent: "#a855f7",
    tiers: [
      {
        level: 1,
        title: "Classic Nook",
        hardware: "Seating & refreshment counter",
        perk: "Base Energy & Fun recovery"
      },
      {
        level: 2,
        title: "Aroma Diffuser Table",
        hardware: "Alabaster side table & glowing mist diffuser",
        perk: "+30% Energy & Fun recovery"
      },
      {
        level: 3,
        title: "Aurora Hearth Halo",
        hardware: "Floating glass hearth crystal & silver halo",
        perk: "+60% Energy & Fun recovery"
      }
    ]
  }
];

export function getNextUpgradeCost(level: StationUpgradeLevel): number | null {
  if (level === 1) return 10;
  if (level === 2) return 25;
  return null;
}

export function defaultStationUpgrades(): StationUpgradesMap {
  return { research: 1, mining: 1, pet: 1, builder: 1, lounge: 1 };
}

export interface StationUpgradeBonuses {
  focusMult: number;
  energyFunMult: number;
  miningMult: number;
  petBoostBonus: number;
  extraFoldSpark: number;
  totalUpgrades: number;
}

export function computeStationUpgradeBonuses(upgrades: StationUpgradesMap): StationUpgradeBonuses {
  const focusMult =
    (upgrades.research === 3 ? 1.5 : upgrades.research === 2 ? 1.25 : 1) +
    (upgrades.builder === 3 ? 0.3 : upgrades.builder === 2 ? 0.15 : 0);
  const energyFunMult = upgrades.lounge === 3 ? 1.6 : upgrades.lounge === 2 ? 1.3 : 1;
  const miningMult =
    1 +
    (upgrades.mining === 3 ? 0.35 : upgrades.mining === 2 ? 0.15 : 0) +
    (upgrades.builder === 3 ? 0.12 : upgrades.builder === 2 ? 0.05 : 0);
  const petBoostBonus = upgrades.pet === 3 ? 0.25 : upgrades.pet === 2 ? 0.1 : 0;
  const extraFoldSpark = upgrades.research === 3 ? 1 : 0;
  const totalUpgrades =
    (upgrades.research - 1) +
    (upgrades.mining - 1) +
    (upgrades.pet - 1) +
    (upgrades.builder - 1) +
    (upgrades.lounge - 1);
  return {
    focusMult: Number(focusMult.toFixed(2)),
    energyFunMult: Number(energyFunMult.toFixed(2)),
    miningMult: Number(miningMult.toFixed(2)),
    petBoostBonus,
    extraFoldSpark,
    totalUpgrades
  };
}

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
  | "bouquet"
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
  | { kind: "hobby"; label: string; hobbyId: Exclude<HobbyPropId, "none">; worldX: number; worldZ: number }
  | { kind: "home-room"; label: string; roomId: ExtraRoomId; worldX: number; worldZ: number }
  | { kind: "stairs"; label: string; worldX: number; worldZ: number }
  | { kind: "garden-plot"; label: string; plotId: string; worldX: number; worldZ: number }
  | { kind: "conservatory"; label: string; worldX: number; worldZ: number }
  | { kind: "park-bench"; label: string; worldX: number; worldZ: number }
  | { kind: "player"; label: string; worldX: number; worldZ: number }
  | { kind: "fountain"; label: string; worldX: number; worldZ: number }
  | { kind: "neighbor-lab"; label: string; tokenId: number; worldX: number; worldZ: number }
  | { kind: "neighbor-npc"; label: string; tokenId: number; npcName: string; worldX: number; worldZ: number }
  | { kind: "visiting-host"; label: string; tokenId: number; hostName: string; worldX: number; worldZ: number }
  | { kind: "blueprint-lot"; label: string; lotNumber: number; worldX: number; worldZ: number }
  | { kind: "vehicle"; label: string; vehicleId: string; worldX: number; worldZ: number };

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
  return {
    floorStyle: "oak",
    patioDecor: "bonsai",
    seatingStyle: "plush-sofa",
    barStyle: "espresso",
    rugStyle: "cloud-rug",
    hobbyProp: "bookshelf",
    plantPack: "monstera",
    lightingFixture: "halo-ring",
    stationUpgrades: defaultStationUpgrades(),
    houseSize: 1,
    houseFloors: 2,
    hasBasement: true,
    wallStyle: "alabaster-glass",
    extraRooms: [],
    customLayout: {}
  };
}

function clampUpgradeLevel(v: unknown): StationUpgradeLevel {
  if (v === 3 || v === 2) return v;
  return 1;
}

export function sanitizeLabDecor(raw?: Partial<LabDecorConfig> | null): LabDecorConfig {
  const def = defaultLabDecor();
  if (!raw || typeof raw !== "object") return def;
  const up = raw.stationUpgrades as Partial<StationUpgradesMap> | undefined;
  const rawRooms = Array.isArray(raw.extraRooms) ? raw.extraRooms : [];
  const validRooms = Array.from(
    new Set(
      rawRooms.filter((r): r is ExtraRoomId =>
        EXTRA_ROOM_DEFS.some((d) => d.id === r)
      )
    )
  );
  return {
    floorStyle: FLOOR_STYLES.some((f) => f.id === raw.floorStyle)
      ? (raw.floorStyle as FloorStyleId)
      : def.floorStyle,
    patioDecor: PATIO_DECORS.some((p) => p.id === raw.patioDecor)
      ? (raw.patioDecor as PatioDecorId)
      : def.patioDecor,
    seatingStyle: SEATING_STYLES.some((s) => s.id === raw.seatingStyle)
      ? (raw.seatingStyle as SeatingStyleId)
      : def.seatingStyle,
    barStyle: BAR_STYLES.some((b) => b.id === raw.barStyle)
      ? (raw.barStyle as BarStyleId)
      : def.barStyle,
    rugStyle: RUG_STYLES.some((r) => r.id === raw.rugStyle)
      ? (raw.rugStyle as RugStyleId)
      : def.rugStyle,
    hobbyProp: HOBBY_PROPS.some((h) => h.id === raw.hobbyProp)
      ? (raw.hobbyProp as HobbyPropId)
      : def.hobbyProp,
    plantPack: PLANT_PACKS.some((p) => p.id === raw.plantPack)
      ? (raw.plantPack as PlantPackId)
      : def.plantPack,
    lightingFixture: LIGHTING_FIXTURES.some((l) => l.id === raw.lightingFixture)
      ? (raw.lightingFixture as LightingFixtureId)
      : def.lightingFixture,
    stationUpgrades: {
      research: clampUpgradeLevel(up?.research),
      mining: clampUpgradeLevel(up?.mining),
      pet: clampUpgradeLevel(up?.pet),
      builder: clampUpgradeLevel(up?.builder),
      lounge: clampUpgradeLevel(up?.lounge)
    },
    houseSize: raw.houseSize === 3 || raw.houseSize === 2 ? raw.houseSize : 1,
    houseFloors: raw.houseFloors === 3 ? 3 : raw.houseFloors === 1 ? 2 : 2,
    hasBasement: typeof raw.hasBasement === "boolean" ? raw.hasBasement : true,
    wallStyle: WALL_STYLES.some((w) => w.id === raw.wallStyle)
      ? (raw.wallStyle as WallStyleId)
      : def.wallStyle,
    extraRooms: validRooms,
    customLayout: sanitizeCustomLayout(raw.customLayout)
  };
}

export function deriveNeighborLabDecor(seed: string): LabDecorConfig {
  const rng = new SeededRNG(seed, 4123);
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng.next() * arr.length)];
  const activeHobbies = HOBBY_PROPS.filter((h) => h.id !== "none");
  const activeRugs = RUG_STYLES.filter((r) => r.id !== "none");
  const activeLights = LIGHTING_FIXTURES.filter((l) => l.id !== "none");
  const pickLevel = (): StationUpgradeLevel => {
    const r = rng.next();
    return r > 0.72 ? 3 : r > 0.34 ? 2 : 1;
  };
  const extraRooms: ExtraRoomId[] = EXTRA_ROOM_DEFS.filter(() => rng.next() > 0.56).map((r) => r.id);
  const sizeRoll = rng.next();
  const floorRoll = rng.next();
  return {
    floorStyle: pick(FLOOR_STYLES).id,
    patioDecor: pick(PATIO_DECORS).id,
    seatingStyle: pick(SEATING_STYLES).id,
    barStyle: pick(BAR_STYLES).id,
    rugStyle: pick(activeRugs).id,
    hobbyProp: pick(activeHobbies).id,
    plantPack: pick(PLANT_PACKS).id,
    lightingFixture: pick(activeLights).id,
    stationUpgrades: {
      research: pickLevel(),
      mining: pickLevel(),
      pet: pickLevel(),
      builder: pickLevel(),
      lounge: pickLevel()
    },
    houseSize: sizeRoll > 0.65 ? 3 : sizeRoll > 0.28 ? 2 : 1,
    houseFloors: floorRoll > 0.62 ? 3 : 2,
    hasBasement: true,
    wallStyle: pick(WALL_STYLES).id,
    extraRooms,
    customLayout: {}
  };
}

export function randomizeLabDecor(
  keepUpgrades?: StationUpgradesMap,
  keepArchitecture?: Pick<
    LabDecorConfig,
    "houseSize" | "houseFloors" | "hasBasement" | "extraRooms" | "customLayout"
  >
): LabDecorConfig {
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const activeHobbies = HOBBY_PROPS.filter((h) => h.id !== "none");
  const activeRugs = RUG_STYLES.filter((r) => r.id !== "none");
  const activePlants = PLANT_PACKS.filter((p) => p.id !== "minimal");
  const activeLights = LIGHTING_FIXTURES.filter((l) => l.id !== "none");
  return {
    floorStyle: pick(FLOOR_STYLES).id,
    patioDecor: pick(PATIO_DECORS).id,
    seatingStyle: pick(SEATING_STYLES).id,
    barStyle: pick(BAR_STYLES).id,
    rugStyle: pick(activeRugs).id,
    hobbyProp: pick(activeHobbies).id,
    plantPack: pick(activePlants).id,
    lightingFixture: pick(activeLights).id,
    stationUpgrades: keepUpgrades ? { ...keepUpgrades } : defaultStationUpgrades(),
    houseSize: keepArchitecture?.houseSize ?? 1,
    houseFloors: keepArchitecture?.houseFloors ?? 2,
    hasBasement: keepArchitecture?.hasBasement ?? true,
    wallStyle: pick(WALL_STYLES).id,
    extraRooms: keepArchitecture ? [...keepArchitecture.extraRooms] : [],
    customLayout: keepArchitecture ? { ...keepArchitecture.customLayout } : {}
  };
}

export function moveItemInDecor(
  decor: LabDecorConfig,
  itemId: MovableItemId,
  x: number,
  z: number,
  yaw: number,
  floor: FloorNumber
): LabDecorConfig {
  return {
    ...decor,
    customLayout: {
      ...decor.customLayout,
      [itemId]: { x, z, yaw, floor }
    }
  };
}

export function upgradeStationInDecor(
  decor: LabDecorConfig,
  stationId: UpgradeableStationId
): LabDecorConfig {
  const cur = decor.stationUpgrades[stationId];
  const next: StationUpgradeLevel = cur === 1 ? 2 : 3;
  return {
    ...decor,
    stationUpgrades: {
      ...decor.stationUpgrades,
      [stationId]: next
    }
  };
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
    const clean = sanitizeLabDecor(parsed);
    memoryDecorMap.set(tokenId, clean);
    return clean;
  } catch {
    return fallback;
  }
}

export function saveLabDecor(
  tokenId: number,
  decor: Partial<LabDecorConfig>
): LabDecorConfig {
  const clean = sanitizeLabDecor(decor);
  memoryDecorMap.set(tokenId, clean);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(`${DECOR_STORAGE_PREFIX}${tokenId}`, JSON.stringify(clean));
    } catch {
      // safe in sandboxed NFT iframes
    }
  }
  return clean;
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
  Inspired: [
    "Sketching new glass greenhouse",
    "Planting crystal orchids",
    "Admiring Botanical Conservatory"
  ],
  Focused: [
    "Analyzing 1L2Y fold",
    "Pruning bonsai garden beds",
    "Calibrating greenhouse mist"
  ],
  Energized: [
    "Watering lavender beds",
    "Power-walking the paved boulevard",
    "Harvesting sunbeam flowers"
  ],
  Playful: [
    "Feeding koi at the park pond",
    "Picnicking under sakura trees",
    "Playing with lab companion"
  ],
  Social: [
    "Waving on the boulevard",
    "Tending community garden plots",
    "Sharing cuttings with neighbors"
  ],
  Relaxed: [
    "Strolling the Botanical Park",
    "Tending ceramic bonsai",
    "Resting on a canal park bench"
  ],
  Drowsy: [
    "Taking a garden breather",
    "Brewing mint tea from the yard",
    "Dozing by the rose pergola"
  ]
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
  bouquet: {
    delta: 25,
    npcMood: "Inspired",
    npcActivity: "Arranging your Blossom Bouquet!",
    playerMood: "Social",
    moodletLabel: "Bouquet Gifter",
    vibeDelta: { social: 24, fun: 16, energy: 8 }
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
  options?: {
    petSleeping?: boolean;
    standalone?: boolean;
    currentFloor?: FloorNumber;
    maxFloors?: number;
    hasBasement?: boolean;
    gardenPlotStatus?: "empty" | "growing" | "ready";
    hasBouquet?: boolean;
    hasAmbrosia?: boolean;
  }
): SimsPieAction[] {
  switch (target.kind) {
    case "pet":
      return [
        { id: "pet-cuddle", label: "Pet", sublabel: "+1 spark", accent: "#f472b6" },
        options?.hasAmbrosia
          ? { id: "pet-ambrosia", label: "Feed Ambrosia", sublabel: "100% Free!", accent: "#10b981" }
          : { id: "pet-feed", label: "Drop Treats", sublabel: options?.standalone ? "Yum" : "5 sparks", accent: "#10b981" },
        { id: "pet-play", label: "Toss Ball", sublabel: "+2 sparks", accent: "#38bdf8" },
        { id: "pet-trick", label: "Pet Trick!", sublabel: "+Sparks", accent: "#f59e0b" },
        {
          id: "pet-nap",
          label: options?.petSleeping ? "Wake Up" : "Cozy Nap",
          accent: "#8b5cf6"
        },
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
        { id: "move-seating", label: "Move Seating", sublabel: "Free place", accent: "#64748b" },
        { id: "open-builder", label: "Furnish Home", accent: "#8b5cf6" }
      ];
    case "espresso":
      return [
        { id: "espresso-brew", label: "Brew Elixir", sublabel: "Energized!", accent: "#f59e0b" },
        { id: "open-alchemy", label: "Alchemy Bench", sublabel: "6 Recipes", accent: "#a855f7" },
        { id: "espresso-share", label: "Toast Science", sublabel: "+Social", accent: "#f472b6" },
        { id: "move-bar", label: "Move Bar", sublabel: "Free place", accent: "#64748b" },
        { id: "open-builder", label: "Swap Bar", accent: "#8b5cf6" }
      ];
    case "microscope":
      return [
        { id: "micro-analyze", label: "Analyze Fold", sublabel: "Focused!", accent: "#38bdf8" },
        { id: "move-research", label: "Move Station", sublabel: "Free place", accent: "#64748b" },
        { id: "open-upgrades", label: "Upgrade Scope", sublabel: "Lv 1–3", accent: "#8b5cf6" },
        { id: "open-research", label: "Open Workbench", accent: "#6366f1" }
      ];
    case "harvester":
      return [
        { id: "mine-overclock", label: "Spin Blades", sublabel: "+Focus", accent: "#6366f1" },
        { id: "open-mining", label: "Claim ALCH", accent: "#f59e0b" },
        { id: "move-mining", label: "Move Station", sublabel: "Free place", accent: "#64748b" },
        { id: "open-upgrades", label: "Upgrade Station", sublabel: "Lv 1–3", accent: "#10b981" }
      ];
    case "hobby": {
      const primary =
        target.hobbyId === "bookshelf"
          ? { id: "hobby-read", label: "Read Alchemy", sublabel: "Focused!", accent: "#38bdf8" }
          : target.hobbyId === "aquarium"
            ? { id: "hobby-watch", label: "Watch Jellies", sublabel: "Relaxed!", accent: "#34d399" }
            : target.hobbyId === "vinyl"
              ? { id: "hobby-music", label: "Spin Vinyl", sublabel: "Playful!", accent: "#818cf8" }
              : target.hobbyId === "easel"
                ? { id: "hobby-paint", label: "Paint Helix", sublabel: "Inspired!", accent: "#f472b6" }
                : { id: "hobby-arcade", label: "Play Arcade", sublabel: "+2 sparks", accent: "#10b981" };
      return [
        primary,
        { id: "move-hobby", label: "Move Prop", sublabel: "Free place", accent: "#64748b" },
        { id: "open-builder", label: "Swap Furniture", accent: "#8b5cf6" }
      ];
    }
    case "home-room": {
      const primary =
        target.roomId === "bedroom"
          ? { id: "room-nap", label: "Cozy Nap", sublabel: "+35 Energy", accent: "#a78bfa" }
          : target.roomId === "kitchen"
            ? { id: "room-cook", label: "Cook Meal", sublabel: "+Energy & Social", accent: "#f59e0b" }
            : target.roomId === "spa"
              ? { id: "room-soak", label: "Warm Soak", sublabel: "Relaxed!", accent: "#38bdf8" }
              : target.roomId === "hearth"
                ? { id: "room-fire", label: "Cozy By Fire", sublabel: "+25 Fun", accent: "#fb7185" }
                : target.roomId === "pergola"
                  ? { id: "room-garden", label: "Garden Breath", sublabel: "Inspired!", accent: "#10b981" }
                  : { id: "room-piano", label: "Play Piano", sublabel: "Playful!", accent: "#f472b6" };
      return [
        primary,
        { id: "open-expand", label: "Expand Home", sublabel: "Rooms & Floors", accent: "#10b981" },
        { id: "open-builder", label: "Furnish", accent: "#64748b" }
      ];
    }
    case "stairs": {
      const cur = (options?.currentFloor ?? 1) as FloorNumber;
      const max = (options?.maxFloors ?? 2) as FloorNumber;
      const min: FloorNumber = options?.hasBasement === false ? 1 : 0;
      const nextUp = Math.min(max, cur + 1) as FloorNumber;
      const nextDown = Math.max(min, cur - 1) as FloorNumber;
      return [
        {
          id: "floor-up",
          label: cur < max ? `Walk Up to ${formatFloorLabel(nextUp)}` : `Top Floor (${formatFloorLabel(max)})`,
          sublabel: cur < max ? "Upstairs" : "Highest floor",
          accent: "#38bdf8"
        },
        {
          id: "floor-down",
          label: cur > min ? `Walk Down to ${formatFloorLabel(nextDown)}` : `Basement (${formatFloorLabel(min)})`,
          sublabel: cur > min ? (nextDown === 0 ? "Basement" : "Downstairs") : "Lowest floor",
          accent: "#64748b"
        },
        { id: "open-expand", label: "Expand Floors", sublabel: "B1 / 1F / 2F / 3F", accent: "#10b981" }
      ];
    }
    case "garden-plot": {
      const status = options?.gardenPlotStatus ?? "empty";
      if (status === "ready") {
        return [
          { id: "garden-harvest", label: "Harvest Bloom!", sublabel: "+Sparks & Mood", accent: "#10b981" },
          { id: "open-garden", label: "Garden Journal", sublabel: "8 species", accent: "#64748b" },
          { id: "garden-water", label: "Admire Flowers", sublabel: "Inspired!", accent: "#f472b6" }
        ];
      }
      if (status === "growing") {
        return [
          { id: "garden-water", label: "Water Plant", sublabel: "+36% growth", accent: "#38bdf8" },
          { id: "garden-fertilize", label: "Crystal Mist", sublabel: "Instant bloom", accent: "#a855f7" },
          { id: "open-garden", label: "Garden Journal", sublabel: "All beds", accent: "#10b981" }
        ];
      }
      return [
        { id: "garden-plant-lavender", label: "Plant Lavender", sublabel: "35s · +4 sparks", accent: "#a78bfa" },
        { id: "garden-plant-sunflower", label: "Plant Sunflower", sublabel: "45s · +5 sparks", accent: "#fbbf24" },
        { id: "garden-plant-sakura", label: "Plant Sakura", sublabel: "55s · +6 sparks", accent: "#f472b6" },
        { id: "garden-plant-orchid", label: "Plant Orchid", sublabel: "60s · +7 sparks", accent: "#38bdf8" },
        { id: "open-garden", label: "All 8 Seeds", sublabel: "Garden Journal", accent: "#10b981" }
      ];
    }
    case "conservatory":
      return [
        { id: "park-smell-flowers", label: "Botanical Mist", sublabel: "Inspired!", accent: "#10b981" },
        { id: "park-tend-community", label: "Tend Greenhouse", sublabel: "+2 sparks", accent: "#38bdf8" },
        { id: "open-garden", label: "Park Gardens", sublabel: "Plant & Harvest", accent: "#f472b6" },
        { id: "open-neighborhood", label: "All Town Parks", accent: "#64748b" }
      ];
    case "park-bench":
      return [
        { id: "park-relax", label: "Relax in Park", sublabel: "+26 Energy", accent: "#10b981" },
        { id: "park-picnic", label: "Enjoy Picnic", sublabel: "+22 Fun & Social", accent: "#f472b6" },
        { id: "park-feed-koi", label: "Feed Koi Fish", sublabel: "+1 spark", accent: "#38bdf8" },
        { id: "open-garden", label: "Garden Journal", accent: "#64748b" }
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
        ...(options?.hasBouquet
          ? [{ id: "neighbor-bouquet", label: "Gift Bouquet", sublabel: "+25 Friend", accent: "#f472b6" }]
          : []),
        { id: "neighbor-visit", label: "Walk Outside", accent: "#38bdf8" },
        { id: "neighbor-spark", label: "Gift Spark", sublabel: "+14 Friend", accent: "#f59e0b" },
        { id: "neighbor-inspect", label: "Inspect Lab", accent: "#6366f1" },
        { id: "neighbor-chat", label: "Say Hello", sublabel: "+8 Friend", accent: "#f472b6" }
      ];
    case "neighbor-npc":
      return [
        { id: "neighbor-chat", label: "Friendly Chat", sublabel: "+8 Friend", accent: "#f472b6" },
        ...(options?.hasBouquet
          ? [{ id: "neighbor-bouquet", label: "Gift Bouquet", sublabel: "+25 Friend", accent: "#ec4899" }]
          : []),
        { id: "neighbor-joke", label: "Tell Joke", sublabel: "+11 Playful", accent: "#a855f7" },
        { id: "neighbor-spark", label: "Gift Spark", sublabel: "+14 Friend", accent: "#f59e0b" },
        { id: "neighbor-enter", label: "Enter Home", sublabel: "Visit inside", accent: "#10b981" },
        { id: "neighbor-inspect", label: "View Status", accent: "#6366f1" }
      ];
    case "visiting-host":
      return [
        { id: "host-chat", label: "Friendly Chat", sublabel: "+8 Friend", accent: "#f472b6" },
        ...(options?.hasBouquet
          ? [{ id: "host-bouquet", label: "Gift Bouquet", sublabel: "+25 Friend", accent: "#ec4899" }]
          : []),
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
    case "vehicle":
      return [
        { id: "vehicle-wave", label: "Wave at Driver", sublabel: "+Social", accent: "#38bdf8" },
        { id: "vehicle-beep", label: "Friendly Beep", sublabel: "+Fun!", accent: "#f472b6" },
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

// ============================================================================
// Home Architect Blueprint Save / Load Slots (3 Custom Layout Presets per Lab)
// ============================================================================

export interface HomeBlueprintSlot {
  slotIndex: 0 | 1 | 2;
  name: string;
  savedAtMs: number;
  decor: Pick<
    LabDecorConfig,
    | "floorStyle"
    | "patioDecor"
    | "seatingStyle"
    | "barStyle"
    | "rugStyle"
    | "hobbyProp"
    | "plantPack"
    | "lightingFixture"
    | "wallStyle"
    | "customLayout"
  >;
}

const BLUEPRINT_STORAGE_PREFIX = "alchemia_home_blueprints_v1_";
const memoryBlueprintSlots = new Map<number, Array<HomeBlueprintSlot | null>>();

export function loadHomeBlueprintSlots(tokenId: number): Array<HomeBlueprintSlot | null> {
  const cached = memoryBlueprintSlots.get(tokenId);
  if (cached) return [...cached];
  const empty: Array<HomeBlueprintSlot | null> = [null, null, null];
  if (typeof window === "undefined") {
    memoryBlueprintSlots.set(tokenId, empty);
    return [...empty];
  }
  try {
    const raw = window.localStorage.getItem(`${BLUEPRINT_STORAGE_PREFIX}${tokenId}`);
    if (!raw) {
      memoryBlueprintSlots.set(tokenId, empty);
      return [...empty];
    }
    const parsed = JSON.parse(raw) as Array<HomeBlueprintSlot | null>;
    const normalized: Array<HomeBlueprintSlot | null> = [0, 1, 2].map((idx) => {
      const s = Array.isArray(parsed) ? parsed[idx] : null;
      if (!s || typeof s !== "object" || !s.decor) return null;
      const clean = sanitizeLabDecor(s.decor);
      return {
        slotIndex: idx as 0 | 1 | 2,
        name: typeof s.name === "string" && s.name.trim() ? s.name.trim().slice(0, 22) : `Blueprint ${idx + 1}`,
        savedAtMs: typeof s.savedAtMs === "number" ? s.savedAtMs : Date.now(),
        decor: {
          floorStyle: clean.floorStyle,
          patioDecor: clean.patioDecor,
          seatingStyle: clean.seatingStyle,
          barStyle: clean.barStyle,
          rugStyle: clean.rugStyle,
          hobbyProp: clean.hobbyProp,
          plantPack: clean.plantPack,
          lightingFixture: clean.lightingFixture,
          wallStyle: clean.wallStyle,
          customLayout: clean.customLayout
        }
      };
    });
    memoryBlueprintSlots.set(tokenId, normalized);
    return [...normalized];
  } catch {
    memoryBlueprintSlots.set(tokenId, empty);
    return [...empty];
  }
}

export function saveHomeBlueprintSlot(
  tokenId: number,
  slotIndex: 0 | 1 | 2,
  decor: LabDecorConfig,
  label?: string
): Array<HomeBlueprintSlot | null> {
  const slots = loadHomeBlueprintSlots(tokenId);
  const clean = sanitizeLabDecor(decor);
  slots[slotIndex] = {
    slotIndex,
    name: (label?.trim() || `Blueprint ${slotIndex + 1}`).slice(0, 22),
    savedAtMs: Date.now(),
    decor: {
      floorStyle: clean.floorStyle,
      patioDecor: clean.patioDecor,
      seatingStyle: clean.seatingStyle,
      barStyle: clean.barStyle,
      rugStyle: clean.rugStyle,
      hobbyProp: clean.hobbyProp,
      plantPack: clean.plantPack,
      lightingFixture: clean.lightingFixture,
      wallStyle: clean.wallStyle,
      customLayout: clean.customLayout
    }
  };
  memoryBlueprintSlots.set(tokenId, slots);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(`${BLUEPRINT_STORAGE_PREFIX}${tokenId}`, JSON.stringify(slots));
    } catch {
      // safe inside sandboxed NFT iframes
    }
  }
  return [...slots];
}

export function deleteHomeBlueprintSlot(
  tokenId: number,
  slotIndex: 0 | 1 | 2
): Array<HomeBlueprintSlot | null> {
  const slots = loadHomeBlueprintSlots(tokenId);
  slots[slotIndex] = null;
  memoryBlueprintSlots.set(tokenId, slots);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(`${BLUEPRINT_STORAGE_PREFIX}${tokenId}`, JSON.stringify(slots));
    } catch {
      // ignore
    }
  }
  return [...slots];
}
