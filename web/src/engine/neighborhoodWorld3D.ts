import * as THREE from "three";
import {
  createDistrictGroundTexture,
  createGardenPathTexture,
  createMoodBubbleTexture,
  createPavedRoadTexture,
  createRadialGlowTexture,
  type MoodBubbleKind
} from "./architectTextures";
import { ResearcherAvatar3D } from "./character3D";
import {
  COMMUNITY_FOUNTAIN_POS,
  TOWN_PARK_CENTER,
  computeNeighborhoodPlacements,
  computeUpcomingBlueprintLots,
  deriveNeighborCharacterProfile,
  getNeighborhoodGrowthStage,
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

  private skyMat: THREE.ShaderMaterial;
  private canalMat!: THREE.ShaderMaterial;
  private starPoints: THREE.Points;
  private clouds: Array<{ group: THREE.Group; angle: number; radius: number; y: number; speed: number }> = [];
  private lampBulbs: THREE.MeshStandardMaterial[] = [];
  private lampHalos: THREE.Sprite[] = [];

  private fountainGroup = new THREE.Group();
  private fountainSpire: THREE.Mesh | null = null;
  private fountainHalo: THREE.Mesh | null = null;

  // Civic Hover-Shuttle gliding along the Outer Suburb Boulevard (unlocks at 10+ minted labs!)
  private shuttleGroup: THREE.Group | null = null;
  private shuttleAngle = 0.4;
  private shuttleVisible = false;

  private plotRigs = new Map<number, NeighborPlotRig>();
  private blueprintRigs: BlueprintLotRig[] = [];
  private npcRigs: NeighborNpcRig[] = [];
  private socialBeams: SocialBeamFX[] = [];
  private lastPlacements: NeighborhoodPlotPlacement[] = [];
  private knownTokenIds = new Set<number>();
  private initializedRoster = false;

  constructor(terrazzoTex: THREE.Texture, titaniumTex: THREE.Texture) {
    this.terrazzoTex = terrazzoTex;
    this.titaniumTex = titaniumTex;
    this.groundTex = createDistrictGroundTexture();
    this.groundTex.wrapS = THREE.RepeatWrapping;
    this.groundTex.wrapT = THREE.RepeatWrapping;
    this.groundTex.repeat.set(2.4, 2.4);

    this.group.add(this.neighborsGroup);
    this.group.add(this.blueprintsGroup);
    this.group.add(this.npcsGroup);
    this.group.add(this.fxGroup);

    // 1. Custom GLSL Procedural Sky Dome (expanded for wide metropolis skyline!)
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
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(96, 32, 20), this.skyMat);
    this.group.add(skyDome);

    // Subtle Twilight Stars (fade in cleanly during moonlit mode)
    const starPositions = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.42;
      const r = 82;
      starPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      starPositions[i * 3 + 1] = Math.cos(phi) * r + 6;
      starPositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    this.starPoints = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: "#ffffff", size: 0.48, transparent: true, opacity: 0 })
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

  private buildTownRoadsAndCanal() {
    const roadTex = createPavedRoadTexture();
    roadTex.repeat.set(8, 8);
    const aveRoadTex = createPavedRoadTexture();
    aveRoadTex.repeat.set(1.2, 26);
    const ewRoadTex = createPavedRoadTexture();
    ewRoadTex.repeat.set(26, 1.2);
    const gardenPathTex = createGardenPathTexture();
    gardenPathTex.repeat.set(6, 6);
    this.ownedTextures.push(roadTex, aveRoadTex, ewRoadTex, gardenPathTex);

    const pavedRingMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      color: "#cbd5e1",
      roughness: 0.72,
      metalness: 0.08
    });
    const nsPavedMat = new THREE.MeshStandardMaterial({
      map: aveRoadTex,
      color: "#cbd5e1",
      roughness: 0.72,
      metalness: 0.08
    });
    const ewPavedMat = new THREE.MeshStandardMaterial({
      map: ewRoadTex,
      color: "#cbd5e1",
      roughness: 0.72,
      metalness: 0.08
    });
    const sidewalkMat = new THREE.MeshStandardMaterial({
      map: this.terrazzoTex,
      color: "#f4f7fb",
      roughness: 0.48
    });
    const curbMat = new THREE.MeshStandardMaterial({
      color: "#dce3ed",
      roughness: 0.44
    });
    const laneLineMat = new THREE.MeshBasicMaterial({
      color: "#f8fafc",
      transparent: true,
      opacity: 0.78
    });
    const metalMat = new THREE.MeshStandardMaterial({
      map: this.titaniumTex,
      color: "#cbd5e1",
      roughness: 0.22,
      metalness: 0.88
    });
    const bridgeGlassMat = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      transmission: 0.82,
      roughness: 0.08,
      transparent: true,
      opacity: 0.72
    });

    // Wide Sunlit Botanical Meadow Valley Parkland Terrain
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(72, 72),
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

    // GLSL Shimmering Reflecting Canal Ring (r = 12.8 .. 14.9)
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
    const canal = new THREE.Mesh(new THREE.RingGeometry(12.8, 14.9, 108, 4), this.canalMat);
    canal.rotation.x = -Math.PI / 2;
    canal.position.y = -0.006;
    this.group.add(canal);

    // Canal stone embankments & waterside walking promenades
    const innerEdge = new THREE.Mesh(new THREE.RingGeometry(12.22, 12.82, 96), sidewalkMat);
    innerEdge.rotation.x = -Math.PI / 2;
    innerEdge.position.y = 0.012;
    const outerEdge = new THREE.Mesh(new THREE.RingGeometry(14.88, 15.48, 96), sidewalkMat);
    outerEdge.rotation.x = -Math.PI / 2;
    outerEdge.position.y = 0.012;
    this.group.add(innerEdge, outerEdge);

    // Ring Road 1: Paved Cobblestone Inner Plaza Boulevard (r = 5.05 .. 6.35) + Honed Sidewalks!
    const innerSidewalk = new THREE.Mesh(new THREE.RingGeometry(4.82, 6.62, 80), sidewalkMat);
    innerSidewalk.rotation.x = -Math.PI / 2;
    innerSidewalk.position.y = 0.003;
    innerSidewalk.receiveShadow = true;
    const innerRingRoad = new THREE.Mesh(new THREE.RingGeometry(5.12, 6.28, 80), pavedRingMat);
    innerRingRoad.rotation.x = -Math.PI / 2;
    innerRingRoad.position.y = 0.01;
    innerRingRoad.receiveShadow = true;
    this.group.add(innerSidewalk, innerRingRoad);

    // Paved circular plaza apron surrounding the Community Research Fountain
    const fountainPlaza = new THREE.Mesh(new THREE.CircleGeometry(2.35, 36), sidewalkMat);
    fountainPlaza.rotation.x = -Math.PI / 2;
    fountainPlaza.position.set(COMMUNITY_FOUNTAIN_POS[0], 0.014, COMMUNITY_FOUNTAIN_POS[1]);
    fountainPlaza.receiveShadow = true;
    this.group.add(fountainPlaza);

    // Ring Road 2: Paved Outer Canal-Side Suburb Boulevard (r = 16.9 .. 18.8) + Twin Sidewalks!
    const suburbSidewalk = new THREE.Mesh(new THREE.RingGeometry(16.55, 19.15, 96), sidewalkMat);
    suburbSidewalk.rotation.x = -Math.PI / 2;
    suburbSidewalk.position.y = 0.003;
    suburbSidewalk.receiveShadow = true;
    const suburbBoulevard = new THREE.Mesh(new THREE.RingGeometry(16.95, 18.75, 96), pavedRingMat);
    suburbBoulevard.rotation.x = -Math.PI / 2;
    suburbBoulevard.position.y = 0.01;
    suburbBoulevard.receiveShadow = true;
    this.group.add(suburbSidewalk, suburbBoulevard);

    // Subtle glowing blue lane guide around the Suburb Boulevard for the Hover-Shuttle
    const shuttleTrack = new THREE.Mesh(
      new THREE.RingGeometry(17.8, 17.9, 96),
      new THREE.MeshBasicMaterial({ color: "#93c5fd", transparent: true, opacity: 0.5 })
    );
    shuttleTrack.rotation.x = -Math.PI / 2;
    shuttleTrack.position.y = 0.016;
    this.group.add(shuttleTrack);

    // Ring Road 3: Paved Outer Skyline City Parkway (r = 26.1 .. 27.6)
    const cityParkwayCurb = new THREE.Mesh(new THREE.RingGeometry(25.85, 27.85, 96), curbMat);
    cityParkwayCurb.rotation.x = -Math.PI / 2;
    cityParkwayCurb.position.y = 0.002;
    const cityParkway = new THREE.Mesh(new THREE.RingGeometry(26.15, 27.55, 96), pavedRingMat);
    cityParkway.rotation.x = -Math.PI / 2;
    cityParkway.position.y = 0.008;
    this.group.add(cityParkwayCurb, cityParkway);

    // 4 Grand Paved Cardinal Avenues (N, S, E, W) with Raised Alabaster Sidewalks & Dashed Centerlines!
    const nsSidewalk = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.016, 54), sidewalkMat);
    nsSidewalk.position.set(0, 0.004, 0);
    nsSidewalk.receiveShadow = true;
    const nsAvenue = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.022, 54), nsPavedMat);
    nsAvenue.position.set(0, 0.012, 0);
    nsAvenue.receiveShadow = true;

    const ewSidewalk = new THREE.Mesh(new THREE.BoxGeometry(54, 0.016, 2.55), sidewalkMat);
    ewSidewalk.position.set(0, 0.004, 0);
    ewSidewalk.receiveShadow = true;
    const ewAvenue = new THREE.Mesh(new THREE.BoxGeometry(54, 0.022, 1.78), ewPavedMat);
    ewAvenue.position.set(0, 0.012, 0);
    ewAvenue.receiveShadow = true;
    this.group.add(nsSidewalk, nsAvenue, ewSidewalk, ewAvenue);

    // Crisp dashed silver-white lane markings along the 4 Cardinal Boulevards
    const dashGeoNS = new THREE.PlaneGeometry(0.08, 0.72);
    const dashGeoEW = new THREE.PlaneGeometry(0.72, 0.08);
    for (const d of [-23, -20.5, -10.2, -8.2, 8.2, 10.2, 20.5, 23]) {
      const nsd = new THREE.Mesh(dashGeoNS, laneLineMat);
      nsd.rotation.x = -Math.PI / 2;
      nsd.position.set(0, 0.026, d);
      const ewd = new THREE.Mesh(dashGeoEW, laneLineMat);
      ewd.rotation.x = -Math.PI / 2;
      ewd.position.set(d, 0.026, 0);
      this.group.add(nsd, ewd);
    }

    // Crisp minimalist pedestrian crosswalk stripes at Inner Plaza, Canal Bridges & Suburb Intersections!
    const stripeMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.9 });
    for (const dist of [6.65, 16.55, 19.15]) {
      for (const sign of [-1, 1]) {
        for (const sx of [-0.62, -0.22, 0.22, 0.62]) {
          const nsStripe = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.46), stripeMat);
          nsStripe.rotation.x = -Math.PI / 2;
          nsStripe.position.set(sx, 0.026, sign * dist);
          const ewStripe = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.16), stripeMat);
          ewStripe.rotation.x = -Math.PI / 2;
          ewStripe.position.set(sign * dist, 0.026, sx);
          this.group.add(nsStripe, ewStripe);
        }
      }
    }

    const bridgeDirs: Array<{ x: number; z: number; rotY: number }> = [
      { x: 0, z: 13.85, rotY: 0 },
      { x: 0, z: -13.85, rotY: Math.PI },
      { x: 13.85, z: 0, rotY: Math.PI / 2 },
      { x: -13.85, z: 0, rotY: -Math.PI / 2 }
    ];

    // 4 Grand Arched Alabaster & Glass Canal Bridges!
    for (const bd of bridgeDirs) {
      const bGroup = new THREE.Group();
      bGroup.position.set(bd.x, 0, bd.z);
      bGroup.rotation.y = bd.rotY;

      // Segmented arched walkway deck spanning z = -1.45 .. +1.45 in local coords
      const segs = 9;
      for (let s = 0; s < segs; s++) {
        const u = (s + 0.5) / segs;
        const localZ = (u - 0.5) * 3.1;
        const archY = Math.sin(u * Math.PI) * 0.42;
        const slope = Math.cos(u * Math.PI) * 0.36;
        const plank = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.1, 0.42), sidewalkMat);
        plank.position.set(0, archY + 0.05, localZ);
        plank.rotation.x = -slope;
        plank.receiveShadow = true;
        bGroup.add(plank);
      }

      // Sleek curved titanium & frosted-glass balustrades on both bridge sides
      for (const side of [-1.04, 1.04]) {
        const railCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side, 0.52, -1.5),
          new THREE.Vector3(side, 0.94, 0),
          new THREE.Vector3(side, 0.52, 1.5)
        ]);
        const rail = new THREE.Mesh(new THREE.TubeGeometry(railCurve, 16, 0.03, 8, false), metalMat);
        bGroup.add(rail);

        const glassPanel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 2.7), bridgeGlassMat);
        glassPanel.position.set(side, 0.56, 0);
        bGroup.add(glassPanel);

        // Glowing corner bridge lanterns
        for (const endZ of [-1.52, 1.52]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.72, 8), metalMat);
          post.position.set(side, 0.36, endZ);
          bGroup.add(post);
          const cap = new THREE.Mesh(
            new THREE.SphereGeometry(0.075, 10, 10),
            new THREE.MeshStandardMaterial({
              color: "#fffbeb",
              emissive: "#fbbf24",
              emissiveIntensity: 0.6
            })
          );
          cap.position.set(side, 0.76, endZ);
          bGroup.add(cap);
        }
      }

      // Crosswalk bars just before & after each bridge
      for (const cwZ of [-2.1, 2.1]) {
        for (const sx of [-0.62, -0.22, 0.22, 0.62]) {
          const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.52), stripeMat);
          stripe.rotation.x = -Math.PI / 2;
          stripe.position.set(sx, 0.028, cwZ);
          bGroup.add(stripe);
        }
      }

      this.group.add(bGroup);
    }
  }

  private buildInstancedTownParks() {
    // 145+ stylized multi-species botanical trees (Sage Oaks, Sakura Blossoms & Slender Cypresses!)
    // lining every boulevard, canal promenade, avenue sidewalk & town greenbelt!
    // Kind: 0 = Lush Sage Tree, 1 = Blooming Sakura Tree, 2 = Slender Botanical Cypress
    const treePositions: Array<[number, number, number, 0 | 1 | 2]> = [];

    // 1. Tree-lined Cardinal Avenues (N, S, E, W boulevard sidewalk trees!)
    for (const dist of [7.6, 10.6, 20.6, 23.8]) {
      for (const side of [-1.85, 1.85]) {
        treePositions.push([side, dist, 0.88, dist === 7.6 ? 1 : 2]);
        treePositions.push([side, -dist, 0.88, dist === 10.6 ? 1 : 2]);
        treePositions.push([dist, side, 0.88, dist === 7.6 ? 1 : 0]);
        treePositions.push([-dist, side, 0.88, dist === 10.6 ? 1 : 0]);
      }
    }

    // 2. Canal inner embankment grove (skipping cardinal bridges & pocket parks at diagonals)
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + 0.11;
      const x = Math.cos(a) * 11.75;
      const z = Math.sin(a) * 11.75;
      if (Math.abs(x) < 2.2 || Math.abs(z) < 2.2) continue;
      if (Math.abs(Math.abs(x) - Math.abs(z)) < 1.65) continue; // keep diagonal pocket parks airy
      treePositions.push([x, z, 0.88 + (i % 3) * 0.18, (i % 3) as 0 | 1 | 2]);
    }

    // 3. Canal outer embankment park belt (between canal r=15.5 and Suburb Boulevard r=16.55)
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2 + 0.08;
      const x = Math.cos(a) * 16.0;
      const z = Math.sin(a) * 16.0;
      if (Math.abs(x) < 2.4 || Math.abs(z) < 2.4) continue;
      treePositions.push([x, z, 0.96 + (i % 3) * 0.2, i % 3 === 0 ? 1 : i % 4 === 0 ? 2 : 0]);
    }

    // 4. Outer suburb greenbelt lining the City Parkway (r = 25.1)
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2 + 0.07;
      const x = Math.cos(a) * 25.1;
      const z = Math.sin(a) * 25.1;
      if (Math.abs(x) < 2.5 || Math.abs(z) < 2.5) continue;
      treePositions.push([x, z, 1.08 + (i % 3) * 0.24, i % 4 === 0 ? 1 : i % 3 === 0 ? 2 : 0]);
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

    // Instanced Blooming Boulevard Shrubs & Flower Clusters lining Inner Ring & Canal Walkways!
    const shrubCoords: Array<[number, number, boolean]> = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2 + 0.16;
      const x = Math.cos(a) * 6.95;
      const z = Math.sin(a) * 6.95;
      if (Math.abs(x) < 1.85 || Math.abs(z) < 1.85) continue;
      shrubCoords.push([x, z, i % 2 === 0]);
    }
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + 0.14;
      const x = Math.cos(a) * 19.55;
      const z = Math.sin(a) * 19.55;
      if (Math.abs(x) < 2.2 || Math.abs(z) < 2.2) continue;
      shrubCoords.push([x, z, i % 3 === 0]);
    }

    const shrubGeo = new THREE.IcosahedronGeometry(0.28, 0);
    const shrubMat = new THREE.MeshStandardMaterial({ color: "#4ade80", roughness: 0.72, flatShading: true });
    const bloomTopGeo = new THREE.SphereGeometry(0.09, 6, 6);
    const pinkBloomMat = new THREE.MeshStandardMaterial({ color: "#f472b6", emissive: "#ec4899", emissiveIntensity: 0.18 });
    const violetBloomMat = new THREE.MeshStandardMaterial({ color: "#a78bfa", emissive: "#8b5cf6", emissiveIntensity: 0.18 });

    const shrubsMesh = new THREE.InstancedMesh(shrubGeo, shrubMat, Math.max(1, shrubCoords.length));
    const pinkMesh = new THREE.InstancedMesh(bloomTopGeo, pinkBloomMat, Math.max(1, shrubCoords.length));
    const violetMesh = new THREE.InstancedMesh(bloomTopGeo, violetBloomMat, Math.max(1, shrubCoords.length));

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
    const metalMat = new THREE.MeshStandardMaterial({
      map: this.titaniumTex,
      color: "#cbd5e1",
      roughness: 0.22,
      metalness: 0.88
    });
    const postGeo = new THREE.CylinderGeometry(0.032, 0.048, 1.9, 8);
    const bulbGeo = new THREE.SphereGeometry(0.11, 10, 10);
    const glowTex = createRadialGlowTexture("#fde68a");
    this.ownedTextures.push(glowTex);

    const lampCoords: Array<[number, number]> = [];
    for (const a of [0.35, 1.05, 1.95, 2.7, 3.6, 4.35, 5.15, 5.9]) {
      lampCoords.push([Math.cos(a) * 5.0, Math.sin(a) * 5.0]);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.26;
      lampCoords.push([Math.cos(a) * 16.85, Math.sin(a) * 16.85]);
    }

    for (const [lx, lz] of lampCoords) {
      const g = new THREE.Group();
      g.position.set(lx, 0, lz);

      const post = new THREE.Mesh(postGeo, metalMat);
      post.position.y = 0.95;
      g.add(post);

      const bulbMat = new THREE.MeshStandardMaterial({
        color: "#fffbeb",
        emissive: "#fbbf24",
        emissiveIntensity: 0.35,
        roughness: 0.14
      });
      this.lampBulbs.push(bulbMat);

      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.y = 1.95;
      g.add(bulb);

      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex,
          transparent: true,
          opacity: 0.2,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      halo.scale.set(0.84, 0.84, 1);
      halo.position.y = 1.95;
      this.lampHalos.push(halo);
      g.add(halo);

      this.group.add(g);
    }
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
      new THREE.MeshPhysicalMaterial({
        color: "#e0f2fe",
        emissive: "#5b8def",
        emissiveIntensity: 0.55,
        roughness: 0.08,
        transmission: 0.52,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.92
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
    const canopyMat = new THREE.MeshPhysicalMaterial({
      color: "#e0f2fe",
      transmission: 0.78,
      roughness: 0.06,
      transparent: true,
      opacity: 0.9
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
   * Newly minted NFTs rise cleanly out of their surveyed blueprint lots!
   */
  public syncNeighbors(neighbors: readonly NeighborLabSummary[]): NeighborhoodPlotPlacement[] {
    const placements = computeNeighborhoodPlacements(neighbors);
    this.lastPlacements = placements;

    const growth = getNeighborhoodGrowthStage(placements.length + 1);
    this.shuttleVisible = growth.transitUnlocked;
    if (this.shuttleGroup) {
      this.shuttleGroup.visible = this.shuttleVisible;
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
    }

    // Rebuild the next 4 upcoming "Next Mint" Holographic Blueprint Lots down the street!
    this.syncUpcomingBlueprintLots(computeUpcomingBlueprintLots(placements.length, 4));

    // Sync living strolling NPC researchers across BOTH Inner Boulevard (Ring 1) & Canal Suburbs (Ring 2)!
    const walkablePlots = placements.filter((p) => p.ring === 1 || p.ring === 2).slice(0, 10);
    this.syncNeighborNpcs(walkablePlots);

    this.initializedRoster = true;
    return placements;
  }

  private removePlotRig(rig: NeighborPlotRig) {
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

      const padGeo = new THREE.PlaneGeometry(3.4, 3.4);
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.rotation.x = -Math.PI / 2;
      g.add(pad);

      const frame = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(3.4, 0.08, 3.4)),
        edgeMat
      );
      frame.position.y = 0.04;
      g.add(frame);

      // 4 Glowing Corner Survey Stakes
      for (const sx of [-1.62, 1.62]) {
        for (const sz of [-1.62, 1.62]) {
          const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.48, 8), pylonMat);
          stake.position.set(sx, 0.24, sz);
          g.add(stake);
        }
      }

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
  }

  public getPlacements(): NeighborhoodPlotPlacement[] {
    return this.lastPlacements;
  }

  public getRaycastTargets(): THREE.Object3D[] {
    const targets: THREE.Object3D[] = [this.fountainGroup];
    for (const rig of this.plotRigs.values()) {
      if (rig.placement.ring === 1 || rig.placement.ring === 2) {
        targets.push(rig.group);
      }
    }
    for (const br of this.blueprintRigs) {
      if (br.lot.ring === 1 || br.lot.ring === 2) {
        targets.push(br.group);
      }
    }
    for (const npc of this.npcRigs) {
      targets.push(npc.avatar.root);
    }
    return targets;
  }

  public getNeighborObstacles(): Array<[number, number, number]> {
    const obs: Array<[number, number, number]> = [
      [COMMUNITY_FOUNTAIN_POS[0], COMMUNITY_FOUNTAIN_POS[1], 1.72]
    ];
    for (const rig of this.plotRigs.values()) {
      if (rig.placement.ring === 1 || rig.placement.ring === 2) {
        obs.push([rig.placement.x, rig.placement.z, 2.25]);
      }
    }
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

    const stoneMat = new THREE.MeshStandardMaterial({
      map: this.terrazzoTex,
      color: "#f4f7fb",
      roughness: 0.46
    });
    const metalMat = new THREE.MeshStandardMaterial({
      map: this.titaniumTex,
      color: "#cfd8e6",
      roughness: 0.22,
      metalness: 0.88
    });
    const elixirMat = new THREE.MeshStandardMaterial({
      color: pal.liquidMid,
      emissive: pal.liquidMid,
      emissiveIntensity: 0.68,
      roughness: 0.16
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      transmission: 0.8,
      roughness: 0.08,
      ior: 1.46,
      thickness: 0.2,
      transparent: true,
      opacity: 0.88
    });

    const windowGlowMats: THREE.MeshStandardMaterial[] = [elixirMat];
    let spinner: THREE.Object3D | undefined;
    let proteinRing: THREE.Object3D | undefined;
    let conduitFiber: THREE.Mesh | undefined;
    let conduitPulse: NeighborPlotRig["conduitPulse"];

    if (pl.ring === 3) {
      // Lightweight Outer Skyline Architectural Tower (renders 96+ outer labs smoothly at 60fps!)
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.24, 3.5), stoneMat);
      base.position.y = 0.12;
      g.add(base);

      const rot = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.5, 0.26, 16), stoneMat);
      rot.position.y = 0.36;
      g.add(rot);

      const coreH = 1.85 + lab.complexityTier * 0.38 + countSectors(lab.sectorsMask) * 0.14;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.7, coreH, 14), glassMat);
      tower.position.y = 0.48 + coreH / 2;
      g.add(tower);

      const innerGlow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.46, coreH * 0.76, 10),
        elixirMat
      );
      innerGlow.position.y = 0.48 + coreH * 0.42;
      g.add(innerGlow);

      if (hasSector(lab.sectorsMask, 5) || lab.complexityTier >= 4) {
        const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(0.96, 1), glassMat);
        dome.scale.set(1, 0.56, 1);
        dome.position.y = 0.5 + coreH;
        g.add(dome);
      }
    } else {
      // Full-Detail Walkable Neighborhood Estate with Yard Gardens, Hedges & Mini-Greenhouses!
      const yardLawnMat = new THREE.MeshStandardMaterial({ color: "#bbf7d0", roughness: 0.85 });
      const hedgeMat = new THREE.MeshStandardMaterial({ color: "#4ade80", roughness: 0.7 });
      const woodBedMat = new THREE.MeshStandardMaterial({ color: "#c8a986", roughness: 0.68 });
      const flowerColors = ["#f472b6", "#a78bfa", "#fbbf24", "#38bdf8", "#fb7185"];
      const yardBloomCol = flowerColors[lab.tokenId % flowerColors.length];
      const yardBloomMat = new THREE.MeshStandardMaterial({
        color: yardBloomCol,
        emissive: yardBloomCol,
        emissiveIntensity: 0.22,
        roughness: 0.45
      });

      const lawnSize = pl.ring === 2 ? 4.85 : 4.25;
      const lawn = new THREE.Mesh(new THREE.BoxGeometry(lawnSize, 0.05, lawnSize), yardLawnMat);
      lawn.position.y = 0.025;
      lawn.receiveShadow = true;
      g.add(lawn);

      // Paved Front Garden Walkway connecting home entrance to the Boulevard!
      const walkLen = pl.ring === 2 ? 2.25 : 1.15;
      const walkway = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.055, walkLen), stoneMat);
      walkway.position.set(0, 0.032, pl.ring === 2 ? 2.6 : 2.15);
      walkway.receiveShadow = true;
      g.add(walkway);

      // Raised Front Yard Flowerbeds + Trimmed Boxwood Hedges flanking every neighbor's porch!
      for (const sx of [-1.18, 1.18]) {
        const planter = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.18, 0.44), woodBedMat);
        planter.position.set(sx, 0.12, 1.98);
        g.add(planter);
        for (let b = -1; b <= 1; b++) {
          const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), yardBloomMat);
          bloom.position.set(sx + b * 0.24, 0.26, 1.98);
          g.add(bloom);
        }
        const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), hedgeMat);
        shrub.position.set(sx * 1.48, 0.2, 1.88);
        g.add(shrub);
      }

      // Cozy Backyard / Sideyard Glass Mini-Greenhouse on ~65% of neighbor homes!
      if (lab.tokenId % 3 !== 0 || hasSector(lab.sectorsMask, 2)) {
        const gh = new THREE.Group();
        gh.position.set(1.88, 0.05, -0.55);
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

      if (pl.ring === 2) {
        // Cute architectural curb mailbox with glowing seed-accent flag!
        const mbPost = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.62, 8), metalMat);
        mbPost.position.set(0.95, 0.31, 2.55);
        const mbBox = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.28), stoneMat);
        mbBox.position.set(0.95, 0.64, 2.55);
        const mbFlag = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.06), elixirMat);
        mbFlag.position.set(1.06, 0.7, 2.55);
        g.add(mbPost, mbBox, mbFlag);
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
          new THREE.MeshPhysicalMaterial({
            color: "#ecfdf5",
            emissive: "#10b981",
            emissiveIntensity: 0.25,
            transmission: 0.78,
            transparent: true
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

      // Floating Plot Plaque Signpost ("Lab #4 · 3/6 Rooms")
      const plaqueTex = this.createPlotPlaqueTexture(lab, pal.liquidMid);
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

  private createPlotPlaqueTexture(lab: NeighborLabSummary, accent: string): THREE.CanvasTexture {
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

    ctx.font = "700 30px 'Inter', sans-serif";
    ctx.fillStyle = "#1a1f2c";
    ctx.fillText(`Lab #${lab.tokenId}`, 58, 54);

    ctx.font = "600 18px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#64748b";
    ctx.fillText(`$${lab.valueUsd} · ${countSectors(lab.sectorsMask)}/6 rooms`, 34, 88);

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

      // Ring 1 NPCs tend yard gardens & stroll inner plaza; Ring 2 NPCs stroll Suburb Boulevard & Botanical Park!
      let patrolX = homeX * 0.68 + (i % 2 === 0 ? 0.9 : -0.9);
      let patrolZ = homeZ * 0.68 + 1.1;
      if (pl.ring === 2) {
        if (i % 3 === 0) {
          // Stroll right over to the Grand Botanical Park Conservatory!
          patrolX = TOWN_PARK_CENTER[0] - 2.2 + (i % 2) * 1.6;
          patrolZ = TOWN_PARK_CENTER[1] - 2.4;
        } else {
          const ang = Math.atan2(homeZ, homeX) + (i % 2 === 0 ? 0.16 : -0.16);
          patrolX = Math.cos(ang) * 18.0;
          patrolZ = Math.sin(ang) * 18.0;
        }
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

    // Hover-Shuttle gliding smoothly around the Suburb Boulevard (r = 17.85) once 10+ labs minted!
    if (this.shuttleGroup && this.shuttleVisible) {
      this.shuttleAngle += dt * 0.14;
      const sx = Math.cos(this.shuttleAngle) * 17.85;
      const sz = Math.sin(this.shuttleAngle) * 17.85;
      this.shuttleGroup.position.set(sx, 0.08 + Math.sin(t * 3.2) * 0.04, sz);
      this.shuttleGroup.rotation.y = -this.shuttleAngle;
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
      npc.avatar.update(dt, t + i * 1.7, isMoving ? 0.5 : 0, isMoving);

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
    this.disposeObjectTree(this.group);
    this.groundTex.dispose();
    for (const tex of this.ownedTextures) tex.dispose();
    this.ownedTextures = [];
    for (const tex of this.beamGlowTextures.values()) tex.dispose();
    this.beamGlowTextures.clear();
    Object.values(this.bubbleTextures).forEach((t) => t?.dispose());
    this.bubbleTextures = {};
  }
}
