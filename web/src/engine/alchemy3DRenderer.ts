import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  AdaptivePixelRatioController,
  detectDevicePerfProfile,
  installBrowserCompatPolyfills,
  type DevicePerfProfile
} from "./browserCompat";
import {
  createAlabasterTerrazzoTexture,
  createArchitecturalBlueprintFloorTexture,
  createBrushedTitaniumTexture,
  createFloorFinishTexture,
  createMoodBubbleTexture,
  createRadialGlowTexture,
  createSoftAOTexture,
  type MoodBubbleKind
} from "./architectTextures";
import { ResearcherAvatar3D, type CharacterEmote, type CharacterPosture } from "./character3D";
import type { CharacterProfile } from "./characterConfig";
import { DiegeticLabMonitors3D, type DiegeticMonitorTelemetry } from "./diegeticPanels3D";
import { createInitialGardenState, type GardenWorldState } from "./gardenState";
import { HomeArchitecture3D } from "./homeArchitecture3D";
import {
  clampPlacementPoint,
  evaluateStairWalk,
  findNearestStationWithLayout,
  getGroundElevationForFloor,
  getUpperFloorY,
  resolveItemPlacement,
  type FloorNumber,
  type MovableItemId
} from "./homeLayout";
import {
  LAB_STATIONS,
  LAB_STATION_BY_ID,
  stationForSector,
  type LabStationId,
  type ProjectedStationAnchor
} from "./labStations";
import {
  TOWN_PARKS,
  getExpansionBandCount,
  type NeighborLabSummary,
  type NeighborhoodPlotPlacement
} from "./neighborhoodLayout";
import { NeighborhoodWorld3D } from "./neighborhoodWorld3D";
import { SeededRNG, deriveTraitsFromSeed } from "./prng";
import { SimsFurniture3D } from "./simsFurniture3D";
import { TownGardens3D } from "./townGardens3D";
import {
  FLOOR_STYLES,
  defaultLabDecor,
  type FloorStyleId,
  type LabDecorConfig,
  type SimsObjectTarget
} from "./simsState";
import type { ComputeSnapshot, ResidueNode } from "./researchCompute";
import { ResearchComputeRunner } from "./researchRunner";
import { assignSecondaryStructurePSEA, type SecondaryCode } from "./structuralAnalysis";
import { soundEngine } from "./soundEngine";
import { hasSector } from "../web3/sectors";
import { stageFromEth, type AlchemyTraits } from "./traits";
import type { LiveImpactState } from "./alchemyRenderer";

interface Bubble3D {
  mesh: THREE.Mesh;
  baseX: number;
  baseZ: number;
  y: number;
  speed: number;
  phase: number;
}

interface VaporRing3D {
  mesh: THREE.Mesh;
  age: number;
  maxAge: number;
}

interface OrbitItem {
  ring: THREE.Mesh;
  electron: THREE.Mesh;
  trail: THREE.Mesh[];
  radius: number;
  speed: number;
  phase: number;
}

interface Burst3D {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

interface CompanionRig {
  group: THREE.Group;
  head: THREE.Group;
  tail: THREE.Object3D;
  paw?: THREE.Object3D;
  wings?: [THREE.Object3D, THREE.Object3D];
  eyes: THREE.Mesh[];
  homePos: THREE.Vector3;
  homeRotY: number;
  baseY: number;
  isDog: boolean;
  petReaction: number;
}

interface TreatDrop3D {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  eaten: boolean;
}

interface MoodBubble3D {
  sprite: THREE.Sprite;
  life: number;
  maxLife: number;
  baseX: number;
  baseZ: number;
  startY: number;
}

interface WingConduitPulse {
  mesh: THREE.Mesh;
  curve: THREE.CatmullRomCurve3;
  t: number;
  speed: number;
}

export type CameraPreset = "iso" | "top" | "pet" | "molecule";
export type CameraMode = "follow" | "orbit" | "neighborhood";
export type CreatorFocusZone = "face" | "hair" | "outfit" | "back" | "full";
export type LightingMood = "daylight" | "golden" | "silver" | "moonlit";
export type AtmosphereMode = "clear" | "snow" | "motes";

export interface SimsActionRequest {
  x: number;
  z: number;
  floor?: FloorNumber;
  yaw?: number;
  posture?: CharacterPosture;
  emote?: CharacterEmote;
  bubble?: MoodBubbleKind;
  burstColor?: string;
  onArrive?: () => void;
}

export interface InteractiveEvent {
  kind: "pet-clicked" | "atom-popped" | "room-clicked" | "floor-walk" | "monitor-clicked";
  bonusCoins: number;
  combo?: number;
  sectorId?: number;
  roomName?: string;
  stationId?: LabStationId;
}

export interface WalkFrameTelemetry {
  anchors: Record<LabStationId, ProjectedStationAnchor>;
  charX: number;
  charZ: number;
  charYaw: number;
  petX: number | null;
  petZ: number | null;
  moving: boolean;
  nearStation: LabStationId | null;
  width: number;
  height: number;
}

const UP_AXIS = new THREE.Vector3(0, 1, 0);

/**
 * 10x Architectural 3D Maquette WebGL Engine (Three.js PBR + Studio Reflections + 360° Orbit).
 *
 * Crafted like viewing an architectural museum pavilion in an architect app:
 *  - Honed alabaster terrazzo plinth, recessed reflecting water pool, CAD blueprint drafting floor
 *  - Cutaway frosted-glass brise-soleil fin colonnade, cantilevered skylight roof & entrance steps
 *  - Photorealistic borosilicate glass vessels with rippling 3D liquid meniscus, caustics & vapor rings
 *  - Live 3D Ball-and-Stick Protein Folding engine (real AB-model physics exporting .PDB datasets)
 *  - Sculptural 3D animated Cats & Dogs on terraced porcelain cushions reacting to live discoveries
 *  - 5 progressive architectural & cosmic complexity tiers ($1 already grand -> $500+ Magnum Opus)
 */
export class Alchemy3DRenderer {
  private container: HTMLElement;
  private perfProfile: DevicePerfProfile;
  private adaptiveDpr: AdaptivePixelRatioController;
  private contextLost = false;
  private lastTelemetryEmitMs = 0;
  private lastHoverRaycastMs = 0;
  private tmpNdc = new THREE.Vector2();
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget;

  // Shared procedural architectural textures
  private terrazzoTex: THREE.CanvasTexture;
  private titaniumTex: THREE.CanvasTexture;
  private blueprintTex: THREE.CanvasTexture;
  private aoTex: THREE.CanvasTexture;
  private glowTextures: THREE.CanvasTexture[] = [];

  private traits: AlchemyTraits;
  private impact: LiveImpactState;
  private compute: ResearchComputeRunner;
  private onComputeTick?: (snap: ComputeSnapshot) => void;
  private onInteractiveEvent?: (ev: InteractiveEvent) => void;

  private raycaster = new THREE.Raycaster();
  private pointerDownPos = { x: 0, y: 0 };
  private protonCombo = 0;
  private lastProtonPopMs = 0;
  private hoveredAtom: THREE.Group | null = null;
  private desiredCamPos: THREE.Vector3 | null = null;
  private desiredCamTarget: THREE.Vector3 | null = null;
  private toyBall: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; bounceCooldown: number } | null = null;
  private treats: TreatDrop3D[] = [];
  private moodBubbles: MoodBubble3D[] = [];
  private moodTextures: Partial<Record<MoodBubbleKind, THREE.CanvasTexture>> = {};
  private wingConduits: WingConduitPulse[] = [];

  private hemiLight: THREE.HemisphereLight | null = null;
  private keyLight: THREE.DirectionalLight | null = null;
  private rimLight: THREE.DirectionalLight | null = null;
  private causticLight: THREE.PointLight | null = null;
  private lightingMood: LightingMood = "daylight";
  private atmosphereMode: AtmosphereMode = "clear";
  private atmosphereMotes: Array<{ mesh: THREE.Mesh; baseX: number; baseZ: number; y: number; speed: number; phase: number }> = [];

