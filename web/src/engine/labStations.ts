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
    padX: -1.35,
    padZ: -2.55,
    triggerRadius: 0.86,
    panelPos: [-1.35, 1.88, -2.55],
    facingYaw: 0.2
  },
  {
    id: "mining",
    label: "ALCH Mining Bay",
    shortLabel: "Mining",
    subtitle: "Claim mined ALCH & share with science",
    accent: "#6366f1",
    padX: 1.35,
    padZ: -2.55,
    triggerRadius: 0.86,
    panelPos: [1.35, 1.88, -2.55],
    facingYaw: -0.2
  },
  {
    id: "pet",
    label: "Pet Sanctuary",
    shortLabel: "Pet",
    subtitle: "Feed, play, dress up & Proton Catch",
    accent: "#f472b6",
    padX: 1.85,
    padZ: 2.15,
    triggerRadius: 0.86,
    panelPos: [1.85, 1.66, 2.15],
    facingYaw: -0.6
  },
  {
    id: "builder",
    label: "Home Architect",
    shortLabel: "Home",
    subtitle: "Furnish, expand floors, move stations & rooms",
    accent: "#10b981",
    padX: -1.45,
    padZ: 2.55,
    triggerRadius: 0.86,
    panelPos: [-1.45, 1.68, 2.55],
    facingYaw: 0.35
  },
  {
    id: "console",
    label: "Lab Console & Look",
    shortLabel: "Profile",
    subtitle: "Moods, friends, guestbook & wardrobe",
    accent: "#8b5cf6",
    padX: 2.55,
    padZ: 0.95,
    triggerRadius: 0.86,
    panelPos: [2.55, 1.82, 0.95],
    facingYaw: -1.35
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
