import * as THREE from "three";
import { createFastArchitecturalGlass } from "./browserCompat";
import { createFloorFinishTexture, createRadialGlowTexture } from "./architectTextures";
import {
  BASEMENT_Y,
  EXTRA_ROOM_DEFS,
  STAIR_FLIGHTS,
  WALL_STYLES,
  getHouseBoundsRadius,
  type ExtraRoomId,
  type FloorNumber,
  type HouseFloorCount,
  type HouseSizeLevel,
  type StairFlightDef,
  type WallStyleId
} from "./homeLayout";
import {
  FLOOR_STYLES,
  type FloorStyleId,
  type LabDecorConfig,
  type SimsObjectTarget
} from "./simsState";

/**
 * Procedural 3D Modern Minimalist Architect House with:
 *  - B1 Sunken Cutaway Underground Basement (y = -2.20m): architectural concrete retaining
 *    walls, sunken glass lightwell, media lounge sectional, specimen vault & server rack
 *  - 1F Open Living & Lab Atrium (y = 0.12m): flat walkable architectural floor with real
 *    open stairwell cutout, panoramic cutaway glass walls, and a sculptural Center Architect
 *    NFT Display Island (top at y = 0.68m) supporting the miniature tabletop NFT apparatus!
 *  - 3 Real Physically Walkable Floating-Tread Staircases (B1 <-> 1F <-> 2F <-> 3F)
 *  - 2F Cutaway L-Shaped Architect Mezzanine Loft (y = 2.68m) with double-height atrium void
 *  - 3F Starlight Sky Penthouse (y = 4.68m) with pergola fairy lights & stargazing telescope
 *  - Smart Sims-style Dollhouse Cutaway Floor Switching via `setViewedFloor(floor)`!
 */
export class HomeArchitecture3D {
  public readonly group = new THREE.Group();

  private basementGroup = new THREE.Group();
  private estateGroup = new THREE.Group();
  private stairsGroup = new THREE.Group();
  private basementStairGroup = new THREE.Group();
  private upperStair1Group = new THREE.Group();
  private upperStair2Group = new THREE.Group();
  private floor2Group = new THREE.Group();
  private floor3Group = new THREE.Group();
  private roomsGroup = new THREE.Group();

  private interactiveRoots: THREE.Object3D[] = [];
  private terrazzoTex: THREE.Texture;
  private titaniumTex: THREE.Texture;
  private floorTextures: Partial<Record<FloorStyleId, THREE.CanvasTexture>> = {};
  private warmGlowTex: THREE.CanvasTexture | null = null;

  private lastSize: HouseSizeLevel | -1 = -1;
  private lastFloors: HouseFloorCount | -1 = -1;
  private lastBasement: boolean | null = null;
  private lastWall: WallStyleId | "" = "";
  private lastFloorStyle: FloorStyleId | "" = "";
  private lastRoomsKey = "";
  private lastAccent = "";
  private viewedFloor: FloorNumber = 1;

  // Animated homely details
  private hearthFlames: THREE.Mesh[] = [];
  private spaSteam: THREE.Mesh[] = [];
  private fairyBulbs: THREE.Mesh[] = [];
  private basementLeds: THREE.Mesh[] = [];

  constructor(terrazzoTex: THREE.Texture, titaniumTex: THREE.Texture) {
    this.terrazzoTex = terrazzoTex;
    this.titaniumTex = titaniumTex;
    this.stairsGroup.add(this.basementStairGroup, this.upperStair1Group, this.upperStair2Group);
    this.group.add(
      this.basementGroup,
      this.estateGroup,
      this.stairsGroup,
      this.floor2Group,
      this.floor3Group,
      this.roomsGroup
    );
  }

  private getWarmGlow(): THREE.CanvasTexture {
    if (!this.warmGlowTex) {
      this.warmGlowTex = createRadialGlowTexture("#fbbf24");
    }
    return this.warmGlowTex;
  }

  private getFloorTexture(style: FloorStyleId): { tex: THREE.Texture; tint: string } {
    const def = FLOOR_STYLES.find((f) => f.id === style) || FLOOR_STYLES[0];
    if (style === "terrazzo") {
      return { tex: this.terrazzoTex, tint: def.tint };
    }
    if (!this.floorTextures[style]) {
      this.floorTextures[style] = createFloorFinishTexture(style);
    }
    return { tex: this.floorTextures[style]!, tint: def.tint };
  }

  private tagTarget(root: THREE.Object3D, target: SimsObjectTarget) {
    root.userData.simsTarget = target;
    root.traverse((obj) => {
      obj.userData.simsTarget = target;
    });
  }

  public getRaycastTargets(): THREE.Object3D[] {
    return this.interactiveRoots.filter((r) => {
      let cur: THREE.Object3D | null = r;
      while (cur) {
        if (!cur.visible) return false;
        cur = cur.parent;
      }
      return true;
    });
  }

  public setViewedFloor(floor: FloorNumber) {
    this.viewedFloor = floor;
    const hasB1 = this.lastBasement !== false;
    const floors = this.lastFloors > 0 ? this.lastFloors : 2;

    if (floor === 0) {
      // Dollhouse Cutaway into B1 Underground Basement: lift away upper stories completely!
      this.basementGroup.visible = hasB1;
      this.estateGroup.visible = false;
      this.roomsGroup.visible = false;
      this.floor2Group.visible = false;
      this.floor3Group.visible = false;
      this.basementStairGroup.visible = hasB1;
      this.upperStair1Group.visible = false;
      this.upperStair2Group.visible = false;
    } else if (floor === 1) {
      // 1F Living Atrium: see 1F + open stairwell down to B1 + non-occluding L-shaped 2F Mezzanine Loft!
      this.basementGroup.visible = hasB1;
      this.estateGroup.visible = true;
      this.roomsGroup.visible = true;
      this.floor2Group.visible = floors >= 2;
      this.floor3Group.visible = false;
      this.basementStairGroup.visible = hasB1;
      this.upperStair1Group.visible = floors >= 2;
      this.upperStair2Group.visible = false;
    } else if (floor === 2) {
      // 2F Mezzanine Loft: full 1F + 2F + switchback stairs up to 3F if built
      this.basementGroup.visible = hasB1;
      this.estateGroup.visible = true;
      this.roomsGroup.visible = true;
      this.floor2Group.visible = floors >= 2;
      this.floor3Group.visible = false;
      this.basementStairGroup.visible = hasB1;
      this.upperStair1Group.visible = floors >= 2;
      this.upperStair2Group.visible = floors >= 3;
    } else {
      // 3F Starlight Sky Penthouse: full 4-level architectural residence!
      this.basementGroup.visible = hasB1;
      this.estateGroup.visible = true;
      this.roomsGroup.visible = true;
      this.floor2Group.visible = floors >= 2;
      this.floor3Group.visible = floors >= 3;
      this.basementStairGroup.visible = hasB1;
      this.upperStair1Group.visible = floors >= 2;
      this.upperStair2Group.visible = floors >= 3;
    }
  }

  public updateArchitecture(decor: LabDecorConfig, accentHex: string) {
    const roomsKey = [...decor.extraRooms].sort().join(",");
    const needsBasement =
      this.lastBasement !== decor.hasBasement ||
      this.lastWall !== decor.wallStyle ||
      this.lastAccent !== accentHex;
    const needsEstate =
      this.lastSize !== decor.houseSize ||
      this.lastBasement !== decor.hasBasement ||
      this.lastWall !== decor.wallStyle ||
      this.lastFloorStyle !== decor.floorStyle ||
      this.lastAccent !== accentHex;
    const needsFloors =
      this.lastFloors !== decor.houseFloors ||
      this.lastBasement !== decor.hasBasement ||
      this.lastSize !== decor.houseSize ||
      this.lastWall !== decor.wallStyle ||
      this.lastFloorStyle !== decor.floorStyle ||
      this.lastAccent !== accentHex;
    const needsRooms =
      this.lastRoomsKey !== roomsKey ||
      this.lastWall !== decor.wallStyle ||
      this.lastAccent !== accentHex;

    if (!needsBasement && !needsEstate && !needsFloors && !needsRooms) return;

    this.lastSize = decor.houseSize;
    this.lastFloors = decor.houseFloors;
    this.lastBasement = decor.hasBasement;
    this.lastWall = decor.wallStyle;
    this.lastFloorStyle = decor.floorStyle;
    this.lastRoomsKey = roomsKey;
    this.lastAccent = accentHex;

    if (needsBasement) {
      this.buildBasementB1(decor.hasBasement, decor.wallStyle, accentHex);
    }
    if (needsEstate) {
      this.buildEstateDeckAnd1FWalls(
        decor.houseSize,
        decor.hasBasement,
        decor.wallStyle,
        decor.floorStyle,
        accentHex
      );
    }
    if (needsFloors) {
      this.buildWalkableStaircases(decor.houseFloors, decor.hasBasement, decor.wallStyle, accentHex);
      this.buildUpperFloors(
        decor.houseFloors,
        decor.wallStyle,
        decor.floorStyle,
        accentHex
      );
    }
    if (needsRooms) {
      this.buildExtraRooms(decor.extraRooms, decor.wallStyle, accentHex);
    }

    this.rebuildRaycastList();
    this.setViewedFloor(this.viewedFloor);
  }

