import * as THREE from "three";
import { createFastArchitecturalGlass } from "./browserCompat";
import type { SimsObjectTarget } from "./simsState";
import {
  buildTrafficRoutes,
  sampleRoutePose,
  selectActiveVehicleBlueprints,
  shouldVehicleYield,
  type TrafficRoute,
  type VehicleBlueprint
} from "./townVehicles";

interface ActiveVehicleRig {
  bp: VehicleBlueprint;
  route: TrafficRoute;
  group: THREE.Group;
  bodyGroup: THREE.Group;
  wheels: THREE.Mesh[];
  brakeMat: THREE.MeshStandardMaterial;
  distance: number;
  speed: number;
  x: number;
  z: number;
  yaw: number;
  honkPulse: number;
}

/**
 * Ultra-Lightweight Stylized Architectural Town Traffic Fleet in Three.js.
 *
 * Uses shared geometries, shared materials, and zero-extra-pass clearcoat glass so up to
 * 12 autonomous electric sedans, botanical flower trucks, research vans, eco streetcars &
 * micro-coupes drive smoothly around every paved street & outer expansion ring at 60fps
 * on desktop, laptops, Safari, Firefox, and mobile phones!
 */
export class TownTraffic3D {
  public readonly group = new THREE.Group();

  private routes: TrafficRoute[] = [];
  private rigs: ActiveVehicleRig[] = [];
  private maxVehicles: number;
  private lastFleetKey = "";
  private nightGlow = 0.4;

