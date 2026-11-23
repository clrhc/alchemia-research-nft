import * as THREE from "three";
import { createRadialGlowTexture } from "./architectTextures";
import {
  defaultLabDecor,
  type BarStyleId,
  type HobbyPropId,
  type LabDecorConfig,
  type LightingFixtureId,
  type PatioDecorId,
  type PlantPackId,
  type RugStyleId,
  type SeatingStyleId,
  type SimsObjectTarget,
  type StationUpgradeLevel,
  type UpgradeableStationId
} from "./simsState";

/**
 * Interactive Sims-Style Architectural Lab Furniture, Full 8-Category Home Furnishing
 * Catalog (43 procedural 3D options) & Progressive 3-Tier Station Hardware Upgrades!
 *
 * Zero external 3D assets — 100% procedural Three.js matching ALCHEMIA's brushed-silver,
 * honed alabaster, and frosted-glass aesthetic. Every interactive piece is raycast-clickable
 * (opening a contextual Sims Radial Pie Menu) and exposes exact walk-to coordinates.
 */
export class SimsFurniture3D {
  public readonly group = new THREE.Group();

  private seatingGroup = new THREE.Group();
  private barGroup = new THREE.Group();
  private researchGroup = new THREE.Group();
  private harvesterGroup = new THREE.Group();
  private decorGroup = new THREE.Group();
  private rugGroup = new THREE.Group();
  private hobbyGroup = new THREE.Group();
  private plantsGroup = new THREE.Group();
  private ceilingGroup = new THREE.Group();
  private petUpgradeGroup = new THREE.Group();
  private builderUpgradeGroup = new THREE.Group();
  private loungeUpgradeGroup = new THREE.Group();

  private interactiveRoots: THREE.Object3D[] = [];
  private terrazzoTex: THREE.Texture;
  private titaniumTex: THREE.Texture;
  private accentHex: string;
  private decor: LabDecorConfig;

  // Cached shared glow textures (disposed once in dispose() to prevent GPU leaks!)
  private lanternGlowTex: THREE.CanvasTexture | null = null;
  private cyanGlowTex: THREE.CanvasTexture | null = null;
  private pinkGlowTex: THREE.CanvasTexture | null = null;

  // Live animated 3D references
  private harvesterRotor: THREE.Object3D | null = null;
  private harvesterGyros: THREE.Object3D[] = [];
  private harvesterMotes: THREE.Object3D[] = [];
  private espressoSteam: THREE.Mesh[] = [];
  private prismTotem: THREE.Object3D | null = null;
  private lanternOrbs: THREE.Mesh[] = [];
  private sakuraPetals: Array<{ mesh: THREE.Mesh; baseX: number; baseZ: number; phase: number }> = [];
  private orreryRings: THREE.Object3D[] = [];
  private jellyfish: Array<{ group: THREE.Group; baseY: number; phase: number }> = [];
  private vinylPlatter: THREE.Object3D | null = null;
  private ceilingFloaters: Array<{ obj: THREE.Object3D; angle: number; radius: number; baseY: number; phase: number }> = [];
  private ceilingSpinner: THREE.Object3D | null = null;
  private researchHelix: THREE.Object3D | null = null;
  private builderHoloTown: THREE.Object3D | null = null;
  private loungeHearthOrb: THREE.Object3D | null = null;
  private petStarToy: THREE.Object3D | null = null;

  public readonly benchSitPos = new THREE.Vector3(-1.46, 0.39, 0.54);
  public readonly benchSitYaw = 1.2;
  public readonly espressoStandPos = new THREE.Vector3(-0.92, 0.39, -1.12);
  public readonly espressoStandYaw = -2.45;
  public readonly microscopeStandPos = new THREE.Vector3(-1.32, 0.39, -0.58);
  public readonly microscopeStandYaw = -1.65;
  public readonly harvesterStandPos = new THREE.Vector3(1.36, 0.39, -0.22);
  public readonly harvesterStandYaw = 1.45;
  public readonly hobbyStandPos = new THREE.Vector3(-1.34, 0.23, 1.68);
  public readonly hobbyStandYaw = -2.45;

  constructor(
    terrazzoTex: THREE.Texture,
    titaniumTex: THREE.Texture,
    accentHex: string,
    initialDecor: LabDecorConfig = defaultLabDecor()
  ) {
    this.terrazzoTex = terrazzoTex;
    this.titaniumTex = titaniumTex;
    this.accentHex = accentHex;
    this.decor = {
      ...initialDecor,
      stationUpgrades: { ...initialDecor.stationUpgrades }
    };

    this.group.add(
      this.rugGroup,
      this.seatingGroup,
      this.barGroup,
      this.researchGroup,
      this.harvesterGroup,
      this.decorGroup,
      this.hobbyGroup,
      this.plantsGroup,
      this.ceilingGroup,
      this.petUpgradeGroup,
      this.builderUpgradeGroup,
      this.loungeUpgradeGroup
    );

    this.rebuildAll();
  }

  private getGlowTexture(kind: "warm" | "cyan" | "pink"): THREE.CanvasTexture {
    if (kind === "warm") {
      if (!this.lanternGlowTex) this.lanternGlowTex = createRadialGlowTexture("#fbbf24");
      return this.lanternGlowTex;
    }
    if (kind === "cyan") {
      if (!this.cyanGlowTex) this.cyanGlowTex = createRadialGlowTexture("#38bdf8");
      return this.cyanGlowTex;
    }
    if (!this.pinkGlowTex) this.pinkGlowTex = createRadialGlowTexture("#f472b6");
    return this.pinkGlowTex;
  }

  private makeBaseMaterials() {
    const stoneMat = new THREE.MeshStandardMaterial({
      map: this.terrazzoTex,
      color: "#f7f9fc",
      roughness: 0.42,
      metalness: 0.05
    });
    const metalMat = new THREE.MeshStandardMaterial({
      map: this.titaniumTex,
      color: "#d4dce8",
      roughness: 0.2,
      metalness: 0.9
    });
    const cushionMat = new THREE.MeshStandardMaterial({
      color: "#eef2f8",
      roughness: 0.68
    });
    const accentGlowMat = new THREE.MeshStandardMaterial({
      color: this.accentHex,
      emissive: this.accentHex,
      emissiveIntensity: 0.85,
      roughness: 0.16
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      transmission: 0.84,
      roughness: 0.06,
      ior: 1.47,
      thickness: 0.1,
      transparent: true
    });
    return { stoneMat, metalMat, cushionMat, accentGlowMat, glassMat };
  }

  private tagTarget(root: THREE.Object3D, target: SimsObjectTarget) {
    root.traverse((obj) => {
      obj.userData.simsTarget = target;
    });
  }

  private refreshInteractiveRoots() {
    this.interactiveRoots = [
      this.seatingGroup,
      this.barGroup,
      this.researchGroup,
      this.harvesterGroup
    ];
    if (this.hobbyGroup.children.length > 0) {
      this.interactiveRoots.push(this.hobbyGroup);
    }
  }

  public getRaycastTargets(): THREE.Object3D[] {
    return this.interactiveRoots;
  }

  public getStationUpgradeWorldPos(stationId: UpgradeableStationId): THREE.Vector3 {
    switch (stationId) {
      case "research":
        return new THREE.Vector3(-1.58, 1.15, -0.62);
      case "mining":
        return new THREE.Vector3(1.62, 1.2, -0.22);
      case "pet":
        return new THREE.Vector3(1.34, 0.85, 1.04);
      case "builder":
        return new THREE.Vector3(-0.78, 0.9, 2.02);
      case "lounge":
        return new THREE.Vector3(-1.32, 0.95, 0.78);
    }
  }