  private rebuildRaycastList() {
    this.interactiveRoots = [];
    const scan = (parent: THREE.Object3D) => {
      for (const child of parent.children) {
        if (child.userData?.simsTarget) {
          this.interactiveRoots.push(child);
        }
      }
    };
    scan(this.basementStairGroup);
    scan(this.upperStair1Group);
    scan(this.upperStair2Group);
    scan(this.roomsGroup);
  }

  private makePalette(wallStyle: WallStyleId, floorStyle: FloorStyleId = "oak") {
    const style = WALL_STYLES.find((w) => w.id === wallStyle) || WALL_STYLES[0];
    const fl = this.getFloorTexture(floorStyle);
    const floorMat = new THREE.MeshStandardMaterial({
      map: fl.tex,
      color: fl.tint,
      roughness: 0.44,
      metalness: 0.04
    });
    const wallMat = new THREE.MeshStandardMaterial({
      map: this.terrazzoTex,
      color: style.wallHex,
      roughness: 0.56,
      metalness: 0.03
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: style.trimHex,
      roughness: 0.36,
      metalness: 0.22
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: "#dfd0ba",
      roughness: 0.52,
      metalness: 0.04
    });
    const metalMat = new THREE.MeshStandardMaterial({
      map: this.titaniumTex,
      color: "#cbd5e1",
      roughness: 0.2,
      metalness: 0.88
    });
    const glassMat = createFastArchitecturalGlass({
      color: "#f4f9ff",
      opacity: 0.46,
      roughness: 0.06
    });
    return { floorMat, wallMat, trimMat, woodMat, metalMat, glassMat };
  }