  // Shared geometries & materials (dramatically cuts draw-call & shader overhead!)
  private wheelGeo = new THREE.CylinderGeometry(0.145, 0.145, 0.09, 12);
  private rimGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.096, 10);
  private lampGeo = new THREE.BoxGeometry(0.12, 0.055, 0.04);

  private tireMat = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.86, metalness: 0.08 });
  private rimMat = new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.24, metalness: 0.82 });
  private trimMat = new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.3, metalness: 0.65 });
  private glassMat = createFastArchitecturalGlass({ color: "#bae6fd", opacity: 0.62, roughness: 0.07 });
  private headlightMat = new THREE.MeshStandardMaterial({
    color: "#fffbeb",
    emissive: "#fef08a",
    emissiveIntensity: 0.9,
    roughness: 0.12
  });
  private flowerStemMat = new THREE.MeshStandardMaterial({ color: "#22c55e", roughness: 0.72 });
  private flowerPinkMat = new THREE.MeshStandardMaterial({ color: "#f472b6", roughness: 0.55 });
  private flowerGoldMat = new THREE.MeshStandardMaterial({ color: "#fbbf24", roughness: 0.55 });
  private woodMat = new THREE.MeshStandardMaterial({ color: "#c8a986", roughness: 0.72 });
  private ownedMaterials: THREE.Material[] = [];
  private ownedGeometries: THREE.BufferGeometry[] = [];

  constructor(maxVehicles = 10) {
    this.maxVehicles = Math.max(3, maxVehicles);
    this.wheelGeo.rotateZ(Math.PI / 2);
    this.rimGeo.rotateZ(Math.PI / 2);
    this.syncTownScale(6, 0);
  }

  public syncTownScale(totalMintedLabs: number, expansionBands: number) {
    const routes = buildTrafficRoutes(expansionBands);
    const blueprints = selectActiveVehicleBlueprints(
      totalMintedLabs,
      this.maxVehicles,
      routes.length
    );
    const nextKey = `${routes.length}:${blueprints.map((b) => `${b.id}@${b.routeIndex}`).join(",")}`;
    if (nextKey === this.lastFleetKey) return;
    this.lastFleetKey = nextKey;
    this.routes = routes;

    const existingById = new Map(this.rigs.map((r) => [r.bp.id, r]));
    const nextRigs: ActiveVehicleRig[] = [];

    for (const bp of blueprints) {
      const route = routes[bp.routeIndex] ?? routes[0];
      const existing = existingById.get(bp.id);
      if (existing) {
        if (existing.route.id !== route.id) {
          existing.route = route;
          existing.distance = bp.initialFraction * route.totalLength;
        }
        existing.bp = bp;
        nextRigs.push(existing);
        existingById.delete(bp.id);
      } else {
        const rig = this.createVehicleRig(bp, route);
        this.group.add(rig.group);
        nextRigs.push(rig);
      }
    }

    // Remove any unused rigs cleanly
    for (const stale of existingById.values()) {
      this.group.remove(stale.group);
      stale.brakeMat.dispose();
    }
    this.rigs = nextRigs;
  }

  private trackGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.ownedGeometries.push(g);
    return g;
  }

  private trackMat<T extends THREE.Material>(m: T): T {
    this.ownedMaterials.push(m);
    return m;
  }

  private createVehicleRig(bp: VehicleBlueprint, route: TrafficRoute): ActiveVehicleRig {
    const root = new THREE.Group();
    const bodyGroup = new THREE.Group();
    root.add(bodyGroup);

    const bodyMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: bp.bodyHex,
        roughness: 0.28,
        metalness: 0.26
      })
    );
    const accentMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: bp.accentHex,
        emissive: bp.accentHex,
        emissiveIntensity: 0.25,
        roughness: 0.24,
        metalness: 0.35
      })
    );
    const brakeMat = new THREE.MeshStandardMaterial({
      color: "#fb7185",
      emissive: "#ef4444",
      emissiveIntensity: 0.65,
      roughness: 0.16
    });

    // Dimensions per stylized vehicle archetype (all <= 0.82m wide to stay neatly centered inside 1.1m right lane!)
    let length = 1.62;
    let width = 0.78;
    let wheelBaseZ = 0.5;

    if (bp.kind === "eco-bus") {
      length = 2.08;
      width = 0.82;
      wheelBaseZ = 0.68;

      const lower = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(width, 0.36, length)), bodyMat);
      lower.position.y = 0.34;
      const stripe = new THREE.Mesh(
        this.trackGeo(new THREE.BoxGeometry(width + 0.015, 0.08, length + 0.01)),
        accentMat
      );
      stripe.position.y = 0.32;
      const cabin = new THREE.Mesh(
        this.trackGeo(new THREE.BoxGeometry(width - 0.04, 0.38, length - 0.14)),
        this.glassMat
      );
      cabin.position.y = 0.7;
      const roof = new THREE.Mesh(
        this.trackGeo(new THREE.BoxGeometry(width - 0.02, 0.07, length - 0.1)),
        bodyMat
      );
      roof.position.y = 0.92;
      const roofPod = new THREE.Mesh(
        this.trackGeo(new THREE.BoxGeometry(0.46, 0.06, 0.84)),
        this.trimMat
      );
      roofPod.position.y = 0.98;
      bodyGroup.add(lower, stripe, cabin, roof, roofPod);
    } else if (bp.kind === "research-van") {
      length = 1.78;
      width = 0.8;
      wheelBaseZ = 0.56;

      const cargo = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(width, 0.58, 1.16)), bodyMat);
      cargo.position.set(0, 0.48, -0.26);
      const hood = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(width - 0.02, 0.3, 0.62)), bodyMat);
      hood.position.set(0, 0.32, 0.54);
      const cabGlass = new THREE.Mesh(
        this.trackGeo(new THREE.BoxGeometry(width - 0.06, 0.28, 0.44)),
        this.glassMat
      );
      cabGlass.position.set(0, 0.6, 0.46);
      const stripe = new THREE.Mesh(
        this.trackGeo(new THREE.BoxGeometry(width + 0.016, 0.085, 1.48)),
        accentMat
      );
      stripe.position.set(0, 0.36, -0.06);
      const beacon = new THREE.Mesh(
        this.trackGeo(new THREE.BoxGeometry(0.32, 0.065, 0.14)),
        accentMat
      );
      beacon.position.set(0, 0.81, 0.05);
      bodyGroup.add(cargo, hood, cabGlass, stripe, beacon);
    } else if (bp.kind === "garden-truck") {
      length = 1.74;
      width = 0.78;
      wheelBaseZ = 0.54;

      const chassis = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(width, 0.24, length)), bodyMat);
      chassis.position.y = 0.28;
      const cab = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(width - 0.04, 0.34, 0.64)), bodyMat);
      cab.position.set(0, 0.56, 0.28);
      const windshield = new THREE.Mesh(
        this.trackGeo(new THREE.BoxGeometry(width - 0.08, 0.22, 0.52)),
        this.glassMat
      );
      windshield.position.set(0, 0.58, 0.31);
      // Cute Cedar Open-Bed Cargo Box filled with Potted Flowers & Saplings!
      const bedFloor = new THREE.Mesh(
        this.trackGeo(new THREE.BoxGeometry(width - 0.06, 0.14, 0.82)),
        this.woodMat
      );
      bedFloor.position.set(0, 0.44, -0.44);
      bodyGroup.add(chassis, cab, windshield, bedFloor);

      const foliageGeo = this.trackGeo(new THREE.IcosahedronGeometry(0.14, 0));
      const bloomGeo = this.trackGeo(new THREE.SphereGeometry(0.065, 7, 7));
      for (const [fx, fz, isPink] of [
        [-0.16, -0.28, true],
        [0.16, -0.32, false],
        [0, -0.58, true]
      ] as const) {
        const bush = new THREE.Mesh(foliageGeo, this.flowerStemMat);
        bush.position.set(fx, 0.58, fz);
        const bloom = new THREE.Mesh(bloomGeo, isPink ? this.flowerPinkMat : this.flowerGoldMat);
        bloom.position.set(fx, 0.71, fz);
        bodyGroup.add(bush, bloom);
      }
    } else if (bp.kind === "micro-coupe") {
      length = 1.36;
      width = 0.74;
      wheelBaseZ = 0.42;

      const hull = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(width, 0.26, length)), bodyMat);
      hull.position.y = 0.29;
      const cabin = new THREE.Mesh(
        this.trackGeo(new THREE.BoxGeometry(width - 0.1, 0.24, 0.68)),
        this.glassMat
      );
      cabin.position.set(0, 0.53, -0.04);
      const roof = new THREE.Mesh(
        this.trackGeo(new THREE.BoxGeometry(width - 0.12, 0.055, 0.56)),
        accentMat
      );
      roof.position.set(0, 0.67, -0.06);
      bodyGroup.add(hull, cabin, roof);
    } else {
      // Sleek Compact Electric Sedan
      length = 1.62;
      width = 0.78;
      wheelBaseZ = 0.5;

      const lower = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(width, 0.26, length)), bodyMat);
      lower.position.y = 0.29;
      const trim = new THREE.Mesh(
        this.trackGeo(new THREE.BoxGeometry(width + 0.014, 0.055, length - 0.06)),
        accentMat
      );
      trim.position.y = 0.24;
      const cabin = new THREE.Mesh(
        this.trackGeo(new THREE.BoxGeometry(width - 0.08, 0.26, 0.86)),
        this.glassMat
      );
      cabin.position.set(0, 0.54, -0.06);
      const roof = new THREE.Mesh(
        this.trackGeo(new THREE.BoxGeometry(width - 0.1, 0.055, 0.72)),
        bodyMat
      );
      roof.position.set(0, 0.69, -0.08);
      bodyGroup.add(lower, trim, cabin, roof);
    }

    // Headlights (+Z front) & Taillights (-Z rear)
    for (const sx of [-width * 0.32, width * 0.32]) {
      const hl = new THREE.Mesh(this.lampGeo, this.headlightMat);
      hl.position.set(sx, 0.3, length * 0.5 + 0.008);
      const tl = new THREE.Mesh(this.lampGeo, brakeMat);
      tl.position.set(sx, 0.31, -length * 0.5 - 0.008);
      bodyGroup.add(hl, tl);
    }

    // 4 Spinning Alloy Wheels
    const wheels: THREE.Mesh[] = [];
    const wx = width * 0.5 - 0.015;
    for (const sideX of [-wx, wx]) {
      for (const wz of [-wheelBaseZ, wheelBaseZ]) {
        const wheel = new THREE.Mesh(this.wheelGeo, this.tireMat);
        wheel.position.set(sideX, 0.155, wz);
        const rim = new THREE.Mesh(this.rimGeo, this.rimMat);
        wheel.add(rim);
        root.add(wheel);
        wheels.push(wheel);
      }
    }

    const startDist = bp.initialFraction * route.totalLength;
    const pose = sampleRoutePose(route, startDist);
    root.position.set(pose.x, 0.024, pose.z);
    root.rotation.y = pose.yaw;

    const simsTarget: SimsObjectTarget = {
      kind: "vehicle",
      label: bp.label,
      vehicleId: bp.id,
      worldX: pose.x,
      worldZ: pose.z
    };
    root.traverse((obj) => {
      obj.userData.simsTarget = simsTarget;
    });

    return {
      bp,
      route,
      group: root,
      bodyGroup,
      wheels,
      brakeMat,
      distance: startDist,
      speed: bp.cruiseSpeed,
      x: pose.x,
      z: pose.z,
      yaw: pose.yaw,
      honkPulse: 0
    };
  }

  public setNightGlow(intensity: number) {
    this.nightGlow = intensity;
    this.headlightMat.emissiveIntensity = 0.65 + intensity * 1.15;
  }

  public triggerFriendlyHonk(vehicleId: string) {
    const rig = this.rigs.find((r) => r.bp.id === vehicleId);
    if (!rig) return;
    rig.honkPulse = 1.0;
  }

  public getRaycastTargets(): THREE.Object3D[] {
    return this.rigs.map((r) => r.group);
  }

  public update(
    dt: number,
    t: number,
    playerX: number,
    playerZ: number,
    npcCoords: ReadonlyArray<readonly [number, number]>
  ) {
    const accelRate = 1 - Math.exp(-4.8 * dt);
    const brakeRate = 1 - Math.exp(-9.5 * dt);

    for (let i = 0; i < this.rigs.length; i++) {
      const rig = this.rigs[i];
      let mustYield = shouldVehicleYield(rig.x, rig.z, rig.yaw, playerX, playerZ, 2.75, 1.1);

      if (!mustYield) {
        for (let j = 0; j < npcCoords.length; j++) {
          const [nx, nz] = npcCoords[j];
          if (shouldVehicleYield(rig.x, rig.z, rig.yaw, nx, nz, 2.25, 0.95)) {
            mustYield = true;
            break;
          }
        }
      }

      // Respect safe vehicle-to-vehicle following distance so cars never clip through each other
      if (!mustYield) {
        for (let k = 0; k < this.rigs.length; k++) {
          if (k === i) continue;
          const other = this.rigs[k];
          if (shouldVehicleYield(rig.x, rig.z, rig.yaw, other.x, other.z, 3.05, 0.95)) {
            mustYield = true;
            break;
          }
        }
      }

      const targetSpeed = mustYield ? 0 : rig.bp.cruiseSpeed;
      rig.speed += (targetSpeed - rig.speed) * (mustYield ? brakeRate : accelRate);
      if (rig.speed < 0.03 && mustYield) rig.speed = 0;

      rig.distance = (rig.distance + rig.speed * dt) % rig.route.totalLength;
      const pose = sampleRoutePose(rig.route, rig.distance);
      rig.x = pose.x;
      rig.z = pose.z;
      rig.yaw = pose.yaw;

      rig.group.position.set(pose.x, 0.024, pose.z);
      rig.group.rotation.y = pose.yaw;

      // Subtle springy suspension bounce (plus joyful double-hop when honked!)
      let honkBounce = 0;
      if (rig.honkPulse > 0) {
        rig.honkPulse = Math.max(0, rig.honkPulse - dt * 2.2);
        honkBounce = Math.abs(Math.sin(rig.honkPulse * Math.PI * 2)) * 0.075;
      }
      const roadBob = rig.speed > 0.2 ? Math.sin(t * 14 + i * 1.9) * 0.008 : 0;
      rig.bodyGroup.position.y = roadBob + honkBounce;

      // Rotate all 4 wheels proportionally to travel distance
      const wheelSpin = (rig.speed * dt) / 0.145;
      if (wheelSpin > 0.0001) {
        for (const w of rig.wheels) {
          w.rotation.x += wheelSpin;
        }
      }

      // Brighten ruby brake taillights when politely yielding!
      rig.brakeMat.emissiveIntensity = mustYield ? 1.85 : 0.45 + this.nightGlow * 0.45;

      // Keep clickable Sims target coords live
      const ud = rig.group.userData.simsTarget as SimsObjectTarget | undefined;
      if (ud) {
        ud.worldX = pose.x;
        ud.worldZ = pose.z;
      }
    }
  }

  public dispose() {
    for (const rig of this.rigs) {
      this.group.remove(rig.group);
      rig.brakeMat.dispose();
    }
    this.rigs = [];
    this.wheelGeo.dispose();
    this.rimGeo.dispose();
    this.lampGeo.dispose();
    this.tireMat.dispose();
    this.rimMat.dispose();
    this.trimMat.dispose();
    this.glassMat.dispose();
    this.headlightMat.dispose();
    this.flowerStemMat.dispose();
    this.flowerPinkMat.dispose();
    this.flowerGoldMat.dispose();
    this.woodMat.dispose();
    for (const g of this.ownedGeometries) g.dispose();
    this.ownedGeometries = [];
    for (const m of this.ownedMaterials) m.dispose();
    this.ownedMaterials = [];
  }
}
