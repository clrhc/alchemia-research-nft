export interface LabSectorDef {
  id: number;
  bit: number;
  name: string;
  shortName: string;
  wingPosition: string;
  role: string;
  researchEffect: string;
  miningBonusPerHour: number; // $ALCH / hr
  coinCost: number;           // $ALCH to build
  ethCostUsd: number;         // Alternative USD equivalent in ETH
  accent: string;
}

export const LAB_SECTORS: readonly LabSectorDef[] = [
  {
    id: 0,
    bit: 1 << 0,
    name: "Cryo-Folding Wing",
    shortName: "Cryo Wing",
    wingPosition: "North-West Terrace",
    role: "Accelerates 3D AB-model protein folding & deeper low-energy conformation discovery.",
    researchEffect: "+1.5x Folding Speed",
    miningBonusPerHour: 4,
    coinCost: 150,
    ethCostUsd: 5,
    accent: "#38bdf8"
  },
  {
    id: 1,
    bit: 1 << 1,
    name: "Quantum Mining Pavilion",
    shortName: "Mining Rig",
    wingPosition: "East Terrace",
    role: "Installs spinning crystalline compute blades that launch active $ALCH coin mining operations.",
    researchEffect: "Starts Active Coin Rig",
    miningBonusPerHour: 14,
    coinCost: 220,
    ethCostUsd: 10,
    accent: "#6366f1"
  },
  {
    id: 2,
    bit: 1 << 2,
    name: "Solar Catalysis Dome",
    shortName: "Solar Dome",
    wingPosition: "South-West Terrace",
    role: "Geodesic glass greenhouse powering clean-energy catalyst searches & passive yield.",
    researchEffect: "+Clean Catalysis",
    miningBonusPerHour: 8,
    coinCost: 300,
    ethCostUsd: 15,
    accent: "#10b981"
  },
  {
    id: 3,
    bit: 1 << 3,
    name: "Companion Sanctuary",
    shortName: "Sanctuary",
    wingPosition: "South-East Terrace",
    role: "Glass lounge pavilion pairing both Cat & Dog familiars to boost animal biology resonance.",
    researchEffect: "Pairs Cat + Dog",
    miningBonusPerHour: 6,
    coinCost: 420,
    ethCostUsd: 25,
    accent: "#f472b6"
  },
  {
    id: 4,
    bit: 1 << 4,
    name: "Proton Accelerator Spire",
    shortName: "Proton Spire",
    wingPosition: "North-East Tower",
    role: "Vertical glass-and-titanium subatomic collider spire unlocking peak physics proofs & coin yield.",
    researchEffect: "+Particle Proofs",
    miningBonusPerHour: 18,
    coinCost: 650,
    ethCostUsd: 50,
    accent: "#8b5cf6"
  },
  {
    id: 5,
    bit: 1 << 5,
    name: "Philosopher Observatory",
    shortName: "Observatory",
    wingPosition: "Upper Crown",
    role: "Crowning skylight dome with a rotating 4D crystalline hypercube for maximum research & mining.",
    researchEffect: "+4D Hypercube Crown",
    miningBonusPerHour: 28,
    coinCost: 1000,
    ethCostUsd: 100,
    accent: "#f59e0b"
  }
];

export const SLIDER_USD_STOPS = [1, 2, 5, 10, 25, 50, 100, 250, 500] as const;

export function hasSector(mask: number, sectorId: number): boolean {
  return (mask & (1 << sectorId)) !== 0;
}

export function countSectors(mask: number): number {
  let c = 0;
  for (let i = 0; i < LAB_SECTORS.length; i++) {
    if (hasSector(mask, i)) c++;
  }
  return c;
}

export function computeMiningRatePerHour(
  complexityTier: number,
  sectorsMask: number,
  workUnits = 0
): number {
  let rate = Math.max(1, complexityTier) * 5;
  for (const s of LAB_SECTORS) {
    if (hasSector(sectorsMask, s.id)) {
      rate += s.miningBonusPerHour;
    }
  }
  rate += Math.min(40, workUnits * 0.5);
  return Number(rate.toFixed(1));
}