  /**
   * Diffs & updates only the changed 3D furniture / station upgrade groups in real time!
   */
  public updateFurnishings(next: LabDecorConfig, accentHex?: string) {
    const accentChanged = Boolean(accentHex && accentHex !== this.accentHex);
    if (accentHex) this.accentHex = accentHex;

    const prev = this.decor;
    this.decor = {
      ...next,
      stationUpgrades: { ...next.stationUpgrades }
    };

    if (accentChanged || prev.seatingStyle !== next.seatingStyle) {
      this.buildSeating(next.seatingStyle);
    }
    if (accentChanged || prev.barStyle !== next.barStyle) {
      this.buildBar(next.barStyle);
    }
    if (accentChanged || prev.patioDecor !== next.patioDecor) {
      this.buildPatioDecor(next.patioDecor);
    }
    if (accentChanged || prev.rugStyle !== next.rugStyle) {
      this.buildRug(next.rugStyle);
    }
    if (accentChanged || prev.hobbyProp !== next.hobbyProp) {
      this.buildHobbyProp(next.hobbyProp);
    }
    if (accentChanged || prev.plantPack !== next.plantPack) {
      this.buildPlantPack(next.plantPack);
    }
    if (accentChanged || prev.lightingFixture !== next.lightingFixture) {
      this.buildLightingFixture(next.lightingFixture);
    }
    if (accentChanged || prev.stationUpgrades.research !== next.stationUpgrades.research) {
      this.buildResearchStation(next.stationUpgrades.research);
    }
    if (accentChanged || prev.stationUpgrades.mining !== next.stationUpgrades.mining) {
      this.buildHarvesterStation(next.stationUpgrades.mining);
    }
    if (accentChanged || prev.stationUpgrades.pet !== next.stationUpgrades.pet) {
      this.buildPetUpgrade(next.stationUpgrades.pet);
    }
    if (accentChanged || prev.stationUpgrades.builder !== next.stationUpgrades.builder) {
      this.buildBuilderUpgrade(next.stationUpgrades.builder);
    }
    if (accentChanged || prev.stationUpgrades.lounge !== next.stationUpgrades.lounge) {
      this.buildLoungeUpgrade(next.stationUpgrades.lounge);
    }

    this.refreshInteractiveRoots();
  }

  private rebuildAll() {
    this.buildSeating(this.decor.seatingStyle);
    this.buildBar(this.decor.barStyle);
    this.buildPatioDecor(this.decor.patioDecor);
    this.buildRug(this.decor.rugStyle);
    this.buildHobbyProp(this.decor.hobbyProp);
    this.buildPlantPack(this.decor.plantPack);
    this.buildLightingFixture(this.decor.lightingFixture);
    this.buildResearchStation(this.decor.stationUpgrades.research);
    this.buildHarvesterStation(this.decor.stationUpgrades.mining);
    this.buildPetUpgrade(this.decor.stationUpgrades.pet);
    this.buildBuilderUpgrade(this.decor.stationUpgrades.builder);
    this.buildLoungeUpgrade(this.decor.stationUpgrades.lounge);
    this.refreshInteractiveRoots();
  }

  // ============================================================================
  // 1. LOUNGE SEATING (5 Sculptural Styles)
  // ============================================================================
  private buildSeating(style: SeatingStyleId) {
    this.disposeObjectChildren(this.seatingGroup);
    const { stoneMat, metalMat, cushionMat, glassMat } = this.makeBaseMaterials();

    const root = new THREE.Group();
    root.position.set(-1.54, 0.39, 0.56);
    root.rotation.y = 1.2;

    let label = "Terrazzo Lounge Bench";

    if (style === "plush-sofa") {
      label = "Cloud Bouclé Sofa";
      const fabricMat = new THREE.MeshStandardMaterial({ color: "#f4f6fb", roughness: 0.82 });
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.14, 0.42), fabricMat);
      base.position.y = 0.13;
      base.castShadow = true;
      base.receiveShadow = true;
      root.add(base);

