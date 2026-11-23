import * as THREE from "three";
import { LAB_STATIONS, type LabStationId } from "./labStations";
import { LAB_SECTORS, hasSector } from "../web3/sectors";

export interface DiegeticMonitorTelemetry {
  pdbId: string;
  taskShort: string;
  bestEnergy: number;
  nativeQ: number;
  energyHistory: number[];
  computeActive: boolean;
  pendingCoins: number;
  miningRatePerHour: number;
  petName: string;
  petMood: string;
  petFood: number;
  petHappy: number;
  petPlay: number;
  petBoost: number;
  sectorsMask: number;
  tier: number;
  characterName: string;
  characterTitle: string;
  characterAccent: string;
  goalsDone: number;
}

interface DiegeticScreenRig {
  stationId: LabStationId;
  group: THREE.Group;
  screenMesh: THREE.Mesh;
  frameMat: THREE.MeshStandardMaterial;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  basePos: THREE.Vector3;
  baseYaw: number;
  phase: number;
  lastFingerprint: string;
}

/**
 * Diegetic 3D Floating Frosted-Glass Holographic Lab Monitors inside Three.js.
 *
 * Each of the 5 lab sections features a physical hovering translucent glass monitor
 * with a brushed-titanium bezel and dirty-flagged live CanvasTexture displaying real
 * live charts (protein energy sparkline, ALCH mining telemetry, pet vitals bars,
 * architectural 6-room floorplan blueprint, and researcher profile/goals).
 *
 * Clicking any 3D screen raycasts directly to its station!
 */
export class DiegeticLabMonitors3D {
  public readonly group = new THREE.Group();
  private screens = new Map<LabStationId, DiegeticScreenRig>();
  private lastDrawMs = -1000;

