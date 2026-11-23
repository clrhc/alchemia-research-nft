import * as THREE from "three";
import { createRadialGlowTexture } from "./architectTextures";
import type { PatioDecorId, SimsObjectTarget } from "./simsState";

/**
 * Interactive Sims-Style Architectural Lab Furniture & Swappable Patio Decor Props.
 *
 * Every prop is sculptural, matches ALCHEMIA's alabaster-and-titanium aesthetic,
 * is raycast-clickable (opening a Sims Radial Pie Menu), and defines an exact
 * walk-to interaction coordinate + facing yaw for your 3D character!
 */
export class SimsFurniture3D {
  public readonly group = new THREE.Group();
  private decorGroup = new THREE.Group();
  private interactiveRoots: THREE.Object3D[] = [];
  private lanternGlowTex: THREE.CanvasTexture | null = null;

  private harvesterRotor: THREE.Object3D | null = null;
  private espressoSteam: THREE.Mesh[] = [];
  private prismTotem: THREE.Object3D | null = null;
  private lanternOrbs: THREE.Mesh[] = [];

  public readonly benchSitPos = new THREE.Vector3(-1.5, 0.39, 0.54);
  public readonly benchSitYaw = 1.2;
  public readonly espressoStandPos = new THREE.Vector3(-0.92, 0.39, -1.12);
  public readonly espressoStandYaw = -2.45;
  public readonly microscopeStandPos = new THREE.Vector3(-1.32, 0.39, -0.58);
  public readonly microscopeStandYaw = -1.65;
  public readonly harvesterStandPos = new THREE.Vector3(1.36, 0.39, -0.22);
  public readonly harvesterStandYaw = 1.45;

