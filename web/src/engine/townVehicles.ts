/**
 * Autonomous Neighborhood Traffic & Right-Hand-Lane Routing Engine.
 *
 * Vehicles follow the exact paved street coordinates from `TOWN_STREETS` and dynamically
 * expand onto newly paved Outer Expansion Ring Roads & Canal Bridges as more NFTs mint!
 * Features smooth rounded intersection turns, vehicle-to-vehicle headway, and polite
 * crosswalk yielding whenever a researcher or neighbor NPC steps into the road.
 */

import { getExpansionBandAvenueSpan } from "./neighborhoodLayout";

export type VehicleKind =
  | "ev-sedan"
  | "research-van"
  | "garden-truck"
  | "eco-bus"
  | "micro-coupe";

export interface RouteWaypoint {
  x: number;
  z: number;
}

export interface TrafficRoute {
  id: string;
  name: string;
  waypoints: readonly RouteWaypoint[];
  totalLength: number;
  /** Cumulative distance at the start of each segment i -> (i+1)%N */
  segStarts: readonly number[];
  segLengths: readonly number[];
  isExpansionRoute: boolean;
}

export interface VehicleBlueprint {
  id: string;
  kind: VehicleKind;
  label: string;
  bodyHex: string;
  accentHex: string;
  routeIndex: number;
  initialFraction: number;
  cruiseSpeed: number;
}

/** Right-hand lane centerline offset inside each 2.2m paved road (leaves clean margin to center dashes & curbs) */
export const TRAFFIC_LANE_OFFSET = 0.52;

/** Intersection turn fillet radius (m) so vehicles curve smoothly across paved granite intersections */
export const TRAFFIC_CORNER_RADIUS = 1.05;

