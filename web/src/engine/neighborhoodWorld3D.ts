import * as THREE from "three";
import {
  createDistrictGroundTexture,
  createGardenPathTexture,
  createIntersectionPavementTexture,
  createMoodBubbleTexture,
  createPavedRoadTexture,
  createRadialGlowTexture,
  type MoodBubbleKind
} from "./architectTextures";
import {
  createFastArchitecturalGlass,
  detectDevicePerfProfile,
  type DevicePerfProfile
} from "./browserCompat";
import { ResearcherAvatar3D } from "./character3D";
import { TownTraffic3D } from "./townVehicles3D";
import {
  COMMUNITY_FOUNTAIN_POS,
  TOWN_PARK_CENTER,
  TOWN_STREETS,
  computeNeighborhoodPlacements,
  computeUpcomingBlueprintLots,
  deriveNeighborCharacterProfile,
  getExpansionBandAvenueSpan,
  getExpansionBandCount,
  getNeighborhoodGrowthStage,
  getNeighborhoodWalkLimit,
  type NeighborLabSummary,
  type NeighborhoodPlotPlacement,
  type UpcomingBlueprintLot
} from "./neighborhoodLayout";
import { deriveTraitsFromSeed } from "./prng";
import {
  getNeighborSimsStatus,
  loadRelationshipsMap,
  type SimsObjectTarget
} from "./simsState";
import { countSectors, hasSector } from "../web3/sectors";

export type WorldSkyMood = "daylight" | "golden" | "silver" | "moonlit";

interface NeighborPlotRig {
  tokenId: number;
  sectorsMask: number;
  complexityTier: number;
  placement: NeighborhoodPlotPlacement;
  group: THREE.Group;
  popScale: number;
  spinner?: THREE.Object3D;
  proteinRing?: THREE.Object3D;
  windowGlowMats: THREE.MeshStandardMaterial[];
  conduitFiber?: THREE.Mesh;
  conduitPulse?: { mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; t: number; speed: number };
}

interface BlueprintLotRig {
  lot: UpcomingBlueprintLot;
  group: THREE.Group;
  beaconRing: THREE.Mesh;
}

interface NeighborNpcRig {
  tokenId: number;
  name: string;
  avatar: ResearcherAvatar3D;
  homeX: number;
  homeZ: number;
  patrolX: number;
  patrolZ: number;
  x: number;
  z: number;
  yaw: number;
  goingToPatrol: boolean;
  pauseTimer: number;
  wavedRecently: number;
  bubbleTimer: number;
  bubbleSprite: THREE.Sprite | null;
}

interface SocialBeamFX {
  mesh: THREE.Mesh;
  curve: THREE.CatmullRomCurve3;
  t: number;
  line: THREE.Mesh;
}

interface ConstructionBurstFX {
  ring: THREE.Mesh;
  pillar: THREE.Mesh;
  life: number;
}

const SKY_VERT = `
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = `
  precision mediump float;
  varying vec3 vWorldPos;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;

  void main() {
    vec3 dir = normalize(vWorldPos);
    float h = clamp(dir.y * 1.35 + 0.08, 0.0, 1.0);
    vec3 sky = mix(uHorizon, uZenith, pow(h, 0.65));

    float sunDot = max(0.0, dot(dir, normalize(uSunDir)));
    float sunGlow = pow(sunDot, 10.0) * 0.42;
    float sunDisc = smoothstep(0.9965, 0.9992, sunDot) * 0.95;
    sky += uSunColor * (sunGlow + sunDisc);

    gl_FragColor = vec4(sky, 1.0);
  }
`;

const CANAL_VERT = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vWave;
  void main() {
    vUv = uv;
    vec3 pos = position;
    float w = sin(pos.x * 1.2 + uTime * 1.7) * cos(pos.y * 1.2 - uTime * 1.4) * 0.025;
    pos.z += w;
    vWave = w;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const CANAL_FRAG = `
  precision mediump float;
  varying vec2 vUv;
  varying float vWave;
  uniform vec3 uWaterDeep;
  uniform vec3 uWaterCrest;
  void main() {
    float c = smoothstep(-0.02, 0.025, vWave);
    vec3 col = mix(uWaterDeep, uWaterCrest, c);
    gl_FragColor = vec4(col, 0.8);
  }
