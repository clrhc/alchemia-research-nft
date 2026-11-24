import * as THREE from "three";
import { createFastArchitecturalGlass } from "./browserCompat";
import {
  createGardenPathTexture,
  createRadialGlowTexture
} from "./architectTextures";
import {
  GARDEN_PLOT_DEFS,
  PLANT_SPECIES_BY_ID,
  computePlotGrowth,
  type GardenPlotDef,
  type GardenWorldState,
  type PlantSpeciesDef
} from "./gardenState";
import { getGroundElevationForFloor, type HouseSizeLevel } from "./homeLayout";
import { TOWN_PARK_CENTER } from "./neighborhoodLayout";
import type { SimsObjectTarget } from "./simsState";

interface GardenPlotRig {
  def: GardenPlotDef;
  group: THREE.Group;
  plantGroup: THREE.Group;
  soilMat: THREE.MeshStandardMaterial;
  readyHalo: THREE.Mesh;
  lastKey: string;
}

interface KoiFishRig {
  group: THREE.Group;
  angle: number;
  radius: number;
  speed: number;
  centerX: number;
  centerZ: number;
}

interface FloatingPetalRig {
  mesh: THREE.Mesh;
  baseX: number;
  baseZ: number;
  baseY: number;
  phase: number;
}

interface SplashDroplet {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

/**
 * Procedural 3D Alchemia Town Botanical Parks, Grand Glass Conservatory, Koi Pond,
 * 4 Inner-Town Pocket Flower Parks, and 10 Live Growing Interactive Garden Planter Beds!
 *
 * Strictly mounted inside `walkCampusGroup` (so Home mint card & Gallery thumbnails stay pure).
 * Zero external 3D files — 100% procedural Three.js + instanced flowers matching ALCHEMIA's
 * brushed-silver, honed-alabaster, and frosted-glass architectural palette.
 */
export class TownGardens3D {
  public readonly group = new THREE.Group();
  private parksGroup = new THREE.Group();
  private plotsGroup = new THREE.Group();
  private fxGroup = new THREE.Group();

  private terrazzoTex: THREE.Texture;
  private titaniumTex: THREE.Texture;
  private pathTex: THREE.CanvasTexture;
  private warmGlowTex: THREE.CanvasTexture;
  private interactiveRoots: THREE.Object3D[] = [];
  private obstacles: Array<[number, number, number]> = [];

  private plotRigs = new Map<string, GardenPlotRig>();
  private koiFish: KoiFishRig[] = [];
  private petals: FloatingPetalRig[] = [];
  private conservatoryMist: THREE.Mesh[] = [];
  private splashDroplets: SplashDroplet[] = [];
  private sundialSpinner: THREE.Object3D | null = null;

  constructor(terrazzoTex: THREE.Texture, titaniumTex: THREE.Texture) {
    this.terrazzoTex = terrazzoTex;
    this.titaniumTex = titaniumTex;
    this.pathTex = createGardenPathTexture();
    this.pathTex.repeat.set(3, 3);
    this.warmGlowTex = createRadialGlowTexture("#fde68a");

    this.group.add(this.parksGroup, this.plotsGroup, this.fxGroup);

    this.buildGrandBotanicalPark();
    this.buildSakuraPicnicPark();
    this.buildHerbOrchardPark();
    this.buildRoseLavenderPark();
    this.buildInnerPocketFlowerParks();
    this.buildGardenPlanterBoxes();
  }

  private makeSharedMaterials() {
    const stoneMat = new THREE.MeshStandardMaterial({
      map: this.terrazzoTex,
      color: "#f7f9fc",
      roughness: 0.45
    });
    const metalMat = new THREE.MeshStandardMaterial({
      map: this.titaniumTex,
      color: "#cbd5e1",
      roughness: 0.22,
      metalness: 0.88
    });
    const pathMat = new THREE.MeshStandardMaterial({
      map: this.pathTex,
      color: "#f6f2e8",
      roughness: 0.72
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: "#c8a986",
      roughness: 0.68
    });
    const glassMat = createFastArchitecturalGlass({
      color: "#ecfdf5",
      opacity: 0.48,
      roughness: 0.06
    });
    const lawnMat = new THREE.MeshStandardMaterial({
      color: "#bbf7d0",
      roughness: 0.86
    });
    const hedgeMat = new THREE.MeshStandardMaterial({
      color: "#6ee7b7",
      roughness: 0.68
    });
    return { stoneMat, metalMat, pathMat, woodMat, glassMat, lawnMat, hedgeMat };
  }

  private tagTarget(root: THREE.Object3D, target: SimsObjectTarget) {
    root.traverse((obj) => {
      obj.userData.simsTarget = target;
    });
    this.interactiveRoots.push(root);
  }

  // ============================================================================
  // 1. GRAND ALCHEMIA BOTANICAL PARK & GLASS CONSERVATORY — SE Quadrant (15.2, 15.2)
  // ============================================================================
  private buildGrandBotanicalPark() {
    const [cx, cz] = TOWN_PARK_CENTER;
    const { stoneMat, metalMat, pathMat, woodMat, glassMat, lawnMat, hedgeMat } =
      this.makeSharedMaterials();
    const park = new THREE.Group();
    park.position.set(cx, 0, cz);

    // Rectangular City-Block Botanical Park Lawn + Honed Stone Curb Framing the Entire Block!
    const meadow = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.05, 9.2), lawnMat);
    meadow.position.y = 0.012;
    meadow.receiveShadow = true;
    park.add(meadow);