  constructor() {
    const titaniumMat = new THREE.MeshStandardMaterial({
      color: "#cbd5e1",
      roughness: 0.2,
      metalness: 0.88
    });
    const backGlassMat = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      transmission: 0.72,
      roughness: 0.14,
      ior: 1.46,
      thickness: 0.06,
      transparent: true,
      opacity: 0.72
    });

    LAB_STATIONS.forEach((st, idx) => {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 320;
      const ctx = canvas.getContext("2d")!;

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;

      const rigGroup = new THREE.Group();
      const basePos = new THREE.Vector3(st.panelPos[0], st.panelPos[1] - 0.36, st.panelPos[2]);
      rigGroup.position.copy(basePos);

      // Angle each monitor gently inward/outward toward the courtyard promenade
      const baseYaw = Math.atan2(st.padX, st.padZ) * 0.55;
      rigGroup.rotation.y = baseYaw;

      const panelW = 0.92;
      const panelH = 0.575;

      // Translucent architectural glass slab backing
      const backPlate = new THREE.Mesh(
        new THREE.BoxGeometry(panelW + 0.036, panelH + 0.036, 0.022),
        backGlassMat
      );
      backPlate.position.z = -0.014;
      backPlate.userData.stationId = st.id;
      rigGroup.add(backPlate);

      // Crisp emissive top & bottom accent rail
      const frameMat = new THREE.MeshStandardMaterial({
        color: st.accent,
        emissive: st.accent,
        emissiveIntensity: 0.75,
        roughness: 0.2,
        metalness: 0.5
      });
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(panelW + 0.044, 0.016, 0.03), frameMat);
      topRail.position.set(0, panelH / 2 + 0.02, -0.008);
      rigGroup.add(topRail);

      const botRail = new THREE.Mesh(new THREE.BoxGeometry(panelW * 0.6, 0.012, 0.026), titaniumMat);
      botRail.position.set(0, -panelH / 2 - 0.022, -0.008);
      rigGroup.add(botRail);

      // Live holographic CanvasTexture screen face
      const screenMat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.96,
        side: THREE.DoubleSide
      });
      const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(panelW, panelH), screenMat);
      screenMesh.position.z = 0.003;
      screenMesh.userData.stationId = st.id;
      rigGroup.add(screenMesh);

      this.group.add(rigGroup);
      this.screens.set(st.id, {
        stationId: st.id,
        group: rigGroup,
        screenMesh,
        frameMat,
        canvas,
        ctx,
        texture,
        basePos,
        baseYaw,
        phase: idx * 1.25,
        lastFingerprint: ""
      });
    });
  }

  public getRaycastTargets(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const s of this.screens.values()) {
      out.push(s.group);
    }
    return out;
  }

  public updateTelemetry(data: DiegeticMonitorTelemetry, nowMs: number) {
    // Throttle GPU canvas texture uploads cleanly (~320ms cadence, dirty-checked per monitor)
    if (nowMs - this.lastDrawMs < 320) return;
    this.lastDrawMs = nowMs;

    this.redrawIfDirty(
      "research",
      `${data.pdbId}|${data.bestEnergy.toFixed(1)}|${data.nativeQ}|${data.computeActive}|${data.energyHistory.length}`,
      (ctx, w, h) => this.drawResearchScreen(ctx, w, h, data)
    );
    this.redrawIfDirty(
      "mining",
      `${data.pendingCoins.toFixed(2)}|${data.miningRatePerHour.toFixed(1)}`,
      (ctx, w, h) => this.drawMiningScreen(ctx, w, h, data)
    );
    this.redrawIfDirty(
      "pet",
      `${data.petName}|${data.petMood}|${data.petFood}|${data.petHappy}|${data.petPlay}|${data.petBoost}`,
      (ctx, w, h) => this.drawPetScreen(ctx, w, h, data)
    );
    this.redrawIfDirty(
      "builder",
      `${data.sectorsMask}|${data.tier}`,
      (ctx, w, h) => this.drawBuilderScreen(ctx, w, h, data)
    );
    this.redrawIfDirty(
      "console",
      `${data.characterName}|${data.characterTitle}|${data.characterAccent}|${data.goalsDone}`,
      (ctx, w, h) => this.drawConsoleScreen(ctx, w, h, data)
    );
  }

  public animate(
    dt: number,
    t: number,
    camera: THREE.Camera,
    nearStation: LabStationId | null,
    activeStation: LabStationId | null,
    visible: boolean
  ) {
    this.group.visible = visible;
    if (!visible) return;

    const rotAlpha = 1 - Math.exp(-5.5 * dt);
    const scaleAlpha = 1 - Math.exp(-8.5 * dt);

    for (const rig of this.screens.values()) {
      const highlighted = rig.stationId === nearStation || rig.stationId === activeStation;
      rig.group.position.y = rig.basePos.y + Math.sin(t * 1.55 + rig.phase) * 0.045;

      // Gently billboard horizontally toward the camera while keeping serene architectural tilt
      const dx = camera.position.x - rig.group.position.x;
      const dz = camera.position.z - rig.group.position.z;
      const desiredYaw = Math.atan2(dx, dz);
      let diff = desiredYaw - rig.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      rig.group.rotation.y += diff * rotAlpha;

      const targetScale = highlighted ? 1.09 : 1.0;
      rig.group.scale.x += (targetScale - rig.group.scale.x) * scaleAlpha;
      rig.group.scale.y += (targetScale - rig.group.scale.y) * scaleAlpha;
      rig.group.scale.z += (targetScale - rig.group.scale.z) * scaleAlpha;
      rig.frameMat.emissiveIntensity = highlighted ? 1.45 : 0.72;
    }
  }

  private redrawIfDirty(
    id: LabStationId,
    fingerprint: string,
    painter: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  ) {
    const rig = this.screens.get(id);
    if (!rig || rig.lastFingerprint === fingerprint) return;
    rig.lastFingerprint = fingerprint;
    painter(rig.ctx, rig.canvas.width, rig.canvas.height);
    rig.texture.needsUpdate = true;
  }

  private drawGlassBackdrop(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    accent: string,
    kicker: string,
    title: string
  ) {
    ctx.clearRect(0, 0, w, h);

    // Frosted porcelain-glass screen card
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "rgba(255, 255, 255, 0.94)");
    bg.addColorStop(1, "rgba(238, 244, 252, 0.88)");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(8, 8, w - 16, h - 16, 26);
    ctx.fill();

    // Subtle luminous border & subtle blueprint scanlines
    ctx.strokeStyle = "rgba(148, 163, 184, 0.38)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "rgba(148, 163, 184, 0.06)";
    for (let y = 26; y < h - 20; y += 12) {
      ctx.fillRect(16, y, w - 32, 1.5);
    }

    // Accent indicator dot + kicker
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(38, 44, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "600 17px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#64748b";
    ctx.fillText(kicker.toUpperCase(), 56, 50);

    ctx.font = "600 34px 'Inter', sans-serif";
    ctx.fillStyle = "#1a1f2c";
    ctx.fillText(title, 32, 96);
  }

  private drawResearchScreen(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    d: DiegeticMonitorTelemetry
  ) {
    this.drawGlassBackdrop(
      ctx,
      w,
      h,
      "#38bdf8",
      d.computeActive ? "Live Folding · Active" : "Folding · Paused",
      `${d.pdbId} · ${d.taskShort}`
    );

    // Energy & Native Q pills
    ctx.font = "600 28px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#0f172a";
    ctx.fillText(`${d.bestEnergy.toFixed(1)} kcal/mol`, 32, 146);

    ctx.font = "600 22px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#0284c7";
    ctx.fillText(`Q ${d.nativeQ}%`, w - 138, 144);

    // Live folding energy sparkline chart box
    ctx.fillStyle = "rgba(241, 245, 251, 0.9)";
    ctx.beginPath();
    ctx.roundRect(32, 168, w - 64, 114, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const hist = d.energyHistory;
    if (hist.length >= 2) {
      const minE = Math.min(...hist) - 0.6;
      const maxE = Math.max(...hist) + 0.6;
      const span = Math.max(1, maxE - minE);
      ctx.beginPath();
      hist.forEach((val, idx) => {
        const px = 48 + (idx / (hist.length - 1)) * (w - 96);
        const py = 266 - ((val - minE) / span) * 82;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
  }

  private drawMiningScreen(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    d: DiegeticMonitorTelemetry
  ) {
    this.drawGlassBackdrop(ctx, w, h, "#6366f1", "0% Tax ALCH Yield", "Mining Bay");

    ctx.font = "700 46px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#1a1f2c";
    ctx.fillText(`${d.pendingCoins.toFixed(2)}`, 32, 166);

    ctx.font = "600 22px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#6366f1";
    ctx.fillText(`ALCH READY · +${d.miningRatePerHour.toFixed(1)}/hr`, 32, 204);

    // Stylized harmonic mining yield bars
    const barCount = 12;
    const barW = (w - 86) / barCount;
    for (let i = 0; i < barCount; i++) {
      const level = 0.32 + 0.62 * Math.abs(Math.sin(i * 0.75 + d.pendingCoins * 0.9));
      const bh = level * 56;
      ctx.fillStyle = i % 2 === 0 ? "#6366f1" : "#818cf8";
      ctx.beginPath();
      ctx.roundRect(32 + i * (barW + 2), 282 - bh, barW - 4, bh, 6);
      ctx.fill();
    }
  }

  private drawPetScreen(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    d: DiegeticMonitorTelemetry
  ) {
    this.drawGlassBackdrop(
      ctx,
      w,
      h,
      "#f472b6",
      `${d.petMood} · ${d.petBoost}x Lab Speed`,
      d.petName
    );

    const bars: Array<[string, number, string]> = [
      ["FOOD", d.petFood, "#10b981"],
      ["HAPPY", d.petHappy, "#f472b6"],
      ["PLAY", d.petPlay, "#5b8def"]
    ];

    bars.forEach(([label, val, col], i) => {
      const y = 148 + i * 50;
      ctx.font = "600 17px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#475569";
      ctx.fillText(label, 32, y);
      ctx.fillText(`${Math.round(val)}%`, w - 84, y);

      ctx.fillStyle = "rgba(148, 163, 184, 0.25)";
      ctx.beginPath();
      ctx.roundRect(114, y - 15, w - 216, 18, 9);
      ctx.fill();

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(114, y - 15, Math.max(12, ((w - 216) * val) / 100), 18, 9);
      ctx.fill();
    });
  }

  private drawBuilderScreen(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    d: DiegeticMonitorTelemetry
  ) {
    let built = 0;
    for (let i = 0; i < 6; i++) if (hasSector(d.sectorsMask, i)) built++;

    this.drawGlassBackdrop(
      ctx,
      w,
      h,
      "#10b981",
      `Level ${d.tier} Campus Blueprint`,
      `${built} / 6 Wings Built`
    );

    // 2x3 architectural wing status grid
    LAB_SECTORS.forEach((sec, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const bx = 32 + col * 228;
      const by = 122 + row * 56;
      const isBuilt = hasSector(d.sectorsMask, sec.id);

      ctx.fillStyle = isBuilt ? "rgba(255,255,255,0.96)" : "rgba(241,245,251,0.72)";
      ctx.beginPath();
      ctx.roundRect(bx, by, 214, 44, 12);
      ctx.fill();
      ctx.strokeStyle = isBuilt ? sec.accent : "rgba(148,163,184,0.34)";
      ctx.lineWidth = isBuilt ? 2.5 : 1.5;
      ctx.stroke();

      ctx.fillStyle = isBuilt ? sec.accent : "#cbd5e1";
      ctx.beginPath();
      ctx.arc(bx + 20, by + 22, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "600 17px 'Inter', sans-serif";
      ctx.fillStyle = isBuilt ? "#1a1f2c" : "#64748b";
      ctx.fillText(sec.shortName, bx + 36, by + 28);
    });
  }

  private drawConsoleScreen(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    d: DiegeticMonitorTelemetry
  ) {
    this.drawGlassBackdrop(ctx, w, h, d.characterAccent || "#8b5cf6", d.characterTitle, d.characterName);

    ctx.font = "600 22px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#475569";
    ctx.fillText(`LAB GOALS: ${d.goalsDone} OF 5`, 32, 152);

    // 5 progress capsules
    for (let i = 0; i < 5; i++) {
      const done = i < d.goalsDone;
      ctx.fillStyle = done ? "#10b981" : "rgba(148, 163, 184, 0.28)";
      ctx.beginPath();
      ctx.roundRect(32 + i * 88, 174, 76, 18, 9);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(241, 245, 251, 0.92)";
    ctx.beginPath();
    ctx.roundRect(32, 216, w - 64, 62, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = "600 20px 'Inter', sans-serif";
    ctx.fillStyle = "#1a1f2c";
    ctx.fillText("Walk up or click to customize look & studio", 50, 254);
  }

  public dispose() {
    for (const rig of this.screens.values()) {
      rig.texture.dispose();
    }
    this.group.traverse((obj) => {
      if (obj === this.group) return;
      const meshLike = obj as THREE.Mesh;
      if (meshLike.geometry) meshLike.geometry.dispose();
      if (meshLike.material) {
        const mats = Array.isArray(meshLike.material) ? meshLike.material : [meshLike.material];
        for (const m of mats) m.dispose();
      }
    });
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
    this.screens.clear();
  }
}
