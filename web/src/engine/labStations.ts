/**
 * Spatial Interactive Stations inside the 3D Walkable ALCHEMIA Lab.
 * Each section anchors a live 3D-projected floating glass panel and a glowing
 * architectural floor pad that your character can walk up to and interact with.
 */

export type LabStationId = "research" | "mining" | "pet" | "builder" | "console";

export interface LabStationDef {
  id: LabStationId;
  label: string;
  shortLabel: string;
  subtitle: string;
  accent: string;
  /** Walkable floor trigger pad center (world X, Z) */
  padX: number;
  padZ: number;
  /** Radius around pad center that activates proximity prompt / auto-panel */
  triggerRadius: number;
  /** 3D world position where the floating glass hologram mini-panel anchors */
  panelPos: [number, number, number];
  /** Preferred yaw (radians) when standing at this station */
  facingYaw: number;
}

export interface ProjectedStationAnchor {
  id: LabStationId;
  x: number;
  y: number;
  visible: boolean;
  distToChar: number;
  distToCam: number;
}

export const LAB_STATIONS: readonly LabStationDef[] = [
  {
    id: "research",
    label: "Protein Research",
    shortLabel: "Research",
    subtitle: "Live 3D protein folding & PDB exports",
    accent: "#38bdf8",
    padX: -1.3,
    padZ: -0.62,
    triggerRadius: 0.78,
    panelPos: [-1.42, 2.08, -0.72],
    facingYaw: 0.85
  },
  {
    id: "mining",
    label: "ALCH Mining Bay",
    shortLabel: "Mining",
    subtitle: "Claim mined ALCH & share with science",
    accent: "#6366f1",
    padX: 1.44,
    padZ: 0.14,
    triggerRadius: 0.82,
    panelPos: [2.02, 1.62, 0.18],
    facingYaw: 1.55
  },
  {
    id: "pet",
    label: "Pet Sanctuary",
    shortLabel: "Pet",
    subtitle: "Feed, play, dress up & Proton Catch",
    accent: "#f472b6",
    padX: 0.96,
    padZ: 1.32,
    triggerRadius: 0.82,
    panelPos: [1.34, 1.34, 1.38],
    facingYaw: 0.45
  },
  {
    id: "builder",
    label: "Furnish & Upgrades",
    shortLabel: "Furnish",
    subtitle: "43 furnishings, station upgrades & wings",
    accent: "#10b981",
    padX: -1.04,
    padZ: 1.34,
    triggerRadius: 0.82,
    panelPos: [-1.62, 1.44, 1.48],
    facingYaw: -0.65
  },
  {
    id: "console",
    label: "Lab Console & Look",
    shortLabel: "Profile",
    subtitle: "Goals, lighting & character wardrobe",
    accent: "#8b5cf6",
    padX: 1.02,
    padZ: -1.16,
    triggerRadius: 0.78,
    panelPos: [1.38, 2.04, -1.24],
    facingYaw: -2.4
  }
];

export const LAB_STATION_BY_ID: Record<LabStationId, LabStationDef> = LAB_STATIONS.reduce(
  (acc, st) => {
    acc[st.id] = st;
    return acc;
  },
  {} as Record<LabStationId, LabStationDef>
);

/** Map each of the 6 Sims-style architectural wing sector IDs to its matching interactive station */
export function stationForSector(sectorId: number): LabStationId {
  if (sectorId === 0 || sectorId === 5) return "research";
  if (sectorId === 1 || sectorId === 4) return "mining";
  if (sectorId === 3) return "pet";
  return "builder";
}

/** Find the closest station within its trigger radius (or null if outside all station pads) */
export function findNearestTriggeredStation(x: number, z: number): LabStationId | null {
  let bestId: LabStationId | null = null;
  let bestDist = Infinity;
  for (const st of LAB_STATIONS) {
    const d = Math.hypot(x - st.padX, z - st.padZ);
    if (d <= st.triggerRadius && d < bestDist) {
      bestDist = d;
      bestId = st.id;
    }
  }
  return bestId;
}
