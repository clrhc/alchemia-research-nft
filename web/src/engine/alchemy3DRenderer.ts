import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  createAlabasterTerrazzoTexture,
  createArchitecturalBlueprintFloorTexture,
  createBrushedTitaniumTexture,
  createMoodBubbleTexture,
  createRadialGlowTexture,
  createSoftAOTexture,
  type MoodBubbleKind
} from "./architectTextures";
import { SeededRNG, deriveTraitsFromSeed } from "./prng";
import type { ComputeSnapshot, ResidueNode } from "./researchCompute";
import { ResearchComputeRunner } from "./researchRunner";
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
export type LightingMood = "daylight" | "silver" | "moonlit";

export interface InteractiveEvent {
  kind: "pet-clicked" | "atom-popped";
  bonusCoins: number;
  combo?: number;
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

  private rootGroup = new THREE.Group();
  private dynamicGroup = new THREE.Group();
  private previewGhostGroup = new THREE.Group();
  private previewSectorId: number | null = null;
  private buildPopScale = 1;
  private proteinChainLength = -1;
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
  private bursts: Burst3D[] = [];
  private shockwaveRing: THREE.Mesh | null = null;

  private rafId = 0;
  private startTime = 0;
  private lastTime = 0;
  private lastUiEmit = 0;
  private displayFill = 0.44;
  private targetFill = 0.44;
  private excitement = 0;
  private discoveryFlash = 0;
  private shockwaveLife = 0;
  private builtSeed = "";
  private builtTier = -1;
  private builtSectorsMask = -1;
  private builtAccessoryRank = -1;
  private userDragging = false;

  // Scratch vectors for zero-GC bond cylinder alignment
  private tmpMid = new THREE.Vector3();
  private tmpDir = new THREE.Vector3();
  private tmpQuat = new THREE.Quaternion();

