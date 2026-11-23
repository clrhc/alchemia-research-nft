export interface LabSectorDef {
  id: number;
  bit: number;
  name: string;
  shortName: string;
  wingPosition: string;
  role: string;
  researchEffect: string;
  miningBonusPerHour: number;
  coinCost: number;
  ethCostUsd: number;
  accent: string;
}

export const LAB_SECTORS: readonly LabSectorDef[] = [
  {
    id: 0,
    bit: 1 << 0,
    name: "Cold Room",
    shortName: "Cold Room",
    wingPosition: "North-West",
    role: "Cools your lab gear so protein folding runs 1.6x faster.",
    researchEffect: "1.6x faster folding",
    miningBonusPerHour: 4,
    coinCost: 150,
    ethCostUsd: 5,
    accent: "#38bdf8"
  },
  {
    id: 1,
    bit: 1 << 1,
    name: "Mining Room",
    shortName: "Mining Room",
    wingPosition: "East Side",
    role: "Adds spinning mining blades that steadily earn ALCH coins.",
    researchEffect: "Big coin boost",
    miningBonusPerHour: 14,
    coinCost: 220,
    ethCostUsd: 10,
    accent: "#6366f1"
  },
  {
    id: 2,
    bit: 1 << 2,
    name: "Greenhouse",
    shortName: "Greenhouse",
    wingPosition: "South-West",
    role: "A glass dome that brings clean solar power and steady coins.",
    researchEffect: "Clean power + coins",
    miningBonusPerHour: 8,
    coinCost: 300,
    ethCostUsd: 15,
    accent: "#10b981"
  },
  {
    id: 3,
    bit: 1 << 3,
    name: "Pet Lounge",
    shortName: "Pet Lounge",
    wingPosition: "South-East",
    role: "A cozy glass patio that brings both a cat and dog to your lab.",
    researchEffect: "Cat & dog pair",
    miningBonusPerHour: 6,
    coinCost: 420,
    ethCostUsd: 25,
    accent: "#f472b6"
  },
  {
    id: 4,
    bit: 1 << 4,
    name: "Particle Tower",
    shortName: "Particle Tower",
    wingPosition: "North-East",
    role: "A tall glass spire with orbiting rings for faster coin mining.",
    researchEffect: "Orbiting rings + coins",
    miningBonusPerHour: 18,
    coinCost: 650,
    ethCostUsd: 50,
    accent: "#8b5cf6"
  },
  {
    id: 5,
    bit: 1 << 5,
    name: "Glass Dome",
    shortName: "Glass Dome",
    wingPosition: "Roof Top",
    role: "Crowns your whole lab with a spinning crystal cube and top output.",
    researchEffect: "Max folding + coins",
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
    if (hasSector(sectorsMask, s.id)) rate += s.miningBonusPerHour;
  }
  rate += Math.min(40, workUnits * 0.5);
  return Number(rate.toFixed(1));
}