      for (const lx of [-0.34, 0.34]) {
        for (const lz of [-0.14, 0.14]) {
          const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.06, 10), metalMat);
          foot.position.set(lx, 0.03, lz);
          root.add(foot);
        }
      }

      const seatCushion = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.09, 0.34), cushionMat);
      seatCushion.position.set(0, 0.24, 0.02);
      seatCushion.castShadow = true;
      root.add(seatCushion);

      const back = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.28, 0.12), fabricMat);
      back.position.set(0, 0.34, -0.15);
      back.castShadow = true;
      root.add(back);

      for (const sx of [-0.39, 0.39]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.42, 12), fabricMat);
        arm.rotation.x = Math.PI / 2;
        arm.position.set(sx, 0.28, 0);
        arm.castShadow = true;
        root.add(arm);
      }

      // Two cute pastel accent pillows
      const pillow1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.14, 0.07),
        new THREE.MeshStandardMaterial({ color: "#ddd6fe", roughness: 0.78 })
      );
      pillow1.position.set(-0.24, 0.34, -0.04);
      pillow1.rotation.set(-0.18, 0.22, 0.12);
      root.add(pillow1);

      const pillow2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.13, 0.07),
        new THREE.MeshStandardMaterial({ color: "#bae6fd", roughness: 0.78 })
      );
      pillow2.position.set(0.24, 0.33, -0.04);
      pillow2.rotation.set(-0.15, -0.25, -0.1);
      root.add(pillow2);
    } else if (style === "egg-chair") {
      label = "Glass Egg Lounge Pod";
      const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.04, 24), metalMat);
      baseDisc.position.y = 0.02;
      baseDisc.receiveShadow = true;
      root.add(baseDisc);

      // Curved C-arch titanium stand
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.02, 10, 28, Math.PI * 1.1), metalMat);
      arch.rotation.y = Math.PI / 2;
      arch.rotation.z = -Math.PI * 0.55;
      arch.position.set(0, 0.48, -0.14);
      root.add(arch);

      // Clear hemispherical bubble pod
      const pod = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 22, 18, 0, Math.PI * 2, 0, Math.PI * 0.68),
        glassMat
      );
      pod.rotation.x = Math.PI * 0.48;
      pod.position.set(0, 0.42, 0.04);
      root.add(pod);

      const trim = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.016, 10, 28), metalMat);
      trim.position.set(0, 0.42, 0.18);
      root.add(trim);

      const innerCushion = new THREE.Mesh(
        new THREE.SphereGeometry(0.21, 16, 12),
        new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.72 })
      );
      innerCushion.scale.set(1.05, 0.48, 0.92);
      innerCushion.position.set(0, 0.28, 0.05);
      root.add(innerCushion);
    } else if (style === "daybed") {
      label = "Studio Velvet Daybed";
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.08, 0.44), stoneMat);
      frame.position.y = 0.16;
      frame.castShadow = true;
      root.add(frame);

      for (const lx of [-0.34, 0.34]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.34), metalMat);
        leg.position.set(lx, 0.07, 0);
        root.add(leg);
      }

      const mattress = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.1, 0.4),
        new THREE.MeshStandardMaterial({ color: "#ede9fe", roughness: 0.75 })
      );
      mattress.position.y = 0.25;
      mattress.castShadow = true;
      root.add(mattress);

      const bolster = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 0.36, 14),
        new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.7 })
      );
      bolster.rotation.x = Math.PI / 2;
      bolster.position.set(-0.31, 0.34, 0);
      root.add(bolster);

      // Sleek corner reading floor lamp
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.86, 10), metalMat);
      pole.position.set(-0.46, 0.43, -0.2);
      root.add(pole);

      const shade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.11, 0.14, 16),
        new THREE.MeshStandardMaterial({
          color: "#fffbeb",
          emissive: "#fde68a",
          emissiveIntensity: 0.72,
          roughness: 0.3
        })
      );
      shade.position.set(-0.44, 0.84, -0.16);
      root.add(shade);
    } else if (style === "tatami") {
      label = "Zen Tatami Tea Lounge";
      const matMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.88, 0.045, 0.56),
        new THREE.MeshStandardMaterial({ color: "#e5ebd8", roughness: 0.84 })
      );
      matMesh.position.y = 0.025;
      matMesh.receiveShadow = true;
      root.add(matMesh);

      const border = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.032, 0.58), metalMat);
      border.position.y = 0.018;
      root.add(border);

      // Two round zabuton floor cushions
      for (const [cx, col] of [[-0.24, "#f1f5f9"], [0.24, "#d1fae5"]] as const) {
        const z = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.16, 0.06, 18),
          new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 })
        );
        z.position.set(cx, 0.075, 0.06);
        z.castShadow = true;
        root.add(z);
      }

      // Low stoneware tea tray + tiny teapot
      const tray = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.18), stoneMat);
      tray.position.set(0, 0.068, -0.12);
      root.add(tray);

      const pot = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 12, 10),
        new THREE.MeshStandardMaterial({ color: "#64748b", roughness: 0.25, metalness: 0.45 })
      );
      pot.scale.set(1, 0.8, 1);
      pot.position.set(-0.04, 0.12, -0.12);
      root.add(pot);
    } else {
      // Classic Terrazzo Lounge Bench
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.07, 0.34), stoneMat);
      seat.position.y = 0.24;
      seat.castShadow = true;
      seat.receiveShadow = true;
      root.add(seat);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.05, 0.28), cushionMat);
      pad.position.y = 0.29;
      root.add(pad);
      for (const sx of [-0.28, 0.28]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.28), metalMat);
        leg.position.set(sx, 0.12, 0);
        leg.castShadow = true;
        root.add(leg);
      }
    }

    this.tagTarget(root, {
      kind: "bench",
      label,
      worldX: this.benchSitPos.x,
      worldZ: this.benchSitPos.z
    });
    this.seatingGroup.add(root);
  }

  // ============================================================================
  // 2. REFRESHMENT BAR (5 Interactive Counter Styles)
  // ============================================================================
  private buildBar(style: BarStyleId) {
    this.disposeObjectChildren(this.barGroup);
    this.espressoSteam = [];
    const { stoneMat, metalMat, glassMat } = this.makeBaseMaterials();

    const bar = new THREE.Group();
    bar.position.set(-1.12, 0.39, -1.36);
    bar.rotation.y = 0.72;

    const counter = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.54, 0.34), stoneMat);
    counter.position.y = 0.27;
    counter.castShadow = true;
    counter.receiveShadow = true;
    bar.add(counter);

    const topStrip = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.03, 0.36), metalMat);
    topStrip.position.y = 0.55;
    bar.add(topStrip);

    let label = "Elixir Espresso Bar";
    let steamColor = "#ffffff";

    if (style === "matcha") {
      label = "Matcha Tea Bar";
      steamColor = "#d1fae5";
      const bowl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.068, 0.09, 18),
        new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.38 })
      );
      bowl.position.set(-0.08, 0.61, 0.02);
      bowl.castShadow = true;
      bar.add(bowl);

      const matcha = new THREE.Mesh(
        new THREE.CircleGeometry(0.08, 16),
        new THREE.MeshStandardMaterial({
          color: "#34d399",
          emissive: "#10b981",
          emissiveIntensity: 0.65
        })
      );
      matcha.rotation.x = -Math.PI / 2;
      matcha.position.set(-0.08, 0.656, 0.02);
      bar.add(matcha);

      const whisk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.015, 0.13, 10),
        new THREE.MeshStandardMaterial({ color: "#d6c5a3", roughness: 0.6 })
      );
      whisk.position.set(0.14, 0.63, -0.02);
      bar.add(whisk);

      const caddy = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 14), metalMat);
      caddy.position.set(0.22, 0.625, 0.05);
      bar.add(caddy);
    } else if (style === "smoothie") {
      label = "Berry Elixir Juicer";
      steamColor = "#fbcfe8";
      const blenderColors = ["#f472b6", "#38bdf8"] as const;
      blenderColors.forEach((col, i) => {
        const bx = i === 0 ? -0.14 : 0.14;
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.08, 14), metalMat);
        base.position.set(bx, 0.6, 0);
        bar.add(base);
        const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.052, 0.18, 14), glassMat);
        jar.position.set(bx, 0.73, 0);
        bar.add(jar);
        const juice = new THREE.Mesh(
          new THREE.CylinderGeometry(0.054, 0.044, 0.12, 12),
          new THREE.MeshStandardMaterial({
            color: col,
            emissive: col,
            emissiveIntensity: 0.45
          })
        );
        juice.position.set(bx, 0.71, 0);
        bar.add(juice);
      });
    } else if (style === "boba") {
      label = "Pearlescent Boba Bar";
      steamColor = "#e9d5ff";
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.24, 16), glassMat);
      tower.position.set(-0.12, 0.69, -0.02);
      bar.add(tower);
      const milkTea = new THREE.Mesh(
        new THREE.CylinderGeometry(0.076, 0.084, 0.17, 14),
        new THREE.MeshStandardMaterial({
          color: "#e9d5ff",
          emissive: "#c084fc",
          emissiveIntensity: 0.35
        })
      );
      milkTea.position.set(-0.12, 0.67, -0.02);
      bar.add(milkTea);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.096, 0.096, 0.025, 16), metalMat);
      lid.position.set(-0.12, 0.82, -0.02);
      bar.add(lid);

      // Two cute boba cups with pastel straws
      for (const [cx, strawCol] of [[0.1, "#f472b6"], [0.22, "#38bdf8"]] as const) {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.11, 12), glassMat);
        cup.position.set(cx, 0.62, 0.04);
        bar.add(cup);
        const straw = new THREE.Mesh(
          new THREE.CylinderGeometry(0.008, 0.008, 0.17, 8),
          new THREE.MeshStandardMaterial({ color: strawCol, roughness: 0.25 })
        );
        straw.position.set(cx + 0.008, 0.66, 0.04);
        straw.rotation.z = -0.18;
        bar.add(straw);
      }
    } else if (style === "samovar") {
      label = "Silver Tea Samovar";
      steamColor = "#e2e8f0";
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.095, 0.08, 16), metalMat);
      foot.position.set(-0.08, 0.6, -0.01);
      bar.add(foot);
      const urn = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 14), metalMat);
      urn.scale.set(1, 1.25, 1);
      urn.position.set(-0.08, 0.74, -0.01);
      urn.castShadow = true;
      bar.add(urn);
      const crown = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 8, 18), metalMat);
      crown.rotation.x = Math.PI / 2;
      crown.position.set(-0.08, 0.89, -0.01);
      bar.add(crown);
      // Porcelain teacups
      for (const cx of [0.12, 0.22]) {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.028, 0.06, 12), stoneMat);
        cup.position.set(cx, 0.595, 0.04);
        bar.add(cup);
      }
    } else {
      // Classic Espresso Bar
      const machine = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.2), metalMat);
      machine.position.set(-0.1, 0.69, -0.02);
      machine.castShadow = true;
      bar.add(machine);
      const carafe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.14, 14), glassMat);
      carafe.position.set(0.14, 0.63, 0.02);
      bar.add(carafe);
      const brewLiquid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.044, 0.052, 0.08, 12),
        new THREE.MeshStandardMaterial({
          color: "#fbbf24",
          emissive: "#f59e0b",
          emissiveIntensity: 0.7
        })
      );
      brewLiquid.position.set(0.14, 0.61, 0.02);
      bar.add(brewLiquid);
    }

    const steamGeo = new THREE.SphereGeometry(0.024, 8, 8);
    const steamMat = new THREE.MeshBasicMaterial({
      color: steamColor,
      transparent: true,
      opacity: 0.52
    });
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(steamGeo, steamMat);
      s.position.set(0.14, 0.74 + i * 0.06, 0.02);
      bar.add(s);
      this.espressoSteam.push(s);
    }

    this.tagTarget(bar, {
      kind: "espresso",
      label,
      worldX: this.espressoStandPos.x,
      worldZ: this.espressoStandPos.z
    });
    this.barGroup.add(bar);
  }

  // ============================================================================
  // 3. INTERACTIVE HOBBY NOOK PROP (5 Clickable Props + None)
  // ============================================================================
  private buildHobbyProp(hobby: HobbyPropId) {
    this.disposeObjectChildren(this.hobbyGroup);
    this.jellyfish = [];
    this.vinylPlatter = null;
    if (hobby === "none") return;

    const { stoneMat, metalMat, glassMat } = this.makeBaseMaterials();
    const root = new THREE.Group();
    root.position.set(-1.58, 0.23, 1.96);
    root.rotation.y = 0.58;

    let label = "Science Library";

    if (hobby === "bookshelf") {
      label = "Science Library";
      for (const sx of [-0.26, 0.26]) {
        const upright = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.92, 0.24), metalMat);
        upright.position.set(sx, 0.46, 0);
        upright.castShadow = true;
        root.add(upright);
      }
      const bookPalette = ["#94a3b8", "#38bdf8", "#f472b6", "#a78bfa", "#34d399", "#fbbf24"];
      for (let s = 0; s < 4; s++) {
        const sy = 0.06 + s * 0.27;
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.028, 0.24), stoneMat);
        shelf.position.y = sy;
        shelf.castShadow = true;
        root.add(shelf);
        if (s < 3) {
          for (let b = 0; b < 5; b++) {
            const h = 0.14 + ((s * 3 + b) % 3) * 0.028;
            const book = new THREE.Mesh(
              new THREE.BoxGeometry(0.055, h, 0.15),
              new THREE.MeshStandardMaterial({
                color: bookPalette[(s * 2 + b) % bookPalette.length],
                roughness: 0.45
              })
            );
            book.position.set(-0.18 + b * 0.082, sy + 0.014 + h / 2, 0);
            book.rotation.z = b === 4 ? -0.18 : 0;
            root.add(book);
          }
        }
      }
      // Cute glowing specimen orb on top shelf
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.065, 14, 14),
        new THREE.MeshStandardMaterial({
          color: "#bae6fd",
          emissive: "#38bdf8",
          emissiveIntensity: 0.8
        })
      );
      orb.position.set(0, 0.96, 0);
      root.add(orb);
    } else if (hobby === "aquarium") {
      label = "Jellyfish Aquarium";
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.28, 20), stoneMat);
      plinth.position.y = 0.14;
      plinth.castShadow = true;
      root.add(plinth);

      const water = new THREE.Mesh(
        new THREE.CylinderGeometry(0.21, 0.21, 0.64, 20),
        new THREE.MeshPhysicalMaterial({
          color: "#38bdf8",
          emissive: "#0284c7",
          emissiveIntensity: 0.35,
          transparent: true,
          opacity: 0.42,
          roughness: 0.08
        })
      );
      water.position.y = 0.61;
      root.add(water);

      const tankGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.68, 20), glassMat);
      tankGlass.position.y = 0.62;
      root.add(tankGlass);

      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.045, 20), metalMat);
      cap.position.y = 0.97;
      root.add(cap);

      const jellyColors = ["#f472b6", "#bae6fd", "#c4b5fd"];
      jellyColors.forEach((col, i) => {
        const jg = new THREE.Group();
        const ang = (i / 3) * Math.PI * 2;
        const baseY = 0.46 + i * 0.14;
        jg.position.set(Math.cos(ang) * 0.09, baseY, Math.sin(ang) * 0.09);
        const bell = new THREE.Mesh(
          new THREE.SphereGeometry(0.042, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6),
          new THREE.MeshStandardMaterial({
            color: col,
            emissive: col,
            emissiveIntensity: 0.95
          })
        );
        jg.add(bell);
        for (const tx of [-0.015, 0, 0.015]) {
          const tent = new THREE.Mesh(
            new THREE.CylinderGeometry(0.004, 0.002, 0.075, 6),
            new THREE.MeshBasicMaterial({ color: col })
          );
          tent.position.set(tx, -0.04, 0);
          jg.add(tent);
        }
        root.add(jg);
        this.jellyfish.push({ group: jg, baseY, phase: i * 2.1 });
      });
    } else if (hobby === "vinyl") {
      label = "Hi-Fi Vinyl Deck";
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.48, 0.3), stoneMat);
      cabinet.position.y = 0.24;
      cabinet.castShadow = true;
      root.add(cabinet);

      // Twin speaker cones
      for (const sx of [-0.16, 0.16]) {
        const spk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 18), metalMat);
        spk.rotation.x = Math.PI / 2;
        spk.position.set(sx, 0.25, 0.155);
        root.add(spk);
      }

      const deckBase = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.26), metalMat);
      deckBase.position.y = 0.51;
      root.add(deckBase);

      const platterGroup = new THREE.Group();
      platterGroup.position.set(-0.04, 0.545, 0);
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.012, 24),
        new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.22, metalness: 0.5 })
      );
      platterGroup.add(disc);
      const labelDisc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.042, 0.015, 16),
        new THREE.MeshStandardMaterial({
          color: "#818cf8",
          emissive: "#6366f1",
          emissiveIntensity: 0.65
        })
      );
      platterGroup.add(labelDisc);
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(0.015, 0.016, 0.05),
        new THREE.MeshBasicMaterial({ color: "#ffffff" })
      );
      marker.position.set(0.05, 0.002, 0);
      platterGroup.add(marker);
      root.add(platterGroup);
      this.vinylPlatter = platterGroup;

      // Tonearm
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.16, 8), metalMat);
      arm.rotation.z = Math.PI / 2;
      arm.rotation.y = 0.45;
      arm.position.set(0.12, 0.57, -0.02);
      root.add(arm);
    } else if (hobby === "easel") {
      label = "Studio Painting Easel";
      const legOffsets: Array<[number, number, number, number]> = [
        [-0.18, 0.46, 0.06, -0.14],
        [0.18, 0.46, 0.06, 0.14],
        [0, 0.46, -0.18, 0]
      ];
      legOffsets.forEach(([lx, ly, lz, rz], idx) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.96, 8), metalMat);
        leg.position.set(lx, ly, lz);
        leg.rotation.z = rz;
        leg.rotation.x = idx === 2 ? -0.24 : 0.14;
        leg.castShadow = true;
        root.add(leg);
      });

      const ledge = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.03, 0.08), metalMat);
      ledge.position.set(0, 0.48, 0.08);
      root.add(ledge);

      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.028), stoneMat);
      frame.position.set(0, 0.74, 0.02);
      frame.rotation.x = -0.16;
      frame.castShadow = true;
      root.add(frame);

      // Luminous abstract helix brushstrokes on the canvas!
      const swatches: Array<[number, number, string, number]> = [
        [-0.08, 0.78, "#38bdf8", 0.08],
        [0.06, 0.72, "#f472b6", 0.09],
        [-0.02, 0.64, "#34d399", 0.065],
        [0.08, 0.84, "#a855f7", 0.055]
      ];
      for (const [px, py, col, r] of swatches) {
        const dab = new THREE.Mesh(
          new THREE.CircleGeometry(r, 14),
          new THREE.MeshStandardMaterial({
            color: col,
            emissive: col,
            emissiveIntensity: 0.45
          })
        );
        dab.position.set(px, py, 0.04);
        dab.rotation.x = -0.16;
        root.add(dab);
      }
    } else if (hobby === "arcade") {
      label = "Silver Mini Arcade";
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.92, 0.36), stoneMat);
      body.position.y = 0.46;
      body.castShadow = true;
      root.add(body);

      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 0.38), metalMat);
      trim.position.y = 0.93;
      root.add(trim);

      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.32, 0.24),
        new THREE.MeshStandardMaterial({
          color: "#38bdf8",
          emissive: "#0ea5e9",
          emissiveIntensity: 0.95
        })
      );
      screen.position.set(0, 0.68, 0.186);
      screen.rotation.x = -0.14;
      root.add(screen);

      const marquee = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.08, 0.04),
        new THREE.MeshStandardMaterial({
          color: "#f472b6",
          emissive: "#ec4899",
          emissiveIntensity: 0.85
        })
      );
      marquee.position.set(0, 0.88, 0.17);
      root.add(marquee);

      // Control shelf + tiny joystick & pastel buttons
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.14), metalMat);
      shelf.position.set(0, 0.5, 0.21);
      root.add(shelf);

      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 8), metalMat);
      stick.position.set(-0.1, 0.55, 0.22);
      root.add(stick);
      const knob = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 10, 10),
        new THREE.MeshStandardMaterial({ color: "#f472b6", emissive: "#f472b6", emissiveIntensity: 0.4 })
      );
      knob.position.set(-0.1, 0.585, 0.22);
      root.add(knob);

      for (const [bx, col] of [[0.06, "#10b981"], [0.13, "#fbbf24"]] as const) {
        const btn = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.018, 0.015, 10),
          new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.45 })
        );
        btn.position.set(bx, 0.525, 0.22);
        root.add(btn);
      }
    }

    this.tagTarget(root, {
      kind: "hobby",
      label,
      hobbyId: hobby,
      worldX: this.hobbyStandPos.x,
      worldZ: this.hobbyStandPos.z
    });
    this.hobbyGroup.add(root);
  }

  // ============================================================================
  // 4. LOUNGE RUGS (4 Architectural Woven Styles + Bare Stone)
  // ============================================================================
  private buildRug(style: RugStyleId) {
    this.disposeObjectChildren(this.rugGroup);
    if (style === "none") return;

    const rug = new THREE.Group();
    rug.position.set(-1.12, 0.398, 0.44);

    const makeFlatMat = (color: string, metalness = 0.04, roughness = 0.88) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
      });

    if (style === "cloud-rug") {
      const puffMat = makeFlatMat("#f8fafc", 0.02, 0.92);
      const lobes: Array<[number, number, number]> = [
        [0, 0, 0.46],
        [-0.3, 0.14, 0.28],
        [0.3, 0.12, 0.29],
        [-0.26, -0.18, 0.26],
        [0.24, -0.16, 0.27]
      ];
      for (const [lx, lz, r] of lobes) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.02, 0.016, 24), puffMat);
        m.position.set(lx, 0.008, lz);
        m.receiveShadow = true;
        rug.add(m);
      }
    } else if (style === "silver-ring") {
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.64, 0.65, 0.014, 32),
        makeFlatMat("#eef2f8", 0.08, 0.78)
      );
      base.position.y = 0.007;
      base.receiveShadow = true;
      rug.add(base);
      for (const r of [0.58, 0.38]) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(r, 0.014, 6, 36),
          makeFlatMat("#94a3b8", 0.65, 0.32)
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.015;
        rug.add(ring);
      }
    } else if (style === "pastel-terrazzo") {
      const oval = new THREE.Mesh(
        new THREE.CylinderGeometry(0.58, 0.59, 0.014, 30),
        makeFlatMat("#fdf2f8", 0.04, 0.85)
      );
      oval.scale.set(1.18, 1, 0.82);
      oval.position.y = 0.007;
      oval.receiveShadow = true;
      rug.add(oval);
      const dots: Array<[number, number, string]> = [
        [-0.32, 0.1, "#f9a8d4"],
        [0.26, -0.14, "#93c5fd"],
        [0.12, 0.22, "#c4b5fd"],
        [-0.14, -0.2, "#cbd5e1"],
        [0.36, 0.08, "#a7f3d0"]
      ];
      for (const [dx, dz, col] of dots) {
        const speck = new THREE.Mesh(
          new THREE.CylinderGeometry(0.042, 0.042, 0.016, 12),
          makeFlatMat(col, 0.05, 0.8)
        );
        speck.position.set(dx, 0.009, dz);
        rug.add(speck);
      }
    } else if (style === "star-weave") {
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.62, 0.63, 0.014, 32),
        makeFlatMat("#eff6ff", 0.05, 0.82)
      );
      base.position.y = 0.007;
      base.receiveShadow = true;
      rug.add(base);
      const starMat = makeFlatMat("#94a3b8", 0.5, 0.4);
      for (let i = 0; i < 4; i++) {
        const ray = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.016, 0.84), starMat);
        ray.rotation.y = (i * Math.PI) / 4;
        ray.position.y = 0.009;
        rug.add(ray);
      }
    }

    this.rugGroup.add(rug);
  }

  // ============================================================================
  // 5. PATIO CENTERPIECE SCULPTURES (6 Architectural Centerpieces)
  // ============================================================================
  private buildPatioDecor(decor: PatioDecorId) {
    this.disposeObjectChildren(this.decorGroup);
    this.prismTotem = null;
    this.lanternOrbs = [];
    this.sakuraPetals = [];
    this.orreryRings = [];

    const { stoneMat, metalMat } = this.makeBaseMaterials();

    if (decor === "fountain") {
      const f = new THREE.Group();
      f.position.set(1.74, 0.23, 1.66);
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.28, 0.18, 24), stoneMat);
      basin.position.y = 0.09;
      basin.castShadow = true;
      f.add(basin);
      const water = new THREE.Mesh(
        new THREE.CircleGeometry(0.32, 24),
        new THREE.MeshPhysicalMaterial({
          color: "#7dd3fc",
          emissive: "#38bdf8",
          emissiveIntensity: 0.32,
          roughness: 0.06,
          clearcoat: 1.0
        })
      );
      water.rotation.x = -Math.PI / 2;
      water.position.y = 0.185;
      f.add(water);
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.46, 16), stoneMat);
      spire.position.y = 0.32;
      f.add(spire);
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 16, 16),
        new THREE.MeshStandardMaterial({
          color: "#bae6fd",
          emissive: "#38bdf8",
          emissiveIntensity: 0.8
        })
      );
      orb.position.y = 0.62;
      f.add(orb);
      this.prismTotem = orb;
      this.decorGroup.add(f);
    } else if (decor === "prism") {
      const p = new THREE.Group();
      p.position.set(1.74, 0.23, 1.66);
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.46), stoneMat);
      plinth.position.y = 0.11;
      plinth.castShadow = true;
      p.add(plinth);
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.2, 0),
        new THREE.MeshPhysicalMaterial({
          color: this.accentHex,
          emissive: this.accentHex,
          emissiveIntensity: 0.62,
          roughness: 0.08,
          transmission: 0.45,
          clearcoat: 1.0,
          transparent: true,
          opacity: 0.9
        })
      );
      crystal.scale.set(0.75, 1.45, 0.75);
      crystal.position.y = 0.58;
      p.add(crystal);
      this.prismTotem = crystal;
      this.decorGroup.add(p);
    } else if (decor === "lanterns") {
      const coords: Array<[number, number]> = [
        [1.76, 1.64],
        [-0.92, 2.08],
        [0.92, 2.08]
      ];
      for (const [lx, lz] of coords) {
        const lGroup = new THREE.Group();
        lGroup.position.set(lx, 0.23, lz);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, 0.44, 12), metalMat);
        post.position.y = 0.22;
        post.castShadow = true;
        lGroup.add(post);
        const globe = new THREE.Mesh(
          new THREE.SphereGeometry(0.085, 14, 14),
          new THREE.MeshStandardMaterial({
            color: "#fffbeb",
            emissive: "#f59e0b",
            emissiveIntensity: 1.1
          })
        );
        globe.position.y = 0.5;
        const halo = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.getGlowTexture("warm"),
            transparent: true,
            opacity: 0.65,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        halo.scale.set(0.45, 0.45, 1);
        globe.add(halo);
        lGroup.add(globe);
        this.lanternOrbs.push(globe);
        this.decorGroup.add(lGroup);
      }
    } else if (decor === "cherry-tree") {
      const tree = new THREE.Group();
      tree.position.set(1.74, 0.23, 1.66);
      const planter = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.22, 20), stoneMat);
      planter.position.y = 0.11;
      planter.castShadow = true;
      tree.add(planter);

      const barkMat = new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.65 });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.058, 0.56, 10), barkMat);
      trunk.position.set(0, 0.46, 0);
      trunk.rotation.z = 0.12;
      trunk.castShadow = true;
      tree.add(trunk);

      const blossomMat = new THREE.MeshStandardMaterial({
        color: "#fbcfe8",
        emissive: "#f472b6",
        emissiveIntensity: 0.22,
        roughness: 0.46
      });
      const canopyClouds: Array<[number, number, number, number]> = [
        [0, 0.84, 0, 0.22],
        [-0.18, 0.76, 0.08, 0.17],
        [0.19, 0.78, -0.06, 0.16],
        [0.05, 0.94, 0.08, 0.14]
      ];
      for (const [cx, cy, cz, r] of canopyClouds) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), blossomMat);
        puff.scale.set(1.2, 0.78, 1.12);
        puff.position.set(cx, cy, cz);
        puff.castShadow = true;
        tree.add(puff);
      }

      // 6 gently falling sakura petals
      const petalGeo = new THREE.CircleGeometry(0.022, 6);
      const petalMat = new THREE.MeshBasicMaterial({
        color: "#f9a8d4",
        side: THREE.DoubleSide
      });
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const bx = Math.cos(ang) * 0.22;
        const bz = Math.sin(ang) * 0.22;
        const p = new THREE.Mesh(petalGeo, petalMat);
        p.position.set(bx, 0.72, bz);
        tree.add(p);
        this.sakuraPetals.push({ mesh: p, baseX: bx, baseZ: bz, phase: i * 1.05 });
      }
      this.decorGroup.add(tree);
    } else if (decor === "mini-orrery") {
      const orrery = new THREE.Group();
      orrery.position.set(1.74, 0.23, 1.66);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.22, 20), stoneMat);
      base.position.y = 0.11;
      base.castShadow = true;
      orrery.add(base);

      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.42, 12), metalMat);
      stem.position.y = 0.38;
      orrery.add(stem);

      const sun = new THREE.Mesh(
        new THREE.SphereGeometry(0.095, 16, 16),
        new THREE.MeshStandardMaterial({
          color: "#fef3c7",
          emissive: "#f59e0b",
          emissiveIntensity: 0.95
        })
      );
      sun.position.y = 0.64;
      orrery.add(sun);

      const ringConfigs: Array<{ r: number; tilt: number; col: string }> = [
        { r: 0.2, tilt: 0.35, col: "#38bdf8" },
        { r: 0.29, tilt: -0.45, col: "#f472b6" },
        { r: 0.37, tilt: 0.22, col: "#a78bfa" }
      ];
      for (const cfg of ringConfigs) {
        const orbitGrp = new THREE.Group();
        orbitGrp.position.y = 0.64;
        orbitGrp.rotation.x = cfg.tilt;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(cfg.r, 0.008, 8, 32), metalMat);
        ring.rotation.x = Math.PI / 2;
        orbitGrp.add(ring);
        const planet = new THREE.Mesh(
          new THREE.SphereGeometry(0.038, 12, 12),
          new THREE.MeshStandardMaterial({
            color: cfg.col,
            emissive: cfg.col,
            emissiveIntensity: 0.65
          })
        );
        planet.position.set(cfg.r, 0, 0);
        orbitGrp.add(planet);
        orrery.add(orbitGrp);
        this.orreryRings.push(orbitGrp);
      }
      this.decorGroup.add(orrery);
    } else {
      // Default Ceramic Bonsai
      const planter = new THREE.Group();
      planter.position.set(1.74, 0.23, 1.66);
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.2, 18), stoneMat);
      pot.position.y = 0.1;
      pot.castShadow = true;
      planter.add(pot);
      const leafMat = new THREE.MeshStandardMaterial({
        color: "#d1fae5",
        emissive: "#10b981",
        emissiveIntensity: 0.22,
        roughness: 0.34
      });
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.026, 0.32, 8),
        new THREE.MeshStandardMaterial({ color: "#64748b", roughness: 0.5 })
      );
      stem.position.y = 0.3;
      planter.add(stem);
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 1), leafMat);
      puff.scale.set(1.25, 0.68, 1.15);
      puff.position.y = 0.48;
      puff.castShadow = true;
      planter.add(puff);
      this.decorGroup.add(planter);
    }
  }

  // ============================================================================
  // 6. INDOOR BOTANICAL PLANT PACKS (4 Botanical Suites + Minimal)
  // ============================================================================
  private buildPlantPack(pack: PlantPackId) {
    this.disposeObjectChildren(this.plantsGroup);
    if (pack === "minimal") return;

    const { stoneMat, metalMat, glassMat } = this.makeBaseMaterials();
    const spots: Array<[number, number]> = [
      [1.18, -1.26],
      [-0.34, -1.58],
      [1.54, 0.68]
    ];

    for (const [px, pz] of spots) {
      const g = new THREE.Group();
      g.position.set(px, 0.39, pz);

      if (pack === "monstera") {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.095, 0.18, 16), stoneMat);
        pot.position.y = 0.09;
        pot.castShadow = true;
        g.add(pot);
        const leafMat = new THREE.MeshStandardMaterial({
          color: "#34d399",
          emissive: "#059669",
          emissiveIntensity: 0.14,
          roughness: 0.38
        });
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * Math.PI * 2;
          const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), leafMat);
          leaf.scale.set(0.95, 0.18, 1.35);
          leaf.position.set(Math.cos(ang) * 0.1, 0.28 + (i % 2) * 0.08, Math.sin(ang) * 0.1);
          leaf.rotation.set(0.35, -ang, 0);
          g.add(leaf);
        }
      } else if (pack === "bamboo") {
        const planter = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.16), stoneMat);
        planter.position.y = 0.075;
        planter.castShadow = true;
        g.add(planter);
        const stalkMat = new THREE.MeshStandardMaterial({ color: "#86efac", roughness: 0.42 });
        for (const [sx, h] of [[-0.06, 0.56], [0, 0.72], [0.06, 0.62]] as const) {
          const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, h, 8), stalkMat);
          stalk.position.set(sx, 0.14 + h / 2, 0);
          g.add(stalk);
          const tuft = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), stalkMat);
          tuft.scale.set(1.2, 0.6, 1.2);
          tuft.position.set(sx, 0.14 + h, 0);
          g.add(tuft);
        }
      } else if (pack === "succulents") {
        const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.04, 16), metalMat);
        tray.position.y = 0.02;
        g.add(tray);
        const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), glassMat);
        dome.position.y = 0.19;
        g.add(dome);
        const succ = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.085, 1),
          new THREE.MeshStandardMaterial({
            color: "#6ee7b7",
            emissive: "#10b981",
            emissiveIntensity: 0.35
          })
        );
        succ.position.y = 0.12;
        g.add(succ);
      } else if (pack === "blossom-vases") {
        const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.095, 0.34, 16), stoneMat);
        vase.position.y = 0.17;
        vase.castShadow = true;
        g.add(vase);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.01, 8, 18), metalMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.34;
        g.add(rim);
        const bloomMat = new THREE.MeshStandardMaterial({
          color: "#fbcfe8",
          emissive: "#f472b6",
          emissiveIntensity: 0.35
        });
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2;
          const b = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), bloomMat);
          b.position.set(Math.cos(ang) * 0.07, 0.44 + (i % 2) * 0.08, Math.sin(ang) * 0.07);
          g.add(b);
        }
      }

      this.plantsGroup.add(g);
    }
  }

  // ============================================================================
  // 7. AMBIENT CEILING LIGHT FIXTURES (4 Floating Fixtures + Open Skylight)
  // ============================================================================
  private buildLightingFixture(fixture: LightingFixtureId) {
    this.disposeObjectChildren(this.ceilingGroup);
    this.ceilingFloaters = [];
    this.ceilingSpinner = null;
    if (fixture === "none") return;

    const { metalMat, glassMat } = this.makeBaseMaterials();

    if (fixture === "halo-ring") {
      const grp = new THREE.Group();
      grp.position.y = 2.62;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.66, 0.028, 12, 56), metalMat);
      ring.rotation.x = Math.PI / 2;
      grp.add(ring);
      const led = new THREE.Mesh(
        new THREE.TorusGeometry(1.66, 0.014, 8, 56),
        new THREE.MeshStandardMaterial({
          color: "#ffffff",
          emissive: "#e0f2fe",
          emissiveIntensity: 1.15
        })
      );
      led.rotation.x = Math.PI / 2;
      led.position.y = -0.022;
      grp.add(led);
      this.ceilingSpinner = grp;
      this.ceilingGroup.add(grp);
    } else if (fixture === "crystal-drops") {
      const grp = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + 0.3;
        const r = 1.56;
        const dropY = 2.28 + (i % 3) * 0.16;
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.55, 6), metalMat);
        wire.position.set(Math.cos(ang) * r, dropY + 0.28, Math.sin(ang) * r);
        grp.add(wire);
        const drop = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), glassMat);
        drop.scale.set(0.7, 1.65, 0.7);
        drop.position.set(Math.cos(ang) * r, dropY, Math.sin(ang) * r);
        const glow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.getGlowTexture("cyan"),
            transparent: true,
            opacity: 0.45,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        glow.scale.set(0.32, 0.32, 1);
        drop.add(glow);
        grp.add(drop);
        this.ceilingFloaters.push({ obj: drop, angle: ang, radius: r, baseY: dropY, phase: i * 1.1 });
      }
      this.ceilingGroup.add(grp);
    } else if (fixture === "fairy-orbs") {
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const r = 1.58 + (i % 2) * 0.22;
        const baseY = 2.18 + (i % 3) * 0.22;
        const orb = new THREE.Mesh(
          new THREE.SphereGeometry(0.048, 12, 12),
          new THREE.MeshStandardMaterial({
            color: "#fffbeb",
            emissive: "#fde68a",
            emissiveIntensity: 1.2
          })
        );
        orb.position.set(Math.cos(ang) * r, baseY, Math.sin(ang) * r);
        const halo = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.getGlowTexture("warm"),
            transparent: true,
            opacity: 0.58,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        halo.scale.set(0.38, 0.38, 1);
        orb.add(halo);
        this.ceilingGroup.add(orb);
        this.ceilingFloaters.push({ obj: orb, angle: ang, radius: r, baseY, phase: i * 0.85 });
      }
    } else if (fixture === "aurora-arc") {
      const grp = new THREE.Group();
      const arc1 = new THREE.Mesh(
        new THREE.TorusGeometry(1.86, 0.022, 10, 48, Math.PI),
        new THREE.MeshStandardMaterial({
          color: "#bae6fd",
          emissive: "#38bdf8",
          emissiveIntensity: 0.85,
          transparent: true,
          opacity: 0.78
        })
      );
      arc1.position.y = 1.18;
      arc1.rotation.y = 0.55;
      grp.add(arc1);
      const arc2 = new THREE.Mesh(
        new THREE.TorusGeometry(1.94, 0.018, 10, 48, Math.PI),
        new THREE.MeshStandardMaterial({
          color: "#e9d5ff",
          emissive: "#a855f7",
          emissiveIntensity: 0.78,
          transparent: true,
          opacity: 0.68
        })
      );
      arc2.position.y = 1.16;
      arc2.rotation.y = -0.55;
      grp.add(arc2);
      this.ceilingSpinner = grp;
      this.ceilingGroup.add(grp);
    }
  }

  // ============================================================================
  // 8. PROGRESSIVE 3D STATION UPGRADES (Lv. 1 -> Lv. 2 -> Lv. 3 across 5 Stations!)
  // ============================================================================
  private buildResearchStation(level: StationUpgradeLevel) {
    this.disposeObjectChildren(this.researchGroup);
    this.researchHelix = null;
    const { stoneMat, metalMat, accentGlowMat, glassMat } = this.makeBaseMaterials();

    const micro = new THREE.Group();
    micro.position.set(-1.58, 0.39, -0.62);
    micro.rotation.y = 1.5;

    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.56, 16), stoneMat);
    ped.position.y = 0.28;
    ped.castShadow = true;
    micro.add(ped);

    const desk = new THREE.Mesh(new THREE.BoxGeometry(level >= 2 ? 0.68 : 0.56, 0.04, 0.38), metalMat);
    desk.position.y = 0.57;
    desk.castShadow = true;
    micro.add(desk);

    const scopeArm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.26, 10), metalMat);
    scopeArm.position.set(level >= 2 ? -0.09 : 0, 0.72, -0.06);
    scopeArm.rotation.x = 0.35;
    micro.add(scopeArm);

    const scopeLens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.036, 0.08, 12), accentGlowMat);
    scopeLens.position.set(level >= 2 ? -0.09 : 0, 0.76, 0.02);
    scopeLens.rotation.x = 0.35;
    micro.add(scopeLens);

    const holoPlate = new THREE.Mesh(
      new THREE.BoxGeometry(level >= 2 ? 0.46 : 0.32, level >= 2 ? 0.22 : 0.18, 0.014),
      glassMat
    );
    holoPlate.position.set(0, 0.76, -0.14);
    holoPlate.rotation.x = -0.25;
    micro.add(holoPlate);

    if (level >= 2) {
      // Lv. 2 Cryo-EM Dual Array: second cryo-cyan microscope barrel + glowing desk edge trim
      const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.26, 10), metalMat);
      arm2.position.set(0.09, 0.72, -0.06);
      arm2.rotation.x = 0.35;
      micro.add(arm2);

      const cryoLens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.036, 0.08, 12),
        new THREE.MeshStandardMaterial({
          color: "#38bdf8",
          emissive: "#0ea5e9",
          emissiveIntensity: 1.05
        })
      );
      cryoLens.position.set(0.09, 0.76, 0.02);
      cryoLens.rotation.x = 0.35;
      micro.add(cryoLens);

      const rim = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.014, 0.016),
        new THREE.MeshStandardMaterial({ color: "#38bdf8", emissive: "#38bdf8", emissiveIntensity: 0.95 })
      );
      rim.position.set(0, 0.59, 0.185);
      micro.add(rim);
    }

    if (level >= 3) {
      // Lv. 3 Quantum Helix Lab: twin emitter arms + spinning levitating 3D DNA double helix!
      for (const sx of [-0.28, 0.28]) {
        const emitter = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.022, 0.42, 10), metalMat);
        emitter.position.set(sx, 0.78, 0);
        emitter.rotation.z = sx < 0 ? -0.22 : 0.22;
        micro.add(emitter);
      }

      const helix = new THREE.Group();
      helix.position.set(0, 1.08, 0);
      const strandMatA = new THREE.MeshStandardMaterial({
        color: "#38bdf8",
        emissive: "#0ea5e9",
        emissiveIntensity: 1.0
      });
      const strandMatB = new THREE.MeshStandardMaterial({
        color: "#f472b6",
        emissive: "#ec4899",
        emissiveIntensity: 1.0
      });
      const beadGeo = new THREE.SphereGeometry(0.024, 10, 10);
      for (let i = 0; i < 8; i++) {
        const a = i * 0.78;
        const y = (i - 3.5) * 0.052;
        const b1 = new THREE.Mesh(beadGeo, strandMatA);
        b1.position.set(Math.cos(a) * 0.085, y, Math.sin(a) * 0.085);
        helix.add(b1);
        const b2 = new THREE.Mesh(beadGeo, strandMatB);
        b2.position.set(Math.cos(a + Math.PI) * 0.085, y, Math.sin(a + Math.PI) * 0.085);
        helix.add(b2);
      }
      micro.add(helix);
      this.researchHelix = helix;
    }

    const label =
      level === 3
        ? "Quantum Helix Microscope (Lv.3)"
        : level === 2
          ? "Cryo-EM Dual Microscope (Lv.2)"
          : "Protein Microscope";
    this.tagTarget(micro, {
      kind: "microscope",
      label,
      worldX: this.microscopeStandPos.x,
      worldZ: this.microscopeStandPos.z
    });
    this.researchGroup.add(micro);
  }

  private buildHarvesterStation(level: StationUpgradeLevel) {
    this.disposeObjectChildren(this.harvesterGroup);
    this.harvesterRotor = null;
    this.harvesterGyros = [];
    this.harvesterMotes = [];
    const { stoneMat, metalMat } = this.makeBaseMaterials();

    const harv = new THREE.Group();
    harv.position.set(1.62, 0.39, -0.22);
    harv.rotation.y = -1.5;

    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.62, 8), stoneMat);
    col.position.y = 0.31;
    col.castShadow = true;
    harv.add(col);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.016, 8, 24), metalMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.63;
    harv.add(collar);

    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(level >= 3 ? 0.13 : 0.11, 0),
      new THREE.MeshStandardMaterial({
        color: level >= 3 ? "#a5b4fc" : "#818cf8",
        emissive: "#6366f1",
        emissiveIntensity: level >= 3 ? 1.35 : 1.05,
        roughness: 0.12,
        metalness: 0.45
      })
    );
    crystal.position.y = 0.86;
    harv.add(crystal);
    this.harvesterRotor = crystal;

    if (level >= 2) {
      // Lv. 2 Dual Titanium Gyro Rings
      const g1 = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.012, 8, 28), metalMat);
      g1.position.y = 0.86;
      harv.add(g1);
      const g2 = new THREE.Mesh(
        new THREE.TorusGeometry(0.26, 0.01, 8, 28),
        new THREE.MeshStandardMaterial({
          color: "#a5b4fc",
          emissive: "#6366f1",
          emissiveIntensity: 0.85
        })
      );
      g2.position.y = 0.86;
      g2.rotation.x = Math.PI / 3;
      harv.add(g2);
      this.harvesterGyros.push(g1, g2);
    }

    if (level >= 3) {
      // Lv. 3 Quantum Prism Crown + Light Column + 4 Orbiting ALCH Coin Motes
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.13, 0.72, 16),
        new THREE.MeshBasicMaterial({
          color: "#818cf8",
          transparent: true,
          opacity: 0.22,
          depthWrite: false
        })
      );
      beam.position.y = 0.96;
      harv.add(beam);

      const moteMat = new THREE.MeshStandardMaterial({
        color: "#fde68a",
        emissive: "#f59e0b",
        emissiveIntensity: 0.95,
        metalness: 0.7,
        roughness: 0.18
      });
      for (let i = 0; i < 4; i++) {
        const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.012, 14), moteMat);
        coin.rotation.x = Math.PI / 2;
        harv.add(coin);
        this.harvesterMotes.push(coin);
      }
    }

    const label =
      level === 3
        ? "Quantum Prism Harvester (Lv.3)"
        : level === 2
          ? "Dual Gyro Harvester (Lv.2)"
          : "ALCH Harvester Console";
    this.tagTarget(harv, {
      kind: "harvester",
      label,
      worldX: this.harvesterStandPos.x,
      worldZ: this.harvesterStandPos.z
    });
    this.harvesterGroup.add(harv);
  }

  private buildPetUpgrade(level: StationUpgradeLevel) {
    this.disposeObjectChildren(this.petUpgradeGroup);
    this.petStarToy = null;
    if (level < 2) return;

    const { stoneMat, metalMat, glassMat } = this.makeBaseMaterials();
    const g = new THREE.Group();
    g.position.set(1.34, 0.39, 1.04);
    g.rotation.y = -0.65;

    // Lv. 2 Plush Cloud Pet Bed + Twin Ceramic Bowls
    const bedRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.21, 0.055, 12, 24),
      new THREE.MeshStandardMaterial({ color: "#fdf2f8", roughness: 0.85 })
    );
    bedRim.rotation.x = Math.PI / 2;
    bedRim.position.set(-0.08, 0.055, 0);
    g.add(bedRim);
    const bedCenter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.2, 0.04, 18),
      new THREE.MeshStandardMaterial({ color: "#fce7f3", roughness: 0.88 })
    );
    bedCenter.position.set(-0.08, 0.025, 0);
    g.add(bedCenter);

    for (const [bx, fillCol] of [[0.2, "#10b981"], [0.33, "#38bdf8"]] as const) {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.045, 14), stoneMat);
      bowl.position.set(bx, 0.024, 0.08);
      g.add(bowl);
      const fill = new THREE.Mesh(
        new THREE.CircleGeometry(0.045, 12),
        new THREE.MeshStandardMaterial({ color: fillCol, roughness: 0.3 })
      );
      fill.rotation.x = -Math.PI / 2;
      fill.position.set(bx, 0.048, 0.08);
      g.add(fill);
    }

    if (level >= 3) {
      // Lv. 3 Sculptural Silver-and-Glass Cat Tower Perch + Dangling Glowing Star Toy!
      const tower = new THREE.Group();
      tower.position.set(0.18, 0, -0.2);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.04, 18), stoneMat);
      base.position.y = 0.02;
      tower.add(base);

      const post1 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.036, 0.036, 0.54, 12),
        new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.72 })
      );
      post1.position.set(0, 0.29, 0);
      post1.castShadow = true;
      tower.add(post1);

      const perch = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.025, 20), glassMat);
      perch.position.y = 0.57;
      tower.add(perch);
      const perchRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 8, 24), metalMat);
      perchRing.rotation.x = Math.PI / 2;
      perchRing.position.y = 0.57;
      tower.add(perchRing);

      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.045, 0),
        new THREE.MeshStandardMaterial({
          color: "#fbcfe8",
          emissive: "#f472b6",
          emissiveIntensity: 0.95
        })
      );
      star.position.set(0.12, 0.44, 0.06);
      tower.add(star);
      this.petStarToy = star;
      g.add(tower);
    }

    this.petUpgradeGroup.add(g);
  }

  private buildBuilderUpgrade(level: StationUpgradeLevel) {
    this.disposeObjectChildren(this.builderUpgradeGroup);
    this.builderHoloTown = null;
    if (level < 2) return;

    const { stoneMat, metalMat, glassMat } = this.makeBaseMaterials();
    const g = new THREE.Group();
    g.position.set(-0.78, 0.23, 2.02);
    g.rotation.y = 0.12;

    // Lv. 2 Frosted-Glass Architect Drafting Table + Glowing Blueprint Tablet
    for (const lx of [-0.26, 0.26]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.54, 0.28), metalMat);
      leg.position.set(lx, 0.27, 0);
      leg.castShadow = true;
      g.add(leg);
    }
    const tabletop = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.032, 0.36), glassMat);
    tabletop.position.y = 0.55;
    g.add(tabletop);
    const bp = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.26),
      new THREE.MeshStandardMaterial({
        color: "#bae6fd",
        emissive: "#38bdf8",
        emissiveIntensity: 0.72,
        transparent: true,
        opacity: 0.85
      })
    );
    bp.rotation.x = -Math.PI / 2;
    bp.position.y = 0.57;
    g.add(bp);

    if (level >= 3) {
      // Lv. 3 Floating Spinning 3D Miniature Holographic Alchemia Town!
      const holo = new THREE.Group();
      holo.position.set(0, 0.74, 0);
      const holoMat = new THREE.MeshStandardMaterial({
        color: "#6ee7b7",
        emissive: "#10b981",
        emissiveIntensity: 0.95,
        transparent: true,
        opacity: 0.78
      });
      const centerDome = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), holoMat);
      centerDome.scale.set(1, 0.7, 1);
      holo.add(centerDome);
      const townRing = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.008, 8, 24), holoMat);
      townRing.rotation.x = Math.PI / 2;
      holo.add(townRing);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const miniHouse = new THREE.Mesh(
          new THREE.BoxGeometry(0.038, 0.036 + (i % 2) * 0.02, 0.038),
          stoneMat
        );
        miniHouse.position.set(Math.cos(ang) * 0.15, 0.02, Math.sin(ang) * 0.15);
        holo.add(miniHouse);
      }
      g.add(holo);
      this.builderHoloTown = holo;
    }

    this.builderUpgradeGroup.add(g);
  }

  private buildLoungeUpgrade(level: StationUpgradeLevel) {
    this.disposeObjectChildren(this.loungeUpgradeGroup);
    this.loungeHearthOrb = null;
    if (level < 2) return;

    const { stoneMat, metalMat, glassMat } = this.makeBaseMaterials();
    const g = new THREE.Group();
    g.position.set(-1.18, 0.39, 0.98);

    // Lv. 2 Sculptural Alabaster Side Table + Glowing Aroma Diffuser
    const tableStem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.34, 14), stoneMat);
    tableStem.position.y = 0.17;
    tableStem.castShadow = true;
    g.add(tableStem);
    const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.025, 20), stoneMat);
    tableTop.position.y = 0.35;
    g.add(tableTop);

    const diffuser = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.055, 0.11, 14),
      new THREE.MeshStandardMaterial({
        color: "#f5d0fe",
        emissive: "#a855f7",
        emissiveIntensity: 0.72
      })
    );
    diffuser.position.y = 0.415;
    g.add(diffuser);

    if (level >= 3) {
      // Lv. 3 Floating Crystal Aurora Hearth & Acoustic Brushed-Silver Halo
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.01, 8, 24), metalMat);
      halo.position.y = 0.68;
      g.add(halo);

      const hearth = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), glassMat);
      hearth.position.y = 0.68;
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.getGlowTexture("pink"),
          transparent: true,
          opacity: 0.62,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      glow.scale.set(0.42, 0.42, 1);
      hearth.add(glow);
      g.add(hearth);
      this.loungeHearthOrb = hearth;
    }

    this.loungeUpgradeGroup.add(g);
  }

  // ============================================================================
  // 9. REAL-TIME ANIMATION LOOP (60fps Zero-Allocation)
  // ============================================================================
  public update(dt: number, t: number) {
    if (this.harvesterRotor) {
      this.harvesterRotor.rotation.y += dt * 1.9;
      this.harvesterRotor.position.y = 0.86 + Math.sin(t * 2.6) * 0.035;
    }
    if (this.harvesterGyros.length > 0) {
      this.harvesterGyros[0].rotation.y += dt * 1.45;
      this.harvesterGyros[0].rotation.x = Math.sin(t * 1.1) * 0.4;
      if (this.harvesterGyros[1]) {
        this.harvesterGyros[1].rotation.z -= dt * 1.8;
        this.harvesterGyros[1].rotation.y -= dt * 0.9;
      }
    }
    for (let i = 0; i < this.harvesterMotes.length; i++) {
      const ang = t * 1.6 + (i / this.harvesterMotes.length) * Math.PI * 2;
      this.harvesterMotes[i].position.set(
        Math.cos(ang) * 0.3,
        0.92 + Math.sin(t * 2.5 + i) * 0.08,
        Math.sin(ang) * 0.3
      );
      this.harvesterMotes[i].rotation.z += dt * 2.4;
    }

    for (let i = 0; i < this.espressoSteam.length; i++) {
      const s = this.espressoSteam[i];
      const u = (t * 0.55 + i * 0.33) % 1;
      s.position.y = 0.72 + u * 0.28;
      s.position.x = 0.14 + Math.sin(t * 3 + i * 2) * 0.025;
      s.scale.setScalar(0.6 + u * 0.9);
    }

    if (this.prismTotem) {
      this.prismTotem.rotation.y += dt * 1.15;
      this.prismTotem.position.y = 0.58 + Math.sin(t * 2.2) * 0.04;
    }
    for (let i = 0; i < this.lanternOrbs.length; i++) {
      this.lanternOrbs[i].position.y = 0.5 + Math.sin(t * 2.4 + i) * 0.01;
    }
    for (const p of this.sakuraPetals) {
      const fall = (t * 0.35 + p.phase) % 1;
      p.mesh.position.set(
        p.baseX + Math.sin(t * 2.1 + p.phase) * 0.08,
        0.84 - fall * 0.62,
        p.baseZ + Math.cos(t * 1.7 + p.phase) * 0.06
      );
      p.mesh.rotation.x += dt * 1.8;
      p.mesh.rotation.y += dt * 2.2;
    }
    for (let i = 0; i < this.orreryRings.length; i++) {
      this.orreryRings[i].rotation.y += dt * (0.9 + i * 0.45) * (i % 2 === 0 ? 1 : -1);
    }
    for (const j of this.jellyfish) {
      j.group.position.y = j.baseY + Math.sin(t * 2.0 + j.phase) * 0.065;
      j.group.rotation.y += dt * 0.7;
    }
    if (this.vinylPlatter) {
      this.vinylPlatter.rotation.y += dt * 2.6;
    }
    if (this.ceilingSpinner) {
      this.ceilingSpinner.rotation.y += dt * 0.18;
    }
    for (const f of this.ceilingFloaters) {
      const a = f.angle + t * 0.16;
      f.obj.position.set(
        Math.cos(a) * f.radius,
        f.baseY + Math.sin(t * 1.9 + f.phase) * 0.055,
        Math.sin(a) * f.radius
      );
      f.obj.rotation.y += dt * 0.9;
    }
    if (this.researchHelix) {
      this.researchHelix.rotation.y += dt * 1.65;
      this.researchHelix.position.y = 1.08 + Math.sin(t * 2.4) * 0.03;
    }
    if (this.builderHoloTown) {
      this.builderHoloTown.rotation.y += dt * 0.85;
      this.builderHoloTown.position.y = 0.74 + Math.sin(t * 2.1) * 0.025;
    }
    if (this.loungeHearthOrb) {
      this.loungeHearthOrb.rotation.y += dt * 1.4;
      this.loungeHearthOrb.position.y = 0.68 + Math.sin(t * 2.6) * 0.03;
    }
    if (this.petStarToy) {
      this.petStarToy.rotation.y += dt * 2.0;
      this.petStarToy.position.x = 0.12 + Math.sin(t * 3.1) * 0.035;
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
    this.lanternGlowTex?.dispose();
    this.cyanGlowTex?.dispose();
    this.pinkGlowTex?.dispose();
    this.lanternGlowTex = null;
    this.cyanGlowTex = null;
    this.pinkGlowTex = null;
    this.interactiveRoots = [];
  }
}