  constructor(
    container: HTMLElement,
    initialState: LiveImpactState,
    onComputeTick?: (snap: ComputeSnapshot) => void,
    onInteractiveEvent?: (ev: InteractiveEvent) => void
  ) {
    this.container = container;
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
      }
    );

    this.terrazzoTex = createAlabasterTerrazzoTexture();
    this.titaniumTex = createBrushedTitaniumTexture();
    this.blueprintTex = createArchitecturalBlueprintFloorTexture();
    this.aoTex = createSoftAOTexture();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#f8fafd");
    this.scene.fog = new THREE.FogExp2("#f8fafd", 0.032);

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = this.pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;

    const w = Math.max(260, container.clientWidth || 540);
    const h = Math.max(260, container.clientHeight || 540);
    this.camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 80);
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
    this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.addEventListener("pointerup", this.handlePointerUp);
    this.renderer.domElement.addEventListener("pointermove", this.handlePointerMove);

    this.setupArchitecturalStudioLighting();
    this.scene.add(this.rootGroup);
    this.rootGroup.add(this.dynamicGroup);
    this.rootGroup.add(this.previewGhostGroup);

    this.syncFillTarget();
    this.displayFill = this.targetFill;
    this.rebuild3DModel();
    this.resize();
  }

  private setupArchitecturalStudioLighting() {
    const hemi = new THREE.HemisphereLight("#ffffff", "#dae2ee", 1.2);
    this.hemiLight = hemi;
    this.scene.add(hemi);

    // Architectural studio key light casting crisp softbox shadows
    const key = new THREE.DirectionalLight("#fffdf9", 1.85);
    key.position.set(6.5, 11.2, 5.8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
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
    this.scene.add(aoDisc);
  }

  public setComputeActive(active: boolean) {
    this.compute.setActive(active);
    this.onComputeTick?.(this.compute.getSnapshot());
  }

  public selectBenchmark(benchmarkIndex: number) {
    this.compute.selectBenchmark(benchmarkIndex);
    this.onComputeTick?.(this.compute.getSnapshot());
    this.triggerCatalyticPulse(0.7);
  }

  public triggerFoldAction(action: "wiggle" | "shake") {
    this.compute.triggerFoldAction(action);
    this.discoveryFlash = 1.0;
    this.excitement = Math.min(1.5, this.excitement + (action === "shake" ? 0.75 : 0.45));
    this.spawnBurst(new THREE.Vector3(0, 3.06, 0), action === "shake" ? 14 : 9);
    if (action === "shake") soundEngine.playProtonPop(2);
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

  private applyLightingMood() {
    const pal = this.traits.palette;
    if (this.lightingMood === "silver") {
      this.scene.background = new THREE.Color("#edf1f7");
      this.scene.fog = new THREE.FogExp2("#edf1f7", 0.036);
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
      // Ethereal pearl-slate twilight — still light, airy, pure frosted glass!
      this.scene.background = new THREE.Color("#dfe6f2");
      this.scene.fog = new THREE.FogExp2("#dfe6f2", 0.04);
      this.renderer.toneMappingExposure = 1.12;
      if (this.hemiLight) this.hemiLight.intensity = 0.92;
      if (this.keyLight) {
        this.keyLight.color.set("#e2ecff");
        this.keyLight.intensity = 1.2;
      }
      if (this.rimLight) {
        this.rimLight.color.set("#93c5fd");
        this.rimLight.intensity = 1.35;
      }
      if (this.causticLight) this.causticLight.intensity = 2.65;
    } else {
      this.scene.background = new THREE.Color(pal.bgBottom);
      this.scene.fog = new THREE.FogExp2(pal.bgBottom, 0.03);
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
      this.desiredCamPos = new THREE.Vector3(2.4, 3.65, 2.7);
      this.desiredCamTarget = new THREE.Vector3(0, 3.05, 0);
    } else {
      this.desiredCamPos = new THREE.Vector3(5.45, 4.3, 6.25);
      this.desiredCamTarget = new THREE.Vector3(0, 1.55, 0);
    }
  }

  public resetCamera() {
    this.setCameraPreset("iso");
  }

  private handlePointerDown = (e: PointerEvent) => {
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (this.userDragging) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const atomTargets = this.floatingAtoms.map((a) => a.group);
    const hits = this.raycaster.intersectObjects(atomTargets, true);
    if (hits.length > 0) {
      let cur: THREE.Object3D | null = hits[0].object;
      while (cur && !atomTargets.includes(cur as THREE.Group)) cur = cur.parent;
      this.hoveredAtom = (cur as THREE.Group) || null;
      this.renderer.domElement.style.cursor = "pointer";
      return;
    }
    this.hoveredAtom = null;
    const petTargets = this.companions.map((c) => c.group);
    const petHits = petTargets.length > 0 ? this.raycaster.intersectObjects(petTargets, true) : [];
    this.renderer.domElement.style.cursor = petHits.length > 0 ? "pointer" : "grab";
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

    // 1. Did the user click directly on the 3D Cat or Dog? -> Instant joyful pet!
    const petTargets = this.companions.map((c) => c.group);
    if (petTargets.length > 0 && this.raycaster.intersectObjects(petTargets, true).length > 0) {
      this.triggerTamagotchiReaction("pet");
      this.onInteractiveEvent?.({ kind: "pet-clicked", bonusCoins: 1 });
      return;
    }

    // 2. Did the user tap a floating 3D Proton / Atom? -> Pop it with combo chime!
    const atomTargets = this.floatingAtoms.map((a) => a.group);
    const hits = this.raycaster.intersectObjects(atomTargets, true);
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
    }
  };

  private getAccessoryRank(): number {
    const petLvl = this.impact.petLevel ?? 1;
    const wus = this.impact.workUnits ?? 0;
    return (petLvl >= 2 ? 1 : 0) + (wus >= 10 ? 2 : 0);
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
    this.spawnBurst(new THREE.Vector3(0, 1.55, 0), Math.round(20 * intensity));
  }

  /**
   * Live 3D Tamagotchi Companion Reaction (Feed Treat / Pet Hearts / Play Proton Catch)
   */
  public triggerTamagotchiReaction(action: "feed" | "pet" | "play") {
    this.excitement = Math.min(1.75, this.excitement + (action === "play" ? 1.35 : 1.05));
    this.discoveryFlash = Math.max(this.discoveryFlash, 0.85);
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
    // Drop 3 glowing crystalline elixir treats on the rotunda terrace for the pet to trot over and nibble!
    const geo = new THREE.OctahedronGeometry(0.06, 0);
    for (let i = 0; i < 3; i++) {
      const ang = Math.atan2(nearPet.z, nearPet.x) + (i - 1) * 0.42;
      const rad = 0.96 + (i % 2) * 0.26;
      const tx = Math.cos(ang) * rad;
      const tz = Math.sin(ang) * rad;
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: i % 2 === 0 ? "#34d399" : "#fbbf24",
          emissive: i % 2 === 0 ? "#10b981" : "#f59e0b",
          emissiveIntensity: 0.95,
          roughness: 0.14
        })
      );
      mesh.position.set(tx, 0.48, tz);
      this.dynamicGroup.add(mesh);
      this.treats.push({ mesh, pos: new THREE.Vector3(tx, 0.48, tz), eaten: false });
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
    this.discoveryFlash = 1.0;
    this.excitement = Math.min(1.3, this.excitement + 0.45);
    this.spawnBurst(new THREE.Vector3(0, 3.05, 0), 10);
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
      if (this.startTime < 0) {
        this.startTime = now;
        this.lastTime = now;
      }
      const dt = Math.max(0.0001, Math.min(0.05, (now - this.lastTime) / 1000));
      const elapsedSec = Math.max(0, (now - this.startTime) / 1000);
      this.lastTime = now;
      this.step(dt, elapsedSec, now);
      this.controls.update();
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
    this.disposeObjectChildren(this.previewGhostGroup);
    this.clearDynamicGroup();
    this.terrazzoTex.dispose();
    this.titaniumTex.dispose();
    this.blueprintTex.dispose();
    this.aoTex.dispose();
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
    this.glowTextures.forEach((t) => t.dispose());
    this.glowTextures = [];
    this.bubbles = [];
    this.vaporRings = [];
    this.nucleusBalls = [];
    this.orbitals = [];
    this.floatingAtoms = [];
    this.condenserDroplets = [];
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
    this.liquidMesh = null;
    this.liquidTopMesh = null;
    this.liquidTopBasePos = null;
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
    this.dynamicGroup.add(this.shockwaveRing);
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
    this.dynamicGroup.add(tube);

    const pulseGeo = new THREE.SphereGeometry(0.036, 10, 10);
    const pulseMat = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      emissive: colorHex,
      emissiveIntensity: 1.4
    });
    for (let k = 0; k < 2; k++) {
      const m = new THREE.Mesh(pulseGeo, pulseMat);
      m.add(this.makeGlowSprite(colorHex, 0.24, 0.68));
      this.dynamicGroup.add(m);
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
    this.dynamicGroup.add(subBase);

    const subEdges = new THREE.LineSegments(new THREE.EdgesGeometry(subBaseGeo), edgeLineMat);
    subEdges.position.copy(subBase.position);
    this.dynamicGroup.add(subEdges);

    // Upper architectural terrace slab with recessed perimeter shadow groove
    const mainSlabGeo = new THREE.BoxGeometry(4.45, 0.11, 4.45);
    const mainSlab = new THREE.Mesh(mainSlabGeo, alabasterMat);
    mainSlab.position.y = 0.175;
    mainSlab.castShadow = true;
    mainSlab.receiveShadow = true;
    this.dynamicGroup.add(mainSlab);

    const mainEdges = new THREE.LineSegments(new THREE.EdgesGeometry(mainSlabGeo), edgeLineMat);
    mainEdges.position.copy(mainSlab.position);
    this.dynamicGroup.add(mainEdges);

    // Subtle warm-opal architectural cove light tucked into perimeter shadow reveal
    const coveMat = new THREE.MeshBasicMaterial({
      color: pal.liquidTop,
      transparent: true,
      opacity: 0.45
    });
    const coveBox = new THREE.Mesh(new THREE.BoxGeometry(4.52, 0.024, 4.52), coveMat);
    coveBox.position.y = 0.125;
    this.dynamicGroup.add(coveBox);

    // Architectural corner stainless survey pins
    for (const sx of [-2.28, 2.28]) {
      for (const sz of [-2.28, 2.28]) {
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.24, 14), titaniumMat);
        pin.position.set(sx, 0.12, sz);
        this.dynamicGroup.add(pin);
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
    this.dynamicGroup.add(poolBasin);

    // Stepped circular porcelain rotunda platform
    const rotunda = new THREE.Mesh(new THREE.CylinderGeometry(1.86, 1.94, 0.16, 64), alabasterMat);
    rotunda.position.y = 0.31;
    rotunda.castShadow = true;
    rotunda.receiveShadow = true;
    this.dynamicGroup.add(rotunda);

    // Architectural titanium rim coping around the rotunda edge
    const rotundaRim = new THREE.Mesh(new THREE.TorusGeometry(1.86, 0.018, 10, 72), titaniumMat);
    rotundaRim.rotation.x = Math.PI / 2;
    rotundaRim.position.y = 0.39;
    this.dynamicGroup.add(rotundaRim);

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
    this.dynamicGroup.add(glowRing);

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
    this.dynamicGroup.add(astroGroup);

    // Architectural Entrance Steps bridging over the reflecting pool into the rotunda!
    for (let s = 0; s < 3; s++) {
      const stepW = 1.24 - s * 0.14;
      const stepGeo = new THREE.BoxGeometry(stepW, 0.055, 0.22);
      const stepMesh = new THREE.Mesh(stepGeo, alabasterMat);
      stepMesh.position.set(0, 0.255 + s * 0.055, 2.08 - s * 0.15);
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      this.dynamicGroup.add(stepMesh);
      const sEdge = new THREE.LineSegments(new THREE.EdgesGeometry(stepGeo), edgeLineMat);
      sEdge.position.copy(stepMesh.position);
      this.dynamicGroup.add(sEdge);
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
      this.dynamicGroup.add(col);

      const baseFoot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.14), alabasterMat);
      baseFoot.position.set(cx, 0.42, cz);
      this.dynamicGroup.add(baseFoot);
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
      this.dynamicGroup.add(fin);
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
    this.dynamicGroup.add(roofMesh);

    // Subtle roof edge thickness fascia
    const fascia = new THREE.Mesh(
      new THREE.CylinderGeometry(2.02, 2.02, 0.07, 48, 1, true, Math.PI * 0.6, Math.PI * 0.8),
      alabasterMat
    );
    fascia.position.y = roofY - 0.035;
    this.dynamicGroup.add(fascia);

    for (const rRad of [0.96, 2.02]) {
      const rTrim = new THREE.Mesh(
        new THREE.TorusGeometry(rRad, 0.022, 10, 48, Math.PI * 0.8),
        titaniumMat
      );
      rTrim.rotation.x = Math.PI / 2;
      rTrim.rotation.z = Math.PI * 1.1;
      rTrim.position.y = roofY;
      this.dynamicGroup.add(rTrim);
    }

    // Curved Glass Mezzanine Balustrade wrapping the back-left arc
    const rail = new THREE.Mesh(
      new THREE.TorusGeometry(1.66, 0.014, 8, 36, Math.PI * 0.42),
      titaniumMat
    );
    rail.rotation.x = Math.PI / 2;
    rail.rotation.z = Math.PI * 1.05;
    rail.position.y = 0.72;
    this.dynamicGroup.add(rail);

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
    this.dynamicGroup.add(planter);

    // Colored glass caustic light washing gently over the white architectural walls!
    const causticLight = new THREE.PointLight(pal.liquidMid, 1.85 + tier * 0.25, 6.8);
    causticLight.position.set(0, 1.35, 0.15);
    this.causticLight = causticLight;
    this.dynamicGroup.add(causticLight);

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
    this.dynamicGroup.add(causticDisc);
    this.applyLightingMood();

    // Central raised titanium induction reactor plinth under the hero flask
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.76, 0.12, 48), titaniumMat);
    pad.position.y = 0.45;
    pad.castShadow = true;
    pad.receiveShadow = true;
    this.dynamicGroup.add(pad);

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
    this.dynamicGroup.add(coilRing);
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

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      transmission: 0.92,
      opacity: 1,
      transparent: true,
      roughness: 0.04,
      metalness: 0.02,
      ior: 1.47,
      thickness: 0.42,
      attenuationColor: new THREE.Color("#e8f1fb"),
      attenuationDistance: 1.35,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.55,
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

    this.dynamicGroup.add(vesselGroup);
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
    this.dynamicGroup.add(nucGroup);

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
      this.dynamicGroup.add(ring);

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
      this.dynamicGroup.add(tube);

      // Precision titanium stopcock valve cuff halfway along condenser
      const midPt = curve.getPointAt(0.48);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.07, 16), silverMat);
      cuff.position.copy(midPt);
      this.dynamicGroup.add(cuff);

      // Glass receiving catch-bulb at condenser outlet
      const endPt = curve.getPointAt(1);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 18), tubeGlassMat);
      bulb.position.set(endPt.x, endPt.y - 0.12, endPt.z);
      this.dynamicGroup.add(bulb);

      for (let d = 0; d < 2; d++) {
        const drop = new THREE.Mesh(
          new THREE.SphereGeometry(0.032, 12, 12),
          new THREE.MeshStandardMaterial({
            color: d === 0 ? pal.liquidTop : pal.accent,
            emissive: d === 0 ? pal.liquidMid : pal.accent,
            emissiveIntensity: 0.95
          })
        );
        this.dynamicGroup.add(drop);
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
    this.dynamicGroup.add(mastGroup);

    // Floating 3D Live Energy Minimization Ribbon
    const eGeo = new THREE.BufferGeometry();
    eGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(48 * 3), 3));
    const eLine = new THREE.Line(
      eGeo,
      new THREE.LineBasicMaterial({ color: pal.liquidMid, transparent: true, opacity: 0.85 })
    );
    eLine.position.set(-1.35, 2.46, -0.82);
    this.energyCurveLine = eLine;
    this.dynamicGroup.add(eLine);

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
    this.dynamicGroup.add(rack);
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
      new THREE.LineBasicMaterial({ color: pal.accent, transparent: true, opacity: 0.65 })
    );
    this.contactLines = cLines;
    pGroup.add(cLines);

    this.dynamicGroup.add(pGroup);

    // Helical Proton Compute Stream rising from nucleus to folding chamber
    const pktGeo = new THREE.SphereGeometry(0.032, 10, 10);
    for (let i = 0; i < 8; i++) {
      const col = i % 2 === 0 ? pal.electron : pal.proton;
      const m = new THREE.Mesh(
        pktGeo,
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.2 })
      );
      m.add(this.makeGlowSprite(col, 0.24, 0.65));
      this.dynamicGroup.add(m);
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
    this.residueMeshes = [];
    this.bondCylinders = [];
    this.proteinChainLength = residues.length;

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

      this.dynamicGroup.add(g);
      this.floatingAtoms.push({ group: g, base, phase: rng.range(0, Math.PI * 2), speed: rng.range(0.7, 1.3) });
    }

    if (tier >= 3) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * count * 6), 3));
      this.constellationLines = new THREE.LineSegments(
        geo,
        new THREE.LineBasicMaterial({ color: pal.electron, transparent: true, opacity: 0.36 })
      );
      this.dynamicGroup.add(this.constellationLines);
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
    this.dynamicGroup.add(pad);
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

    if (
      variant === "siamese-cat" ||
      this.traits.sub.companionAccessory === "halo" ||
      (this.impact.workUnits ?? 0) >= 10
    ) {
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

    if ((this.impact.petLevel ?? 1) >= 2) {
      const rimMat = new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.88, roughness: 0.18 });
      const lensMat = new THREE.MeshPhysicalMaterial({
        color: pal.liquidTop,
        emissive: pal.electron,
        emissiveIntensity: 0.35,
        roughness: 0.08,
        transmission: 0.62,
        transparent: true
      });
      for (const side of [-1, 1]) {
        const gRim = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.01, 10, 22), rimMat);
        gRim.position.set(side * 0.072, 0.145, 0.17);
        gRim.rotation.x = -0.32;
        head.add(gRim);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 18), lensMat);
        lens.position.copy(gRim.position);
        lens.rotation.copy(gRim.rotation);
        head.add(lens);
      }
    }

    if ((this.impact.sectorsMask ?? 0) === 0b111111 || (this.impact.complexityTier || 1) >= 5) {
      const crown = new THREE.Mesh(
        new THREE.TorusGeometry(0.11, 0.015, 10, 24),
        new THREE.MeshStandardMaterial({
          color: "#f8e7b5",
          emissive: "#f59e0b",
          emissiveIntensity: 0.35,
          metalness: 0.92,
          roughness: 0.14
        })
      );
      crown.rotation.x = Math.PI / 2;
      crown.position.y = 0.32;
      head.add(crown);
    }

    group.add(head);
    this.dynamicGroup.add(group);
    this.companions.push({
      group,
      head,
      tail: tailPivot,
      paw,
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

    if (
      variant === "shiba-dog" ||
      this.traits.sub.companionAccessory === "goggles" ||
      (this.impact.petLevel ?? 1) >= 2
    ) {
      const strap = new THREE.Mesh(
        new THREE.TorusGeometry(0.205, 0.015, 8, 32),
        new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.38 })
      );
      strap.rotation.x = Math.PI / 2 - 0.35;
      strap.position.set(0, 0.11, 0.02);
      head.add(strap);

      const lensMat = new THREE.MeshPhysicalMaterial({
        color: pal.liquidTop,
        emissive: pal.electron,
        emissiveIntensity: 0.4,
        roughness: 0.06,
        transmission: 0.58,
        transparent: true
      });
      const rimMat = new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.88, roughness: 0.18 });
      for (const side of [-1, 1]) {
        const gRim = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.012, 10, 24), rimMat);
        gRim.position.set(side * 0.075, 0.15, 0.175);
        gRim.rotation.x = -0.35;
        head.add(gRim);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.056, 20), lensMat);
        lens.position.copy(gRim.position);
        lens.rotation.copy(gRim.rotation);
        head.add(lens);
      }
    }

    if ((this.impact.sectorsMask ?? 0) === 0b111111 || (this.impact.complexityTier || 1) >= 5) {
      const crown = new THREE.Mesh(
        new THREE.TorusGeometry(0.115, 0.015, 10, 24),
        new THREE.MeshStandardMaterial({
          color: "#f8e7b5",
          emissive: "#f59e0b",
          emissiveIntensity: 0.35,
          metalness: 0.92,
          roughness: 0.14
        })
      );
      crown.rotation.x = Math.PI / 2;
      crown.position.y = 0.33;
      head.add(crown);
    }

    group.add(head);
    this.dynamicGroup.add(group);
    this.companions.push({
      group,
      head,
      tail: tailPivot,
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

    this.dynamicGroup.add(group);
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

    this.dynamicGroup.add(group);
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

    this.dynamicGroup.add(group);
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

    this.dynamicGroup.add(group);
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
      this.dynamicGroup.add(g);
      this.floatingAtoms.push({ group: g, base: basePos, phase: p * 2.1, speed: 1.25 });
    }

    const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), metal);
    finial.position.y = 2.92;
    finial.add(this.makeGlowSprite("#8b5cf6", 0.65, 0.72));
    group.add(finial);

    this.dynamicGroup.add(group);
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
      transmission: 0.88,
      roughness: 0.06,
      ior: 1.5,
      thickness: 0.14,
      transparent: true,
      opacity: 0.65
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
    this.dynamicGroup.add(group);
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
    this.dynamicGroup.add(oGroup);
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

      this.dynamicGroup.add(g);
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
    this.dynamicGroup.add(lines);
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

    if (!this.userDragging) this.controls.autoRotate = true;

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
      if (this.toyBall.mesh.position.y < 0.5) {
        this.toyBall.mesh.position.y = 0.5;
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

    // Real 3D Ball-and-Stick Protein Folding Update (Angstroms -> 3D Scene Units)
    if (this.proteinGroup && this.residueMeshes.length === snap.residues.length) {
      this.proteinGroup.rotation.y = t * 0.48;
      // Scale cleanly whether folding 10-aa Chignolin or 36-aa Villin HP36
      const angstromScale = snap.residues.length > 26 ? 0.039 : snap.residues.length > 16 ? 0.05 : 0.062;

      for (let i = 0; i < snap.residues.length; i++) {
        const r = snap.residues[i];
        this.residueMeshes[i].position.set(r.x * angstromScale, r.y * angstromScale, r.z * angstromScale);
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
        for (let i = 0; i < snap.residues.length; i++) {
          const ri = snap.residues[i];
          const a = this.residueMeshes[i].position;
          for (let j = i + 3; j < snap.residues.length; j++) {
            const rj = snap.residues[j];
            const isContactPair =
              (ri.hydrophobic && rj.hydrophobic) ||
              (ri.charge !== 0 && rj.charge !== 0 && ri.charge * rj.charge < 0);
            if (!isContactPair) continue;
            const b = this.residueMeshes[j].position;
            if (a.distanceTo(b) < 0.36 && ptr < 116) {
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
        this.workUnitRing.scale.setScalar(0.96 + Math.sin(t * 3.5) * 0.02 + this.discoveryFlash * 0.16);
      }
      for (let g = 0; g < this.gyroRings.length; g++) {
        this.gyroRings[g].rotation.x += dt * (g === 0 ? 0.65 : -0.5);
        this.gyroRings[g].rotation.y += dt * (g === 0 ? 0.45 : -0.7);
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
    for (const c of this.companions) {
      c.petReaction = Math.max(0, c.petReaction - dt * 0.75);

      // Autonomous 3D Pet AI: chase the bouncing toy ball, trot to dropped treats, or return to cushion!
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
        let diffYaw = c.homeRotY - c.group.rotation.y;
        while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
        while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
        c.group.rotation.y += diffYaw * Math.min(1, dt * 4);
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
      c.head.rotation.z = Math.sin(t * 1.6) * 0.08 + Math.sin(t * 11) * c.petReaction * 0.09;
      c.head.rotation.x = Math.sin(t * 1.1) * 0.05 - 0.07 - this.discoveryFlash * 0.22;

      if (c.isDog) {
        c.tail.rotation.z =
          Math.sin(t * (7.5 + (this.excitement + c.petReaction) * 9)) *
          (0.28 + Math.min(0.45, (this.excitement + c.petReaction) * 0.2));
      } else {
        c.tail.rotation.z = Math.sin(t * (2.2 + (this.excitement + c.petReaction) * 4)) * 0.24;
        if (c.paw) c.paw.rotation.x = 0.7 + Math.sin(t * (2.8 + (this.excitement + c.petReaction) * 5)) * 0.35;
      }
      for (const eye of c.eyes) eye.scale.y = blinking ? 0.15 : 1.0;
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
}