  constructor(
    terrazzoTex: THREE.Texture,
    titaniumTex: THREE.Texture,
    accentHex: string,
    initialDecor: PatioDecorId = "bonsai"
  ) {
    this.group.add(this.decorGroup);

    const stoneMat = new THREE.MeshStandardMaterial({
      map: terrazzoTex,
      color: "#f7f9fc",
      roughness: 0.42,
      metalness: 0.05
    });
    const metalMat = new THREE.MeshStandardMaterial({
      map: titaniumTex,
      color: "#d4dce8",
      roughness: 0.2,
      metalness: 0.9
    });
    const cushionMat = new THREE.MeshStandardMaterial({
      color: "#eef2f8",
      roughness: 0.68
    });
    const accentGlowMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 0.85,
      roughness: 0.16
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      transmission: 0.86,
      roughness: 0.06,
      ior: 1.47,
      thickness: 0.1,
      transparent: true
    });

    // 1. Sculptural Architectural Terrazzo Lounge Bench (Sit & Recharge!)
    const bench = new THREE.Group();
    bench.position.set(-1.54, 0.39, 0.56);
    bench.rotation.y = 1.2;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.07, 0.34), stoneMat);
    seat.position.y = 0.24;
    seat.castShadow = true;
    seat.receiveShadow = true;
    bench.add(seat);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.05, 0.28), cushionMat);
    pad.position.y = 0.29;
    bench.add(pad);
    for (const sx of [-0.28, 0.28]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.28), metalMat);
      leg.position.set(sx, 0.12, 0);
      leg.castShadow = true;
      bench.add(leg);
    }
    this.tagTarget(bench, {
      kind: "bench",
      label: "Terrazzo Lounge Bench",
      worldX: this.benchSitPos.x,
      worldZ: this.benchSitPos.z
    });
    this.group.add(bench);

    // 2. Alchemical Espresso & Elixir Synthesizer Bar (Brew Elixir!)
    const bar = new THREE.Group();
    bar.position.set(-1.12, 0.39, -1.36);
    bar.rotation.y = 0.72;
    const counter = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.54, 0.34), stoneMat);
    counter.position.y = 0.27;
    counter.castShadow = true;
    counter.receiveShadow = true;
    bar.add(counter);
    const topStrip = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.03, 0.36), metalMat);
    topStrip.position.y = 0.55;
    bar.add(topStrip);
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
    const steamGeo = new THREE.SphereGeometry(0.024, 8, 8);
    const steamMat = new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.55
    });
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(steamGeo, steamMat);
      s.position.set(0.14, 0.74 + i * 0.06, 0.02);
      bar.add(s);
      this.espressoSteam.push(s);
    }
    this.tagTarget(bar, {
      kind: "espresso",
      label: "Elixir Espresso Bar",
      worldX: this.espressoStandPos.x,
      worldZ: this.espressoStandPos.z
    });
    this.group.add(bar);

    // 3. Holographic Protein Microscope Console (Analyze Fold!)
    const micro = new THREE.Group();
    micro.position.set(-1.58, 0.39, -0.62);
    micro.rotation.y = 1.5;
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.56, 16), stoneMat);
    ped.position.y = 0.28;
    ped.castShadow = true;
    micro.add(ped);
    const desk = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.04, 0.36), metalMat);
    desk.position.y = 0.57;
    desk.castShadow = true;
    micro.add(desk);
    const scopeArm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.26, 10), metalMat);
    scopeArm.position.set(0, 0.72, -0.06);
    scopeArm.rotation.x = 0.35;
    micro.add(scopeArm);
    const scopeLens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.036, 0.08, 12), accentGlowMat);
    scopeLens.position.set(0, 0.76, 0.02);
    scopeLens.rotation.x = 0.35;
    micro.add(scopeLens);
    const holoPlate = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.014), glassMat);
    holoPlate.position.set(0, 0.74, -0.14);
    holoPlate.rotation.x = -0.25;
    micro.add(holoPlate);
    this.tagTarget(micro, {
      kind: "microscope",
      label: "Protein Microscope",
      worldX: this.microscopeStandPos.x,
      worldZ: this.microscopeStandPos.z
    });
    this.group.add(micro);

    // 4. Quantum Coin Harvester Terminal Podium (Spin Blades / Harvest!)
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
      new THREE.OctahedronGeometry(0.11, 0),
      new THREE.MeshStandardMaterial({
        color: "#818cf8",
        emissive: "#6366f1",
        emissiveIntensity: 1.05,
        roughness: 0.12,
        metalness: 0.45
      })
    );
    crystal.position.y = 0.84;
    harv.add(crystal);
    this.harvesterRotor = crystal;
    this.tagTarget(harv, {
      kind: "harvester",
      label: "ALCH Harvester Console",
      worldX: this.harvesterStandPos.x,
      worldZ: this.harvesterStandPos.z
    });
    this.group.add(harv);

    this.setPatioDecor(initialDecor, accentHex, terrazzoTex, titaniumTex);
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

  public setPatioDecor(
    decor: PatioDecorId,
    accentHex: string,
    terrazzoTex: THREE.Texture,
    titaniumTex: THREE.Texture
  ) {
    this.disposeObjectChildren(this.decorGroup);
    this.prismTotem = null;
    this.lanternOrbs = [];

    const stoneMat = new THREE.MeshStandardMaterial({
      map: terrazzoTex,
      color: "#f7f9fc",
      roughness: 0.42
    });
    const metalMat = new THREE.MeshStandardMaterial({
      map: titaniumTex,
      color: "#cbd5e1",
      roughness: 0.2,
      metalness: 0.88
    });

    if (decor === "fountain") {
      // Sculpted Zen Tiered Reflecting Basin on front-right terrace corner
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
      // Levitating Holographic Crystal Totem Sculpture
      const p = new THREE.Group();
      p.position.set(1.74, 0.23, 1.66);
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.46), stoneMat);
      plinth.position.y = 0.11;
      plinth.castShadow = true;
      p.add(plinth);
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.2, 0),
        new THREE.MeshPhysicalMaterial({
          color: accentHex,
          emissive: accentHex,
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
      // Pair of Warm Architectural Glass Patio Lantern Bollards
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
        if (!this.lanternGlowTex) {
          this.lanternGlowTex = createRadialGlowTexture("#fbbf24");
        }
        const halo = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.lanternGlowTex,
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
    } else {
      // Default "bonsai": matching companion sculptural alabaster urn on front-right terrace
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

  public update(dt: number, t: number) {
    if (this.harvesterRotor) {
      this.harvesterRotor.rotation.y += dt * 1.9;
      this.harvesterRotor.position.y = 0.84 + Math.sin(t * 2.6) * 0.035;
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
    this.lanternGlowTex = null;
    this.interactiveRoots = [];
  }
}
