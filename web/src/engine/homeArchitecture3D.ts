import * as THREE from "three";
import { createRadialGlowTexture } from "./architectTextures";
import {
  EXTRA_ROOM_DEFS,
  WALL_STYLES,
  getHouseBoundsRadius,
  type ExtraRoomId,
  type HouseFloorCount,
  type HouseSizeLevel,
  type WallStyleId
} from "./homeLayout";
import type { LabDecorConfig, SimsObjectTarget } from "./simsState";

/**
 * Procedural 3D Homely Multi-Story Estate Architecture & 6 Cozy Interior Rooms!
 *
 * Strictly mounted inside `walkCampusGroup` (so Home mint card & Gallery thumbnails stay pure):
 *  - House Size Expansions (Lv. 1 Cottage -> Lv. 2 Courtyard Residence -> Lv. 3 Grand Villa Estate)
 *  - Multi-Story Walkable Cutaway Floors (1F -> 2F Sunlit Mezzanine Loft -> 3F Starlight Penthouse)
 *  - Clickable Brushed-Silver Spiral Staircase connecting floors
 *  - 6 Unlockable Homely Rooms (Bedroom, Kitchenette, Onsen Spa, Glass Hearth, Garden Pergola, Piano)
 *  - 5 Architectural Wall & Trim Finishes matching ALCHEMIA's cutesy silver-glass palette
 */
export class HomeArchitecture3D {
  public readonly group = new THREE.Group();

  private estateGroup = new THREE.Group();
  private floorsGroup = new THREE.Group();
  private roomsGroup = new THREE.Group();

  private interactiveRoots: THREE.Object3D[] = [];
  private terrazzoTex: THREE.Texture;
  private titaniumTex: THREE.Texture;
  private warmGlowTex: THREE.CanvasTexture | null = null;

  private lastSize: HouseSizeLevel | -1 = -1;
  private lastFloors: HouseFloorCount | -1 = -1;
  private lastWall: WallStyleId | "" = "";
  private lastRoomsKey = "";
  private lastAccent = "";

  // Animated homely details
  private hearthFlames: THREE.Mesh[] = [];
  private spaSteam: THREE.Mesh[] = [];
  private fairyBulbs: THREE.Mesh[] = [];

  constructor(terrazzoTex: THREE.Texture, titaniumTex: THREE.Texture) {
    this.terrazzoTex = terrazzoTex;
    this.titaniumTex = titaniumTex;
    this.group.add(this.estateGroup, this.floorsGroup, this.roomsGroup);
  }

  private getWarmGlow(): THREE.CanvasTexture {
    if (!this.warmGlowTex) {
      this.warmGlowTex = createRadialGlowTexture("#fbbf24");
    }
    return this.warmGlowTex;
  }

  private tagTarget(root: THREE.Object3D, target: SimsObjectTarget) {
    root.traverse((obj) => {
      obj.userData.simsTarget = target;
    });
    this.interactiveRoots.push(root);
  }

  public getRaycastTargets(): THREE.Object3D[] {
    return this.interactiveRoots;
  }

  public updateArchitecture(decor: LabDecorConfig, accentHex: string) {
    const roomsKey = [...decor.extraRooms].sort().join(",");
    const needsEstate =
      this.lastSize !== decor.houseSize ||
      this.lastWall !== decor.wallStyle ||
      this.lastAccent !== accentHex;
    const needsFloors =
      this.lastFloors !== decor.houseFloors ||
      this.lastSize !== decor.houseSize ||
      this.lastWall !== decor.wallStyle ||
      this.lastAccent !== accentHex;
    const needsRooms =
      this.lastRoomsKey !== roomsKey ||
      this.lastWall !== decor.wallStyle ||
      this.lastAccent !== accentHex;

    if (!needsEstate && !needsFloors && !needsRooms) return;

    this.lastSize = decor.houseSize;
    this.lastFloors = decor.houseFloors;
    this.lastWall = decor.wallStyle;
    this.lastRoomsKey = roomsKey;
    this.lastAccent = accentHex;

    if (needsEstate) {
      this.buildEstateDeck(decor.houseSize, decor.wallStyle, accentHex);
    }
    if (needsFloors) {
      this.buildUpperFloors(decor.houseFloors, decor.houseSize, decor.wallStyle, accentHex);
    }
    if (needsRooms) {
      this.buildExtraRooms(decor.extraRooms, decor.wallStyle, accentHex);
    }

    this.rebuildRaycastList();
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
    scan(this.floorsGroup);
    scan(this.roomsGroup);
  }