    const stoneBorder = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(9.64, 0.07, 9.24)),
      new THREE.LineBasicMaterial({ color: "#cbd5e1", transparent: true, opacity: 0.9 })
    );
    stoneBorder.position.y = 0.025;
    park.add(stoneBorder);

    // Winding stepping-stone promenade ring + paved North & West park entrances connecting to Main St & Maple Ln!
    const loopPath = new THREE.Mesh(new THREE.RingGeometry(2.45, 3.25, 40), pathMat);
    loopPath.rotation.x = -Math.PI / 2;
    loopPath.position.y = 0.043;
    loopPath.receiveShadow = true;
    park.add(loopPath);

    const entryWalkNorth = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.04, 4.6), pathMat);
    entryWalkNorth.position.set(0, 0.036, -3.1);
    entryWalkNorth.receiveShadow = true;
    const entryWalkWest = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.04, 1.45), pathMat);
    entryWalkWest.position.set(-3.1, 0.036, 0);
    entryWalkWest.receiveShadow = true;
    park.add(entryWalkNorth, entryWalkWest);

    // Blooming Rose Archway welcoming visitors at the North Main St park entrance!
    const archGroup = new THREE.Group();
    archGroup.position.set(0, 0.04, -4.35);
    const archTube = new THREE.Mesh(
      new THREE.TorusGeometry(0.98, 0.045, 10, 28, Math.PI),
      metalMat
    );
    archTube.position.y = 0.88;
    archGroup.add(archTube);
    for (const sx of [-0.98, 0.98]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.92, 10), metalMat);
      leg.position.set(sx, 0.46, 0);
      archGroup.add(leg);
    }
    const roseMat = new THREE.MeshStandardMaterial({
      color: "#fb7185",
      emissive: "#f43f5e",
      emissiveIntensity: 0.22,
      roughness: 0.45
    });
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      const vine = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), hedgeMat);
      vine.position.set(Math.cos(a) * 0.98, 0.9 + Math.sin(a) * 0.98, 0);
      archGroup.add(vine);
      if (i % 2 === 0) {
        const rose = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), roseMat);
        rose.position.set(Math.cos(a) * 1.04, 0.92 + Math.sin(a) * 1.04, 0.07);
        archGroup.add(rose);
      }
    }
    park.add(archGroup);

    // ---- GRAND VICTORIAN-MODERN GLASS BOTANICAL CONSERVATORY (Centerpiece!) ----
    const conservatory = new THREE.Group();
    conservatory.position.set(0, 0.04, -0.35);

    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.92, 2.08, 0.22, 8), stoneMat);
    plinth.position.y = 0.11;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    conservatory.add(plinth);

    const wallBase = new THREE.Mesh(new THREE.CylinderGeometry(1.78, 1.82, 0.42, 8), stoneMat);
    wallBase.position.y = 0.42;
    conservatory.add(wallBase);

    const glassWall = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.76, 1.24, 8), glassMat);
    glassWall.position.y = 1.24;
    conservatory.add(glassWall);

    // 8 Sleek Brushed-Silver Ribbed Conservatory Arches
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const pilaster = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 1.66, 8), metalMat);
      pilaster.position.set(Math.cos(ang) * 1.75, 1.04, Math.sin(ang) * 1.75);
      conservatory.add(pilaster);
    }

    // Domed Crystal Roof + Top Cupola Lantern
    const domeGeo = new THREE.SphereGeometry(1.74, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const dome = new THREE.Mesh(domeGeo, glassMat);
    dome.scale.set(1, 0.72, 1);
    dome.position.y = 1.84;
    conservatory.add(dome);

    const domeRim = new THREE.Mesh(new THREE.TorusGeometry(1.74, 0.045, 8, 32), metalMat);
    domeRim.rotation.x = Math.PI / 2;
    domeRim.position.y = 1.86;
    conservatory.add(domeRim);

    const cupola = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.36, 8), glassMat);
    cupola.position.y = 3.12;
    conservatory.add(cupola);
    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.32, 8), metalMat);
    finial.position.y = 3.46;
    conservatory.add(finial);

    // Lush Indoor Palms, Glowing Orchids & Misting Water Basin inside the Glass Conservatory!
    const palmTrunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.1, 1.35, 8),
      new THREE.MeshStandardMaterial({ color: "#78716c", roughness: 0.78 })
    );
    palmTrunk.position.y = 0.88;
    conservatory.add(palmTrunk);

    const frondMat = new THREE.MeshStandardMaterial({
      color: "#34d399",
      emissive: "#059669",
      emissiveIntensity: 0.18,
      roughness: 0.42
    });
    for (let f = 0; f < 7; f++) {
      const a = (f / 7) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), frondMat);
      frond.scale.set(0.42, 0.16, 1.45);
      frond.position.set(Math.cos(a) * 0.46, 1.62 + (f % 2) * 0.14, Math.sin(a) * 0.46);
      frond.rotation.set(0.28, -a + Math.PI / 2, 0);
      conservatory.add(frond);
    }

    const orchidCols = ["#38bdf8", "#f472b6", "#a78bfa", "#fbbf24"];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.24, 12), stoneMat);
      pot.position.set(Math.cos(a) * 1.05, 0.34, Math.sin(a) * 1.05);
      conservatory.add(pot);
      const bloom = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.18, 0),
        new THREE.MeshStandardMaterial({
          color: orchidCols[i % orchidCols.length],
          emissive: orchidCols[i % orchidCols.length],
          emissiveIntensity: 0.45
        })
      );
      bloom.position.set(Math.cos(a) * 1.05, 0.62, Math.sin(a) * 1.05);
      conservatory.add(bloom);
    }

    // Animated rising warm mist particles inside conservatory
    const mistGeo = new THREE.SphereGeometry(0.065, 8, 8);
    const mistMat = new THREE.MeshBasicMaterial({
      color: "#e0f2fe",
      transparent: true,
      opacity: 0.42
    });
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(mistGeo, mistMat);
      m.position.set(Math.cos(i * 1.3) * 0.55, 0.8 + i * 0.28, Math.sin(i * 1.3) * 0.55);
      conservatory.add(m);
      this.conservatoryMist.push(m);
    }

    // Floating Conservatory Sign Plaque
    const signTex = this.createParkPlaqueTexture("Botanical Conservatory", "Community Greenhouse");
    const sign = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: signTex, transparent: true, depthWrite: false })
    );
    sign.scale.set(1.9, 0.62, 1);
    sign.position.set(0, 4.08, 0);
    conservatory.add(sign);

    this.tagTarget(conservatory, {
      kind: "conservatory",
      label: "Grand Botanical Conservatory",
      worldX: cx - 1.6,
      worldZ: cz - 2.4
    });
    park.add(conservatory);
    this.obstacles.push([cx, cz - 0.35, 2.05]);

    // ---- TRANQUIL PARK KOI & LOTUS POND (South-West edge of Grand Park) ----
    const pondLocalX = -1.65;
    const pondLocalZ = 2.45;
    const pondGroup = new THREE.Group();
    pondGroup.position.set(pondLocalX, 0.03, pondLocalZ);

    const pondRim = new THREE.Mesh(
      new THREE.TorusGeometry(1.38, 0.12, 8, 28),
      stoneMat
    );
    pondRim.rotation.x = Math.PI / 2;
    pondRim.scale.set(1.22, 0.92, 1);
    pondRim.position.y = 0.04;
    pondGroup.add(pondRim);

    const pondWater = new THREE.Mesh(
      new THREE.CircleGeometry(1.34, 28),
      new THREE.MeshPhysicalMaterial({
        color: "#67e8f9",
        emissive: "#0284c7",
        emissiveIntensity: 0.25,
        roughness: 0.05,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.86
      })
    );
    pondWater.rotation.x = -Math.PI / 2;
    pondWater.scale.set(1.22, 0.92, 1);
    pondWater.position.y = 0.055;
    pondGroup.add(pondWater);

    // Floating emerald lily pads & blooming pink lotuses
    const padMat = new THREE.MeshStandardMaterial({ color: "#34d399", roughness: 0.5 });
    const lotusMat = new THREE.MeshStandardMaterial({
      color: "#fbcfe8",
      emissive: "#f472b6",
      emissiveIntensity: 0.35
    });
    const padCoords: Array<[number, number, boolean]> = [
      [-0.62, 0.25, true],
      [-0.28, -0.55, false],
      [0.65, -0.32, true],
      [0.42, 0.48, false],
      [0.85, 0.15, true]
    ];
    for (const [px, pz, hasFlower] of padCoords) {
      const lp = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.015, 14), padMat);
      lp.position.set(px, 0.068, pz);
      pondGroup.add(lp);
      if (hasFlower) {
        const fl = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.1, 7), lotusMat);
        fl.rotation.x = Math.PI;
        fl.position.set(px, 0.11, pz);
        pondGroup.add(fl);
      }
    }

    // 5 Animated Swimming Golden-Orange & Pearl Koi Fish!
    const koiCols = ["#fb923c", "#f97316", "#fde047", "#f8fafc", "#fb7185"];
    for (let k = 0; k < 5; k++) {
      const koi = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.042, 0.12, 4, 8),
        new THREE.MeshStandardMaterial({
          color: koiCols[k],
          emissive: koiCols[k],
          emissiveIntensity: 0.25,
          roughness: 0.22
        })
      );
      body.rotation.x = Math.PI / 2;
      koi.add(body);
      const tail = new THREE.Mesh(
        new THREE.ConeGeometry(0.045, 0.1, 4),
        new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.3 })
      );
      tail.rotation.x = -Math.PI / 2;
      tail.position.z = -0.11;
      koi.add(tail);
      koi.position.y = 0.064;
      pondGroup.add(koi);
      this.koiFish.push({
        group: koi,
        angle: (k / 5) * Math.PI * 2,
        radius: 0.42 + (k % 3) * 0.24,
        speed: 0.45 + (k % 3) * 0.16,
        centerX: 0,
        centerZ: 0
      });
    }

    // Miniature Arched Timber & Silver Footbridge over the Koi Pond edge
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.06, 1.35), woodMat);
    bridge.position.set(0.15, 0.18, 0);
    bridge.rotation.y = 0.4;
    pondGroup.add(bridge);

    park.add(pondGroup);

    // ---- PARK GAZEBO & CLICKABLE PARK BENCH + PICNIC AREA ----
    const gazebo = new THREE.Group();
    gazebo.position.set(1.65, 0.04, 2.55);

    const gDeck = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.24, 0.1, 8), woodMat);
    gDeck.position.y = 0.05;
    gDeck.receiveShadow = true;
    gazebo.add(gDeck);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 1.48, 8), metalMat);
      col.position.set(Math.cos(a) * 1.04, 0.82, Math.sin(a) * 1.04);
      gazebo.add(col);
    }
    const gRoof = new THREE.Mesh(new THREE.ConeGeometry(1.36, 0.65, 8), stoneMat);
    gRoof.position.y = 1.88;
    gRoof.castShadow = true;
    gazebo.add(gRoof);

    // Warm glowing lantern hanging inside gazebo
    const gBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 10, 10),
      new THREE.MeshStandardMaterial({
        color: "#fffbeb",
        emissive: "#fbbf24",
        emissiveIntensity: 1.1
      })
    );
    gBulb.position.y = 1.45;
    const gGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.warmGlowTex,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    gGlow.scale.set(0.75, 0.75, 1);
    gBulb.add(gGlow);
    gazebo.add(gBulb);

    // Cozy timber-and-silver park bench inside the gazebo
    const pBench = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.22, 0.36), woodMat);
    pBench.position.set(0, 0.2, 0.35);
    gazebo.add(pBench);
    const pBack = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.24, 0.06), woodMat);
    pBack.position.set(0, 0.36, 0.5);
    gazebo.add(pBack);

    this.tagTarget(gazebo, {
      kind: "park-bench",
      label: "Botanical Park Gazebo & Koi Pond",
      worldX: cx + 1.1,
      worldZ: cz + 1.4
    });
    park.add(gazebo);

    // Lush Perimeter Flowering Shrubs & Park Trees around Grand Park
    this.addFlowerClusters(park, [
      [-4.1, -1.6, "#f472b6"],
      [-4.3, 0.8, "#a78bfa"],
      [4.1, -1.4, "#fbbf24"],
      [4.2, 1.2, "#38bdf8"],
      [0.2, 4.4, "#fb7185"],
      [-1.8, -4.2, "#34d399"],
      [2.1, -4.1, "#f472b6"]
    ]);

    this.parksGroup.add(park);
  }

  // ============================================================================
  // 2. SAKURA BLOSSOM PICNIC PARK — SW Quadrant (-15.2, 15.2)
  // ============================================================================
  private buildSakuraPicnicPark() {
    const { stoneMat, pathMat, woodMat } = this.makeSharedMaterials();
    const park = new THREE.Group();
    park.position.set(-15.2, 0, 15.2);

    const lawn = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4, 4.5, 0.05, 32),
      new THREE.MeshStandardMaterial({ color: "#bbf7d0", roughness: 0.86 })
    );
    lawn.position.y = 0.012;
    lawn.receiveShadow = true;
    park.add(lawn);

    const path = new THREE.Mesh(new THREE.RingGeometry(1.75, 2.4, 32), pathMat);
    path.rotation.x = -Math.PI / 2;
    path.position.y = 0.04;
    park.add(path);

    // 5 Sculpted Blooming Sakura Trees with animated falling pink petals!
    const trunkMat = new THREE.MeshStandardMaterial({ color: "#6b5b53", roughness: 0.78 });
    const sakuraMat = new THREE.MeshStandardMaterial({
      color: "#fbcfe8",
      emissive: "#f472b6",
      emissiveIntensity: 0.14,
      roughness: 0.56,
      flatShading: true
    });
    const treeCoords: Array<[number, number, number]> = [
      [-2.8, -2.1, 1.25],
      [2.7, -2.2, 1.15],
      [-2.6, 2.4, 1.18],
      [2.8, 2.1, 1.22],
      [0, -3.2, 1.32]
    ];
    for (const [tx, tz, sc] of treeCoords) {
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * sc, 0.14 * sc, 1.05 * sc, 7), trunkMat);
      tr.position.set(tx, 0.52 * sc, tz);
      park.add(tr);
      const canopy = new THREE.Mesh(new THREE.DodecahedronGeometry(0.68 * sc, 0), sakuraMat);
      canopy.scale.set(1.25, 0.86, 1.2);
      canopy.position.set(tx, 1.28 * sc, tz);
      park.add(canopy);
    }

    // 14 Drifting Cherry Blossom Petals
    const petalGeo = new THREE.CircleGeometry(0.045, 5);
    const petalMat = new THREE.MeshBasicMaterial({ color: "#f9a8d4", side: THREE.DoubleSide });
    for (let i = 0; i < 14; i++) {
      const bx = (Math.cos(i * 1.9) * 2.8);
      const bz = (Math.sin(i * 2.3) * 2.8);
      const p = new THREE.Mesh(petalGeo, petalMat);
      p.position.set(bx, 1.4, bz);
      park.add(p);
      this.petals.push({ mesh: p, baseX: bx, baseZ: bz, baseY: 1.65, phase: i * 0.75 });
    }

    // Clickable Pastel Picnic Blanket, Wicker Basket & Wooden Park Bench!
    const picnic = new THREE.Group();
    const blanket = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.025, 1.45),
      new THREE.MeshStandardMaterial({ color: "#fce7f3", roughness: 0.85 })
    );
    blanket.position.y = 0.05;
    picnic.add(blanket);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.76, 0.028, 0.34),
      new THREE.MeshStandardMaterial({ color: "#f9a8d4", roughness: 0.82 })
    );
    stripe.position.y = 0.052;
    picnic.add(stripe);

    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.28), woodMat);
    basket.position.set(0.42, 0.18, -0.24);
    picnic.add(basket);

    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.65, 6), stoneMat);
    lantern.position.set(-1.35, 0.35, -0.65);
    picnic.add(lantern);

    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.24, 0.38), woodMat);
    bench.position.set(0, 0.16, 1.85);
    picnic.add(bench);

    this.tagTarget(picnic, {
      kind: "park-bench",
      label: "Sakura Blossom Picnic Park",
      worldX: -14.8,
      worldZ: 14.5
    });
    park.add(picnic);
    this.parksGroup.add(park);
  }

  // ============================================================================
  // 3. SUNLIT HERB ORCHARD & POTTING GREENHOUSE — NW Quadrant (-15.2, -15.2)
  // ============================================================================
  private buildHerbOrchardPark() {
    const { stoneMat, metalMat, pathMat, woodMat, glassMat } = this.makeSharedMaterials();
    const park = new THREE.Group();
    park.position.set(-15.2, 0, -15.2);

    const lawn = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4, 4.5, 0.05, 32),
      new THREE.MeshStandardMaterial({ color: "#c7f5d5", roughness: 0.86 })
    );
    lawn.position.y = 0.012;
    lawn.receiveShadow = true;
    park.add(lawn);

    const walkway = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.04, 6.2), pathMat);
    walkway.position.y = 0.036;
    walkway.rotation.y = Math.PI / 4;
    park.add(walkway);

    // Charming Glass Potting Greenhouse Shed!
    const shed = new THREE.Group();
    shed.position.set(-1.35, 0.04, -1.25);
    shed.rotation.y = Math.PI / 4;

    const base = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.42, 1.65), woodMat);
    base.position.y = 0.21;
    shed.add(base);
    const glassBody = new THREE.Mesh(new THREE.BoxGeometry(2.02, 1.12, 1.56), glassMat);
    glassBody.position.y = 0.96;
    shed.add(glassBody);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.62, 0.72, 4), glassMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 1.88;
    shed.add(roof);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.06, 0.08), metalMat);
    ridge.position.y = 1.52;
    shed.add(ridge);

    // Shelves of potted herbs glowing softly inside the potting shed
    for (const sx of [-0.65, 0, 0.65]) {
      const herb = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.24, 0),
        new THREE.MeshStandardMaterial({ color: "#34d399", roughness: 0.5 })
      );
      herb.position.set(sx, 0.68, 0);
      shed.add(herb);
    }

    this.tagTarget(shed, {
      kind: "conservatory",
      label: "Orchard Potting Greenhouse",
      worldX: -13.5,
      worldZ: -13.5
    });
    park.add(shed);
    this.obstacles.push([-16.55, -16.45, 1.45]);

    // 4 Tidy Raised Cedar Herb Allotment Rows + Citrus Orchard Trees
    const soilMat = new THREE.MeshStandardMaterial({ color: "#5c4636", roughness: 0.9 });
    const herbCols = ["#34d399", "#a78bfa", "#fbbf24", "#4ade80"];
    for (let r = 0; r < 4; r++) {
      const rx = 1.4 + (r % 2) * 1.45;
      const rz = -1.1 + Math.floor(r / 2) * 1.95;
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.28, 0.72), woodMat);
      box.position.set(rx, 0.16, rz);
      park.add(box);
      const soil = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.04, 0.58), soilMat);
      soil.position.set(rx, 0.29, rz);
      park.add(soil);
      for (let h = -1; h <= 1; h++) {
        const bush = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.16, 0),
          new THREE.MeshStandardMaterial({ color: herbCols[r], roughness: 0.55 })
        );
        bush.position.set(rx + h * 0.3, 0.42, rz);
        park.add(bush);
      }
    }

    // Stone Water Basin
    const well = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.52, 0.5, 16), stoneMat);
    well.position.set(-0.2, 0.28, 2.35);
    park.add(well);

    this.parksGroup.add(park);
  }

  // ============================================================================
  // 4. SCENTED ROSE & LAVENDER PARK — NE Quadrant (15.2, -15.2)
  // ============================================================================
  private buildRoseLavenderPark() {
    const { stoneMat, metalMat, pathMat, hedgeMat } = this.makeSharedMaterials();
    const park = new THREE.Group();
    park.position.set(15.2, 0, -15.2);

    const lawn = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4, 4.5, 0.05, 32),
      new THREE.MeshStandardMaterial({ color: "#bbf7d0", roughness: 0.86 })
    );
    lawn.position.y = 0.012;
    lawn.receiveShadow = true;
    park.add(lawn);

    const ringPath = new THREE.Mesh(new THREE.RingGeometry(1.3, 2.05, 32), pathMat);
    ringPath.rotation.x = -Math.PI / 2;
    ringPath.position.y = 0.04;
    park.add(ringPath);

    // Centerpiece Sculptural Crystal Garden Sundial
    const dialBase = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.72, 0.65, 20), stoneMat);
    dialBase.position.y = 0.35;
    park.add(dialBase);

    const dialRing = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.032, 10, 32), metalMat);
    dialRing.position.y = 1.15;
    dialRing.rotation.x = 0.45;
    this.sundialSpinner = dialRing;
    park.add(dialRing);

    // Radiating Lavender & Rose Parterre Flowerbeds + Topiary Hedges!
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const fx = Math.cos(a) * 2.95;
      const fz = Math.sin(a) * 2.95;
      const bed = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.16, 0.65), stoneMat);
      bed.position.set(fx, 0.1, fz);
      bed.rotation.y = -a + Math.PI / 2;
      park.add(bed);

      const bloomMat = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? "#a78bfa" : "#fb7185",
        emissive: i % 2 === 0 ? "#8b5cf6" : "#f43f5e",
        emissiveIntensity: 0.2,
        roughness: 0.5
      });
      for (let b = -2; b <= 2; b++) {
        const stem = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 6), bloomMat);
        const lx = fx + Math.cos(a + Math.PI / 2) * b * 0.22;
        const lz = fz + Math.sin(a + Math.PI / 2) * b * 0.22;
        stem.position.set(lx, 0.32, lz);
        park.add(stem);
      }

      // Sculpted round topiary sphere at outer corner
      const topiary = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), hedgeMat);
      topiary.position.set(Math.cos(a + 0.5) * 3.8, 0.48, Math.sin(a + 0.5) * 3.8);
      park.add(topiary);
    }

    this.tagTarget(dialBase, {
      kind: "park-bench",
      label: "Scented Rose & Lavender Park",
      worldX: 13.4,
      worldZ: -13.4
    });

    this.parksGroup.add(park);
  }

  // ============================================================================
  // 5. 4 STREET-SIDE NEIGHBORHOOD POCKET FLOWER PARKS & GLASS CLOCHES
  //    Tucked neatly along the West & East Park Blvd greenbelts behind the inner blocks!
  // ============================================================================
  private buildInnerPocketFlowerParks() {
    const { stoneMat, woodMat, glassMat, hedgeMat } = this.makeSharedMaterials();
    const spots: Array<{ x: number; z: number; rotY: number; name: string; col: string }> = [
      { x: 16.8, z: 3.6, rotY: Math.PI / 2, name: "Maple East Blossom Pocket Park", col: "#f472b6" },
      { x: 16.8, z: -2.2, rotY: Math.PI / 2, name: "East Park Lavender Cloche Garden", col: "#a78bfa" },
      { x: -16.8, z: 3.6, rotY: -Math.PI / 2, name: "Willow West Tulip Pocket Park", col: "#fbbf24" },
      { x: -16.8, z: -2.2, rotY: -Math.PI / 2, name: "West Park Fern Cloche Garden", col: "#34d399" }
    ];

    for (const c of spots) {
      const g = new THREE.Group();
      g.position.set(c.x, 0, c.z);
      g.rotation.y = c.rotY;

      const pad = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.06, 3.2), stoneMat);
      pad.position.y = 0.03;
      pad.receiveShadow = true;
      g.add(pad);

      // Curved garden hedge backdrop + miniature glass plant cloche greenhouse!
      const hedge = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.42, 0.34), hedgeMat);
      hedge.position.set(0, 0.24, -1.15);
      g.add(hedge);

      const clocheBase = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.24, 14), stoneMat);
      clocheBase.position.set(-0.56, 0.16, -0.35);
      g.add(clocheBase);
      const clocheDome = new THREE.Mesh(
        new THREE.SphereGeometry(0.44, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
        glassMat
      );
      clocheDome.position.set(-0.56, 0.28, -0.35);
      g.add(clocheDome);
      const innerBloom = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.2, 0),
        new THREE.MeshStandardMaterial({ color: c.col, emissive: c.col, emissiveIntensity: 0.35 })
      );
      innerBloom.position.set(-0.56, 0.42, -0.35);
      g.add(innerBloom);

      // Cozy pocket park timber bench + flower clusters
      const bench = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.22, 0.34), woodMat);
      bench.position.set(0.52, 0.16, -0.25);
      g.add(bench);

      this.addFlowerClusters(g, [
        [-1.05, 0.65, c.col],
        [1.05, 0.65, "#ffffff"],
        [0.0, 0.95, c.col]
      ]);

      this.tagTarget(g, {
        kind: "park-bench",
        label: c.name,
        worldX: c.x > 0 ? c.x + 2.2 : c.x - 2.2,
        worldZ: c.z
      });
      this.parksGroup.add(g);
    }
  }

  private addFlowerClusters(parent: THREE.Group, spots: Array<[number, number, string]>) {
    const bushMat = new THREE.MeshStandardMaterial({ color: "#4ade80", roughness: 0.72 });
    for (const [fx, fz, hex] of spots) {
      const mound = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), bushMat);
      mound.scale.set(1.2, 0.55, 1.1);
      mound.position.set(fx, 0.14, fz);
      parent.add(mound);

      const fMat = new THREE.MeshStandardMaterial({
        color: hex,
        emissive: hex,
        emissiveIntensity: 0.22,
        roughness: 0.45
      });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        const fl = new THREE.Mesh(new THREE.SphereGeometry(0.075, 7, 7), fMat);
        fl.position.set(fx + Math.cos(a) * 0.2, 0.28 + (i % 2) * 0.06, fz + Math.sin(a) * 0.2);
        parent.add(fl);
      }
    }
  }

  // ============================================================================
  // 6. 10 LIVE INTERACTIVE GROWING 3D GARDEN PLANTER BEDS (4 Home + 6 Park!)
  // ============================================================================
  private buildGardenPlanterBoxes() {
    const { stoneMat, woodMat } = this.makeSharedMaterials();

    for (const def of GARDEN_PLOT_DEFS) {
      const grp = new THREE.Group();
      const baseY = def.zone === "home" ? 0.12 : 0.04;
      grp.position.set(def.x, baseY, def.z);
      grp.rotation.y = def.yaw;

      // Raised cedar-and-alabaster architectural garden bed
      const outer = new THREE.Mesh(
        new THREE.BoxGeometry(0.84, 0.24, 0.62),
        def.zone === "home" ? stoneMat : woodMat
      );
      outer.position.y = 0.12;
      outer.castShadow = true;
      outer.receiveShadow = true;
      grp.add(outer);

      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.035, 0.66), stoneMat);
      trim.position.y = 0.245;
      grp.add(trim);

      const soilMat = new THREE.MeshStandardMaterial({
        color: "#6b503c",
        roughness: 0.94
      });
      const soil = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.04, 0.52), soilMat);
      soil.position.y = 0.235;
      grp.add(soil);

      // Glowing golden harvest halo ring (appears when bloom is ready to harvest!)
      const readyHalo = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.016, 8, 28),
        new THREE.MeshStandardMaterial({
          color: "#fde68a",
          emissive: "#fbbf24",
          emissiveIntensity: 1.2,
          transparent: true,
          opacity: 0.85
        })
      );
      readyHalo.rotation.x = Math.PI / 2;
      readyHalo.position.y = 0.28;
      readyHalo.visible = false;
      grp.add(readyHalo);

      const plantGroup = new THREE.Group();
      plantGroup.position.y = 0.255;
      grp.add(plantGroup);

      this.tagTarget(grp, {
        kind: "garden-plot",
        label: def.label,
        plotId: def.id,
        worldX: def.standX,
        worldZ: def.standZ
      });

      this.plotsGroup.add(grp);
      this.plotRigs.set(def.id, {
        def,
        group: grp,
        plantGroup,
        soilMat,
        readyHalo,
        lastKey: ""
      });
    }
  }

  public syncGardenState(state: GardenWorldState, houseSize: HouseSizeLevel, nowMs = Date.now()) {
    for (const def of GARDEN_PLOT_DEFS) {
      const rig = this.plotRigs.get(def.id);
      if (!rig) continue;

      // Adapt home bed height cleanly if house deck expands Lv.1 -> Lv.2 -> Lv.3!
      if (def.zone === "home") {
        rig.group.position.y = getGroundElevationForFloor(1, def.x, def.z, houseSize);
      }

      const plotState = state.plots[def.id];
      const snap = computePlotGrowth(plotState, nowMs);

      // Rich damp dark soil when recently watered vs lighter warm soil when dry
      rig.soilMat.color.set(snap.needsWater ? "#7a5e48" : "#4e3929");
      rig.readyHalo.visible = snap.readyToHarvest;

      const nextKey = `${plotState?.speciesId || "empty"}:${snap.stage}`;
      if (rig.lastKey === nextKey) continue;
      rig.lastKey = nextKey;

      this.disposeChildren(rig.plantGroup);
      if (plotState?.speciesId && snap.stage !== 0) {
        const sp = PLANT_SPECIES_BY_ID[plotState.speciesId];
        this.buildGrowingPlant3D(rig.plantGroup, sp, snap.stage);
      }

      // Re-tag newly created plant meshes so clicking directly on the flowers opens the plot pie menu!
      const target: SimsObjectTarget = {
        kind: "garden-plot",
        label: spLabel(def.label, snap.species?.name),
        plotId: def.id,
        worldX: def.standX,
        worldZ: def.standZ
      };
      rig.group.traverse((obj) => {
        obj.userData.simsTarget = target;
      });
    }
  }

  private buildGrowingPlant3D(parent: THREE.Group, sp: PlantSpeciesDef, stage: 1 | 2 | 3) {
    const leafMat = new THREE.MeshStandardMaterial({
      color: sp.leafHex,
      roughness: 0.5
    });
    const petalMat = new THREE.MeshStandardMaterial({
      color: sp.petalHex,
      emissive: sp.petalHex,
      emissiveIntensity: stage === 3 ? 0.45 : 0.16,
      roughness: 0.34
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: sp.accentHex,
      emissive: sp.accentHex,
      emissiveIntensity: stage === 3 ? 0.55 : 0.2,
      roughness: 0.28
    });

    if (stage === 1) {
      // Cute dual-leaf seed sprouts!
      for (const sx of [-0.16, 0, 0.16]) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.12, 6), leafMat);
        stem.position.set(sx, 0.06, (sx * 0.4) % 0.1);
        parent.add(stem);
        for (const side of [-1, 1]) {
          const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), leafMat);
          leaf.scale.set(1.3, 0.35, 0.8);
          leaf.position.set(sx + side * 0.04, 0.12, (sx * 0.4) % 0.1);
          leaf.rotation.z = side * 0.42;
          parent.add(leaf);
        }
      }
      return;
    }

    // Stage 2 (Budding) & Stage 3 (Full Radiant Bloom!) — species-distinct silhouettes!
    const hMult = stage === 3 ? 1.0 : 0.65;
    if (sp.id === "sunflower") {
      for (const [sx, sz, h] of [[-0.16, 0.05, 0.52], [0.14, -0.06, 0.62]] as const) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, h * hMult, 8), leafMat);
        stem.position.set(sx, (h * hMult) / 2, sz);
        parent.add(stem);
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * hMult, 0.11 * hMult, 0.03, 12), petalMat);
        head.rotation.x = Math.PI / 2 - 0.25;
        head.position.set(sx, h * hMult + 0.04, sz + 0.03);
        parent.add(head);
        const core = new THREE.Mesh(
          new THREE.SphereGeometry(0.055 * hMult, 8, 8),
          new THREE.MeshStandardMaterial({ color: "#78350f", roughness: 0.7 })
        );
        core.position.set(sx, h * hMult + 0.04, sz + 0.055);
        parent.add(core);
      }
    } else if (sp.id === "sakura") {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.045, 0.44 * hMult, 8),
        new THREE.MeshStandardMaterial({ color: "#57534e", roughness: 0.72 })
      );
      trunk.position.y = 0.22 * hMult;
      parent.add(trunk);
      const puffs: Array<[number, number, number, number]> = [
        [0, 0.52 * hMult, 0, 0.2 * hMult],
        [-0.16, 0.44 * hMult, 0.06, 0.14 * hMult],
        [0.16, 0.46 * hMult, -0.05, 0.14 * hMult]
      ];
      for (const [px, py, pz, r] of puffs) {
        const cloud = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), petalMat);
        cloud.scale.set(1.2, 0.78, 1.1);
        cloud.position.set(px, py, pz);
        parent.add(cloud);
      }
    } else if (sp.id === "lavender") {
      for (let i = 0; i < 6; i++) {
        const sx = -0.22 + (i % 3) * 0.22;
        const sz = i < 3 ? -0.08 : 0.09;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.28 * hMult, 6), leafMat);
        stem.position.set(sx, 0.14 * hMult, sz);
        parent.add(stem);
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.042 * hMult, 0.22 * hMult, 6), petalMat);
        spike.position.set(sx, 0.34 * hMult, sz);
        parent.add(spike);
      }
    } else if (sp.id === "lotus" || sp.id === "orchid") {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.14 * hMult, 8, 6), leafMat);
        leaf.scale.set(1.3, 0.24, 0.8);
        leaf.position.set(Math.cos(a) * 0.16, 0.08, Math.sin(a) * 0.14);
        leaf.rotation.y = -a;
        parent.add(leaf);
      }
      const center = new THREE.Mesh(new THREE.OctahedronGeometry(0.16 * hMult, 0), petalMat);
      center.position.y = 0.28 * hMult;
      parent.add(center);
      const glowOrb = new THREE.Mesh(new THREE.SphereGeometry(0.075 * hMult, 10, 10), accentMat);
      glowOrb.position.y = 0.44 * hMult;
      parent.add(glowOrb);
    } else {
      // Rose, Mint & Starlight Fern lush botanical mounds with clustered blooms!
      const mound = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24 * hMult, 1), leafMat);
      mound.scale.set(1.35, 0.72, 1.05);
      mound.position.y = 0.16 * hMult;
      parent.add(mound);
      for (let i = 0; i < (stage === 3 ? 6 : 3); i++) {
        const a = (i / 6) * Math.PI * 2;
        const bud = new THREE.Mesh(new THREE.SphereGeometry(0.068 * hMult, 8, 8), i % 2 === 0 ? petalMat : accentMat);
        bud.position.set(Math.cos(a) * 0.18, 0.28 * hMult + (i % 2) * 0.07, Math.sin(a) * 0.12);
        parent.add(bud);
      }
    }
  }

  /**
   * Triggers a sparkling blue water-droplet splash right over a watered garden bed!
   */
  public spawnWaterSplash(plotId: string) {
    const rig = this.plotRigs.get(plotId);
    if (!rig) return;
    const base = rig.group.position;
    const geo = new THREE.SphereGeometry(0.036, 7, 7);
    for (let i = 0; i < 12; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? "#38bdf8" : "#bae6fd",
        emissive: "#0ea5e9",
        emissiveIntensity: 0.75,
        transparent: true,
        opacity: 0.92
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(base.x + (Math.random() - 0.5) * 0.45, base.y + 0.45, base.z + (Math.random() - 0.5) * 0.35);
      this.fxGroup.add(m);
      const ang = Math.random() * Math.PI * 2;
      this.splashDroplets.push({
        mesh: m,
        vx: Math.cos(ang) * (0.4 + Math.random() * 0.6),
        vy: 1.1 + Math.random() * 0.9,
        vz: Math.sin(ang) * (0.4 + Math.random() * 0.6),
        life: 0.9
      });
    }
  }

  public getRaycastTargets(): THREE.Object3D[] {
    return this.interactiveRoots;
  }

  public getObstacles(): Array<[number, number, number]> {
    return this.obstacles;
  }

  public update(dt: number, t: number) {
    // Swim Koi Fish smoothly around the Botanical Park Pond
    for (const k of this.koiFish) {
      k.angle += k.speed * dt;
      const nx = k.centerX + Math.cos(k.angle) * k.radius * 1.15;
      const nz = k.centerZ + Math.sin(k.angle) * k.radius * 0.82;
      k.group.position.x = nx;
      k.group.position.z = nz;
      k.group.rotation.y = -k.angle;
    }

    // Drift Sakura Picnic Park cherry blossom petals gently in the breeze
    for (const p of this.petals) {
      const fall = (t * 0.28 + p.phase) % 1;
      p.mesh.position.set(
        p.baseX + Math.sin(t * 1.4 + p.phase) * 0.35,
        p.baseY - fall * 1.45,
        p.baseZ + Math.cos(t * 1.2 + p.phase) * 0.35
      );
      p.mesh.rotation.x += dt * 1.4;
      p.mesh.rotation.y += dt * 1.8;
    }

    // Rise warm mist inside the Grand Glass Conservatory
    for (let i = 0; i < this.conservatoryMist.length; i++) {
      const m = this.conservatoryMist[i];
      const u = (t * 0.25 + i * 0.2) % 1;
      m.position.y = 0.65 + u * 1.45;
      m.scale.setScalar(0.75 + u * 0.85);
    }

    if (this.sundialSpinner) {
      this.sundialSpinner.rotation.y = t * 0.32;
    }

    // Pulse golden harvest halos on ready garden beds
    for (const rig of this.plotRigs.values()) {
      if (rig.readyHalo.visible) {
        const s = 1 + Math.sin(t * 4.2) * 0.08;
        rig.readyHalo.scale.setScalar(s);
      }
    }

    // Animate water splash droplets
    for (let i = this.splashDroplets.length - 1; i >= 0; i--) {
      const d = this.splashDroplets[i];
      d.life -= dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;
      d.vy -= 3.2 * dt;
      (d.mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, d.life);
      if (d.life <= 0) {
        this.fxGroup.remove(d.mesh);
        d.mesh.geometry.dispose();
        (d.mesh.material as THREE.Material).dispose();
        this.splashDroplets.splice(i, 1);
      }
    }
  }

  private createParkPlaqueTexture(title: string, subtitle: string): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 116;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
    ctx.beginPath();
    ctx.roundRect(8, 8, 344, 100, 24);
    ctx.fill();
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.arc(36, 46, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "700 26px 'Inter', sans-serif";
    ctx.fillStyle = "#1e293b";
    ctx.fillText(title, 54, 54);

    ctx.font = "600 16px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#475569";
    ctx.fillText(subtitle, 54, 84);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private disposeChildren(parent: THREE.Object3D) {
    parent.traverse((obj) => {
      if (obj === parent) return;
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) mat.dispose();
      }
    });
    while (parent.children.length > 0) {
      parent.remove(parent.children[0]);
    }
  }

  public dispose() {
    this.disposeChildren(this.parksGroup);
    this.disposeChildren(this.plotsGroup);
    this.disposeChildren(this.fxGroup);
    this.pathTex.dispose();
    this.warmGlowTex.dispose();
    this.plotRigs.clear();
    this.interactiveRoots = [];
    this.obstacles = [];
    this.koiFish = [];
    this.petals = [];
    this.conservatoryMist = [];
    this.splashDroplets = [];
  }
}

function spLabel(plotLabel: string, speciesName?: string): string {
  return speciesName ? `${speciesName} (${plotLabel})` : `${plotLabel} (Empty Bed)`;
}