  private rootGroup = new THREE.Group();
  private dynamicGroup = new THREE.Group();
  /** Diorama architectural plinth, water pool & colonnade fins (visible in Mint/Gallery, hidden in walkable architect house) */
  private pavilionGroup = new THREE.Group();
  /** Seed-generated borosilicate NFT apparatus & miniature wings (full 1.0x in Mint/Gallery; compact 0.38x on Center Display Table in Walk Mode!) */
  private nftTabletopGroup = new THREE.Group();
  private previewGhostGroup = new THREE.Group();
  private atmosphereGroup = new THREE.Group();
  private walkCampusGroup = new THREE.Group();
  private shadowFloorMesh: THREE.Mesh | null = null;
  private blueprintPlaneMesh: THREE.Mesh | null = null;
  private aoDiscMesh: THREE.Mesh | null = null;
  private walkFloorPlane: THREE.Mesh | null = null;
  private diegeticMonitors: DiegeticLabMonitors3D | null = null;
  private simsFurniture: SimsFurniture3D | null = null;
  private homeArchitecture: HomeArchitecture3D | null = null;
  private townGardens: TownGardens3D | null = null;
  private gardenState: GardenWorldState = createInitialGardenState();
  private lastGardenSyncMs = 0;
  private neighborhoodWorld: NeighborhoodWorld3D | null = null;
  private activeFloor: FloorNumber = 1;
  private movingItem: MovableItemId | null = null;
  private moveSnapGrid = true;
  private moveGhostRing: THREE.Group | null = null;
  private movePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.12);
  private tmpMoveHit = new THREE.Vector3();
  private onPlaceMovedItem?: (itemId: MovableItemId, x: number, z: number, floor: FloorNumber) => void;
  private floorTextures: Partial<Record<FloorStyleId, THREE.CanvasTexture>> = {};
  private pavilionFloorMat: THREE.MeshStandardMaterial | null = null;
  private heroVesselGroup: THREE.Group | null = null;
  private labDecor: LabDecorConfig = defaultLabDecor();
  private pendingNeighbors: NeighborLabSummary[] = [];
  private plumbobHex = "#10b981";
  private stationBeacons: Map<
    LabStationId,
    { ring: THREE.Mesh; disc: THREE.Mesh; pillar: THREE.Mesh; baseY: number }
  > = new Map();
  private walkWaypointMesh: THREE.Mesh | null = null;
  private walkWaypointLife = 0;
  private walkHoverRing: THREE.Mesh | null = null;
  private walkBreadcrumbs: THREE.Mesh[] = [];
  private footPuffs: Array<{ mesh: THREE.Mesh; life: number; vx: number; vy: number; vz: number }> = [];
  private nextFootPuffIdx = 0;

  // Walkable 3D Researcher Character & Spatial Camera State
  private walkMode = false;
  private creatorCameraMode = false;
  private creatorFocusZone: CreatorFocusZone = "full";
  private creatorTurntable = false;
  private creatorTargetYaw = 0.24;
  private cameraMode: CameraMode = "follow";
  private characterAvatar: ResearcherAvatar3D | null = null;
  private characterProfile: CharacterProfile | null = null;
  private visitingHostAvatar: ResearcherAvatar3D | null = null;
  private visitingHostTokenId = 0;
  private visitingHostX = -0.68;
  private visitingHostZ = 1.24;
  private visitingHostYaw = 0.45;
  private visitingHostWaveCooldown = 0;
  private charX = 0;
  private charY = 0.39;
  private charZ = 1.38;
  private charVx = 0;
  private charVz = 0;
  private charYaw = 0.24;
  private charMoving = false;
  private walkTarget: {
    x: number;
    z: number;
    arriveStation?: LabStationId | null;
    arriveAction?: SimsActionRequest;
  } | null = null;
  private moveInput = { dx: 0, dz: 0, sprint: false };
  private activeStationHighlight: LabStationId | null = null;
  private lastNearStation: LabStationId | null = null;
  private onWalkTelemetry?: (telemetry: WalkFrameTelemetry) => void;
  private onNearStationChange?: (stationId: LabStationId | null) => void;
  private onStationArrived?: (stationId: LabStationId) => void;
  private onSimsObjectClick?: (target: SimsObjectTarget, screenX: number, screenY: number) => void;
  private onActiveFloorChange?: (floor: FloorNumber) => void;
  private followCameraInitialized = false;
  private tmpProj = new THREE.Vector3();
  private tmpCamFwd = new THREE.Vector3();
  private tmpCamRight = new THREE.Vector3();
  private tmpMoveVec = new THREE.Vector3();
  private previewSectorId: number | null = null;
  private buildPopScale = 1;
  private proteinChainLength = -1;
  private proteinRibbonMesh: THREE.Mesh | null = null;
  private proteinRibbonCurvePts: THREE.Vector3[] = [];
  private smoothResiduePos: THREE.Vector3[] = [];
  private lastRibbonSnapshotPos: THREE.Vector3[] = [];
  private proteinInitialized = false;
  private cachedSSCodes: SecondaryCode[] = [];
  private cachedSSEnergyKey = "";
  private proteinMorphBoost = 0;
  private lastRibbonUpdateMs = 0;
  private staticPreview = false;
  private causticShaderMat: THREE.ShaderMaterial | null = null;
  private cryoHelixes: THREE.Object3D[] = [];
  private greenhouseStems: THREE.Object3D[] = [];
  private greenhousePollen: Array<{ mesh: THREE.Mesh; base: THREE.Vector3; phase: number }> = [];
  private spirePulseRing: THREE.Mesh | null = null;

  // Animated 3D references
  private liquidMesh: THREE.Mesh | null = null;
  private liquidTopMesh: THREE.Mesh | null = null;
  private liquidTopBasePos: Float32Array | null = null;
  private waterPoolMesh: THREE.Mesh | null = null;
  private bubbles: Bubble3D[] = [];
  private vaporRings: VaporRing3D[] = [];
  private nucleusGroup: THREE.Group | null = null;
  private nucleusBalls: Array<{ mesh: THREE.Mesh; base: THREE.Vector3; phase: number }> = [];
  private orbitals: OrbitItem[] = [];
  private floatingAtoms: Array<{ group: THREE.Group; base: THREE.Vector3; phase: number; speed: number }> = [];
  private condenserDroplets: Array<{ mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; offset: number }> = [];
  private vialBubbles: Array<{ mesh: THREE.Mesh; baseY: number; maxH: number; speed: number }> = [];
  private manometerNeedle: THREE.Object3D | null = null;
  private astrolabeRing: THREE.Object3D | null = null;
  private proteinGroup: THREE.Group | null = null;
  private residueMeshes: THREE.Mesh[] = [];
  private bondCylinders: THREE.Mesh[] = [];
  private contactLines: THREE.LineSegments | null = null;
  private workUnitRing: THREE.Mesh | null = null;
  private gyroRings: THREE.Mesh[] = [];
  private protonPackets: Array<{ mesh: THREE.Mesh; t: number; speed: number }> = [];
  private energyCurveLine: THREE.Line | null = null;
  private orreryGroup: THREE.Group | null = null;
  private microAlembics: Array<{ group: THREE.Group; baseY: number; phase: number }> = [];
  private hypercubeLines: THREE.LineSegments | null = null;
  private constellationLines: THREE.LineSegments | null = null;
  private miningBlades: THREE.Object3D[] = [];
  private acceleratorRings: THREE.Object3D[] = [];
  private cryoBeacons: THREE.Mesh[] = [];
  private companions: CompanionRig[] = [];
  private builtWingGroups: Array<{ sectorId: number; name: string; group: THREE.Group }> = [];
  private highlightedResidueIdx: number | null = null;
  private highlightHalo: THREE.Sprite | null = null;
  private showBestFold = true;
  private bursts: Burst3D[] = [];
  private shockwaveRing: THREE.Mesh | null = null;
  private waterRipples: Array<{ mesh: THREE.Mesh; life: number }> = [];
  private nextWaterRippleIdx = 0;

  private rafId = 0;
  private startTime = 0;
  private lastTime = 0;
  private lastUiEmit = 0;
  private displayFill = 0.44;
  private targetFill = 0.44;
  private excitement = 0;
  private discoveryFlash = 0;
  private lastDiscoveryVisualMs = 0;
  private shockwaveLife = 0;
  private lastSleepBubbleAt = 0;
  private builtSeed = "";
  private builtTier = -1;
  private builtSectorsMask = -1;
  private builtAccessoryRank = "";
  private userDragging = false;
  private autoRotateDesired = true;

  // Scratch vectors for zero-GC bond cylinder alignment & smooth protein damping
  private tmpMid = new THREE.Vector3();
  private tmpDir = new THREE.Vector3();
  private tmpTarget = new THREE.Vector3();
  private tmpQuat = new THREE.Quaternion();

  constructor(
    container: HTMLElement,
    initialState: LiveImpactState,
    onComputeTick?: (snap: ComputeSnapshot) => void,
    onInteractiveEvent?: (ev: InteractiveEvent) => void,
    options?: { staticPreview?: boolean }
  ) {
    this.container = container;
    this.staticPreview = Boolean(options?.staticPreview);
    this.impact = { ...initialState };
    this.onComputeTick = onComputeTick;
    this.onInteractiveEvent = onInteractiveEvent;
    this.traits = deriveTraitsFromSeed(initialState.seed);
    this.compute = new ResearchComputeRunner(
      initialState.seed,
      initialState.causeId,
      initialState.tokenId,
      () => this.onResearchDiscovery(),
      (snap) => {
        const now = performance.now();
        if (now - this.lastUiEmit > 240) {
          this.lastUiEmit = now;
          this.onComputeTick?.(snap);
        }
      },
      this.staticPreview
    );

    installBrowserCompatPolyfills();
    this.perfProfile = detectDevicePerfProfile();
    this.adaptiveDpr = new AdaptivePixelRatioController(
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      this.perfProfile.minPixelRatio,
      this.perfProfile.maxPixelRatio
    );

    this.terrazzoTex = createAlabasterTerrazzoTexture();
    this.titaniumTex = createBrushedTitaniumTexture();
    this.blueprintTex = createArchitecturalBlueprintFloorTexture();
    this.aoTex = createSoftAOTexture();

    const powerPref = this.perfProfile.tier === "mobile" ? "default" : "high-performance";
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: this.perfProfile.antialias,
        alpha: false,
        powerPreference: powerPref
      });
    } catch {
      this.renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: "default"
      });
    }
    this.renderer.setPixelRatio(this.adaptiveDpr.getPixelRatio());
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = this.perfProfile.enableShadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.touchAction = "none";
    this.renderer.domElement.addEventListener("webglcontextlost", this.handleContextLost, false);
    this.renderer.domElement.addEventListener("webglcontextrestored", this.handleContextRestored, false);
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#f8fafd");
    this.scene.fog = new THREE.FogExp2("#f8fafd", 0.032);

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = this.pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;

    const w = Math.max(260, container.clientWidth || 540);
    const h = Math.max(260, container.clientHeight || 540);
    this.camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 340);
    this.camera.position.set(5.45, 4.3, 6.25);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.55, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.enablePan = false;
    this.controls.minDistance = 4.0;
    this.controls.maxDistance = 12.2;
    this.controls.minPolarAngle = 0.2;
    this.controls.maxPolarAngle = Math.PI * 0.482;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.48;
    this.controls.addEventListener("start", () => {
      this.userDragging = true;
      this.controls.autoRotate = false;
      this.desiredCamPos = null;
      this.desiredCamTarget = null;
    });
    this.controls.addEventListener("end", () => {
      this.userDragging = false;
    });

    // Click-to-Interact + Hover Feedback 3D Raycasting
    if (!this.staticPreview) {
      this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
      this.renderer.domElement.addEventListener("pointerup", this.handlePointerUp);
      this.renderer.domElement.addEventListener("pointermove", this.handlePointerMove);
    }

    this.setupArchitecturalStudioLighting();
    this.scene.add(this.rootGroup);
    this.rootGroup.add(this.dynamicGroup);
    this.rootGroup.add(this.previewGhostGroup);
    this.rootGroup.add(this.atmosphereGroup);
    this.rootGroup.add(this.walkCampusGroup);

    this.syncFillTarget();
    this.neighborhoodWorld?.setGlobalImpactScale(this.impact.globalImpactEth);
    this.displayFill = this.targetFill;
    this.rebuild3DModel();
    this.resize();
  }

  private setupArchitecturalStudioLighting() {
    const hemi = new THREE.HemisphereLight("#ffffff", "#dae2ee", 1.2);
    this.hemiLight = hemi;
    this.scene.add(hemi);

    // Architectural studio key light casting crisp softbox shadows (scaled cleanly per device tier)
    const key = new THREE.DirectionalLight("#fffdf9", 1.85);
    key.position.set(6.5, 11.2, 5.8);
    key.castShadow = this.perfProfile.enableShadows;
    key.shadow.mapSize.set(this.perfProfile.shadowMapSize, this.perfProfile.shadowMapSize);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 26;
    const d = 4.8;
    key.shadow.camera.left = -d;
    key.shadow.camera.right = d;
    key.shadow.camera.top = d;
    key.shadow.camera.bottom = -d;
    key.shadow.bias = -0.0004;
    key.shadow.radius = 3.5;
    this.keyLight = key;
    this.scene.add(key);

    // Cool sky rim light sculpting glass & silver silhouettes
    const rim = new THREE.DirectionalLight("#c9e0ff", 0.78);
    rim.position.set(-7.0, 5.5, -5.2);
    this.rimLight = rim;
    this.scene.add(rim);

    const bounce = new THREE.PointLight("#ffefe0", 0.42, 16);
    bounce.position.set(3.8, 2.0, -3.5);
    this.scene.add(bounce);

    // Pure white drafting floor catching real crisp architectural contact shadows
    const shadowFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 46),
      new THREE.ShadowMaterial({ opacity: 0.16 })
    );
    shadowFloor.rotation.x = -Math.PI / 2;
    shadowFloor.position.y = -0.012;
    shadowFloor.receiveShadow = true;
    this.shadowFloorMesh = shadowFloor;
    this.scene.add(shadowFloor);

    // Architectural CAD Blueprint Drafting Sheet directly under the scale model
    const blueprintPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(11.6, 11.6),
      new THREE.MeshBasicMaterial({
        map: this.blueprintTex,
        transparent: true,
        opacity: 0.9,
        depthWrite: false
      })
    );
    blueprintPlane.rotation.x = -Math.PI / 2;
    blueprintPlane.position.y = -0.006;
    this.blueprintPlaneMesh = blueprintPlane;
    this.scene.add(blueprintPlane);

    // Baked soft ambient occlusion shadow grounding the entire plinth
    const aoDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(7.2, 7.2),
      new THREE.MeshBasicMaterial({
        map: this.aoTex,
        transparent: true,
        opacity: 0.78,
        depthWrite: false
      })
    );
    aoDisc.rotation.x = -Math.PI / 2;
    aoDisc.position.y = -0.002;
    this.aoDiscMesh = aoDisc;
    this.scene.add(aoDisc);
  }

  public setComputeActive(active: boolean) {
    this.compute.setActive(active);
    this.onComputeTick?.(this.compute.getSnapshot());
  }

  public setHighlightedResidue(index: number | null) {
    this.highlightedResidueIdx = index;
  }

  public setShowBestFold(showBest: boolean) {
    this.showBestFold = showBest;
    this.cachedSSEnergyKey = "";
    this.lastRibbonUpdateMs = 0; // force immediate Mol* ribbon refresh
  }

  public setAutoRotate(enabled: boolean) {
    this.autoRotateDesired = enabled;
    this.controls.autoRotate = enabled && !this.walkMode && !this.creatorCameraMode;
  }

  public setWalkCallbacks(callbacks: {
    onTelemetry?: (telemetry: WalkFrameTelemetry) => void;
    onNearStationChange?: (stationId: LabStationId | null) => void;
    onStationArrived?: (stationId: LabStationId) => void;
    onSimsObjectClick?: (target: SimsObjectTarget, screenX: number, screenY: number) => void;
    onPlaceMovedItem?: (itemId: MovableItemId, x: number, z: number, floor: FloorNumber) => void;
    onActiveFloorChange?: (floor: FloorNumber) => void;
  }) {
    this.onWalkTelemetry = callbacks.onTelemetry;
    this.onNearStationChange = callbacks.onNearStationChange;
    this.onStationArrived = callbacks.onStationArrived;
    this.onSimsObjectClick = callbacks.onSimsObjectClick;
    this.onPlaceMovedItem = callbacks.onPlaceMovedItem;
    this.onActiveFloorChange = callbacks.onActiveFloorChange;
  }

  public setControlsEnabled(enabled: boolean) {
    this.controls.enabled = enabled;
  }

  public setNeighbors(neighbors: NeighborLabSummary[]): NeighborhoodPlotPlacement[] {
    const prevCount = this.pendingNeighbors.length + 1;
    const prevBands = getExpansionBandCount(this.pendingNeighbors.length + 4);
    this.pendingNeighbors = neighbors;
    if (this.neighborhoodWorld) {
      const placements = this.neighborhoodWorld.syncNeighbors(neighbors);
      const nextCount = placements.length + 1;
      const nextBands = getExpansionBandCount(placements.length + 4);
      const crossedBand =
        (prevCount < 10 && nextCount >= 10) ||
        (prevCount < 25 && nextCount >= 25) ||
        prevBands !== nextBands;
      if (this.cameraMode === "neighborhood" && crossedBand && !this.userDragging) {
        this.frameWalkCamera();
      }
      return placements;
    }
    return [];
  }

  public setActiveFloor(floor: FloorNumber) {
    const minFloor: FloorNumber = this.labDecor.hasBasement ? 0 : 1;
    const targetFloor = Math.max(minFloor, Math.min(this.labDecor.houseFloors, floor)) as FloorNumber;
    if (this.activeFloor === targetFloor) return;
    this.activeFloor = targetFloor;
    this.walkTarget = null;
    this.charVx = 0;
    this.charVz = 0;
    this.characterAvatar?.setPosture("stand");

    if (targetFloor === 0) {
      // Step cleanly into the sunlit-lightwell B1 Architect Basement!
      this.charX = 0.45;
      this.charZ = -0.65;
      this.charYaw = -0.55;
    } else if (targetFloor === 1) {
      this.charX = 0;
      this.charZ = 1.48;
      this.charYaw = 0.24;
    } else if (targetFloor === 2) {
      // Step cleanly onto the 2F North Mezzanine Loft landing beside the top of the stairs!
      this.charX = -1.65;
      this.charZ = -2.75;
      this.charYaw = 0.55;
    } else {
      // Step cleanly onto the 3F Starlight Sky Penthouse deck!
      this.charX = -2.25;
      this.charZ = -2.35;
      this.charYaw = 0.72;
    }
    this.applyFloorCutawayVisibility();
    this.charY = this.getWalkGroundY(this.charX, this.charZ);
    if (this.characterAvatar) {
      this.characterAvatar.root.position.set(this.charX, this.charY, this.charZ);
      this.characterAvatar.root.rotation.y = this.charYaw;
      this.characterAvatar.triggerEmote("hop");
    }
    this.spawnColoredBurst(
      new THREE.Vector3(this.charX, this.charY + 0.68, this.charZ),
      14,
      ["#ffffff", "#38bdf8", this.traits.palette.liquidMid]
    );
    this.followCameraInitialized = false;
    if (!this.creatorCameraMode && this.cameraMode === "follow") {
      this.frameWalkCamera();
    }
  }

  /**
   * Coordinates Sims-style dollhouse cutaway visibility across B1 Basement, 1F, 2F & 3F,
   * and scales the NFT apparatus cleanly onto the 1F Center Architect Display Table in Walk Mode!
   */
  private applyWalkModeScaleLayout() {
    if (!this.walkMode) {
      this.pavilionGroup.visible = true;
      this.nftTabletopGroup.visible = true;
      this.nftTabletopGroup.scale.setScalar(1);
      this.nftTabletopGroup.position.set(0, 0, 0);
      if (this.blueprintPlaneMesh) this.blueprintPlaneMesh.visible = true;
      if (this.aoDiscMesh) this.aoDiscMesh.visible = true;
      if (this.shadowFloorMesh) this.shadowFloorMesh.visible = true;
      for (const w of this.builtWingGroups) {
        if (w.sectorId !== 5) w.group.position.y = 0.23;
      }
      for (const c of this.companions) {
        c.group.visible = true;
      }
      return;
    }

    // Walkable Modern Architect House Mode:
    // Hide the giant Mint/Gallery plinth/water moat/colonnade so the interior house floor is wide open & navigable!
    this.pavilionGroup.visible = false;
    if (this.blueprintPlaneMesh) this.blueprintPlaneMesh.visible = false;
    if (this.aoDiscMesh) this.aoDiscMesh.visible = false;

    // Scale the seed-generated NFT vessel, liquid, protein helix & built wings cleanly onto the
    // Center Architect Display Table (centered at (0, -0.35), tabletop height y = 0.68m)!
    const tabletopScale = 0.38;
    this.nftTabletopGroup.scale.setScalar(tabletopScale);
    this.nftTabletopGroup.position.set(0, 0.68 - 0.52 * tabletopScale, -0.35);
    for (const w of this.builtWingGroups) {
      if (w.sectorId !== 5) w.group.position.y = 0.52;
    }

    // Position the 3D Pet Companions naturally on the real 1F interior house floor near Pet Sanctuary!
    const petSpot = resolveItemPlacement("pet", this.labDecor.customLayout);
    const petFloorY = getGroundElevationForFloor(petSpot.floor, petSpot.x, petSpot.z, this.labDecor.houseSize);
    this.companions.forEach((c, idx) => {
      const ox = idx === 0 ? -0.22 : 0.28;
      const oz = idx === 0 ? -0.18 : 0.14;
      c.baseY = petFloorY + 0.015;
      c.homePos.set(petSpot.x + ox, c.baseY, petSpot.z + oz);
      c.group.position.set(c.homePos.x, c.baseY, c.homePos.z);
    });

    this.applyFloorCutawayVisibility();
  }

  private applyFloorCutawayVisibility() {
    if (!this.walkMode) return;
    const f = this.activeFloor;
    this.homeArchitecture?.setViewedFloor(f);
    this.simsFurniture?.setViewedFloor(f);
    this.nftTabletopGroup.visible = f >= 1;
    if (this.shadowFloorMesh) this.shadowFloorMesh.visible = f !== 0;

    const petFloor = resolveItemPlacement("pet", this.labDecor.customLayout).floor;
    for (const c of this.companions) {
      c.group.visible = f === 0 ? petFloor === 0 : petFloor >= 1 && petFloor <= f;
    }
    if (this.visitingHostAvatar) {
      this.visitingHostAvatar.root.visible = f >= 1;
    }

    for (const st of LAB_STATIONS) {
      const p = resolveItemPlacement(st.id, this.labDecor.customLayout);
      const show = f === 0 ? p.floor === 0 : p.floor >= 1 && p.floor <= f;
      this.diegeticMonitors?.setStationVisibility(st.id, show);
      const b = this.stationBeacons.get(st.id);
      if (b) {
        b.ring.visible = show && !this.creatorCameraMode;
        b.disc.visible = show && !this.creatorCameraMode;
        b.pillar.visible = show && !this.creatorCameraMode;
      }
    }
  }

  public setMovingItem(itemId: MovableItemId | null, snapGrid = true) {
    this.movingItem = itemId;
    this.moveSnapGrid = snapGrid;
    if (!this.moveGhostRing) return;
    if (!itemId) {
      this.moveGhostRing.visible = false;
      return;
    }
    const p = resolveItemPlacement(itemId, this.labDecor.customLayout);
    const gy = getGroundElevationForFloor(p.floor, p.x, p.z, this.labDecor.houseSize);
    this.moveGhostRing.position.set(p.x, gy + 0.032, p.z);
    this.moveGhostRing.visible = true;
  }

  private syncCustomLayoutPositions() {
    for (const st of LAB_STATIONS) {
      const p = resolveItemPlacement(st.id, this.labDecor.customLayout);
      const baseY = getGroundElevationForFloor(p.floor, p.x, p.z, this.labDecor.houseSize) + 0.008;
      const b = this.stationBeacons.get(st.id);
      if (b) {
        b.baseY = baseY;
        b.disc.position.set(p.x, baseY, p.z);
        b.ring.position.set(p.x, baseY + 0.008, p.z);
        b.pillar.position.set(p.x, baseY + 0.52, p.z);
      }
      this.diegeticMonitors?.setStationPosition(st.id, p.x, baseY + 1.36, p.z);
    }
  }

  public setLabDecor(decor: LabDecorConfig) {
    const prevUpgrades = this.labDecor.stationUpgrades;
    const prevSize = this.labDecor.houseSize;
    const prevFloors = this.labDecor.houseFloors;
    const prevRoomsLen = this.labDecor.extraRooms.length;

    this.labDecor = {
      ...decor,
      stationUpgrades: { ...decor.stationUpgrades },
      extraRooms: [...decor.extraRooms],
      customLayout: { ...decor.customLayout }
    };
    this.applyFloorFinish();
    if (this.homeArchitecture) {
      this.homeArchitecture.updateArchitecture(this.labDecor, this.traits.palette.liquidMid);
      if (decor.houseSize > prevSize || decor.houseFloors > prevFloors || decor.extraRooms.length > prevRoomsLen) {
        this.spawnColoredBurst(
          new THREE.Vector3(0, decor.houseFloors > prevFloors ? getUpperFloorY(decor.houseFloors) : 1.15, 0),
          24,
          ["#ffffff", "#38bdf8", "#10b981", "#fbbf24"]
        );
      }
    }
    if (this.activeFloor > this.labDecor.houseFloors) {
      this.setActiveFloor(this.labDecor.houseFloors);
    } else if (this.activeFloor === 0 && !this.labDecor.hasBasement) {
      this.setActiveFloor(1);
    }
    this.townGardens?.syncGardenState(this.gardenState, this.labDecor.houseSize);
    this.syncCustomLayoutPositions();
    if (this.walkMode) {
      this.applyWalkModeScaleLayout();
    }

    if (this.simsFurniture) {
      this.simsFurniture.updateFurnishings(this.labDecor, this.traits.palette.liquidMid);
      // Celebrate any upgraded station with a radiant silver-and-accent particle burst!
      const stations = ["research", "mining", "pet", "builder", "lounge"] as const;
      for (const st of stations) {
        if (decor.stationUpgrades[st] > prevUpgrades[st]) {
          const pos = this.simsFurniture.getStationUpgradeWorldPos(st);
          this.spawnColoredBurst(pos, 18, [
            "#ffffff",
            this.traits.palette.electron,
            this.traits.palette.liquidMid,
            "#fbbf24"
          ]);
        }
      }
    }
  }

  public setGardenState(state: GardenWorldState) {
    this.gardenState = state;
    this.townGardens?.syncGardenState(state, this.labDecor.houseSize, Date.now());
  }

  public waterGardenPlotFX(plotId: string) {
    this.townGardens?.spawnWaterSplash(plotId);
  }

  public walkToPark(parkId: string) {
    const park = TOWN_PARKS.find((p) => p.id === parkId) || TOWN_PARKS[0];
    if (!park) return;
    if (this.activeFloor !== 1) this.setActiveFloor(1);
    this.performSimsAction({
      x: park.visitX,
      z: park.visitZ,
      floor: 1,
      yaw: Math.atan2(park.x - park.visitX, park.z - park.visitZ),
      emote: "hop",
      bubble: "flower",
      burstColor: park.accent
    });
  }

  public setPlumbobColor(hex: string, moodName?: string) {
    this.plumbobHex = hex;
    this.characterAvatar?.setPlumbobColor(hex);
    if (this.characterAvatar && this.characterProfile && moodName) {
      this.characterAvatar.setStatusTag(this.characterProfile.name, moodName, hex);
    }
  }

  public syncNeighborNpcStatus(
    tokenId: number,
    moodName: string,
    plumbobHex: string,
    tierLabel?: string,
    emote?: CharacterEmote,
    bubble?: MoodBubbleKind
  ) {
    this.neighborhoodWorld?.updateNpcStatusVisual(tokenId, moodName, plumbobHex, tierLabel);
    if (emote) {
      this.neighborhoodWorld?.triggerNpcWave(tokenId, emote, bubble || "heart");
    }
    if (this.visitingHostAvatar && this.visitingHostTokenId === tokenId) {
      this.visitingHostAvatar.setPlumbobColor(plumbobHex);
      const hostTarget = this.visitingHostAvatar.root.userData.simsTarget as
        | { hostName?: string }
        | undefined;
      const sub = tierLabel && tierLabel !== "Stranger" ? `${moodName} · ${tierLabel}` : moodName;
      this.visitingHostAvatar.setStatusTag(hostTarget?.hostName || "Host", sub, plumbobHex);
    }
  }

  public getSimsFurnitureAnchor(
    kind: "bench" | "espresso" | "microscope" | "harvester" | "hobby"
  ): { x: number; z: number; yaw: number; floor: FloorNumber } {
    if (!this.simsFurniture) return { x: 0, z: 1.38, yaw: 0, floor: 1 };
    return this.simsFurniture.getDynamicAnchor(kind);
  }

  public performSimsAction(req: SimsActionRequest) {
    if (!this.walkMode || this.creatorCameraMode) return;
    const minF: FloorNumber = this.labDecor.hasBasement ? 0 : 1;
    if (
      req.floor !== undefined &&
      req.floor !== this.activeFloor &&
      req.floor >= minF &&
      req.floor <= this.labDecor.houseFloors
    ) {
      this.setActiveFloor(req.floor);
    }
    this.characterAvatar?.setPosture("stand");
    const dist = Math.hypot(req.x - this.charX, req.z - this.charZ);
    if (dist <= 0.22) {
      this.executeArrivalSimsAction(req);
      return;
    }
    const clamped = this.resolveWalkObstacles(req.x, req.z);
    this.walkTarget = { x: clamped.x, z: clamped.z, arriveStation: null, arriveAction: req };
    if (this.walkWaypointMesh) {
      const gy = this.getWalkGroundY(clamped.x, clamped.z);
      this.walkWaypointMesh.position.set(clamped.x, gy + 0.015, clamped.z);
      this.walkWaypointMesh.visible = true;
      this.walkWaypointMesh.scale.setScalar(0.45);
      this.walkWaypointLife = 1.0;
    }
  }

  private executeArrivalSimsAction(req: SimsActionRequest) {
    if (typeof req.yaw === "number") this.charYaw = req.yaw;
    if (req.posture) this.characterAvatar?.setPosture(req.posture);
    if (req.emote) this.characterAvatar?.triggerEmote(req.emote);
    if (req.bubble) {
      this.spawnMoodBubble(new THREE.Vector3(this.charX, this.charY + 0.95, this.charZ), req.bubble);
    }
    if (req.burstColor) {
      this.spawnColoredBurst(
        new THREE.Vector3(this.charX, this.charY + 0.72, this.charZ),
        12,
        [req.burstColor, "#ffffff", this.traits.palette.electron]
      );
    }
    req.onArrive?.();
  }

  public fireSocialBeamToNeighbor(tokenId: number, colorHex = "#38bdf8") {
    if (!this.neighborhoodWorld) return;
    const pl = this.neighborhoodWorld.getPlacements().find((p) => p.lab.tokenId === tokenId);
    if (!pl) return;
    this.neighborhoodWorld.fireSocialBeam(this.charX, this.charZ, pl.x, pl.z, colorHex);
    this.neighborhoodWorld.triggerNpcWave(tokenId);
    this.characterAvatar?.triggerEmote("wave");
    this.spawnMoodBubble(new THREE.Vector3(this.charX, this.charY + 0.96, this.charZ), "sparkle");
    soundEngine.playBuildRoom();
  }

  public triggerVehicleHonk(vehicleId: string) {
    this.neighborhoodWorld?.triggerVehicleHonk(vehicleId);
  }

  public walkToNeighbor(tokenId: number) {
    if (!this.neighborhoodWorld) return;
    const pl = this.neighborhoodWorld.getPlacements().find((p) => p.lab.tokenId === tokenId);
    if (!pl) return;
    this.performSimsAction({
      x: pl.visitX,
      z: pl.visitZ,
      yaw: Math.atan2(pl.x - pl.visitX, pl.z - pl.visitZ),
      emote: "wave",
      bubble: "wave",
      onArrive: () => this.neighborhoodWorld?.triggerNpcWave(tokenId)
    });
  }

  public returnHome() {
    if (this.activeFloor !== 1) {
      this.setActiveFloor(1);
    }
    this.performSimsAction({
      x: 0,
      z: 1.4,
      floor: 1,
      yaw: 0.24,
      posture: "stand",
      emote: "hop"
    });
    if (this.cameraMode === "neighborhood") {
      this.setCameraMode("follow");
    }
  }

  private applyFloorFinish() {
    if (!this.pavilionFloorMat) return;
    const style = this.labDecor.floorStyle;
    const def = FLOOR_STYLES.find((f) => f.id === style) || FLOOR_STYLES[0];
    let tex: THREE.Texture = this.terrazzoTex;
    if (style !== "terrazzo") {
      if (!this.floorTextures[style]) {
        this.floorTextures[style] = createFloorFinishTexture(style);
      }
      tex = this.floorTextures[style]!;
    }
    this.pavilionFloorMat.map = tex;
    this.pavilionFloorMat.color.set(def.tint);
    this.pavilionFloorMat.needsUpdate = true;
  }

  public setWalkMode(enabled: boolean) {
    if (this.walkMode === enabled) return;
    this.walkMode = enabled;
    if (this.keyLight) {
      const d = enabled ? 5.8 : 4.8;
      this.keyLight.shadow.camera.left = -d;
      this.keyLight.shadow.camera.right = d;
      this.keyLight.shadow.camera.top = d;
      this.keyLight.shadow.camera.bottom = -d;
      this.keyLight.shadow.camera.updateProjectionMatrix();
    }
    if (enabled) {
      this.controls.autoRotate = false;
      this.controls.minDistance = 1.65;
      this.controls.maxDistance = 135.0;
      this.controls.maxPolarAngle = Math.PI * 0.486;
      this.buildWalkCampus3D();
      this.rebuild3DModel();
      this.applyWalkModeScaleLayout();
      this.charY = this.getWalkGroundY(this.charX, this.charZ);
      if (this.characterAvatar) {
        this.characterAvatar.root.position.set(this.charX, this.charY, this.charZ);
      }
      this.applyLightingMood();
      this.followCameraInitialized = false;
      if (!this.creatorCameraMode) {
        this.frameWalkCamera();
      }
    } else {
      this.controls.minDistance = 4.0;
      this.controls.maxDistance = 12.2;
      this.controls.autoRotate = this.autoRotateDesired;
      this.disposeWalkCampus3D();
      this.disposeCharacterAvatar();
      this.applyWalkModeScaleLayout();
      this.applyLightingMood();
      this.walkTarget = null;
      this.lastNearStation = null;
      this.charVx = 0;
      this.charVz = 0;
    }
  }

  public updateMonitorTelemetry(data: DiegeticMonitorTelemetry) {
    this.diegeticMonitors?.updateTelemetry(data, performance.now());
  }

  public setCreatorFocusZone(zone: CreatorFocusZone) {
    this.creatorFocusZone = zone;
    if (this.creatorCameraMode) {
      this.applyCreatorFocusCamera();
    }
  }

  public setCreatorTurntable(enabled: boolean) {
    this.creatorTurntable = enabled;
  }

  public flipCreatorView(back: boolean) {
    this.creatorTurntable = false;
    this.creatorTargetYaw = back ? Math.PI + 0.22 : 0.24;
    if (this.creatorCameraMode) {
      this.applyCreatorFocusCamera();
    }
  }

  private applyCreatorFocusCamera() {
    const isNarrow = (this.container.clientWidth || 800) < 760;
    const headY = this.charY + (this.characterAvatar?.getHeadHeight() ?? 0.84);
    const torsoY = this.charY + (this.characterAvatar?.getTorsoHeight() ?? 0.54);

    if (this.creatorFocusZone === "face" || this.creatorFocusZone === "hair") {
      // Intimate head & shoulders studio close-up cleanly offset left of the creator panel
      this.creatorTargetYaw = 0.2;
      this.desiredCamTarget = new THREE.Vector3(isNarrow ? 0 : 0.34, headY - 0.02, this.charZ);
      this.desiredCamPos = new THREE.Vector3(
        isNarrow ? 0.46 : 0.92,
        headY + 0.14,
        this.charZ + (isNarrow ? 1.72 : 1.56)
      );
    } else if (this.creatorFocusZone === "back") {
      // Smooth 3/4 rear showcase so the user sees backpacks & floating holo-drones directly!
      this.creatorTargetYaw = Math.PI - 0.36;
      this.desiredCamTarget = new THREE.Vector3(isNarrow ? 0 : 0.42, torsoY + 0.08, this.charZ);
      this.desiredCamPos = new THREE.Vector3(
        isNarrow ? 0.68 : 1.32,
        torsoY + 0.48,
        this.charZ + (isNarrow ? 2.25 : 2.08)
      );
    } else {
      // Full-body architectural studio framing
      this.desiredCamTarget = new THREE.Vector3(isNarrow ? 0 : 0.46, torsoY + 0.04, this.charZ);
      this.desiredCamPos = new THREE.Vector3(
        isNarrow ? 0.82 : 1.48,
        torsoY + 0.5,
        this.charZ + (isNarrow ? 2.6 : 2.38)
      );
    }
  }

  public setCharacterProfile(profile: CharacterProfile | null, emote?: CharacterEmote) {
    this.characterProfile = profile;
    if (!profile) {
      this.disposeCharacterAvatar();
      return;
    }
    if (!this.characterAvatar) {
      this.characterAvatar = new ResearcherAvatar3D(profile, { enablePlumbob: true });
      this.characterAvatar.setPlumbobColor(this.plumbobHex);
      this.charY = this.getWalkGroundY(this.charX, this.charZ);
      this.characterAvatar.root.position.set(this.charX, this.charY, this.charZ);
      this.characterAvatar.root.rotation.y = this.charYaw;
      this.rootGroup.add(this.characterAvatar.root);
    } else {
      this.characterAvatar.rebuild(profile);
      this.characterAvatar.setPlumbobColor(this.plumbobHex);
      if (this.creatorCameraMode) {
        this.applyCreatorFocusCamera();
      }
    }
    if (emote) {
      this.characterAvatar.triggerEmote(emote);
      this.spawnColoredBurst(
        new THREE.Vector3(this.charX, this.charY + 0.72, this.charZ),
        10,
        [profile.outfitAccent, this.traits.palette.electron, "#ffffff"]
      );
    }
  }

  public triggerCharacterEmote(emote: CharacterEmote) {
    this.characterAvatar?.triggerEmote(emote);
  }

  /**
   * Spawns or clears the hospitable 3D Host Researcher NPC inside a visited user's home!
   */
  public setVisitingHost(
    host: {
      profile: CharacterProfile;
      tokenId: number;
      moodName?: string;
      plumbobHex?: string;
      tierLabel?: string;
    } | null
  ) {
    if (!host) {
      this.disposeVisitingHostAvatar();
      return;
    }
    const hostColor = host.plumbobHex || "#38bdf8";
    const hostSub =
      host.tierLabel && host.tierLabel !== "Stranger"
        ? `${host.moodName || "Social"} · ${host.tierLabel}`
        : host.moodName || "Welcoming";

    if (this.visitingHostAvatar && this.visitingHostTokenId === host.tokenId) {
      this.visitingHostAvatar.setPlumbobColor(hostColor);
      this.visitingHostAvatar.setStatusTag(host.profile.name, hostSub, hostColor);
      return;
    }
    this.disposeVisitingHostAvatar();
    this.visitingHostTokenId = host.tokenId;
    const avatar = new ResearcherAvatar3D(host.profile, {
      enablePlumbob: true,
      plumbobScale: 0.82,
      initialPlumbobHex: hostColor
    });
    avatar.setStatusTag(host.profile.name, hostSub, hostColor);
    const hy = this.getWalkGroundY(this.visitingHostX, this.visitingHostZ);
    avatar.root.position.set(this.visitingHostX, hy, this.visitingHostZ);
    avatar.root.rotation.y = this.visitingHostYaw;

    const hostTarget: SimsObjectTarget = {
      kind: "visiting-host",
      label: `${host.profile.name} (Host)`,
      tokenId: host.tokenId,
      hostName: host.profile.name,
      worldX: this.visitingHostX,
      worldZ: this.visitingHostZ + 0.55
    };
    avatar.root.traverse((obj) => {
      obj.userData.simsTarget = hostTarget;
    });

    avatar.triggerEmote("wave");
    this.rootGroup.add(avatar.root);
    this.visitingHostAvatar = avatar;
    this.visitingHostWaveCooldown = 5.0;
    this.spawnMoodBubble(
      new THREE.Vector3(this.visitingHostX, hy + 1.38, this.visitingHostZ),
      "wave"
    );
  }

  public triggerHostReaction(emote: CharacterEmote, bubble?: MoodBubbleKind) {
    if (!this.visitingHostAvatar) return;
    this.visitingHostAvatar.triggerEmote(emote);
    const hy = this.getWalkGroundY(this.visitingHostX, this.visitingHostZ);
    if (bubble) {
      this.spawnMoodBubble(
        new THREE.Vector3(this.visitingHostX, hy + 1.38, this.visitingHostZ),
        bubble
      );
    }
    this.spawnColoredBurst(new THREE.Vector3(this.visitingHostX, hy + 0.85, this.visitingHostZ), 12, [
      "#38bdf8",
      "#f472b6",
      "#ffffff"
    ]);
  }

  /**
   * Smoothly places the player at the welcoming front entrance steps when entering
   * another user's home or returning to their own lab!
   */
  public arriveAtFrontDoor() {
    this.walkTarget = null;
    this.charVx = 0;
    this.charVz = 0;
    this.characterAvatar?.setPosture("stand");
    this.charX = 0.24;
    this.charZ = 2.02;
    this.charY = this.getWalkGroundY(this.charX, this.charZ);
    this.charYaw = Math.PI - 0.14;
    if (this.characterAvatar) {
      this.characterAvatar.root.position.set(this.charX, this.charY, this.charZ);
      this.characterAvatar.root.rotation.y = this.charYaw;
      this.characterAvatar.triggerEmote("wave");
    }
    this.cameraMode = "follow";
    this.followCameraInitialized = false;
    this.frameWalkCamera();
    this.spawnColoredBurst(
      new THREE.Vector3(this.charX, this.charY + 0.72, this.charZ),
      18,
      [this.characterProfile?.outfitAccent || "#5b8def", "#10b981", "#ffffff"]
    );
    this.triggerCatalyticPulse(0.85);
  }

  private disposeVisitingHostAvatar() {
    if (this.visitingHostAvatar) {
      this.rootGroup.remove(this.visitingHostAvatar.root);
      this.visitingHostAvatar.disposeRig();
      this.visitingHostAvatar = null;
      this.visitingHostTokenId = 0;
    }
  }

  public setCreatorCameraMode(active: boolean) {
    if (this.creatorCameraMode === active) return;
    this.creatorCameraMode = active;
    if (active) {
      this.walkTarget = null;
      this.charVx = 0;
      this.charVz = 0;
      this.controls.autoRotate = false;
      this.charX = 0;
      this.charZ = 1.36;
      this.charY = this.getWalkGroundY(this.charX, this.charZ);
      this.charYaw = 0.24;
      this.creatorTargetYaw = 0.24;
      if (this.characterAvatar) {
        this.characterAvatar.root.position.set(this.charX, this.charY, this.charZ);
        this.characterAvatar.root.rotation.y = this.charYaw;
        this.characterAvatar.triggerEmote("wave");
      }
      this.applyCreatorFocusCamera();
    } else if (this.walkMode) {
      this.creatorTurntable = false;
      this.characterAvatar?.triggerEmote("hop");
      this.spawnColoredBurst(
        new THREE.Vector3(this.charX, this.charY + 0.65, this.charZ),
        16,
        [this.characterProfile?.outfitAccent || "#5b8def", "#38bdf8", "#ffffff"]
      );
      this.followCameraInitialized = false;
      this.frameWalkCamera();
    }
  }

  private getNeighborhoodAerialFraming(): { pos: THREE.Vector3; target: THREE.Vector3 } {
    const neighborCount =
      this.neighborhoodWorld?.getPlacements().length ?? this.pendingNeighbors.length;
    const count = neighborCount + 1;
    const expansionBands = getExpansionBandCount(neighborCount + 4);
    if (expansionBands >= 2) {
      const pull = Math.min(36, (expansionBands - 2) * 10);
      return {
        pos: new THREE.Vector3(48.0 + pull, 40.0 + pull * 0.72, 58.0 + pull),
        target: new THREE.Vector3(0, 1.5, 1.2)
      };
    }
    if (count >= 25 || expansionBands >= 1) {
      return {
        pos: new THREE.Vector3(36.0, 30.0, 44.5),
        target: new THREE.Vector3(0, 1.2, 1.5)
      };
    }
    if (count >= 10) {
      return {
        pos: new THREE.Vector3(21.5, 18.2, 27.2),
        target: new THREE.Vector3(0, 1.0, 1.8)
      };
    }
    return {
      pos: new THREE.Vector3(14.0, 12.2, 18.5),
      target: new THREE.Vector3(0, 1.0, 2.0)
    };
  }

  public setCameraMode(mode: CameraMode) {
    this.cameraMode = mode;
    if (!this.walkMode || this.creatorCameraMode) return;
    if (mode === "neighborhood") {
      // Sweeping Sims-town aerial masterplan vista that pulls back dynamically as the town grows!
      const framing = this.getNeighborhoodAerialFraming();
      this.desiredCamPos = framing.pos;
      this.desiredCamTarget = framing.target;
    } else if (mode === "orbit") {
      this.desiredCamPos = new THREE.Vector3(5.5, 4.4, 6.3);
      this.desiredCamTarget = new THREE.Vector3(0, 1.35, 0);
    } else {
      this.followCameraInitialized = false;
      this.frameWalkCamera();
    }
  }

  private frameWalkCamera() {
    if (this.cameraMode === "neighborhood") {
      const framing = this.getNeighborhoodAerialFraming();
      this.desiredCamPos = framing.pos;
      this.desiredCamTarget = framing.target;
      return;
    }
    if (this.cameraMode === "orbit" || !this.characterAvatar) {
      this.desiredCamPos = new THREE.Vector3(5.5, 4.4, 6.3);
      this.desiredCamTarget = new THREE.Vector3(0, 1.35, 0);
      return;
    }
    this.desiredCamTarget = new THREE.Vector3(this.charX, this.charY + 0.68, this.charZ);
    this.desiredCamPos = new THREE.Vector3(
      this.charX + 2.95,
      this.charY + 3.05,
      this.charZ + 4.05
    );
  }

  public setMoveInput(dx: number, dz: number, sprint = false) {
    this.moveInput.dx = dx;
    this.moveInput.dz = dz;
    this.moveInput.sprint = sprint;
    if (Math.hypot(dx, dz) > 0.05) {
      this.walkTarget = null;
      this.characterAvatar?.setPosture("stand");
    }
  }

  public walkToPoint(x: number, z: number, arriveStation: LabStationId | null = null) {
    if (!this.walkMode || this.creatorCameraMode) return;
    this.characterAvatar?.setPosture("stand");
    const clamped = this.resolveWalkObstacles(x, z);
    this.walkTarget = { x: clamped.x, z: clamped.z, arriveStation };
    if (this.walkWaypointMesh) {
      const gy = this.getWalkGroundY(clamped.x, clamped.z);
      this.walkWaypointMesh.position.set(clamped.x, gy + 0.015, clamped.z);
      this.walkWaypointMesh.visible = true;
      this.walkWaypointMesh.scale.setScalar(0.45);
      this.walkWaypointLife = 1.0;
    }
  }

  public walkToStation(stationId: LabStationId) {
    const st = LAB_STATION_BY_ID[stationId];
    if (!st) return;
    const p = resolveItemPlacement(stationId, this.labDecor.customLayout);
    const minF: FloorNumber = this.labDecor.hasBasement ? 0 : 1;
    if (p.floor !== this.activeFloor && p.floor >= minF && p.floor <= this.labDecor.houseFloors) {
      this.setActiveFloor(p.floor);
    }
    this.walkToPoint(p.x, p.z, stationId);
  }

  public setActiveStationHighlight(stationId: LabStationId | null) {
    this.activeStationHighlight = stationId;
  }

  private getWalkGroundY(x: number, z: number): number {
    const st = evaluateStairWalk(
      x,
      z,
      this.activeFloor,
      this.labDecor.houseFloors,
      this.labDecor.hasBasement
    );
    if (st.onStairs) return st.y;
    return getGroundElevationForFloor(this.activeFloor, x, z, this.labDecor.houseSize);
  }

  private resolveWalkObstacles(x: number, z: number): { x: number; z: number } {
    // B1 Underground Architect Basement: open navigable concrete floor + East stairs leading up to 1F!
    if (this.activeFloor === 0) {
      const nx = Math.max(-3.16, Math.min(3.16, x));
      const nz = Math.max(-3.16, Math.min(3.16, z));
      return { x: nx, z: nz };
    }

    // 2F L-shaped Architect Mezzanine Loft (North Gallery + West Wing + optional 2F->3F switchback stairs!)
    if (this.activeFloor === 2) {
      let nx = Math.max(-3.3, Math.min(3.3, x));
      let nz = Math.max(-3.3, Math.min(1.42, z));
      const onSwitchback =
        this.labDecor.houseFloors >= 3 &&
        nx >= -2.18 &&
        nx <= -1.22 &&
        nz >= -2.85 &&
        nz <= -0.25;
      if (!onSwitchback && nx > -1.78 && nz > -1.82) {
        const distBack = Math.abs(nz - -1.82);
        const distWest = Math.abs(nx - -1.78);
        if (distBack <= distWest) nz = -1.82;
        else nx = -1.78;
      }
      return { x: nx, z: nz };
    }

    // 3F Starlight Sky Penthouse C-shaped rooftop deck
    if (this.activeFloor === 3) {
      let nx = Math.max(-3.3, Math.min(3.3, x));
      let nz = Math.max(-3.3, Math.min(1.42, z));
      const onSwitchback = nx >= -2.18 && nx <= -1.22 && nz >= -2.85 && nz <= -0.25;
      if (!onSwitchback && Math.abs(nx) < 1.68 && nz > -1.72) {
        const distBack = Math.abs(nz - -1.72);
        const distSide = 1.68 - Math.abs(nx);
        if (distBack <= distSide) nz = -1.72;
        else nx = nx < 0 ? -1.68 : 1.68;
      }
      return { x: nx, z: nz };
    }

    // 1F Main Architect Living & Lab Atrium + Dynamically Expanding Alchemia Town Neighborhood!
    const limit = this.neighborhoodWorld ? this.neighborhoodWorld.getWalkLimit() : 4.2;
    let nx = Math.max(-limit, Math.min(limit, x));
    let nz = Math.max(-limit, Math.min(limit, z));

    // Smooth rectangular keep-out around the Center Architect NFT Display Island (centered at (0, -0.35), 1.84m × 1.32m)
    const tblHalfX = 1.06;
    const tblMinZ = -1.16;
    const tblMaxZ = 0.46;
    if (nx > -tblHalfX && nx < tblHalfX && nz > tblMinZ && nz < tblMaxZ) {
      const dLeft = nx - -tblHalfX;
      const dRight = tblHalfX - nx;
      const dNorth = nz - tblMinZ;
      const dSouth = tblMaxZ - nz;
      const minD = Math.min(dLeft, dRight, dNorth, dSouth);
      if (minD === dSouth) nz = tblMaxZ;
      else if (minD === dNorth) nz = tblMinZ;
      else if (minD === dLeft) nx = -tblHalfX;
      else nx = tblHalfX;
    }

    // Protect stair side glass balustrades so characters enter steps cleanly from the open landing (z = -0.15)
    // rather than clipping sideways through a glass stairwell railing!
    if (this.labDecor.hasBasement && nz > -2.92 && nz < -0.35) {
      if (this.charX < 2.15 && nx >= 2.12 && nx < 2.55) {
        nx = 2.12;
      }
    }
    if (this.labDecor.houseFloors >= 2 && nz > -2.92 && nz < -0.35) {
      if (this.charX > -2.15 && nx <= -2.12 && nx > -2.55) {
        nx = -2.12;
      }
    }

    const obstacles: Array<[number, number, number]> = [];
    if (this.neighborhoodWorld) {
      obstacles.push(...this.neighborhoodWorld.getNeighborObstacles());
    }
    if (this.townGardens) {
      obstacles.push(...this.townGardens.getObstacles());
    }

    for (const [ox, oz, rad] of obstacles) {
      const dx = nx - ox;
      const dz = nz - oz;
      const d = Math.hypot(dx, dz);
      if (d < rad) {
        const pushAng = d > 0.001 ? Math.atan2(dz, dx) : 0;
        nx = ox + Math.cos(pushAng) * rad;
        nz = oz + Math.sin(pushAng) * rad;
      }
    }

    return {
      x: Math.max(-limit, Math.min(limit, nx)),
      z: Math.max(-limit, Math.min(limit, nz))
    };
  }

  private buildWalkCampus3D() {
    this.disposeWalkCampus3D();

    // Expandable Multi-Story Architect House (B1 Basement, 1F Living Atrium + Center Display Table,
    // 2F Mezzanine Loft, 3F Sky Penthouse, Real Walkable Floating Stairs & 6 Cozy Rooms!)
    this.homeArchitecture = new HomeArchitecture3D(this.terrazzoTex, this.titaniumTex);
    this.homeArchitecture.updateArchitecture(this.labDecor, this.traits.palette.liquidMid);
    this.walkCampusGroup.add(this.homeArchitecture.group);

    // Grand Botanical Parks, Glass Conservatory, Koi Pond & 10 Live Growing Interactive Garden Planter Beds!
    this.townGardens = new TownGardens3D(this.terrazzoTex, this.titaniumTex);
    this.townGardens.syncGardenState(this.gardenState, this.labDecor.houseSize, Date.now());
    this.walkCampusGroup.add(this.townGardens.group);

    // Live 3D Move-Mode Placement Cursor Ring (glowing cyan/silver blueprint reticle)
    const ghostGrp = new THREE.Group();
    const gOuter = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.022, 10, 42),
      new THREE.MeshStandardMaterial({
        color: "#38bdf8",
        emissive: "#0ea5e9",
        emissiveIntensity: 1.25,
        transparent: true,
        opacity: 0.92
      })
    );
    gOuter.rotation.x = Math.PI / 2;
    ghostGrp.add(gOuter);
    const gDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.38, 32),
      new THREE.MeshBasicMaterial({
        color: "#38bdf8",
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    gDisc.rotation.x = -Math.PI / 2;
    ghostGrp.add(gDisc);
    const gPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.028, 0.85, 10),
      new THREE.MeshBasicMaterial({
        color: "#bae6fd",
        transparent: true,
        opacity: 0.55,
        depthWrite: false
      })
    );
    gPillar.position.y = 0.42;
    ghostGrp.add(gPillar);
    ghostGrp.visible = false;
    this.moveGhostRing = ghostGrp;
    this.walkCampusGroup.add(ghostGrp);

    // Invisible smooth floor plane covering the entire expanding neighborhood & outer expansion districts!
    const floorHit = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 260),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    floorHit.rotation.x = -Math.PI / 2;
    floorHit.position.y = 0.06;
    this.walkFloorPlane = floorHit;
    this.walkCampusGroup.add(floorHit);

    // 5 Delicate Architectural Floor Beacons marking each interactive Lab Station
    for (const st of LAB_STATIONS) {
      const baseY = this.getWalkGroundY(st.padX, st.padZ) + 0.008;

      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.32, 32),
        new THREE.MeshBasicMaterial({
          color: st.accent,
          transparent: true,
          opacity: 0.14,
          depthWrite: false
        })
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(st.padX, baseY, st.padZ);
      this.walkCampusGroup.add(disc);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.34, 0.014, 8, 40),
        new THREE.MeshStandardMaterial({
          color: st.accent,
          emissive: st.accent,
          emissiveIntensity: 0.85,
          transparent: true,
          opacity: 0.85,
          roughness: 0.2
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(st.padX, baseY + 0.008, st.padZ);
      this.walkCampusGroup.add(ring);

      // Hair-thin luminous vertical hologram filament rising toward the floating panel
      const pillarH = Math.max(0.4, st.panelPos[1] - baseY - 0.3);
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.012, pillarH, 8),
        new THREE.MeshBasicMaterial({
          color: st.accent,
          transparent: true,
          opacity: 0.24,
          depthWrite: false
        })
      );
      pillar.position.set(st.padX, baseY + pillarH * 0.5, st.padZ);
      this.walkCampusGroup.add(pillar);

      this.stationBeacons.set(st.id, { ring, disc, pillar, baseY });
    }

    // Expanding architectural floor click-to-walk waypoint ring
    const wp = new THREE.Mesh(
      new THREE.RingGeometry(0.14, 0.2, 32),
      new THREE.MeshBasicMaterial({
        color: this.traits.palette.electron,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    wp.rotation.x = -Math.PI / 2;
    wp.visible = false;
    this.walkWaypointMesh = wp;
    this.walkCampusGroup.add(wp);

    // Subtle floor cursor preview ring showing exactly where click-to-walk lands
    const hoverRing = new THREE.Mesh(
      new THREE.RingGeometry(0.12, 0.155, 28),
      new THREE.MeshBasicMaterial({
        color: "#64748b",
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    hoverRing.rotation.x = -Math.PI / 2;
    hoverRing.visible = false;
    this.walkHoverRing = hoverRing;
    this.walkCampusGroup.add(hoverRing);

    // Subtle pearl breadcrumb path dots while auto-walking to a destination
    const crumbGeo = new THREE.SphereGeometry(0.026, 8, 8);
    const crumbMat = new THREE.MeshBasicMaterial({
      color: this.traits.palette.electron,
      transparent: true,
      opacity: 0.65
    });
    for (let i = 0; i < 6; i++) {
      const dot = new THREE.Mesh(crumbGeo, crumbMat);
      dot.visible = false;
      this.walkCampusGroup.add(dot);
      this.walkBreadcrumbs.push(dot);
    }

    // Zero-GC pooled porcelain footstep dust puffs
    const puffGeo = new THREE.SphereGeometry(0.042, 8, 8);
    for (let i = 0; i < 14; i++) {
      const pMat = new THREE.MeshBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const puff = new THREE.Mesh(puffGeo, pMat);
      puff.visible = false;
      this.walkCampusGroup.add(puff);
      this.footPuffs.push({ mesh: puff, life: 0, vx: 0, vy: 0, vz: 0 });
    }

    // 5 Diegetic Physical Frosted-Glass Floating 3D Holographic Monitors inside WebGL!
    this.diegeticMonitors = new DiegeticLabMonitors3D();
    this.walkCampusGroup.add(this.diegeticMonitors.group);
    this.syncCustomLayoutPositions();

    // Interactive Sims-Style Lab Furniture, Home Furnishings & Progressive Station Upgrades
    this.simsFurniture = new SimsFurniture3D(
      this.terrazzoTex,
      this.titaniumTex,
      this.traits.palette.liquidMid,
      this.labDecor
    );
    this.walkCampusGroup.add(this.simsFurniture.group);

    // Living Minted NFT Neighborhood World (Sky Dome, Trees, Canal, Bridges, Vehicles, Fountain, Labs & NPCs!)
    this.neighborhoodWorld = new NeighborhoodWorld3D(
      this.terrazzoTex,
      this.titaniumTex,
      this.perfProfile
    );
    this.neighborhoodWorld.setSkyMood(this.lightingMood);
    this.neighborhoodWorld.setGlobalImpactScale(this.impact.globalImpactEth);
    if (this.pendingNeighbors.length > 0) {
      this.neighborhoodWorld.syncNeighbors(this.pendingNeighbors);
    }
    this.walkCampusGroup.add(this.neighborhoodWorld.group);
    this.applyFloorFinish();
  }

  private disposeWalkCampus3D() {
    if (this.homeArchitecture) {
      this.walkCampusGroup.remove(this.homeArchitecture.group);
      this.homeArchitecture.dispose();
      this.homeArchitecture = null;
    }
    if (this.townGardens) {
      this.walkCampusGroup.remove(this.townGardens.group);
      this.townGardens.dispose();
      this.townGardens = null;
    }
    if (this.diegeticMonitors) {
      this.walkCampusGroup.remove(this.diegeticMonitors.group);
      this.diegeticMonitors.dispose();
      this.diegeticMonitors = null;
    }
    if (this.simsFurniture) {
      this.walkCampusGroup.remove(this.simsFurniture.group);
      this.simsFurniture.dispose();
      this.simsFurniture = null;
    }
    if (this.neighborhoodWorld) {
      this.walkCampusGroup.remove(this.neighborhoodWorld.group);
      this.neighborhoodWorld.dispose();
      this.neighborhoodWorld = null;
    }
    this.disposeObjectChildren(this.walkCampusGroup);
    this.stationBeacons.clear();
    this.walkFloorPlane = null;
    this.moveGhostRing = null;
    this.walkWaypointMesh = null;
    this.walkHoverRing = null;
    this.walkBreadcrumbs = [];
    this.footPuffs = [];
    this.walkWaypointLife = 0;
  }

  private disposeCharacterAvatar() {
    if (this.characterAvatar) {
      this.rootGroup.remove(this.characterAvatar.root);
      this.characterAvatar.disposeRig();
      this.characterAvatar = null;
    }
    this.disposeVisitingHostAvatar();
  }

  public selectBenchmark(benchmarkIndex: number) {
    this.compute.selectBenchmark(benchmarkIndex);
    this.proteinInitialized = false;
    this.cachedSSEnergyKey = "";
    this.onComputeTick?.(this.compute.getSnapshot());
    this.triggerCatalyticPulse(0.7);
  }

  public triggerFoldAction(action: "wiggle" | "shake" | "bury") {
    this.compute.triggerFoldAction(action);
    this.proteinMorphBoost = 1.5;
    this.cachedSSEnergyKey = "";
    this.discoveryFlash = 1.0;
    this.excitement = Math.min(1.5, this.excitement + (action === "shake" ? 0.75 : 0.48));
    this.spawnBurst(new THREE.Vector3(0, 3.06, 0), action === "shake" ? 14 : 10);
    if (action === "shake") soundEngine.playProtonPop(2);
    else if (action === "bury") soundEngine.playProtonPop(4);
    else soundEngine.playTap(1318.51);
  }

  public focusSector(sectorId: number) {
    const views: Array<[THREE.Vector3, THREE.Vector3]> = [
      [new THREE.Vector3(-4.2, 3.2, -3.5), new THREE.Vector3(-1.8, 0.9, -1.1)],
      [new THREE.Vector3(4.9, 3.2, 2.8), new THREE.Vector3(1.8, 0.9, 0.2)],
      [new THREE.Vector3(-4.4, 3.0, 4.1), new THREE.Vector3(-1.7, 0.7, 1.2)],
      [new THREE.Vector3(4.2, 2.9, 4.3), new THREE.Vector3(1.5, 0.7, 1.3)],
      [new THREE.Vector3(4.8, 4.2, -3.6), new THREE.Vector3(1.7, 1.5, -1.2)],
      [new THREE.Vector3(3.6, 5.1, 4.1), new THREE.Vector3(0, 3.1, 0)]
    ];
    const pair = views[sectorId];
    if (pair) {
      this.desiredCamPos = pair[0].clone();
      this.desiredCamTarget = pair[1].clone();
    }
  }

  public setLightingMood(mood: LightingMood) {
    this.lightingMood = mood;
    this.applyLightingMood();
  }

  public setAtmosphereMode(mode: AtmosphereMode) {
    if (mode === this.atmosphereMode) return;
    this.atmosphereMode = mode;
    this.disposeObjectChildren(this.atmosphereGroup);
    this.atmosphereMotes = [];
    if (mode === "clear") return;

    const isSnow = mode === "snow";
    const geo = new THREE.SphereGeometry(isSnow ? 0.028 : 0.024, 8, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: isSnow ? "#ffffff" : "#fde68a",
      transparent: true,
      opacity: isSnow ? 0.85 : 0.78
    });
    for (let i = 0; i < 42; i++) {
      const m = new THREE.Mesh(geo, mat);
      const bx = (Math.random() - 0.5) * 6.8;
      const bz = (Math.random() - 0.5) * 6.8;
      const y = 0.4 + Math.random() * 4.4;
      m.position.set(bx, y, bz);
      if (!isSnow) m.add(this.makeGlowSprite("#fbbf24", 0.22, 0.55));
      this.atmosphereGroup.add(m);
      this.atmosphereMotes.push({
        mesh: m,
        baseX: bx,
        baseZ: bz,
        y,
        speed: isSnow ? 0.28 + Math.random() * 0.26 : 0.14 + Math.random() * 0.18,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  /**
   * Renders one crisp studio frame on demand and returns a shareable PNG data URL
   * (zero ongoing preserveDrawingBuffer overhead!).
   */
  public captureSnapshotDataUrl(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/png");
  }

  /**
   * Renders a crisp hero studio portrait of any lab configuration using this
   * single offscreen WebGL context (used to upgrade Gallery cards to true 3D renders).
   */
  public renderStaticPortrait(state: LiveImpactState): string {
    const prevSeed = this.impact.seed;
    const prevCause = this.impact.causeId;
    this.impact = { ...this.impact, ...state };
    if (!state.reactionStage) {
      this.impact.reactionStage = stageFromEth(this.impact.globalImpactEth);
    }

    if (state.seed !== prevSeed || state.causeId !== prevCause) {
      this.traits = deriveTraitsFromSeed(state.seed);
      this.compute.reseed(state.seed, this.impact.causeId, this.impact.tokenId, 72);
    }

    this.syncFillTarget();
    this.neighborhoodWorld?.setGlobalImpactScale(this.impact.globalImpactEth);
    this.displayFill = this.targetFill;
    this.buildPopScale = 1;
    this.dynamicGroup.scale.setScalar(1);
    this.excitement = 0.08;
    this.discoveryFlash = 0;
    this.shockwaveLife = 0;
    this.desiredCamPos = null;
    this.desiredCamTarget = null;
    this.showBestFold = true;
    this.proteinInitialized = false;
    this.cachedSSEnergyKey = "";
    this.lastRibbonUpdateMs = 0;

    const nextSectors = this.impact.sectorsMask ?? 0;
    const nextAccRank = this.getAccessoryRank();
    if (
      this.impact.seed !== this.builtSeed ||
      this.impact.complexityTier !== this.builtTier ||
      nextSectors !== this.builtSectorsMask ||
      nextAccRank !== this.builtAccessoryRank
    ) {
      this.rebuild3DModel();
    }

    // Frame the studio shot with clean museum margins so gyro rings, protein, pets & rooms never clip
    let builtCount = 0;
    for (let i = 0; i < 6; i++) {
      if ((nextSectors & (1 << i)) !== 0) builtCount++;
    }
    const zoomOut = builtCount >= 3 || (this.impact.complexityTier || 1) >= 4 ? 1.14 : 1.05;
    this.camera.fov = 31;
    this.camera.aspect = 1;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(5.15 * zoomOut, 4.08 * zoomOut, 5.95 * zoomOut);
    this.controls.target.set(0, 1.66, 0);
    this.controls.autoRotate = false;
    this.camera.lookAt(0, 1.66, 0);

    const prevActive = this.compute.isActive();
    this.compute.setActive(false);
    this.step(0.016, 1.65, 2400);
    this.compute.setActive(prevActive);
    this.renderer.render(this.scene, this.camera);

    const webp = this.renderer.domElement.toDataURL("image/webp", 0.92);
    if (webp.startsWith("data:image/webp")) return webp;
    return this.renderer.domElement.toDataURL("image/png");
  }

  private applyLightingMood() {
    const pal = this.traits.palette;
    const fogDensity = this.walkMode ? 0.004 : 0.032;
    this.neighborhoodWorld?.setSkyMood(this.lightingMood);

    if (this.lightingMood === "golden") {
      this.scene.background = new THREE.Color("#fbf1e4");
      this.scene.fog = new THREE.FogExp2("#f9ead8", fogDensity);
      this.renderer.toneMappingExposure = 1.04;
      if (this.hemiLight) this.hemiLight.intensity = 1.05;
      if (this.keyLight) {
        this.keyLight.color.set("#ffdbb5");
        this.keyLight.intensity = 2.05;
      }
      if (this.rimLight) {
        this.rimLight.color.set("#fbcfe8");
        this.rimLight.intensity = 1.05;
      }
      if (this.causticLight) this.causticLight.intensity = 2.15;
    } else if (this.lightingMood === "silver") {
      this.scene.background = new THREE.Color("#edf1f7");
      this.scene.fog = new THREE.FogExp2("#edf1f7", fogDensity * 1.1);
      this.renderer.toneMappingExposure = 1.03;
      if (this.hemiLight) this.hemiLight.intensity = 1.32;
      if (this.keyLight) {
        this.keyLight.color.set("#f4f7fc");
        this.keyLight.intensity = 1.55;
      }
      if (this.rimLight) {
        this.rimLight.color.set("#a5c8ff");
        this.rimLight.intensity = 1.05;
      }
      if (this.causticLight) this.causticLight.intensity = 1.95;
    } else if (this.lightingMood === "moonlit") {
      // Ethereal pearl-slate twilight — glowing dusk streetlamps & softly illuminated neighbor labs!
      this.scene.background = new THREE.Color("#cfd9ea");
      this.scene.fog = new THREE.FogExp2("#cbd6e8", fogDensity * 1.18);
      this.renderer.toneMappingExposure = 1.12;
      if (this.hemiLight) this.hemiLight.intensity = 0.88;
      if (this.keyLight) {
        this.keyLight.color.set("#dbeafe");
        this.keyLight.intensity = 1.15;
      }
      if (this.rimLight) {
        this.rimLight.color.set("#93c5fd");
        this.rimLight.intensity = 1.38;
      }
      if (this.causticLight) this.causticLight.intensity = 2.65;
    } else {
      this.scene.background = new THREE.Color(pal.bgBottom);
      this.scene.fog = new THREE.FogExp2(pal.bgBottom, fogDensity);
      this.renderer.toneMappingExposure = 0.98;
      if (this.hemiLight) this.hemiLight.intensity = 0.96;
      if (this.keyLight) {
        this.keyLight.color.set("#fffaf2");
        this.keyLight.intensity = 1.95;
      }
      if (this.rimLight) {
        this.rimLight.color.set("#b6d4ff");
        this.rimLight.intensity = 0.92;
      }
      if (this.causticLight) {
        const tier = Math.max(1, Math.min(5, this.impact.complexityTier || 1));
        this.causticLight.intensity = 1.85 + tier * 0.25;
      }
    }
  }

  /**
   * Sims Build Mode Ghost Preview: hovering any unbuilt room projects a frosted-glass
   * architectural blueprint wireframe onto the exact lot location!
   */
  public setPreviewSector(sectorId: number | null) {
    const sectorsMask = this.impact.sectorsMask ?? 0;
    const normalized =
      sectorId !== null && sectorId >= 0 && sectorId < 6 && !hasSector(sectorsMask, sectorId)
        ? sectorId
        : null;
    if (normalized === this.previewSectorId) return;
    this.previewSectorId = normalized;
    this.disposeObjectChildren(this.previewGhostGroup);
    if (normalized === null) return;

    const accents = ["#38bdf8", "#6366f1", "#10b981", "#f472b6", "#8b5cf6", "#f59e0b"];
    const accent = accents[normalized] || "#5b8def";

    const ghostFill = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      emissive: accent,
      emissiveIntensity: 0.32,
      roughness: 0.14,
      transparent: true,
      opacity: 0.34,
      depthWrite: false
    });
    const ghostWire = new THREE.LineBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.85
    });

    const g = new THREE.Group();
    const addGhostShape = (geo: THREE.BufferGeometry, x: number, y: number, z: number, scaleY = 1) => {
      const m = new THREE.Mesh(geo, ghostFill);
      m.position.set(x, y, z);
      m.scale.set(1, scaleY, 1);
      g.add(m);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), ghostWire);
      edges.position.copy(m.position);
      edges.scale.copy(m.scale);
      g.add(edges);
    };

    if (normalized === 0) {
      g.position.set(-2.35, 0.23, -1.45);
      addGhostShape(new THREE.BoxGeometry(1.18, 0.94, 1.08), 0, 0.47, 0);
      addGhostShape(new THREE.CylinderGeometry(0.12, 0.13, 1.25, 16), -0.24, 0.76, 0);
      addGhostShape(new THREE.CylinderGeometry(0.12, 0.13, 1.25, 16), 0.24, 0.76, 0);
    } else if (normalized === 1) {
      g.position.set(2.42, 0.23, 0.2);
      addGhostShape(new THREE.CylinderGeometry(0.76, 0.84, 0.16, 8), 0, 0.08, 0);
      addGhostShape(new THREE.CylinderGeometry(0.45, 0.45, 1.12, 6), 0, 0.72, 0);
    } else if (normalized === 2) {
      g.position.set(-2.22, 0.23, 1.62);
      addGhostShape(new THREE.CylinderGeometry(0.7, 0.78, 0.16, 20), 0, 0.08, 0);
      addGhostShape(new THREE.IcosahedronGeometry(0.66, 1), 0, 0.36, 0, 0.82);
    } else if (normalized === 3) {
      g.position.set(1.98, 0.23, 1.72);
      addGhostShape(new THREE.BoxGeometry(1.14, 0.14, 0.94), 0, 0.07, 0);
      addGhostShape(new THREE.BoxGeometry(1.18, 0.06, 0.9), 0, 1.0, -0.04);
    } else if (normalized === 4) {
      g.position.set(2.12, 0.23, -1.62);
      addGhostShape(new THREE.CylinderGeometry(0.55, 0.66, 0.18, 16), 0, 0.09, 0);
      addGhostShape(new THREE.CylinderGeometry(0.22, 0.3, 2.65, 16), 0, 1.48, 0);
    } else {
      g.position.set(0, 3.32, 0);
      addGhostShape(new THREE.IcosahedronGeometry(1.18, 1), 0, 0.25, 0, 0.56);
    }

    this.previewGhostGroup.add(g);
  }

  public getComputeSnapshot(): ComputeSnapshot {
    return this.compute.getSnapshot();
  }

  public setCameraPreset(preset: CameraPreset) {
    if (preset === "top") {
      this.desiredCamPos = new THREE.Vector3(0.01, 8.2, 2.2);
      this.desiredCamTarget = new THREE.Vector3(0, 0.8, 0);
    } else if (preset === "pet") {
      const target =
        this.companions.length > 0
          ? this.companions[0].group.position.clone().add(new THREE.Vector3(0, 0.45, 0))
          : new THREE.Vector3(1.1, 0.8, 0.7);
      this.desiredCamPos = target.clone().add(new THREE.Vector3(1.6, 1.15, 2.35));
      this.desiredCamTarget = target;
    } else if (preset === "molecule") {
      if (this.walkMode) {
        this.desiredCamPos = new THREE.Vector3(1.15, 2.05, 0.95);
        this.desiredCamTarget = new THREE.Vector3(0, 1.48, -0.35);
      } else {
        this.desiredCamPos = new THREE.Vector3(2.4, 3.65, 2.7);
        this.desiredCamTarget = new THREE.Vector3(0, 3.05, 0);
      }
    } else {
      this.desiredCamPos = new THREE.Vector3(5.45, 4.3, 6.25);
      this.desiredCamTarget = new THREE.Vector3(0, 1.55, 0);
    }
  }

  public resetCamera() {
    this.setCameraPreset("iso");
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
  };

  private handleContextRestored = () => {
    this.contextLost = false;
    this.lastTime = -1;
    this.resize();
  };

  private handlePointerDown = (e: PointerEvent) => {
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  };

  private handlePointerMove = (e: PointerEvent) => {
    // Touch devices don't hover; skip expensive raycasting on touchmove for buttery mobile scrolling/orbit!
    if (this.userDragging || e.pointerType === "touch") return;
    const nowMs = performance.now();
    if (!this.movingItem && nowMs - this.lastHoverRaycastMs < this.perfProfile.hoverRaycastIntervalMs) {
      return;
    }
    this.lastHoverRaycastMs = nowMs;

    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.tmpNdc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(this.tmpNdc, this.camera);

    // Live 3D Move-Mode Placement Reticle (tracks active floor 1F / 2F / 3F!)
    if (this.walkMode && !this.creatorCameraMode && this.movingItem && this.moveGhostRing) {
      this.movePlane.constant = -getUpperFloorY(this.activeFloor);
      if (this.raycaster.ray.intersectPlane(this.movePlane, this.tmpMoveHit)) {
        const pt = clampPlacementPoint(
          this.tmpMoveHit.x,
          this.tmpMoveHit.z,
          this.labDecor.houseSize,
          this.activeFloor,
          this.moveSnapGrid
        );
        const gy = getGroundElevationForFloor(this.activeFloor, pt.x, pt.z, this.labDecor.houseSize);
        this.moveGhostRing.position.set(pt.x, gy + 0.032, pt.z);
        this.moveGhostRing.visible = true;
        if (this.walkHoverRing) this.walkHoverRing.visible = false;
        this.renderer.domElement.style.cursor = "crosshair";
        return;
      }
    }

    const tabletopVisible = !this.walkMode || this.activeFloor >= 1;
    const atomTargets = tabletopVisible ? this.floatingAtoms.map((a) => a.group) : [];
    const hits = atomTargets.length > 0 ? this.raycaster.intersectObjects(atomTargets, true) : [];
    if (hits.length > 0) {
      let cur: THREE.Object3D | null = hits[0].object;
      while (cur && !atomTargets.includes(cur as THREE.Group)) cur = cur.parent;
      this.hoveredAtom = (cur as THREE.Group) || null;
      this.renderer.domElement.style.cursor = "pointer";
      return;
    }
    this.hoveredAtom = null;
    const petTargets = this.companions.filter((c) => c.group.visible).map((c) => c.group);
    const petHits = petTargets.length > 0 ? this.raycaster.intersectObjects(petTargets, true) : [];
    if (petHits.length > 0) {
      this.renderer.domElement.style.cursor = "pointer";
      return;
    }
    const wingTargets = tabletopVisible ? this.builtWingGroups.map((w) => w.group) : [];
    const wingHits = wingTargets.length > 0 ? this.raycaster.intersectObjects(wingTargets, true) : [];
    if (wingHits.length > 0) {
      if (this.walkHoverRing) this.walkHoverRing.visible = false;
      this.renderer.domElement.style.cursor = "pointer";
      return;
    }
    // Check physical 3D diegetic holographic monitors
    if (this.walkMode && !this.creatorCameraMode && this.diegeticMonitors) {
      const monHits = this.raycaster.intersectObjects(this.diegeticMonitors.getRaycastTargets(), true);
      if (monHits.length > 0) {
        if (this.walkHoverRing) this.walkHoverRing.visible = false;
        this.renderer.domElement.style.cursor = "pointer";
        return;
      }
    }
    // Check Sims interactive furniture, homely rooms, stairs, own character, visiting host NPC, neighbor labs, NPCs, and central flask for hover pointer
    if (this.walkMode && !this.creatorCameraMode) {
      const extraTargets: THREE.Object3D[] = [];
      if (this.characterAvatar) extraTargets.push(this.characterAvatar.root);
      if (this.visitingHostAvatar && this.visitingHostAvatar.root.visible) {
        extraTargets.push(this.visitingHostAvatar.root);
      }
      if (this.simsFurniture) extraTargets.push(...this.simsFurniture.getRaycastTargets());
      if (this.homeArchitecture) extraTargets.push(...this.homeArchitecture.getRaycastTargets());
      if (this.townGardens && this.activeFloor >= 1) extraTargets.push(...this.townGardens.getRaycastTargets());
      if (this.neighborhoodWorld && this.activeFloor >= 1) {
        extraTargets.push(...this.neighborhoodWorld.getRaycastTargets());
      }
      if (this.heroVesselGroup && tabletopVisible) extraTargets.push(this.heroVesselGroup);
      if (extraTargets.length > 0 && this.raycaster.intersectObjects(extraTargets, true).length > 0) {
        if (this.walkHoverRing) this.walkHoverRing.visible = false;
        this.renderer.domElement.style.cursor = "pointer";
        return;
      }
    }
    // Show subtle architectural floor walk-target cursor ring on hover (supports B1, 1F, 2F & 3F!)
    if (this.walkMode && !this.creatorCameraMode && this.walkHoverRing) {
      let hitX: number | null = null;
      let hitZ: number | null = null;
      if (this.activeFloor === 0 || this.activeFloor >= 2) {
        this.movePlane.constant = -getUpperFloorY(this.activeFloor);
        if (this.raycaster.ray.intersectPlane(this.movePlane, this.tmpMoveHit)) {
          hitX = this.tmpMoveHit.x;
          hitZ = this.tmpMoveHit.z;
        }
      } else if (this.walkFloorPlane) {
        const fHits = this.raycaster.intersectObject(this.walkFloorPlane, false);
        if (fHits.length > 0) {
          hitX = fHits[0].point.x;
          hitZ = fHits[0].point.z;
        }
      }
      if (hitX !== null && hitZ !== null) {
        const pt = this.resolveWalkObstacles(hitX, hitZ);
        const gy = this.getWalkGroundY(pt.x, pt.z);
        this.walkHoverRing.position.set(pt.x, gy + 0.014, pt.z);
        this.walkHoverRing.visible = true;
        this.renderer.domElement.style.cursor = "pointer";
        return;
      }
      this.walkHoverRing.visible = false;
    }
    this.renderer.domElement.style.cursor = "grab";
  };

  private handlePointerUp = (e: PointerEvent) => {
    // Only count as a tap/click (not an orbit drag)
    if (Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y) > 7) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);

    // 0. Live 3D Move Mode: clicking anywhere on the active floor places the selected station or furniture!
    if (this.walkMode && !this.creatorCameraMode && this.movingItem) {
      this.movePlane.constant = -getUpperFloorY(this.activeFloor);
      if (this.raycaster.ray.intersectPlane(this.movePlane, this.tmpMoveHit)) {
        const pt = clampPlacementPoint(
          this.tmpMoveHit.x,
          this.tmpMoveHit.z,
          this.labDecor.houseSize,
          this.activeFloor,
          this.moveSnapGrid
        );
        const gy = getGroundElevationForFloor(this.activeFloor, pt.x, pt.z, this.labDecor.houseSize);
        this.spawnColoredBurst(
          new THREE.Vector3(pt.x, gy + 0.42, pt.z),
          14,
          ["#38bdf8", "#ffffff", "#10b981"]
        );
        soundEngine.playBuildRoom();
        this.onPlaceMovedItem?.(this.movingItem, pt.x, pt.z, this.activeFloor);
        return;
      }
    }

    // 1. Did the user click directly on the 3D Cat or Dog?
    const tabletopVisible = !this.walkMode || this.activeFloor >= 1;
    const petTargets = this.companions.filter((c) => c.group.visible).map((c) => c.group);
    if (petTargets.length > 0 && this.raycaster.intersectObjects(petTargets, true).length > 0) {
      if (this.walkMode && !this.creatorCameraMode && this.onSimsObjectClick) {
        const cPos = this.companions[0].group.position;
        this.onSimsObjectClick(
          { kind: "pet", label: "Lab Companion", worldX: cPos.x, worldZ: cPos.z + 0.55 },
          e.clientX - rect.left,
          e.clientY - rect.top
        );
        soundEngine.playTap(1046.5);
        return;
      }
      this.triggerTamagotchiReaction("pet");
      this.onInteractiveEvent?.({ kind: "pet-clicked", bonusCoins: 1 });
      return;
    }

    // 1b. In Walk Mode: check Sims clickable objects (Player, Furniture, Central Flask, Fountain, Neighbor Labs & NPCs)
    if (this.walkMode && !this.creatorCameraMode && this.onSimsObjectClick) {
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // Own character clicked -> Sims self pie menu!
      if (this.characterAvatar) {
        const selfHits = this.raycaster.intersectObject(this.characterAvatar.root, true);
        if (selfHits.length > 0) {
          this.onSimsObjectClick(
            {
              kind: "player",
              label: this.characterProfile?.name || "My Researcher",
              worldX: this.charX,
              worldZ: this.charZ
            },
            screenX,
            screenY
          );
          soundEngine.playTap(987.77);
          return;
        }
      }

      // Visiting Host Researcher NPC standing inside another user's home!
      if (this.visitingHostAvatar) {
        const hostHits = this.raycaster.intersectObject(this.visitingHostAvatar.root, true);
        if (hostHits.length > 0) {
          let cur: THREE.Object3D | null = hostHits[0].object;
          let target: SimsObjectTarget | undefined;
          while (cur && !target) {
            if (cur.userData?.simsTarget) target = cur.userData.simsTarget as SimsObjectTarget;
            cur = cur.parent;
          }
          if (target) {
            this.onSimsObjectClick(target, screenX, screenY);
            soundEngine.playTap(1046.5);
            return;
          }
        }
      }

      // Sims Furniture (Lounge Bench, Espresso Bar, Microscope, Harvester, Hobby Nook)
      if (this.simsFurniture) {
        const fHits = this.raycaster.intersectObjects(this.simsFurniture.getRaycastTargets(), true);
        if (fHits.length > 0) {
          const target = fHits[0].object.userData?.simsTarget as SimsObjectTarget | undefined;
          if (target) {
            this.onSimsObjectClick(target, screenX, screenY);
            soundEngine.playTap(1046.5);
            return;
          }
        }
      }

      // Cozy Extra Rooms (Bedroom, Kitchen, Spa, Fireplace, Garden Arbor, Piano) & Spiral Staircase!
      if (this.homeArchitecture) {
        const hHits = this.raycaster.intersectObjects(this.homeArchitecture.getRaycastTargets(), true);
        if (hHits.length > 0) {
          let cur: THREE.Object3D | null = hHits[0].object;
          let target: SimsObjectTarget | undefined;
          while (cur && !target) {
            if (cur.userData?.simsTarget) target = cur.userData.simsTarget as SimsObjectTarget;
            cur = cur.parent;
          }
          if (target) {
            this.onSimsObjectClick(target, screenX, screenY);
            soundEngine.playTap(1046.5);
            return;
          }
        }
      }

      // Interactive Home & Town Botanical Garden Beds, Glass Conservatory & Park Benches!
      if (this.townGardens && this.activeFloor >= 1) {
        const gHits = this.raycaster.intersectObjects(this.townGardens.getRaycastTargets(), true);
        if (gHits.length > 0) {
          let cur: THREE.Object3D | null = gHits[0].object;
          let target: SimsObjectTarget | undefined;
          while (cur && !target) {
            if (cur.userData?.simsTarget) target = cur.userData.simsTarget as SimsObjectTarget;
            cur = cur.parent;
          }
          if (target) {
            this.onSimsObjectClick(target, screenX, screenY);
            soundEngine.playTap(1046.5);
            return;
          }
        }
      }

      // Neighborhood Fountain, Neighbor NFT Labs & Neighbor NPC Researchers!
      if (this.neighborhoodWorld && this.activeFloor >= 1) {
        const nHits = this.raycaster.intersectObjects(
          this.neighborhoodWorld.getRaycastTargets(),
          true
        );
        if (nHits.length > 0) {
          let cur: THREE.Object3D | null = nHits[0].object;
          let target: SimsObjectTarget | undefined;
          while (cur && !target) {
            if (cur.userData?.simsTarget) target = cur.userData.simsTarget as SimsObjectTarget;
            cur = cur.parent;
          }
          if (target) {
            this.onSimsObjectClick(target, screenX, screenY);
            soundEngine.playTap(1046.5);
            return;
          }
        }
      }
    }

    // 2. Did the user tap a floating 3D Proton / Atom? -> Pop it with combo chime!
    // (Checked before central glass vessel so Proton Catch clicks never get intercepted behind!)
    const atomTargets = tabletopVisible ? this.floatingAtoms.map((a) => a.group) : [];
    const hits = atomTargets.length > 0 ? this.raycaster.intersectObjects(atomTargets, true) : [];
    if (hits.length > 0) {
      const nowMs = performance.now();
      this.protonCombo = nowMs - this.lastProtonPopMs < 3500 ? Math.min(6, this.protonCombo + 1) : 1;
      this.lastProtonPopMs = nowMs;
      const hitPoint = hits[0].point.clone();
      soundEngine.playProtonPop(this.protonCombo - 1);
      this.spawnColoredBurst(hitPoint, 14 + this.protonCombo * 2, [
        this.traits.palette.electron,
        this.traits.palette.proton,
        "#ffffff"
      ]);
      this.excitement = Math.min(1.6, this.excitement + 0.55);
      this.onInteractiveEvent?.({
        kind: "atom-popped",
        bonusCoins: 1 + this.protonCombo,
        combo: this.protonCombo
      });
      return;
    }

    // 2b. Central Hero Tabletop Borosilicate Glass Vessel -> Protein Folding Pie Menu!
    if (
      this.walkMode &&
      tabletopVisible &&
      !this.creatorCameraMode &&
      this.onSimsObjectClick &&
      this.heroVesselGroup &&
      this.raycaster.intersectObject(this.heroVesselGroup, true).length > 0
    ) {
      this.onSimsObjectClick(
        { kind: "flask", label: "Tabletop Alchemy Vessel", worldX: 0, worldZ: 0.78 },
        e.clientX - rect.left,
        e.clientY - rect.top
      );
      soundEngine.playTap(1046.5);
      return;
    }

    // 3. Did the user tap a built Sims-style 3D architectural room? -> Tactile room micro-reaction!
    const wingTargets = tabletopVisible ? this.builtWingGroups.map((w) => w.group) : [];
    const wingHits = wingTargets.length > 0 ? this.raycaster.intersectObjects(wingTargets, true) : [];
    if (wingHits.length > 0) {
      let cur: THREE.Object3D | null = wingHits[0].object;
      let matched: { sectorId: number; name: string; group: THREE.Group } | undefined;
      while (cur && !matched) {
        matched = this.builtWingGroups.find((w) => w.group === cur);
        cur = cur.parent;
      }
      if (matched) {
        const hitPt = wingHits[0].point.clone().add(new THREE.Vector3(0, 0.25, 0));
        this.excitement = Math.min(1.6, this.excitement + 0.65);
        if (matched.sectorId === 0) {
          soundEngine.playTap(1318.51);
          this.spawnColoredBurst(hitPt, 14, ["#38bdf8", "#bae6fd", "#ffffff"]);
          this.compute.triggerFoldAction("wiggle");
        } else if (matched.sectorId === 1) {
          soundEngine.playProtonPop(3);
          this.spawnColoredBurst(hitPt, 16, ["#6366f1", "#fbbf24", "#ffffff"]);
        } else if (matched.sectorId === 2) {
          soundEngine.playTap(987.77);
          this.spawnColoredBurst(hitPt, 14, ["#10b981", "#6ee7b7", "#fde68a"]);
        } else if (matched.sectorId === 3) {
          this.triggerTamagotchiReaction("pet");
        } else if (matched.sectorId === 4) {
          soundEngine.playProtonPop(5);
          this.shockwaveLife = 0.85;
          this.spawnColoredBurst(hitPt, 16, ["#8b5cf6", "#c4b5fd", "#ffffff"]);
        } else {
          soundEngine.playBuildRoom();
          this.spawnColoredBurst(hitPt, 18, ["#f59e0b", "#fde68a", "#5b8def", "#ffffff"]);
        }
        const linkedStation = stationForSector(matched.sectorId);
        if (this.walkMode && !this.creatorCameraMode) {
          this.walkToStation(linkedStation);
        }
        this.onInteractiveEvent?.({
          kind: "room-clicked",
          sectorId: matched.sectorId,
          roomName: matched.name,
          stationId: linkedStation,
          bonusCoins: 1
        });
        return;
      }
    }

    // 3b. Did the user click directly on one of the 5 physical 3D floating holographic monitors?
    if (this.walkMode && !this.creatorCameraMode && this.diegeticMonitors) {
      const monHits = this.raycaster.intersectObjects(this.diegeticMonitors.getRaycastTargets(), true);
      if (monHits.length > 0) {
        let cur: THREE.Object3D | null = monHits[0].object;
        let hitStation: LabStationId | undefined;
        while (cur && !hitStation) {
          if (cur.userData?.stationId) hitStation = cur.userData.stationId as LabStationId;
          cur = cur.parent;
        }
        if (hitStation) {
          this.walkToStation(hitStation);
          soundEngine.playTap(1046.5);
          this.onInteractiveEvent?.({
            kind: "monitor-clicked",
            stationId: hitStation,
            bonusCoins: 0
          });
          return;
        }
      }
    }

    // 4. In Walk Mode: clicking any floor/terrace point (on B1, 1F, 2F, or 3F!) walks your character smoothly there!
    if (this.walkMode && !this.creatorCameraMode) {
      let hitX: number | null = null;
      let hitZ: number | null = null;
      if (this.activeFloor === 0 || this.activeFloor >= 2) {
        this.movePlane.constant = -getUpperFloorY(this.activeFloor);
        if (this.raycaster.ray.intersectPlane(this.movePlane, this.tmpMoveHit)) {
          hitX = this.tmpMoveHit.x;
          hitZ = this.tmpMoveHit.z;
        }
      } else if (this.walkFloorPlane) {
        const floorHits = this.raycaster.intersectObject(this.walkFloorPlane, false);
        if (floorHits.length > 0) {
          hitX = floorHits[0].point.x;
          hitZ = floorHits[0].point.z;
        }
      }
      if (hitX !== null && hitZ !== null) {
        const nearSt = findNearestStationWithLayout(
          hitX,
          hitZ,
          this.activeFloor,
          this.labDecor.customLayout
        );
        this.walkToPoint(hitX, hitZ, nearSt);
        soundEngine.playTap(784);
        this.onInteractiveEvent?.({
          kind: "floor-walk",
          stationId: nearSt || undefined,
          bonusCoins: 0
        });
      }
    }
  };

  private getAccessoryRank(): string {
    const petLvl = this.impact.petLevel ?? 1;
    const wus = this.impact.workUnits ?? 0;
    const acc = this.impact.petAccessory || "auto";
    const outfit = this.impact.petOutfit || "none";
    const back = this.impact.petBackGear || "none";
    const color = this.impact.petOutfitColor || "#f472b6";
    return `${acc}|${outfit}|${back}|${color}|${petLvl >= 2 ? 1 : 0}|${wus >= 10 ? 1 : 0}`;
  }

  private addPetWardrobe3D(
    head: THREE.Group,
    bodyGroup: THREE.Group,
    collarY: number,
    isDog: boolean,
    variant: string
  ): [THREE.Object3D, THREE.Object3D] | undefined {
    const pal = this.traits.palette;
    const acc = this.impact.petAccessory || "auto";
    const outfit = this.impact.petOutfit || "none";
    const backGear = this.impact.petBackGear || "none";
    const clothHex = this.impact.petOutfitColor || "#f472b6";

    const clothMat = new THREE.MeshStandardMaterial({
      color: clothHex,
      roughness: 0.56,
      metalness: 0.08
    });
    const clothGlowMat = new THREE.MeshStandardMaterial({
      color: clothHex,
      emissive: clothHex,
      emissiveIntensity: 0.28,
      roughness: 0.32,
      metalness: 0.18
    });
    const whiteClothMat = new THREE.MeshStandardMaterial({
      color: "#f8fafd",
      roughness: 0.42,
      metalness: 0.05
    });
    const titaniumMat = new THREE.MeshStandardMaterial({
      color: "#cbd5e1",
      metalness: 0.88,
      roughness: 0.18
    });

    const torsoY = collarY - 0.19;

    // ------------------------------------------------------------------
    // 1. ANIMAL CLOTHING OUTFITS (7 Adorable 3D Outfits + Natural Fur!)
    // ------------------------------------------------------------------
    if (outfit === "sweater") {
      // Cozy Ribbed Knit Sweater with contrasting collar & stripe
      const knit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.228, 0.236, 0.25, 22),
        clothMat
      );
      knit.position.set(0, torsoY, 0);
      knit.castShadow = true;
      bodyGroup.add(knit);

      const stripe = new THREE.Mesh(
        new THREE.TorusGeometry(0.234, 0.018, 8, 28),
        whiteClothMat
      );
      stripe.rotation.x = Math.PI / 2;
      stripe.position.set(0, torsoY, 0);
      bodyGroup.add(stripe);

      const neckRib = new THREE.Mesh(new THREE.TorusGeometry(0.195, 0.028, 10, 24), clothMat);
      neckRib.rotation.x = Math.PI / 2;
      neckRib.position.set(0, collarY - 0.02, 0);
      bodyGroup.add(neckRib);
    } else if (outfit === "labcoat") {
      // Adorable Miniature Scientist Lab Coat with lapels & glowing badge!
      const coat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.23, 0.258, 0.3, 22, 1, false, -Math.PI * 0.82, Math.PI * 1.64),
        whiteClothMat
      );
      coat.position.set(0, torsoY - 0.01, 0);
      coat.rotation.y = Math.PI;
      coat.castShadow = true;
      bodyGroup.add(coat);

      for (const side of [-1, 1]) {
        const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.12, 0.022), whiteClothMat);
        lapel.position.set(side * 0.078, torsoY + 0.07, 0.205);
        lapel.rotation.z = -side * 0.26;
        bodyGroup.add(lapel);
      }

      const badge = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.06, 0.016), clothGlowMat);
      badge.position.set(-0.1, torsoY + 0.03, 0.222);
      bodyGroup.add(badge);
    } else if (outfit === "hoodie") {
      // Cozy Pup/Kitty Hoodie with rolled back hood & pearl drawstrings!
      const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.228, 0.24, 0.26, 22),
        clothMat
      );
      shell.position.set(0, torsoY, 0);
      shell.castShadow = true;
      bodyGroup.add(shell);

      const hoodRoll = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.048, 10, 24), clothMat);
      hoodRoll.rotation.x = Math.PI / 2 + 0.22;
      hoodRoll.position.set(0, collarY - 0.01, -0.05);
      bodyGroup.add(hoodRoll);

      for (const side of [-1, 1]) {
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 6), whiteClothMat);
        cord.position.set(side * 0.045, collarY - 0.08, 0.228);
        bodyGroup.add(cord);
      }
    } else if (outfit === "raincoat") {
      // Glossy Translucent Pastel Raincoat Cape with silver buttons!
      const slickerMat = new THREE.MeshPhysicalMaterial({
        color: clothHex,
        roughness: 0.14,
        clearcoat: 1.0,
        transmission: 0.35,
        transparent: true,
        opacity: 0.92
      });
      const cape = new THREE.Mesh(
        new THREE.CylinderGeometry(0.225, 0.285, 0.3, 22, 1, false, -Math.PI * 0.78, Math.PI * 1.56),
        slickerMat
      );
      cape.position.set(0, torsoY - 0.01, -0.01);
      cape.rotation.y = Math.PI;
      cape.castShadow = true;
      bodyGroup.add(cape);

      const flap = new THREE.Mesh(new THREE.TorusGeometry(0.195, 0.024, 10, 24), slickerMat);
      flap.rotation.x = Math.PI / 2;
      flap.position.set(0, collarY - 0.01, 0);
      bodyGroup.add(flap);

      const snap = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), titaniumMat);
      snap.position.set(0, collarY - 0.03, 0.22);
      bodyGroup.add(snap);
    } else if (outfit === "cape") {
      // Royal Starlight Velvet Cape with glowing crystal clasp!
      const royalCape = new THREE.Mesh(
        new THREE.CylinderGeometry(0.195, 0.31, 0.33, 24, 1, false, Math.PI * 0.56, Math.PI * 0.88),
        clothMat
      );
      royalCape.position.set(0, torsoY - 0.02, -0.02);
      royalCape.castShadow = true;
      bodyGroup.add(royalCape);

      const trim = new THREE.Mesh(
        new THREE.TorusGeometry(0.308, 0.012, 8, 28, Math.PI * 0.88),
        titaniumMat
      );
      trim.rotation.x = Math.PI / 2;
      trim.rotation.z = -Math.PI * 0.06;
      trim.position.set(0, torsoY - 0.185, -0.02);
      bodyGroup.add(trim);

      const clasp = new THREE.Mesh(new THREE.OctahedronGeometry(0.038, 0), clothGlowMat);
      clasp.position.set(0, collarY - 0.02, 0.225);
      bodyGroup.add(clasp);
    } else if (outfit === "tutu") {
      // Fluffy Layered Cloud Tutu Skirt & Waist Satin Ribbon!
      const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.228, 0.02, 8, 28), clothMat);
      ribbon.rotation.x = Math.PI / 2;
      ribbon.position.set(0, torsoY - 0.04, 0);
      bodyGroup.add(ribbon);

      const tulleMat = new THREE.MeshPhysicalMaterial({
        color: clothHex,
        roughness: 0.48,
        transparent: true,
        opacity: 0.86
      });
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2;
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.088, 12, 10), tulleMat);
        puff.scale.set(1.25, 0.42, 1.0);
        puff.position.set(Math.cos(ang) * 0.245, torsoY - 0.08, Math.sin(ang) * 0.245);
        bodyGroup.add(puff);
      }
    } else if (outfit === "puffer") {
      // Adorable Quilted Mini Puffer Vest!
      for (const [dy, r] of [[0.06, 0.224], [-0.01, 0.238], [-0.08, 0.232]] as const) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.038, 10, 26), clothMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, torsoY + dy, 0);
        ring.castShadow = true;
        bodyGroup.add(ring);
      }
    }

    // ------------------------------------------------------------------
    // 2. PET BACK GEAR (Mini Fairy Wings, Treat Backpack, Giant Silk Bow!)
    // ------------------------------------------------------------------
    let petWings: [THREE.Object3D, THREE.Object3D] | undefined;
    if (backGear === "wings") {
      const wingMat = new THREE.MeshPhysicalMaterial({
        color: clothHex,
        emissive: clothHex,
        emissiveIntensity: 0.42,
        transmission: 0.62,
        roughness: 0.08,
        transparent: true,
        opacity: 0.84,
        side: THREE.DoubleSide
      });
      const pivots: THREE.Object3D[] = [];
      for (const side of [-1, 1]) {
        const wPivot = new THREE.Group();
        wPivot.position.set(side * 0.075, torsoY + 0.06, -0.2);

        const upper = new THREE.Mesh(new THREE.CircleGeometry(0.145, 16), wingMat);
        upper.scale.set(1.28, 0.68, 1);
        upper.position.set(side * 0.14, 0.06, -0.02);
        upper.rotation.z = side * 0.34;
        wPivot.add(upper);

        const lower = new THREE.Mesh(new THREE.CircleGeometry(0.1, 14), wingMat);
        lower.scale.set(1.12, 0.66, 1);
        lower.position.set(side * 0.1, -0.06, -0.02);
        lower.rotation.z = -side * 0.24;
        wPivot.add(lower);

        bodyGroup.add(wPivot);
        pivots.push(wPivot);
      }
      petWings = [pivots[0], pivots[1]];
    } else if (backGear === "backpack") {
      // Cute Miniature Treat Saddle Backpack!
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.17, 0.1), clothMat);
      pack.position.set(0, torsoY + 0.02, -0.24);
      pack.castShadow = true;
      bodyGroup.add(pack);
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.055, 0.11), whiteClothMat);
      flap.position.set(0, torsoY + 0.09, -0.24);
      bodyGroup.add(flap);
      const clasp = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), titaniumMat);
      clasp.position.set(0, torsoY + 0.055, -0.295);
      bodyGroup.add(clasp);
    } else if (backGear === "ribbon") {
      // Oversized Fluffy Satin Back Bow!
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 12), clothMat);
      knot.position.set(0, torsoY + 0.04, -0.23);
      bodyGroup.add(knot);
      for (const side of [-1, 1]) {
        const loop = new THREE.Mesh(new THREE.SphereGeometry(0.088, 12, 10), clothMat);
        loop.scale.set(1.25, 0.68, 0.45);
        loop.position.set(side * 0.095, torsoY + 0.05, -0.24);
        loop.rotation.z = side * 0.2;
        bodyGroup.add(loop);
      }
    }

    // ------------------------------------------------------------------
    // 3. PET HATS, GLASSES & COLLAR ACCESSORIES (12 Styles!)
    // ------------------------------------------------------------------
    if (acc === "none") return petWings;

    const showHalo =
      acc === "halo" ||
      (acc === "auto" &&
        (!isDog
          ? variant === "siamese-cat" ||
            this.traits.sub.companionAccessory === "halo" ||
            (this.impact.workUnits ?? 0) >= 10
          : (this.impact.workUnits ?? 0) >= 10));

    const showGoggles =
      acc === "goggles" ||
      (acc === "auto" &&
        (isDog
          ? variant === "shiba-dog" ||
            this.traits.sub.companionAccessory === "goggles" ||
            (this.impact.petLevel ?? 1) >= 2
          : (this.impact.petLevel ?? 1) >= 2));

    const showCrown =
      acc === "crown" ||
      (acc === "auto" &&
        ((this.impact.sectorsMask ?? 0) === 0b111111 || (this.impact.complexityTier || 1) >= 5));

    if (showHalo) {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.16, 0.014, 10, 32),
        new THREE.MeshStandardMaterial({
          color: pal.accent,
          emissive: pal.accent,
          emissiveIntensity: 0.9,
          metalness: 0.78
        })
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.36;
      head.add(halo);
    }

    if (showGoggles) {
      if (isDog) {
        const strap = new THREE.Mesh(
          new THREE.TorusGeometry(0.205, 0.015, 8, 32),
          new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.38 })
        );
        strap.rotation.x = Math.PI / 2 - 0.35;
        strap.position.set(0, 0.11, 0.02);
        head.add(strap);
      }
      const lensMat = new THREE.MeshPhysicalMaterial({
        color: pal.liquidTop,
        emissive: pal.electron,
        emissiveIntensity: 0.38,
        roughness: 0.07,
        transmission: 0.6,
        transparent: true
      });
      for (const side of [-1, 1]) {
        const gRim = new THREE.Mesh(
          new THREE.TorusGeometry(isDog ? 0.062 : 0.056, 0.011, 10, 24),
          titaniumMat
        );
        gRim.position.set(side * (isDog ? 0.075 : 0.072), isDog ? 0.15 : 0.145, 0.174);
        gRim.rotation.x = -0.34;
        head.add(gRim);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(isDog ? 0.055 : 0.05, 18), lensMat);
        lens.position.copy(gRim.position);
        lens.rotation.copy(gRim.rotation);
        head.add(lens);
      }
    }

    if (showCrown) {
      const crown = new THREE.Mesh(
        new THREE.TorusGeometry(0.112, 0.015, 10, 24),
        new THREE.MeshStandardMaterial({
          color: "#f8e7b5",
          emissive: "#f59e0b",
          emissiveIntensity: 0.35,
          metalness: 0.92,
          roughness: 0.14
        })
      );
      crown.rotation.x = Math.PI / 2;
      crown.position.y = 0.325;
      head.add(crown);
    }

    if (acc === "bowtie") {
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 12), clothGlowMat);
      knot.position.set(0, collarY - 0.01, 0.21);
      bodyGroup.add(knot);
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.11, 10), clothGlowMat);
        wing.position.set(side * 0.064, collarY - 0.01, 0.205);
        wing.rotation.z = side * (Math.PI / 2);
        wing.scale.set(1, 1, 0.45);
        bodyGroup.add(wing);
      }
    }

    if (acc === "beret") {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 22, 14), clothMat);
      cap.scale.set(1.18, 0.38, 1.12);
      cap.position.set(0.03, 0.23, -0.01);
      cap.rotation.z = -0.22;
      cap.castShadow = true;
      head.add(cap);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.055, 8), clothMat);
      stem.position.set(0.045, 0.305, -0.01);
      stem.rotation.z = -0.22;
      head.add(stem);
    }

    if (acc === "scarf") {
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.195, 0.042, 10, 26), clothMat);
      wrap.rotation.x = Math.PI / 2 + 0.08;
      wrap.position.set(0, collarY, 0.01);
      wrap.castShadow = true;
      bodyGroup.add(wrap);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.18, 0.032), clothMat);
      tail.position.set(0.08, collarY - 0.1, 0.21);
      tail.rotation.z = -0.18;
      bodyGroup.add(tail);
    }

    if (acc === "beanie") {
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.215, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.46),
        clothMat
      );
      dome.position.set(0, 0.06, -0.01);
      dome.castShadow = true;
      head.add(dome);
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.028, 10, 26), clothMat);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.set(0, 0.09, -0.01);
      head.add(cuff);
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 12), whiteClothMat);
      pom.position.set(0, 0.305, -0.01);
      head.add(pom);
    }

    if (acc === "flower") {
      // Cute 5-Blossom Flower Crown resting around the ears!
      const stem = new THREE.Mesh(
        new THREE.TorusGeometry(0.165, 0.01, 8, 28),
        new THREE.MeshStandardMaterial({ color: "#34d399", roughness: 0.45 })
      );
      stem.rotation.x = Math.PI / 2;
      stem.position.set(0, 0.18, 0.01);
      head.add(stem);
      const petalCols = [clothHex, "#fbcfe8", "#fde68a", "#bae6fd", "#e9d5ff"];
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 + 0.3;
        const fl = new THREE.Mesh(
          new THREE.SphereGeometry(0.042, 10, 10),
          new THREE.MeshStandardMaterial({ color: petalCols[i], roughness: 0.38 })
        );
        fl.scale.set(1.1, 0.65, 1.1);
        fl.position.set(Math.cos(ang) * 0.165, 0.2, Math.sin(ang) * 0.165);
        head.add(fl);
      }
    }

    if (acc === "wizard") {
      // Adorable Pointed Alchemist Hat with silver band!
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.022, 22), clothMat);
      brim.position.set(0, 0.2, -0.01);
      brim.rotation.z = -0.14;
      head.add(brim);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.145, 0.32, 18), clothMat);
      cone.position.set(0.025, 0.35, -0.01);
      cone.rotation.z = -0.14;
      cone.castShadow = true;
      head.add(cone);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.016, 8, 22), titaniumMat);
      band.rotation.x = Math.PI / 2;
      band.rotation.y = -0.14;
      band.position.set(0.005, 0.22, -0.01);
      head.add(band);
    }

    if (acc === "shades") {
      // Cool Miniature Titanium Shades!
      const darkLens = new THREE.MeshStandardMaterial({
        color: "#0f172a",
        roughness: 0.08,
        metalness: 0.85
      });
      const zOff = isDog ? 0.22 : 0.215;
      const yOff = isDog ? 0.04 : 0.02;
      for (const side of [-1, 1]) {
        const lens = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.056, 0.02), darkLens);
        lens.position.set(side * 0.082, yOff, zOff);
        head.add(lens);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.014, 0.018), titaniumMat);
      bridge.position.set(0, yOff + 0.022, zOff + 0.004);
      head.add(bridge);
    }

    if (acc === "bandana") {
      // Cute Explorer Triangle Neckerchief Bandana!
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.188, 0.026, 8, 26), clothMat);
      band.rotation.x = Math.PI / 2;
      band.position.set(0, collarY, 0);
      bodyGroup.add(band);
      const tri = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.14, 3), clothMat);
      tri.rotation.z = Math.PI;
      tri.scale.set(1.1, 1, 0.35);
      tri.position.set(0, collarY - 0.08, 0.21);
      bodyGroup.add(tri);
    }

    return petWings;
  }

  public updateState(next: Partial<LiveImpactState>) {
    const prevGlobal = this.impact.globalImpactEth;
    const prevSeed = this.impact.seed;
    const prevTier = this.impact.complexityTier;
    const prevSectors = this.impact.sectorsMask ?? 0;
    const prevPulse = this.impact.lastPulseAt;

    this.impact = { ...this.impact, ...next };
    if (!next.reactionStage) {
      this.impact.reactionStage = stageFromEth(this.impact.globalImpactEth);
    }

    if (next.seed && next.seed !== prevSeed) {
      this.traits = deriveTraitsFromSeed(next.seed);
      this.compute.reseed(next.seed, this.impact.causeId, this.impact.tokenId);
    }

    this.syncFillTarget();
    this.neighborhoodWorld?.setGlobalImpactScale(this.impact.globalImpactEth);

    const nextSectors = this.impact.sectorsMask ?? 0;
    const nextAccRank = this.getAccessoryRank();
    const prevBuilt = this.builtSectorsMask;
    const sectorsChanged = nextSectors !== prevBuilt && prevBuilt !== -1;
    if (
      this.impact.seed !== this.builtSeed ||
      this.impact.complexityTier !== this.builtTier ||
      nextSectors !== this.builtSectorsMask ||
      nextAccRank !== this.builtAccessoryRank
    ) {
      if (sectorsChanged) {
        this.buildPopScale = 0.92;
        this.setPreviewSector(null);
        soundEngine.playBuildRoom();
        // Smoothly glide camera to frame the newly built architectural wing!
        const addedBit = nextSectors & ~prevBuilt;
        for (let s = 0; s < 6; s++) {
          if ((addedBit & (1 << s)) !== 0) {
            this.focusSector(s);
            break;
          }
        }
      } else if (this.impact.complexityTier !== prevTier && this.builtTier !== -1) {
        // Tactile spring pop-in when sliding $1 -> $500 across complexity levels
        this.buildPopScale = 0.945;
      }
      this.rebuild3DModel();
      this.onComputeTick?.(this.compute.getSnapshot());
    }

    if (
      this.impact.globalImpactEth > prevGlobal + 1e-6 ||
      this.impact.complexityTier > prevTier ||
      nextSectors !== prevSectors ||
      (next.lastPulseAt && next.lastPulseAt !== prevPulse)
    ) {
      this.triggerCatalyticPulse(
        this.impact.complexityTier > prevTier || nextSectors !== prevSectors ? 1.32 : 1.0
      );
    }
  }

  public triggerCatalyticPulse(intensity = 1.0) {
    this.excitement = Math.min(1.6, this.excitement + 0.92 * intensity);
    this.shockwaveLife = 1.0;
    this.triggerWaterRipple();
    this.spawnBurst(new THREE.Vector3(0, 1.55, 0), Math.round(20 * intensity));
  }

  private triggerWaterRipple() {
    if (this.waterRipples.length === 0) return;
    const slot = this.waterRipples[this.nextWaterRippleIdx % this.waterRipples.length];
    this.nextWaterRippleIdx = (this.nextWaterRippleIdx + 1) % this.waterRipples.length;
    slot.life = 1.0;
    slot.mesh.scale.setScalar(1.0);
  }

  /**
   * Live 3D Tamagotchi Companion Reaction (Feed Treat / Pet Hearts / Play Proton Catch)
   */
  public triggerTamagotchiReaction(action: "feed" | "pet" | "play") {
    this.excitement = Math.min(1.75, this.excitement + (action === "play" ? 1.35 : 1.05));
    this.discoveryFlash = Math.max(this.discoveryFlash, 0.85);
    this.triggerWaterRipple();
    for (const c of this.companions) {
      c.petReaction = Math.min(1.8, c.petReaction + 1.25);
    }
    const origin =
      this.companions.length > 0
        ? this.companions[0].group.position.clone().add(new THREE.Vector3(0, 0.85, 0))
        : new THREE.Vector3(0.8, 1.1, 0.6);

    if (action === "pet") {
      soundEngine.playPet();
      this.spawnColoredBurst(origin, 16, ["#f472b6", "#fb7185", "#fda4af", "#ffffff"]);
      this.spawnMoodBubble(origin, "heart");
    } else if (action === "feed") {
      soundEngine.playFeed();
      this.spawnColoredBurst(origin, 14, ["#fbbf24", "#34d399", "#ffffff"]);
      this.spawnMoodBubble(origin, "treat");
      this.dropTreatCluster(origin);
    } else {
      soundEngine.playBounce();
      this.spawnColoredBurst(origin, 18, ["#38bdf8", "#818cf8", "#f472b6"]);
      this.spawnMoodBubble(origin, "ball");
      this.shockwaveLife = 0.85;
      this.launchBouncingToyBall(origin);
    }
  }

  private spawnMoodBubble(origin: THREE.Vector3, kind: MoodBubbleKind) {
    let tex = this.moodTextures[kind];
    if (!tex) {
      tex = createMoodBubbleTexture(kind);
      this.moodTextures[kind] = tex;
    }
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0.96,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.46, 0.46, 1);
    sprite.position.set(origin.x, origin.y + 0.34, origin.z);
    this.dynamicGroup.add(sprite);
    this.moodBubbles.push({
      sprite,
      life: 0,
      maxLife: 1.75,
      baseX: origin.x,
      baseZ: origin.z,
      startY: origin.y + 0.34
    });
  }

  private dropTreatCluster(nearPet: THREE.Vector3) {
    // Drop 3 glowing crystalline elixir treats near the pet to trot over and nibble!
    const geo = new THREE.OctahedronGeometry(0.06, 0);
    const treatY = this.walkMode ? 0.2 : 0.48;
    for (let i = 0; i < 3; i++) {
      const ang = Math.atan2(nearPet.z, nearPet.x) + (i - 1) * 0.42;
      const rad = this.walkMode ? 0.36 + (i % 2) * 0.16 : 0.96 + (i % 2) * 0.26;
      const tx = this.walkMode ? nearPet.x + Math.cos(ang) * rad : Math.cos(ang) * rad;
      const tz = this.walkMode ? nearPet.z + Math.sin(ang) * rad : Math.sin(ang) * rad;
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: i % 2 === 0 ? "#34d399" : "#fbbf24",
          emissive: i % 2 === 0 ? "#10b981" : "#f59e0b",
          emissiveIntensity: 0.95,
          roughness: 0.14
        })
      );
      mesh.position.set(tx, treatY, tz);
      this.dynamicGroup.add(mesh);
      this.treats.push({ mesh, pos: new THREE.Vector3(tx, treatY, tz), eaten: false });
    }
  }

  private launchBouncingToyBall(nearPet: THREE.Vector3) {
    if (this.toyBall) {
      this.dynamicGroup.remove(this.toyBall.mesh);
      this.toyBall = null;
    }
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 18, 18),
      new THREE.MeshStandardMaterial({
        color: "#38bdf8",
        emissive: "#6366f1",
        emissiveIntensity: 1.0,
        roughness: 0.12
      })
    );
    ball.add(this.makeGlowSprite("#38bdf8", 0.42, 0.72));
    ball.position.set(nearPet.x * 0.45, 1.85, nearPet.z + 0.35);
    this.dynamicGroup.add(ball);
    this.toyBall = {
      mesh: ball,
      vel: new THREE.Vector3((Math.random() - 0.5) * 2.1, 1.35, (Math.random() - 0.5) * 1.8),
      life: 7.0,
      bounceCooldown: 0
    };
  }

  private spawnColoredBurst(origin: THREE.Vector3, count: number, paletteColors: string[]) {
    const geo = new THREE.OctahedronGeometry(0.06, 0);
    for (let i = 0; i < count; i++) {
      const col = paletteColors[i % paletteColors.length];
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.95,
        roughness: 0.15,
        transparent: true,
        opacity: 0.96
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(origin);
      this.dynamicGroup.add(mesh);

      const theta = Math.random() * Math.PI * 2;
      const spd = 0.7 + Math.random() * 1.35;
      this.bursts.push({
        mesh,
        vx: Math.cos(theta) * spd,
        vy: 1.2 + Math.random() * 1.4,
        vz: Math.sin(theta) * spd,
        life: 0,
        maxLife: 1.1 + Math.random() * 0.65
      });
    }
  }

  private onResearchDiscovery() {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    // Rate-limit visual discovery fireworks so rapid initial folds stay calm and refined
    if (now - this.lastDiscoveryVisualMs < 2400) return;
    this.lastDiscoveryVisualMs = now;
    this.discoveryFlash = 0.65;
    this.excitement = Math.min(1.2, this.excitement + 0.3);
    this.triggerWaterRipple();
    this.spawnBurst(new THREE.Vector3(0, 3.05, 0), 6);
    if (this.companions.length > 0 && this.moodBubbles.length < 2) {
      this.spawnMoodBubble(
        this.companions[0].group.position.clone().add(new THREE.Vector3(0, 0.85, 0)),
        "sparkle"
      );
    }
    soundEngine.playDiscovery();
  }

  private spawnBurst(origin: THREE.Vector3, count: number) {
    const pal = this.traits.palette;
    const colors = [pal.proton, pal.electron, pal.accent, pal.liquidTop, "#ffffff"];
    const geo = new THREE.OctahedronGeometry(0.055, 0);

    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: colors[i % colors.length],
        emissive: colors[i % colors.length],
        emissiveIntensity: 0.85,
        roughness: 0.18,
        metalness: 0.45,
        transparent: true,
        opacity: 0.95
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(origin);
      this.dynamicGroup.add(mesh);

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.72;
      const spd = 1.15 + Math.random() * 1.9;
      this.bursts.push({
        mesh,
        vx: Math.sin(phi) * Math.cos(theta) * spd,
        vy: Math.cos(phi) * spd + 0.75,
        vz: Math.sin(phi) * Math.sin(theta) * spd,
        life: 0,
        maxLife: 1.25 + Math.random() * 0.8
      });
    }
  }

  public resize() {
    const w = Math.max(240, this.container.clientWidth || 540);
    const h = Math.max(240, this.container.clientHeight || 540);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  public start() {
    // Initialize clock from the first rAF callback so elapsed time `t` is NEVER negative in Chromium!
    this.startTime = -1;
    this.lastTime = -1;
    this.onComputeTick?.(this.compute.getSnapshot());
    const loop = (now: number) => {
      if (this.contextLost || (typeof document !== "undefined" && document.hidden)) {
        this.lastTime = -1;
        this.rafId = requestAnimationFrame(loop);
        return;
      }
      if (this.startTime < 0) {
        this.startTime = now;
        this.lastTime = now;
      } else if (this.lastTime < 0) {
        this.lastTime = now;
      }
      const dt = Math.max(0.0001, Math.min(0.05, (now - this.lastTime) / 1000));
      const elapsedSec = Math.max(0, (now - this.startTime) / 1000);
      this.lastTime = now;
      const nextDpr = this.adaptiveDpr.recordFrame(dt);
      if (nextDpr !== null) {
        this.renderer.setPixelRatio(nextDpr);
      }
      this.step(dt, elapsedSec, now);
      this.controls.update();
      this.camera.updateMatrixWorld();
      if (this.walkMode && now - this.lastTelemetryEmitMs >= this.perfProfile.telemetryIntervalMs) {
        this.lastTelemetryEmitMs = now;
        this.emitWalkTelemetry();
      }
      this.renderer.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  public stop() {
    cancelAnimationFrame(this.rafId);
    this.compute.dispose();
    this.renderer.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.removeEventListener("pointerup", this.handlePointerUp);
    this.renderer.domElement.removeEventListener("pointermove", this.handlePointerMove);
    this.renderer.domElement.removeEventListener("webglcontextlost", this.handleContextLost);
    this.renderer.domElement.removeEventListener("webglcontextrestored", this.handleContextRestored);
    this.disposeWalkCampus3D();
    this.disposeCharacterAvatar();
    this.disposeObjectChildren(this.previewGhostGroup);
    this.disposeObjectChildren(this.atmosphereGroup);
    this.atmosphereMotes = [];
    this.clearDynamicGroup();
    this.terrazzoTex.dispose();
    this.titaniumTex.dispose();
    this.blueprintTex.dispose();
    this.aoTex.dispose();
    Object.values(this.floorTextures).forEach((t) => t?.dispose());
    this.floorTextures = {};
    Object.values(this.moodTextures).forEach((t) => t?.dispose());
    this.moodTextures = {};
    this.controls.dispose();
    this.envRT.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  private syncFillTarget() {
    const g = Math.max(0, this.impact.globalImpactEth);
    const personal = Math.max(0, this.impact.tokenImpactEth);
    const prog = Math.min(1, Math.log1p(g * 0.9 + personal * 5) / Math.log1p(22));
    this.targetFill = 0.36 + prog * 0.5;
  }

  private makeGlowSprite(colorHex: string, scale: number, opacity = 0.72): THREE.Sprite {
    const tex = createRadialGlowTexture(colorHex);
    this.glowTextures.push(tex);
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(scale, scale, 1);
    return sp;
  }

  private disposeObjectChildren(parent: THREE.Object3D) {
    const sharedTextures = new Set<THREE.Texture>([
      this.terrazzoTex,
      this.titaniumTex,
      this.blueprintTex,
      this.aoTex,
      ...(Object.values(this.floorTextures).filter(Boolean) as THREE.Texture[]),
      ...(Object.values(this.moodTextures).filter(Boolean) as THREE.Texture[])
    ]);
    parent.traverse((obj) => {
      if (obj === parent) return;
      const meshLike = obj as THREE.Mesh;
      if (meshLike.geometry) {
        meshLike.geometry.dispose();
      }
      if (meshLike.material) {
        const mats = Array.isArray(meshLike.material) ? meshLike.material : [meshLike.material];
        for (const mat of mats) {
          const mAny = mat as unknown as { map?: THREE.Texture | null };
          if (mAny.map && !sharedTextures.has(mAny.map)) {
            mAny.map.dispose();
          }
          mat.dispose();
        }
      }
    });
    while (parent.children.length > 0) {
      parent.remove(parent.children[0]);
    }
  }

  private clearDynamicGroup() {
    this.disposeObjectChildren(this.dynamicGroup);
    this.pavilionGroup = new THREE.Group();
    this.nftTabletopGroup = new THREE.Group();
    this.glowTextures.forEach((t) => t.dispose());
    this.glowTextures = [];
    this.bubbles = [];
    this.vaporRings = [];
    this.nucleusBalls = [];
    this.orbitals = [];
    this.floatingAtoms = [];
    this.condenserDroplets = [];
    this.builtWingGroups = [];
    this.waterRipples = [];
    this.highlightHalo = null;
    this.vialBubbles = [];
    this.residueMeshes = [];
    this.bondCylinders = [];
    this.gyroRings = [];
    this.protonPackets = [];
    this.microAlembics = [];
    this.miningBlades = [];
    this.acceleratorRings = [];
    this.cryoBeacons = [];
    this.cryoHelixes = [];
    this.greenhouseStems = [];
    this.greenhousePollen = [];
    this.spirePulseRing = null;
    this.companions = [];
    this.treats = [];
    this.moodBubbles = [];
    this.wingConduits = [];
    this.toyBall = null;
    this.bursts = [];
    this.proteinChainLength = -1;
    this.proteinRibbonMesh = null;
    this.proteinRibbonCurvePts = [];
    this.liquidMesh = null;
    this.liquidTopMesh = null;
    this.liquidTopBasePos = null;
    this.pavilionFloorMat = null;
    this.heroVesselGroup = null;
    this.waterPoolMesh = null;
    this.causticShaderMat = null;
    this.causticLight = null;
    this.nucleusGroup = null;
    this.manometerNeedle = null;
    this.astrolabeRing = null;
    this.proteinGroup = null;
    this.contactLines = null;
    this.workUnitRing = null;
    this.energyCurveLine = null;
    this.orreryGroup = null;
    this.hypercubeLines = null;
    this.constellationLines = null;
    this.shockwaveRing = null;
  }

  // ---------------------------------------------------------------------------
  // Build Complete 10x Architectural Pavilion + Research-Mining 3D Model
  // ---------------------------------------------------------------------------
  private rebuild3DModel() {
    this.clearDynamicGroup();
    this.builtSeed = this.impact.seed;
    const tier = Math.max(1, Math.min(5, this.impact.complexityTier || 1));
    const sectorsMask = this.impact.sectorsMask ?? 0;
    this.builtTier = tier;
    this.builtSectorsMask = sectorsMask;
    this.builtAccessoryRank = this.getAccessoryRank();

    const pal = this.traits.palette;
    const rng = new SeededRNG(this.traits.seed, 303);

    this.scene.background = new THREE.Color(pal.bgBottom);
    this.scene.fog = new THREE.FogExp2(pal.bgBottom, 0.032);

    this.dynamicGroup.add(this.pavilionGroup);
    this.dynamicGroup.add(this.nftTabletopGroup);

    this.buildArchitecturalPavilion(tier);
    this.buildHeroGlassVesselAndLiquid();
    this.buildAtomicNucleusAndOrbitals(tier, rng);
    this.buildLabInstruments(tier);
    this.buildProteinFoldingChamber3D(tier);
    this.buildFloatingAtoms3D(tier, rng);
    this.buildCompanions3D(tier, sectorsMask);

    // Sims-Style Modular 3D Architectural Lab Wings built onto this NFT!
    if (hasSector(sectorsMask, 0)) {
      this.buildCryoFoldingWing3D();
      this.addWingConduitPulse(new THREE.Vector3(-1.95, 0.72, -1.15), "#38bdf8");
    }
    if (hasSector(sectorsMask, 1)) {
      this.buildQuantumMiningRigWing3D();
      this.addWingConduitPulse(new THREE.Vector3(2.05, 0.85, 0.18), "#6366f1");
    }
    if (hasSector(sectorsMask, 2)) {
      this.buildSolarCatalysisDome3D();
      this.addWingConduitPulse(new THREE.Vector3(-1.85, 0.68, 1.3), "#10b981");
    }
    if (hasSector(sectorsMask, 3)) {
      this.buildCompanionSanctuaryWing3D();
      this.addWingConduitPulse(new THREE.Vector3(1.68, 0.64, 1.4), "#f472b6");
    }
    if (hasSector(sectorsMask, 4)) {
      this.buildProtonAcceleratorSpire3D();
      this.addWingConduitPulse(new THREE.Vector3(1.85, 1.15, -1.35), "#8b5cf6");
    }
    if (hasSector(sectorsMask, 5)) this.buildObservatoryCrown3D();

    if (tier >= 3 || hasSector(sectorsMask, 4)) this.buildCelestialOrrery3D();
    if (tier >= 4) this.buildTwinMicroAlembics3D();
    if (tier >= 5 || hasSector(sectorsMask, 5)) this.buildHypercube4D();

    const swMat = new THREE.MeshBasicMaterial({
      color: pal.electron,
      transparent: true,
      opacity: 0
    });
    this.shockwaveRing = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.018, 12, 64), swMat);
    this.shockwaveRing.rotation.x = Math.PI / 2;
    this.shockwaveRing.position.y = 0.52;
    this.nftTabletopGroup.add(this.shockwaveRing);

    // Zero-GC recycled reflecting-pool porcelain water ripple rings
    for (let w = 0; w < 3; w++) {
      const rMat = new THREE.MeshBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const rMesh = new THREE.Mesh(new THREE.RingGeometry(1.68, 1.72, 64), rMat);
      rMesh.rotation.x = -Math.PI / 2;
      rMesh.position.y = 0.258;
      this.pavilionGroup.add(rMesh);
      this.waterRipples.push({ mesh: rMesh, life: 0 });
    }

    this.applyWalkModeScaleLayout();
    this.optimizeSceneMaterialsForDevice();
  }

  /**
   * Eliminates expensive full-scene WebGL transmission double-render passes in 3D Walk Town mode
   * AND on mobile/Safari/low-core devices, replacing transmission with crisp reflective clearcoat
   * architectural glass for 2x-4x faster frame times across every browser & device!
   */
  private optimizeSceneMaterialsForDevice() {
    if (!this.walkMode && this.perfProfile.enableHeroTransmission) return;
    this.rootGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (mat instanceof THREE.MeshPhysicalMaterial && mat.transmission > 0) {
          mat.transmission = 0;
          mat.thickness = 0;
          mat.dispersion = 0;
          mat.transparent = true;
          mat.opacity = Math.min(mat.opacity >= 0.95 ? 0.44 : mat.opacity, 0.72);
          mat.clearcoat = 1.0;
          mat.clearcoatRoughness = 0.06;
          mat.envMapIntensity = Math.max(mat.envMapIntensity || 1, 1.45);
          mat.needsUpdate = true;
        }
      }
    });
  }

  private addWingConduitPulse(startPos: THREE.Vector3, colorHex: string) {
    const mid = startPos.clone().multiplyScalar(0.5);
    mid.y += 0.34;
    const end = new THREE.Vector3(0, 0.54, 0);
    const curve = new THREE.CatmullRomCurve3([startPos, mid, end]);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 22, 0.012, 8, false),
      new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.34 })
    );
    this.nftTabletopGroup.add(tube);

    const pulseGeo = new THREE.SphereGeometry(0.036, 10, 10);
    const pulseMat = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      emissive: colorHex,
      emissiveIntensity: 1.4
    });
    for (let k = 0; k < 2; k++) {
      const m = new THREE.Mesh(pulseGeo, pulseMat);
      m.add(this.makeGlowSprite(colorHex, 0.24, 0.68));
      this.nftTabletopGroup.add(m);
      this.wingConduits.push({ mesh: m, curve, t: k * 0.5, speed: 0.38 });
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Honed Alabaster Pavilion, Reflecting Water Basin, Brise-Soleil & Botanical Planter
  // ---------------------------------------------------------------------------
  private buildArchitecturalPavilion(tier: number) {
    const pal = this.traits.palette;

    const alabasterMat = new THREE.MeshStandardMaterial({
      map: this.terrazzoTex,
      color: "#f4f7fb",
      roughness: 0.44,
      metalness: 0.05
    });
    this.pavilionFloorMat = alabasterMat;
    this.applyFloorFinish();
    const titaniumMat = new THREE.MeshStandardMaterial({
      map: this.titaniumTex,
      color: "#cfd9e6",
      roughness: 0.2,
      metalness: 0.9
    });
    const slateMat = new THREE.MeshStandardMaterial({
      color: "#435166",
      roughness: 0.32,
      metalness: 0.74
    });
    const edgeLineMat = new THREE.LineBasicMaterial({
      color: "#94a3b8",
      transparent: true,
      opacity: 0.85
    });

    // Two-tier chamfered architectural terrazzo site base
    const subBaseGeo = new THREE.BoxGeometry(4.85, 0.12, 4.85);
    const subBase = new THREE.Mesh(subBaseGeo, alabasterMat);
    subBase.position.y = 0.06;
    subBase.castShadow = true;
    subBase.receiveShadow = true;
    this.pavilionGroup.add(subBase);

    const subEdges = new THREE.LineSegments(new THREE.EdgesGeometry(subBaseGeo), edgeLineMat);
    subEdges.position.copy(subBase.position);
    this.pavilionGroup.add(subEdges);

    // Upper architectural terrace slab with recessed perimeter shadow groove
    const mainSlabGeo = new THREE.BoxGeometry(4.45, 0.11, 4.45);
    const mainSlab = new THREE.Mesh(mainSlabGeo, alabasterMat);
    mainSlab.position.y = 0.175;
    mainSlab.castShadow = true;
    mainSlab.receiveShadow = true;
    this.pavilionGroup.add(mainSlab);

    const mainEdges = new THREE.LineSegments(new THREE.EdgesGeometry(mainSlabGeo), edgeLineMat);
    mainEdges.position.copy(mainSlab.position);
    this.pavilionGroup.add(mainEdges);

    // Subtle warm-opal architectural cove light tucked into perimeter shadow reveal
    const coveMat = new THREE.MeshBasicMaterial({
      color: pal.liquidTop,
      transparent: true,
      opacity: 0.45
    });
    const coveBox = new THREE.Mesh(new THREE.BoxGeometry(4.52, 0.024, 4.52), coveMat);
    coveBox.position.y = 0.125;
    this.pavilionGroup.add(coveBox);

    // Architectural corner stainless survey pins
    for (const sx of [-2.28, 2.28]) {
      for (const sz of [-2.28, 2.28]) {
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.24, 14), titaniumMat);
        pin.position.set(sx, 0.12, sz);
        this.pavilionGroup.add(pin);
      }
    }

    // Recessed Architectural Reflecting Water Pool wrapping around the circular rotunda!
    const poolBasin = new THREE.Mesh(
      new THREE.RingGeometry(1.88, 2.15, 64),
      new THREE.MeshPhysicalMaterial({
        color: pal.liquidTop,
        emissive: pal.liquidMid,
        emissiveIntensity: 0.18,
        roughness: 0.05,
        metalness: 0.15,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        transparent: true,
        opacity: 0.72
      })
    );
    poolBasin.rotation.x = -Math.PI / 2;
    poolBasin.position.y = 0.236;
    this.waterPoolMesh = poolBasin;
    this.pavilionGroup.add(poolBasin);

    // Stepped circular porcelain rotunda platform
    const rotunda = new THREE.Mesh(new THREE.CylinderGeometry(1.86, 1.94, 0.16, 64), alabasterMat);
    rotunda.position.y = 0.31;
    rotunda.castShadow = true;
    rotunda.receiveShadow = true;
    this.pavilionGroup.add(rotunda);

    // Architectural titanium rim coping around the rotunda edge
    const rotundaRim = new THREE.Mesh(new THREE.TorusGeometry(1.86, 0.018, 10, 72), titaniumMat);
    rotundaRim.rotation.x = Math.PI / 2;
    rotundaRim.position.y = 0.39;
    this.pavilionGroup.add(rotundaRim);

    // Recessed glowing laboratory ring inlaid into rotunda floor
    const glowRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.66, 0.016, 12, 80),
      new THREE.MeshStandardMaterial({
        color: pal.liquidTop,
        emissive: pal.liquidMid,
        emissiveIntensity: 0.9 + tier * 0.15,
        roughness: 0.2
      })
    );
    glowRing.rotation.x = Math.PI / 2;
    glowRing.position.y = 0.392;
    this.pavilionGroup.add(glowRing);

    // Rotating engraved titanium astrolabe compass dial inlaid on floor
    const astroGroup = new THREE.Group();
    astroGroup.position.y = 0.396;
    const outerDial = new THREE.Mesh(new THREE.TorusGeometry(1.46, 0.012, 8, 72), titaniumMat);
    outerDial.rotation.x = Math.PI / 2;
    astroGroup.add(outerDial);
    const innerDial = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.01, 8, 64), slateMat);
    innerDial.rotation.x = Math.PI / 2;
    astroGroup.add(innerDial);
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const major = i % 3 === 0;
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.008, major ? 0.16 : 0.075),
        major ? slateMat : titaniumMat
      );
      tick.position.set(Math.cos(a) * 1.38, 0, Math.sin(a) * 1.38);
      tick.rotation.y = -a + Math.PI / 2;
      astroGroup.add(tick);
    }
    this.astrolabeRing = astroGroup;
    this.pavilionGroup.add(astroGroup);

    // Architectural Entrance Steps bridging over the reflecting pool into the rotunda!
    for (let s = 0; s < 3; s++) {
      const stepW = 1.24 - s * 0.14;
      const stepGeo = new THREE.BoxGeometry(stepW, 0.055, 0.22);
      const stepMesh = new THREE.Mesh(stepGeo, alabasterMat);
      stepMesh.position.set(0, 0.255 + s * 0.055, 2.08 - s * 0.15);
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      this.pavilionGroup.add(stepMesh);
      const sEdge = new THREE.LineSegments(new THREE.EdgesGeometry(stepGeo), edgeLineMat);
      sEdge.position.copy(stepMesh.position);
      this.pavilionGroup.add(sEdge);
    }

    // Modernist Architectural Cutaway Colonnade + Brise-Soleil Frosted Glass Louver Fins
    const frostedFinMat = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      transmission: 0.76,
      roughness: 0.2,
      metalness: 0.02,
      ior: 1.46,
      thickness: 0.08,
      transparent: true,
      opacity: 0.9
    });

    const colH = tier >= 2 ? 2.58 : 2.32;
    // 4 primary structural brushed-titanium columns
    const colAngles = [-Math.PI * 0.88, -Math.PI * 0.63, -Math.PI * 0.37, -Math.PI * 0.12];
    for (const ang of colAngles) {
      const cx = Math.cos(ang) * 1.76;
      const cz = Math.sin(ang) * 1.76;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, colH, 16), titaniumMat);
      col.position.set(cx, 0.39 + colH / 2, cz);
      col.castShadow = true;
      this.pavilionGroup.add(col);

      const baseFoot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.14), alabasterMat);
      baseFoot.position.set(cx, 0.42, cz);
      this.pavilionGroup.add(baseFoot);
    }

    // 11 Sculptural Vertical Frosted-Glass Brise-Soleil Architectural Fins along the rear curve
    for (let f = 0; f < 11; f++) {
      const ang = -Math.PI * 0.84 + (f / 10) * (Math.PI * 0.68);
      const fx = Math.cos(ang) * 1.78;
      const fz = Math.sin(ang) * 1.78;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.028, colH * 0.88, 0.19), frostedFinMat);
      fin.position.set(fx, 0.39 + (colH * 0.88) / 2 + 0.05, fz);
      fin.rotation.y = -ang + Math.PI * 0.14;
      fin.castShadow = true;
      this.pavilionGroup.add(fin);
    }

    // Cantilevered Double-Ring Modernist Skylight Roof Canopy + Radial Skylight Ribs
    const roofY = 0.39 + colH + 0.04;
    const roofMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.96, 2.02, 48, 1, Math.PI * 0.1, Math.PI * 0.8),
      alabasterMat
    );
    roofMesh.rotation.x = -Math.PI / 2;
    roofMesh.position.y = roofY;
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    this.pavilionGroup.add(roofMesh);

    // Subtle roof edge thickness fascia
    const fascia = new THREE.Mesh(
      new THREE.CylinderGeometry(2.02, 2.02, 0.07, 48, 1, true, Math.PI * 0.6, Math.PI * 0.8),
      alabasterMat
    );
    fascia.position.y = roofY - 0.035;
    this.pavilionGroup.add(fascia);

    for (const rRad of [0.96, 2.02]) {
      const rTrim = new THREE.Mesh(
        new THREE.TorusGeometry(rRad, 0.022, 10, 48, Math.PI * 0.8),
        titaniumMat
      );
      rTrim.rotation.x = Math.PI / 2;
      rTrim.rotation.z = Math.PI * 1.1;
      rTrim.position.y = roofY;
      this.pavilionGroup.add(rTrim);
    }

    // Curved Glass Mezzanine Balustrade wrapping the back-left arc
    const rail = new THREE.Mesh(
      new THREE.TorusGeometry(1.66, 0.014, 8, 36, Math.PI * 0.42),
      titaniumMat
    );
    rail.rotation.x = Math.PI / 2;
    rail.rotation.z = Math.PI * 1.05;
    rail.position.y = 0.72;
    this.pavilionGroup.add(rail);

    // Signature Architect-Model Detail: Miniature Sculptural Botanical Planter on Rear Terrace Corner!
    const planter = new THREE.Group();
    planter.position.set(-1.72, 0.23, 1.68);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.22, 20), alabasterMat);
    pot.position.y = 0.11;
    pot.castShadow = true;
    planter.add(pot);
    const soil = new THREE.Mesh(
      new THREE.CircleGeometry(0.19, 18),
      new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.8 })
    );
    soil.rotation.x = -Math.PI / 2;
    soil.position.y = 0.215;
    planter.add(soil);
    // Stylized sculpted ceramic-silver bonsai sprigs
    const stemMat = new THREE.MeshStandardMaterial({ color: "#64748b", roughness: 0.45 });
    const leafMat = new THREE.MeshStandardMaterial({
      color: "#e2e8f0",
      emissive: pal.liquidTop,
      emissiveIntensity: 0.15,
      roughness: 0.32
    });
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.2, 0),
      new THREE.Vector3(0.04, 0.36, -0.02),
      new THREE.Vector3(-0.02, 0.54, 0.03)
    ]);
    planter.add(new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 12, 0.02, 8, false), stemMat));
    for (const [lx, ly, lz, lr] of [
      [-0.03, 0.56, 0.03, 0.12],
      [0.09, 0.44, -0.04, 0.095],
      [-0.1, 0.42, -0.02, 0.085]
    ]) {
      const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(lr, 1), leafMat);
      canopy.position.set(lx, ly, lz);
      canopy.scale.set(1.2, 0.65, 1.1);
      canopy.castShadow = true;
      planter.add(canopy);
    }
    this.pavilionGroup.add(planter);

    // Colored glass caustic light washing gently over the white architectural walls!
    const causticLight = new THREE.PointLight(pal.liquidMid, 1.85 + tier * 0.25, 6.8);
    causticLight.position.set(0, 1.35, 0.15);
    this.causticLight = causticLight;
    this.nftTabletopGroup.add(causticLight);

    // Real GLSL Procedural Borosilicate Caustic Shimmer projected softly onto the white terrazzo rotunda!
    const causticMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uColorA: { value: new THREE.Color(pal.liquidTop) },
        uColorB: { value: new THREE.Color(pal.electron) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying vec2 vUv;
        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          if (r > 1.0) discard;
          float a = atan(p.y, p.x);
          float w1 = sin(r * 16.0 - uTime * 2.2 + sin(a * 5.0 + uTime * 0.9) * 1.4);
          float w2 = cos(r * 22.0 + uTime * 1.7 + cos(a * 7.0 - uTime * 1.1) * 1.2);
          float net = pow(max(0.0, 0.5 + 0.5 * w1 * w2), 3.0);
          float ringMask = smoothstep(0.32, 0.58, r) * (1.0 - smoothstep(0.72, 1.0, r));
          vec3 col = mix(uColorA, uColorB, 0.5 + 0.5 * sin(a * 2.0 + uTime));
          float alpha = net * ringMask * 0.24;
          gl_FragColor = vec4(col, alpha);
        }
      `
    });
    const causticDisc = new THREE.Mesh(new THREE.PlaneGeometry(3.15, 3.15), causticMat);
    causticDisc.rotation.x = -Math.PI / 2;
    causticDisc.position.y = 0.394;
    this.causticShaderMat = causticMat;
    this.pavilionGroup.add(causticDisc);
    this.applyLightingMood();

    // Central raised titanium induction reactor plinth under the hero flask
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.76, 0.12, 48), titaniumMat);
    pad.position.y = 0.45;
    pad.castShadow = true;
    pad.receiveShadow = true;
    this.nftTabletopGroup.add(pad);

    const coilRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.54, 0.02, 12, 48),
      new THREE.MeshStandardMaterial({
        color: pal.electron,
        emissive: pal.electron,
        emissiveIntensity: 1.25
      })
    );
    coilRing.rotation.x = Math.PI / 2;
    coilRing.position.y = 0.515;
    this.nftTabletopGroup.add(coilRing);
  }

  // ---------------------------------------------------------------------------
  // 2. 5 Seeded Borosilicate 3D Glass Vessels + Vertex-Rippling Liquid + Vapor Rings
  // ---------------------------------------------------------------------------
  private getVesselProfile(idx: number): THREE.Vector2[] {
    if (idx === 0) {
      return [
        new THREE.Vector2(0.001, 0.0),
        new THREE.Vector2(0.58, 0.0),
        new THREE.Vector2(0.66, 0.14),
        new THREE.Vector2(0.45, 0.65),
        new THREE.Vector2(0.22, 1.18),
        new THREE.Vector2(0.22, 1.72),
        new THREE.Vector2(0.28, 1.78)
      ];
    }
    if (idx === 1) {
      const pts: THREE.Vector2[] = [new THREE.Vector2(0.001, 0.0), new THREE.Vector2(0.36, 0.0)];
      for (let i = 0; i <= 14; i++) {
        const a = -Math.PI * 0.36 + (i / 14) * Math.PI * 0.78;
        pts.push(new THREE.Vector2(Math.max(0.2, Math.cos(a) * 0.68), 0.56 + Math.sin(a) * 0.58));
      }
      pts.push(new THREE.Vector2(0.21, 1.72), new THREE.Vector2(0.27, 1.78));
      return pts;
    }
    if (idx === 2) {
      return [
        new THREE.Vector2(0.001, 0.0),
        new THREE.Vector2(0.44, 0.0),
        new THREE.Vector2(0.64, 0.42),
        new THREE.Vector2(0.56, 1.48),
        new THREE.Vector2(0.62, 1.62)
      ];
    }
    if (idx === 3) {
      return [
        new THREE.Vector2(0.001, 0.0),
        new THREE.Vector2(0.48, 0.0),
        new THREE.Vector2(0.64, 0.34),
        new THREE.Vector2(0.32, 0.72),
        new THREE.Vector2(0.52, 1.06),
        new THREE.Vector2(0.22, 1.38),
        new THREE.Vector2(0.22, 1.74),
        new THREE.Vector2(0.28, 1.8)
      ];
    }
    return [
      new THREE.Vector2(0.001, 0.0),
      new THREE.Vector2(0.56, 0.0),
      new THREE.Vector2(0.64, 0.2),
      new THREE.Vector2(0.38, 0.72),
      new THREE.Vector2(0.5, 1.02),
      new THREE.Vector2(0.26, 1.35),
      new THREE.Vector2(0.2, 1.78),
      new THREE.Vector2(0.26, 1.84)
    ];
  }

  private buildHeroGlassVesselAndLiquid() {
    const pal = this.traits.palette;
    const vIdx = this.traits.vesselIdx;
    const segments = vIdx === 2 ? 8 : 52;
    const profile = this.getVesselProfile(vIdx);

    const vesselGroup = new THREE.Group();
    vesselGroup.position.y = 0.52;
    vesselGroup.scale.setScalar(this.traits.sub.vesselScale);
    this.heroVesselGroup = vesselGroup;

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      transmission: 0.93,
      opacity: 1,
      transparent: true,
      roughness: 0.03,
      metalness: 0.01,
      ior: 1.47,
      thickness: 0.44,
      dispersion: 0.22,
      iridescence: 0.22,
      iridescenceIOR: 1.3,
      specularIntensity: 1.0,
      attenuationColor: new THREE.Color("#e8f1fb"),
      attenuationDistance: 1.35,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.6,
      side: THREE.DoubleSide
    });

    const outerMesh = new THREE.Mesh(new THREE.LatheGeometry(profile, segments), glassMat);
    outerMesh.castShadow = true;
    vesselGroup.add(outerMesh);

    const silverMat = new THREE.MeshStandardMaterial({
      map: this.titaniumTex,
      color: "#cbd5e1",
      roughness: 0.2,
      metalness: 0.9
    });
    const neckY = vIdx === 2 ? 1.56 : 1.46;
    const neckR = vIdx === 2 ? 0.59 : 0.245;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(neckR, 0.024, 14, 48), silverMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = neckY;
    vesselGroup.add(collar);

    // Precision etched volumetric graduation ticks
    for (let i = 0; i < 5; i++) {
      const gy = 0.28 + i * 0.21;
      const tickRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.56 - i * 0.055, 0.0045, 6, 36, Math.PI * 0.42),
        new THREE.MeshBasicMaterial({ color: "#64748b", transparent: true, opacity: 0.48 })
      );
      tickRing.rotation.x = Math.PI / 2;
      tickRing.rotation.z = -Math.PI * 0.21;
      tickRing.position.y = gy;
      vesselGroup.add(tickRing);
    }

    // Volumetric glowing elixir interior
    const innerProfile = profile
      .filter((p) => p.y <= 1.12)
      .map((p) => new THREE.Vector2(Math.max(0.001, p.x * 0.88), p.y + 0.03));
    if (innerProfile.length < 3) innerProfile.push(new THREE.Vector2(0.42, 0.95));

    const liqMesh = new THREE.Mesh(
      new THREE.LatheGeometry(innerProfile, segments),
      new THREE.MeshPhysicalMaterial({
        color: pal.liquidMid,
        emissive: pal.liquidBottom,
        emissiveIntensity: 0.56,
        roughness: 0.1,
        metalness: 0.08,
        transmission: 0.24,
        transparent: true,
        opacity: 0.92,
        clearcoat: 1.0
      })
    );
    this.liquidMesh = liqMesh;
    vesselGroup.add(liqMesh);

    // True Vertex-Rippling 3D Liquid Meniscus Surface!
    const topGeo = new THREE.CircleGeometry(0.43, 36);
    // Add concentric ring subdivisions for silky 3D ripple waves
    const waveGeo = new THREE.RingGeometry(0.001, 0.43, 36, 6);
    topGeo.dispose();
    const topDisc = new THREE.Mesh(
      waveGeo,
      new THREE.MeshPhysicalMaterial({
        color: pal.liquidTop,
        emissive: pal.liquidTop,
        emissiveIntensity: 0.55,
        roughness: 0.08,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide
      })
    );
    topDisc.rotation.x = -Math.PI / 2;
    topDisc.position.y = 0.65;
    this.liquidTopBasePos = new Float32Array(
      (waveGeo.getAttribute("position") as THREE.BufferAttribute).array
    );
    this.liquidTopMesh = topDisc;
    vesselGroup.add(topDisc);

    // 22 Rising 3D Pearl Bubbles
    const bGeo = new THREE.SphereGeometry(1, 12, 12);
    const bMat = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      emissive: pal.liquidTop,
      emissiveIntensity: 0.45,
      roughness: 0.05,
      transparent: true,
      opacity: 0.76
    });
    const rng = new SeededRNG(this.traits.seed, 555);
    for (let i = 0; i < 22; i++) {
      const m = new THREE.Mesh(bGeo, bMat);
      m.scale.setScalar(rng.range(0.018, 0.044));
      const ang = rng.range(0, Math.PI * 2);
      const rad = rng.range(0.05, 0.36);
      const y = rng.range(0.08, 0.88);
      m.position.set(Math.cos(ang) * rad, y, Math.sin(ang) * rad);
      vesselGroup.add(m);
      this.bubbles.push({
        mesh: m,
        baseX: Math.cos(ang) * rad,
        baseZ: Math.sin(ang) * rad,
        y,
        speed: rng.range(0.2, 0.5),
        phase: rng.range(0, Math.PI * 2)
      });
    }

    // Rising Translucent Alchemical Vapor Rings floating out of flask mouth
    for (let v = 0; v < 4; v++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.16, 0.008, 8, 32),
        new THREE.MeshBasicMaterial({
          color: pal.liquidTop,
          transparent: true,
          opacity: 0.35
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 1.85;
      vesselGroup.add(ring);
      this.vaporRings.push({ mesh: ring, age: v * 0.75, maxAge: 3.0 });
    }

    this.nftTabletopGroup.add(vesselGroup);
  }

  // ---------------------------------------------------------------------------
  // 3. 3D Glowing Atomic Nucleus (with Soft Bloom Sprite) & Tilted Orbitals
  // ---------------------------------------------------------------------------
  private buildAtomicNucleusAndOrbitals(tier: number, rng: SeededRNG) {
    const pal = this.traits.palette;

    const nucGroup = new THREE.Group();
    nucGroup.position.set(0, 1.12, 0);
    nucGroup.add(this.makeGlowSprite(pal.liquidTop, 0.92, 0.58));

    const protonMat = new THREE.MeshStandardMaterial({
      color: pal.proton,
      emissive: pal.proton,
      emissiveIntensity: 0.95,
      roughness: 0.16,
      metalness: 0.25
    });
    const neutronMat = new THREE.MeshStandardMaterial({
      color: "#e2e8f0",
      emissive: "#94a3b8",
      emissiveIntensity: 0.28,
      roughness: 0.2,
      metalness: 0.8
    });
    const ballGeo = new THREE.SphereGeometry(0.072, 16, 16);
    const totalN = this.traits.sub.protonCount + this.traits.sub.neutronCount;

    for (let i = 0; i < totalN; i++) {
      const isProton = i < this.traits.sub.protonCount;
      const m = new THREE.Mesh(ballGeo, isProton ? protonMat : neutronMat);
      const phi = Math.acos(1 - (2 * (i + 0.5)) / totalN);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = i === 0 ? 0 : rng.range(0.09, 0.175);
      const base = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * r,
        Math.cos(phi) * r,
        Math.sin(phi) * Math.sin(theta) * r
      );
      m.position.copy(base);
      nucGroup.add(m);
      this.nucleusBalls.push({ mesh: m, base, phase: rng.range(0, Math.PI * 2) });
    }
    this.nucleusGroup = nucGroup;
    this.nftTabletopGroup.add(nucGroup);

    const orbitalCount = Math.min(6, this.traits.sub.orbitalCount + (tier >= 3 ? tier - 2 : 0));
    const eGeo = new THREE.SphereGeometry(0.05, 16, 16);
    const tGeo = new THREE.SphereGeometry(0.026, 10, 10);

    for (let i = 0; i < orbitalCount; i++) {
      const radius = 1.14 + (i % 3) * 0.2;
      const ringCol = i % 2 === 0 ? pal.electron : pal.accent;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.0085, 10, 96),
        new THREE.MeshStandardMaterial({
          color: ringCol,
          emissive: ringCol,
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.65,
          roughness: 0.22
        })
      );
      ring.position.set(0, 1.56, 0);
      ring.rotation.set(
        Math.PI * 0.32 + i * 0.52,
        (i * Math.PI) / orbitalCount,
        this.traits.sub.astrolabeTilt + i * 0.38
      );
      this.nftTabletopGroup.add(ring);

      const electron = new THREE.Mesh(
        eGeo,
        new THREE.MeshStandardMaterial({
          color: "#ffffff",
          emissive: ringCol,
          emissiveIntensity: 1.5,
          roughness: 0.08
        })
      );
      electron.add(this.makeGlowSprite(ringCol, 0.38, 0.78));
      ring.add(electron);

      const trail: THREE.Mesh[] = [];
      for (let k = 0; k < 4; k++) {
        const tm = new THREE.Mesh(
          tGeo,
          new THREE.MeshBasicMaterial({
            color: ringCol,
            transparent: true,
            opacity: 0.55 - k * 0.12
          })
        );
        tm.scale.setScalar(1 - k * 0.18);
        ring.add(tm);
        trail.push(tm);
      }

      this.orbitals.push({
        ring,
        electron,
        trail,
        radius,
        speed: 1.05 + i * 0.26,
        phase: i * 1.7
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Coiled Liebig Glass Condensers, Stopcocks, Test-Tube Rack & Manometer
  // ---------------------------------------------------------------------------
  private buildLabInstruments(tier: number) {
    const pal = this.traits.palette;
    const silverMat = new THREE.MeshStandardMaterial({
      map: this.titaniumTex,
      color: "#d4dce8",
      roughness: 0.2,
      metalness: 0.9
    });
    const darkMetal = new THREE.MeshStandardMaterial({
      color: "#475569",
      roughness: 0.34,
      metalness: 0.74
    });
    const tubeGlassMat = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      transmission: 0.88,
      roughness: 0.06,
      ior: 1.48,
      thickness: 0.14,
      transparent: true
    });

    const primarySide = this.traits.sub.companionSide === "right" ? -1 : 1;
    const sides = tier >= 2 ? [-1, 1] : [primarySide];

    for (const side of sides) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.22, 2.06, 0),
        new THREE.Vector3(side * 0.74, 2.16, -0.22),
        new THREE.Vector3(side * 1.06, 1.7, -0.14),
        new THREE.Vector3(side * 0.96, 1.12, 0.16),
        new THREE.Vector3(side * 1.16, 0.68, 0.06)
      ]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 44, 0.044, 14, false), tubeGlassMat);
      this.nftTabletopGroup.add(tube);

      // Precision titanium stopcock valve cuff halfway along condenser
      const midPt = curve.getPointAt(0.48);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.07, 16), silverMat);
      cuff.position.copy(midPt);
      this.nftTabletopGroup.add(cuff);

      // Glass receiving catch-bulb at condenser outlet
      const endPt = curve.getPointAt(1);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 18), tubeGlassMat);
      bulb.position.set(endPt.x, endPt.y - 0.12, endPt.z);
      this.nftTabletopGroup.add(bulb);

      for (let d = 0; d < 2; d++) {
        const drop = new THREE.Mesh(
          new THREE.SphereGeometry(0.032, 12, 12),
          new THREE.MeshStandardMaterial({
            color: d === 0 ? pal.liquidTop : pal.accent,
            emissive: d === 0 ? pal.liquidMid : pal.accent,
            emissiveIntensity: 0.95
          })
        );
        this.nftTabletopGroup.add(drop);
        this.condenserDroplets.push({ mesh: drop, curve, offset: d * 0.5 + (side === 1 ? 0.25 : 0) });
      }
    }

    // 3D Architectural Laboratory Manometer Gauge on Titanium Mast
    const mastGroup = new THREE.Group();
    mastGroup.position.set(1.22, 0.39, -0.82);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 1.98, 12), silverMat);
    pole.position.y = 0.99;
    pole.castShadow = true;
    mastGroup.add(pole);

    const dialCase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 32), silverMat);
    dialCase.rotation.x = Math.PI / 2;
    dialCase.position.set(0, 1.98, 0.03);
    dialCase.castShadow = true;
    mastGroup.add(dialCase);

    const dialFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.21, 32),
      new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.35 })
    );
    dialFace.position.set(0, 1.98, 0.075);
    mastGroup.add(dialFace);

    const needlePivot = new THREE.Group();
    needlePivot.position.set(0, 1.98, 0.082);
    const needle = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 0.16, 0.01),
      new THREE.MeshStandardMaterial({ color: pal.proton, emissive: pal.proton, emissiveIntensity: 0.55 })
    );
    needle.position.y = 0.06;
    needlePivot.add(needle);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.018, 12), darkMetal);
    cap.rotation.x = Math.PI / 2;
    needlePivot.add(cap);
    mastGroup.add(needlePivot);
    this.manometerNeedle = needlePivot;
    this.nftTabletopGroup.add(mastGroup);

    // Floating 3D Live Energy Minimization Ribbon
    const eGeo = new THREE.BufferGeometry();
    eGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(48 * 3), 3));
    const eLine = new THREE.Line(
      eGeo,
      new THREE.LineBasicMaterial({ color: pal.liquidMid, transparent: true, opacity: 0.85 })
    );
    eLine.position.set(-1.35, 2.46, -0.82);
    this.energyCurveLine = eLine;
    this.nftTabletopGroup.add(eLine);

    // 3D Miniature Reagent Test-Tube Rack on the Rotunda
    const isDuo = this.traits.familiar.species === "Duo" || tier >= 4;
    const rackX = isDuo ? 0 : this.traits.sub.companionSide === "right" ? -1.16 : 1.16;
    const rackZ = isDuo ? -1.08 : 0.44;
    const rack = new THREE.Group();
    rack.position.set(rackX, 0.39, rackZ);
    rack.rotation.y = isDuo ? 0 : rackX < 0 ? 0.45 : -0.45;

    const shelfBot = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.03, 0.18), silverMat);
    shelfBot.position.y = 0.015;
    shelfBot.castShadow = true;
    rack.add(shelfBot);
    const shelfTop = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.024, 0.16), silverMat);
    shelfTop.position.y = 0.34;
    rack.add(shelfTop);
    for (const sx of [-0.3, 0.3]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.34, 10), darkMetal);
      post.position.set(sx, 0.17, 0);
      rack.add(post);
    }

    const vialCols = [pal.accent, pal.electron, pal.proton];
    const vialHeights = [0.54, 0.66, 0.48];
    for (let i = 0; i < 3; i++) {
      const vx = (i - 1) * 0.19;
      const vh = vialHeights[i];
      const vGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, vh, 16), tubeGlassMat);
      vGlass.position.set(vx, vh / 2 + 0.03, 0);
      vGlass.castShadow = true;
      rack.add(vGlass);

      const vLiq = new THREE.Mesh(
        new THREE.CylinderGeometry(0.044, 0.044, vh * 0.58, 14),
        new THREE.MeshStandardMaterial({
          color: vialCols[i],
          emissive: vialCols[i],
          emissiveIntensity: 0.48,
          roughness: 0.16
        })
      );
      vLiq.position.set(vx, (vh * 0.58) / 2 + 0.04, 0);
      rack.add(vLiq);

      const vb = new THREE.Mesh(
        new THREE.SphereGeometry(0.016, 8, 8),
        new THREE.MeshBasicMaterial({ color: "#ffffff" })
      );
      vb.position.set(vx, 0.08, 0);
      rack.add(vb);
      this.vialBubbles.push({ mesh: vb, baseY: 0.07, maxH: vh * 0.54, speed: 0.18 + i * 0.06 });
    }
    this.nftTabletopGroup.add(rack);
  }

  // ---------------------------------------------------------------------------
  // 5. Real 3D Ball-and-Stick AB-Model Protein Folding Chamber + Proton Stream
  // ---------------------------------------------------------------------------
  private buildProteinFoldingChamber3D(tier: number) {
    const pal = this.traits.palette;
    const pGroup = new THREE.Group();
    pGroup.position.set(0, 3.06, 0);

    const baseRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.64, 0.01, 10, 64),
      new THREE.MeshStandardMaterial({ color: "#94a3b8", roughness: 0.22, metalness: 0.88 })
    );
    baseRing.rotation.x = Math.PI / 2;
    pGroup.add(baseRing);

    const wuRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.7, 0.018, 12, 64),
      new THREE.MeshStandardMaterial({
        color: pal.electron,
        emissive: pal.electron,
        emissiveIntensity: 0.95
      })
    );
    wuRing.rotation.x = Math.PI / 2;
    this.workUnitRing = wuRing;
    pGroup.add(wuRing);

    if (tier >= 2) {
      for (let g = 0; g < 2; g++) {
        const gr = new THREE.Mesh(
          new THREE.TorusGeometry(0.78 + g * 0.07, 0.011, 10, 64),
          new THREE.MeshStandardMaterial({
            color: g === 0 ? pal.accent : "#d4af37",
            emissive: g === 0 ? pal.accent : "#d4af37",
            emissiveIntensity: 0.4,
            roughness: 0.18,
            metalness: 0.88
          })
        );
        gr.rotation.set(g === 0 ? 0.7 : -0.7, g * 1.1, 0);
        pGroup.add(gr);
        this.gyroRings.push(gr);
      }
    }

    const snap = this.compute.getSnapshot();
    this.proteinGroup = pGroup;
    this.rebuildProteinChainMeshes(snap.residues);

    // Luminous Hydrophobic & Salt-Bridge Contact Bridges
    const cGeo = new THREE.BufferGeometry();
    cGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(120 * 6), 3));
    const cLines = new THREE.LineSegments(
      cGeo,
      new THREE.LineBasicMaterial({ color: pal.accent, transparent: true, opacity: 0.36 })
    );
    this.contactLines = cLines;
    pGroup.add(cLines);

    this.nftTabletopGroup.add(pGroup);

    // Helical Proton Compute Stream rising from nucleus to folding chamber
    const pktGeo = new THREE.SphereGeometry(0.032, 10, 10);
    for (let i = 0; i < 8; i++) {
      const col = i % 2 === 0 ? pal.electron : pal.proton;
      const m = new THREE.Mesh(
        pktGeo,
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.2 })
      );
      m.add(this.makeGlowSprite(col, 0.24, 0.65));
      this.nftTabletopGroup.add(m);
      this.protonPackets.push({ mesh: m, t: i / 8, speed: 0.34 + (i % 3) * 0.06 });
    }
  }

  private rebuildProteinChainMeshes(residues: ResidueNode[]) {
    if (!this.proteinGroup) return;
    const pal = this.traits.palette;

    for (const m of this.residueMeshes) {
      this.proteinGroup.remove(m);
    }
    for (const c of this.bondCylinders) {
      this.proteinGroup.remove(c);
    }
    if (this.proteinRibbonMesh) {
      this.proteinGroup.remove(this.proteinRibbonMesh);
      this.proteinRibbonMesh.geometry.dispose();
      (this.proteinRibbonMesh.material as THREE.Material).dispose();
      this.proteinRibbonMesh = null;
    }
    this.residueMeshes = [];
    this.bondCylinders = [];
    this.proteinRibbonCurvePts = residues.map(() => new THREE.Vector3());
    this.smoothResiduePos = residues.map(() => new THREE.Vector3());
    this.lastRibbonSnapshotPos = residues.map(() => new THREE.Vector3(999, 999, 999));
    this.proteinInitialized = false;
    this.cachedSSCodes = [];
    this.cachedSSEnergyKey = "";
    this.proteinChainLength = residues.length;
    this.lastRibbonUpdateMs = 0;

    const sphereR = residues.length > 26 ? 0.044 : 0.056;
    const resGeo = new THREE.SphereGeometry(sphereR, 16, 16);
    const hydroMat = new THREE.MeshStandardMaterial({
      color: pal.proton,
      emissive: pal.proton,
      emissiveIntensity: 0.56,
      roughness: 0.18,
      metalness: 0.3
    });
    const aromaticMat = new THREE.MeshStandardMaterial({
      color: "#f5c26b",
      emissive: "#d97706",
      emissiveIntensity: 0.45,
      roughness: 0.14,
      metalness: 0.55
    });
    const positiveMat = new THREE.MeshStandardMaterial({
      color: pal.electron,
      emissive: pal.electron,
      emissiveIntensity: 0.58,
      roughness: 0.16,
      metalness: 0.35
    });
    const negativeMat = new THREE.MeshStandardMaterial({
      color: pal.accent,
      emissive: pal.accent,
      emissiveIntensity: 0.52,
      roughness: 0.16,
      metalness: 0.35
    });
    const polarMat = new THREE.MeshStandardMaterial({
      color: "#e2e8f0",
      emissive: pal.liquidTop,
      emissiveIntensity: 0.24,
      roughness: 0.2,
      metalness: 0.65
    });

    for (const r of residues) {
      const mat = r.aromatic
        ? aromaticMat
        : r.charge > 0
          ? positiveMat
          : r.charge < 0
            ? negativeMat
            : r.hydrophobic
              ? hydroMat
              : polarMat;
      const m = new THREE.Mesh(resGeo, mat);
      m.scale.setScalar(r.aromatic ? 1.15 : r.hydrophobic ? 1.05 : 0.92);
      m.castShadow = true;
      this.proteinGroup.add(m);
      this.residueMeshes.push(m);
    }

    const bondGeo = new THREE.CylinderGeometry(residues.length > 26 ? 0.012 : 0.015, residues.length > 26 ? 0.012 : 0.015, 1, 10);
    const bondMat = new THREE.MeshStandardMaterial({
      color: "#94a3b8",
      roughness: 0.22,
      metalness: 0.85
    });
    for (let i = 0; i < residues.length - 1; i++) {
      const cyl = new THREE.Mesh(bondGeo, bondMat);
      this.proteinGroup.add(cyl);
      this.bondCylinders.push(cyl);
    }

    // Smooth Mol*-inspired translucent secondary-structure colored 3D backbone spline ribbon
    if (residues.length >= 4) {
      const initPts = residues.map((_, idx) => new THREE.Vector3(idx * 0.02, 0, 0));
      const ribbonGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(initPts), Math.min(72, residues.length * 3), 0.022, 6, false);
      const count = ribbonGeo.attributes.position.count;
      const initCols = new Float32Array(count * 3);
      initCols.fill(0.84);
      ribbonGeo.setAttribute("color", new THREE.BufferAttribute(initCols, 3));
      const ribbonMat = new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        vertexColors: true,
        emissive: pal.liquidTop,
        emissiveIntensity: 0.22,
        roughness: 0.16,
        metalness: 0.35,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.72
      });
      this.proteinRibbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
      this.proteinGroup.add(this.proteinRibbonMesh);
    }

    // 1D<->3D Mol* spotlight halo sprite for hovering residues in the sequence bar
    const halo = this.makeGlowSprite("#f472b6", 0.32, 0.92);
    halo.visible = false;
    this.highlightHalo = halo;
    this.proteinGroup.add(halo);
  }

  // ---------------------------------------------------------------------------
  // 6. Floating 3D Protons, Mini Atoms & Tier 3+ Constellation Filaments
  // ---------------------------------------------------------------------------
  private buildFloatingAtoms3D(tier: number, rng: SeededRNG) {
    const pal = this.traits.palette;
    const count = 6 + (tier >= 3 ? 3 : 0);

    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const ang = (i / count) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const rad = rng.range(1.72, 2.28);
      const y = rng.range(1.22, 2.82);
      const base = new THREE.Vector3(Math.cos(ang) * rad, y, Math.sin(ang) * rad);
      g.position.copy(base);

      if (i % 2 === 0) {
        const p = new THREE.Mesh(
          new THREE.SphereGeometry(0.068, 16, 16),
          new THREE.MeshStandardMaterial({
            color: pal.proton,
            emissive: pal.proton,
            emissiveIntensity: 0.85,
            roughness: 0.18
          })
        );
        p.add(this.makeGlowSprite(pal.proton, 0.34, 0.65));
        g.add(p);
      } else {
        const core = new THREE.Mesh(
          new THREE.SphereGeometry(0.044, 12, 12),
          new THREE.MeshStandardMaterial({
            color: pal.accent,
            emissive: pal.accent,
            emissiveIntensity: 0.9
          })
        );
        core.add(this.makeGlowSprite(pal.accent, 0.28, 0.6));
        g.add(core);
        const rMat = new THREE.MeshBasicMaterial({
          color: "#94a3b8",
          transparent: true,
          opacity: 0.68
        });
        for (let k = 0; k < 2; k++) {
          const r = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.006, 6, 32), rMat);
          r.rotation.set(k * 1.1, k * 0.8, 0.4);
          g.add(r);
        }
      }

      this.nftTabletopGroup.add(g);
      this.floatingAtoms.push({ group: g, base, phase: rng.range(0, Math.PI * 2), speed: rng.range(0.7, 1.3) });
    }

    if (tier >= 3) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * count * 6), 3));
      this.constellationLines = new THREE.LineSegments(
        geo,
        new THREE.LineBasicMaterial({ color: pal.electron, transparent: true, opacity: 0.36 })
      );
      this.nftTabletopGroup.add(this.constellationLines);
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Sculptural 3D Animated Cats & Dogs Resting on Porcelain Terrace Cushions
  // ---------------------------------------------------------------------------
  private buildCompanions3D(tier: number, sectorsMask: number) {
    const fam = this.traits.familiar;
    const rightSide = this.traits.sub.companionSide === "right";

    if (fam.archetype === "harmonic-duo" || tier >= 4 || hasSector(sectorsMask, 3)) {
      const dogVariant = fam.species === "Dog" ? fam.archetype : "shiba-dog";
      const catVariant = fam.species === "Cat" ? fam.archetype : "tuxedo-cat";
      this.createStylizedDog3D(-1.12, 0.39, 0.72, 0.55, dogVariant);
      this.createStylizedCat3D(1.12, 0.39, 0.72, -0.55, catVariant);
      return;
    }

    const x = rightSide ? 1.15 : -1.15;
    const rotY = rightSide ? -0.62 : 0.62;
    if (fam.species === "Cat") {
      this.createStylizedCat3D(x, 0.39, 0.68, rotY, fam.archetype);
    } else {
      this.createStylizedDog3D(x, 0.39, 0.68, rotY, fam.archetype);
    }
  }

  private addTerraceCushion(x: number, y: number, z: number) {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.35, 0.045, 28),
      new THREE.MeshStandardMaterial({ color: "#eef2f7", roughness: 0.65, metalness: 0.04 })
    );
    pad.position.set(x, y + 0.022, z);
    pad.receiveShadow = true;
    pad.castShadow = true;
    this.pavilionGroup.add(pad);
  }

  private createStylizedCat3D(x: number, y: number, z: number, rotY: number, variant: string) {
    this.addTerraceCushion(x, y, z);
    const baseY = y + 0.045;
    const pal = this.traits.palette;
    const group = new THREE.Group();
    group.position.set(x, baseY, z);
    group.rotation.y = rotY;

    const mainCol =
      variant === "siamese-cat" ? "#f1ece4" : variant === "calico-kitten" ? "#fcfbf8" : "#252c3b";
    const accentCol =
      variant === "siamese-cat" ? "#4b4f69" : variant === "calico-kitten" ? pal.proton : "#ffffff";

    const coatMat = new THREE.MeshStandardMaterial({ color: mainCol, roughness: 0.38, metalness: 0.06 });
    const accentMat = new THREE.MeshStandardMaterial({ color: accentCol, roughness: 0.38, metalness: 0.06 });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: pal.electron,
      emissive: pal.electron,
      emissiveIntensity: 0.68,
      roughness: 0.08
    });
    const pupilMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.08 });
    const glintMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.24, 14, 22), coatMat);
    body.position.y = 0.28;
    body.scale.set(1, 1.05, 0.94);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const bib = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), accentMat);
    bib.position.set(0, 0.25, 0.13);
    bib.scale.set(0.75, 1.1, 0.55);
    group.add(bib);

    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.175, 0.022, 10, 28),
      new THREE.MeshStandardMaterial({ color: pal.liquidMid, roughness: 0.22, metalness: 0.78 })
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.46;
    group.add(collar);

    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.042, 0),
      new THREE.MeshStandardMaterial({ color: pal.accent, emissive: pal.accent, emissiveIntensity: 0.95 })
    );
    gem.position.set(0, 0.44, 0.19);
    group.add(gem);

    const paw = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.055, 0.12, 8, 12),
      variant === "tuxedo-cat" ? accentMat : coatMat
    );
    paw.position.set(0.16, 0.34, 0.18);
    paw.rotation.set(0.7, 0, -0.45);
    paw.castShadow = true;
    group.add(paw);

    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.12, -0.18);
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.08, 0.14, -0.22),
      new THREE.Vector3(0.05, 0.42, -0.26),
      new THREE.Vector3(0.0, 0.58, -0.16)
    ]);
    const tailMesh = new THREE.Mesh(
      new THREE.TubeGeometry(tailCurve, 20, 0.042, 10, false),
      variant === "siamese-cat" ? accentMat : coatMat
    );
    tailMesh.castShadow = true;
    tailPivot.add(tailMesh);
    group.add(tailPivot);

    const head = new THREE.Group();
    head.position.set(0, 0.64, 0.04);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), coatMat);
    skull.scale.set(1.06, 0.94, 0.98);
    skull.castShadow = true;
    head.add(skull);

    if (variant === "siamese-cat") {
      const mask = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), accentMat);
      mask.position.set(0, -0.02, 0.14);
      mask.scale.set(1, 0.8, 0.55);
      head.add(mask);
    }

    const earGeo = new THREE.ConeGeometry(0.082, 0.21, 4);
    const innerEarMat = new THREE.MeshStandardMaterial({ color: pal.accent, roughness: 0.48 });
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, variant === "siamese-cat" ? accentMat : coatMat);
      ear.position.set(side * 0.14, 0.22, 0);
      ear.rotation.set(0.1, side * 0.2, -side * 0.26);
      ear.castShadow = true;
      head.add(ear);

      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 4), innerEarMat);
      inner.position.set(side * 0.138, 0.205, 0.032);
      inner.rotation.copy(ear.rotation);
      head.add(inner);
    }

    const eyes: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 14), eyeMat);
      eye.position.set(side * 0.085, 0.02, 0.19);
      head.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 10), pupilMat);
      pupil.position.set(0, 0, 0.026);
      eye.add(pupil);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 8), glintMat);
      glint.position.set(-0.012, 0.014, 0.038);
      eye.add(glint);
      eyes.push(eye);
    }

    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 10, 10),
      new THREE.MeshStandardMaterial({ color: pal.proton, roughness: 0.28 })
    );
    nose.position.set(0, -0.04, 0.22);
    head.add(nose);

    const wings = this.addPetWardrobe3D(head, group, 0.46, false, variant);

    group.add(head);
    this.dynamicGroup.add(group);
    this.companions.push({
      group,
      head,
      tail: tailPivot,
      paw,
      wings,
      eyes,
      homePos: new THREE.Vector3(x, baseY, z),
      homeRotY: rotY,
      baseY,
      isDog: false,
      petReaction: 0
    });
  }

  private createStylizedDog3D(x: number, y: number, z: number, rotY: number, variant: string) {
    this.addTerraceCushion(x, y, z);
    const baseY = y + 0.045;
    const pal = this.traits.palette;
    const group = new THREE.Group();
    group.position.set(x, baseY, z);
    group.rotation.y = rotY;

    const mainCol =
      variant === "sighthound-dog" ? "#e2e8f0" : variant === "lab-pup" ? "#f5ede0" : "#e8b680";
    const coatMat = new THREE.MeshStandardMaterial({ color: mainCol, roughness: 0.42, metalness: 0.05 });
    const bellyMat = new THREE.MeshStandardMaterial({ color: "#fffdf9", roughness: 0.45 });
    const darkMat = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.12 });
    const glintMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });

    const bodyH = variant === "sighthound-dog" ? 0.34 : 0.26;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, bodyH, 14, 22), coatMat);
    body.position.y = 0.22 + bodyH * 0.4;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 16), bellyMat);
    chest.position.set(0, 0.26, 0.14);
    chest.scale.set(0.82, 1.15, 0.56);
    group.add(chest);

    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.185, 0.025, 10, 28),
      new THREE.MeshStandardMaterial({ color: pal.liquidMid, roughness: 0.22, metalness: 0.78 })
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.46 + (bodyH - 0.26) * 0.8;
    group.add(collar);

    const pendant = new THREE.Mesh(
      new THREE.SphereGeometry(0.042, 12, 12),
      new THREE.MeshStandardMaterial({ color: pal.accent, emissive: pal.accent, emissiveIntensity: 0.95 })
    );
    pendant.position.set(0, collar.position.y - 0.04, 0.2);
    group.add(pendant);

    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.16, -0.2);
    const tailCurve =
      variant === "shiba-dog"
        ? new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0.18, -0.18),
            new THREE.Vector3(0, 0.36, -0.12),
            new THREE.Vector3(0, 0.34, -0.02)
          ])
        : new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0.16, -0.2),
            new THREE.Vector3(0, 0.38, -0.26)
          ]);
    const tailMesh = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 18, 0.048, 10, false), coatMat);
    tailMesh.castShadow = true;
    tailPivot.add(tailMesh);
    group.add(tailPivot);

    const head = new THREE.Group();
    head.position.set(0, 0.66 + (bodyH - 0.26) * 0.85, 0.05);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), coatMat);
    skull.scale.set(1.02, 0.94, 1.0);
    skull.castShadow = true;
    head.add(skull);

    const snoutLen = variant === "sighthound-dog" ? 0.18 : 0.12;
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 16), bellyMat);
    snout.position.set(0, -0.04, 0.18 + snoutLen * 0.25);
    snout.scale.set(0.95, 0.72, 1.15 + snoutLen);
    head.add(snout);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 12), darkMat);
    nose.position.set(0, -0.01, 0.28 + snoutLen * 0.55);
    nose.scale.set(1.15, 0.8, 0.9);
    head.add(nose);

    for (const side of [-1, 1]) {
      if (variant === "lab-pup") {
        const ear = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.06, 0.14, 8, 12),
          new THREE.MeshStandardMaterial({ color: "#d5c4aa", roughness: 0.48 })
        );
        ear.position.set(side * 0.21, -0.02, 0.02);
        ear.rotation.set(0.1, 0, side * 0.22);
        ear.castShadow = true;
        head.add(ear);
      } else {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), coatMat);
        ear.position.set(side * 0.14, 0.21, -0.01);
        ear.rotation.set(variant === "sighthound-dog" ? -0.45 : 0.1, 0, -side * 0.26);
        ear.castShadow = true;
        head.add(ear);
      }
    }

    const eyes: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 14), darkMat);
      eye.position.set(side * 0.085, 0.04, 0.195);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 8), glintMat);
      glint.position.set(-0.01, 0.012, 0.032);
      eye.add(glint);
      head.add(eye);
      eyes.push(eye);
    }

    const wings = this.addPetWardrobe3D(head, group, collar.position.y, true, variant);

    group.add(head);
    this.dynamicGroup.add(group);
    this.companions.push({
      group,
      head,
      tail: tailPivot,
      wings,
      eyes,
      homePos: new THREE.Vector3(x, baseY, z),
      homeRotY: rotY,
      baseY,
      isDog: true,
      petReaction: 0
    });
  }

  // ---------------------------------------------------------------------------
  // Sims-Style Modular 3D Architectural Lab Wings (Sectors 0..5)
  // ---------------------------------------------------------------------------
  private buildCryoFoldingWing3D() {
    // Sector 0: North-West Frosted-Glass Cryo-Folding Annex + Twin Liquid-Nitrogen Towers
    const group = new THREE.Group();
    group.position.set(-2.35, 0.23, -1.45);

    const stone = new THREE.MeshStandardMaterial({ map: this.terrazzoTex, color: "#ffffff", roughness: 0.45 });
    const metal = new THREE.MeshStandardMaterial({ map: this.titaniumTex, color: "#dce3ed", roughness: 0.2, metalness: 0.9 });
    const glass = new THREE.MeshPhysicalMaterial({
      color: "#e0f2fe",
      transmission: 0.82,
      roughness: 0.12,
      ior: 1.46,
      thickness: 0.18,
      transparent: true
    });

    const pad = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.14, 1.08), stone);
    pad.position.y = 0.07;
    pad.castShadow = true;
    pad.receiveShadow = true;
    group.add(pad);

    const enclosure = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.76, 0.86), glass);
    enclosure.position.y = 0.52;
    enclosure.castShadow = true;
    group.add(enclosure);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.06, 1.0), stone);
    roof.position.y = 0.93;
    roof.castShadow = true;
    group.add(roof);

    // Dual glowing Cryo Towers rising cleanly through the glass annex roof
    for (const dx of [-0.24, 0.24]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.25, 20), metal);
      tower.position.set(dx, 0.76, 0);
      tower.castShadow = true;
      group.add(tower);

      const beacon = new THREE.Mesh(
        new THREE.TorusGeometry(0.14, 0.018, 10, 28),
        new THREE.MeshStandardMaterial({ color: "#38bdf8", emissive: "#38bdf8", emissiveIntensity: 1.2 })
      );
      beacon.rotation.x = Math.PI / 2;
      beacon.position.set(dx, 1.28, 0);
      group.add(beacon);
      this.cryoBeacons.push(beacon);
    }

    // Internal spinning crystalline cryo-helix visible inside the frosted glass chamber
    const helix = new THREE.Group();
    helix.position.set(0, 0.52, 0);
    const hMat = new THREE.MeshStandardMaterial({
      color: "#7dd3fc",
      emissive: "#38bdf8",
      emissiveIntensity: 0.9,
      roughness: 0.12
    });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.042, 0), hMat);
      orb.position.set(Math.cos(a) * 0.14, -0.22 + i * 0.09, Math.sin(a) * 0.14);
      helix.add(orb);
    }
    group.add(helix);
    this.cryoHelixes.push(helix);

    // Glass skybridge linking Cryo Wing to central rotunda
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.06, 0.34), stone);
    bridge.position.set(0.84, 0.14, 0.35);
    bridge.rotation.y = -0.45;
    group.add(bridge);

    this.nftTabletopGroup.add(group);
    this.builtWingGroups.push({ sectorId: 0, name: "Cold Room", group });
  }

  private buildQuantumMiningRigWing3D() {
    // Sector 1: East Terrace Titanium Quantum Coin-Mining Pavilion with Spinning Hash-Blades!
    const group = new THREE.Group();
    group.position.set(2.42, 0.23, 0.2);

    const stone = new THREE.MeshStandardMaterial({ map: this.terrazzoTex, color: "#ffffff", roughness: 0.45 });
    const metal = new THREE.MeshStandardMaterial({ map: this.titaniumTex, color: "#d4dce8", roughness: 0.18, metalness: 0.92 });
    const coreMat = new THREE.MeshStandardMaterial({
      color: "#6366f1",
      emissive: "#6366f1",
      emissiveIntensity: 1.15,
      roughness: 0.15,
      metalness: 0.5
    });

    const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.84, 0.16, 8), stone);
    deck.position.y = 0.08;
    deck.castShadow = true;
    deck.receiveShadow = true;
    group.add(deck);

    // 3 Vertical Brushed-Titanium Compute Racks with Spinning Crystalline Hash-Blades
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.3;
      const rx = Math.cos(a) * 0.42;
      const rz = Math.sin(a) * 0.42;
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.05, 0.14), metal);
      pylon.position.set(rx, 0.68, rz);
      pylon.castShadow = true;
      group.add(pylon);
    }

    const rotor = new THREE.Group();
    rotor.position.y = 0.84;
    const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.12, 16), metal);
    rotor.add(spindle);
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), coreMat);
      blade.position.y = -0.3 + b * 0.3;
      blade.scale.set(1.25, 0.32, 1.25);
      blade.rotation.y = b * 0.6;
      rotor.add(blade);
    }
    rotor.add(this.makeGlowSprite("#6366f1", 0.95, 0.55));
    group.add(rotor);
    this.miningBlades.push(rotor);

    // Sleek optical energy conduit linking Mining Pavilion straight into the central reactor
    const conduitCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.35, 0.65, 0),
      new THREE.Vector3(-1.12, 0.95, -0.06),
      new THREE.Vector3(-1.82, 0.45, -0.18)
    ]);
    const conduit = new THREE.Mesh(
      new THREE.TubeGeometry(conduitCurve, 24, 0.018, 8, false),
      new THREE.MeshStandardMaterial({
        color: "#818cf8",
        emissive: "#6366f1",
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.78
      })
    );
    group.add(conduit);

    this.nftTabletopGroup.add(group);
    this.builtWingGroups.push({ sectorId: 1, name: "Mining Room", group });
  }

  private buildSolarCatalysisDome3D() {
    // Sector 2: South-West Architectural Geodesic Glass Greenhouse Conservatory!
    const group = new THREE.Group();
    group.position.set(-2.22, 0.23, 1.62);

    const stone = new THREE.MeshStandardMaterial({ map: this.terrazzoTex, color: "#ffffff", roughness: 0.45 });
    const glass = new THREE.MeshPhysicalMaterial({
      color: "#ecfdf5",
      transmission: 0.86,
      roughness: 0.08,
      ior: 1.46,
      thickness: 0.12,
      transparent: true
    });

    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.78, 0.16, 24), stone);
    plinth.position.y = 0.08;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    group.add(plinth);

    const domeGeo = new THREE.IcosahedronGeometry(0.66, 1);
    const dome = new THREE.Mesh(domeGeo, glass);
    dome.position.y = 0.26;
    dome.scale.set(1, 0.84, 1);
    group.add(dome);

    const wireframe = new THREE.LineSegments(
      new THREE.EdgesGeometry(domeGeo),
      new THREE.LineBasicMaterial({ color: "#94a3b8", transparent: true, opacity: 0.72 })
    );
    wireframe.position.copy(dome.position);
    wireframe.scale.copy(dome.scale);
    group.add(wireframe);

    // 3 Graceful swaying porcelain-and-sage botanical stems inside the conservatory
    const stemMat = new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.4 });
    const leafMat = new THREE.MeshStandardMaterial({
      color: "#6ee7b7",
      emissive: "#10b981",
      emissiveIntensity: 0.45,
      roughness: 0.25
    });
    for (let s = 0; s < 3; s++) {
      const a = (s / 3) * Math.PI * 2 + 0.4;
      const stemPivot = new THREE.Group();
      stemPivot.position.set(Math.cos(a) * 0.16, 0.16, Math.sin(a) * 0.16);
      const h = 0.36 + (s % 2) * 0.12;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(Math.cos(a) * 0.06, h * 0.55, Math.sin(a) * 0.06),
        new THREE.Vector3(Math.cos(a) * 0.12, h, Math.sin(a) * 0.12)
      ]);
      stemPivot.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.015, 6, false), stemMat));
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 1), leafMat);
      leaf.position.set(Math.cos(a) * 0.12, h, Math.sin(a) * 0.12);
      leaf.scale.set(1.25, 0.55, 0.9);
      stemPivot.add(leaf);
      group.add(stemPivot);
      this.greenhouseStems.push(stemPivot);
    }

    // Drifting golden-mint pollen motes inside the greenhouse
    const pGeo = new THREE.SphereGeometry(0.02, 8, 8);
    const pMat = new THREE.MeshBasicMaterial({ color: "#a7f3d0" });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const base = new THREE.Vector3(Math.cos(a) * 0.28, 0.34 + (i % 3) * 0.12, Math.sin(a) * 0.28);
      const mote = new THREE.Mesh(pGeo, pMat);
      mote.position.copy(base);
      group.add(mote);
      this.greenhousePollen.push({ mesh: mote, base, phase: i * 1.1 });
    }

    this.nftTabletopGroup.add(group);
    this.builtWingGroups.push({ sectorId: 2, name: "Greenhouse", group });
  }

  private buildCompanionSanctuaryWing3D() {
    // Sector 3: South-East Sunlit Glass Pet Lounge with Cushion Bed, Cat Perch & Bowls
    const group = new THREE.Group();
    group.position.set(1.98, 0.23, 1.72);

    const stone = new THREE.MeshStandardMaterial({ map: this.terrazzoTex, color: "#ffffff", roughness: 0.45 });
    const metal = new THREE.MeshStandardMaterial({ map: this.titaniumTex, color: "#dce3ed", roughness: 0.2, metalness: 0.88 });
    const softMat = new THREE.MeshStandardMaterial({ color: "#fdf2f8", roughness: 0.72 });

    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.14, 0.96), stone);
    deck.position.y = 0.07;
    deck.castShadow = true;
    deck.receiveShadow = true;
    group.add(deck);

    for (const sx of [-0.46, 0.46]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.88, 12), metal);
      p.position.set(sx, 0.58, -0.34);
      group.add(p);
    }
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.05, 0.92), stone);
    canopy.position.set(0, 1.02, -0.06);
    canopy.rotation.x = 0.08;
    canopy.castShadow = true;
    group.add(canopy);

    // Plush circular pet cushion bed
    const bed = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.055, 12, 28), softMat);
    bed.rotation.x = Math.PI / 2;
    bed.position.set(-0.24, 0.18, 0.08);
    group.add(bed);

    // Miniature architectural cat tree / perch platform
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.042, 0.44, 12), metal);
    post.position.set(0.28, 0.36, -0.14);
    group.add(post);
    const perch = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 20), softMat);
    perch.position.set(0.28, 0.59, -0.14);
    group.add(perch);

    // Twin brushed-silver food & water bowls
    for (let b = 0; b < 2; b++) {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.045, 16), metal);
      bowl.position.set(0.16 + b * 0.18, 0.16, 0.24);
      group.add(bowl);
      const fill = new THREE.Mesh(
        new THREE.CircleGeometry(0.062, 16),
        new THREE.MeshStandardMaterial({
          color: b === 0 ? "#38bdf8" : "#fbbf24",
          emissive: b === 0 ? "#38bdf8" : "#f59e0b",
          emissiveIntensity: 0.35
        })
      );
      fill.rotation.x = -Math.PI / 2;
      fill.position.set(0.16 + b * 0.18, 0.184, 0.24);
      group.add(fill);
    }

    // Glowing floating companion play-lantern
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 18, 18),
      new THREE.MeshStandardMaterial({ color: "#f472b6", emissive: "#f472b6", emissiveIntensity: 0.9 })
    );
    orb.position.set(-0.24, 0.52, -0.05);
    orb.add(this.makeGlowSprite("#f472b6", 0.45, 0.6));
    group.add(orb);
    this.cryoBeacons.push(orb);

    this.nftTabletopGroup.add(group);
    this.builtWingGroups.push({ sectorId: 3, name: "Pet Lounge", group });
  }

  private buildProtonAcceleratorSpire3D() {
    // Sector 4: North-East Tall Sculptural Titanium & Glass Proton Collider Spire
    const group = new THREE.Group();
    group.position.set(2.12, 0.23, -1.62);

    const stone = new THREE.MeshStandardMaterial({ map: this.terrazzoTex, color: "#ffffff", roughness: 0.45 });
    const metal = new THREE.MeshStandardMaterial({ map: this.titaniumTex, color: "#d4dce8", roughness: 0.18, metalness: 0.92 });
    const glass = new THREE.MeshPhysicalMaterial({
      color: "#ede9fe",
      transmission: 0.86,
      roughness: 0.08,
      ior: 1.48,
      transparent: true
    });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.66, 0.18, 24), stone);
    base.position.y = 0.09;
    base.castShadow = true;
    group.add(base);

    const spireCore = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 2.65, 24), glass);
    spireCore.position.y = 1.48;
    spireCore.castShadow = true;
    group.add(spireCore);

    const innerBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, 2.55, 12),
      new THREE.MeshStandardMaterial({ color: "#8b5cf6", emissive: "#8b5cf6", emissiveIntensity: 1.3 })
    );
    innerBeam.position.y = 1.48;
    group.add(innerBeam);

    // Rising energy pulse ring climbing up the accelerator spire
    const pulseRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.016, 10, 32),
      new THREE.MeshStandardMaterial({ color: "#c4b5fd", emissive: "#8b5cf6", emissiveIntensity: 1.4 })
    );
    pulseRing.rotation.x = Math.PI / 2;
    pulseRing.position.y = 0.45;
    group.add(pulseRing);
    this.spirePulseRing = pulseRing;

    // Counter-rotating Magnetic Accelerator Coil Rings stacked up the spire
    for (let i = 0; i < 4; i++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.32 - i * 0.03, 0.022, 10, 36), metal);
      coil.rotation.x = Math.PI / 2;
      coil.position.y = 0.65 + i * 0.56;
      group.add(coil);
      this.acceleratorRings.push(coil);
    }

    // Spawn 3 extra tappable glowing protons orbiting the Particle Tower!
    for (let p = 0; p < 3; p++) {
      const ang = (p / 3) * Math.PI * 2;
      const g = new THREE.Group();
      const basePos = new THREE.Vector3(
        2.12 + Math.cos(ang) * 0.62,
        1.1 + p * 0.55,
        -1.62 + Math.sin(ang) * 0.62
      );
      g.position.copy(basePos);
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.068, 16, 16),
        new THREE.MeshStandardMaterial({ color: "#a78bfa", emissive: "#8b5cf6", emissiveIntensity: 1.1 })
      );
      orb.add(this.makeGlowSprite("#8b5cf6", 0.36, 0.72));
      g.add(orb);
      this.nftTabletopGroup.add(g);
      this.floatingAtoms.push({ group: g, base: basePos, phase: p * 2.1, speed: 1.25 });
    }

    const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), metal);
    finial.position.y = 2.92;
    finial.add(this.makeGlowSprite("#8b5cf6", 0.65, 0.72));
    group.add(finial);

    this.nftTabletopGroup.add(group);
    this.builtWingGroups.push({ sectorId: 4, name: "Particle Tower", group });
  }

  private buildObservatoryCrown3D() {
    // Sector 5: Geodesic Translucent Crystal Observatory Dome + Celestial Rings
    const group = new THREE.Group();
    group.position.set(0, 3.32, 0);
    const goldSilver = new THREE.MeshStandardMaterial({
      color: "#e2d5b5",
      roughness: 0.18,
      metalness: 0.92
    });
    const crystalGlass = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      transmission: 0.89,
      roughness: 0.05,
      ior: 1.5,
      thickness: 0.18,
      dispersion: 0.42,
      iridescence: 0.34,
      iridescenceIOR: 1.32,
      transparent: true,
      opacity: 0.68
    });

    const crown = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.028, 12, 64), goldSilver);
    crown.rotation.x = Math.PI / 2;
    group.add(crown);

    const geoDome = new THREE.IcosahedronGeometry(1.16, 1);
    const shell = new THREE.Mesh(geoDome, crystalGlass);
    shell.scale.set(1, 0.54, 1);
    shell.position.y = 0.24;
    group.add(shell);

    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(geoDome),
      new THREE.LineBasicMaterial({ color: "#cbd5e1", transparent: true, opacity: 0.58 })
    );
    frame.scale.copy(shell.scale);
    frame.position.copy(shell.position);
    group.add(frame);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const rib = new THREE.Mesh(
        new THREE.TorusGeometry(1.18, 0.012, 8, 32, Math.PI * 0.45),
        goldSilver
      );
      rib.rotation.y = a;
      rib.rotation.z = 0.1;
      group.add(rib);
    }
    this.acceleratorRings.push(group);
    this.nftTabletopGroup.add(group);
    this.builtWingGroups.push({ sectorId: 5, name: "Glass Dome", group });
  }

  // ---------------------------------------------------------------------------
  // Tiers 3, 4, 5: Celestial Orrery, Twin Micro-Alembics & 4D Hypercube
  // ---------------------------------------------------------------------------
  private buildCelestialOrrery3D() {
    const pal = this.traits.palette;
    const oGroup = new THREE.Group();
    oGroup.position.set(0, 2.12, 0);

    const track = new THREE.Mesh(
      new THREE.TorusGeometry(2.44, 0.008, 8, 96),
      new THREE.MeshBasicMaterial({ color: "#b8c3d4", transparent: true, opacity: 0.48 })
    );
    track.rotation.x = Math.PI / 2 + 0.14;
    oGroup.add(track);

    const planetGroup = new THREE.Group();
    planetGroup.position.set(2.44, 0, 0);
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(0.175, 24, 24),
      new THREE.MeshStandardMaterial({
        color: pal.liquidTop,
        emissive: pal.liquidMid,
        emissiveIntensity: 0.28,
        roughness: 0.2,
        metalness: 0.35
      })
    );
    planetGroup.add(planet);
    const pRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.29, 0.018, 8, 40),
      new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.88, roughness: 0.18 })
    );
    pRing.rotation.set(1.2, 0.4, 0);
    planetGroup.add(pRing);
    track.add(planetGroup);

    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 20, 20),
      new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.32, metalness: 0.65 })
    );
    moon.position.set(-2.44, 0, 0);
    track.add(moon);

    this.orreryGroup = oGroup;
    this.nftTabletopGroup.add(oGroup);
  }

  private buildTwinMicroAlembics3D() {
    const pal = this.traits.palette;
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      transmission: 0.89,
      roughness: 0.05,
      ior: 1.48,
      thickness: 0.22,
      transparent: true
    });

    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      const baseY = 2.02;
      g.position.set(side * 1.68, baseY, 0.15);

      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 24), glassMat));

      const innerCol = side === -1 ? pal.electron : pal.accent;
      const inner = new THREE.Mesh(
        new THREE.SphereGeometry(0.17, 18, 18),
        new THREE.MeshStandardMaterial({
          color: innerCol,
          emissive: innerCol,
          emissiveIntensity: 0.8,
          roughness: 0.16
        })
      );
      inner.position.y = -0.03;
      g.add(inner);
      g.add(this.makeGlowSprite(innerCol, 0.65, 0.42));

      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.012, 10, 36),
        new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.9, roughness: 0.18 })
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = -0.26;
      g.add(halo);

      const tetherCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(-side * 0.72, 0.34, -0.08),
        new THREE.Vector3(-side * 1.42, -0.45, -0.15)
      ]);
      g.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(tetherCurve, 24, 0.012, 8, false),
          new THREE.MeshBasicMaterial({ color: innerCol, transparent: true, opacity: 0.65 })
        )
      );

      this.nftTabletopGroup.add(g);
      this.microAlembics.push({ group: g, baseY, phase: side === -1 ? 0 : Math.PI });
    }
  }

  private buildHypercube4D() {
    const pal = this.traits.palette;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(32 * 2 * 3), 3));
    const lines = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: pal.liquidMid, transparent: true, opacity: 0.44 })
    );
    lines.position.set(0, 2.02, 0);
    this.hypercubeLines = lines;
    this.nftTabletopGroup.add(lines);
  }

  // ---------------------------------------------------------------------------
  // Frame Step: Real AB-Model Physics + 3D Architectural & Molecular Kinematics
  // ---------------------------------------------------------------------------
  private step(dt: number, t: number, now: number) {
    const tier = Math.max(1, Math.min(5, this.impact.complexityTier || 1));
    const sMask = this.impact.sectorsMask ?? 0;

    // Real open-science physics evaluations per frame (offloaded to Web Worker when available!)
    if (this.compute.isActive()) {
      const cryoMult = hasSector(sMask, 0) ? 1.6 : 1;
      const obsMult = hasSector(sMask, 5) ? 1.4 : 1;
      this.compute.requestStep(Math.round((20 + tier * 8) * cryoMult * obsMult));
      if (now - this.lastUiEmit > 280) {
        this.lastUiEmit = now;
        this.onComputeTick?.(this.compute.getSnapshot());
      }
    }

    // Smooth elastic pop-in when a new Sims room is built
    if (this.buildPopScale < 0.999) {
      this.buildPopScale += (1 - this.buildPopScale) * Math.min(1, dt * 8);
      this.dynamicGroup.scale.setScalar(this.buildPopScale);
    } else if (this.dynamicGroup.scale.x !== 1) {
      this.dynamicGroup.scale.setScalar(1);
    }

    // Gentle breathing animation on Sims hover-preview ghost wireframe
    if (this.previewGhostGroup.children.length > 0) {
      this.previewGhostGroup.position.y = Math.sin(t * 3.6) * 0.055;
    }

    // Animate Sims-style built architectural wings
    for (const blade of this.miningBlades) {
      blade.rotation.y += dt * (2.6 + this.excitement * 3.5);
    }
    for (const hx of this.cryoHelixes) {
      hx.rotation.y -= dt * 1.45;
    }
    for (let i = 0; i < this.greenhouseStems.length; i++) {
      this.greenhouseStems[i].rotation.z = Math.sin(t * 1.4 + i * 1.8) * 0.07;
    }
    for (const p of this.greenhousePollen) {
      p.mesh.position.set(
        p.base.x + Math.sin(t * 1.3 + p.phase) * 0.06,
        p.base.y + Math.cos(t * 1.6 + p.phase) * 0.08,
        p.base.z + Math.cos(t * 1.1 + p.phase) * 0.06
      );
    }
    if (this.spirePulseRing) {
      const p = (t * 0.55) % 1;
      this.spirePulseRing.position.y = 0.4 + p * 2.3;
      this.spirePulseRing.scale.setScalar(1 - p * 0.35);
    }
    for (let i = 0; i < this.acceleratorRings.length; i++) {
      this.acceleratorRings[i].rotation.z += dt * (i % 2 === 0 ? 1.1 : -0.9);
      this.acceleratorRings[i].rotation.y += dt * 0.35;
    }
    for (let i = 0; i < this.cryoBeacons.length; i++) {
      this.cryoBeacons[i].position.y += Math.sin(t * 2.8 + i) * 0.0008;
    }
    const snap = this.compute.getSnapshot();
    if (snap.residues.length > 0 && snap.residues.length !== this.proteinChainLength) {
      this.rebuildProteinChainMeshes(snap.residues);
    }

    if (!this.userDragging) {
      this.controls.autoRotate =
        this.autoRotateDesired && (!this.walkMode || !this.characterAvatar) && !this.creatorCameraMode;
    }

    // Update Walkable Researcher Avatar, Floor Beacons & Third-Person Follow Camera
    if (this.walkMode) {
      this.stepWalkableCharacter(dt, t);
    }

    // Smooth architect-app camera fly-to animation when switching view presets
    if (this.desiredCamPos && this.desiredCamTarget) {
      const k = Math.min(1, dt * 6.5);
      this.camera.position.lerp(this.desiredCamPos, k);
      this.controls.target.lerp(this.desiredCamTarget, k);
      if (
        this.camera.position.distanceTo(this.desiredCamPos) < 0.04 &&
        this.controls.target.distanceTo(this.desiredCamTarget) < 0.04
      ) {
        this.desiredCamPos = null;
        this.desiredCamTarget = null;
      }
    }

    // Real bouncing 3D proton toy ball physics on the architectural terrace!
    if (this.toyBall) {
      this.toyBall.life -= dt;
      this.toyBall.bounceCooldown = Math.max(0, this.toyBall.bounceCooldown - dt);
      this.toyBall.vel.y -= 5.8 * dt;
      this.toyBall.mesh.position.addScaledVector(this.toyBall.vel, dt);
      const ballFloor = this.walkMode ? 0.23 : 0.5;
      if (this.toyBall.mesh.position.y < ballFloor) {
        this.toyBall.mesh.position.y = ballFloor;
        if (Math.abs(this.toyBall.vel.y) > 0.65 && this.toyBall.bounceCooldown <= 0) {
          soundEngine.playBounce();
          this.toyBall.bounceCooldown = 0.22;
        }
        this.toyBall.vel.y = Math.abs(this.toyBall.vel.y) * 0.78;
      }
      const rDist = Math.hypot(this.toyBall.mesh.position.x, this.toyBall.mesh.position.z);
      if (rDist > 1.65) {
        this.toyBall.vel.x *= -0.82;
        this.toyBall.vel.z *= -0.82;
      }
      if (this.toyBall.life <= 0) {
        this.dynamicGroup.remove(this.toyBall.mesh);
        this.toyBall = null;
      }
    }

    this.displayFill += (this.targetFill - this.displayFill) * Math.min(1, dt * 2.6);
    this.excitement = Math.max(0, this.excitement - dt * 0.42);
    this.discoveryFlash = Math.max(0, this.discoveryFlash - dt * 1.15);

    // Liquid height + true vertex-wave rippling 3D meniscus
    if (this.liquidMesh) {
      const sy = 0.35 + this.displayFill * 0.72;
      this.liquidMesh.scale.set(1, sy, 1);
      if (this.liquidTopMesh && this.liquidTopBasePos) {
        this.liquidTopMesh.position.y = 0.06 + sy * 0.96;
        const pos = this.liquidTopMesh.geometry.getAttribute("position") as THREE.BufferAttribute;
        const amp = 0.016 + this.excitement * 0.025;
        for (let i = 0; i < pos.count; i++) {
          const bx = this.liquidTopBasePos[i * 3];
          const by = this.liquidTopBasePos[i * 3 + 1];
          const r = Math.hypot(bx, by);
          const wz = Math.sin(r * 16 - t * 4.2) * amp + Math.cos(bx * 9 + t * 3.1) * (amp * 0.5);
          pos.setZ(i, wz);
        }
        pos.needsUpdate = true;
      }
    }

    // Subtle shimmer on architectural reflecting water basin & GLSL borosilicate floor caustics
    if (this.waterPoolMesh) {
      (this.waterPoolMesh.material as THREE.MeshPhysicalMaterial).opacity =
        0.68 + Math.sin(t * 1.8) * 0.05;
    }
    if (this.causticShaderMat) {
      this.causticShaderMat.uniforms.uTime.value = t;
    }

    // Rising 3D Bubbles
    const bSpeedMult = 1 + this.excitement * 0.8 + (snap.active ? 0.3 : 0);
    const maxBubbleY = 0.1 + (0.35 + this.displayFill * 0.72) * 0.9;
    for (const b of this.bubbles) {
      b.y += b.speed * bSpeedMult * dt;
      if (b.y > maxBubbleY) b.y = 0.08;
      b.mesh.position.set(
        b.baseX + Math.sin(t * 2.5 + b.phase) * 0.04,
        b.y,
        b.baseZ + Math.cos(t * 2.2 + b.phase) * 0.04
      );
    }

    // Rising Vapor Rings from vessel neck
    for (const vr of this.vaporRings) {
      vr.age = (vr.age + dt) % vr.maxAge;
      const p = vr.age / vr.maxAge;
      vr.mesh.position.y = 1.84 + p * 0.62;
      vr.mesh.scale.setScalar(0.85 + p * 1.4);
      (vr.mesh.material as THREE.MeshBasicMaterial).opacity = Math.sin(p * Math.PI) * 0.34;
    }

    // Atomic Nucleus
    if (this.nucleusGroup) {
      this.nucleusGroup.rotation.y = t * 0.75;
      this.nucleusGroup.rotation.x = Math.sin(t * 0.5) * 0.25;
      const vib = 0.014 * (1 + this.excitement * 1.6);
      for (const nb of this.nucleusBalls) {
        nb.mesh.position.set(
          nb.base.x + Math.sin(t * 6.5 + nb.phase) * vib,
          nb.base.y + Math.cos(t * 5.9 + nb.phase) * vib,
          nb.base.z + Math.sin(t * 6.1 + nb.phase * 1.3) * vib
        );
      }
    }

    // Orbiting Electrons
    const eBoost = 1 + (this.impact.reactionStage - 1) * 0.14 + this.excitement * 0.9;
    for (const orb of this.orbitals) {
      const a = t * orb.speed * eBoost + orb.phase;
      orb.electron.position.set(Math.cos(a) * orb.radius, Math.sin(a) * orb.radius, 0);
      orb.trail.forEach((tm, idx) => {
        const ta = a - (idx + 1) * 0.12;
        tm.position.set(Math.cos(ta) * orb.radius, Math.sin(ta) * orb.radius, 0);
      });
    }

    if (this.astrolabeRing) {
      this.astrolabeRing.rotation.y = t * (0.14 + this.excitement * 0.25);
    }

    for (const cd of this.condenserDroplets) {
      const u = (((t * 0.32 + cd.offset) % 1) + 1) % 1;
      cd.curve.getPointAt(u, cd.mesh.position);
    }

    for (const vb of this.vialBubbles) {
      const u = (((t * vb.speed) % 1) + 1) % 1;
      vb.mesh.position.y = vb.baseY + u * vb.maxH;
    }

    if (this.manometerNeedle) {
      this.manometerNeedle.rotation.z = 1.9 - snap.workUnitProgress * 3.8 + Math.sin(t * 7) * 0.06;
    }

    if (this.energyCurveLine && snap.energyHistory.length > 2) {
      const posAttr = this.energyCurveLine.geometry.getAttribute("position") as THREE.BufferAttribute;
      const hist = snap.energyHistory;
      const minE = Math.min(...hist) - 0.5;
      const maxE = Math.max(...hist) + 0.5;
      const span = Math.max(1, maxE - minE);
      for (let i = 0; i < 48; i++) {
        const val = hist[Math.min(hist.length - 1, Math.floor((i / 47) * (hist.length - 1)))];
        posAttr.setXYZ(i, (i / 47) * 0.95, ((val - minE) / span) * 0.34, Math.sin(t * 2 + i * 0.2) * 0.02);
      }
      posAttr.needsUpdate = true;
    }

    // Real 3D Ball-and-Stick Protein Folding Update (Centroid-Normalized, Smoothly Damped, Zero Jitter)
    const displayResidues =
      this.showBestFold && snap.bestResidues.length === snap.residues.length
        ? snap.bestResidues
        : snap.residues;
    this.proteinMorphBoost = Math.max(0, this.proteinMorphBoost - dt * 1.15);
    if (this.proteinGroup && this.residueMeshes.length === displayResidues.length && displayResidues.length > 0) {
      // Serene museum orbit above the bottle neck
      this.proteinGroup.rotation.y = t * 0.24;

      // Compute centroid & bounding radius so the protein stays centered cleanly inside its glass halo
      let cx = 0;
      let cy = 0;
      let cz = 0;
      for (let i = 0; i < displayResidues.length; i++) {
        cx += displayResidues[i].x;
        cy += displayResidues[i].y;
        cz += displayResidues[i].z;
      }
      cx /= displayResidues.length;
      cy /= displayResidues.length;
      cz /= displayResidues.length;

      let maxDist = 1e-4;
      for (let i = 0; i < displayResidues.length; i++) {
        const d = Math.hypot(
          displayResidues[i].x - cx,
          displayResidues[i].y - cy,
          displayResidues[i].z - cz
        );
        if (d > maxDist) maxDist = d;
      }

      const baseScale = displayResidues.length > 26 ? 0.038 : displayResidues.length > 16 ? 0.048 : 0.058;
      const angstromScale = Math.min(baseScale, 0.43 / maxDist);

      // Frame-rate-independent exponential smoothing prevents Monte Carlo jumps from twitching
      const dampRate = (this.showBestFold ? 3.2 : 1.9) * (1 + this.proteinMorphBoost);
      const lerpAlpha = 1 - Math.exp(-dt * dampRate);

      for (let i = 0; i < displayResidues.length; i++) {
        const r = displayResidues[i];
        const mesh = this.residueMeshes[i];
        const sp = this.smoothResiduePos[i];
        this.tmpTarget.set(
          (r.x - cx) * angstromScale,
          (r.y - cy) * angstromScale,
          (r.z - cz) * angstromScale
        );

        if (!this.proteinInitialized) {
          sp.copy(this.tmpTarget);
        } else {
          sp.lerp(this.tmpTarget, lerpAlpha);
        }

        // Subtle calm molecular float (0.004 units) so the folded crystal feels gently buoyant, never erratic
        const breath = this.staticPreview ? 0 : 0.004;
        mesh.position.set(
          sp.x + Math.sin(t * 1.15 + i * 0.42) * breath,
          sp.y + Math.cos(t * 1.02 + i * 0.37) * breath,
          sp.z + Math.sin(t * 0.92 + i * 0.51) * breath
        );

        const baseNodeScale = r.aromatic ? 1.15 : r.hydrophobic ? 1.05 : 0.92;
        const isSpotlit = this.highlightedResidueIdx === i;
        mesh.scale.setScalar(isSpotlit ? baseNodeScale * 1.75 : baseNodeScale);
        if (this.proteinRibbonCurvePts[i]) {
          this.proteinRibbonCurvePts[i].copy(mesh.position);
        }
      }
      this.proteinInitialized = true;

      if (this.highlightHalo) {
        const hi = this.highlightedResidueIdx;
        if (hi !== null && hi >= 0 && hi < this.residueMeshes.length) {
          this.highlightHalo.visible = true;
          this.highlightHalo.position.copy(this.residueMeshes[hi].position);
          const pulse = 0.28 + Math.sin(t * 5.2) * 0.04;
          this.highlightHalo.scale.set(pulse, pulse, 1);
        } else {
          this.highlightHalo.visible = false;
        }
      }

      // Leak-free centripetal CatmullRom spline ribbon — rebuilt only when residues actually move!
      if (this.proteinRibbonMesh && this.proteinRibbonCurvePts.length >= 4) {
        let maxMovedSq = 0;
        for (let i = 0; i < this.proteinRibbonCurvePts.length; i++) {
          const prevPt = this.lastRibbonSnapshotPos[i];
          if (prevPt) {
            const dSq = this.proteinRibbonCurvePts[i].distanceToSquared(prevPt);
            if (dSq > maxMovedSq) maxMovedSq = dSq;
          }
        }
        const needRibbonRebuild =
          this.lastRibbonUpdateMs === 0 ||
          (maxMovedSq > 0.000018 && now - this.lastRibbonUpdateMs > 95);

        if (needRibbonRebuild) {
          this.lastRibbonUpdateMs = now;
          for (let i = 0; i < this.proteinRibbonCurvePts.length; i++) {
            this.lastRibbonSnapshotPos[i]?.copy(this.proteinRibbonCurvePts[i]);
          }

          const ssKey = this.showBestFold
            ? `B:${displayResidues.length}:${snap.bestEnergy.toFixed(2)}:${snap.discoveries}`
            : `L:${displayResidues.length}:${Math.floor(now / 650)}`;
          if (ssKey !== this.cachedSSEnergyKey || this.cachedSSCodes.length !== displayResidues.length) {
            this.cachedSSEnergyKey = ssKey;
            this.cachedSSCodes = assignSecondaryStructurePSEA(displayResidues).codes;
          }

          const curve = new THREE.CatmullRomCurve3(this.proteinRibbonCurvePts, false, "centripetal", 0.5);
          const tubularSegs = Math.min(84, this.proteinRibbonCurvePts.length * 4);
          const radialSegs = 8;
          const nextGeo = new THREE.TubeGeometry(curve, tubularSegs, 0.021, radialSegs, false);
          const ssCodes = this.cachedSSCodes;
          const posCount = nextGeo.attributes.position.count;
          const colArr = new Float32Array(posCount * 3);
          const ringStride = radialSegs + 1;
          for (let s = 0; s <= tubularSegs; s++) {
            const rIdx = Math.min(
              ssCodes.length - 1,
              Math.round((s / Math.max(1, tubularSegs)) * (ssCodes.length - 1))
            );
            const code = ssCodes[rIdx];
            // Mol* standard secondary structure palette: Helix = Rose Pink, Sheet = Warm Amber, Coil = Silver
            const cr = code === "H" ? 0.96 : code === "E" ? 0.98 : 0.78;
            const cg = code === "H" ? 0.45 : code === "E" ? 0.74 : 0.83;
            const cb = code === "H" ? 0.71 : code === "E" ? 0.18 : 0.9;
            for (let r = 0; r < ringStride; r++) {
              const vi = (s * ringStride + r) * 3;
              if (vi + 2 < colArr.length) {
                colArr[vi] = cr;
                colArr[vi + 1] = cg;
                colArr[vi + 2] = cb;
              }
            }
          }
          nextGeo.setAttribute("color", new THREE.BufferAttribute(colArr, 3));
          this.proteinRibbonMesh.geometry.dispose();
          this.proteinRibbonMesh.geometry = nextGeo;
        }
      }

      // Orient real 3D cylindrical covalent bonds between sequential residues
      for (let i = 0; i < this.bondCylinders.length; i++) {
        const a = this.residueMeshes[i].position;
        const b = this.residueMeshes[i + 1].position;
        const cyl = this.bondCylinders[i];
        this.tmpMid.addVectors(a, b).multiplyScalar(0.5);
        this.tmpDir.subVectors(b, a);
        const len = this.tmpDir.length();
        cyl.position.copy(this.tmpMid);
        cyl.scale.set(1, Math.max(0.01, len), 1);
        if (len > 0.0001) {
          this.tmpDir.divideScalar(len);
          this.tmpQuat.setFromUnitVectors(UP_AXIS, this.tmpDir);
          cyl.quaternion.copy(this.tmpQuat);
        }
      }

      if (this.contactLines) {
        const cPos = this.contactLines.geometry.getAttribute("position") as THREE.BufferAttribute;
        let ptr = 0;
        for (let i = 0; i < displayResidues.length; i++) {
          const ri = displayResidues[i];
          const a = this.residueMeshes[i].position;
          for (let j = i + 3; j < displayResidues.length; j++) {
            const rj = displayResidues[j];
            const isContactPair =
              (ri.hydrophobic && rj.hydrophobic) ||
              (ri.charge !== 0 && rj.charge !== 0 && ri.charge * rj.charge < 0);
            if (!isContactPair) continue;
            const b = this.residueMeshes[j].position;
            if (a.distanceTo(b) < 0.34 && ptr < 116) {
              cPos.setXYZ(ptr * 2, a.x, a.y, a.z);
              cPos.setXYZ(ptr * 2 + 1, b.x, b.y, b.z);
              ptr++;
            }
          }
        }
        this.contactLines.geometry.setDrawRange(0, ptr * 2);
        cPos.needsUpdate = true;
      }

      if (this.workUnitRing) {
        this.workUnitRing.scale.setScalar(0.98 + Math.sin(t * 1.8) * 0.01 + this.discoveryFlash * 0.06);
      }
      for (let g = 0; g < this.gyroRings.length; g++) {
        this.gyroRings[g].rotation.x += dt * (g === 0 ? 0.26 : -0.2);
        this.gyroRings[g].rotation.y += dt * (g === 0 ? 0.18 : -0.24);
      }
    }

    for (const pkt of this.protonPackets) {
      pkt.mesh.visible = snap.active;
      if (!snap.active) continue;
      pkt.t = (pkt.t + pkt.speed * (1 + this.excitement * 0.8) * dt) % 1;
      const y = 1.2 + pkt.t * 1.72;
      const ang = pkt.t * Math.PI * 4 + t * 3;
      const rad = 0.12 * Math.sin(pkt.t * Math.PI);
      pkt.mesh.position.set(Math.cos(ang) * rad, y, Math.sin(ang) * rad);
    }

    for (const fa of this.floatingAtoms) {
      fa.group.position.set(
        fa.base.x + Math.sin(t * fa.speed + fa.phase) * 0.14,
        fa.base.y + Math.cos(t * fa.speed * 0.85 + fa.phase) * 0.12,
        fa.base.z + Math.sin(t * fa.speed * 0.7 + fa.phase) * 0.14
      );
      fa.group.rotation.y = t * 0.9 + fa.phase;
      fa.group.rotation.x = t * 0.6;
      const targetScale = this.hoveredAtom === fa.group ? 1.38 : 1.0;
      fa.group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), Math.min(1, dt * 10));
    }

    if (this.constellationLines) {
      const cAttr = this.constellationLines.geometry.getAttribute("position") as THREE.BufferAttribute;
      let seg = 0;
      for (let i = 0; i < this.floatingAtoms.length; i++) {
        const a = this.floatingAtoms[i].group.position;
        for (let j = i + 1; j < this.floatingAtoms.length; j++) {
          const b = this.floatingAtoms[j].group.position;
          if (a.distanceTo(b) < 2.28) {
            cAttr.setXYZ(seg * 2, a.x, a.y, a.z);
            cAttr.setXYZ(seg * 2 + 1, b.x, b.y, b.z);
            seg++;
          }
        }
      }
      this.constellationLines.geometry.setDrawRange(0, seg * 2);
      cAttr.needsUpdate = true;
    }

    // Spin any active terrace treats gently
    for (const tr of this.treats) {
      if (!tr.eaten) {
        tr.mesh.rotation.y += dt * 2.5;
        tr.mesh.position.y = 0.48 + Math.sin(t * 4.2 + tr.pos.x) * 0.03;
      }
    }

    const blinking = Math.sin(t * 0.88) > 0.968;
    const activeTreat = this.treats.find((tr) => !tr.eaten) || null;
    const hasPetLounge = Boolean((this.impact.sectorsMask ?? 0) & (1 << 3));
    const isSleepy =
      Boolean(this.impact.petSleeping) ||
      ((this.impact.petMoodScore ?? 80) < 48 &&
        this.excitement < 0.08 &&
        !this.toyBall &&
        !activeTreat);

    for (let ci = 0; ci < this.companions.length; ci++) {
      const c = this.companions[ci];
      c.petReaction = Math.max(0, c.petReaction - dt * 0.75);
      if (c.wings) {
        const flutter = Math.sin(t * (5.2 + c.petReaction * 6) + ci) * 0.28;
        c.wings[0].rotation.y = -0.3 - flutter;
        c.wings[1].rotation.y = 0.3 + flutter;
      }

      // Autonomous 3D Pet AI: chase the bouncing toy ball, trot to dropped treats, stroll to Pet Lounge, or nap!
      let targetX = c.homePos.x;
      let targetZ = c.homePos.z;
      let moveSpeed = 1.15;
      let chasing = false;

      if (this.toyBall) {
        // Stay outside central hero vessel radius (0.82) and inside rotunda rim (1.58)
        const bx = this.toyBall.mesh.position.x;
        const bz = this.toyBall.mesh.position.z;
        const bRad = Math.hypot(bx, bz);
        if (bRad > 0.76 && bRad < 1.65) {
          targetX = bx;
          targetZ = bz;
          moveSpeed = 2.05;
          chasing = true;
        }
      } else if (activeTreat) {
        targetX = activeTreat.pos.x;
        targetZ = activeTreat.pos.z;
        moveSpeed = 1.75;
        chasing = true;
      } else if (hasPetLounge && ci === 0 && !isSleepy && t % 20 > 13.5) {
        // Cozy periodic stroll toward the Pet Lounge glass bridge when Sector 3 is built
        targetX = 1.28;
        targetZ = 1.06;
        moveSpeed = 0.72;
      }

      if (isSleepy && ci === 0 && c.petReaction < 0.05 && now - this.lastSleepBubbleAt > 6500) {
        this.lastSleepBubbleAt = now;
        this.spawnMoodBubble(c.group.position.clone().add(new THREE.Vector3(0, 0.72, 0)), "zzz");
      }

      const dx = targetX - c.group.position.x;
      const dz = targetZ - c.group.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.05) {
        const stepDist = Math.min(dist, moveSpeed * dt);
        const nx = c.group.position.x + (dx / dist) * stepDist;
        const nz = c.group.position.z + (dz / dist) * stepDist;
        // Gently steer around the center glass flask if needed
        const nextRad = Math.hypot(nx, nz);
        if (nextRad > 0.78) {
          c.group.position.x = nx;
          c.group.position.z = nz;
        } else {
          const push = 0.82 / Math.max(0.01, nextRad);
          c.group.position.x = nx * push;
          c.group.position.z = nz * push;
        }
        const desiredYaw = Math.atan2(dx, dz);
        let diffYaw = desiredYaw - c.group.rotation.y;
        while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
        while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
        c.group.rotation.y += diffYaw * Math.min(1, dt * 8);
      } else if (!chasing) {
        // When the player's researcher stands nearby, the pet turns warmly to look at them!
        const playerDist =
          this.walkMode && this.characterAvatar
            ? Math.hypot(this.charX - c.group.position.x, this.charZ - c.group.position.z)
            : 99;
        const idleTargetYaw =
          playerDist < 1.35
            ? Math.atan2(this.charX - c.group.position.x, this.charZ - c.group.position.z)
            : c.homeRotY;
        let diffYaw = idleTargetYaw - c.group.rotation.y;
        while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
        while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
        c.group.rotation.y += diffYaw * Math.min(1, dt * 4.8);
      }

      // If pet reaches the toy ball, give it a playful playful boop!
      if (this.toyBall && dist < 0.28) {
        this.toyBall.vel.x = (Math.random() - 0.5) * 2.4;
        this.toyBall.vel.y = 1.65;
        this.toyBall.vel.z = (Math.random() - 0.5) * 2.4;
        c.petReaction = Math.min(1.8, c.petReaction + 0.9);
        this.spawnColoredBurst(c.group.position.clone().add(new THREE.Vector3(0, 0.75, 0)), 6, [
          "#38bdf8",
          "#f472b6",
          "#ffffff"
        ]);
      }

      // If pet reaches a dropped elixir treat, nibble it with joyful emerald sparkles!
      if (activeTreat && dist < 0.26) {
        activeTreat.eaten = true;
        this.dynamicGroup.remove(activeTreat.mesh);
        c.petReaction = Math.min(1.8, c.petReaction + 1.1);
        soundEngine.playTap(1318.5);
        this.spawnColoredBurst(activeTreat.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), 8, [
          "#34d399",
          "#fbbf24",
          "#ffffff"
        ]);
      }

      const walkBounce = dist > 0.08 ? Math.abs(Math.sin(t * 14)) * 0.08 : 0;
      const happyHop =
        this.excitement > 0.08 || c.petReaction > 0.1
          ? Math.abs(Math.sin(t * 9.5)) * 0.12 * Math.max(this.excitement, c.petReaction)
          : 0;
      c.group.position.y = c.baseY + Math.max(walkBounce, happyHop);
      c.head.rotation.z = isSleepy
        ? 0.18 + Math.sin(t * 0.8) * 0.04
        : Math.sin(t * 1.6) * 0.08 + Math.sin(t * 11) * c.petReaction * 0.09;
      c.head.rotation.x = isSleepy
        ? 0.24
        : Math.sin(t * 1.1) * 0.05 - 0.07 - this.discoveryFlash * 0.22;

      if (c.isDog) {
        c.tail.rotation.z =
          Math.sin(t * (7.5 + (this.excitement + c.petReaction) * 9)) *
          (0.28 + Math.min(0.45, (this.excitement + c.petReaction) * 0.2));
      } else {
        c.tail.rotation.z = Math.sin(t * (2.2 + (this.excitement + c.petReaction) * 4)) * 0.24;
        if (c.paw) c.paw.rotation.x = 0.7 + Math.sin(t * (2.8 + (this.excitement + c.petReaction) * 5)) * 0.35;
      }
      for (const eye of c.eyes) eye.scale.y = blinking || (isSleepy && c.petReaction < 0.05) ? 0.16 : 1.0;
    }

    // Clean out eaten treats array once all finished
    if (this.treats.length > 0 && this.treats.every((tr) => tr.eaten)) {
      this.treats = [];
    }

    if (this.orreryGroup) this.orreryGroup.rotation.y = t * 0.3;
    for (const ma of this.microAlembics) {
      ma.group.position.y = ma.baseY + Math.sin(t * 2.1 + ma.phase) * 0.12;
    }

    if (this.hypercubeLines) {
      const attr = this.hypercubeLines.geometry.getAttribute("position") as THREE.BufferAttribute;
      const a1 = t * 0.36;
      const a2 = t * 0.24;
      const c1 = Math.cos(a1);
      const s1 = Math.sin(a1);
      const c2 = Math.cos(a2);
      const s2 = Math.sin(a2);
      const verts3: THREE.Vector3[] = [];
      for (let i = 0; i < 16; i++) {
        const x = i & 1 ? 1 : -1;
        const y = i & 2 ? 1 : -1;
        const z = i & 4 ? 1 : -1;
        const w = i & 8 ? 1 : -1;
        const x1 = x * c1 - w * s1;
        const w1 = x * s1 + w * c1;
        const y1 = y * c2 - z * s2;
        const z1 = y * s2 + z * c2;
        const p4 = 2.65 / (2.9 - w1);
        verts3.push(new THREE.Vector3(x1 * p4, y1 * p4, z1 * p4));
      }
      let edgeIdx = 0;
      for (let i = 0; i < 16; i++) {
        for (let bit = 0; bit < 4; bit++) {
          const j = i ^ (1 << bit);
          if (j > i) {
            attr.setXYZ(edgeIdx * 2, verts3[i].x, verts3[i].y, verts3[i].z);
            attr.setXYZ(edgeIdx * 2 + 1, verts3[j].x, verts3[j].y, verts3[j].z);
            edgeIdx++;
          }
        }
      }
      attr.needsUpdate = true;
    }

    if (this.shockwaveRing && this.shockwaveLife > 0) {
      this.shockwaveLife = Math.max(0, this.shockwaveLife - dt * 1.15);
      this.shockwaveRing.scale.setScalar(1 + (1 - this.shockwaveLife) * 4.2);
      (this.shockwaveRing.material as THREE.MeshBasicMaterial).opacity = this.shockwaveLife * 0.8;
    }

    for (const wr of this.waterRipples) {
      if (wr.life > 0) {
        wr.life = Math.max(0, wr.life - dt * 0.52);
        const progress = 1 - wr.life;
        wr.mesh.scale.setScalar(1 + progress * 0.28);
        (wr.mesh.material as THREE.MeshBasicMaterial).opacity = Math.sin(wr.life * Math.PI) * 0.52;
      }
    }

    // Subtle courtyard atmosphere particles (Silver Snow or Warm Light Motes)
    if (this.atmosphereMotes.length > 0) {
      const isSnow = this.atmosphereMode === "snow";
      for (const m of this.atmosphereMotes) {
        if (isSnow) {
          m.y -= m.speed * dt;
          if (m.y < 0.35) m.y = 4.6;
        } else {
          m.y += m.speed * 0.45 * dt;
          if (m.y > 4.6) m.y = 0.45;
        }
        m.mesh.position.set(
          m.baseX + Math.sin(t * 0.9 + m.phase) * 0.25,
          m.y,
          m.baseZ + Math.cos(t * 0.8 + m.phase) * 0.25
        );
      }
    }

    for (const wc of this.wingConduits) {
      wc.t = (wc.t + wc.speed * (1 + this.excitement * 0.6) * dt) % 1;
      wc.curve.getPointAt(Math.max(0, Math.min(0.999, wc.t)), wc.mesh.position);
    }

    for (let i = this.moodBubbles.length - 1; i >= 0; i--) {
      const mb = this.moodBubbles[i];
      mb.life += dt;
      const p = mb.life / mb.maxLife;
      const pop = Math.min(1, p * 5);
      mb.sprite.scale.setScalar(0.46 * (0.65 + pop * 0.35));
      mb.sprite.position.set(
        mb.baseX + Math.sin(t * 3.5 + i) * 0.05,
        mb.startY + p * 0.68,
        mb.baseZ
      );
      (mb.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - Math.pow(p, 1.8));
      if (mb.life >= mb.maxLife) {
        this.dynamicGroup.remove(mb.sprite);
        (mb.sprite.material as THREE.SpriteMaterial).dispose();
        this.moodBubbles.splice(i, 1);
      }
    }

    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life += dt;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.position.z += b.vz * dt;
      b.vy -= 1.8 * dt;
      b.mesh.rotation.x += dt * 4;
      b.mesh.rotation.y += dt * 3;
      const mat = b.mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.max(0, 1 - b.life / b.maxLife);
      if (b.life >= b.maxLife) {
        this.dynamicGroup.remove(b.mesh);
        mat.dispose();
        this.bursts.splice(i, 1);
      }
    }
  }

  private spawnFootstepPuff() {
    if (this.footPuffs.length === 0) return;
    const slot = this.footPuffs[this.nextFootPuffIdx % this.footPuffs.length];
    this.nextFootPuffIdx = (this.nextFootPuffIdx + 1) % this.footPuffs.length;
    slot.life = 1.0;
    slot.mesh.visible = true;
    slot.mesh.position.set(
      this.charX + (Math.random() - 0.5) * 0.14,
      this.charY + 0.035,
      this.charZ + (Math.random() - 0.5) * 0.14
    );
    slot.mesh.scale.setScalar(0.55);
    slot.vx = -this.charVx * 0.12 + (Math.random() - 0.5) * 0.18;
    slot.vy = 0.24 + Math.random() * 0.16;
    slot.vz = -this.charVz * 0.12 + (Math.random() - 0.5) * 0.18;

    const r = Math.hypot(this.charX, this.charZ);
    const surface: "rotunda" | "terrace" | "courtyard" =
      r <= 1.86 ? "rotunda" : Math.abs(this.charX) <= 2.32 && Math.abs(this.charZ) <= 2.32 ? "terrace" : "courtyard";
    soundEngine.playFootstep(surface, this.moveInput.sprint);
  }

  private stepWalkableCharacter(dt: number, t: number) {
    const prevX = this.charX;
    const prevZ = this.charZ;
    let targetVx = 0;
    let targetVz = 0;
    let turnBank = 0;

    if (this.creatorCameraMode && this.characterAvatar) {
      if (this.creatorTurntable && !this.userDragging) {
        this.charYaw += dt * 0.72;
        this.creatorTargetYaw = this.charYaw;
      } else {
        let diff = this.creatorTargetYaw - this.charYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.charYaw += diff * (1 - Math.exp(-8.5 * dt));
      }
    } else if (!this.creatorCameraMode && this.characterAvatar) {
      const inMag = Math.hypot(this.moveInput.dx, this.moveInput.dz);
      if (inMag > 0.05) {
        // Camera-relative horizontal walking vector (WASD / Arrows / D-Pad)
        this.camera.getWorldDirection(this.tmpCamFwd);
        this.tmpCamFwd.y = 0;
        if (this.tmpCamFwd.lengthSq() < 1e-6) this.tmpCamFwd.set(0, 0, -1);
        this.tmpCamFwd.normalize();
        this.tmpCamRight.crossVectors(this.tmpCamFwd, UP_AXIS).normalize();

        this.tmpMoveVec
          .set(0, 0, 0)
          .addScaledVector(this.tmpCamRight, this.moveInput.dx)
          .addScaledVector(this.tmpCamFwd, this.moveInput.dz);
        if (this.tmpMoveVec.lengthSq() > 1) this.tmpMoveVec.normalize();

        const maxSpeed = this.moveInput.sprint ? 3.2 : 2.2;
        targetVx = this.tmpMoveVec.x * maxSpeed;
        targetVz = this.tmpMoveVec.z * maxSpeed;
      } else if (this.walkTarget) {
        // Smooth point-and-click / station walk autopilot with central flask tangent steering
        const dx = this.walkTarget.x - this.charX;
        const dz = this.walkTarget.z - this.charZ;
        const dist = Math.hypot(dx, dz);
        if (dist <= 0.14) {
          const arrived = this.walkTarget.arriveStation ?? null;
          const arriveAction = this.walkTarget.arriveAction;
          this.walkTarget = null;
          if (arriveAction) {
            this.executeArrivalSimsAction(arriveAction);
          } else if (arrived) {
            const p = resolveItemPlacement(arrived, this.labDecor.customLayout);
            this.charYaw = p.yaw;
            this.characterAvatar.triggerEmote("wave");
            this.onStationArrived?.(arrived);
          }
        } else {
          let dirX = dx / dist;
          let dirZ = dz / dist;

          // Steer gracefully around central glass reactor if path cuts across origin
          const nextProbeX = this.charX + dirX * 0.3;
          const nextProbeZ = this.charZ + dirZ * 0.3;
          if (Math.hypot(nextProbeX, nextProbeZ) < 0.96) {
            const cross = this.charX * dirZ - this.charZ * dirX;
            const sign = cross >= 0 ? 1 : -1;
            const tx = -dirZ * sign;
            const tz = dirX * sign;
            dirX = dirX * 0.35 + tx * 0.94;
            dirZ = dirZ * 0.35 + tz * 0.94;
            const len = Math.hypot(dirX, dirZ) || 1;
            dirX /= len;
            dirZ /= len;
          }

          // Smooth approach ease-out near destination (brisker cruise speed on long suburb avenues!)
          const autoSpeed = Math.min(dist > 8 ? 3.6 : 2.6, Math.max(0.85, dist * 3.2));
          targetVx = dirX * autoSpeed;
          targetVz = dirZ * autoSpeed;
        }
      }

      // Frame-rate-independent exponential velocity inertia (acceleration & braking!)
      const hasInput = Math.hypot(targetVx, targetVz) > 0.05;
      const velRate = hasInput ? 11.5 : 15.0;
      const velAlpha = 1 - Math.exp(-velRate * dt);
      this.charVx += (targetVx - this.charVx) * velAlpha;
      this.charVz += (targetVz - this.charVz) * velAlpha;

      const curSpeed = Math.hypot(this.charVx, this.charVz);
      if (curSpeed > 0.04) {
        const resolved = this.resolveWalkObstacles(
          this.charX + this.charVx * dt,
          this.charZ + this.charVz * dt
        );
        this.charX = resolved.x;
        this.charZ = resolved.z;

        const targetYaw = Math.atan2(this.charVx, this.charVz);
        let diffYaw = targetYaw - this.charYaw;
        while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
        while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
        this.charYaw += diffYaw * (1 - Math.exp(-13.5 * dt));
        turnBank = -diffYaw * Math.min(1, curSpeed / 2.4) * 0.28;
      } else {
        this.charVx = 0;
        this.charVz = 0;
      }
    }

    const curSpeed = Math.hypot(this.charVx, this.charVz);
    const speedNorm = Math.min(1, curSpeed / 3.0);
    this.charMoving = !this.creatorCameraMode && curSpeed > 0.14;

    // Real Physical Step-by-Step Staircase Transitions (B1 <-> 1F <-> 2F <-> 3F!)
    const stairState = evaluateStairWalk(
      this.charX,
      this.charZ,
      this.activeFloor,
      this.labDecor.houseFloors,
      this.labDecor.hasBasement
    );
    if (
      !this.creatorCameraMode &&
      stairState.onStairs &&
      stairState.nextFloor !== undefined &&
      stairState.nextFloor !== this.activeFloor
    ) {
      this.activeFloor = stairState.nextFloor;
      this.applyFloorCutawayVisibility();
      this.onActiveFloorChange?.(this.activeFloor);
      soundEngine.playTap(
        this.activeFloor === 0 ? 660 : this.activeFloor === 3 ? 1318.5 : this.activeFloor === 2 ? 1046.5 : 880
      );
    }

    // Frame-rate-independent elevation smoothing across floating steps & multi-story floors
    const targetGroundY = stairState.onStairs
      ? stairState.y
      : getGroundElevationForFloor(this.activeFloor, this.charX, this.charZ, this.labDecor.houseSize);
    this.charY += (targetGroundY - this.charY) * (1 - Math.exp(-15 * dt));

    if (this.characterAvatar) {
      this.characterAvatar.root.position.set(this.charX, this.charY, this.charZ);
      this.characterAvatar.root.rotation.y = this.charYaw;
      this.characterAvatar.update(
        dt,
        t,
        speedNorm,
        this.charMoving,
        turnBank,
        () => this.spawnFootstepPuff()
      );
    }

    // Proximity station detection (respects custom moved station coordinates & current floor!)
    const nearStation =
      this.creatorCameraMode || !this.characterAvatar
        ? null
        : findNearestStationWithLayout(
            this.charX,
            this.charZ,
            this.activeFloor,
            this.labDecor.customLayout
          );
    const enRouteToSpecificStation = Boolean(
      (this.walkTarget?.arriveStation && this.walkTarget.arriveStation !== nearStation) ||
      this.walkTarget?.arriveAction
    );
    if (!enRouteToSpecificStation && nearStation !== this.lastNearStation) {
      this.lastNearStation = nearStation;
      this.onNearStationChange?.(nearStation);
    }

    // Frame-rate-independent third-person follow camera (preserves OrbitControls angle & zoom!)
    if (
      !this.creatorCameraMode &&
      this.characterAvatar &&
      this.cameraMode === "follow" &&
      !this.desiredCamPos
    ) {
      const movedX = this.charX - prevX;
      const movedZ = this.charZ - prevZ;
      if (!this.followCameraInitialized) {
        this.followCameraInitialized = true;
      } else if (Math.abs(movedX) > 1e-5 || Math.abs(movedZ) > 1e-5) {
        this.camera.position.x += movedX;
        this.camera.position.z += movedZ;
        this.controls.target.x += movedX;
        this.controls.target.z += movedZ;
      }
      if (!this.userDragging) {
        const desiredTargetX = this.charX;
        const desiredTargetY = this.charY + 0.68;
        const desiredTargetZ = this.charZ;
        const followAlpha = 1 - Math.exp(-5.6 * dt);
        const shiftX = (desiredTargetX - this.controls.target.x) * followAlpha;
        const shiftY = (desiredTargetY - this.controls.target.y) * followAlpha;
        const shiftZ = (desiredTargetZ - this.controls.target.z) * followAlpha;
        this.controls.target.x += shiftX;
        this.controls.target.y += shiftY;
        this.controls.target.z += shiftZ;
        this.camera.position.x += shiftX;
        this.camera.position.y += shiftY;
        this.camera.position.z += shiftZ;
      }
    }

    // Animate 5 physical 3D frosted-glass holographic monitors inside WebGL!
    this.diegeticMonitors?.animate(
      dt,
      t,
      this.camera,
      nearStation,
      this.activeStationHighlight,
      !this.creatorCameraMode
    );

    // Animate Sims Interactive Furniture, Homely Architecture, Botanical Parks & Gardens, Move Reticle & Town!
    this.simsFurniture?.update(dt, t);
    this.homeArchitecture?.update(dt, t);
    this.townGardens?.update(dt, t);
    const nowWall = Date.now();
    if (this.townGardens && nowWall - this.lastGardenSyncMs > 1200) {
      this.lastGardenSyncMs = nowWall;
      this.townGardens.syncGardenState(this.gardenState, this.labDecor.houseSize, nowWall);
    }
    this.neighborhoodWorld?.update(dt, t, this.charX, this.charZ);
    if (this.moveGhostRing && this.moveGhostRing.visible) {
      this.moveGhostRing.rotation.y += dt * 1.4;
      const pulse = 1 + Math.sin(t * 5.2) * 0.08;
      this.moveGhostRing.scale.set(pulse, 1, pulse);
    }

    if (this.visitingHostAvatar) {
      this.visitingHostWaveCooldown = Math.max(0, this.visitingHostWaveCooldown - dt);
      const hy = this.getWalkGroundY(this.visitingHostX, this.visitingHostZ);
      const dx = this.charX - this.visitingHostX;
      const dz = this.charZ - this.visitingHostZ;
      const dist = Math.hypot(dx, dz);
      const desiredYaw = dist < 3.6 ? Math.atan2(dx, dz) : 0.45;
      let diff = desiredYaw - this.visitingHostYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.visitingHostYaw += diff * (1 - Math.exp(-7.5 * dt));
      this.visitingHostAvatar.root.position.set(this.visitingHostX, hy, this.visitingHostZ);
      this.visitingHostAvatar.root.rotation.y = this.visitingHostYaw;
      this.visitingHostAvatar.update(dt, t + 1.1, 0, false);

      if (dist < 1.6 && this.visitingHostWaveCooldown <= 0) {
        this.visitingHostWaveCooldown = 10.0;
        this.visitingHostAvatar.triggerEmote("wave");
        this.spawnMoodBubble(
          new THREE.Vector3(this.visitingHostX, hy + 1.38, this.visitingHostZ),
          "heart"
        );
      }
    }

    // Animate glowing architectural station floor beacons (respects dollhouse floor cutaway!)
    for (const st of LAB_STATIONS) {
      const b = this.stationBeacons.get(st.id);
      if (!b) continue;
      const p = resolveItemPlacement(st.id, this.labDecor.customLayout);
      const showFloor =
        this.activeFloor === 0 ? p.floor === 0 : p.floor >= 1 && p.floor <= this.activeFloor;
      const isNear = nearStation === st.id;
      const isHighlighted = this.activeStationHighlight === st.id;
      const pulse = 1 + Math.sin(t * (isNear || isHighlighted ? 5.2 : 2.4)) * (isNear || isHighlighted ? 0.09 : 0.035);
      b.ring.scale.setScalar(isNear || isHighlighted ? 1.16 * pulse : pulse);
      (b.disc.material as THREE.MeshBasicMaterial).opacity = isNear || isHighlighted ? 0.3 : 0.12;
      (b.pillar.material as THREE.MeshBasicMaterial).opacity = isNear || isHighlighted ? 0.44 : 0.14;
      b.ring.visible = showFloor && !this.creatorCameraMode;
      b.disc.visible = showFloor && !this.creatorCameraMode;
      b.pillar.visible = showFloor && !this.creatorCameraMode;
    }

    // Animate subtle pearl breadcrumb trail while click-to-walking
    if (this.walkBreadcrumbs.length > 0) {
      const showCrumbs = Boolean(this.walkTarget) && !this.creatorCameraMode;
      for (let i = 0; i < this.walkBreadcrumbs.length; i++) {
        const dot = this.walkBreadcrumbs[i];
        dot.visible = showCrumbs;
        if (showCrumbs && this.walkTarget) {
          const frac = (i + 1) / (this.walkBreadcrumbs.length + 1);
          const bx = this.charX + (this.walkTarget.x - this.charX) * frac;
          const bz = this.charZ + (this.walkTarget.z - this.charZ) * frac;
          const by = this.getWalkGroundY(bx, bz) + 0.045 + Math.sin(t * 6 - i * 0.8) * 0.015;
          dot.position.set(bx, by, bz);
        }
      }
    }

    // Animate pooled zero-GC footstep dust puffs
    for (const pf of this.footPuffs) {
      if (pf.life > 0) {
        pf.life = Math.max(0, pf.life - dt * 2.4);
        pf.mesh.position.x += pf.vx * dt;
        pf.mesh.position.y += pf.vy * dt;
        pf.mesh.position.z += pf.vz * dt;
        const prog = 1 - pf.life;
        pf.mesh.scale.setScalar(0.55 + prog * 1.15);
        (pf.mesh.material as THREE.MeshBasicMaterial).opacity = pf.life * 0.45;
        if (pf.life <= 0) pf.mesh.visible = false;
      }
    }

    // Animate floor click-to-walk waypoint ring
    if (this.walkWaypointMesh && this.walkWaypointLife > 0) {
      this.walkWaypointLife = Math.max(0, this.walkWaypointLife - dt * 1.45);
      const prog = 1 - this.walkWaypointLife;
      this.walkWaypointMesh.scale.setScalar(0.5 + prog * 1.35);
      (this.walkWaypointMesh.material as THREE.MeshBasicMaterial).opacity =
        Math.sin(this.walkWaypointLife * Math.PI) * 0.78;
      if (this.walkWaypointLife <= 0) {
        this.walkWaypointMesh.visible = false;
      }
    }
  }

  private emitWalkTelemetry() {
    if (!this.onWalkTelemetry) return;
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    const anchors = {} as Record<LabStationId, ProjectedStationAnchor>;

    for (const st of LAB_STATIONS) {
      // Project just above the top rail of each physical 3D holographic monitor (follows moved stations across floors!)
      const p = resolveItemPlacement(st.id, this.labDecor.customLayout);
      const showOnFloor =
        this.activeFloor === 0 ? p.floor === 0 : p.floor >= 1 && p.floor <= this.activeFloor;
      const gy = getGroundElevationForFloor(p.floor, p.x, p.z, this.labDecor.houseSize);
      this.tmpProj.set(p.x, gy + 1.44, p.z);
      const distToCam = this.camera.position.distanceTo(this.tmpProj);
      this.tmpProj.project(this.camera);
      const visible =
        showOnFloor &&
        !this.creatorCameraMode &&
        this.tmpProj.z > -1 &&
        this.tmpProj.z < 1 &&
        this.tmpProj.x >= -1.25 &&
        this.tmpProj.x <= 1.25 &&
        this.tmpProj.y >= -1.25 &&
        this.tmpProj.y <= 1.25;
      anchors[st.id] = {
        id: st.id,
        x: (this.tmpProj.x * 0.5 + 0.5) * w,
        y: (-this.tmpProj.y * 0.5 + 0.5) * h,
        visible,
        distToChar: p.floor === this.activeFloor ? Math.hypot(this.charX - p.x, this.charZ - p.z) : 99,
        distToCam
      };
    }

    const leadPet = this.companions[0];
    this.onWalkTelemetry({
      anchors,
      charX: this.charX,
      charZ: this.charZ,
      charYaw: this.charYaw,
      petX: leadPet ? leadPet.group.position.x : null,
      petZ: leadPet ? leadPet.group.position.z : null,
      moving: this.charMoving,
      nearStation: this.lastNearStation,
      width: w,
      height: h
    });
  }
}
