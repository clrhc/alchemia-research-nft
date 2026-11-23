export interface PaletteDef {
  id: number;
  name: string;
  bgTop: string;
  bgBottom: string;
  liquidTop: string;
  liquidMid: string;
  liquidBottom: string;
  accent: string;
  proton: string;
  electron: string;
  glow: string;
  silverInk: string;
  darkInk: string;
}

export interface FamiliarDef {
  id: number;
  name: string;
  species: "Cat" | "Dog" | "Duo";
  archetype:
    | "tuxedo-cat"
    | "siamese-cat"
    | "calico-kitten"
    | "shiba-dog"
    | "sighthound-dog"
    | "lab-pup"
    | "harmonic-duo";
  description: string;
}

export interface SubTraits {
  orbitalCount: number;
  protonCount: number;
  neutronCount: number;
  hasCondenserTube: boolean;
  hasSideVials: boolean;
  hasAstrolabeGlyphs: boolean;
  hasDNAVapor: boolean;
  hasPrismHalo: boolean;
  companionSide: "left" | "right";
  companionAccessory: "goggles" | "halo" | "pendant" | "monocle" | "scarf";
  coatVariant: number;
  vesselScale: number;
  astrolabeTilt: number;
  starCount: number;
  molecularNodes: number;
  sparkleHueShift: number;
}

export interface AlchemyTraits {
  seed: `0x${string}`;
  vesselIdx: number;
  familiarIdx: number;
  paletteIdx: number;
  atomIdx: number;
  elementIdx: number;
  vessel: string;
  familiar: FamiliarDef;
  palette: PaletteDef;
  atomConfig: string;
  element: string;
  rarityTier: "Atelier" | "Catalytic" | "Arcane" | "Mythic";
  sub: SubTraits;
}

export const VESSELS = [
  "Erlenmeyer Flask",
  "Round Lab Orb",
  "Glass Chalice",
  "Twin Glass Crucible",
  "Tall Glass Spire"
] as const;

export const ATOM_CONFIGS = [
  "Helium Core",
  "Carbon Ring",
  "Platinum Halo",
  "Proton Ring",
  "Double Helix"
] as const;

export const ELEMENTS = [
  "Silver",
  "Quartz",
  "Mercury",
  "Phosphorus",
  "Gold"
] as const;

export const FAMILIARS: readonly FamiliarDef[] = [
  {
    id: 0,
    name: "Tuxedo Cat",
    species: "Cat",
    archetype: "tuxedo-cat",
    description: "Sharp-eyed cat batting softly at drifting protons."
  },
  {
    id: 1,
    name: "Siamese Cat",
    species: "Cat",
    archetype: "siamese-cat",
    description: "Calm ivory-and-slate cat keeping watch beside the glass."
  },
  {
    id: 2,
    name: "Calico Kitten",
    species: "Cat",
    archetype: "calico-kitten",
    description: "Curious kitten chasing orbiting particles around the flask."
  },
  {
    id: 3,
    name: "Shiba Inu",
    species: "Dog",
    archetype: "shiba-dog",
    description: "Goggle-wearing Shiba excited by every new discovery."
  },
  {
    id: 4,
    name: "Silver Sighthound",
    species: "Dog",
    archetype: "sighthound-dog",
    description: "Tall silver greyhound watching the folding protein above."
  },
  {
    id: 5,
    name: "Yellow Lab Pup",
    species: "Dog",
    archetype: "lab-pup",
    description: "Friendly floppy-eared pup wagging faster with every visit."
  },
  {
    id: 6,
    name: "Cat & Dog Pair",
    species: "Duo",
    archetype: "harmonic-duo",
    description: "Rare pairing of both a lab cat and dog sharing the patio."
  }
];