  // ============================================================================
  // 0. B1 SUNKEN ARCHITECTURAL BASEMENT (y = -2.20m)
  // ============================================================================
  private buildBasementB1(hasBasement: boolean, wallStyle: WallStyleId, accentHex: string) {
    this.disposeObjectChildren(this.basementGroup);
    this.basementLeds = [];
    if (!hasBasement) return;

    const { trimMat, woodMat, metalMat, glassMat } = this.makePalette(wallStyle, "basalt");
    const y0 = BASEMENT_Y;
    const h = 2.26; // Retaining wall height from B1 floor (-2.20) up to 1F underside (+0.06)

    const concreteFloorMat = new THREE.MeshStandardMaterial({
      map: this.terrazzoTex,
      color: "#dce3ee",
      roughness: 0.52,
      metalness: 0.08
    });
    const concreteWallMat = new THREE.MeshStandardMaterial({
      map: this.terrazzoTex,
      color: "#e6ecf5",
      roughness: 0.62,
      metalness: 0.04
    });
    const darkSlateMat = new THREE.MeshStandardMaterial({
      color: "#475569",
      roughness: 0.44,
      metalness: 0.22
    });
    const cushionMat = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.82 });

    // Solid subterranean concrete foundation floor slab (7.0m × 7.0m)
    const floorSlab = new THREE.Mesh(new THREE.BoxGeometry(7.04, 0.14, 7.04), concreteFloorMat);
    floorSlab.position.set(0, y0 - 0.07, 0);
    floorSlab.receiveShadow = true;
    this.basementGroup.add(floorSlab);

    // Subtle warm recessed floor perimeter cove LED strip
    const coveMat = new THREE.MeshStandardMaterial({
      color: "#fef3c7",
      emissive: "#fbbf24",
      emissiveIntensity: 0.75
    });
    const northCove = new THREE.Mesh(new THREE.BoxGeometry(6.7, 0.024, 0.03), coveMat);
    northCove.position.set(0, y0 + 0.015, -3.38);
    const westCove = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.024, 6.7), coveMat);
    westCove.position.set(-3.38, y0 + 0.015, 0);
    this.basementGroup.add(northCove, westCove);

    // Architectural Cutaway Concrete Retaining Walls (North & West full-height; East & South low cutaway!)
    const northWall = new THREE.Mesh(new THREE.BoxGeometry(7.04, h, 0.16), concreteWallMat);
    northWall.position.set(0, y0 + h / 2, -3.46);
    northWall.receiveShadow = true;
    northWall.castShadow = true;
    this.basementGroup.add(northWall);

    const westWall = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, 7.04), concreteWallMat);
    westWall.position.set(-3.46, y0 + h / 2, 0);
    westWall.receiveShadow = true;
    westWall.castShadow = true;
    this.basementGroup.add(westWall);

    // Low cutaway sill walls on East & South so the camera sees straight inside like an architect section!
    const eastSill = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 7.04), concreteWallMat);
    eastSill.position.set(3.46, y0 + 0.31, 0);
    eastSill.receiveShadow = true;
    this.basementGroup.add(eastSill);

    const southSill = new THREE.Mesh(new THREE.BoxGeometry(7.04, 0.56, 0.14), concreteWallMat);
    southSill.position.set(0, y0 + 0.28, 3.46);
    southSill.receiveShadow = true;
    this.basementGroup.add(southSill);

    // South Sunken Glass Lightwell Transom & Brushed-Silver Mullions
    const lightwellGlass = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.52, 0.04), glassMat);
    lightwellGlass.position.set(0, y0 + 0.82, 3.46);
    this.basementGroup.add(lightwellGlass);
    for (let sx = -2.2; sx <= 2.2; sx += 2.2) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.56, 0.07), metalMat);
      mullion.position.set(sx, y0 + 0.82, 3.46);
      this.basementGroup.add(mullion);
    }

    // Warm Architectural Wall Sconces on North & West Basement Concrete Walls
    const sconceBulbMat = new THREE.MeshStandardMaterial({
      color: "#fffbeb",
      emissive: "#fde68a",
      emissiveIntensity: 1.25
    });
    for (const sx of [-2.2, 0.2]) {
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.055, 0.08), metalMat);
      fixture.position.set(sx, y0 + 1.65, -3.35);
      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.04), sconceBulbMat);
      glow.position.set(sx, y0 + 1.61, -3.34);
      this.basementGroup.add(fixture, glow);
    }
    for (const sz of [-1.4, 1.35]) {
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.055, 0.32), metalMat);
      fixture.position.set(-3.35, y0 + 1.65, sz);
      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.28), sconceBulbMat);
      glow.position.set(-3.34, y0 + 1.61, sz);
      this.basementGroup.add(fixture, glow);
    }

    // Dedicated Warm Basement Studio Interior Light so B1 feels inviting & bright!
    const b1Light = new THREE.PointLight("#fff4e0", 1.35, 10.5);
    b1Light.position.set(-0.2, y0 + 1.85, 0.25);
    this.basementGroup.add(b1Light);

    // ---- BUILT-IN B1 VIGNETTE 1: COZY BASEMENT MEDIA LOUNGE (South-West Corner) ----
    const lounge = new THREE.Group();
    lounge.position.set(-1.55, y0, 1.45);
    const rug = new THREE.Mesh(
      new THREE.BoxGeometry(2.35, 0.025, 1.85),
      new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.9 })
    );
    rug.position.y = 0.015;
    rug.receiveShadow = true;
    lounge.add(rug);

    // L-shaped minimalist sectional sofa
    const sofaA = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.28, 0.56), darkSlateMat);
    sofaA.position.set(-0.25, 0.16, -0.52);
    sofaA.castShadow = true;
    const sofaABack = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.32, 0.14), darkSlateMat);
    sofaABack.position.set(-0.25, 0.38, -0.74);
    const sofaB = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.28, 1.25), darkSlateMat);
    sofaB.position.set(-0.84, 0.16, 0.18);
    sofaB.castShadow = true;
    const sofaCush1 = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.09, 0.44), cushionMat);
    sofaCush1.position.set(-0.25, 0.34, -0.49);
    const sofaCush2 = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.09, 1.02), cushionMat);
    sofaCush2.position.set(-0.82, 0.34, 0.22);
    lounge.add(sofaA, sofaABack, sofaB, sofaCush1, sofaCush2);

    // Low Nordic Oak Coffee Table with glowing tabletop lamp orb
    const cTable = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.05, 0.54), woodMat);
    cTable.position.set(0.18, 0.26, 0.24);
    cTable.castShadow = true;
    lounge.add(cTable);
    for (const [lx, lz] of [[-0.36, -0.2], [0.36, -0.2], [-0.36, 0.2], [0.36, 0.2]] as const) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.25, 8), metalMat);
      leg.position.set(0.18 + lx, 0.125, 0.24 + lz);
      lounge.add(leg);
    }
    const tableLamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 12, 12),
      new THREE.MeshStandardMaterial({ color: "#fffbeb", emissive: "#fde68a", emissiveIntensity: 0.9 })
    );
    tableLamp.position.set(0.36, 0.35, 0.22);
    lounge.add(tableLamp);

    // Framed minimalist art triptych on West Basement concrete wall
    const artColors = [accentHex, "#38bdf8", "#a78bfa"];
    artColors.forEach((col, i) => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.62, 0.44), metalMat);
      frame.position.set(-1.82, 1.18, -0.58 + i * 0.58);
      const canvas = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.52, 0.34),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.22, roughness: 0.45 })
      );
      canvas.position.set(-1.815, 1.18, -0.58 + i * 0.58);
      lounge.add(frame, canvas);
    });
    this.basementGroup.add(lounge);

    // ---- BUILT-IN B1 VIGNETTE 2: ELIXIR & SPECIMEN CELLAR RACK (North Wall) ----
    const cellar = new THREE.Group();
    cellar.position.set(-0.55, y0, -3.08);
    for (const sx of [-1.15, 0, 1.15]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.72, 0.36), metalMat);
      post.position.set(sx, 0.86, 0);
      cellar.add(post);
    }
    const bottleCols = [accentHex, "#38bdf8", "#34d399", "#f472b6", "#fbbf24"];
    for (let s = 0; s < 4; s++) {
      const sy = 0.22 + s * 0.42;
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.36, 0.032, 0.34), woodMat);
      shelf.position.y = sy;
      cellar.add(shelf);
      for (let b = 0; b < 6; b++) {
        const col = bottleCols[(s * 3 + b) % bottleCols.length];
        const jar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.042, 0.048, 0.18, 12),
          new THREE.MeshStandardMaterial({
            color: col,
            emissive: col,
            emissiveIntensity: 0.48,
            roughness: 0.14
          })
        );
        jar.position.set(-0.92 + b * 0.37, sy + 0.11, 0);
        cellar.add(jar);
      }
    }
    this.basementGroup.add(cellar);

    // ---- BUILT-IN B1 VIGNETTE 3: SUBTERRANEAN QUANTUM COMPUTE SERVER CABINET (South-East) ----
    const srv = new THREE.Group();
    srv.position.set(1.65, y0, 1.85);
    srv.rotation.y = -0.35;
    const rackBody = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.36, 0.52), darkSlateMat);
    rackBody.position.y = 0.68;
    rackBody.castShadow = true;
    srv.add(rackBody);
    const rackDoor = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.24, 0.03), glassMat);
    rackDoor.position.set(0, 0.68, 0.27);
    srv.add(rackDoor);
    for (let i = 0; i < 5; i++) {
      const led = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.028, 0.02),
        new THREE.MeshStandardMaterial({
          color: i % 2 === 0 ? "#38bdf8" : accentHex,
          emissive: i % 2 === 0 ? "#38bdf8" : accentHex,
          emissiveIntensity: 1.1
        })
      );
      led.position.set(0, 0.28 + i * 0.21, 0.255);
      srv.add(led);
      this.basementLeds.push(led);
    }
    // Side lab workbench table beside the server rack
    const benchTop = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.04, 0.44), trimMat);
    benchTop.position.set(0.86, 0.54, 0);
    srv.add(benchTop);
    for (const [lx, lz] of [[-0.3, -0.17], [0.3, -0.17], [-0.3, 0.17], [0.3, 0.17]] as const) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.54, 8), metalMat);
      leg.position.set(0.86 + lx, 0.27, lz);
      srv.add(leg);
    }
    this.basementGroup.add(srv);
  }

  // ============================================================================
  // 1. 1F MODERN ARCHITECT HOUSE FLOOR (WITH BASEMENT STAIR CUTOUT),
  //    PANORAMIC CUTAWAY GLASS WALLS & CENTER TABLETOP NFT DISPLAY ISLAND!
  // ============================================================================
  private buildEstateDeckAnd1FWalls(
    size: HouseSizeLevel,
    hasBasement: boolean,
    wallStyle: WallStyleId,
    floorStyle: FloorStyleId,
    accentHex: string
  ) {
    this.disposeObjectChildren(this.estateGroup);
    const { floorMat, wallMat, trimMat, woodMat, metalMat, glassMat } = this.makePalette(
      wallStyle,
      floorStyle
    );

    const half = getHouseBoundsRadius(size);
    const span = half * 2;
    const slabH = 0.08;
    const slabY = 0.12 - slabH / 2; // top surface sits cleanly at y = 0.12!
    const edgeMat = new THREE.LineBasicMaterial({
      color: "#94a3b8",
      transparent: true,
      opacity: 0.48
    });

    const addFloorSegment = (minX: number, maxX: number, minZ: number, maxZ: number) => {
      const w = maxX - minX;
      const d = maxZ - minZ;
      if (w <= 0.02 || d <= 0.02) return;
      const geo = new THREE.BoxGeometry(w, slabH, d);
      const mesh = new THREE.Mesh(geo, floorMat);
      mesh.position.set((minX + maxX) * 0.5, slabY, (minZ + maxZ) * 0.5);
      mesh.receiveShadow = true;
      this.estateGroup.add(mesh);
    };

    if (hasBasement) {
      // Build 4 flush floor slabs leaving a REAL open stairwell cutout for B1 <-> 1F (x ∈ [2.22, 3.18], z ∈ [-2.85, -0.15])!
      const hMinX = 2.22;
      const hMaxX = 3.18;
      const hMinZ = -2.85;
      const hMaxZ = -0.15;
      addFloorSegment(-half, hMinX, -half, half); // Wide West + Center floor
      addFloorSegment(hMaxX, half, -half, half); // East strip beside stairwell
      addFloorSegment(hMinX, hMaxX, -half, hMinZ); // North header above stairwell
      addFloorSegment(hMinX, hMaxX, hMaxZ, half); // South landing right in front of stairs!

      // Crisp brushed-titanium stairwell opening rim trim!
      const rimWest = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.09, hMaxZ - hMinZ + 0.04), metalMat);
      rimWest.position.set(hMinX, slabY, (hMinZ + hMaxZ) * 0.5);
      const rimNorth = new THREE.Mesh(new THREE.BoxGeometry(hMaxX - hMinX + 0.04, 0.09, 0.035), metalMat);
      rimNorth.position.set((hMinX + hMaxX) * 0.5, slabY, hMinZ);
      this.estateGroup.add(rimWest, rimNorth);
    } else {
      addFloorSegment(-half, half, -half, half);
    }

    // Subtle crisp architectural deck perimeter outline
    const deckOutline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(span, slabH, span)),
      edgeMat
    );
    deckOutline.position.y = slabY;
    this.estateGroup.add(deckOutline);

    // ---- MODERNIST CUTAWAY ARCHITECTURAL 1F WALLS & FLOOR-TO-CEILING PANORAMIC GLASS WINDOWS ----
    const wallH = 2.48;
    const wallY = 0.12 + wallH / 2;
    const wallZ = -3.52;
    const wallX = -3.52;

    // North Back Wall: architectural piers framing 2 huge sunlit floor-to-ceiling panoramic glass windows!
    const addWallPier = (x: number, z: number, w: number, h: number, d: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      m.position.set(x, 0.12 + h / 2, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.estateGroup.add(m);
    };

    // North wall piers (x = -3.52 .. +3.52)
    addWallPier(-3.26, wallZ, 0.62, wallH, 0.16); // NW corner pier
    addWallPier(0.0, wallZ, 0.68, wallH, 0.16); // Center structural pier
    addWallPier(3.26, wallZ, 0.62, wallH, 0.16); // NE corner pier
    // North header & low windowsill framing the twin panoramic windows
    const northHeader = new THREE.Mesh(new THREE.BoxGeometry(7.16, 0.24, 0.18), wallMat);
    northHeader.position.set(0, 0.12 + wallH - 0.12, wallZ);
    northHeader.castShadow = true;
    const northSill = new THREE.Mesh(new THREE.BoxGeometry(7.16, 0.34, 0.18), trimMat);
    northSill.position.set(0, 0.12 + 0.17, wallZ);
    this.estateGroup.add(northHeader, northSill);

    // Twin North Floor-to-Ceiling Panoramic Glass Windows with slim titanium mullions
    for (const wx of [-1.64, 1.64]) {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(2.6, wallH - 0.58, 0.035), glassMat);
      pane.position.set(wx, wallY + 0.05, wallZ);
      this.estateGroup.add(pane);
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.04, wallH - 0.56, 0.06), metalMat);
      mullion.position.set(wx, wallY + 0.05, wallZ);
      this.estateGroup.add(mullion);
    }

    // West Cutaway Wall: clean plaster + vertical glass bay window + vertical timber accent louver slats!
    addWallPier(wallX, -2.55, 0.16, wallH, 1.96); // Back-west stair wall
    addWallPier(wallX, 2.75, 0.16, wallH, 1.56); // Front-west pier
    const westHeader = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 7.12), wallMat);
    westHeader.position.set(wallX, 0.12 + wallH - 0.12, 0);
    const westSill = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.34, 7.12), trimMat);
    westSill.position.set(wallX, 0.12 + 0.17, 0);
    this.estateGroup.add(westHeader, westSill);

    const westWindow = new THREE.Mesh(new THREE.BoxGeometry(0.035, wallH - 0.58, 3.52), glassMat);
    westWindow.position.set(wallX, wallY + 0.05, 0.22);
    this.estateGroup.add(westWindow);
    for (const wz of [-0.65, 0.22, 1.08]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, wallH - 0.56, 0.04), metalMat);
      m.position.set(wallX, wallY + 0.05, wz);
      this.estateGroup.add(m);
    }

    // Architectural Nordic Timber Accent Slats mounted beside the North center pier
    for (let i = 0; i < 5; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.042, wallH - 0.32, 0.04), woodMat);
      slat.position.set(-0.22 + i * 0.11, wallY, wallZ + 0.1);
      this.estateGroup.add(slat);
    }

    // Slim Brushed-Titanium Architectural Corner Columns on open East & South cutaway edges
    for (const [cx, cz] of [[3.5, 3.5], [3.5, -0.08], [-3.5, 3.5]] as const) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.06, wallH, 12), metalMat);
      col.position.set(cx, wallY, cz);
      col.castShadow = true;
      this.estateGroup.add(col);
    }

    // ---- SCULPTURAL CENTER ARCHITECT NFT DISPLAY ISLAND (Top at y = 0.68m!) ----
    // Holds the miniature seed-generated borosilicate NFT apparatus & miniature on-chain wings cleanly!
    const tableGroup = new THREE.Group();
    tableGroup.position.set(0, 0.12, -0.35);

    const tblW = 1.84;
    const tblD = 1.32;
    const tblH = 0.56; // 0.12 + 0.56 = 0.68m exact tabletop height!

    // Chamfered honed-alabaster tabletop slab
    const topGeo = new THREE.BoxGeometry(tblW, 0.055, tblD);
    const tabletop = new THREE.Mesh(
      topGeo,
      new THREE.MeshStandardMaterial({
        map: this.terrazzoTex,
        color: "#fbfdff",
        roughness: 0.34,
        metalness: 0.06
      })
    );
    tabletop.position.y = tblH - 0.0275;
    tabletop.castShadow = true;
    tabletop.receiveShadow = true;
    tableGroup.add(tabletop);

    const topBevel = new THREE.Mesh(new THREE.BoxGeometry(tblW + 0.03, 0.022, tblD + 0.03), metalMat);
    topBevel.position.y = tblH - 0.055;
    tableGroup.add(topBevel);

    // Glowing recessed exhibition ring inlaid on the tabletop directly under the miniature NFT vessel!
    const tableGlowRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.012, 10, 48),
      new THREE.MeshStandardMaterial({
        color: accentHex,
        emissive: accentHex,
        emissiveIntensity: 0.95,
        roughness: 0.2
      })
    );
    tableGlowRing.rotation.x = Math.PI / 2;
    tableGlowRing.position.y = tblH + 0.004;
    tableGroup.add(tableGlowRing);

    // Subtle frosted-glass lower gallery shelf (y = 0.24) with architectural books & rolled blueprints!
    const lowerShelf = new THREE.Mesh(new THREE.BoxGeometry(tblW - 0.24, 0.024, tblD - 0.24), glassMat);
    lowerShelf.position.y = 0.22;
    tableGroup.add(lowerShelf);

    const bookColors = ["#94a3b8", "#38bdf8", "#f472b6"];
    bookColors.forEach((col, i) => {
      const bk = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.032, 0.18),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.45 })
      );
      bk.position.set(-0.46, 0.25 + i * 0.033, 0.22);
      bk.rotation.y = i * 0.14;
      tableGroup.add(bk);
    });
    // Rolled architectural blueprint scrolls on lower shelf
    for (let r = 0; r < 2; r++) {
      const scroll = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.028, 0.42, 12),
        new THREE.MeshStandardMaterial({ color: "#e0f2fe", roughness: 0.5 })
      );
      scroll.rotation.z = Math.PI / 2;
      scroll.position.set(0.36, 0.26, 0.18 + r * 0.08);
      tableGroup.add(scroll);
    }

    // 4 Slim Tapered Brushed-Titanium Architectural Table Legs + Stretcher Rails
    for (const [lx, lz] of [
      [-tblW * 0.44, -tblD * 0.42],
      [tblW * 0.44, -tblD * 0.42],
      [-tblW * 0.44, tblD * 0.42],
      [tblW * 0.44, tblD * 0.42]
    ] as const) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.018, tblH - 0.04, 12), metalMat);
      leg.position.set(lx, (tblH - 0.04) / 2, lz);
      leg.castShadow = true;
      tableGroup.add(leg);
    }
    this.estateGroup.add(tableGroup);

    // ---- WELCOMING SOUTH FRONT PORCH MAT, MAILBOX, HEDGES & NEIGHBORHOOD LOT FENCE ----
    const matMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.16, 0.02, 0.62),
      new THREE.MeshStandardMaterial({ color: "#e8dfd2", roughness: 0.88 })
    );
    matMesh.position.set(0, 0.13, half - 0.36);
    matMesh.receiveShadow = true;
    this.estateGroup.add(matMesh);

    // Front Porch Entrance Step down to yard sidewalk
    const porchStep = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.06, 0.36), wallMat);
    porchStep.position.set(0, 0.055, half + 0.18);
    porchStep.receiveShadow = true;
    this.estateGroup.add(porchStep);

    // Residential Front Porch Mailbox
    const mb = new THREE.Group();
    mb.position.set(1.18, 0.12, half - 0.16);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.62, 10), metalMat);
    post.position.y = 0.31;
    post.castShadow = true;
    mb.add(post);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.24), trimMat);
    box.position.y = 0.65;
    box.castShadow = true;
    mb.add(box);
    const flag = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.09, 0.035),
      new THREE.MeshStandardMaterial({ color: accentHex, emissive: accentHex, emissiveIntensity: 0.5 })
    );
    flag.position.set(0.09, 0.69, 0.04);
    mb.add(flag);
    this.estateGroup.add(mb);

    // Architectural Corner Hedges along South front edge
    const hedgeMat = new THREE.MeshStandardMaterial({ color: "#a7d7be", roughness: 0.72 });
    for (const side of [-1, 1]) {
      const hedge = new THREE.Mesh(new THREE.BoxGeometry(half - 1.55, 0.28, 0.26), hedgeMat);
      hedge.position.set(side * (half * 0.5 + 0.62), 0.24, half - 0.14);
      hedge.castShadow = true;
      this.estateGroup.add(hedge);
    }

    // Proper Residential Neighborhood Lot Perimeter Fence & Stone Corner Pillars (Plot #1!)
    const lotHalf = 4.92;
    const fenceRailMat = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.42 });
    const postGeo = new THREE.BoxGeometry(0.16, 0.52, 0.16);
    const cornerCoords: Array<[number, number]> = [
      [-lotHalf, -lotHalf],
      [lotHalf, -lotHalf],
      [-lotHalf, lotHalf],
      [lotHalf, lotHalf],
      [-1.45, lotHalf],
      [1.45, lotHalf]
    ];
    for (const [px, pz] of cornerCoords) {
      const pillar = new THREE.Mesh(postGeo, wallMat);
      pillar.position.set(px, 0.26, pz);
      pillar.castShadow = true;
      this.estateGroup.add(pillar);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.2), trimMat);
      cap.position.set(px, 0.54, pz);
      this.estateGroup.add(cap);
    }
    const northFence = new THREE.Mesh(new THREE.BoxGeometry(lotHalf * 2, 0.34, 0.06), fenceRailMat);
    northFence.position.set(0, 0.22, -lotHalf);
    const westFence = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, lotHalf * 2), fenceRailMat);
    westFence.position.set(-lotHalf, 0.22, 0);
    const eastFence = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, lotHalf * 2), fenceRailMat);
    eastFence.position.set(lotHalf, 0.22, 0);
    this.estateGroup.add(northFence, westFence, eastFence);
    for (const side of [-1, 1]) {
      const wingW = lotHalf - 1.45;
      const frontWing = new THREE.Mesh(new THREE.BoxGeometry(wingW, 0.34, 0.06), fenceRailMat);
      frontWing.position.set(side * (1.45 + wingW * 0.5), 0.22, lotHalf);
      this.estateGroup.add(frontWing);
    }

    if (size >= 2) {
      // Lv. 2 Courtyard Residence: Wraparound Frosted-Glass Veranda Balustrades & Warm Corner Lanterns!
      const railH = 0.44;
      for (const side of [-1, 1]) {
        const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.045, railH, span - 1.6), glassMat);
        sideGlass.position.set(side * (half - 0.08), 0.12 + railH / 2, -0.15);
        this.estateGroup.add(sideGlass);
        const sideRail = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.032, span - 1.5), metalMat);
        sideRail.position.set(side * (half - 0.08), 0.12 + railH, -0.15);
        this.estateGroup.add(sideRail);
      }
      for (const sx of [-half + 0.16, half - 0.16]) {
        for (const sz of [-half + 0.16, half - 0.16]) {
          const col = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.94, 0.16), trimMat);
          col.position.set(sx, 0.59, sz);
          col.castShadow = true;
          this.estateGroup.add(col);
          const capLight = new THREE.Mesh(
            new THREE.SphereGeometry(0.07, 12, 12),
            new THREE.MeshStandardMaterial({
              color: "#fffbeb",
              emissive: "#fde68a",
              emissiveIntensity: 0.95
            })
          );
          capLight.position.set(sx, 1.12, sz);
          this.estateGroup.add(capLight);
        }
      }
    }

    if (size >= 3) {
      // Lv. 3 Grand Villa Estate: Frosted-Glass Entrance Portico Arch + Luminous Perimeter Cove!
      const porticoY = 2.02;
      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.072, 1.9, 14), metalMat);
        pillar.position.set(side * 1.18, 1.06, half - 0.22);
        pillar.castShadow = true;
        this.estateGroup.add(pillar);
      }
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.07, 0.68), glassMat);
      canopy.position.set(0, porticoY, half - 0.22);
      this.estateGroup.add(canopy);
      const canopyTrim = new THREE.Mesh(new THREE.BoxGeometry(2.72, 0.04, 0.72), trimMat);
      canopyTrim.position.set(0, porticoY + 0.05, half - 0.22);
      this.estateGroup.add(canopyTrim);
    }
  }

  // ============================================================================
  // 2. THREE REAL PHYSICALLY WALKABLE ARCHITECTURAL FLOATING-TREAD STAIRCASES!
  // ============================================================================
  private buildWalkableStaircases(
    floors: HouseFloorCount,
    hasBasement: boolean,
    wallStyle: WallStyleId,
    accentHex: string
  ) {
    this.disposeObjectChildren(this.basementStairGroup);
    this.disposeObjectChildren(this.upperStair1Group);
    this.disposeObjectChildren(this.upperStair2Group);

    const { woodMat, metalMat, glassMat } = this.makePalette(wallStyle);
    const ledMat = new THREE.MeshStandardMaterial({
      color: "#fffbeb",
      emissive: "#fde68a",
      emissiveIntensity: 0.78
    });
    const entryGlowMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 0.88
    });

    const buildFlight = (flight: StairFlightDef, targetGroup: THREE.Group, railSide: -1 | 1) => {
      const root = new THREE.Group();
      const centerX = (flight.minX + flight.maxX) * 0.5;
      const width = flight.maxX - flight.minX - 0.04;
      const dz = flight.endZ - flight.startZ;
      const dy = flight.toY - flight.fromY;
      const treadDepth = Math.abs(dz) / flight.stepCount + 0.03;

      // Individual architectural floating oak treads + warm recessed under-step LED strip!
      for (let i = 0; i < flight.stepCount; i++) {
        const u = (i + 0.5) / flight.stepCount;
        const sz = flight.startZ + u * dz;
        const sy = flight.fromY + u * dy;

        const tread = new THREE.Mesh(new THREE.BoxGeometry(width, 0.048, treadDepth), woodMat);
        tread.position.set(centerX, sy - 0.024, sz);
        tread.castShadow = true;
        tread.receiveShadow = true;
        root.add(tread);

        const noseLed = new THREE.Mesh(new THREE.BoxGeometry(width - 0.1, 0.012, 0.018), ledMat);
        noseLed.position.set(centerX, sy - 0.052, sz + (dz < 0 ? treadDepth * 0.42 : -treadDepth * 0.42));
        root.add(noseLed);
      }

      // Twin Diagonal Brushed-Titanium Monostringers supporting the floating steps
      const flightLen = Math.hypot(dz, dy);
      const slopePitch = Math.atan2(dy, dz);
      for (const offset of [-width * 0.34, width * 0.34]) {
        const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.095, flightLen), metalMat);
        stringer.position.set(
          centerX + offset,
          (flight.fromY + flight.toY) * 0.5 - 0.09,
          (flight.startZ + flight.endZ) * 0.5
        );
        stringer.rotation.x = -slopePitch;
        stringer.castShadow = true;
        root.add(stringer);
      }

      // Sleek Diagonal Frosted-Glass Handrail Balustrade along the interior edge
      const railX = railSide < 0 ? flight.minX + 0.02 : flight.maxX - 0.02;
      const handrail = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.036, flightLen + 0.12), metalMat);
      handrail.position.set(
        railX,
        (flight.fromY + flight.toY) * 0.5 + 0.54,
        (flight.startZ + flight.endZ) * 0.5
      );
      handrail.rotation.x = -slopePitch;
      root.add(handrail);

      for (let p = 0; p <= 4; p++) {
        const u = p / 4;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.56, 8), metalMat);
        post.position.set(railX, flight.fromY + u * dy + 0.27, flight.startZ + u * dz);
        root.add(post);
      }

      // Subtle glowing threshold strips at both landings showing where to walk onto the steps!
      const startStrip = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.012, 0.045), entryGlowMat);
      startStrip.position.set(centerX, flight.fromY + 0.008, flight.startZ + (dz < 0 ? 0.08 : -0.08));
      const endStrip = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.012, 0.045), entryGlowMat);
      endStrip.position.set(centerX, flight.toY + 0.008, flight.endZ + (dz < 0 ? -0.08 : 0.08));
      root.add(startStrip, endStrip);

      // On 1F Basement Stairwell opening, add a crisp protective glass guardrail around the West & North drop edges!
      if (flight.id === "b1-1f") {
        const guardW = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.54, 2.7), glassMat);
        guardW.position.set(flight.minX, 0.12 + 0.27, -1.5);
        const guardWCap = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.028, 2.74), metalMat);
        guardWCap.position.set(flight.minX, 0.12 + 0.55, -1.5);
        const guardN = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.54, 0.035), glassMat);
        guardN.position.set(centerX, 0.12 + 0.27, -2.85);
        const guardNCap = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.028, 0.055), metalMat);
        guardNCap.position.set(centerX, 0.12 + 0.55, -2.85);
        root.add(guardW, guardWCap, guardN, guardNCap);
      }

      this.tagTarget(root, {
        kind: "stairs",
        label: flight.label,
        worldX: centerX,
        worldZ: flight.startZ + (dz < 0 ? 0.35 : -0.35)
      });
      targetGroup.add(root);
    };

    const b1Flight = STAIR_FLIGHTS.find((f) => f.id === "b1-1f");
    const f12Flight = STAIR_FLIGHTS.find((f) => f.id === "1f-2f");
    const f23Flight = STAIR_FLIGHTS.find((f) => f.id === "2f-3f");

    if (hasBasement && b1Flight) {
      buildFlight(b1Flight, this.basementStairGroup, -1);
    }
    if (floors >= 2 && f12Flight) {
      buildFlight(f12Flight, this.upperStair1Group, 1);
    }
    if (floors >= 3 && f23Flight) {
      buildFlight(f23Flight, this.upperStair2Group, 1);
    }
  }

  // ============================================================================
  // 3. 2F ARCHITECT MEZZANINE LOFT & 3F STARLIGHT SKY PENTHOUSE
  // ============================================================================
  private buildUpperFloors(
    floors: HouseFloorCount,
    wallStyle: WallStyleId,
    floorStyle: FloorStyleId,
    accentHex: string
  ) {
    this.disposeObjectChildren(this.floor2Group);
    this.disposeObjectChildren(this.floor3Group);
    this.fairyBulbs = [];
    if (floors < 2) return;

    const { floorMat, wallMat, trimMat, woodMat, metalMat, glassMat } = this.makePalette(
      wallStyle,
      floorStyle
    );

    // ---- 2F ARCHITECT MEZZANINE LOFT (y = 2.68m) ----
    // Designed as a sleek North Gallery + West Wing L-Loft + East Balcony Overlook so the South-East
    // camera ALWAYS enjoys an unobstructed view into the 1F living hall & tabletop NFT below!
    const y2 = 2.68;
    const slabH = 0.1;

    // 2F North Gallery Floor (x = -3.52 .. +3.52, z = -3.52 .. -1.78 — clear behind 1F camera ray!)
    const nSlab = new THREE.Mesh(new THREE.BoxGeometry(7.04, slabH, 1.76), floorMat);
    nSlab.position.set(0, y2 - slabH / 2, -2.64);
    nSlab.castShadow = true;
    nSlab.receiveShadow = true;
    this.floor2Group.add(nSlab);

    // 2F West Loft Wing South of the 1F->2F Stairwell (x = -3.52 .. -1.72, z = -0.15 .. +1.55)
    const wFrontSlab = new THREE.Mesh(new THREE.BoxGeometry(1.8, slabH, 1.74), floorMat);
    wFrontSlab.position.set(-2.62, y2 - slabH / 2, 0.7);
    wFrontSlab.castShadow = true;
    wFrontSlab.receiveShadow = true;
    this.floor2Group.add(wFrontSlab);

    // Narrow sleek bridge corridor along West outer wall beside the 1F->2F stairs? Wait: stairs are x ∈ [-3.18, -2.22],
    // so place a sleek 0.48m inner glass walkway along x ∈ [-2.22, -1.72], z ∈ [-1.78, -0.15] connecting North Gallery to West Loft!
    const wBridge = new THREE.Mesh(new THREE.BoxGeometry(0.54, slabH, 1.66), floorMat);
    wBridge.position.set(-1.95, y2 - slabH / 2, -0.96);
    wBridge.castShadow = true;
    wBridge.receiveShadow = true;
    this.floor2Group.add(wBridge);

    // Sleek Glass Atrium Balustrades overlooking the double-height living room & Center NFT Table!
    const northAtriumRail = new THREE.Mesh(new THREE.BoxGeometry(5.26, 0.52, 0.035), glassMat);
    northAtriumRail.position.set(0.88, y2 + 0.26, -1.78);
    const northAtriumCap = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.028, 0.055), metalMat);
    northAtriumCap.position.set(0.88, y2 + 0.53, -1.78);
    this.floor2Group.add(northAtriumRail, northAtriumCap);

    const westAtriumRail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.52, 3.36), glassMat);
    westAtriumRail.position.set(-1.72, y2 + 0.26, -0.12);
    const westAtriumCap = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.028, 3.4), metalMat);
    westAtriumCap.position.set(-1.72, y2 + 0.53, -0.12);
    this.floor2Group.add(westAtriumRail, westAtriumCap);

    // Luminous accent fascia trim along the 2F double-height overhang edge
    const fasciaGlow = new THREE.Mesh(
      new THREE.BoxGeometry(5.3, 0.024, 0.03),
      new THREE.MeshStandardMaterial({
        color: accentHex,
        emissive: accentHex,
        emissiveIntensity: 0.72
      })
    );
    fasciaGlow.position.set(0.88, y2 - 0.05, -1.75);
    this.floor2Group.add(fasciaGlow);

    // 2F Cutaway North & West Architectural Clerestory Walls with Panoramic Strip Windows!
    const w2H = 1.92;
    const n2Sill = new THREE.Mesh(new THREE.BoxGeometry(7.04, 0.52, 0.14), wallMat);
    n2Sill.position.set(0, y2 + 0.26, -3.52);
    const n2Glass = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.18, 0.035), glassMat);
    n2Glass.position.set(0, y2 + 1.11, -3.52);
    const n2RoofFascia = new THREE.Mesh(new THREE.BoxGeometry(7.24, 0.16, 1.95), wallMat);
    n2RoofFascia.position.set(0, y2 + w2H, -2.62);
    n2RoofFascia.castShadow = true;
    this.floor2Group.add(n2Sill, n2Glass, n2RoofFascia);

    const w2Sill = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.52, 5.12), wallMat);
    w2Sill.position.set(-3.52, y2 + 0.26, -0.96);
    const w2Glass = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.18, 4.92), glassMat);
    w2Glass.position.set(-3.52, y2 + 1.11, -0.96);
    const w2RoofFascia = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.16, 3.36), wallMat);
    w2RoofFascia.position.set(-2.62, y2 + w2H, -0.08);
    this.floor2Group.add(w2Sill, w2Glass, w2RoofFascia);

    // East glass parapet on 2F North Gallery
    const e2Rail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.56, 1.74), glassMat);
    e2Rail.position.set(3.5, y2 + 0.28, -2.64);
    const e2Cap = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.03, 1.78), metalMat);
    e2Cap.position.set(3.5, y2 + 0.57, -2.64);
    this.floor2Group.add(e2Rail, e2Cap);

    // Cozy Built-In 2F Loft Furnishings (Reading Daybed + Round Coffee Table + Lamp + Planter!)
    const loftSeat = new THREE.Mesh(
      new THREE.BoxGeometry(1.26, 0.24, 0.56),
      new THREE.MeshStandardMaterial({ color: "#f8fafd", roughness: 0.78 })
    );
    loftSeat.position.set(0.45, y2 + 0.16, -3.02);
    loftSeat.castShadow = true;
    const loftBolster = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 0.48, 12),
      new THREE.MeshStandardMaterial({ color: "#ddd6fe", roughness: 0.78 })
    );
    loftBolster.rotation.x = Math.PI / 2;
    loftBolster.position.set(-0.06, y2 + 0.31, -3.02);
    const loftTable = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 18), woodMat);
    loftTable.position.set(1.45, y2 + 0.32, -2.95);
    const loftStem = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.04, 0.32, 10), metalMat);
    loftStem.position.set(1.45, y2 + 0.16, -2.95);
    const loftLampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.92, 10), metalMat);
    loftLampPole.position.set(1.85, y2 + 0.46, -3.12);
    const loftShade = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 12),
      new THREE.MeshStandardMaterial({ color: "#fffbeb", emissive: "#fde68a", emissiveIntensity: 0.95 })
    );
    loftShade.position.set(1.85, y2 + 0.96, -3.12);
    this.floor2Group.add(loftSeat, loftBolster, loftTable, loftStem, loftLampPole, loftShade);

    // 2F West Wing Architect Studio Bookshelf & Reading Rug
    const w2Rug = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 0.02, 1.15),
      new THREE.MeshStandardMaterial({ color: "#eff6ff", roughness: 0.88 })
    );
    w2Rug.position.set(-2.62, y2 + 0.012, 0.72);
    const w2Desk = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 1.05), woodMat);
    w2Desk.position.set(-3.14, y2 + 0.52, 0.72);
    for (const lz of [0.28, 1.16]) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.52, 8), metalMat);
      l.position.set(-3.14, y2 + 0.26, lz);
      this.floor2Group.add(l);
    }
    this.floor2Group.add(w2Rug, w2Desk);

    // ---- 3F STARLIGHT SKY PENTHOUSE (y = 4.68m, when houseFloors >= 3) ----
    if (floors >= 3) {
      const y3 = 4.68;
      const pBackSlab = new THREE.Mesh(new THREE.BoxGeometry(7.04, slabH, 1.85), floorMat);
      pBackSlab.position.set(0, y3 - slabH / 2, -2.58);
      pBackSlab.castShadow = true;
      pBackSlab.receiveShadow = true;
      this.floor3Group.add(pBackSlab);

      const pWestSlab = new THREE.Mesh(new THREE.BoxGeometry(1.85, slabH, 3.25), floorMat);
      pWestSlab.position.set(-2.58, y3 - slabH / 2, -0.05);
      pWestSlab.castShadow = true;
      pWestSlab.receiveShadow = true;
      this.floor3Group.add(pWestSlab);

      const pEastSlab = new THREE.Mesh(new THREE.BoxGeometry(1.85, slabH, 3.25), floorMat);
      pEastSlab.position.set(2.58, y3 - slabH / 2, -0.05);
      pEastSlab.castShadow = true;
      pEastSlab.receiveShadow = true;
      this.floor3Group.add(pEastSlab);

      // Perimeter glass sky railings
      const pNorthRail = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.56, 0.04), glassMat);
      pNorthRail.position.set(0, y3 + 0.28, -3.48);
      this.floor3Group.add(pNorthRail);
      for (const side of [-1, 1]) {
        const sr = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.56, 5.0), glassMat);
        sr.position.set(side * 3.48, y3 + 0.28, -0.96);
        this.floor3Group.add(sr);
      }

      // Overarching Sky Conservatory Pergola + Animated Glowing Festoon Lights!
      for (const side of [-1, 1]) {
        const arch = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.032, 10, 40, Math.PI), metalMat);
        arch.position.set(0, y3, side * 1.15 - 1.55);
        this.floor3Group.add(arch);
      }
      const bulbMat = new THREE.MeshStandardMaterial({
        color: "#fffbeb",
        emissive: "#fde68a",
        emissiveIntensity: 1.2
      });
      for (let i = 0; i < 9; i++) {
        const u = (i + 1) / 10;
        const ang = u * Math.PI;
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 10), bulbMat);
        b.position.set(Math.cos(ang) * 2.55, y3 + Math.sin(ang) * 2.55, -2.7);
        this.floor3Group.add(b);
        this.fairyBulbs.push(b);
      }

      // Sculptural Penthouse Stargazing Telescope on East Sky Deck!
      const tele = new THREE.Group();
      tele.position.set(2.65, y3, 0.45);
      tele.rotation.y = -0.6;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.72, 8), metalMat);
        leg.position.set(Math.cos(a) * 0.14, 0.34, Math.sin(a) * 0.14);
        leg.rotation.z = -Math.cos(a) * 0.28;
        leg.rotation.x = Math.sin(a) * 0.28;
        tele.add(leg);
      }
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.042, 0.62, 14), trimMat);
      barrel.position.set(0, 0.74, 0.04);
      barrel.rotation.x = Math.PI / 2 - 0.52;
      barrel.castShadow = true;
      tele.add(barrel);
      this.floor3Group.add(tele);
    }
  }

  // ============================================================================
  // 4. SIX UNLOCKABLE HOMELY ARCHITECTURAL ROOM ADDITIONS (Clickable in 3D!)
  // ============================================================================
  private buildExtraRooms(rooms: readonly ExtraRoomId[], wallStyle: WallStyleId, accentHex: string) {
    this.disposeObjectChildren(this.roomsGroup);
    this.hearthFlames = [];
    this.spaSteam = [];
    if (rooms.length === 0) return;

    const { wallMat, trimMat, metalMat, glassMat } = this.makePalette(wallStyle);
    const plushWhite = new THREE.MeshStandardMaterial({ color: "#f8fafd", roughness: 0.82 });

    for (const roomId of rooms) {
      const def = EXTRA_ROOM_DEFS.find((r) => r.id === roomId);
      if (!def) continue;

      const root = new THREE.Group();
      root.position.set(def.x, 0.12, def.z);
      root.rotation.y = def.yaw;

      const zoneMat = new THREE.Mesh(
        new THREE.BoxGeometry(1.52, 0.04, 1.32),
        new THREE.MeshStandardMaterial({ color: "#f1f5f9", roughness: 0.72 })
      );
      zoneMat.position.y = 0.015;
      zoneMat.receiveShadow = true;
      root.add(zoneMat);

      if (roomId === "bedroom") {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.2, 1.16), trimMat);
        frame.position.set(-0.1, 0.12, 0);
        frame.castShadow = true;
        root.add(frame);
        const duvet = new THREE.Mesh(
          new THREE.BoxGeometry(0.96, 0.16, 0.82),
          new THREE.MeshStandardMaterial({ color: "#ede9fe", roughness: 0.85 })
        );
        duvet.position.set(-0.1, 0.28, 0.12);
        duvet.castShadow = true;
        root.add(duvet);
        for (const px of [-0.3, 0.1]) {
          const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.22), plushWhite);
          pillow.position.set(px, 0.29, -0.36);
          pillow.rotation.x = 0.22;
          root.add(pillow);
        }
        for (const sx of [-0.58, 0.38]) {
          for (const sz of [-0.54, 0.54]) {
            const p = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 1.18, 8), metalMat);
            p.position.set(sx, 0.62, sz);
            root.add(p);
          }
        }
        const canopyTop = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.03, 1.12), glassMat);
        canopyTop.position.set(-0.1, 1.22, 0);
        root.add(canopyTop);
        const stand = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.3), wallMat);
        stand.position.set(0.6, 0.18, -0.34);
        root.add(stand);
        const lamp = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 12, 12),
          new THREE.MeshStandardMaterial({ color: "#fffbeb", emissive: "#fde68a", emissiveIntensity: 0.95 })
        );
        lamp.position.set(0.6, 0.45, -0.34);
        root.add(lamp);
      } else if (roomId === "kitchen") {
        const island = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.58, 0.48), wallMat);
        island.position.set(0, 0.3, -0.15);
        island.castShadow = true;
        root.add(island);
        const counterTop = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.04, 0.54), trimMat);
        counterTop.position.set(0, 0.61, -0.15);
        root.add(counterTop);
        const kettle = new THREE.Mesh(
          new THREE.SphereGeometry(0.085, 14, 12),
          new THREE.MeshStandardMaterial({ color: "#bae6fd", roughness: 0.25, metalness: 0.3 })
        );
        kettle.position.set(-0.26, 0.7, -0.15);
        root.add(kettle);
        const bowl = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11, 0.07, 0.08, 16),
          new THREE.MeshStandardMaterial({ color: "#fef3c7", roughness: 0.45 })
        );
        bowl.position.set(0.24, 0.67, -0.15);
        root.add(bowl);
        for (const sx of [-0.32, 0.32]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.38, 10), metalMat);
          leg.position.set(sx, 0.2, 0.36);
          root.add(leg);
          const stoolTop = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.055, 16), plushWhite);
          stoolTop.position.set(sx, 0.41, 0.36);
          root.add(stoolTop);
        }
      } else if (roomId === "spa") {
        const tubMat = new THREE.MeshStandardMaterial({ color: "#dfc9aa", roughness: 0.55 });
        const tubOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.48, 0.44, 24), tubMat);
        tubOuter.position.y = 0.23;
        tubOuter.castShadow = true;
        root.add(tubOuter);
        const water = new THREE.Mesh(
          new THREE.CircleGeometry(0.47, 24),
          new THREE.MeshPhysicalMaterial({
            color: "#7dd3fc",
            emissive: "#38bdf8",
            emissiveIntensity: 0.42,
            roughness: 0.05,
            clearcoat: 1.0
          })
        );
        water.rotation.x = -Math.PI / 2;
        water.position.y = 0.455;
        root.add(water);
        const steamGeo = new THREE.SphereGeometry(0.055, 10, 10);
        const steamMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.45 });
        for (let i = 0; i < 4; i++) {
          const st = new THREE.Mesh(steamGeo, steamMat);
          st.position.set(Math.cos(i * 1.6) * 0.2, 0.55 + i * 0.1, Math.sin(i * 1.6) * 0.2);
          root.add(st);
          this.spaSteam.push(st);
        }
      } else if (roomId === "hearth") {
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.24, 0.46), wallMat);
        base.position.set(0, 0.13, -0.2);
        base.castShadow = true;
        root.add(base);
        const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.36, 0.72, 16), metalMat);
        hood.position.set(0, 1.05, -0.2);
        hood.castShadow = true;
        root.add(hood);
        const flue = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.65, 12), metalMat);
        flue.position.set(0, 1.62, -0.2);
        root.add(flue);
        const firebox = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.44, 0.36), glassMat);
        firebox.position.set(0, 0.47, -0.2);
        root.add(firebox);
        for (let i = 0; i < 3; i++) {
          const flame = new THREE.Mesh(
            new THREE.ConeGeometry(0.065, 0.2, 8),
            new THREE.MeshStandardMaterial({
              color: i === 1 ? "#fef08a" : "#fb923c",
              emissive: i === 1 ? "#f59e0b" : "#f97316",
              emissiveIntensity: 1.35
            })
          );
          flame.position.set((i - 1) * 0.11, 0.36, -0.2);
          root.add(flame);
          this.hearthFlames.push(flame);
        }
        const fireGlow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.getWarmGlow(),
            transparent: true,
            opacity: 0.65,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        fireGlow.scale.set(0.85, 0.85, 1);
        fireGlow.position.set(0, 0.42, -0.15);
        root.add(fireGlow);
        const pouf = new THREE.Mesh(
          new THREE.CylinderGeometry(0.24, 0.26, 0.22, 18),
          new THREE.MeshStandardMaterial({ color: "#fce7f3", roughness: 0.84 })
        );
        pouf.position.set(0, 0.13, 0.36);
        pouf.castShadow = true;
        root.add(pouf);
      } else if (roomId === "pergola") {
        for (const sx of [-0.56, 0.56]) {
          for (const sz of [-0.46, 0.46]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1.32, 0.075), trimMat);
            post.position.set(sx, 0.66, sz);
            post.castShadow = true;
            root.add(post);
          }
        }
        for (let i = 0; i < 5; i++) {
          const slat = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.045, 0.08), trimMat);
          slat.position.set(0, 1.34, -0.44 + i * 0.22);
          root.add(slat);
        }
        const vineMat = new THREE.MeshStandardMaterial({
          color: "#d8b4fe",
          emissive: "#a855f7",
          emissiveIntensity: 0.22,
          roughness: 0.5
        });
        for (let i = 0; i < 6; i++) {
          const cluster = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 7), vineMat);
          cluster.rotation.z = Math.PI;
          cluster.position.set(-0.45 + i * 0.18, 1.18, i % 2 === 0 ? -0.22 : 0.22);
          root.add(cluster);
        }
        const bench = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.22, 0.34), plushWhite);
        bench.position.set(0, 0.14, 0);
        root.add(bench);
      } else if (roomId === "music") {
        const pianoMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.12, metalness: 0.18 });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.2, 20), pianoMat);
        body.scale.set(1.15, 1, 0.92);
        body.position.set(0, 0.56, -0.06);
        body.castShadow = true;
        root.add(body);
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.025, 20), pianoMat);
        lid.scale.set(1.12, 1, 0.88);
        lid.position.set(-0.08, 0.82, -0.08);
        lid.rotation.z = 0.46;
        root.add(lid);
        for (const [lx, lz] of [[-0.36, 0.2], [0.36, 0.2], [0, -0.36]] as const) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.018, 0.52, 10), metalMat);
          leg.position.set(lx, 0.26, lz);
          root.add(leg);
        }
        const keys = new THREE.Mesh(
          new THREE.BoxGeometry(0.68, 0.04, 0.14),
          new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.2 })
        );
        keys.position.set(0, 0.55, 0.34);
        root.add(keys);
        const ebony = new THREE.Mesh(
          new THREE.BoxGeometry(0.62, 0.025, 0.065),
          new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.25 })
        );
        ebony.position.set(0, 0.575, 0.31);
        root.add(ebony);
        const bench = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.26, 0.22), trimMat);
        bench.position.set(0, 0.15, 0.56);
        root.add(bench);
        const noteGem = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.055, 0),
          new THREE.MeshStandardMaterial({ color: accentHex, emissive: accentHex, emissiveIntensity: 0.9 })
        );
        noteGem.position.set(0, 0.86, 0.22);
        root.add(noteGem);
      }

      this.tagTarget(root, {
        kind: "home-room",
        roomId: def.id,
        label: def.name,
        worldX: def.standX,
        worldZ: def.standZ
      });
      this.roomsGroup.add(root);
    }
  }

  public update(_dt: number, t: number) {
    for (let i = 0; i < this.hearthFlames.length; i++) {
      const fl = this.hearthFlames[i];
      const s = 0.85 + Math.sin(t * 11 + i * 2.1) * 0.22;
      fl.scale.set(0.95, s, 0.95);
      fl.position.y = 0.35 + (s - 0.85) * 0.06;
    }
    for (let i = 0; i < this.spaSteam.length; i++) {
      const st = this.spaSteam[i];
      const u = (t * 0.42 + i * 0.25) % 1;
      st.position.y = 0.52 + u * 0.45;
      st.scale.setScalar(0.65 + u * 0.95);
    }
    for (let i = 0; i < this.fairyBulbs.length; i++) {
      const b = this.fairyBulbs[i];
      b.scale.setScalar(0.9 + Math.sin(t * 2.8 + i * 0.7) * 0.14);
    }
    for (let i = 0; i < this.basementLeds.length; i++) {
      const mat = this.basementLeds[i].material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.65 + Math.sin(t * 3.4 + i * 1.3) * 0.45;
    }
  }

  private disposeObjectChildren(parent: THREE.Object3D) {
    const shared = new Set<THREE.Texture>([
      this.terrazzoTex,
      this.titaniumTex,
      ...(Object.values(this.floorTextures).filter(Boolean) as THREE.Texture[])
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
    this.disposeObjectChildren(this.group);
    Object.values(this.floorTextures).forEach((t) => t?.dispose());
    this.floorTextures = {};
    this.warmGlowTex?.dispose();
    this.warmGlowTex = null;
    this.interactiveRoots = [];
  }
}