`;

/**
 * Super-Graphical Ever-Growing Sims-Style Minted NFT Neighborhood World in Three.js.
 *
 * Features a complete living architectural town that expands organically with every mint:
 *  - Custom GLSL Sky Dome (Daylight / Golden Hour / Silver / Twilight Mist + twilight stars)
 *  - 4 Cardinal Tree-Lined Boulevards, Pedestrian Crosswalks, Inner Ring Road, Shimmering
 *    GLSL Reflecting Canal, 4 Arched Alabaster Canal Bridges, Outer Suburb Boulevard & City Parkway
 *  - Instanced Stylized Botanical Trees, Architectural Hedges, Pocket Park Benches & Dusk Streetlamps
 *  - Central Community Research Fountain scaling with globalImpactEth
 *  - Ring 1 (8 walkable inner homes) + Ring 2 (16 walkable canal-side suburb estates with lawns,
 *    driveways & mailboxes!) + Ring 3 (96+ growing outer skyline towers up to 120+ minted NFTs!)
 *  - Holographic "Next Mint" Surveyed Blueprint Lots waiting down the street that burst into real homes
 *  - Autonomous Strolling Neighbor NPC Researchers across both Inner & Suburb streets
 *  - Unlockable Glowing Hover-Shuttle Transit Pod cruising the Suburb Boulevard at 10+ labs!
 */
export class NeighborhoodWorld3D {
  public readonly group = new THREE.Group();
  private expansionInfraGroup = new THREE.Group();
  private neighborsGroup = new THREE.Group();
  private blueprintsGroup = new THREE.Group();
  private npcsGroup = new THREE.Group();
  private fxGroup = new THREE.Group();

  private terrazzoTex: THREE.Texture;
  private titaniumTex: THREE.Texture;
  private groundTex: THREE.CanvasTexture;
  private ownedTextures: THREE.Texture[] = [];
  private beamGlowTextures = new Map<string, THREE.CanvasTexture>();
  private bubbleTextures: Partial<Record<MoodBubbleKind, THREE.CanvasTexture>> = {};

  // Shared road & streetscape materials reused across dynamically paved Outer Expansion Ring Roads!
  private pavedRoadMat!: THREE.MeshStandardMaterial;
  private intersectionMat!: THREE.MeshStandardMaterial;
  private sidewalkMat!: THREE.MeshStandardMaterial;
  private laneLineMat!: THREE.MeshBasicMaterial;
  private stripeMat!: THREE.MeshBasicMaterial;
  private metalMat!: THREE.MeshStandardMaterial;
  // Shared neighbor house & yard materials reused across up to 240+ minted plots (drastically reduces WebGL state switches!)
  private sharedNeighborStoneMat!: THREE.MeshStandardMaterial;
  private sharedNeighborMetalMat!: THREE.MeshStandardMaterial;
  private sharedNeighborGlassMat!: THREE.Material;
  private sharedYardLawnMat!: THREE.MeshStandardMaterial;
  private sharedHedgeMat!: THREE.MeshStandardMaterial;
  private sharedWoodBedMat!: THREE.MeshStandardMaterial;
  private sharedFenceMat!: THREE.MeshStandardMaterial;
  private sharedMaterialsSet = new Set<THREE.Material>();
  private canalBridgesBuilt = false;
  private builtExpansionBands = 0;

  // Cached per-frame zero-allocation buffers & dirty-tracked query arrays
  private cachedRaycastTargets: THREE.Object3D[] | null = null;
  private cachedObstacles: Array<[number, number, number]> | null = null;
  private npcCoordBuf: Array<[number, number]> = [];
  private frameCounter = 0;

  private skyMat: THREE.ShaderMaterial;
  private canalMat!: THREE.ShaderMaterial;
  private starPoints: THREE.Points;
  private clouds: Array<{ group: THREE.Group; angle: number; radius: number; y: number; speed: number }> = [];
  private lampBulbs: THREE.MeshStandardMaterial[] = [];
  private lampHalos: THREE.Sprite[] = [];

  private fountainGroup = new THREE.Group();
  private fountainSpire: THREE.Mesh | null = null;
  private fountainHalo: THREE.Mesh | null = null;

  // Autonomous right-hand-lane driving electric sedans, flower trucks, research vans & eco buses!
  private traffic: TownTraffic3D;
  private perfProfile: DevicePerfProfile;

  // Civic Hover-Shuttle gliding along the Outer Suburb Boulevard (unlocks at 10+ minted labs!)
  private shuttleGroup: THREE.Group | null = null;
  private shuttleAngle = 0.4;
  private shuttleVisible = false;

  private plotRigs = new Map<number, NeighborPlotRig>();
  private blueprintRigs: BlueprintLotRig[] = [];
  private npcRigs: NeighborNpcRig[] = [];
  private socialBeams: SocialBeamFX[] = [];
  private constructionFx: ConstructionBurstFX[] = [];
  private lastPlacements: NeighborhoodPlotPlacement[] = [];
  private knownTokenIds = new Set<number>();
  private initializedRoster = false;

  constructor(
    terrazzoTex: THREE.Texture,
    titaniumTex: THREE.Texture,
    perfProfile?: DevicePerfProfile
  ) {
    this.perfProfile = perfProfile ?? detectDevicePerfProfile();
    this.terrazzoTex = terrazzoTex;
    this.titaniumTex = titaniumTex;
    this.groundTex = createDistrictGroundTexture();
    this.groundTex.wrapS = THREE.RepeatWrapping;
    this.groundTex.wrapT = THREE.RepeatWrapping;
    this.groundTex.repeat.set(3.8, 3.8);

    // Initialize shared neighbor architecture & yard materials once for all 240+ minted plots
    this.sharedNeighborStoneMat = new THREE.MeshStandardMaterial({
      map: this.terrazzoTex,
      color: "#f4f7fb",
      roughness: 0.46
    });
    this.sharedNeighborMetalMat = new THREE.MeshStandardMaterial({
      map: this.titaniumTex,
      color: "#cfd8e6",
      roughness: 0.22,
      metalness: 0.88
    });
    this.sharedNeighborGlassMat = createFastArchitecturalGlass({
      color: "#eaf4ff",
      roughness: 0.08,
      opacity: 0.56
    });
    this.sharedYardLawnMat = new THREE.MeshStandardMaterial({ color: "#bbf7d0", roughness: 0.85 });
    this.sharedHedgeMat = new THREE.MeshStandardMaterial({ color: "#4ade80", roughness: 0.7 });
    this.sharedWoodBedMat = new THREE.MeshStandardMaterial({ color: "#c8a986", roughness: 0.68 });
    this.sharedFenceMat = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.44 });
    [
      this.sharedNeighborStoneMat,
      this.sharedNeighborMetalMat,
      this.sharedNeighborGlassMat,
      this.sharedYardLawnMat,
      this.sharedHedgeMat,
      this.sharedWoodBedMat,
      this.sharedFenceMat
    ].forEach((m) => this.sharedMaterialsSet.add(m));

    this.traffic = new TownTraffic3D(this.perfProfile.maxTrafficVehicles);

    this.group.add(this.expansionInfraGroup);
    this.group.add(this.traffic.group);
    this.group.add(this.neighborsGroup);
    this.group.add(this.blueprintsGroup);
    this.group.add(this.npcsGroup);
    this.group.add(this.fxGroup);

    // 1. Custom GLSL Procedural Sky Dome (expanded for unbounded metropolis skyline!)
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uZenith: { value: new THREE.Color("#dbeafe") },
        uHorizon: { value: new THREE.Color("#f8fafd") },
        uSunColor: { value: new THREE.Color("#fff7ed") },
        uSunDir: { value: new THREE.Vector3(0.45, 0.62, -0.55) }
      }
    });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(168, 32, 20), this.skyMat);
    this.group.add(skyDome);

    // Subtle Twilight Stars (fade in cleanly during moonlit mode)
    const starPositions = new Float32Array(220 * 3);
    for (let i = 0; i < 220; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.42;
      const r = 142;
      starPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      starPositions[i * 3 + 1] = Math.cos(phi) * r + 8;
      starPositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    this.starPoints = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: "#ffffff", size: 0.62, transparent: true, opacity: 0 })
    );
    this.group.add(this.starPoints);

    // 2. Sculpted Stylized Drifting Porcelain Clouds
    this.buildClouds();

    // 3. Expanded Landscaped Valley Ground + Streets + GLSL Canal + 4 Arched Canal Bridges
    this.buildTownRoadsAndCanal();

    // 4. Instanced Stylized Botanical Trees & Park Hedges (Ultra-Low Draw Calls!)
    this.buildInstancedTownParks();

    // 5. Architectural Streetlamps along Inner & Outer Suburb Boulevards
    this.buildStreetlamps();

    // 6. Central Community Research Fountain & Global Impact Spire
    this.buildCommunityFountain();

    // 7. Civic Hover-Shuttle Pod (glides along the Suburb Boulevard at 10+ minted labs!)
    this.buildTransitShuttle();
  }

  private buildClouds() {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      roughness: 0.85,
      metalness: 0.02,
      flatShading: true,
      transparent: true,
      opacity: 0.92
    });
    const puffGeo = new THREE.IcosahedronGeometry(1, 1);

    for (let i = 0; i < 16; i++) {
      const cGroup = new THREE.Group();
      const puffs = 3 + (i % 2);
      for (let p = 0; p < puffs; p++) {
        const m = new THREE.Mesh(puffGeo, cloudMat);
        const s = p === 0 ? 1.65 : 1.05 + (p % 2) * 0.3;
        m.scale.set(s * 1.45, s * 0.52, s * 0.98);
        m.position.set((p - 1) * 1.35, p === 0 ? 0.18 : -0.06, (p % 2) * 0.4);
        cGroup.add(m);
      }
      const angle = (i / 16) * Math.PI * 2;
      const radius = 26 + (i % 4) * 11.5;
      const y = 15.5 + (i % 4) * 2.8;
      cGroup.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      this.group.add(cGroup);
      this.clouds.push({ group: cGroup, angle, radius, y, speed: 0.009 + (i % 3) * 0.003 });
    }
  }

  private applyWorldTopUVs(
    geo: THREE.BoxGeometry,
    tileSize: number,
    swapAxes = false
  ): THREE.BoxGeometry {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const norm = geo.attributes.normal as THREE.BufferAttribute;
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      if (norm.getY(i) > 0.5) {
        const u = pos.getX(i) / tileSize + 0.5;
        const v = pos.getZ(i) / tileSize + 0.5;
        uv.setXY(i, swapAxes ? v : u, swapAxes ? u : v);
      }
    }
    uv.needsUpdate = true;
    return geo;
  }

  private buildTownRoadsAndCanal() {
    const roadTex = createPavedRoadTexture();
    const intersectionTex = createIntersectionPavementTexture();
    const gardenPathTex = createGardenPathTexture();
    gardenPathTex.repeat.set(6, 6);
    this.ownedTextures.push(roadTex, intersectionTex, gardenPathTex);

    this.pavedRoadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      color: "#cfd8e4",
      roughness: 0.72,
      metalness: 0.08
    });
    this.intersectionMat = new THREE.MeshStandardMaterial({
      map: intersectionTex,
      color: "#cfd8e4",
      roughness: 0.72,
      metalness: 0.08
    });
    this.sidewalkMat = new THREE.MeshStandardMaterial({
      map: this.terrazzoTex,
      color: "#f4f7fb",
      roughness: 0.48
    });
    this.laneLineMat = new THREE.MeshBasicMaterial({
      color: "#f8fafc",
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
    this.stripeMat = new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
    this.metalMat = new THREE.MeshStandardMaterial({
      map: this.titaniumTex,
      color: "#cbd5e1",
      roughness: 0.22,
      metalness: 0.88
    });
    const signBoardMat = new THREE.MeshStandardMaterial({
      color: "#475569",
      roughness: 0.36,
      metalness: 0.35
    });

    const pavedRoadMat = this.pavedRoadMat;
    const intersectionMat = this.intersectionMat;
    const sidewalkMat = this.sidewalkMat;
    const laneLineMat = this.laneLineMat;
    const stripeMat = this.stripeMat;
    const metalMat = this.metalMat;
    const applyWorldTopUVs = (geo: THREE.BoxGeometry, tileSize: number, swapAxes = false) =>
      this.applyWorldTopUVs(geo, tileSize, swapAxes);

    // Wide Sunlit Botanical Meadow Valley Parkland Terrain with clean rectangular
    // architectural foundation cutout under Plot #1 so the sunken B1 Basement opens cleanly!
    const meadowRadius = 144;
    const meadowShape = new THREE.Shape();
    meadowShape.absarc(0, 0, meadowRadius, 0, Math.PI * 2, false);
    const basementCut = 3.5;
    const holePath = new THREE.Path();
    holePath.moveTo(-basementCut, -basementCut);
    holePath.lineTo(basementCut, -basementCut);
    holePath.lineTo(basementCut, basementCut);
    holePath.lineTo(-basementCut, basementCut);
    holePath.closePath();
    meadowShape.holes.push(holePath);

    const groundGeo = new THREE.ShapeGeometry(meadowShape, 64);
    // Normalize ShapeGeometry UVs from world [-144..144] to [0..1]
    const uvAttr = groundGeo.attributes.uv as THREE.BufferAttribute;
    const posAttr = groundGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i++) {
      uvAttr.setXY(
        i,
        posAttr.getX(i) / (meadowRadius * 2) + 0.5,
        posAttr.getY(i) / (meadowRadius * 2) + 0.5
      );
    }
    uvAttr.needsUpdate = true;

    const ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({
        map: this.groundTex,
        roughness: 0.9,
        metalness: 0.02
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.024;
    ground.receiveShadow = true;
    this.group.add(ground);

    // Outer Scenic Reflecting Canal Perimeter framing the entire planned neighborhood (r = 30.2 .. 32.0)
    this.canalMat = new THREE.ShaderMaterial({
      vertexShader: CANAL_VERT,
      fragmentShader: CANAL_FRAG,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uWaterDeep: { value: new THREE.Color("#93c5fd") },
        uWaterCrest: { value: new THREE.Color("#e0f2fe") }
      }
    });
    const canal = new THREE.Mesh(new THREE.RingGeometry(30.2, 32.0, 96, 4), this.canalMat);
    canal.rotation.x = -Math.PI / 2;
    canal.position.y = -0.008;
    this.group.add(canal);

    // ---- ZERO-OVERLAP ORTHOGONAL NEIGHBORHOOD PAVED STREET GRID (4 N-S × 4 E-W Streets!) ----
    // Every street is cleanly segmented BETWEEN the 16 intersections so ZERO road or sidewalk meshes
    // ever overlap or z-fight! Raised sidewalks (top y = 0.048) cleanly flank paved streets (top y = 0.024).
    const gridHalf = 30;
    const roadW = TOWN_STREETS.roadWidth; // 2.2m
    const walkW = TOWN_STREETS.sidewalkTotalWidth; // 3.3m
    const halfRoad = roadW / 2; // 1.1m
    const halfWalk = walkW / 2; // 1.65m
    const curbW = halfWalk - halfRoad; // 0.55m
    const curbOffset = halfRoad + curbW / 2; // 1.375m

    const roadH = 0.036;
    const roadCenterY = 0.006; // top surface = +0.024
    const walkH = 0.06;
    const walkCenterY = 0.018; // top surface = +0.048 (crisp 2.4cm raised architectural curb!)
    const paintY = 0.034; // 10mm above road surface + polygonOffset(-2) -> zero z-fighting at any zoom!

    const buildSegments = (crossCoords: readonly number[]): Array<[number, number]> => {
      const sorted = [...crossCoords].sort((a, b) => a - b);
      const segs: Array<[number, number]> = [];
      let cursor = -gridHalf;
      for (const c of sorted) {
        const end = c - halfWalk;
        if (end - cursor > 0.05) segs.push([cursor, end]);
        cursor = c + halfWalk;
      }
      if (gridHalf - cursor > 0.05) segs.push([cursor, gridHalf]);
      return segs;
    };

    const nsSegments = buildSegments(TOWN_STREETS.ew);
    const ewSegments = buildSegments(TOWN_STREETS.ns);

    // Batch ALL road lane dashes, crosswalk zebra stripes & stop bars into InstancedMeshes
    // (cuts ~280+ individual draw calls down to just 2 ultra-fast GPU instanced draw calls!)
    const dashTransforms: Array<{ x: number; z: number; sx: number; sz: number }> = [];
    const stripeTransforms: Array<{ x: number; z: number; sx: number; sz: number }> = [];

    // 1. Non-overlapping North-South paved street blocks & flanking raised curb sidewalks
    for (const sx of TOWN_STREETS.ns) {
      for (const [zA, zB] of nsSegments) {
        const len = zB - zA;
        const zMid = (zA + zB) * 0.5;

        const roadGeo = applyWorldTopUVs(new THREE.BoxGeometry(roadW, roadH, len), 2.2, false);
        const road = new THREE.Mesh(roadGeo, pavedRoadMat);
        road.position.set(sx, roadCenterY, zMid);
        road.receiveShadow = true;
        this.group.add(road);

        for (const side of [-1, 1]) {
          const swGeo = applyWorldTopUVs(new THREE.BoxGeometry(curbW, walkH, len), 2.4, false);
          const sw = new THREE.Mesh(swGeo, sidewalkMat);
          sw.position.set(sx + side * curbOffset, walkCenterY, zMid);
          sw.receiveShadow = true;
          this.group.add(sw);
        }

        // Dashed white center lane dashes cleanly inside this block segment (clear of stop bars)
        for (let z = zA + 1.1; z <= zB - 1.1; z += 2.4) {
          dashTransforms.push({ x: sx, z, sx: 0.085, sz: 0.9 });
        }
      }
    }

    // 2. Non-overlapping East-West paved street blocks & flanking raised curb sidewalks
    for (const sz of TOWN_STREETS.ew) {
      for (const [xA, xB] of ewSegments) {
        const len = xB - xA;
        const xMid = (xA + xB) * 0.5;

        const roadGeo = applyWorldTopUVs(new THREE.BoxGeometry(len, roadH, roadW), 2.2, true);
        const road = new THREE.Mesh(roadGeo, pavedRoadMat);
        road.position.set(xMid, roadCenterY, sz);
        road.receiveShadow = true;
        this.group.add(road);

        for (const side of [-1, 1]) {
          const swGeo = applyWorldTopUVs(new THREE.BoxGeometry(len, walkH, curbW), 2.4, false);
          const sw = new THREE.Mesh(swGeo, sidewalkMat);
          sw.position.set(xMid, walkCenterY, sz + side * curbOffset);
          sw.receiveShadow = true;
          this.group.add(sw);
        }

        // Dashed white center lane dashes cleanly inside this block segment
        for (let x = xA + 1.1; x <= xB - 1.1; x += 2.4) {
          dashTransforms.push({ x, z: sz, sx: 0.9, sz: 0.085 });
        }
      }
    }

    // 3. Proper Paved 4-Way Intersections (exact non-overlapping tile grid:
    //    center granite plaza square + 4 flush crosswalk road aprons + 4 raised corner curbs!)
    const interCenterGeo = new THREE.BoxGeometry(roadW, roadH, roadW);
    const nsApronGeo = applyWorldTopUVs(new THREE.BoxGeometry(roadW, roadH, curbW), 2.2, false);
    const ewApronGeo = applyWorldTopUVs(new THREE.BoxGeometry(curbW, roadH, roadW), 2.2, true);
    const cornerCurbGeo = applyWorldTopUVs(new THREE.BoxGeometry(curbW, walkH, curbW), 2.4, false);

    for (const sx of TOWN_STREETS.ns) {
      for (const sz of TOWN_STREETS.ew) {
        // Center 2.2m × 2.2m paved granite intersection square (flush at top y = 0.024, ZERO overlap!)
        const centerSquare = new THREE.Mesh(interCenterGeo, intersectionMat);
        centerSquare.position.set(sx, roadCenterY, sz);
        centerSquare.receiveShadow = true;
        this.group.add(centerSquare);

        // 4 Flush Crosswalk Connector Aprons (0.55m × 2.2m) + 4-Way Zebra Crosswalk Stripes & Stop Bars
        for (const side of [-1, 1]) {
          const nsApron = new THREE.Mesh(nsApronGeo, pavedRoadMat);
          nsApron.position.set(sx, roadCenterY, sz + side * curbOffset);
          nsApron.receiveShadow = true;
          const ewApron = new THREE.Mesh(ewApronGeo, pavedRoadMat);
          ewApron.position.set(sx + side * curbOffset, roadCenterY, sz);
          ewApron.receiveShadow = true;
          this.group.add(nsApron, ewApron);

          for (const off of [-0.66, -0.22, 0.22, 0.66]) {
            stripeTransforms.push({ x: sx + off, z: sz + side * curbOffset, sx: 0.18, sz: 0.42 });
            stripeTransforms.push({ x: sx + side * curbOffset, z: sz + off, sx: 0.42, sz: 0.18 });
          }

          // Crisp architectural pedestrian stop bars just behind each crosswalk
          dashTransforms.push({ x: sx, z: sz + side * (halfWalk + 0.14), sx: roadW - 0.18, sz: 0.075 });
          dashTransforms.push({ x: sx + side * (halfWalk + 0.14), z: sz, sx: 0.075, sz: roadW - 0.18 });
        }

        // 4 Raised Corner Sidewalk Quadrants (0.55m × 0.55m, flush with flanking sidewalks at top y = 0.048!)
        for (const cx of [-1, 1]) {
          for (const cz of [-1, 1]) {
            const corner = new THREE.Mesh(cornerCurbGeo, sidewalkMat);
            corner.position.set(sx + cx * curbOffset, walkCenterY, sz + cz * curbOffset);
            corner.receiveShadow = true;
            this.group.add(corner);
          }
        }

        // Cute brushed-silver neighborhood street-name corner post at the 4 inner square corners!
        if (Math.abs(sx) < 10 && Math.abs(sz) < 10) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 1.85, 8), metalMat);
          post.position.set(sx + (sx > 0 ? -1.42 : 1.42), 0.94, sz + (sz > 0 ? -1.42 : 1.42));
          const bladeA = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.03), signBoardMat);
          bladeA.position.set(post.position.x, 1.78, post.position.z);
          const bladeB = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.56), signBoardMat);
          bladeB.position.set(post.position.x, 1.64, post.position.z);
          this.group.add(post, bladeA, bladeB);
        }
      }
    }

    // Emit 2 InstancedMeshes for all lane dashes, stop bars & crosswalk stripes
    const unitPlane = new THREE.PlaneGeometry(1, 1);
    unitPlane.rotateX(-Math.PI / 2);
    const dummy = new THREE.Object3D();
    if (dashTransforms.length > 0) {
      const dashInst = new THREE.InstancedMesh(unitPlane, laneLineMat, dashTransforms.length);
      dashTransforms.forEach((tr, idx) => {
        dummy.position.set(tr.x, paintY, tr.z);
        dummy.scale.set(tr.sx, 1, tr.sz);
        dummy.updateMatrix();
        dashInst.setMatrixAt(idx, dummy.matrix);
      });
      dashInst.instanceMatrix.needsUpdate = true;
      dashInst.frustumCulled = false;
      this.group.add(dashInst);
    }
    if (stripeTransforms.length > 0) {
      const stripeInst = new THREE.InstancedMesh(unitPlane, stripeMat, stripeTransforms.length);
      stripeTransforms.forEach((tr, idx) => {
        dummy.position.set(tr.x, paintY, tr.z);
        dummy.scale.set(tr.sx, 1, tr.sz);
        dummy.updateMatrix();
        stripeInst.setMatrixAt(idx, dummy.matrix);
      });
      stripeInst.instanceMatrix.needsUpdate = true;
      stripeInst.frustumCulled = false;
      this.group.add(stripeInst);
    }

    // Welcoming Paved Town Square Plaza connecting your Home Front Gate (z = 4.95) seamlessly
    // up to Main St's North Sidewalk Edge (z = 8.4 - 1.65 = 6.75) with ZERO overlap!
    const squareGeo = applyWorldTopUVs(new THREE.BoxGeometry(6.2, walkH, 1.8), 2.4, false);
    const townSquare = new THREE.Mesh(squareGeo, sidewalkMat);
    townSquare.position.set(0, walkCenterY, 5.85);
    townSquare.receiveShadow = true;
    this.group.add(townSquare);
  }

  private buildInstancedTownParks() {
    // 140+ multi-species boulevard trees (Sage Oaks, Pink Sakura & Slender Cypresses!)
    // lined cleanly along the straight sidewalk tree-lawns & block greenbelts!
    const treePositions: Array<[number, number, number, 0 | 1 | 2]> = [];

    // 1. Boulevard shade trees lining Willow Ln (-6.8), Maple Ln (+6.8), West Park (-21.2) & East Park (+21.2)
    const nsTreeZs = [-25.5, -17.4, -14.2, -10.4, -3.2, 1.2, 4.8, 12.2, 15.8, 18.6, 25.5];
    for (const sx of TOWN_STREETS.ns) {
      const innerOffset = sx < 0 ? 2.1 : -2.1;
      nsTreeZs.forEach((z, idx) => {
        // Keep your center Home Lot edges tidy & avoid driveways
        if (Math.abs(sx) < 10 && z > -5.5 && z < 7.5) return;
        treePositions.push([sx + innerOffset, z, 0.88 + (idx % 3) * 0.16, (idx % 3) as 0 | 1 | 2]);
      });
    }

    // 2. Boulevard shade trees lining Oakwood St (-6.8), Main St (+8.4), North Orchard (-21.2) & South Blossom (+21.6)
    const ewTreeXs = [-25.5, -17.6, -13.6, -9.8, -5.8, 0.0, 5.8, 9.8, 13.6, 17.6, 25.5];
    for (const sz of TOWN_STREETS.ew) {
      const sideOffset = sz < 0 ? 2.1 : -2.1;
      ewTreeXs.forEach((x, idx) => {
        if (Math.abs(x) < 5.2 && sz > -9 && sz < 10) return; // keep Home Lot & Fountain Square airy
        if (TOWN_STREETS.ns.some((nsx) => Math.abs(x - nsx) < 2.4)) return;
        treePositions.push([x, sz + sideOffset, 0.9 + (idx % 3) * 0.16, ((idx + 1) % 3) as 0 | 1 | 2]);
      });
    }

    // 3. Scenic North & South Neighborhood Greenbelt Park Trees (behind Oakwood & Main St inner blocks!)
    for (const x of [-4.6, -1.6, 1.6, 4.6]) {
      treePositions.push([x, -16.8, 1.05, Math.abs(x) > 3 ? 1 : 0]);
      treePositions.push([x, 17.8, 1.05, Math.abs(x) > 3 ? 1 : 2]);
    }

    // 4. Outer Canal Perimeter Greenbelt Grove framing the neighborhood edge
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2 + 0.08;
      const x = Math.cos(a) * 29.1;
      const z = Math.sin(a) * 29.1;
      if (TOWN_STREETS.ns.some((sx) => Math.abs(x - sx) < 2.4)) continue;
      if (TOWN_STREETS.ew.some((sz) => Math.abs(z - sz) < 2.4)) continue;
      treePositions.push([x, z, 1.06 + (i % 3) * 0.2, (i % 3) as 0 | 1 | 2]);
    }

    const count = treePositions.length;
    const trunkGeo = new THREE.CylinderGeometry(0.068, 0.115, 0.78, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: "#78716c", roughness: 0.78 });
    const canopyGeo = new THREE.DodecahedronGeometry(0.5, 0);
    const cypressGeo = new THREE.ConeGeometry(0.36, 1.48, 8);
    const sageMat = new THREE.MeshStandardMaterial({
      color: "#6ee7b7",
      roughness: 0.62,
      flatShading: true
    });
    const blossomMat = new THREE.MeshStandardMaterial({
      color: "#fbcfe8",
      roughness: 0.56,
      flatShading: true
    });
    const cypressMat = new THREE.MeshStandardMaterial({
      color: "#34d399",
      roughness: 0.64,
      flatShading: true
    });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const sageCount = treePositions.filter((t) => t[3] === 0).length;
    const blossomCount = treePositions.filter((t) => t[3] === 1).length;
    const cypressCount = treePositions.filter((t) => t[3] === 2).length;
    const sageCanopies = new THREE.InstancedMesh(canopyGeo, sageMat, Math.max(1, sageCount));
    const blossomCanopies = new THREE.InstancedMesh(canopyGeo, blossomMat, Math.max(1, blossomCount));
    const cypressCanopies = new THREE.InstancedMesh(cypressGeo, cypressMat, Math.max(1, cypressCount));

    const mat4 = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    const euler = new THREE.Euler();

    let sIdx = 0;
    let bIdx = 0;
    let cIdx = 0;
    treePositions.forEach(([x, z, sc, kind], idx) => {
      euler.set(0, idx * 1.1, 0);
      quat.setFromEuler(euler);
      pos.set(x, 0.38 * sc, z);
      scl.set(sc, sc, sc);
      mat4.compose(pos, quat, scl);
      trunks.setMatrixAt(idx, mat4);

      if (kind === 1) {
        pos.set(x, 1.04 * sc, z);
        scl.set(sc * 1.18, sc * 1.24, sc * 1.18);
        mat4.compose(pos, quat, scl);
        blossomCanopies.setMatrixAt(bIdx++, mat4);
      } else if (kind === 2) {
        pos.set(x, 1.25 * sc, z);
        scl.set(sc * 0.95, sc * 1.18, sc * 0.95);
        mat4.compose(pos, quat, scl);
        cypressCanopies.setMatrixAt(cIdx++, mat4);
      } else {
        pos.set(x, 1.04 * sc, z);
        scl.set(sc * 1.16, sc * 1.32, sc * 1.16);
        mat4.compose(pos, quat, scl);
        sageCanopies.setMatrixAt(sIdx++, mat4);
      }
    });

    trunks.instanceMatrix.needsUpdate = true;
    sageCanopies.instanceMatrix.needsUpdate = true;
    blossomCanopies.instanceMatrix.needsUpdate = true;
    cypressCanopies.instanceMatrix.needsUpdate = true;
    trunks.frustumCulled = false;
    sageCanopies.frustumCulled = false;
    blossomCanopies.frustumCulled = false;
    cypressCanopies.frustumCulled = false;
    this.group.add(trunks, sageCanopies, blossomCanopies, cypressCanopies);

    // Instanced Blooming Sidewalk Flower Shrubs along Main St, Oakwood St & Block Corners!
    const shrubCoords: Array<[number, number, boolean]> = [
      [-4.8, 6.2, true],
      [4.8, 6.2, false],
      [-5.1, -4.9, true],
      [5.1, -4.9, false],
      [-8.7, -5.0, true],
      [8.7, -5.0, false],
      [-8.7, 6.5, false],
      [8.7, 6.5, true],
      [-5.0, 10.2, true],
      [5.0, 10.2, false],
      [-5.0, -8.6, false],
      [5.0, -8.6, true],
      [-10.2, 10.2, true],
      [10.2, 10.2, false],
      [-10.2, -10.2, false],
      [10.2, -10.2, true]
    ];

    const shrubGeo = new THREE.IcosahedronGeometry(0.28, 0);
    const shrubMat = new THREE.MeshStandardMaterial({ color: "#4ade80", roughness: 0.72, flatShading: true });
    const bloomTopGeo = new THREE.SphereGeometry(0.09, 6, 6);
    const pinkBloomMat = new THREE.MeshStandardMaterial({ color: "#f472b6", emissive: "#ec4899", emissiveIntensity: 0.18 });
    const violetBloomMat = new THREE.MeshStandardMaterial({ color: "#a78bfa", emissive: "#8b5cf6", emissiveIntensity: 0.18 });

    const shrubsMesh = new THREE.InstancedMesh(shrubGeo, shrubMat, shrubCoords.length);
    const pinkMesh = new THREE.InstancedMesh(bloomTopGeo, pinkBloomMat, shrubCoords.length);
    const violetMesh = new THREE.InstancedMesh(bloomTopGeo, violetBloomMat, shrubCoords.length);

    let pIdx = 0;
    let vIdx = 0;
    shrubCoords.forEach(([sx, sz, isPink], idx) => {
      quat.identity();
      pos.set(sx, 0.14, sz);
      scl.set(1.2, 0.72, 1.2);
      mat4.compose(pos, quat, scl);
      shrubsMesh.setMatrixAt(idx, mat4);

      pos.set(sx + 0.08, 0.3, sz - 0.05);
      scl.set(1, 1, 1);
      mat4.compose(pos, quat, scl);
      if (isPink) pinkMesh.setMatrixAt(pIdx++, mat4);
      else violetMesh.setMatrixAt(vIdx++, mat4);
    });
    pinkMesh.count = pIdx;
    violetMesh.count = vIdx;
    shrubsMesh.instanceMatrix.needsUpdate = true;
    pinkMesh.instanceMatrix.needsUpdate = true;
    violetMesh.instanceMatrix.needsUpdate = true;
    shrubsMesh.frustumCulled = false;
    pinkMesh.frustumCulled = false;
    violetMesh.frustumCulled = false;
    this.group.add(shrubsMesh, pinkMesh, violetMesh);
  }

  private buildStreetlamps() {
    const postGeo = new THREE.CylinderGeometry(0.032, 0.048, 1.9, 8);
    const bulbGeo = new THREE.SphereGeometry(0.11, 10, 10);
    const sharedBulbMat = new THREE.MeshStandardMaterial({
      color: "#fffbeb",
      emissive: "#fbbf24",
      emissiveIntensity: 0.35,
      roughness: 0.14
    });
    this.lampBulbs.push(sharedBulbMat);

    const glowTex = createRadialGlowTexture("#fde68a");
    this.ownedTextures.push(glowTex);
    const sharedHaloMat = new THREE.SpriteMaterial({
      map: glowTex,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    // Place streetlamps cleanly on the sidewalk corners of all 16 grid intersections + block midpoints!
    const lampCoords: Array<[number, number]> = [];
    for (const sx of TOWN_STREETS.ns) {
      for (const sz of TOWN_STREETS.ew) {
        lampCoords.push([sx + (sx > 0 ? 1.52 : -1.52), sz + (sz > 0 ? 1.52 : -1.52)]);
      }
    }
    lampCoords.push(
      [-5.25, 0.8],
      [5.25, 0.8],
      [0, -5.25],
      [-5.25, 6.8],
      [5.25, 6.8]
    );

    // Instance all streetlamp posts & bulbs into 2 draw calls instead of 42!
    const postsMesh = new THREE.InstancedMesh(postGeo, this.metalMat, lampCoords.length);
    const bulbsMesh = new THREE.InstancedMesh(bulbGeo, sharedBulbMat, lampCoords.length);
    const dummy = new THREE.Object3D();

    lampCoords.forEach(([lx, lz], idx) => {
      dummy.position.set(lx, 0.95, lz);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      postsMesh.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(lx, 1.95, lz);
      dummy.updateMatrix();
      bulbsMesh.setMatrixAt(idx, dummy.matrix);

      if (this.perfProfile.tier !== "mobile" || idx % 2 === 0) {
        const halo = new THREE.Sprite(sharedHaloMat);
        halo.scale.set(0.84, 0.84, 1);
        halo.position.set(lx, 1.95, lz);
        this.lampHalos.push(halo);
        this.group.add(halo);
      }
    });

    postsMesh.instanceMatrix.needsUpdate = true;
    bulbsMesh.instanceMatrix.needsUpdate = true;
    postsMesh.frustumCulled = false;
    bulbsMesh.frustumCulled = false;
    this.group.add(postsMesh, bulbsMesh);
  }

  private buildCommunityFountain() {
    const [fx, fz] = COMMUNITY_FOUNTAIN_POS;
    this.fountainGroup.position.set(fx, 0, fz);

    const stoneMat = new THREE.MeshStandardMaterial({
      map: this.terrazzoTex,
      color: "#f7f9fc",
      roughness: 0.42
    });
    const titaniumMat = new THREE.MeshStandardMaterial({
      map: this.titaniumTex,
      color: "#d4dce8",
      roughness: 0.2,
      metalness: 0.9
    });

    const outerBasin = new THREE.Mesh(new THREE.CylinderGeometry(1.48, 1.62, 0.22, 36), stoneMat);
    outerBasin.position.y = 0.11;
    outerBasin.receiveShadow = true;
    this.fountainGroup.add(outerBasin);

    const poolWater = new THREE.Mesh(
      new THREE.CircleGeometry(1.34, 36),
      new THREE.MeshPhysicalMaterial({
        color: "#7dd3fc",
        emissive: "#38bdf8",
        emissiveIntensity: 0.35,
        roughness: 0.05,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.85
      })
    );
    poolWater.rotation.x = -Math.PI / 2;
    poolWater.position.y = 0.23;
    this.fountainGroup.add(poolWater);

    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.56, 0.42, 24), stoneMat);
    plinth.position.y = 0.34;
    this.fountainGroup.add(plinth);

    const spire = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.32, 0),
      createFastArchitecturalGlass({
        color: "#e0f2fe",
        emissive: "#5b8def",
        emissiveIntensity: 0.55,
        roughness: 0.08,
        opacity: 0.9
      })
    );
    spire.scale.set(0.65, 1.9, 0.65);
    spire.position.y = 1.12;
    this.fountainSpire = spire;
    this.fountainGroup.add(spire);

    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.018, 10, 48), titaniumMat);
    halo.rotation.x = Math.PI / 2 - 0.28;
    halo.position.y = 1.18;
    this.fountainHalo = halo;
    this.fountainGroup.add(halo);

    const target: SimsObjectTarget = {
      kind: "fountain",
      label: "Community Research Fountain",
      worldX: fx,
      worldZ: fz - 1.85
    };
    this.fountainGroup.traverse((obj) => {
      obj.userData.simsTarget = target;
    });

    this.group.add(this.fountainGroup);
  }

  /**
   * Sleek Alabaster & Glass Hover-Shuttle Pod that unlocks once the town hits 10+ minted labs
   * and glides smoothly along the Outer Suburb Boulevard ring!
   */
  private buildTransitShuttle() {
    const pod = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({
      map: this.terrazzoTex,
      color: "#ffffff",
      roughness: 0.24,
      metalness: 0.22
    });
    const canopyMat = createFastArchitecturalGlass({
      color: "#e0f2fe",
      roughness: 0.06,
      opacity: 0.62
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: "#38bdf8",
      emissive: "#38bdf8",
      emissiveIntensity: 1.4
    });

    const chassis = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.92, 8, 16), hullMat);
    chassis.rotation.x = Math.PI / 2;
    chassis.scale.set(1.05, 1, 0.72);
    chassis.position.y = 0.42;
    pod.add(chassis);

    const canopy = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.62, 8, 14), canopyMat);
    canopy.rotation.x = Math.PI / 2;
    canopy.position.y = 0.56;
    pod.add(canopy);

    const hoverStrip = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 1.18), glowMat);
    hoverStrip.position.y = 0.24;
    pod.add(hoverStrip);

    pod.visible = false;
    this.shuttleGroup = pod;
    this.group.add(pod);
  }

  public setSkyMood(mood: WorldSkyMood) {
    if (mood === "golden") {
      this.skyMat.uniforms.uZenith.value.set("#c7d2fe");
      this.skyMat.uniforms.uHorizon.value.set("#fde6cc");
      this.skyMat.uniforms.uSunColor.value.set("#fb923c");
      this.skyMat.uniforms.uSunDir.value.set(0.75, 0.22, -0.58);
      this.canalMat.uniforms.uWaterDeep.value.set("#93c5fd");
      this.canalMat.uniforms.uWaterCrest.value.set("#fed7aa");
      (this.starPoints.material as THREE.PointsMaterial).opacity = 0.08;
      this.setNightGlow(0.85, 0.58);
    } else if (mood === "moonlit") {
      this.skyMat.uniforms.uZenith.value.set("#334155");
      this.skyMat.uniforms.uHorizon.value.set("#cbd5e1");
      this.skyMat.uniforms.uSunColor.value.set("#bfdbfe");
      this.skyMat.uniforms.uSunDir.value.set(-0.52, 0.58, -0.62);
      this.canalMat.uniforms.uWaterDeep.value.set("#475569");
      this.canalMat.uniforms.uWaterCrest.value.set("#bae6fd");
      (this.starPoints.material as THREE.PointsMaterial).opacity = 0.78;
      this.setNightGlow(1.45, 0.85);
    } else if (mood === "silver") {
      this.skyMat.uniforms.uZenith.value.set("#dde5f0");
      this.skyMat.uniforms.uHorizon.value.set("#f1f5f9");
      this.skyMat.uniforms.uSunColor.value.set("#ffffff");
      this.skyMat.uniforms.uSunDir.value.set(0.35, 0.75, -0.45);
      this.canalMat.uniforms.uWaterDeep.value.set("#cbd5e1");
      this.canalMat.uniforms.uWaterCrest.value.set("#ffffff");
      (this.starPoints.material as THREE.PointsMaterial).opacity = 0;
      this.setNightGlow(0.45, 0.24);
    } else {
      this.skyMat.uniforms.uZenith.value.set("#d8e9fe");
      this.skyMat.uniforms.uHorizon.value.set("#f8fafd");
      this.skyMat.uniforms.uSunColor.value.set("#fff7ed");
      this.skyMat.uniforms.uSunDir.value.set(0.48, 0.66, -0.52);
      this.canalMat.uniforms.uWaterDeep.value.set("#93c5fd");
      this.canalMat.uniforms.uWaterCrest.value.set("#e0f2fe");
      (this.starPoints.material as THREE.PointsMaterial).opacity = 0;
      this.setNightGlow(0.35, 0.16);
    }
  }

  private setNightGlow(lampEmissive: number, haloOpacity: number) {
    for (const m of this.lampBulbs) m.emissiveIntensity = lampEmissive;
    for (const h of this.lampHalos) (h.material as THREE.SpriteMaterial).opacity = haloOpacity;
    this.traffic.setNightGlow(lampEmissive);
    for (const rig of this.plotRigs.values()) {
      for (const wm of rig.windowGlowMats) {
        wm.emissiveIntensity = Math.max(0.45, lampEmissive * 0.75);
      }
    }
  }

  public setGlobalImpactScale(globalEth: number) {
    if (!this.fountainSpire) return;
    const growth = 1 + Math.min(1.4, Math.log1p(Math.max(0, globalEth)) * 0.35);
    this.fountainSpire.scale.set(0.65, 1.75 * growth, 0.65);
    this.fountainSpire.position.y = 0.95 + growth * 0.22;
  }

  /**
   * Synchronizes the entire 3D growing town whenever new NFTs are minted or rooms change!
   * Newly minted NFTs rise cleanly out of their surveyed blueprint lots and dynamically pave
   * new Outer Expansion Ring Roads & Canal Bridges as totalSupply grows!
   */
  public syncNeighbors(neighbors: readonly NeighborLabSummary[]): NeighborhoodPlotPlacement[] {
    const placements = computeNeighborhoodPlacements(neighbors);
    this.lastPlacements = placements;

    const growth = getNeighborhoodGrowthStage(placements.length + 1);
    this.shuttleVisible = growth.transitUnlocked;
    if (this.shuttleGroup) {
      this.shuttleGroup.visible = this.shuttleVisible;
    }

    // Dynamically pave Canal Bridges + Outer Expansion Ring Roads whenever minted plots
    // or their upcoming surveyed blueprint lots cross into Ring 3+ expansion districts!
    const upcomingLots = computeUpcomingBlueprintLots(placements.length, 4);
    const neededBands = getExpansionBandCount(placements.length + upcomingLots.length);
    if (neededBands > this.builtExpansionBands) {
      this.ensureExpansionBands(neededBands);
    }

    const nextById = new Map(placements.map((p) => [p.lab.tokenId, p]));

    // Remove stale plots (switched Home Lab) or plots whose rooms/tier/position changed
    for (const [tokenId, rig] of this.plotRigs.entries()) {
      const nextPl = nextById.get(tokenId);
      const changed =
        !nextPl ||
        rig.sectorsMask !== nextPl.lab.sectorsMask ||
        rig.complexityTier !== nextPl.lab.complexityTier ||
        rig.placement.plotIndex !== nextPl.plotIndex;
      if (changed) {
        this.removePlotRig(rig);
        this.plotRigs.delete(tokenId);
      }
    }

    // Add newly minted / discovered / upgraded neighbor labs!
    for (const pl of placements) {
      if (this.plotRigs.has(pl.lab.tokenId)) continue;
      const isFreshMint = this.initializedRoster && !this.knownTokenIds.has(pl.lab.tokenId);
      const rig = this.buildNeighborPlot3D(pl, isFreshMint);
      this.plotRigs.set(pl.lab.tokenId, rig);
      this.neighborsGroup.add(rig.group);
      this.knownTokenIds.add(pl.lab.tokenId);
      if (isFreshMint) {
        const accent = deriveTraitsFromSeed(pl.lab.seed).palette.liquidMid;
        this.spawnConstructionFx(pl.x, pl.z, accent);
      }
    }

    // Rebuild the next 4 upcoming "Next Mint" Holographic Blueprint Lots down the street!
    this.syncUpcomingBlueprintLots(upcomingLots);

    // Sync autonomous driving vehicles fleet across paved streets & newly formed Expansion Rings!
    this.traffic.syncTownScale(placements.length + 1, this.builtExpansionBands);

    // Sync living strolling NPC researchers across BOTH Inner Boulevard (Ring 1) & Canal Suburbs (Ring 2)!
    const walkablePlots = placements
      .filter((p) => p.ring === 1 || p.ring === 2)
      .slice(0, this.perfProfile.maxNpcResearchers);
    this.syncNeighborNpcs(walkablePlots);

    this.initializedRoster = true;
    return placements;
  }

  public triggerVehicleHonk(vehicleId: string) {
    this.traffic.triggerFriendlyHonk(vehicleId);
  }

  public getWalkLimit(): number {
    return getNeighborhoodWalkLimit(this.lastPlacements.length + 1);
  }

  public getBuiltExpansionBands(): number {
    return this.builtExpansionBands;
  }

  private spawnConstructionFx(x: number, z: number, accentHex: string) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.35, 28),
      new THREE.MeshBasicMaterial({
        color: accentHex,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.08, z);

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.55, 5.2, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: accentHex,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    pillar.position.set(x, 2.6, z);

    this.fxGroup.add(ring, pillar);
    this.constructionFx.push({ ring, pillar, life: 1.0 });
  }

  /**
   * Dynamically paves sleek Arched Alabaster Canal Bridges & Zero-Overlap Segmented Outer
   * Expansion Ring Roads whenever minted NFTs expand past the inner 24 neighborhood plots!
   */
  private ensureExpansionBands(neededBands: number) {
    const roadW = TOWN_STREETS.roadWidth; // 2.2m
    const walkW = TOWN_STREETS.sidewalkTotalWidth; // 3.3m
    const halfRoad = roadW / 2; // 1.1m
    const halfWalk = walkW / 2; // 1.65m
    const curbW = halfWalk - halfRoad; // 0.55m
    const curbOffset = halfRoad + curbW / 2; // 1.375m
    const roadH = 0.036;
    const roadCenterY = 0.006; // top = +0.024 (flush with inner grid!)
    const walkH = 0.06;
    const walkCenterY = 0.018; // top = +0.048 (crisp raised limestone curb!)
    const paintY = 0.034;

    const addRoadBlockNS = (sx: number, zA: number, zB: number) => {
      const len = zB - zA;
      if (len < 0.08) return;
      const zMid = (zA + zB) * 0.5;
      const road = new THREE.Mesh(
        this.applyWorldTopUVs(new THREE.BoxGeometry(roadW, roadH, len), 2.2, false),
        this.pavedRoadMat
      );
      road.position.set(sx, roadCenterY, zMid);
      road.receiveShadow = true;
      this.expansionInfraGroup.add(road);

      for (const side of [-1, 1]) {
        const sw = new THREE.Mesh(
          this.applyWorldTopUVs(new THREE.BoxGeometry(curbW, walkH, len), 2.4, false),
          this.sidewalkMat
        );
        sw.position.set(sx + side * curbOffset, walkCenterY, zMid);
        sw.receiveShadow = true;
        this.expansionInfraGroup.add(sw);
      }

      for (let z = zA + 1.1; z <= zB - 1.1; z += 2.5) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.9), this.laneLineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(sx, paintY, z);
        this.expansionInfraGroup.add(dash);
      }
    };

    const addRoadBlockEW = (sz: number, xA: number, xB: number) => {
      const len = xB - xA;
      if (len < 0.08) return;
      const xMid = (xA + xB) * 0.5;
      const road = new THREE.Mesh(
        this.applyWorldTopUVs(new THREE.BoxGeometry(len, roadH, roadW), 2.2, true),
        this.pavedRoadMat
      );
      road.position.set(xMid, roadCenterY, sz);
      road.receiveShadow = true;
      this.expansionInfraGroup.add(road);

      for (const side of [-1, 1]) {
        const sw = new THREE.Mesh(
          this.applyWorldTopUVs(new THREE.BoxGeometry(len, walkH, curbW), 2.4, false),
          this.sidewalkMat
        );
        sw.position.set(xMid, walkCenterY, sz + side * curbOffset);
        sw.receiveShadow = true;
        this.expansionInfraGroup.add(sw);
      }

      for (let x = xA + 1.1; x <= xB - 1.1; x += 2.5) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.085), this.laneLineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(x, paintY, sz);
        this.expansionInfraGroup.add(dash);
      }
    };

    const interCenterGeo = new THREE.BoxGeometry(roadW, roadH, roadW);
    const nsApronGeo = this.applyWorldTopUVs(new THREE.BoxGeometry(roadW, roadH, curbW), 2.2, false);
    const ewApronGeo = this.applyWorldTopUVs(new THREE.BoxGeometry(curbW, roadH, roadW), 2.2, true);
    const nsCurbCapGeo = this.applyWorldTopUVs(new THREE.BoxGeometry(roadW, walkH, curbW), 2.4, false);
    const ewCurbCapGeo = this.applyWorldTopUVs(new THREE.BoxGeometry(curbW, walkH, roadW), 2.4, false);
    const cornerCurbGeo = this.applyWorldTopUVs(new THREE.BoxGeometry(curbW, walkH, curbW), 2.4, false);
    const nsStripeGeo = new THREE.PlaneGeometry(0.18, 0.42);
    const ewStripeGeo = new THREE.PlaneGeometry(0.42, 0.18);

    const addPavedIntersection = (
      ix: number,
      iz: number,
      openN: boolean,
      openS: boolean,
      openW: boolean,
      openE: boolean
    ) => {
      const center = new THREE.Mesh(interCenterGeo, this.intersectionMat);
      center.position.set(ix, roadCenterY, iz);
      center.receiveShadow = true;
      this.expansionInfraGroup.add(center);

      const addSideNS = (side: -1 | 1, open: boolean) => {
        if (open) {
          const ap = new THREE.Mesh(nsApronGeo, this.pavedRoadMat);
          ap.position.set(ix, roadCenterY, iz + side * curbOffset);
          ap.receiveShadow = true;
          this.expansionInfraGroup.add(ap);
          for (const off of [-0.66, -0.22, 0.22, 0.66]) {
            const st = new THREE.Mesh(nsStripeGeo, this.stripeMat);
            st.rotation.x = -Math.PI / 2;
            st.position.set(ix + off, paintY, iz + side * curbOffset);
            this.expansionInfraGroup.add(st);
          }
        } else {
          const cap = new THREE.Mesh(nsCurbCapGeo, this.sidewalkMat);
          cap.position.set(ix, walkCenterY, iz + side * curbOffset);
          cap.receiveShadow = true;
          this.expansionInfraGroup.add(cap);
        }
      };

      const addSideEW = (side: -1 | 1, open: boolean) => {
        if (open) {
          const ap = new THREE.Mesh(ewApronGeo, this.pavedRoadMat);
          ap.position.set(ix + side * curbOffset, roadCenterY, iz);
          ap.receiveShadow = true;
          this.expansionInfraGroup.add(ap);
          for (const off of [-0.66, -0.22, 0.22, 0.66]) {
            const st = new THREE.Mesh(ewStripeGeo, this.stripeMat);
            st.rotation.x = -Math.PI / 2;
            st.position.set(ix + side * curbOffset, paintY, iz + off);
            this.expansionInfraGroup.add(st);
          }
        } else {
          const cap = new THREE.Mesh(ewCurbCapGeo, this.sidewalkMat);
          cap.position.set(ix + side * curbOffset, walkCenterY, iz);
          cap.receiveShadow = true;
          this.expansionInfraGroup.add(cap);
        }
      };

      addSideNS(-1, openN);
      addSideNS(1, openS);
      addSideEW(-1, openW);
      addSideEW(1, openE);

      for (const cx of [-1, 1]) {
        for (const cz of [-1, 1]) {
          const corner = new THREE.Mesh(cornerCurbGeo, this.sidewalkMat);
          corner.position.set(ix + cx * curbOffset, walkCenterY, iz + cz * curbOffset);
          corner.receiveShadow = true;
          this.expansionInfraGroup.add(corner);
        }
      }
    };

    // 1. Build 8 Sleek Alabaster & Glass Canal Bridges once Expansion Band 0 forms!
    //    Connects Willow Ln (-6.8), Maple Ln (+6.8), Oakwood St (-6.8) & Main St (+8.4)
    //    edge-to-edge from inner grid boundary (±30.0) across the reflecting canal to Band 0 (±33.75)!
    if (!this.canalBridgesBuilt && neededBands >= 1) {
      this.canalBridgesBuilt = true;
      const bridgeStart = 30.0;
      const bridgeEnd = getExpansionBandAvenueSpan(0) - halfWalk; // 33.75
      const railGlassMat = createFastArchitecturalGlass({
        color: "#e0f2fe",
        roughness: 0.1,
        opacity: 0.56
      });
      const bollardGlowMat = new THREE.MeshStandardMaterial({
        color: "#e0f2fe",
        emissive: "#38bdf8",
        emissiveIntensity: 0.9
      });
      const bridgeLen = bridgeEnd - bridgeStart;
      const bridgeMid = (bridgeStart + bridgeEnd) * 0.5;

      // North & South Bridges along Willow Ln (-6.8) and Maple Ln (+6.8)
      for (const sx of [-6.8, 6.8]) {
        for (const dir of [-1, 1]) {
          const zA = dir > 0 ? bridgeStart : -bridgeEnd;
          const zB = dir > 0 ? bridgeEnd : -bridgeStart;
          addRoadBlockNS(sx, zA, zB);
          // Sleek side glass balustrades + glowing bridge abutment bollards
          for (const side of [-1, 1]) {
            const rail = new THREE.Mesh(
              new THREE.BoxGeometry(0.06, 0.52, bridgeLen - 0.16),
              railGlassMat
            );
            rail.position.set(sx + side * (halfWalk - 0.05), 0.3, dir * bridgeMid);
            const cap = new THREE.Mesh(
              new THREE.BoxGeometry(0.09, 0.05, bridgeLen - 0.1),
              this.metalMat
            );
            cap.position.set(sx + side * (halfWalk - 0.05), 0.58, dir * bridgeMid);
            const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.72, 8), bollardGlowMat);
            bollard.position.set(sx + side * (halfWalk - 0.05), 0.38, dir * bridgeStart);
            this.expansionInfraGroup.add(rail, cap, bollard);
          }
        }
      }

      // East & West Bridges along Oakwood St (-6.8) and Main St (+8.4)
      for (const sz of [-6.8, 8.4]) {
        for (const dir of [-1, 1]) {
          const xA = dir > 0 ? bridgeStart : -bridgeEnd;
          const xB = dir > 0 ? bridgeEnd : -bridgeStart;
          addRoadBlockEW(sz, xA, xB);
          for (const side of [-1, 1]) {
            const rail = new THREE.Mesh(
              new THREE.BoxGeometry(bridgeLen - 0.16, 0.52, 0.06),
              railGlassMat
            );
            rail.position.set(dir * bridgeMid, 0.3, sz + side * (halfWalk - 0.05));
            const cap = new THREE.Mesh(
              new THREE.BoxGeometry(bridgeLen - 0.1, 0.05, 0.09),
              this.metalMat
            );
            cap.position.set(dir * bridgeMid, 0.58, sz + side * (halfWalk - 0.05));
            const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.72, 8), bollardGlowMat);
            bollard.position.set(dir * bridgeStart, 0.38, sz + side * (halfWalk - 0.05));
            this.expansionInfraGroup.add(rail, cap, bollard);
          }
        }
      }
    }

    // 2. Dynamically build each newly unlocked Outer Expansion Ring Avenue & radial connectors!
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: "#b6987e", roughness: 0.85 });
    const treeFoliageMat = new THREE.MeshStandardMaterial({
      color: "#86efac",
      roughness: 0.72,
      flatShading: true
    });
    const sakuraMat = new THREE.MeshStandardMaterial({
      color: "#fbcfe8",
      roughness: 0.7,
      flatShading: true
    });
    const lampBulbMat = new THREE.MeshStandardMaterial({
      color: "#fffbeb",
      emissive: "#fde68a",
      emissiveIntensity: 0.45
    });
    this.lampBulbs.push(lampBulbMat);

    for (let b = this.builtExpansionBands; b < neededBands; b++) {
      const span = getExpansionBandAvenueSpan(b);

      // East & West Ring Avenues (x = ±span) segmented cleanly between corners & z = -6.8 / +8.4
      const ewSegs: Array<[number, number]> = [
        [-span + halfWalk, -6.8 - halfWalk],
        [-6.8 + halfWalk, 8.4 - halfWalk],
        [8.4 + halfWalk, span - halfWalk]
      ];
      for (const sx of [-span, span]) {
        for (const [zA, zB] of ewSegs) addRoadBlockNS(sx, zA, zB);
      }

      // North & South Ring Avenues (z = ±span) segmented cleanly between corners & x = -6.8 / +6.8
      const nsSegs: Array<[number, number]> = [
        [-span + halfWalk, -6.8 - halfWalk],
        [-6.8 + halfWalk, 6.8 - halfWalk],
        [6.8 + halfWalk, span - halfWalk]
      ];
      for (const sz of [-span, span]) {
        for (const [xA, xB] of nsSegs) addRoadBlockEW(sz, xA, xB);
      }

      // 4 Corner Intersections (±span, ±span) — inward aprons only, continuous raised outer corner curb!
      addPavedIntersection(-span, -span, false, true, false, true);
      addPavedIntersection(span, -span, false, true, true, false);
      addPavedIntersection(-span, span, true, false, false, true);
      addPavedIntersection(span, span, true, false, true, false);

      // 8 Radial Junction Intersections (4-way paved junctions ready for further outer expansion!)
      for (const sz of [-6.8, 8.4]) {
        addPavedIntersection(-span, sz, true, true, true, true);
        addPavedIntersection(span, sz, true, true, true, true);
      }
      for (const sx of [-6.8, 6.8]) {
        addPavedIntersection(sx, -span, true, true, true, true);
        addPavedIntersection(sx, span, true, true, true, true);
      }

      // Connect radial avenues smoothly from previous Expansion Band (b - 1) to Band b!
      if (b >= 1) {
        const prevSpan = getExpansionBandAvenueSpan(b - 1);
        const rA = prevSpan + halfWalk;
        const rB = span - halfWalk;
        for (const sx of [-6.8, 6.8]) {
          addRoadBlockNS(sx, rA, rB);
          addRoadBlockNS(sx, -rB, -rA);
        }
        for (const sz of [-6.8, 8.4]) {
          addRoadBlockEW(sz, rA, rB);
          addRoadBlockEW(sz, -rB, -rA);
        }
      }

      // Add Boulevard Trees & Architectural Streetlamps around the newly paved Expansion Avenue!
      const lampSpots: Array<[number, number]> = [
        [-span + 2.1, -span + 2.1],
        [span - 2.1, -span + 2.1],
        [-span + 2.1, span - 2.1],
        [span - 2.1, span - 2.1],
        [-span + 2.1, 0.8],
        [span - 2.1, 0.8],
        [0, -span + 2.1],
        [0, span - 2.1]
      ];
      for (const [lx, lz] of lampSpots) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.045, 2.35, 8), this.metalMat);
        pole.position.set(lx, 1.18, lz);
        const globe = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), lampBulbMat);
        globe.position.set(lx, 2.42, lz);
        this.expansionInfraGroup.add(pole, globe);
      }

      const treeSpots: Array<[number, number, boolean]> = [
        [-(span + 2.4), -(span - 4.2), true],
        [span + 2.4, -(span - 4.2), false],
        [-(span + 2.4), span - 4.2, false],
        [span + 2.4, span - 4.2, true],
        [0, -(span + 3.8), true],
        [0, span + 3.8, false],
        [-(span - 2.4), -15.5, false],
        [span - 2.4, -15.5, true],
        [-(span - 2.4), 18.2, true],
        [span - 2.4, 18.2, false]
      ];
      for (const [tx, tz, isSakura] of treeSpots) {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 1.25, 7), treeTrunkMat);
        trunk.position.set(tx, 0.62, tz);
        const canopy = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.92, 1),
          isSakura ? sakuraMat : treeFoliageMat
        );
        canopy.position.set(tx, 1.72, tz);
        this.expansionInfraGroup.add(trunk, canopy);
      }
    }

    this.builtExpansionBands = Math.max(this.builtExpansionBands, neededBands);
  }

  private invalidateSpatialCaches() {
    this.cachedRaycastTargets = null;
    this.cachedObstacles = null;
  }

  private removePlotRig(rig: NeighborPlotRig) {
    this.invalidateSpatialCaches();
    this.neighborsGroup.remove(rig.group);
    this.disposeObjectTree(rig.group);
    if (rig.conduitFiber) {
      this.neighborsGroup.remove(rig.conduitFiber);
      rig.conduitFiber.geometry.dispose();
      (rig.conduitFiber.material as THREE.Material).dispose();
    }
    if (rig.conduitPulse) {
      this.neighborsGroup.remove(rig.conduitPulse.mesh);
      rig.conduitPulse.mesh.geometry.dispose();
      (rig.conduitPulse.mesh.material as THREE.Material).dispose();
    }
  }

  private syncUpcomingBlueprintLots(lots: readonly UpcomingBlueprintLot[]) {
    for (const br of this.blueprintRigs) {
      this.blueprintsGroup.remove(br.group);
      this.disposeObjectTree(br.group);
    }
    this.blueprintRigs = [];

    const padMat = new THREE.MeshBasicMaterial({
      color: "#38bdf8",
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide
    });
    const edgeMat = new THREE.LineBasicMaterial({
      color: "#0ea5e9",
      transparent: true,
      opacity: 0.72
    });
    const pylonMat = new THREE.MeshStandardMaterial({
      color: "#e0f2fe",
      emissive: "#38bdf8",
      emissiveIntensity: 0.9
    });

    for (const lot of lots) {
      const g = new THREE.Group();
      g.position.set(lot.x, 0.03, lot.z);
      g.rotation.y = lot.rotY;

      // Full-size 5.3m × 5.1m Surveyed Residential Neighborhood Lot waiting for next NFT mint!
      const lotW = 5.3;
      const lotD = 5.1;
      const lawnPad = new THREE.Mesh(
        new THREE.PlaneGeometry(lotW, lotD),
        new THREE.MeshStandardMaterial({ color: "#bbf7d0", roughness: 0.88 })
      );
      lawnPad.rotation.x = -Math.PI / 2;
      g.add(lawnPad);

      const pad = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.6), padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.y = 0.012;
      g.add(pad);

      const frame = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(lotW, 0.14, lotD)),
        edgeMat
      );
      frame.position.y = 0.07;
      g.add(frame);

      // 4 Glowing Corner Property Survey Stakes
      for (const sx of [-lotW / 2 + 0.08, lotW / 2 - 0.08]) {
        for (const sz of [-lotD / 2 + 0.08, lotD / 2 - 0.08]) {
          const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.54, 8), pylonMat);
          stake.position.set(sx, 0.27, sz);
          g.add(stake);
        }
      }

      // Cute Real-Estate Lawn Signpost facing the Street Sidewalk (+Z)
      const signPost = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.036, 0.85, 8),
        new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.85, roughness: 0.22 })
      );
      signPost.position.set(0, 0.42, lotD / 2 - 0.35);
      g.add(signPost);

      const beaconRing = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.72, 24),
        new THREE.MeshBasicMaterial({
          color: "#38bdf8",
          transparent: true,
          opacity: 0.58,
          side: THREE.DoubleSide
        })
      );
      beaconRing.rotation.x = -Math.PI / 2;
      beaconRing.position.y = 0.05;
      g.add(beaconRing);

      // Floating "Next Mint · Plot #N" plaque
      const tex = this.createBlueprintLotPlaque(lot.lotNumber, lot.districtName);
      const plaque = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
      );
      plaque.scale.set(1.55, 0.56, 1);
      plaque.position.set(0, 1.35, 0);
      g.add(plaque);

      const simsTarget: SimsObjectTarget = {
        kind: "blueprint-lot",
        label: `Open Lot #${lot.lotNumber} (${lot.districtName})`,
        lotNumber: lot.lotNumber,
        worldX: lot.x,
        worldZ: lot.z
      };
      g.traverse((obj) => {
        obj.userData.simsTarget = simsTarget;
      });

      this.blueprintsGroup.add(g);
      this.blueprintRigs.push({ lot, group: g, beaconRing });
    }
    this.invalidateSpatialCaches();
  }

  public getPlacements(): NeighborhoodPlotPlacement[] {
    return this.lastPlacements;
  }

  public getRaycastTargets(): THREE.Object3D[] {
    if (this.cachedRaycastTargets) return this.cachedRaycastTargets;
    const targets: THREE.Object3D[] = [this.fountainGroup];
    for (const rig of this.plotRigs.values()) {
      targets.push(rig.group);
    }
    for (const br of this.blueprintRigs) {
      targets.push(br.group);
    }
    for (const npc of this.npcRigs) {
      targets.push(npc.avatar.root);
    }
    targets.push(...this.traffic.getRaycastTargets());
    this.cachedRaycastTargets = targets;
    return targets;
  }

  public getNeighborObstacles(): Array<[number, number, number]> {
    if (this.cachedObstacles) return this.cachedObstacles;
    const obs: Array<[number, number, number]> = [
      [COMMUNITY_FOUNTAIN_POS[0], COMMUNITY_FOUNTAIN_POS[1], 1.72]
    ];
    for (const rig of this.plotRigs.values()) {
      obs.push([rig.placement.x, rig.placement.z, rig.placement.ring === 3 ? 2.15 : 2.25]);
    }
    this.cachedObstacles = obs;
    return obs;
  }

  public fireSocialBeam(
    fromX: number,
    fromZ: number,
    toX: number,
    toZ: number,
    colorHex = "#38bdf8"
  ) {
    const start = new THREE.Vector3(fromX, 1.4, fromZ);
    const mid = new THREE.Vector3((fromX + toX) * 0.5, 4.4, (fromZ + toZ) * 0.5);
    const end = new THREE.Vector3(toX, 1.9, toZ);
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);

    const line = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 28, 0.024, 8, false),
      new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.55 })
    );
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 14, 14),
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        emissive: colorHex,
        emissiveIntensity: 1.6
      })
    );
    let glowTex = this.beamGlowTextures.get(colorHex);
    if (!glowTex) {
      glowTex = createRadialGlowTexture(colorHex);
      this.beamGlowTextures.set(colorHex, glowTex);
    }
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    glow.scale.set(0.68, 0.68, 1);
    orb.add(glow);

    this.fxGroup.add(line, orb);
    this.socialBeams.push({ mesh: orb, curve, t: 0, line });
  }

  public triggerNpcWave(tokenId: number, emote: "wave" | "spin" | "hop" = "wave", bubble: MoodBubbleKind = "heart") {
    const npc = this.npcRigs.find((n) => n.tokenId === tokenId);
    if (!npc) return;
    npc.avatar.triggerEmote(emote);
    this.showNpcBubble(npc, bubble);
  }

  public updateNpcStatusVisual(
    tokenId: number,
    moodName: string,
    plumbobHex: string,
    tierLabel?: string
  ) {
    const npc = this.npcRigs.find((n) => n.tokenId === tokenId);
    if (!npc) return;
    npc.avatar.setPlumbobColor(plumbobHex);
    const sub = tierLabel && tierLabel !== "Stranger" ? `${moodName} · ${tierLabel}` : moodName;
    npc.avatar.setStatusTag(npc.name, sub, plumbobHex);
  }

  private buildNeighborPlot3D(
    pl: NeighborhoodPlotPlacement,
    animatePopIn: boolean
  ): NeighborPlotRig {
    const { lab } = pl;
    const traits = deriveTraitsFromSeed(lab.seed);
    const pal = traits.palette;
    const g = new THREE.Group();
    g.position.set(pl.x, 0, pl.z);
    g.rotation.y = pl.rotY;

    const stoneMat = this.sharedNeighborStoneMat;
    const metalMat = this.sharedNeighborMetalMat;
    const elixirMat = new THREE.MeshStandardMaterial({
      color: pal.liquidMid,
      emissive: pal.liquidMid,
      emissiveIntensity: 0.68,
      roughness: 0.16
    });
    const glassMat = this.sharedNeighborGlassMat;

    const windowGlowMats: THREE.MeshStandardMaterial[] = [elixirMat];
    let spinner: THREE.Object3D | undefined;
    let proteinRing: THREE.Object3D | undefined;
    let conduitFiber: THREE.Mesh | undefined;
    let conduitPulse: NeighborPlotRig["conduitPulse"];

    if (pl.ring === 3) {
      // Lightweight Walkable Subdivided Outer Expansion Residence (5.0m × 4.8m green yard + driveway
      // + modern multi-story architect glass villa — keeps 240+ outer plots smooth at 60fps!)
      const lawn = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.05, 4.8), this.sharedYardLawnMat);
      lawn.position.y = 0.025;
      lawn.receiveShadow = true;
      g.add(lawn);

      // Paved stone driveway connecting front steps directly onto the Expansion Avenue sidewalk (+Z)!
      const driveway = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.056, 1.35), stoneMat);
      driveway.position.set(0, 0.032, 2.02);
      driveway.receiveShadow = true;
      g.add(driveway);

      const base = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.2, 3.2), stoneMat);
      base.position.y = 0.12;
      g.add(base);

      // Multi-story cantilevered modern architect massing tailored to NFT tier & built wings
      const stories = Math.min(3, 1 + Math.floor((lab.complexityTier + countSectors(lab.sectorsMask)) / 3));
      const bodyH = 1.35 + stories * 0.62;
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.9, bodyH, 2.45), stoneMat);
      body.position.set(0, 0.22 + bodyH / 2, -0.1);
      g.add(body);

      // Illuminated vertical glass atrium core glowing with this NFT's unique elixir palette
      const glassCore = new THREE.Mesh(new THREE.BoxGeometry(1.42, bodyH * 0.88, 2.52), glassMat);
      glassCore.position.set(0, 0.22 + bodyH * 0.5, -0.04);
      g.add(glassCore);

      const innerElixir = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.44, bodyH * 0.72, 12),
        elixirMat
      );
      innerElixir.position.set(0, 0.26 + bodyH * 0.42, -0.04);
      g.add(innerElixir);

      // Crisp cantilevered roofline overhang
      const roof = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.14, 2.85), stoneMat);
      roof.position.set(0, 0.26 + bodyH, -0.05);
      g.add(roof);

      if (hasSector(lab.sectorsMask, 5) || lab.complexityTier >= 4) {
        const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(0.86, 1), glassMat);
        dome.scale.set(1, 0.56, 1);
        dome.position.set(0, 0.34 + bodyH, -0.05);
        g.add(dome);
      }

      // Floating street plaque (capped cleanly by device VRAM budget) & Sims raycast target!
      if (pl.plotIndex < this.perfProfile.maxDetailPlaques) {
        const plaqueTex = this.createPlotPlaqueTexture(lab, pal.liquidMid, pl.districtName);
        const plaque = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: plaqueTex, transparent: true, depthWrite: false })
        );
        plaque.scale.set(1.48, 0.56, 1);
        plaque.position.set(0, 1.05 + bodyH, 0);
        g.add(plaque);
      }

      const simsTarget: SimsObjectTarget = {
        kind: "neighbor-lab",
        label: `Lab #${lab.tokenId}`,
        tokenId: lab.tokenId,
        worldX: pl.visitX,
        worldZ: pl.visitZ
      };
      g.traverse((obj) => {
        obj.userData.simsTarget = simsTarget;
      });
    } else {
      // Full-Detail Walkable Subdivided Neighborhood Plot (5.4m × 5.2m) with Fence, Driveway, Mailbox & Mini-Greenhouse!
      const yardLawnMat = this.sharedYardLawnMat;
      const hedgeMat = this.sharedHedgeMat;
      const woodBedMat = this.sharedWoodBedMat;
      const fenceMat = this.sharedFenceMat;
      const flowerColors = ["#f472b6", "#a78bfa", "#fbbf24", "#38bdf8", "#fb7185"];
      const yardBloomCol = flowerColors[lab.tokenId % flowerColors.length];
      const yardBloomMat = new THREE.MeshStandardMaterial({
        color: yardBloomCol,
        emissive: yardBloomCol,
        emissiveIntensity: 0.22,
        roughness: 0.45
      });

      // Crisp Subdivided Rectangular Residential Yard Lot (5.4m wide × 5.2m deep)
      const lotW = 5.4;
      const lotD = 5.2;
      const lawn = new THREE.Mesh(new THREE.BoxGeometry(lotW, 0.05, lotD), yardLawnMat);
      lawn.position.y = 0.025;
      lawn.receiveShadow = true;
      g.add(lawn);

      // Subtle Architectural Property-Line Curb & 3-Sided White-Silver Residential Yard Fence (Left, Right, Back)!
      const backFence = new THREE.Mesh(new THREE.BoxGeometry(lotW, 0.36, 0.06), fenceMat);
      backFence.position.set(0, 0.22, -lotD / 2 + 0.05);
      const leftFence = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, lotD), fenceMat);
      leftFence.position.set(-lotW / 2 + 0.05, 0.22, 0);
      const rightFence = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, lotD), fenceMat);
      rightFence.position.set(lotW / 2 - 0.05, 0.22, 0);
      g.add(backFence, leftFence, rightFence);

      const postGeo = new THREE.BoxGeometry(0.14, 0.46, 0.14);
      for (const px of [-lotW / 2 + 0.06, lotW / 2 - 0.06]) {
        for (const pz of [-lotD / 2 + 0.06, 0, lotD / 2 - 0.06]) {
          const fp = new THREE.Mesh(postGeo, stoneMat);
          fp.position.set(px, 0.25, pz);
          g.add(fp);
        }
      }

      // Straight Paved Stone Front Driveway / Walkway connecting front steps directly onto the Street Sidewalk (+Z)!
      const walkway = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.056, 1.55), stoneMat);
      walkway.position.set(0, 0.032, 2.25);
      walkway.receiveShadow = true;
      g.add(walkway);

      // Curbside Architectural Mailbox beside every neighbor's sidewalk entrance!
      const mbPost = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.62, 8), metalMat);
      mbPost.position.set(0.92, 0.31, 2.52);
      const mbBox = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.28), stoneMat);
      mbBox.position.set(0.92, 0.64, 2.52);
      const mbFlag = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.06), elixirMat);
      mbFlag.position.set(1.03, 0.7, 2.52);
      g.add(mbPost, mbBox, mbFlag);

      // Raised Front Yard Flowerbeds + Trimmed Boxwood Hedges flanking every neighbor's porch!
      for (const sx of [-1.36, 1.36]) {
        const planter = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.18, 0.44), woodBedMat);
        planter.position.set(sx, 0.12, 2.1);
        g.add(planter);
        for (let b = -1; b <= 1; b++) {
          const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), yardBloomMat);
          bloom.position.set(sx + b * 0.26, 0.26, 2.1);
          g.add(bloom);
        }
        const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), hedgeMat);
        shrub.position.set(sx * 1.52, 0.2, 2.02);
        g.add(shrub);
      }

      // Cozy Sideyard Glass Mini-Greenhouse nestled inside the fenced lot on ~65% of neighbor homes!
      if (lab.tokenId % 3 !== 0 || hasSector(lab.sectorsMask, 2)) {
        const gh = new THREE.Group();
        gh.position.set(2.05, 0.05, -0.55);
        const ghBase = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.24, 1.12), woodBedMat);
        ghBase.position.y = 0.12;
        gh.add(ghBase);
        const ghWalls = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.62, 1.06), glassMat);
        ghWalls.position.y = 0.54;
        gh.add(ghWalls);
        const ghRoof = new THREE.Mesh(new THREE.ConeGeometry(0.76, 0.4, 4), glassMat);
        ghRoof.rotation.y = Math.PI / 4;
        ghRoof.position.y = 1.04;
        gh.add(ghRoof);
        const ghPlant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), hedgeMat);
        ghPlant.position.set(0, 0.42, 0);
        gh.add(ghPlant);
        const ghFlower = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), yardBloomMat);
        ghFlower.position.set(0, 0.64, 0.12);
        gh.add(ghFlower);
        g.add(gh);
      }

      const slab = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.16, 3.45), stoneMat);
      slab.position.y = 0.08;
      slab.receiveShadow = true;
      g.add(slab);

      const cove = new THREE.Mesh(
        new THREE.BoxGeometry(3.52, 0.035, 3.52),
        new THREE.MeshBasicMaterial({ color: pal.liquidTop, transparent: true, opacity: 0.58 })
      );
      cove.position.y = 0.14;
      g.add(cove);

      const rotunda = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.48, 0.18, 28), stoneMat);
      rotunda.position.y = 0.24;
      rotunda.receiveShadow = true;
      g.add(rotunda);

      // Architectural rear columns & skylight roof
      const colH = 1.75 + lab.complexityTier * 0.12;
      for (const ang of [-Math.PI * 0.85, -Math.PI * 0.5, -Math.PI * 0.15]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, colH, 10), metalMat);
        col.position.set(Math.cos(ang) * 1.28, 0.33 + colH / 2, Math.sin(ang) * 1.28);
        g.add(col);
      }
      const roof = new THREE.Mesh(
        new THREE.RingGeometry(0.68, 1.52, 24, 1, Math.PI * 0.1, Math.PI * 0.8),
        stoneMat
      );
      roof.rotation.x = -Math.PI / 2;
      roof.position.y = 0.33 + colH;
      g.add(roof);

      // Neighbor's Seed-Accurate Central Glass Vessel & Glowing Elixir!
      const vessel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.52, 1.38, 20), glassMat);
      vessel.position.y = 1.02;
      g.add(vessel);
      const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.44, 0.72, 16), elixirMat);
      liq.position.y = 0.72;
      g.add(liq);

      // Floating Protein Folding Halo Ring above their vessel
      const pRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.46, 0.018, 8, 28),
        new THREE.MeshStandardMaterial({
          color: pal.electron,
          emissive: pal.electron,
          emissiveIntensity: 0.95
        })
      );
      pRing.position.y = 2.24;
      pRing.rotation.x = 0.55;
      proteinRing = pRing;
      g.add(pRing);

      // Actual Built Rooms matching this Neighbor NFT's sectorsMask!
      if (hasSector(lab.sectorsMask, 0)) {
        const cold = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.68, 0.68), glassMat);
        cold.position.set(-1.52, 0.44, -0.96);
        g.add(cold);
      }
      if (hasSector(lab.sectorsMask, 1)) {
        const blades = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.28, 0),
          new THREE.MeshStandardMaterial({
            color: "#6366f1",
            emissive: "#6366f1",
            emissiveIntensity: 0.9
          })
        );
        blades.scale.set(1.3, 0.35, 1.3);
        blades.position.set(1.56, 0.74, 0.12);
        spinner = blades;
        g.add(blades);
      }
      if (hasSector(lab.sectorsMask, 2)) {
        const dome = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.48, 1),
          createFastArchitecturalGlass({
            color: "#ecfdf5",
            emissive: "#10b981",
            emissiveIntensity: 0.25,
            opacity: 0.54
          })
        );
        dome.position.set(-1.42, 0.36, 1.15);
        g.add(dome);
      }
      if (hasSector(lab.sectorsMask, 4)) {
        const spire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.16, 1.85, 12),
          new THREE.MeshStandardMaterial({
            color: "#c4b5fd",
            emissive: "#8b5cf6",
            emissiveIntensity: 0.78
          })
        );
        spire.position.set(1.42, 1.05, -1.12);
        g.add(spire);
      }
      if (hasSector(lab.sectorsMask, 5)) {
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.84, 1), glassMat);
        crown.scale.set(1, 0.52, 1);
        crown.position.y = 2.48;
        g.add(crown);
      }

      // Floating Plot Plaque Signpost with Street Address ("Lab #4 · Maple Lane")
      const plaqueTex = this.createPlotPlaqueTexture(lab, pal.liquidMid, pl.districtName);
      const plaque = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: plaqueTex, transparent: true, depthWrite: false })
      );
      plaque.scale.set(1.48, 0.56, 1);
      plaque.position.set(0, 2.95, 0);
      g.add(plaque);

      // Glowing optical fiber conduit linking Ring 1 neighbors to the Community Fountain!
      if (pl.ring === 1) {
        const startW = new THREE.Vector3(pl.x, 0.06, pl.z);
        const endW = new THREE.Vector3(COMMUNITY_FOUNTAIN_POS[0], 0.08, COMMUNITY_FOUNTAIN_POS[1]);
        const midW = startW.clone().lerp(endW, 0.5);
        midW.y = 0.08;
        const curve = new THREE.CatmullRomCurve3([startW, midW, endW]);
        const fiber = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 18, 0.024, 6, false),
          new THREE.MeshBasicMaterial({ color: pal.liquidMid, transparent: true, opacity: 0.42 })
        );
        this.neighborsGroup.add(fiber);
        conduitFiber = fiber;

        const pulse = new THREE.Mesh(
          new THREE.SphereGeometry(0.065, 8, 8),
          new THREE.MeshStandardMaterial({
            color: "#ffffff",
            emissive: pal.electron,
            emissiveIntensity: 1.4
          })
        );
        this.neighborsGroup.add(pulse);
        conduitPulse = { mesh: pulse, curve, t: (pl.plotIndex * 0.23) % 1, speed: 0.16 };
      }

      // Tag entire walkable neighbor house for Sims Radial Pie Menu raycasting!
      const simsTarget: SimsObjectTarget = {
        kind: "neighbor-lab",
        label: `Lab #${lab.tokenId}`,
        tokenId: lab.tokenId,
        worldX: pl.visitX,
        worldZ: pl.visitZ
      };
      g.traverse((obj) => {
        obj.userData.simsTarget = simsTarget;
      });
    }

    const popScale = animatePopIn ? 0.04 : 1.0;
    if (animatePopIn) g.scale.set(1, popScale, 1);

    return {
      tokenId: lab.tokenId,
      sectorsMask: lab.sectorsMask,
      complexityTier: lab.complexityTier,
      placement: pl,
      group: g,
      popScale,
      spinner,
      proteinRing,
      windowGlowMats,
      conduitFiber,
      conduitPulse
    };
  }

  private createPlotPlaqueTexture(
    lab: NeighborLabSummary,
    accent: string,
    streetName?: string
  ): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 120;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.beginPath();
    ctx.roundRect(8, 8, 304, 104, 24);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(38, 44, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "700 28px 'Inter', sans-serif";
    ctx.fillStyle = "#1a1f2c";
    ctx.fillText(`Lab #${lab.tokenId}`, 58, 52);

    ctx.font = "600 16px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#64748b";
    ctx.fillText(
      streetName ? `${streetName} · ${countSectors(lab.sectorsMask)}/6` : `$${lab.valueUsd} · ${countSectors(lab.sectorsMask)}/6 rooms`,
      34,
      88
    );

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createBlueprintLotPlaque(lotNumber: number, districtName: string): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 116;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "rgba(240, 249, 255, 0.92)";
    ctx.beginPath();
    ctx.roundRect(8, 8, 304, 100, 22);
    ctx.fill();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = "#0ea5e9";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = "700 25px 'Inter', sans-serif";
    ctx.fillStyle = "#0369a1";
    ctx.fillText(`Next Mint · Lot #${lotNumber}`, 26, 52);

    ctx.font = "600 16px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#475569";
    ctx.fillText(districtName, 26, 84);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private syncNeighborNpcs(walkablePlots: readonly NeighborhoodPlotPlacement[]) {
    const nextKey = walkablePlots.map((p) => `${p.lab.tokenId}:${p.plotIndex}`).join(",");
    const prevKey = this.npcRigs.map((n) => n.tokenId).join(",");
    if (nextKey === prevKey && this.npcRigs.length === walkablePlots.length) return;

    for (const npc of this.npcRigs) {
      this.npcsGroup.remove(npc.avatar.root);
      npc.avatar.disposeRig();
      if (npc.bubbleSprite) {
        this.npcsGroup.remove(npc.bubbleSprite);
        (npc.bubbleSprite.material as THREE.SpriteMaterial).dispose();
      }
    }
    this.npcRigs = [];

    const relMap = loadRelationshipsMap();
    walkablePlots.forEach((pl, i) => {
      const profile = deriveNeighborCharacterProfile(pl.lab);
      const status = getNeighborSimsStatus(pl.lab.tokenId, pl.lab.seed, relMap);
      const avatar = new ResearcherAvatar3D(profile, {
        enablePlumbob: true,
        plumbobScale: 0.72,
        initialPlumbobHex: status.plumbobHex
      });
      const tagSub =
        status.tier !== "Stranger" ? `${status.mood} · ${status.tier}` : `${status.mood} · ${status.traitLabel}`;
      avatar.setStatusTag(profile.name, tagSub, status.plumbobHex);
      const homeX = pl.visitX;
      const homeZ = pl.visitZ;

      // Stroll smoothly along the paved sidewalk right in front of their own residential street block!
      const isFacingEW = Math.abs(Math.sin(pl.rotY)) > 0.5;
      let patrolX = homeX + (isFacingEW ? 0 : i % 2 === 0 ? 3.8 : -3.8);
      let patrolZ = homeZ + (isFacingEW ? (i % 2 === 0 ? 4.2 : -4.2) : 0);
      if (pl.ring === 2 && i % 3 === 0) {
        // Occasional neighbor strolls straight to the Grand Botanical Park Conservatory entrance!
        patrolX = TOWN_PARK_CENTER[0] - 2.6;
        patrolZ = TOWN_PARK_CENTER[1] - 4.4;
      }

      avatar.root.position.set(homeX, 0.04, homeZ);
      avatar.root.rotation.y = pl.rotY;

      const target: SimsObjectTarget = {
        kind: "neighbor-npc",
        label: `${profile.name} (Lab #${pl.lab.tokenId})`,
        tokenId: pl.lab.tokenId,
        npcName: profile.name,
        worldX: homeX,
        worldZ: homeZ
      };
      avatar.root.traverse((obj) => {
        obj.userData.simsTarget = target;
      });

      this.npcsGroup.add(avatar.root);
      this.npcRigs.push({
        tokenId: pl.lab.tokenId,
        name: profile.name,
        avatar,
        homeX,
        homeZ,
        patrolX,
        patrolZ,
        x: homeX,
        z: homeZ,
        yaw: pl.rotY,
        goingToPatrol: i % 2 === 0,
        pauseTimer: 1.4 + i * 0.9,
        wavedRecently: 0,
        bubbleTimer: 3 + i * 2.1,
        bubbleSprite: null
      });
    });
    this.invalidateSpatialCaches();
  }

  private showNpcBubble(npc: NeighborNpcRig, kind: MoodBubbleKind) {
    let tex = this.bubbleTextures[kind];
    if (!tex) {
      tex = createMoodBubbleTexture(kind);
      this.bubbleTextures[kind] = tex;
    }
    if (npc.bubbleSprite) {
      this.npcsGroup.remove(npc.bubbleSprite);
      (npc.bubbleSprite.material as THREE.SpriteMaterial).dispose();
    }
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.95, depthWrite: false })
    );
    sp.scale.set(0.46, 0.46, 1);
    sp.position.set(npc.x, 1.42, npc.z);
    this.npcsGroup.add(sp);
    npc.bubbleSprite = sp;
    npc.bubbleTimer = 2.6;
  }

  public update(dt: number, t: number, playerX: number, playerZ: number) {
    this.canalMat.uniforms.uTime.value = t;

    // Drift sculpted clouds softly across sky
    for (const c of this.clouds) {
      c.angle += c.speed * dt;
      c.group.position.set(Math.cos(c.angle) * c.radius, c.y, Math.sin(c.angle) * c.radius);
    }

    // Community Research Fountain animation
    if (this.fountainSpire) this.fountainSpire.rotation.y = t * 0.65;
    if (this.fountainHalo) this.fountainHalo.rotation.z = t * 0.85;

    // Hover-Shuttle gliding smoothly around the 4 Perimeter Park Boulevards once 10+ labs minted!
    if (this.shuttleGroup && this.shuttleVisible) {
      this.shuttleAngle = (this.shuttleAngle + dt * 0.045) % 1;
      const seg = this.shuttleAngle * 4;
      const idx = Math.floor(seg);
      const frac = seg - idx;
      const corners: ReadonlyArray<[number, number]> = [
        [21.2, -21.2],
        [21.2, 21.6],
        [-21.2, 21.6],
        [-21.2, -21.2]
      ];
      const a = corners[idx];
      const b = corners[(idx + 1) % 4];
      const sx = a[0] + (b[0] - a[0]) * frac;
      const sz = a[1] + (b[1] - a[1]) * frac;
      this.shuttleGroup.position.set(sx, 0.08 + Math.sin(t * 3.2) * 0.04, sz);
      this.shuttleGroup.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
    }

    // Pulse Upcoming Blueprint Lots gently
    for (let i = 0; i < this.blueprintRigs.length; i++) {
      const br = this.blueprintRigs[i];
      const s = 1 + Math.sin(t * 2.8 + i * 1.1) * 0.12;
      br.beaconRing.scale.setScalar(s);
    }

    // Animate Neighbor Pavilions, Construction Pop-In & Street Fiber Pulses
    const popAlpha = 1 - Math.exp(-6.5 * dt);
    for (const rig of this.plotRigs.values()) {
      if (rig.popScale < 0.999) {
        rig.popScale += (1 - rig.popScale) * popAlpha;
        rig.group.scale.set(1, rig.popScale, 1);
      }
      if (rig.spinner) rig.spinner.rotation.y += dt * 2.4;
      if (rig.proteinRing) {
        rig.proteinRing.rotation.y = t * 0.7;
        rig.proteinRing.rotation.z = t * 0.4;
      }
      if (rig.conduitPulse) {
        rig.conduitPulse.t = (rig.conduitPulse.t + rig.conduitPulse.speed * dt) % 1;
        rig.conduitPulse.curve.getPointAt(rig.conduitPulse.t, rig.conduitPulse.mesh.position);
      }
    }

    // Update Autonomous Strolling & Gardening Neighbor NPCs!
    const bubbleKinds: MoodBubbleKind[] = ["water", "flower", "dna", "idea", "wave", "sparkle"];
    for (let i = 0; i < this.npcRigs.length; i++) {
      const npc = this.npcRigs[i];
      npc.wavedRecently = Math.max(0, npc.wavedRecently - dt);

      const distToPlayer = Math.hypot(playerX - npc.x, playerZ - npc.z);
      let isMoving = false;

      if (distToPlayer < 2.2) {
        const facePlayerYaw = Math.atan2(playerX - npc.x, playerZ - npc.z);
        let diff = facePlayerYaw - npc.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        npc.yaw += diff * (1 - Math.exp(-8 * dt));
        if (npc.wavedRecently <= 0) {
          npc.wavedRecently = 8.0;
          npc.avatar.triggerEmote("wave");
          this.showNpcBubble(npc, "wave");
        }
      } else if (npc.pauseTimer > 0) {
        npc.pauseTimer -= dt;
      } else {
        const tx = npc.goingToPatrol ? npc.patrolX : npc.homeX;
        const tz = npc.goingToPatrol ? npc.patrolZ : npc.homeZ;
        const dx = tx - npc.x;
        const dz = tz - npc.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.2) {
          npc.goingToPatrol = !npc.goingToPatrol;
          npc.pauseTimer = 3.2 + (i % 3) * 1.4;
          if (!npc.bubbleSprite) {
            this.showNpcBubble(npc, bubbleKinds[(i + Math.floor(t)) % bubbleKinds.length]);
          }
        } else {
          const spd = 0.94;
          npc.x += (dx / d) * Math.min(d, spd * dt);
          npc.z += (dz / d) * Math.min(d, spd * dt);
          const targetYaw = Math.atan2(dx, dz);
          let diff = targetYaw - npc.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          npc.yaw += diff * (1 - Math.exp(-9 * dt));
          isMoving = true;
        }
      }

      npc.avatar.root.position.set(npc.x, 0.04, npc.z);
      npc.avatar.root.rotation.y = npc.yaw;
      // Distance LOD: faraway Ring-2 NPCs animate at 30Hz (every 2nd frame) for mobile/Safari headroom!
      if (distToPlayer < 26 || ((this.frameCounter + i) & 1) === 0) {
        npc.avatar.update(distToPlayer < 26 ? dt : dt * 2, t + i * 1.7, isMoving ? 0.5 : 0, isMoving);
      }

      const ud = npc.avatar.root.userData.simsTarget as SimsObjectTarget | undefined;
      if (ud) {
        ud.worldX = npc.x;
        ud.worldZ = npc.z;
      }

      if (npc.bubbleSprite) {
        npc.bubbleTimer -= dt;
        npc.bubbleSprite.position.set(npc.x, 1.42 + (2.6 - npc.bubbleTimer) * 0.08, npc.z);
        (npc.bubbleSprite.material as THREE.SpriteMaterial).opacity = Math.min(
          0.95,
          Math.max(0, npc.bubbleTimer * 0.8)
        );
        if (npc.bubbleTimer <= 0) {
          this.npcsGroup.remove(npc.bubbleSprite);
          (npc.bubbleSprite.material as THREE.SpriteMaterial).dispose();
          npc.bubbleSprite = null;
        }
      }
    }
    this.frameCounter++;

    // Update Autonomous Right-Hand-Lane Driving Vehicles with zero per-frame array allocation!
    this.npcCoordBuf.length = this.npcRigs.length;
    for (let i = 0; i < this.npcRigs.length; i++) {
      const n = this.npcRigs[i];
      if (!this.npcCoordBuf[i]) this.npcCoordBuf[i] = [n.x, n.z];
      else {
        this.npcCoordBuf[i][0] = n.x;
        this.npcCoordBuf[i][1] = n.z;
      }
    }
    this.traffic.update(dt, t, playerX, playerZ, this.npcCoordBuf);

    // Animate arcing social research-spark beams between labs
    for (let i = this.socialBeams.length - 1; i >= 0; i--) {
      const sb = this.socialBeams[i];
      sb.t += dt * 0.85;
      if (sb.t >= 1) {
        this.fxGroup.remove(sb.mesh, sb.line);
        sb.mesh.children.forEach((child) => {
          const sp = child as THREE.Sprite;
          if (sp.material) (sp.material as THREE.Material).dispose();
        });
        sb.mesh.geometry.dispose();
        (sb.mesh.material as THREE.Material).dispose();
        sb.line.geometry.dispose();
        (sb.line.material as THREE.Material).dispose();
        this.socialBeams.splice(i, 1);
      } else {
        sb.curve.getPointAt(sb.t, sb.mesh.position);
        (sb.line.material as THREE.MeshBasicMaterial).opacity = (1 - sb.t) * 0.65;
      }
    }

    // Animate newly minted plot construction beacon rings & rising light pillars
    for (let i = this.constructionFx.length - 1; i >= 0; i--) {
      const fx = this.constructionFx[i];
      fx.life -= dt * 0.46;
      if (fx.life <= 0) {
        this.fxGroup.remove(fx.ring, fx.pillar);
        fx.ring.geometry.dispose();
        (fx.ring.material as THREE.Material).dispose();
        fx.pillar.geometry.dispose();
        (fx.pillar.material as THREE.Material).dispose();
        this.constructionFx.splice(i, 1);
      } else {
        const prog = 1 - fx.life;
        fx.ring.scale.setScalar(1 + prog * 2.2);
        (fx.ring.material as THREE.MeshBasicMaterial).opacity = fx.life * 0.85;
        fx.pillar.scale.set(1 + prog * 0.35, 0.6 + fx.life * 0.8, 1 + prog * 0.35);
        (fx.pillar.material as THREE.MeshBasicMaterial).opacity = fx.life * 0.32;
      }
    }
  }

  private disposeObjectTree(parent: THREE.Object3D) {
    const shared = new Set<THREE.Texture>([
      this.terrazzoTex,
      this.titaniumTex,
      this.groundTex,
      ...this.ownedTextures,
      ...this.beamGlowTextures.values(),
      ...(Object.values(this.bubbleTextures).filter(Boolean) as THREE.Texture[])
    ]);
    parent.traverse((obj) => {
      if (obj === parent) return;
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          if (this.sharedMaterialsSet.has(mat)) continue;
          const mAny = mat as unknown as { map?: THREE.Texture | null };
          if (mAny.map && !shared.has(mAny.map)) mAny.map.dispose();
          mat.dispose();
        }
      }
    });
    while (parent.children.length > 0) {
      parent.remove(parent.children[0]);
    }
  }

  public dispose() {
    for (const npc of this.npcRigs) {
      npc.avatar.disposeRig();
    }
    this.npcRigs = [];
    this.blueprintRigs = [];
    this.plotRigs.clear();
    this.socialBeams = [];
    this.constructionFx = [];
    this.invalidateSpatialCaches();
    this.traffic.dispose();
    this.disposeObjectTree(this.group);
    for (const mat of this.sharedMaterialsSet) mat.dispose();
    this.sharedMaterialsSet.clear();
    this.groundTex.dispose();
    for (const tex of this.ownedTextures) tex.dispose();
    this.ownedTextures = [];
    for (const tex of this.beamGlowTextures.values()) tex.dispose();
    this.beamGlowTextures.clear();
    Object.values(this.bubbleTextures).forEach((t) => t?.dispose());
    this.bubbleTextures = {};
  }
}