export const PALETTES: readonly PaletteDef[] = [
  {
    id: 0,
    name: "Opal Cobalt",
    bgTop: "#ffffff",
    bgBottom: "#eef2f8",
    liquidTop: "#7dd3fc",
    liquidMid: "#5b8def",
    liquidBottom: "#3b5bdb",
    accent: "#f472b6",
    proton: "#fb7185",
    electron: "#38bdf8",
    glow: "rgba(91, 141, 239, 0.28)",
    silverInk: "#8b96aa",
    darkInk: "#222938"
  },
  {
    id: 1,
    name: "Mercury Rose",
    bgTop: "#ffffff",
    bgBottom: "#f5eff5",
    liquidTop: "#fbcfe8",
    liquidMid: "#ec6ead",
    liquidBottom: "#9b6bc7",
    accent: "#38bdf8",
    proton: "#f43f5e",
    electron: "#60a5fa",
    glow: "rgba(236, 110, 173, 0.26)",
    silverInk: "#928ba3",
    darkInk: "#282233"
  },
  {
    id: 2,
    name: "Aether Mint",
    bgTop: "#ffffff",
    bgBottom: "#ecf6f4",
    liquidTop: "#a7f3d0",
    liquidMid: "#34d399",
    liquidBottom: "#0ea5e9",
    accent: "#f59e0b",
    proton: "#f97316",
    electron: "#14b8a6",
    glow: "rgba(52, 211, 153, 0.26)",
    silverInk: "#7f9694",
    darkInk: "#1d2c2d"
  },
  {
    id: 3,
    name: "Solar Platinum",
    bgTop: "#ffffff",
    bgBottom: "#f6f3ed",
    liquidTop: "#fde68a",
    liquidMid: "#f59e0b",
    liquidBottom: "#ea580c",
    accent: "#6366f1",
    proton: "#ef4444",
    electron: "#818cf8",
    glow: "rgba(245, 158, 11, 0.25)",
    silverInk: "#938f86",
    darkInk: "#2b2722"
  },
  {
    id: 4,
    name: "Prism Violet",
    bgTop: "#ffffff",
    bgBottom: "#f1effa",
    liquidTop: "#c4b5fd",
    liquidMid: "#8b5cf6",
    liquidBottom: "#38bdf8",
    accent: "#fb7185",
    proton: "#f472b6",
    electron: "#22d3ee",
    glow: "rgba(139, 92, 246, 0.26)",
    silverInk: "#8a89a6",
    darkInk: "#232136"
  },
  {
    id: 5,
    name: "Cinnabar Coral",
    bgTop: "#ffffff",
    bgBottom: "#f9f1ef",
    liquidTop: "#fecdd3",
    liquidMid: "#fb7185",
    liquidBottom: "#f59e0b",
    accent: "#14b8a6",
    proton: "#e11d48",
    electron: "#2dd4bf",
    glow: "rgba(251, 113, 133, 0.26)",
    silverInk: "#9a898b",
    darkInk: "#2e2225"
  },
  {
    id: 6,
    name: "Glacier Cyan",
    bgTop: "#ffffff",
    bgBottom: "#edf5f9",
    liquidTop: "#a5f3fc",
    liquidMid: "#06b6d4",
    liquidBottom: "#6366f1",
    accent: "#f43f5e",
    proton: "#fb7185",
    electron: "#38bdf8",
    glow: "rgba(6, 182, 212, 0.26)",
    silverInk: "#8295a6",
    darkInk: "#1d2834"
  },
  {
    id: 7,
    name: "Liquid Aurum",
    bgTop: "#ffffff",
    bgBottom: "#f3f2ef",
    liquidTop: "#fef08a",
    liquidMid: "#d97706",
    liquidBottom: "#64748b",
    accent: "#10b981",
    proton: "#f59e0b",
    electron: "#34d399",
    glow: "rgba(217, 119, 6, 0.24)",
    silverInk: "#8c8f96",
    darkInk: "#24262b"
  },
  {
    id: 8,
    name: "Iridescent Prism",
    bgTop: "#ffffff",
    bgBottom: "#eef3f8",
    liquidTop: "#67e8f9",
    liquidMid: "#818cf8",
    liquidBottom: "#ec4899",
    accent: "#14b8a6",
    proton: "#f43f5e",
    electron: "#06b6d4",
    glow: "rgba(129, 140, 248, 0.3)",
    silverInk: "#8791a6",
    darkInk: "#1e2230"
  }
];

export const REACTION_STAGES = [
  { stage: 1, name: "I · Dormant Glass", thresholdEth: 0, targetEth: 0.25 },
  { stage: 2, name: "II · Nucleation", thresholdEth: 0.25, targetEth: 1.0 },
  { stage: 3, name: "III · Transmutation", thresholdEth: 1.0, targetEth: 5.0 },
  { stage: 4, name: "IV · Quantum Resonance", thresholdEth: 5.0, targetEth: 25.0 },
  { stage: 5, name: "V · Philosopher Equilibrium", thresholdEth: 25.0, targetEth: 100.0 }
] as const;

export function stageFromEth(globalEth: number): number {
  if (globalEth >= 25) return 5;
  if (globalEth >= 5) return 4;
  if (globalEth >= 1) return 3;
  if (globalEth >= 0.25) return 2;
  return 1;
}