  private makePalette(wallStyle: WallStyleId) {
    const style = WALL_STYLES.find((w) => w.id === wallStyle) || WALL_STYLES[0];
    const deckMat = new THREE.MeshStandardMaterial({
      map: this.terrazzoTex,
      color: style.wallHex,
      roughness: 0.46,
      metalness: 0.04
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: style.trimHex,
      roughness: 0.36,
      metalness: 0.24
    });
    const metalMat = new THREE.MeshStandardMaterial({
      map: this.titaniumTex,
      color: "#cbd5e1",
      roughness: 0.2,
      metalness: 0.88
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      transmission: 0.8,
      roughness: 0.08,
      ior: 1.46,
      thickness: 0.08,
      transparent: true,
      opacity: 0.72
    });
    return { deckMat, trimMat, metalMat, glassMat };
  }

  // ============================================================================
  // 1. EXPANDABLE HOMELY ESTATE DECK, PORCH, VERANDA & GARDEN TRIM (Lv. 1-3)
  // ============================================================================
  private buildEstateDeck(size: HouseSizeLevel, wallStyle: WallStyleId, accentHex: string) {
    this.disposeObjectChildren(this.estateGroup);
    const { deckMat, trimMat, metalMat, glassMat } = this.makePalette(wallStyle);

    const half = getHouseBoundsRadius(size);
    const span = half * 2;

    // Spacious main residential promenade deck (y = 0.06 .. 0.12)
    const deckGeo = new THREE.BoxGeometry(span, 0.07, span);
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.y = 0.085;
    deck.receiveShadow = true;
    this.estateGroup.add(deck);

    const deckEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(deckGeo),
      new THREE.LineBasicMaterial({ color: "#94a3b8", transparent: true, opacity: 0.55 })
    );
    deckEdges.position.copy(deck.position);
    this.estateGroup.add(deckEdges);