function compileClosedRoute(
  id: string,
  name: string,
  waypoints: readonly RouteWaypoint[],
  isExpansionRoute: boolean
): TrafficRoute {
  const segStarts: number[] = [];
  const segLengths: number[] = [];
  let total = 0;
  for (let i = 0; i < waypoints.length; i++) {
    const a = waypoints[i];
    const b = waypoints[(i + 1) % waypoints.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    segStarts.push(total);
    segLengths.push(len);
    total += len;
  }
  return {
    id,
    name,
    waypoints,
    totalLength: Math.max(0.001, total),
    segStarts,
    segLengths,
    isExpansionRoute
  };
}

/**
 * Builds a clean rectangular street loop offset to the right-hand lane for either
 * clockwise (`clockwise = true`) or counter-clockwise (`clockwise = false`) driving.
 *
 * Coordinate convention: +X = East, +Z = South.
 * In screen/top-down view (North = -Z, East = +X, South = +Z, West = -X):
 *  - Clockwise loop: North edge goes East (+X), East edge goes South (+Z),
 *    South edge goes West (-X), West edge goes North (-Z).
 *    Right-hand side of travel is INWARD by `LANE_OFFSET`!
 *  - Counter-clockwise loop: North edge goes West (-X), West edge goes South (+Z),
 *    South edge goes East (+X), East edge goes North (-Z).
 *    Right-hand side of travel is OUTWARD by `LANE_OFFSET`!
 */
function buildRectLoop(
  id: string,
  name: string,
  westX: number,
  eastX: number,
  northZ: number,
  southZ: number,
  clockwise: boolean,
  isExpansionRoute: boolean
): TrafficRoute {
  const off = clockwise ? TRAFFIC_LANE_OFFSET : -TRAFFIC_LANE_OFFSET;
  const xW = Number((westX + off).toFixed(3));
  const xE = Number((eastX - off).toFixed(3));
  const zN = Number((northZ + off).toFixed(3));
  const zS = Number((southZ - off).toFixed(3));

  const waypoints: RouteWaypoint[] = clockwise
    ? [
        { x: xW, z: zN }, // NW -> heading East along North street
        { x: xE, z: zN }, // NE -> heading South along East street
        { x: xE, z: zS }, // SE -> heading West along South street
        { x: xW, z: zS }  // SW -> heading North along West street
      ]
    : [
        { x: xE, z: zN }, // NE -> heading West along North street
        { x: xW, z: zN }, // NW -> heading South along West street
        { x: xW, z: zS }, // SW -> heading East along South street
        { x: xE, z: zS }  // SE -> heading North along East street
      ];

  return compileClosedRoute(id, name, waypoints, isExpansionRoute);
}

/**
 * Generates the active closed driving loops matching the town's real paved streets
 * AND dynamically appends Outer Expansion Ring routes as new bands pave across the canal!
 */
export function buildTrafficRoutes(expansionBands = 0): TrafficRoute[] {
  const routes: TrafficRoute[] = [
    // 0: Inner Boulevard CW (Willow Ln -6.8, Oakwood St -6.8, Maple Ln +6.8, Main St +8.4)
    buildRectLoop("inner-cw", "Inner Boulevard Loop", -6.8, 6.8, -6.8, 8.4, true, false),
    // 1: Inner Boulevard CCW (opposite right-hand lane!)
    buildRectLoop("inner-ccw", "Central Plaza Loop", -6.8, 6.8, -6.8, 8.4, false, false),
    // 2: Outer Park Boulevard CW (West Park -21.2, North Orchard -21.2, East Park +21.2, South Blossom +21.6)
    buildRectLoop("park-cw", "Park Perimeter Blvd", -21.2, 21.2, -21.2, 21.6, true, false),
    // 3: Outer Park Boulevard CCW
    buildRectLoop("park-ccw", "Botanical Ring Ave", -21.2, 21.2, -21.2, 21.6, false, false),
    // 4: West-Midtown Commuter Loop (West Park -21.2 -> Oakwood -6.8 -> Maple +6.8 -> South Blossom +21.6)
    buildRectLoop("midtown-cw", "Maple & Blossom Loop", -21.2, 6.8, -6.8, 21.6, true, false),
    // 5: East-North Orchard Loop (Willow -6.8 -> North Orchard -21.2 -> East Park +21.2 -> Main +8.4)
    buildRectLoop("orchard-ccw", "Orchard & Conservatory Loop", -6.8, 21.2, -21.2, 8.4, false, false)
  ];

  // Dynamically add Outer Expansion Ring Routes across the newly paved Canal Bridges!
  const cappedBands = Math.min(3, Math.max(0, Math.floor(expansionBands)));
  for (let b = 0; b < cappedBands; b++) {
    const span = getExpansionBandAvenueSpan(b);
    routes.push(
      buildRectLoop(
        `expansion-${b}-cw`,
        b === 0 ? "Skyline Heights Ring" : b === 1 ? "Innovation Ridge Ring" : "Horizon Estates Ring",
        -span,
        span,
        -span,
        span,
        b % 2 === 0,
        true
      )
    );
  }

  return routes;
}

/**
 * Samples a smooth vehicle position & heading yaw along any closed `TrafficRoute`,
 * applying quadratic corner fillets at every intersection so cars steer along natural curves!
 */
export function sampleRoutePose(
  route: TrafficRoute,
  distance: number
): { x: number; z: number; yaw: number } {
  const total = route.totalLength;
  const d = ((distance % total) + total) % total;
  const n = route.waypoints.length;

  let segIdx = 0;
  for (let i = 0; i < n; i++) {
    const start = route.segStarts[i];
    const end = start + route.segLengths[i];
    if (d >= start && (d < end || i === n - 1)) {
      segIdx = i;
      break;
    }
  }

  const segLen = route.segLengths[segIdx];
  const localD = d - route.segStarts[segIdx];

  const prevWp = route.waypoints[(segIdx - 1 + n) % n];
  const a = route.waypoints[segIdx];
  const b = route.waypoints[(segIdx + 1) % n];
  const nextWp = route.waypoints[(segIdx + 2) % n];

  const dx = (b.x - a.x) / (segLen || 1);
  const dz = (b.z - a.z) / (segLen || 1);

  const rStart = Math.min(TRAFFIC_CORNER_RADIUS, segLen * 0.3, route.segLengths[(segIdx - 1 + n) % n] * 0.3);
  const rEnd = Math.min(TRAFFIC_CORNER_RADIUS, segLen * 0.3, route.segLengths[(segIdx + 1) % n] * 0.3);

  // Smooth exit half of corner at waypoint `a`
  if (localD < rStart && rStart > 0.05) {
    const prevLen = route.segLengths[(segIdx - 1 + n) % n] || 1;
    const pdx = (a.x - prevWp.x) / prevLen;
    const pdz = (a.z - prevWp.z) / prevLen;
    const p0x = a.x - pdx * rStart;
    const p0z = a.z - pdz * rStart;
    const p2x = a.x + dx * rStart;
    const p2z = a.z + dz * rStart;
    const u = 0.5 + (localD / rStart) * 0.5;
    const inv = 1 - u;
    const x = inv * inv * p0x + 2 * inv * u * a.x + u * u * p2x;
    const z = inv * inv * p0z + 2 * inv * u * a.z + u * u * p2z;
    const tx = 2 * inv * (a.x - p0x) + 2 * u * (p2x - a.x);
    const tz = 2 * inv * (a.z - p0z) + 2 * u * (p2z - a.z);
    return { x, z, yaw: Math.atan2(tx, tz) };
  }

  // Smooth entry half of corner approaching waypoint `b`
  if (localD > segLen - rEnd && rEnd > 0.05) {
    const nextLen = route.segLengths[(segIdx + 1) % n] || 1;
    const ndx = (nextWp.x - b.x) / nextLen;
    const ndz = (nextWp.z - b.z) / nextLen;
    const p0x = b.x - dx * rEnd;
    const p0z = b.z - dz * rEnd;
    const p2x = b.x + ndx * rEnd;
    const p2z = b.z + ndz * rEnd;
    const u = ((localD - (segLen - rEnd)) / rEnd) * 0.5;
    const inv = 1 - u;
    const x = inv * inv * p0x + 2 * inv * u * b.x + u * u * p2x;
    const z = inv * inv * p0z + 2 * inv * u * b.z + u * u * p2z;
    const tx = 2 * inv * (b.x - p0x) + 2 * u * (p2x - b.x);
    const tz = 2 * inv * (b.z - p0z) + 2 * u * (p2z - b.z);
    return { x, z, yaw: Math.atan2(tx, tz) };
  }

  return {
    x: a.x + dx * localD,
    z: a.z + dz * localD,
    yaw: Math.atan2(dx, dz)
  };
}

/**
 * Checks whether a vehicle at `(vx, vz)` facing `vYaw` should politely brake & yield
 * to a pedestrian/obstacle at `(ox, oz)` inside its forward safety cone.
 */
export function shouldVehicleYield(
  vx: number,
  vz: number,
  vYaw: number,
  ox: number,
  oz: number,
  lookAhead = 2.65,
  halfWidth = 1.05
): boolean {
  const rx = ox - vx;
  const rz = oz - vz;
  const distSq = rx * rx + rz * rz;
  if (distSq > lookAhead * lookAhead) return false;
  const fx = Math.sin(vYaw);
  const fz = Math.cos(vYaw);
  const forward = rx * fx + rz * fz;
  if (forward < 0.25 || forward > lookAhead) return false;
  const lateral = Math.abs(rx * fz - rz * fx);
  return lateral <= halfWidth;
}

/**
 * Computes how many autonomous vehicles should cruise the town streets given minted supply & device tier.
 */
export function computeVehicleCountForTown(totalMintedLabs: number, maxVehicles: number): number {
  const n = Math.max(1, totalMintedLabs);
  const desired = n >= 40 ? 12 : n >= 22 ? 10 : n >= 12 ? 8 : n >= 5 ? 6 : 4;
  return Math.max(3, Math.min(maxVehicles, desired));
}

const FLEET_ROSTER: ReadonlyArray<VehicleBlueprint> = [
  {
    id: "veh-1",
    kind: "ev-sedan",
    label: "Pearl EV Sedan",
    bodyHex: "#f1f5f9",
    accentHex: "#38bdf8",
    routeIndex: 0,
    initialFraction: 0.12,
    cruiseSpeed: 3.1
  },
  {
    id: "veh-2",
    kind: "garden-truck",
    label: "Botanical Flower Truck",
    bodyHex: "#d1fae5",
    accentHex: "#10b981",
    routeIndex: 2,
    initialFraction: 0.08,
    cruiseSpeed: 2.85
  },
  {
    id: "veh-3",
    kind: "research-van",
    label: "Alchemia Courier Van",
    bodyHex: "#ffffff",
    accentHex: "#6366f1",
    routeIndex: 1,
    initialFraction: 0.48,
    cruiseSpeed: 2.95
  },
  {
    id: "veh-4",
    kind: "micro-coupe",
    label: "Sky-Blue EV Roadster",
    bodyHex: "#bae6fd",
    accentHex: "#0284c7",
    routeIndex: 3,
    initialFraction: 0.35,
    cruiseSpeed: 3.55
  },
  {
    id: "veh-5",
    kind: "eco-bus",
    label: "Alchemia Eco Streetcar",
    bodyHex: "#f8fafc",
    accentHex: "#0ea5e9",
    routeIndex: 2,
    initialFraction: 0.58,
    cruiseSpeed: 2.65
  },
  {
    id: "veh-6",
    kind: "micro-coupe",
    label: "Blossom Pink Micro-EV",
    bodyHex: "#fbcfe8",
    accentHex: "#ec4899",
    routeIndex: 4,
    initialFraction: 0.22,
    cruiseSpeed: 3.35
  },
  {
    id: "veh-7",
    kind: "ev-sedan",
    label: "Lavender Research Sedan",
    bodyHex: "#e9d5ff",
    accentHex: "#8b5cf6",
    routeIndex: 5,
    initialFraction: 0.65,
    cruiseSpeed: 3.15
  },
  {
    id: "veh-8",
    kind: "garden-truck",
    label: "Sunlit Nursery Pickup",
    bodyHex: "#fef3c7",
    accentHex: "#f59e0b",
    routeIndex: 3,
    initialFraction: 0.82,
    cruiseSpeed: 2.8
  },
  {
    id: "veh-9",
    kind: "research-van",
    label: "Cryo Sample Van",
    bodyHex: "#e0f2fe",
    accentHex: "#0ea5e9",
    routeIndex: 6, // Expansion Band 0 (falls back cleanly if band 0 not built yet)
    initialFraction: 0.14,
    cruiseSpeed: 3.3
  },
  {
    id: "veh-10",
    kind: "ev-sedan",
    label: "Silver Horizon EV",
    bodyHex: "#cbd5e1",
    accentHex: "#38bdf8",
    routeIndex: 6,
    initialFraction: 0.64,
    cruiseSpeed: 3.45
  },
  {
    id: "veh-11",
    kind: "eco-bus",
    label: "Expansion Express Shuttle",
    bodyHex: "#ffffff",
    accentHex: "#10b981",
    routeIndex: 7,
    initialFraction: 0.28,
    cruiseSpeed: 2.9
  },
  {
    id: "veh-12",
    kind: "micro-coupe",
    label: "Mint City Coupe",
    bodyHex: "#a7f3d0",
    accentHex: "#059669",
    routeIndex: 0,
    initialFraction: 0.62,
    cruiseSpeed: 3.25
  }
];

export function selectActiveVehicleBlueprints(
  totalMintedLabs: number,
  maxVehicles: number,
  availableRouteCount: number
): VehicleBlueprint[] {
  const count = computeVehicleCountForTown(totalMintedLabs, maxVehicles);
  return FLEET_ROSTER.slice(0, count).map((bp) => ({
    ...bp,
    routeIndex: bp.routeIndex < availableRouteCount ? bp.routeIndex : bp.routeIndex % Math.max(1, availableRouteCount)
  }));
}