    // Welcoming South Front Porch Mat & Stepping Stones
    const matMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.16, 0.02, 0.62),
      new THREE.MeshStandardMaterial({ color: "#e8dfd2", roughness: 0.88 })
    );
    matMesh.position.set(0, 0.13, half - 0.45);
    matMesh.receiveShadow = true;
    this.estateGroup.add(matMesh);

    // Cute Residential Front Porch Mailbox beside entry!
    const mb = new THREE.Group();
    mb.position.set(1.12, 0.12, half - 0.22);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.62, 10), metalMat);
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

    // Cozy Architectural Corner Hedges along South front edge
    const hedgeMat = new THREE.MeshStandardMaterial({
      color: "#a7d7be",
      roughness: 0.72
    });
    for (const side of [-1, 1]) {
      const hedge = new THREE.Mesh(
        new THREE.BoxGeometry(half - 1.55, 0.28, 0.26),
        hedgeMat
      );
      hedge.position.set(side * (half * 0.5 + 0.62), 0.24, half - 0.18);
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
      const pillar = new THREE.Mesh(postGeo, deckMat);
      pillar.position.set(px, 0.26, pz);
      pillar.castShadow = true;
      this.estateGroup.add(pillar);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.2), trimMat);
      cap.position.set(px, 0.54, pz);
      this.estateGroup.add(cap);
    }
    // North, West, East low residential lot fencing + twin front wing fences flanking open gate
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
      // Lv. 2 Courtyard Residence: Wraparound Frosted-Glass Veranda Balustrades & Back Architectural Privacy Screens!
      const railH = 0.46;
      const backScreen = new THREE.Mesh(new THREE.BoxGeometry(span - 0.8, 0.92, 0.08), glassMat);
      backScreen.position.set(0, 0.58, -half + 0.1);
      this.estateGroup.add(backScreen);

      const backTop = new THREE.Mesh(new THREE.BoxGeometry(span - 0.72, 0.045, 0.11), trimMat);
      backTop.position.set(0, 1.05, -half + 0.1);
      this.estateGroup.add(backTop);

      for (const side of [-1, 1]) {
        const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.05, railH, span - 1.6), glassMat);
        sideGlass.position.set(side * (half - 0.1), 0.12 + railH / 2, -0.15);
        this.estateGroup.add(sideGlass);

        const sideRail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, span - 1.5), metalMat);
        sideRail.position.set(side * (half - 0.1), 0.12 + railH, -0.15);
        this.estateGroup.add(sideRail);
      }

      // Warm Corner Architectural Columns with soft lantern tops
      for (const sx of [-half + 0.16, half - 0.16]) {
        for (const sz of [-half + 0.16, half - 0.16]) {
          const col = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.96, 0.16), trimMat);
          col.position.set(sx, 0.6, sz);
          col.castShadow = true;
          this.estateGroup.add(col);
          const capLight = new THREE.Mesh(
            new THREE.SphereGeometry(0.072, 12, 12),
            new THREE.MeshStandardMaterial({
              color: "#fffbeb",
              emissive: "#fde68a",
              emissiveIntensity: 0.95
            })
          );
          capLight.position.set(sx, 1.14, sz);
          this.estateGroup.add(capLight);
        }
      }
    }

    if (size >= 3) {
      // Lv. 3 Grand Villa Estate: Twin Frosted-Glass Entrance Portico Arches + Shimmering Perimeter Cove!
      const porticoY = 2.02;
      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.072, 1.9, 14), metalMat);
        pillar.position.set(side * 1.18, 1.06, half - 0.25);
        pillar.castShadow = true;
        this.estateGroup.add(pillar);
      }
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.07, 0.68), glassMat);
      canopy.position.set(0, porticoY, half - 0.25);
      this.estateGroup.add(canopy);
      const canopyTrim = new THREE.Mesh(new THREE.BoxGeometry(2.72, 0.04, 0.72), trimMat);
      canopyTrim.position.set(0, porticoY + 0.05, half - 0.25);
      this.estateGroup.add(canopyTrim);

      // Luminous recessed villa moat glow strip
      const villaGlow = new THREE.Mesh(
        new THREE.BoxGeometry(span + 0.14, 0.025, span + 0.14),
        new THREE.MeshBasicMaterial({
          color: accentHex,
          transparent: true,
          opacity: 0.34
        })
      );
      villaGlow.position.y = 0.055;
      this.estateGroup.add(villaGlow);
    }
  }

  // ============================================================================
  // 2. MULTI-STORY WALKABLE CUTAWAY FLOORS (2F Mezzanine Loft + 3F Sky Penthouse)
  // ============================================================================
  private buildUpperFloors(
    floors: HouseFloorCount,
    _size: HouseSizeLevel,
    wallStyle: WallStyleId,
    accentHex: string
  ) {
    this.disposeObjectChildren(this.floorsGroup);
    this.fairyBulbs = [];
    if (floors < 2) return;

    const { deckMat, trimMat, metalMat, glassMat } = this.makePalette(wallStyle);

    // Helper: builds a sculpted C-shaped cutaway upper floor (open in front so camera sees everything!)
    const addCutawayFloorDeck = (y: number, isPenthouse: boolean) => {
      const slabGroup = new THREE.Group();
      const slabH = 0.1;

      // Rear Wing Deck (z = -3.45 .. -1.95, full width x = -3.45 .. 3.45)
      const backSlab = new THREE.Mesh(new THREE.BoxGeometry(6.9, slabH, 1.55), deckMat);
      backSlab.position.set(0, y - slabH / 2, -2.7);
      backSlab.castShadow = true;
      backSlab.receiveShadow = true;
      slabGroup.add(backSlab);

      // West & East Cantilevered Balcony Wings (x = ±2.7, z = -1.95 .. +1.65)
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(1.5, slabH, 3.6), deckMat);
        wing.position.set(side * 2.7, y - slabH / 2, -0.15);
        wing.castShadow = true;
        wing.receiveShadow = true;
        slabGroup.add(wing);

        // Sleek Outer Frosted-Glass Balustrade
        const outerRail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.56, 5.1), glassMat);
        outerRail.position.set(side * 3.42, y + 0.28, -0.9);
        slabGroup.add(outerRail);
        const outerCap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 5.15), metalMat);
        outerCap.position.set(side * 3.42, y + 0.57, -0.9);
        slabGroup.add(outerCap);

        // Inner Atrium Overlook Railing
        const innerRail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.48, 3.5), glassMat);
        innerRail.position.set(side * 1.98, y + 0.24, -0.15);
        slabGroup.add(innerRail);

        // Slender Brushed-Titanium Structural Support Columns down to lower floor
        const colH = isPenthouse ? 1.98 : 2.55;
        for (const cz of [-3.3, 1.48]) {
          const col = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, colH, 12), metalMat);
          col.position.set(side * 3.32, y - slabH - colH / 2, cz);
          col.castShadow = true;
          slabGroup.add(col);
        }
      }

      // Rear Balustrade & Inner Rear Atrium Overlook Rail
      const backGlass = new THREE.Mesh(new THREE.BoxGeometry(6.85, 0.56, 0.04), glassMat);
      backGlass.position.set(0, y + 0.28, -3.44);
      slabGroup.add(backGlass);
      const backCap = new THREE.Mesh(new THREE.BoxGeometry(6.9, 0.03, 0.06), metalMat);
      backCap.position.set(0, y + 0.57, -3.44);
      slabGroup.add(backCap);

      const atriumRail = new THREE.Mesh(new THREE.BoxGeometry(3.96, 0.48, 0.035), glassMat);
      atriumRail.position.set(0, y + 0.24, -1.94);
      slabGroup.add(atriumRail);

      // Luminous accent fascia trim along the balcony edge
      const trimLine = new THREE.Mesh(
        new THREE.BoxGeometry(4.0, 0.025, 0.03),
        new THREE.MeshStandardMaterial({
          color: accentHex,
          emissive: accentHex,
          emissiveIntensity: 0.75
        })
      );
      trimLine.position.set(0, y - 0.04, -1.92);
      slabGroup.add(trimLine);

      this.floorsGroup.add(slabGroup);
    };

    // 2F: Sunlit Mezzanine Loft (y = 2.68)
    addCutawayFloorDeck(2.68, false);

    // Cozy Loft Decor Vignette on Rear 2F Gallery (plush chaise + lamp)
    const loftSeat = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.26, 0.52),
      new THREE.MeshStandardMaterial({ color: "#f8fafd", roughness: 0.78 })
    );
    loftSeat.position.set(0, 2.82, -3.02);
    loftSeat.castShadow = true;
    this.floorsGroup.add(loftSeat);

    // Clickable Brushed-Silver Architectural Spiral Staircase (1F -> 2F -> 3F!)
    const stairs = new THREE.Group();
    stairs.position.set(-2.72, 0.12, -2.62);
    const totalH = floors >= 3 ? 4.62 : 2.62;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, totalH, 14), metalMat);
    pole.position.y = totalH / 2;
    pole.castShadow = true;
    stairs.add(pole);

    const stepCount = floors >= 3 ? 22 : 12;
    for (let i = 0; i < stepCount; i++) {
      const u = (i + 1) / stepCount;
      const ang = i * 0.54;
      const tread = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.045, 0.2), trimMat);
      tread.position.set(Math.cos(ang) * 0.28, u * (totalH - 0.12), Math.sin(ang) * 0.28);
      tread.rotation.y = -ang;
      tread.castShadow = true;
      stairs.add(tread);
    }
    this.tagTarget(stairs, {
      kind: "stairs",
      label: floors >= 3 ? "Spiral Stairs (1F–3F)" : "Spiral Stairs (1F–2F)",
      worldX: -2.25,
      worldZ: -2.15
    });
    this.floorsGroup.add(stairs);

    // 3F: Starlight Sky Penthouse (y = 4.68)
    if (floors >= 3) {
      addCutawayFloorDeck(4.68, true);

      // Graceful Overarching Sky Conservatory Pergola + Glowing Festoon Lights!
      for (const side of [-1, 1]) {
        const arch = new THREE.Mesh(
          new THREE.TorusGeometry(2.6, 0.032, 10, 40, Math.PI),
          metalMat
        );
        arch.position.set(0, 4.68, side * 1.15 - 1.55);
        this.floorsGroup.add(arch);
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
        b.position.set(Math.cos(ang) * 2.55, 4.68 + Math.sin(ang) * 2.55, -2.7);
        this.floorsGroup.add(b);
        this.fairyBulbs.push(b);
      }

      // Sculptural Penthouse Stargazing Telescope on East Sky Deck!
      const tele = new THREE.Group();
      tele.position.set(2.75, 4.68, 0.45);
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
      this.floorsGroup.add(tele);
    }
  }

  // ============================================================================
  // 3. SIX UNLOCKABLE HOMELY INTERIOR ROOMS (Clickable in 3D!)
  // ============================================================================
  private buildExtraRooms(rooms: readonly ExtraRoomId[], wallStyle: WallStyleId, accentHex: string) {
    this.disposeObjectChildren(this.roomsGroup);
    this.hearthFlames = [];
    this.spaSteam = [];
    if (rooms.length === 0) return;

    const { deckMat, trimMat, metalMat, glassMat } = this.makePalette(wallStyle);
    const plushWhite = new THREE.MeshStandardMaterial({ color: "#f8fafd", roughness: 0.82 });

    for (const roomId of rooms) {
      const def = EXTRA_ROOM_DEFS.find((r) => r.id === roomId);
      if (!def) continue;

      const root = new THREE.Group();
      root.position.set(def.x, 0.12, def.z);
      root.rotation.y = def.yaw;

      // Subtle stone room-zone mat under every cozy room
      const zoneMat = new THREE.Mesh(
        new THREE.BoxGeometry(1.52, 0.03, 1.32),
        new THREE.MeshStandardMaterial({ color: "#f1f5f9", roughness: 0.72 })
      );
      zoneMat.position.y = 0.015;
      zoneMat.receiveShadow = true;
      root.add(zoneMat);

      if (roomId === "bedroom") {
        // Cozy Canopy Bed + Fluffy Duvet + Pillows + Glowing Nightstand Lamp!
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

        // Four-poster brushed-silver canopy posts & crown frame
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

        // Bedside table + warm glowing lamp
        const stand = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.3), deckMat);
        stand.position.set(0.6, 0.18, -0.34);
        root.add(stand);
        const lamp = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 12, 12),
          new THREE.MeshStandardMaterial({
            color: "#fffbeb",
            emissive: "#fde68a",
            emissiveIntensity: 0.95
          })
        );
        lamp.position.set(0.6, 0.45, -0.34);
        root.add(lamp);
      } else if (roomId === "kitchen") {
        // Warm Kitchenette Island + Kettle + Pendant Lights + Twin Cafe Stools!
        const island = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.58, 0.48), deckMat);
        island.position.set(0, 0.3, -0.15);
        island.castShadow = true;
        root.add(island);

        const counterTop = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.04, 0.54), trimMat);
        counterTop.position.set(0, 0.61, -0.15);
        root.add(counterTop);

        // Pastel Kettle & Ceramic Fruit Bowl
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

        // Two cute cafe barstools in front of the island
        for (const sx of [-0.32, 0.32]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.38, 10), metalMat);
          leg.position.set(sx, 0.2, 0.36);
          root.add(leg);
          const stoolTop = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.055, 16), plushWhite);
          stoolTop.position.set(sx, 0.41, 0.36);
          root.add(stoolTop);
        }
      } else if (roomId === "spa") {
        // Steaming Japanese Cedar & Alabaster Onsen Soaking Tub!
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

        // Floating sakura petals + animated warm steam puffs
        const steamGeo = new THREE.SphereGeometry(0.055, 10, 10);
        const steamMat = new THREE.MeshBasicMaterial({
          color: "#ffffff",
          transparent: true,
          opacity: 0.45
        });
        for (let i = 0; i < 4; i++) {
          const st = new THREE.Mesh(steamGeo, steamMat);
          st.position.set(Math.cos(i * 1.6) * 0.2, 0.55 + i * 0.1, Math.sin(i * 1.6) * 0.2);
          root.add(st);
          this.spaSteam.push(st);
        }
      } else if (roomId === "hearth") {
        // Modern Floating Frosted-Glass Fireplace Hearth with Animated Glowing Embers!
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.24, 0.46), deckMat);
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

        // Animated amber fireplace flames + warm glow halo
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

        // Cozy fireside pouf
        const pouf = new THREE.Mesh(
          new THREE.CylinderGeometry(0.24, 0.26, 0.22, 18),
          new THREE.MeshStandardMaterial({ color: "#fce7f3", roughness: 0.84 })
        );
        pouf.position.set(0, 0.13, 0.36);
        pouf.castShadow = true;
        root.add(pouf);
      } else if (roomId === "pergola") {
        // Sun-Dappled Wisteria Garden Arbor!
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
          cluster.position.set(-0.45 + i * 0.18, 1.18, (i % 2 === 0 ? -0.22 : 0.22));
          root.add(cluster);
        }
        const bench = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.22, 0.34), plushWhite);
        bench.position.set(0, 0.14, 0);
        root.add(bench);
      } else if (roomId === "music") {
        // Sculptural Glossy White-and-Silver Mini Grand Piano!
        const pianoMat = new THREE.MeshStandardMaterial({
          color: "#ffffff",
          roughness: 0.12,
          metalness: 0.18
        });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.2, 20), pianoMat);
        body.scale.set(1.15, 1, 0.92);
        body.position.set(0, 0.56, -0.06);
        body.castShadow = true;
        root.add(body);

        // Propped open acoustic lid!
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

        // Crisp ivory & ebony key strip
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

        // Piano bench
        const bench = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.26, 0.22), trimMat);
        bench.position.set(0, 0.15, 0.56);
        root.add(bench);

        // Accent note crystal floating above score stand
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
  }

  private disposeObjectChildren(parent: THREE.Object3D) {
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
    this.disposeObjectChildren(this.group);
    this.warmGlowTex?.dispose();
    this.warmGlowTex = null;
    this.interactiveRoots = [];
  }
}
