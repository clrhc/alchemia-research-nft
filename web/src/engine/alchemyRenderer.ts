import { SeededRNG, deriveTraitsFromSeed } from "./prng";
import { ResearchComputeEngine, type ComputeSnapshot } from "./researchCompute";
import { stageFromEth, type AlchemyTraits } from "./traits";

export interface LiveImpactState {
  tokenId: number;
  seed: string;
  causeId: number;
  causeName: string;
  tokenValueUsd: number;   // $1 upward put into this single NFT
  complexityTier: number;  // 1..5 derived from tokenValueUsd / on-chain value
  sectorsMask?: number;    // 6-bit mask of Sims-style built 3D architectural lab wings
  petLevel?: number;       // Tamagotchi care level unlocking cozy lab accessories
  petMoodScore?: number;   // 0..100 average vitals for sleepy zzz / energetic AI
  petAccessory?: string;   // Pet hat / collar accessory style
  petOutfit?: string;      // Pet clothing outfit ("none" | "sweater" | "labcoat" | "hoodie" | "raincoat" | "cape" | "tutu" | "puffer")
  petBackGear?: string;    // Pet back gear ("none" | "wings" | "backpack" | "ribbon")
  petOutfitColor?: string; // Hex color for pet clothes & accessories
  petSleeping?: boolean;   // Cozy nap mode pausing vitals decay + zzz animation
  workUnits?: number;      // Verified protein folding rounds unlocking milestone halo
  tokenImpactEth: number;
  causeImpactEth: number;
  globalImpactEth: number;
  totalSupply: number;
  maxSupply: number; // 0 = infinite
  reactionStage: number; // 1..5
  mode: "mainnet" | "sepolia" | "local" | "simulation";
  lastPulseAt: number;
}

interface Bubble {
  x: number;
  y: number;
  r: number;
  speed: number;
  wobble: number;
  phase: number;
}

interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
  kind: "proton" | "star" | "heart" | "crystal";
  color: string;
}

interface DataPacket {
  t: number; // 0..1 progress from atomic core up to the folding chamber
  speed: number;
  hue: string;
  size: number;
}

interface FloatingAtom {
  baseX: number;
  baseY: number;
  radius: number;
  speed: number;
  phase: number;
  tilt: number;
  isProton: boolean;
}

interface StarMote {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}

const ALCHEMY_GLYPHS = ["☉", "☽", "☿", "🜂", "🜄", "🜁", "🜃", "✦", "⚛", "✧", "⚶", "⊕"];

/**
 * Ultra-Detailed Stylized Generative Alchemical Research-Mining Artwork Renderer.
 *
 * Inside every NFT card:
 *  - Runs a REAL lightweight simulated-annealing Protein Folding / Catalyst compute engine
 *  - Renders the live 3D-projected folding molecular chain inside a magnetic containment halo
 *  - Streams luminous proton data packets from the atomic core into the folding chamber
 *  - Draws an etched silver live Energy Convergence Oscilloscope & kinetic pressure manometer
 *  - Renders 5 intricate alchemical glassware vessels with live rising liquid, meniscus waves,
 *    coiled Liebig condensers, test-tube racks, double-wall glass refraction & graduation ticks
 *  - Animates detailed stylized Cats, Dogs, and Mythic Cat+Dog Duos reacting to discoveries
 */
export class AlchemyArtworkRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private traits: AlchemyTraits;
  private impact: LiveImpactState;
  private compute: ResearchComputeEngine;
  private onComputeTick?: (snap: ComputeSnapshot) => void;

  private rafId = 0;
  private startTime = 0;
  private lastTime = 0;
  private lastUiEmit = 0;
  private width = 600;
  private height = 600;
  private dpr = 1;

  // Dynamic physical animation state
  private displayFill = 0.36;
  private targetFill = 0.36;
  private sloshTilt = 0;
  private sloshVelocity = 0;
  private excitement = 0;
  private discoveryFlash = 0;
  private shockwaveRadius = 0;
  private shockwaveAlpha = 0;

  // Interactive cursor in normalized [0..1]
  private pointerX = 0.5;
  private pointerY = 0.5;
  private pointerActive = false;

  // Procedural visual entities
  private bubbles: Bubble[] = [];
  private bursts: BurstParticle[] = [];
  private dataPackets: DataPacket[] = [];
  private floatingAtoms: FloatingAtom[] = [];
  private stars: StarMote[] = [];
  private nucleusParticles: Array<{
    angle: number;
    dist: number;
    isProton: boolean;
    phase: number;
    size: number;
  }> = [];

  constructor(
    canvas: HTMLCanvasElement,
    initialState: LiveImpactState,
    onComputeTick?: (snap: ComputeSnapshot) => void
  ) {
    this.canvas = canvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2D context unavailable");
    this.ctx = context;

    this.impact = { ...initialState };
    this.onComputeTick = onComputeTick;
    this.traits = deriveTraitsFromSeed(initialState.seed);
    this.compute = new ResearchComputeEngine(initialState.seed, initialState.causeId, () => {
      this.onResearchDiscovery();
    });

    this.rebuildProceduralEntities();
    this.syncFillTarget();
    this.displayFill = this.targetFill;
    this.resize();
  }

  public getTraits(): AlchemyTraits {
    return this.traits;
  }

  public setComputeActive(active: boolean) {
    this.compute.setActive(active);
    this.onComputeTick?.(this.compute.getSnapshot());
  }

  public getComputeSnapshot(): ComputeSnapshot {
    return this.compute.getSnapshot();
  }

  public updateState(next: Partial<LiveImpactState>) {
    const prevGlobal = this.impact.globalImpactEth;
    const prevToken = this.impact.tokenImpactEth;
    const prevSeed = this.impact.seed;
    const prevPulse = this.impact.lastPulseAt;
    const prevTier = this.impact.complexityTier;

    this.impact = { ...this.impact, ...next };
    if (!next.reactionStage) {
      this.impact.reactionStage = stageFromEth(this.impact.globalImpactEth);
    }

    if (next.seed && next.seed !== prevSeed) {
      this.traits = deriveTraitsFromSeed(next.seed);
      this.compute.reseed(next.seed, this.impact.causeId);
      this.rebuildProceduralEntities();
      this.onComputeTick?.(this.compute.getSnapshot());
    }

    this.syncFillTarget();

    if (
      this.impact.globalImpactEth > prevGlobal + 1e-6 ||
      this.impact.tokenImpactEth > prevToken + 1e-6 ||
      this.impact.complexityTier > prevTier ||
      (next.lastPulseAt && next.lastPulseAt !== prevPulse)
    ) {
      this.triggerCatalyticPulse(this.impact.complexityTier > prevTier ? 1.25 : 1.0);
    }
  }

  private onResearchDiscovery() {
    this.discoveryFlash = 1.0;
    this.excitement = Math.min(1.4, this.excitement + 0.55);
    this.sloshVelocity += (Math.random() > 0.5 ? 1 : -1) * 0.14;

    // Emit celebratory research crystal & proton particles from the folding halo!
    const pal = this.traits.palette;
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12 + Math.random() * 0.3;
      const spd = 45 + Math.random() * 88;
      this.bursts.push({
        x: 300,
        y: 124,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 24,
        r: 3 + Math.random() * 4,
        life: 0,
        maxLife: 1.2 + Math.random() * 0.9,
        kind: i % 3 === 0 ? "crystal" : i % 3 === 1 ? "proton" : "star",
        color: i % 2 === 0 ? pal.electron : pal.accent
      });
    }
  }

  public triggerCatalyticPulse(intensity = 1.0) {
    this.excitement = Math.min(1.65, this.excitement + 0.95 * intensity);
    this.sloshVelocity += (Math.random() > 0.5 ? 1 : -1) * 0.28 * intensity;
    this.shockwaveRadius = 18;
    this.shockwaveAlpha = 0.9;

    const pal = this.traits.palette;
    const colors = [pal.proton, pal.electron, pal.accent, pal.liquidTop, "#ffffff"];
    const count = Math.round(24 * intensity);
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
      const spd = 72 + Math.random() * 148;
      const roll = Math.random();
      this.bursts.push({
        x: 300 + (Math.random() - 0.5) * 24,
        y: 304 + (Math.random() - 0.5) * 24,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 42,
        r: 3.4 + Math.random() * 5,
        life: 0,
        maxLife: 1.5 + Math.random() * 1.2,
        kind: roll < 0.32 ? "proton" : roll < 0.6 ? "crystal" : roll < 0.8 ? "heart" : "star",
        color: colors[i % colors.length]
      });
    }
  }

  public setPointer(normX: number, normY: number, active: boolean) {
    const dx = normX - this.pointerX;
    if (active) this.sloshVelocity += dx * 0.65;
    this.pointerX = normX;
    this.pointerY = normY;
    this.pointerActive = active;
  }

  public resize() {
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(240, rect.width || 600);
    const cssH = Math.max(240, rect.height || 600);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = cssW;
    this.height = cssH;
    this.canvas.width = Math.floor(cssW * this.dpr);
    this.canvas.height = Math.floor(cssH * this.dpr);
  }

  public start() {
    this.startTime = performance.now();
    this.lastTime = this.startTime;
    this.onComputeTick?.(this.compute.getSnapshot());
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;
      this.step(dt, now);
      this.render((now - this.startTime) / 1000);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  public stop() {
    cancelAnimationFrame(this.rafId);
  }

  private syncFillTarget() {
    const g = Math.max(0, this.impact.globalImpactEth);
    const personal = Math.max(0, this.impact.tokenImpactEth);
    const progress = Math.min(1, Math.log1p(g * 0.9 + personal * 5) / Math.log1p(22));
    this.targetFill = 0.28 + progress * 0.58;
  }

  private rebuildProceduralEntities() {
    const rng = new SeededRNG(this.traits.seed, 999);
    const pal = this.traits.palette;

    this.bubbles = [];
    for (let i = 0; i < 24; i++) {
      this.bubbles.push({
        x: rng.range(232, 368),
        y: rng.range(276, 422),
        r: rng.range(2.0, 7.6),
        speed: rng.range(18, 52),
        wobble: rng.range(4, 15),
        phase: rng.range(0, Math.PI * 2)
      });
    }

    this.dataPackets = [];
    for (let i = 0; i < 9; i++) {
      this.dataPackets.push({
        t: i / 9,
        speed: 0.28 + rng.range(0, 0.22),
        hue: i % 2 === 0 ? pal.electron : pal.proton,
        size: rng.range(2.8, 4.6)
      });
    }

    this.floatingAtoms = [];
    const atomCount = 7 + (this.traits.sub.protonCount % 4);
    for (let i = 0; i < atomCount; i++) {
      const angle = (Math.PI * 2 * i) / atomCount + rng.range(-0.22, 0.22);
      const dist = rng.range(155, 232);
      this.floatingAtoms.push({
        baseX: 300 + Math.cos(angle) * dist,
        baseY: 300 + Math.sin(angle) * dist * 0.82,
        radius: rng.range(8, 14.5),
        speed: rng.range(0.65, 1.4),
        phase: rng.range(0, Math.PI * 2),
        tilt: rng.range(-0.9, 0.9),
        isProton: i % 2 === 0
      });
    }

    this.stars = [];
    for (let i = 0; i < this.traits.sub.starCount + 8; i++) {
      this.stars.push({
        x: rng.range(28, 572),
        y: rng.range(28, 525),
        r: rng.range(1.1, 3.6),
        phase: rng.range(0, Math.PI * 2),
        speed: rng.range(1.0, 3.0)
      });
    }

    this.nucleusParticles = [];
    const totalN = this.traits.sub.protonCount + this.traits.sub.neutronCount;
    for (let i = 0; i < totalN; i++) {
      this.nucleusParticles.push({
        angle: (Math.PI * 2 * i) / totalN + rng.range(-0.28, 0.28),
        dist: i === 0 ? 0 : rng.range(6, 18),
        isProton: i < this.traits.sub.protonCount,
        phase: rng.range(0, Math.PI * 2),
        size: rng.range(5.6, 7.6)
      });
    }
  }

  private step(dt: number, now: number) {
    // Run genuine lightweight scientific compute ticks inside the card!
    // Higher complexity tiers scale compute throughput smoothly while keeping 60fps silky.
    if (this.compute.isActive()) {
      const iters = 10 + Math.max(1, this.impact.complexityTier) * 5;
      this.compute.stepCompute(iters);
      if (now - this.lastUiEmit > 260) {
        this.lastUiEmit = now;
        this.onComputeTick?.(this.compute.getSnapshot());
      }
    }

    this.displayFill += (this.targetFill - this.displayFill) * Math.min(1, dt * 2.8);

    // Spring slosh physics
    const accel = -16 * this.sloshTilt - 3.1 * this.sloshVelocity;
    this.sloshVelocity += accel * dt;
    this.sloshTilt = Math.max(-0.32, Math.min(0.32, this.sloshTilt + this.sloshVelocity * dt));

    this.excitement = Math.max(0, this.excitement - dt * 0.42);
    this.discoveryFlash = Math.max(0, this.discoveryFlash - dt * 1.15);

    if (this.shockwaveAlpha > 0.005) {
      this.shockwaveRadius += dt * 265;
      this.shockwaveAlpha *= Math.pow(0.18, dt);
    }

    // Bubbles
    const computeBoost = this.compute.isActive() ? 0.35 : 0;
    const stageBoost = 1 + (this.impact.reactionStage - 1) * 0.22 + this.excitement * 0.85 + computeBoost;
    const liquidTopY = 430 - this.displayFill * 195;
    for (const b of this.bubbles) {
      b.y -= b.speed * stageBoost * dt;
      if (b.y < liquidTopY + 4) {
        b.y = 426 + Math.random() * 8;
        b.x = 240 + Math.random() * 120;
      }
    }

    // Stream proton compute packets from atomic core up into the folding chamber
    if (this.compute.isActive()) {
      for (const pkt of this.dataPackets) {
        pkt.t += pkt.speed * (1 + this.excitement * 0.9) * dt;
        if (pkt.t >= 1) pkt.t -= 1;
      }
    }

    // Celebratory bursts
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const p = this.bursts[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.955;
      p.vy = p.vy * 0.955 - 12 * dt;
      if (p.life >= p.maxLife) this.bursts.splice(i, 1);
    }
  }

  private render(t: number) {
    const ctx = this.ctx;
    const scale = Math.min(this.width, this.height) / 600;
    const offsetX = (this.width - 600 * scale) * 0.5;
    const offsetY = (this.height - 600 * scale) * 0.5;
    const snap = this.compute.getSnapshot();

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const pal = this.traits.palette;
    const bg = ctx.createLinearGradient(0, 0, this.width, this.height);
    bg.addColorStop(0, pal.bgTop);
    bg.addColorStop(1, pal.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.width, this.height);

    // Canonical 600x600 scene
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    const tier = Math.max(1, Math.min(5, this.impact.complexityTier || 1));

    this.drawBackdropAndBlueprintGrid(ctx, t, snap);
    if (tier >= 5) this.drawAuroraAndHypercube4D(ctx, t);
    this.drawAstrolabeAndVernier(ctx, t);
    if (tier >= 3) this.drawCelestialOrrery(ctx, t);
    this.drawStarsAndDNAVapor(ctx, t);
    this.drawOrbitals(ctx, t, "back");
    this.drawLabApparatusAndManometer(ctx, t, snap);
    if (tier >= 4) this.drawTwinLevitatingAlembics(ctx, t);
    this.drawHeroVessel(ctx, t);
    this.drawProtonComputeStream(ctx, t, snap);
    this.drawLiveProteinFoldingChamber(ctx, t, snap);
    this.drawOrbitals(ctx, t, "front");
    this.drawCatalyticArcs(ctx, t);
    this.drawFloatingAtomsAndProtons(ctx, t);
    this.drawCompanions(ctx, t);
    this.drawImpactShockwaveAndBursts(ctx);

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Layer 0: Porcelain Blueprint Grid, Caustic Light & Live Energy Oscilloscope
  // ---------------------------------------------------------------------------
  private drawBackdropAndBlueprintGrid(
    ctx: CanvasRenderingContext2D,
    t: number,
    snap: ComputeSnapshot
  ) {
    const pal = this.traits.palette;
    const pulse = 1 + Math.sin(t * 1.4) * 0.04 + this.excitement * 0.14 + this.discoveryFlash * 0.18;

    // Fine architectural blueprint grid lines
    ctx.save();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.11)";
    ctx.lineWidth = 0.8;
    for (let g = 40; g < 600; g += 40) {
      ctx.beginPath();
      ctx.moveTo(g, 20);
      ctx.lineTo(g, 580);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(20, g);
      ctx.lineTo(580, g);
      ctx.stroke();
    }
    ctx.restore();

    // Central luminous reactor aura
    const rad = ctx.createRadialGradient(300, 315, 16, 300, 315, 260 * pulse);
    rad.addColorStop(0, pal.glow);
    rad.addColorStop(0.55, "rgba(255,255,255,0.26)");
    rad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, 600, 600);

    // Subtle etched Energy Minimization Oscilloscope (real compute curve!) across upper-left glass
    if (snap.energyHistory.length > 2) {
      ctx.save();
      const ox = 34;
      const oy = 74;
      const ow = 132;
      const oh = 44;

      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.strokeStyle = "rgba(148, 163, 184, 0.34)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(ox, oy, ow, oh, 10);
      ctx.fill();
      ctx.stroke();

      const minE = Math.min(...snap.energyHistory) - 0.5;
      const maxE = Math.max(...snap.energyHistory) + 0.5;
      const span = Math.max(1, maxE - minE);

      ctx.beginPath();
      snap.energyHistory.forEach((val, idx) => {
        const px = ox + 8 + (idx / (snap.energyHistory.length - 1)) * (ow - 16);
        const py = oy + oh - 8 - ((val - minE) / span) * (oh - 16);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = pal.liquidMid;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.font = "500 8px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#64748b";
      ctx.fillText(`ΔG ${snap.bestEnergy.toFixed(1)}`, ox + 8, oy + 12);
      ctx.restore();
    }

    // Crisp silver corner registration ticks
    ctx.save();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.42)";
    ctx.lineWidth = 1.2;
    const m = 18;
    const len = 16;
    for (const [cx, cy, dx, dy] of [
      [m, m, 1, 1],
      [600 - m, m, -1, 1],
      [m, 600 - m, 1, -1],
      [600 - m, 600 - m, -1, -1]
    ]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + dy * len);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + dx * len, cy);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Layer 1: Engraved Rotating Alchemical Astrolabe, Vernier Scale & Sacred Geometry
  // ---------------------------------------------------------------------------
  private drawAstrolabeAndVernier(ctx: CanvasRenderingContext2D, t: number) {
    const pal = this.traits.palette;
    const speed =
      0.07 +
      this.impact.reactionStage * 0.02 +
      (this.compute.isActive() ? 0.04 : 0) +
      this.excitement * 0.14;

    ctx.save();
    ctx.translate(300, 314);

    // Outer calibrated compass ring
    ctx.save();
    ctx.rotate(t * speed);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.36)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 224, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 96; i++) {
      const a = (Math.PI * 2 * i) / 96;
      const major = i % 8 === 0;
      const med = i % 4 === 0;
      const r1 = major ? 210 : med ? 215 : 219;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a) * 224, Math.sin(a) * 224);
      ctx.strokeStyle = major ? "rgba(71, 85, 105, 0.5)" : "rgba(148, 163, 184, 0.28)";
      ctx.stroke();
    }
    ctx.restore();

    // Inner counter-rotating sacred alchemy ring + glyphs
    ctx.save();
    ctx.rotate(-t * speed * 1.3 + this.traits.sub.astrolabeTilt);
    ctx.beginPath();
    ctx.setLineDash([4, 6]);
    ctx.arc(0, 0, 186, 0, Math.PI * 2);
    ctx.strokeStyle = pal.silverInk + "77";
    ctx.lineWidth = 1.15;
    ctx.stroke();
    ctx.setLineDash([]);

    // Dual overlapping sacred triangles (Star of Alchemy)
    for (let rot = 0; rot < 2; rot++) {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI * 2 * i) / 3 - Math.PI / 2 + (rot * Math.PI) / 3;
        const px = Math.cos(a) * 184;
        const py = Math.sin(a) * 184;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = rot === 0 ? "rgba(148,163,184,0.22)" : pal.liquidMid + "22";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Engraved Alchemical Glyphs
    ctx.font = "13px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(71, 85, 105, 0.56)";
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      const gx = Math.cos(a) * 200;
      const gy = Math.sin(a) * 200;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(ALCHEMY_GLYPHS[(i + this.traits.elementIdx) % ALCHEMY_GLYPHS.length], 0, 0);
      ctx.restore();
    }
    ctx.restore();

    // Prismatic refraction ring
    const prism = ctx.createLinearGradient(-155, -155, 155, 155);
    prism.addColorStop(0, pal.liquidTop + "66");
    prism.addColorStop(0.5, pal.accent + "55");
    prism.addColorStop(1, pal.electron + "66");
    ctx.beginPath();
    ctx.arc(0, 0, 152 + Math.sin(t * 2.1) * 2.5, 0, Math.PI * 2);
    ctx.strokeStyle = prism;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Layer 2: Twinkling Alchemy Stars & Subtle Rising Quantum Helix
  // ---------------------------------------------------------------------------
  private drawStarsAndDNAVapor(ctx: CanvasRenderingContext2D, t: number) {
    const pal = this.traits.palette;
    for (const s of this.stars) {
      const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * s.speed + s.phase));
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.fillStyle = `rgba(130, 145, 170, ${0.42 * tw})`;
      ctx.beginPath();
      ctx.moveTo(0, -s.r * 1.45);
      ctx.quadraticCurveTo(0, 0, s.r * 1.45, 0);
      ctx.quadraticCurveTo(0, 0, 0, s.r * 1.45);
      ctx.quadraticCurveTo(0, 0, -s.r * 1.45, 0);
      ctx.quadraticCurveTo(0, 0, 0, -s.r * 1.45);
      ctx.fill();
      ctx.restore();
    }

    // Subtle rising helix rails flanking the central data beam
    ctx.save();
    for (let y = 210; y >= 158; y -= 8) {
      const prog = (210 - y) / 52;
      const phase = prog * Math.PI * 2 - t * 3.1;
      const amp = 15 * Math.sin(prog * Math.PI);
      const x1 = 300 + Math.sin(phase) * amp;
      const x2 = 300 - Math.sin(phase) * amp;
      ctx.strokeStyle = `rgba(148,163,184,${0.32 * Math.sin(prog * Math.PI)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();

      ctx.fillStyle = pal.electron;
      ctx.beginPath();
      ctx.arc(x1, y, 1.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.proton;
      ctx.beginPath();
      ctx.arc(x2, y, 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Layer 3: Silver Ring-Stand Pedestal, Live Pressure Manometer, Condenser & Test Tubes
  // ---------------------------------------------------------------------------
  private drawLabApparatusAndManometer(
    ctx: CanvasRenderingContext2D,
    t: number,
    snap: ComputeSnapshot
  ) {
    const pal = this.traits.palette;

    ctx.save();

    // Soft glass contact shadow under the atelier bench
    const sh = ctx.createRadialGradient(300, 456, 15, 300, 456, 205);
    sh.addColorStop(0, "rgba(100, 116, 139, 0.2)");
    sh.addColorStop(0.7, "rgba(148, 163, 184, 0.08)");
    sh.addColorStop(1, "rgba(148, 163, 184, 0)");
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.ellipse(300, 456, 205, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sleek sterling-silver workbench & magnetic levitation emitter pad under flask
    const shelf = ctx.createLinearGradient(70, 448, 530, 448);
    shelf.addColorStop(0, "rgba(148,163,184,0)");
    shelf.addColorStop(0.18, "rgba(148,163,184,0.58)");
    shelf.addColorStop(0.5, "rgba(71,85,105,0.78)");
    shelf.addColorStop(0.82, "rgba(148,163,184,0.58)");
    shelf.addColorStop(1, "rgba(148,163,184,0)");
    ctx.strokeStyle = shelf;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(70, 448);
    ctx.lineTo(530, 448);
    ctx.stroke();

    // Glowing silver-brass heating/levitation coil pad directly under the vessel
    ctx.beginPath();
    ctx.roundRect(236, 440, 128, 9, 5);
    ctx.fillStyle = "rgba(241, 245, 249, 0.92)";
    ctx.fill();
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Pulsing magnetic induction glow on pad
    ctx.beginPath();
    ctx.roundRect(256, 443, 88, 3, 2);
    ctx.fillStyle = snap.active ? pal.electron : "#94a3b8";
    ctx.globalAlpha = 0.55 + Math.sin(t * 4) * 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Retort Support Mast + Precision Live Compute Manometer Gauge (upper-right)
    const gaugeX = 486;
    const gaugeY = 104;
    ctx.save();
    ctx.beginPath();
    ctx.arc(gaugeX, gaugeY, 26, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
    ctx.fill();
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Gauge ticks
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      ctx.beginPath();
      ctx.moveTo(gaugeX + Math.cos(a) * 18, gaugeY + Math.sin(a) * 18);
      ctx.lineTo(gaugeX + Math.cos(a) * 23, gaugeY + Math.sin(a) * 23);
      ctx.strokeStyle = i >= 8 ? pal.proton : "#94a3b8";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Live kinetic manometer needle driven by real work-unit progress & excitement!
    const needleAngle =
      Math.PI * 0.75 +
      (0.2 + snap.workUnitProgress * 0.65 + Math.sin(t * 7) * 0.04 + this.discoveryFlash * 0.14) *
        Math.PI *
        1.5;
    ctx.beginPath();
    ctx.moveTo(gaugeX, gaugeY);
    ctx.lineTo(gaugeX + Math.cos(needleAngle) * 18, gaugeY + Math.sin(needleAngle) * 18);
    ctx.strokeStyle = pal.proton;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(gaugeX, gaugeY, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = "#334155";
    ctx.fill();
    ctx.restore();

    // Coiled Glass Liebig Condenser Tube(s) carrying luminous droplets!
    // Tier 1 ($1) already has a graceful condenser; Tier 2+ ($5+) upgrades to symmetrical DUAL condensers!
    const primarySide = this.traits.sub.companionSide === "right" ? -1 : 1;
    const condenserSides = this.impact.complexityTier >= 2 ? [-1, 1] : [primarySide];
    for (const side of condenserSides) {
      ctx.save();
      ctx.strokeStyle = "rgba(100, 116, 139, 0.52)";
      ctx.lineWidth = 6.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(300 + side * 24, 212);
      ctx.bezierCurveTo(
        300 + side * 108,
        188,
        300 + side * 134,
        250,
        300 + side * 116,
        318
      );
      ctx.stroke();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 2.6;
      ctx.stroke();

      for (let d = 0; d < 2; d++) {
        const u = (t * 0.42 + d * 0.5 + (side === 1 ? 0.25 : 0)) % 1;
        const p0x = 300 + side * 24;
        const p0y = 212;
        const p1x = 300 + side * 108;
        const p1y = 188;
        const p2x = 300 + side * 134;
        const p2y = 250;
        const p3x = 300 + side * 116;
        const p3y = 318;
        const inv = 1 - u;
        const dx =
          inv * inv * inv * p0x +
          3 * inv * inv * u * p1x +
          3 * inv * u * u * p2x +
          u * u * u * p3x;
        const dy =
          inv * inv * inv * p0y +
          3 * inv * inv * u * p1y +
          3 * inv * u * u * p2y +
          u * u * u * p3y;

        ctx.beginPath();
        ctx.arc(dx, dy, 4.3, 0, Math.PI * 2);
        ctx.fillStyle = d === 0 ? pal.liquidTop : pal.accent;
        ctx.fill();
      }
      ctx.restore();
    }

    // Detailed Miniature Reagent Test-Tube Rack on opposite side of companion
    if (this.traits.familiar.species !== "Duo") {
      const rackX = this.traits.sub.companionSide === "right" ? 124 : 476;
      // Silver rack bars
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rackX - 36, 446);
      ctx.lineTo(rackX + 36, 446);
      ctx.moveTo(rackX - 32, 396);
      ctx.lineTo(rackX + 32, 396);
      ctx.moveTo(rackX - 30, 396);
      ctx.lineTo(rackX - 30, 446);
      ctx.moveTo(rackX + 30, 396);
      ctx.lineTo(rackX + 30, 446);
      ctx.stroke();

      const heights = [68, 82, 60];
      const colors = [pal.accent, pal.electron, pal.proton];
      for (let i = 0; i < 3; i++) {
        const vx = rackX + (i - 1) * 20;
        const vh = heights[i];
        const vy = 444 - vh;
        const fillH = vh * (0.38 + ((Math.sin(t * 1.4 + i * 2) + 1) * 0.1 + this.displayFill * 0.35));

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(vx - 7.5, vy, 15, vh, [2, 2, 8, 8]);
        ctx.fillStyle = "rgba(255,255,255,0.68)";
        ctx.fill();

        ctx.save();
        ctx.clip();
        ctx.fillStyle = colors[i] + "cc";
        ctx.fillRect(vx - 8, vy + vh - fillH + Math.sin(t * 3 + i) * 1.5, 16, fillH + 4);
        // Tiny rising vial bubble
        const by = vy + vh - ((t * 18 + i * 19) % Math.max(10, fillH));
        ctx.beginPath();
        ctx.arc(vx + Math.sin(t * 3 + i) * 2, by, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(vx - 10, vy);
        ctx.lineTo(vx + 10, vy);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Layer 4: Hero Alchemical Glass Vessel + Live Rising Liquid + Glowing Nucleus
  // ---------------------------------------------------------------------------
  private traceVesselPath(ctx: CanvasRenderingContext2D, idx: number) {
    ctx.beginPath();
    if (idx === 0) {
      ctx.moveTo(274, 186);
      ctx.lineTo(326, 186);
      ctx.lineTo(326, 250);
      ctx.lineTo(402, 404);
      ctx.quadraticCurveTo(412, 434, 378, 434);
      ctx.lineTo(222, 434);
      ctx.quadraticCurveTo(188, 434, 198, 404);
      ctx.lineTo(274, 250);
      ctx.closePath();
    } else if (idx === 1) {
      ctx.moveTo(276, 184);
      ctx.lineTo(324, 184);
      ctx.lineTo(324, 254);
      ctx.bezierCurveTo(408, 270, 416, 414, 336, 434);
      ctx.lineTo(264, 434);
      ctx.bezierCurveTo(184, 414, 192, 270, 276, 254);
      ctx.closePath();
    } else if (idx === 2) {
      ctx.moveTo(248, 196);
      ctx.lineTo(352, 196);
      ctx.lineTo(380, 366);
      ctx.lineTo(334, 434);
      ctx.lineTo(266, 434);
      ctx.lineTo(220, 366);
      ctx.closePath();
    } else if (idx === 3) {
      ctx.moveTo(278, 182);
      ctx.lineTo(322, 182);
      ctx.lineTo(322, 236);
      ctx.bezierCurveTo(376, 252, 384, 312, 344, 336);
      ctx.bezierCurveTo(396, 364, 384, 434, 326, 434);
      ctx.lineTo(274, 434);
      ctx.bezierCurveTo(216, 434, 204, 364, 256, 336);
      ctx.bezierCurveTo(216, 312, 224, 252, 278, 236);
      ctx.closePath();
    } else {
      ctx.moveTo(282, 178);
      ctx.lineTo(318, 178);
      ctx.lineTo(318, 234);
      ctx.lineTo(364, 290);
      ctx.lineTo(338, 326);
      ctx.lineTo(394, 404);
      ctx.quadraticCurveTo(402, 434, 370, 434);
      ctx.lineTo(230, 434);
      ctx.quadraticCurveTo(198, 434, 206, 404);
      ctx.lineTo(262, 326);
      ctx.lineTo(236, 290);
      ctx.lineTo(282, 234);
      ctx.closePath();
    }
  }

  private drawHeroVessel(ctx: CanvasRenderingContext2D, t: number) {
    const pal = this.traits.palette;
    const vIdx = this.traits.vesselIdx;
    const hoverY = Math.sin(t * 1.45) * 3;

    ctx.save();
    ctx.translate(300, 318 + hoverY);
    ctx.scale(this.traits.sub.vesselScale, this.traits.sub.vesselScale);
    ctx.translate(-300, -318);

    // 1. Double-walled luminous glass shell backdrop
    this.traceVesselPath(ctx, vIdx);
    const glassBack = ctx.createLinearGradient(200, 180, 400, 436);
    glassBack.addColorStop(0, "rgba(255, 255, 255, 0.84)");
    glassBack.addColorStop(0.5, "rgba(241, 245, 251, 0.48)");
    glassBack.addColorStop(1, "rgba(220, 228, 242, 0.65)");
    ctx.fillStyle = glassBack;
    ctx.fill();

    // 2. Clipped Live Impact Elixir + Meniscus + Rising Bubbles + Glowing Atomic Core
    ctx.save();
    this.traceVesselPath(ctx, vIdx);
    ctx.clip();

    const liquidTopY = 432 - this.displayFill * 192;
    const tiltOffset = this.sloshTilt * 85;
    const waveAmp = 5 + this.impact.reactionStage * 1.15 + this.excitement * 6.5;

    // Back translucent meniscus depth wave
    ctx.beginPath();
    ctx.moveTo(175, 450);
    for (let x = 175; x <= 425; x += 8) {
      const nx = (x - 300) / 110;
      const y =
        liquidTopY -
        4 +
        nx * tiltOffset * 0.7 +
        Math.sin(x * 0.032 - t * 2.6 + 1.2) * waveAmp * 0.7;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(425, 450);
    ctx.closePath();
    ctx.fillStyle = pal.liquidTop + "88";
    ctx.fill();

    // Primary jewel elixir body
    const liqGrad = ctx.createLinearGradient(300, liquidTopY - 10, 300, 436);
    liqGrad.addColorStop(0, pal.liquidTop);
    liqGrad.addColorStop(0.45, pal.liquidMid);
    liqGrad.addColorStop(1, pal.liquidBottom);

    ctx.beginPath();
    ctx.moveTo(175, 450);
    for (let x = 175; x <= 425; x += 6) {
      const nx = (x - 300) / 110;
      const y =
        liquidTopY +
        nx * tiltOffset +
        Math.sin(x * 0.038 + t * 3.1) * waveAmp +
        Math.cos(x * 0.068 - t * 2.1) * (waveAmp * 0.35);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(425, 450);
    ctx.closePath();
    ctx.fillStyle = liqGrad;
    ctx.fill();

    // Internal caustic shimmer waves inside elixir
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(
      300 + Math.sin(t * 1.3) * 18,
      liquidTopY + 56,
      54,
      14,
      Math.sin(t * 0.8) * 0.15,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    // Crisp glossy meniscus surface line
    ctx.beginPath();
    for (let x = 185; x <= 415; x += 6) {
      const nx = (x - 300) / 110;
      const y =
        liquidTopY +
        nx * tiltOffset +
        Math.sin(x * 0.038 + t * 3.1) * waveAmp +
        Math.cos(x * 0.068 - t * 2.1) * (waveAmp * 0.35);
      if (x === 185) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Rising effervescent luminous bubbles
    for (const b of this.bubbles) {
      const bx = b.x + Math.sin(t * 2.4 + b.phase) * b.wobble;
      if (b.y > liquidTopY + 2) {
        ctx.beginPath();
        ctx.arc(bx, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.38)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.76)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(bx - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
        ctx.fill();
      }
    }

    // Glowing Atomic Nucleus pulsing inside the vessel heart
    const coreY = Math.min(374, Math.max(298, liquidTopY + 42));
    this.drawAtomicNucleus(ctx, 300, coreY, t);

    ctx.restore(); // end vessel clip

    // 3. Precision Etched Volumetric Milliliter Scale
    ctx.save();
    ctx.strokeStyle = "rgba(71, 85, 105, 0.48)";
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 7; i++) {
      const ty = 282 + i * 22;
      const len = i % 2 === 0 ? 22 : 11;
      ctx.beginPath();
      ctx.moveTo(300 - len * 0.5, ty);
      ctx.lineTo(300 + len * 0.5, ty);
      ctx.stroke();
    }
    ctx.restore();

    // 4. Multi-Layer Specular Glass Reflections
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.lineWidth = 5.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(260, 274);
    ctx.quadraticCurveTo(234, 340, 224, 394);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.62)";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(348, 286);
    ctx.quadraticCurveTo(368, 336, 376, 386);
    ctx.stroke();
    ctx.restore();

    // 5. Metallic Sterling-Silver Flask Contour, Neck Clamp & Flared Lip
    this.traceVesselPath(ctx, vIdx);
    const rimGrad = ctx.createLinearGradient(200, 175, 400, 436);
    rimGrad.addColorStop(0, "#94a3b8");
    rimGrad.addColorStop(0.5, "#334155");
    rimGrad.addColorStop(1, "#94a3b8");
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // Precision Neck Clamp Ring
    const neckY = vIdx === 2 ? 214 : 216;
    ctx.beginPath();
    ctx.roundRect(270, neckY, 60, 9, 4);
    ctx.fillStyle = "rgba(226, 232, 240, 0.92)";
    ctx.fill();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.6;
    ctx.stroke();

    const lipY = vIdx === 2 ? 196 : vIdx === 4 ? 178 : vIdx === 3 ? 182 : 185;
    const lipHalf = vIdx === 2 ? 58 : 30;
    ctx.beginPath();
    ctx.roundRect(300 - lipHalf, lipY - 5, lipHalf * 2, 10, 5);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fill();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  private drawAtomicNucleus(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number) {
    const pal = this.traits.palette;
    const energy = 1 + this.impact.reactionStage * 0.25 + this.excitement * 1.3;

    ctx.save();
    ctx.translate(cx, cy);

    const aura = ctx.createRadialGradient(0, 0, 2, 0, 0, 44);
    aura.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    aura.addColorStop(0.45, pal.liquidTop + "66");
    aura.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.fill();

    for (const np of this.nucleusParticles) {
      const vib = 1.6 * energy;
      const px = Math.cos(np.angle + t * 0.95) * np.dist + Math.sin(t * 5.2 + np.phase) * vib;
      const py = Math.sin(np.angle + t * 0.95) * np.dist + Math.cos(t * 4.8 + np.phase) * vib;

      const sg = ctx.createRadialGradient(px - 2, py - 2, 1, px, py, np.size);
      if (np.isProton) {
        sg.addColorStop(0, "#ffffff");
        sg.addColorStop(0.35, pal.proton);
        sg.addColorStop(1, "#9f1239");
      } else {
        sg.addColorStop(0, "#ffffff");
        sg.addColorStop(0.55, "#cbd5e1");
        sg.addColorStop(1, "#64748b");
      }

      ctx.beginPath();
      ctx.arc(px, py, np.size, 0, Math.PI * 2);
      ctx.fillStyle = sg;
      ctx.fill();

      if (np.isProton) {
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(px - 2.6, py);
        ctx.lineTo(px + 2.6, py);
        ctx.moveTo(px, py - 2.6);
        ctx.lineTo(px, py + 2.6);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Layer 4B: Live Proton Compute Stream Rising From Flask -> Folding Chamber
  // ---------------------------------------------------------------------------
  private drawProtonComputeStream(
    ctx: CanvasRenderingContext2D,
    t: number,
    snap: ComputeSnapshot
  ) {
    if (!snap.active) return;
    const pal = this.traits.palette;

    ctx.save();
    // Subtle magnetic containment guide beam
    const beam = ctx.createLinearGradient(300, 195, 300, 120);
    beam.addColorStop(0, pal.liquidTop + "44");
    beam.addColorStop(0.5, pal.electron + "33");
    beam.addColorStop(1, pal.accent + "44");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(286, 186);
    ctx.lineTo(314, 186);
    ctx.lineTo(334, 126);
    ctx.lineTo(266, 126);
    ctx.closePath();
    ctx.fill();

    // Glowing data packets rising up the beam into the live molecule
    for (const pkt of this.dataPackets) {
      const y = 212 - pkt.t * 96;
      const x = 300 + Math.sin(pkt.t * Math.PI * 3 + t * 4) * (10 * (1 - pkt.t * 0.4));
      ctx.beginPath();
      ctx.arc(x, y, pkt.size, 0, Math.PI * 2);
      ctx.fillStyle = pkt.hue;
      ctx.globalAlpha = Math.sin(pkt.t * Math.PI);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Layer 4C: REAL-TIME 3D-Projected Live Protein Folding / Catalyst Mining Chamber!
  // ---------------------------------------------------------------------------
  private drawLiveProteinFoldingChamber(
    ctx: CanvasRenderingContext2D,
    t: number,
    snap: ComputeSnapshot
  ) {
    const pal = this.traits.palette;
    const cx = 300;
    const cy = 114;

    ctx.save();
    ctx.translate(cx, cy);

    // Levitating frosted magnetic containment halo & Work-Unit progress arc!
    const haloR = 54;
    ctx.beginPath();
    ctx.arc(0, 0, haloR, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.62 + this.discoveryFlash * 0.25})`;
    ctx.fill();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.36)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Active Work-Unit progress ring wrapping around the folding chamber
    ctx.beginPath();
    ctx.arc(0, 0, haloR + 4, -Math.PI / 2, -Math.PI / 2 + snap.workUnitProgress * Math.PI * 2);
    ctx.strokeStyle = this.discoveryFlash > 0.1 ? pal.accent : pal.electron;
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.stroke();

    // Tier 2+ ($5+): Golden-silver Harmonic Gyroscope Rings encircling the folding chamber
    if (this.impact.complexityTier >= 2) {
      ctx.save();
      ctx.rotate(t * 0.9);
      ctx.beginPath();
      ctx.ellipse(0, 0, haloR + 14, haloR * 0.42, 0.35, 0, Math.PI * 2);
      ctx.strokeStyle = pal.accent + "77";
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.rotate(-t * 1.6);
      ctx.beginPath();
      ctx.ellipse(0, 0, haloR + 14, haloR * 0.42, -0.5, 0, Math.PI * 2);
      ctx.strokeStyle = pal.electron + "77";
      ctx.stroke();
      ctx.restore();
    }

    // Discovery flash halo ring
    if (this.discoveryFlash > 0.02) {
      ctx.beginPath();
      ctx.arc(0, 0, haloR + (1 - this.discoveryFlash) * 24, 0, Math.PI * 2);
      ctx.strokeStyle = pal.accent;
      ctx.globalAlpha = this.discoveryFlash * 0.75;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 3D-Project the LIVE amino-acid / molecular chain straight from ResearchComputeEngine!
    const rotY = t * 0.75;
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);

    const projected = snap.residues.map((r, i) => {
      const rx = r.x * cosY - r.z * sinY;
      const rz = r.x * sinY + r.z * cosY;
      const persp = 120 / (120 + rz);
      return {
        idx: i,
        sx: rx * persp * 0.92,
        sy: r.y * persp * 0.92,
        z: rz,
        scale: persp,
        hydrophobic: r.hydrophobic
      };
    });

    // Draw covalent backbone bonds + glowing hydrogen/hydrophobic interaction dashes
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(71, 85, 105, 0.52)";
    ctx.beginPath();
    projected.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.sx, p.sy);
      else ctx.lineTo(p.sx, p.sy);
    });
    ctx.stroke();

    // Hydrophobic non-bonded folding attraction lines (shows real folding contacts!)
    ctx.save();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = pal.liquidMid + "77";
    ctx.lineWidth = 1;
    for (let i = 0; i < projected.length; i++) {
      if (!projected[i].hydrophobic) continue;
      for (let j = i + 3; j < projected.length; j++) {
        if (!projected[j].hydrophobic) continue;
        const d = Math.hypot(projected[i].sx - projected[j].sx, projected[i].sy - projected[j].sy);
        if (d < 26) {
          ctx.beginPath();
          ctx.moveTo(projected[i].sx, projected[i].sy);
          ctx.lineTo(projected[j].sx, projected[j].sy);
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    // Depth-sorted 3D residue spheres
    const sorted = [...projected].sort((a, b) => b.z - a.z);
    for (const p of sorted) {
      const r = (p.hydrophobic ? 4.8 : 3.9) * p.scale;
      const sg = ctx.createRadialGradient(p.sx - 1.2, p.sy - 1.2, 0.6, p.sx, p.sy, r);
      if (p.hydrophobic) {
        sg.addColorStop(0, "#ffffff");
        sg.addColorStop(0.45, pal.proton);
        sg.addColorStop(1, pal.liquidBottom);
      } else {
        sg.addColorStop(0, "#ffffff");
        sg.addColorStop(0.5, pal.electron);
        sg.addColorStop(1, "#475569");
      }
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Layer 5: 3D Elliptical Electron Orbitals & Luminous Trails
  // ---------------------------------------------------------------------------
  private drawOrbitals(ctx: CanvasRenderingContext2D, t: number, pass: "back" | "front") {
    const pal = this.traits.palette;
    const tierExtra = this.impact.complexityTier >= 3 ? this.impact.complexityTier - 2 : 0;
    const count = Math.min(6, this.traits.sub.orbitalCount + tierExtra);
    const cx = 300;
    const cy = 324;
    const speedMult =
      1 +
      (this.impact.reactionStage - 1) * 0.16 +
      (this.compute.isActive() ? 0.2 : 0) +
      this.excitement * 0.85;

    for (let i = 0; i < count; i++) {
      const tilt = (i * Math.PI) / count - 0.42 + this.traits.sub.astrolabeTilt * 0.6;
      const rx = 152 + (i % 2) * 32;
      const ry = 48 + (i % 3) * 14;
      const startAngle = pass === "back" ? Math.PI : 0;
      const endAngle = pass === "back" ? Math.PI * 2 : Math.PI;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);

      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, startAngle, endAngle);
      ctx.strokeStyle =
        pass === "front"
          ? i % 2 === 0
            ? pal.electron + "aa"
            : pal.silverInk + "aa"
          : "rgba(148, 163, 184, 0.32)";
      ctx.lineWidth = pass === "front" ? 1.65 : 1.1;
      ctx.stroke();

      const electronsOnRing = i === 0 ? 2 : 1;
      for (let e = 0; e < electronsOnRing; e++) {
        const angle = (t * (1.2 + i * 0.28) * speedMult + i * 2.1 + e * Math.PI) % (Math.PI * 2);
        const isFront = Math.sin(angle) >= 0;
        if ((pass === "front") !== isFront) continue;

        for (let step = 7; step >= 1; step--) {
          const ta = angle - step * 0.08;
          const tx = Math.cos(ta) * rx;
          const ty = Math.sin(ta) * ry;
          ctx.beginPath();
          ctx.arc(tx, ty, 4.2 * (1 - step / 9), 0, Math.PI * 2);
          ctx.fillStyle = i % 2 === 0 ? pal.electron : pal.accent;
          ctx.globalAlpha = (1 - step / 8) * 0.42;
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        const ex = Math.cos(angle) * rx;
        const ey = Math.sin(angle) * ry;
        const eg = ctx.createRadialGradient(ex, ey, 1, ex, ey, 12);
        eg.addColorStop(0, "#ffffff");
        eg.addColorStop(0.4, i % 2 === 0 ? pal.electron : pal.accent);
        eg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = eg;
        ctx.beginPath();
        ctx.arc(ex, ey, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(ex, ey, 4.4, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = i % 2 === 0 ? pal.electron : pal.accent;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // ---------------------------------------------------------------------------
  // Layer 5B: Catalytic Lightning Filaments
  // ---------------------------------------------------------------------------
  private drawCatalyticArcs(ctx: CanvasRenderingContext2D, t: number) {
    const activeIntensity =
      this.excitement > 0.15 || this.discoveryFlash > 0.15
        ? Math.max(this.excitement, this.discoveryFlash)
        : this.compute.isActive()
          ? 0.28
          : 0;
    if (activeIntensity <= 0.05) return;

    const pal = this.traits.palette;
    const arcCount = this.excitement > 0.3 || this.discoveryFlash > 0.3 ? 4 : 2;
    ctx.save();
    for (let i = 0; i < arcCount; i++) {
      if (Math.sin(t * 17 + i * 7.3) < 0.25) continue;

      const a = t * 0.9 + (i * Math.PI * 2) / arcCount;
      const x1 = 300 + Math.cos(a) * 44;
      const y1 = 328 + Math.sin(a) * 32;
      const x2 = 300 + Math.cos(a + 0.5) * 145;
      const y2 = 312 + Math.sin(a + 0.5) * 115;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      for (let s = 1; s < 6; s++) {
        const u = s / 6;
        const jx = Math.sin(t * 33 + s * 4.1 + i) * 14 * Math.sin(u * Math.PI);
        const jy = Math.cos(t * 29 + s * 3.7 + i) * 14 * Math.sin(u * Math.PI);
        ctx.lineTo(x1 + (x2 - x1) * u + jx, y1 + (y2 - y1) * u + jy);
      }
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = i % 2 === 0 ? pal.electron : pal.accent;
      ctx.globalAlpha = Math.min(0.85, activeIntensity * 0.68);
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Layer 5C: Free-Floating Mini Atoms & Glowing Protons (+)
  // ---------------------------------------------------------------------------
  private drawFloatingAtomsAndProtons(ctx: CanvasRenderingContext2D, t: number) {
    const pal = this.traits.palette;
    const ptrX = this.pointerX * 600;
    const ptrY = this.pointerY * 600;

    const coords: Array<{ x: number; y: number; fa: FloatingAtom }> = [];
    for (const fa of this.floatingAtoms) {
      let x = fa.baseX + Math.sin(t * fa.speed + fa.phase) * 13;
      let y = fa.baseY + Math.cos(t * fa.speed * 0.85 + fa.phase) * 11;

      if (this.pointerActive) {
        const dx = ptrX - x;
        const dy = ptrY - y;
        const d = Math.hypot(dx, dy);
        if (d < 160 && d > 1) {
          const pull = (1 - d / 160) * 18;
          x += (dx / d) * pull;
          y += (dy / d) * pull;
        }
      }
      coords.push({ x, y, fa });
    }

    // Tier 3+ ($25+): Crystalline Quantum Constellation Web connecting nearby floating atoms
    if (this.impact.complexityTier >= 3) {
      ctx.save();
      ctx.strokeStyle = pal.electron + "44";
      ctx.lineWidth = 1;
      for (let i = 0; i < coords.length; i++) {
        for (let j = i + 1; j < coords.length; j++) {
          const d = Math.hypot(coords[i].x - coords[j].x, coords[i].y - coords[j].y);
          if (d < 175) {
            ctx.globalAlpha = (1 - d / 175) * 0.65;
            ctx.beginPath();
            ctx.moveTo(coords[i].x, coords[i].y);
            ctx.lineTo(coords[j].x, coords[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }

    for (const { x, y, fa } of coords) {

      ctx.save();
      ctx.translate(x, y);

      if (fa.isProton) {
        const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, fa.radius);
        g.addColorStop(0, "#ffffff");
        g.addColorStop(0.45, pal.proton);
        g.addColorStop(1, pal.proton + "88");
        ctx.beginPath();
        ctx.arc(0, 0, fa.radius * 0.85, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.88)";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-3.4, 0);
        ctx.lineTo(3.4, 0);
        ctx.moveTo(0, -3.4);
        ctx.lineTo(0, 3.4);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.6;
        ctx.stroke();
      } else {
        ctx.rotate(fa.tilt + t * 0.65);
        ctx.strokeStyle = pal.silverInk + "aa";
        ctx.lineWidth = 1;
        for (let k = 0; k < 2; k++) {
          ctx.save();
          ctx.rotate((k * Math.PI) / 2);
          ctx.beginPath();
          ctx.ellipse(0, 0, fa.radius * 1.45, fa.radius * 0.55, 0, 0, Math.PI * 2);
          ctx.stroke();
          const ea = t * 2.4 + k * 2 + fa.phase;
          ctx.beginPath();
          ctx.arc(Math.cos(ea) * fa.radius * 1.45, Math.sin(ea) * fa.radius * 0.55, 2.2, 0, Math.PI * 2);
          ctx.fillStyle = pal.electron;
          ctx.fill();
          ctx.restore();
        }
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = pal.accent;
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------------------
  // Layer 6: Ultra-Detailed Stylized Animated Cats, Dogs & Harmonic Duo
  // ---------------------------------------------------------------------------
  private drawCompanions(ctx: CanvasRenderingContext2D, t: number) {
    const fam = this.traits.familiar;
    const rightSide = this.traits.sub.companionSide === "right";
    const tier = this.impact.complexityTier;

    // Tier 4+ ($100+) awakens a Harmonic Cat & Dog partnership even on single-familiar seeds!
    if (fam.archetype === "harmonic-duo" || tier >= 4) {
      const dogVariant = fam.species === "Dog" ? fam.archetype : "shiba-dog";
      const catVariant = fam.species === "Cat" ? fam.archetype : "tuxedo-cat";
      this.drawStylizedDog(ctx, 132, 446, t, dogVariant, 1);
      this.drawStylizedCat(ctx, 468, 446, t, catVariant, -1);
      return;
    }

    const cx = rightSide ? 458 : 142;
    const facing = rightSide ? -1 : 1;

    if (fam.species === "Cat") {
      this.drawStylizedCat(ctx, cx, 447, t, fam.archetype, facing);
    } else {
      this.drawStylizedDog(ctx, cx, 447, t, fam.archetype, facing);
    }
  }

  // ---------------------------------------------------------------------------
  // Tier 3+ ($25+): Celestial Orrery (Orbiting Ringed Planet, Moon & Satellites)
  // ---------------------------------------------------------------------------
  private drawCelestialOrrery(ctx: CanvasRenderingContext2D, t: number) {
    const pal = this.traits.palette;
    ctx.save();
    ctx.translate(300, 314);

    // Outer celestial orrery track
    ctx.beginPath();
    ctx.arc(0, 0, 248, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
    ctx.setLineDash([2, 8]);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // Miniature ringed pearl planet orbiting
    const pAngle = t * 0.28 + 0.6;
    const px = Math.cos(pAngle) * 248;
    const py = Math.sin(pAngle) * 248;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-0.4);
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = pal.liquidMid + "cc";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    const pg = ctx.createRadialGradient(-3, -3, 1, 0, 0, 9);
    pg.addColorStop(0, "#ffffff");
    pg.addColorStop(0.5, pal.liquidTop);
    pg.addColorStop(1, pal.liquidBottom);
    ctx.beginPath();
    ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.restore();

    // Silver crescent moon orbiting on opposite phase
    const mAngle = -t * 0.34 + 3.4;
    const mx = Math.cos(mAngle) * 238;
    const my = Math.sin(mAngle) * 238;
    ctx.save();
    ctx.translate(mx, my);
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0.3, Math.PI * 1.85);
    ctx.fillStyle = "#cbd5e1";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3, -1.5, 6, 0, Math.PI * 2);
    ctx.fillStyle = pal.bgTop;
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Tier 4+ ($100+): Twin Symmetrical Levitating Micro-Alembic Reactors
  // ---------------------------------------------------------------------------
  private drawTwinLevitatingAlembics(ctx: CanvasRenderingContext2D, t: number) {
    const pal = this.traits.palette;
    for (const side of [-1, 1]) {
      const fx = 300 + side * 172;
      const fy = 228 + Math.sin(t * 2.1 + side) * 7;

      ctx.save();
      ctx.translate(fx, fy);

      // Luminous plasma tether arc feeding straight into the central flask!
      ctx.beginPath();
      ctx.moveTo(-side * 16, 4);
      ctx.quadraticCurveTo(-side * 78, -22 + Math.sin(t * 3.5 + side) * 8, -side * 136, 42);
      ctx.strokeStyle = side === -1 ? pal.electron + "77" : pal.accent + "77";
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Floating micro-orb flask
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fill();

      ctx.save();
      ctx.clip();
      const lg = ctx.createLinearGradient(0, -4, 0, 20);
      lg.addColorStop(0, side === -1 ? pal.electron : pal.accent);
      lg.addColorStop(1, pal.liquidBottom);
      ctx.fillStyle = lg;
      ctx.fillRect(-22, -2 + Math.sin(t * 3 + side) * 2.5, 44, 26);
      ctx.restore();

      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Tiny levitating silver ring below micro-orb
      ctx.beginPath();
      ctx.ellipse(0, 27, 14, 3.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(100,116,139,0.55)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.restore();
    }
  }

  // ---------------------------------------------------------------------------
  // Tier 5 ($500+): 4D-Projected Rotating Crystalline Tesseract & Opal Aurora
  // ---------------------------------------------------------------------------
  private drawAuroraAndHypercube4D(ctx: CanvasRenderingContext2D, t: number) {
    const pal = this.traits.palette;

    // Soft iridescent opal aurora wave ribbons behind everything
    ctx.save();
    for (let r = 0; r < 2; r++) {
      const grad = ctx.createLinearGradient(40, 120 + r * 140, 560, 280 + r * 140);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.32, (r === 0 ? pal.liquidTop : pal.accent) + "33");
      grad.addColorStop(0.68, (r === 0 ? pal.electron : pal.proton) + "2d");
      grad.addColorStop(1, "rgba(255,255,255,0)");

      ctx.beginPath();
      ctx.moveTo(20, 180 + r * 150);
      for (let x = 20; x <= 580; x += 20) {
        const y =
          170 +
          r * 165 +
          Math.sin(x * 0.014 + t * (0.9 + r * 0.35)) * 26 +
          Math.cos(x * 0.022 - t * 0.7) * 14;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = grad;
      ctx.lineWidth = 34;
      ctx.lineCap = "round";
      ctx.stroke();
    }
    ctx.restore();

    // True 4D -> 3D -> 2D Projected Rotating Hypercube (Tesseract) in filigree silver-gold!
    ctx.save();
    ctx.translate(300, 314);
    const verts: Array<[number, number, number, number]> = [];
    for (let i = 0; i < 16; i++) {
      verts.push([
        i & 1 ? 1 : -1,
        i & 2 ? 1 : -1,
        i & 4 ? 1 : -1,
        i & 8 ? 1 : -1
      ]);
    }

    const a1 = t * 0.34;
    const a2 = t * 0.23;
    const c1 = Math.cos(a1);
    const s1 = Math.sin(a1);
    const c2 = Math.cos(a2);
    const s2 = Math.sin(a2);

    const pts2d = verts.map(([x, y, z, w]) => {
      // Rotate XW plane
      const x1 = x * c1 - w * s1;
      const w1 = x * s1 + w * c1;
      // Rotate YZ plane
      const y1 = y * c2 - z * s2;
      const z1 = y * s2 + z * c2;
      // 4D -> 3D perspective
      const p4 = 1.9 / (2.7 - w1);
      const x3 = x1 * p4;
      const y3 = y1 * p4;
      const z3 = z1 * p4;
      // 3D -> 2D perspective
      const p3 = 185 / (2.9 - z3 * 0.65);
      return { x: x3 * p3, y: y3 * p3 };
    });

    ctx.strokeStyle = pal.liquidMid + "38";
    ctx.lineWidth = 1.15;
    for (let i = 0; i < 16; i++) {
      for (let bit = 0; bit < 4; bit++) {
        const j = i ^ (1 << bit);
        if (j > i) {
          ctx.beginPath();
          ctx.moveTo(pts2d[i].x, pts2d[i].y);
          ctx.lineTo(pts2d[j].x, pts2d[j].y);
          ctx.stroke();
        }
      }
    }
    for (const p of pts2d) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = pal.accent + "88";
      ctx.fill();
    }
    ctx.restore();
  }

  private drawStylizedCat(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    t: number,
    variant: string,
    facing: 1 | -1
  ) {
    const pal = this.traits.palette;
    const breath = Math.sin(t * 2.3) * 1.8;
    const excitedHop = this.excitement > 0.08 ? Math.abs(Math.sin(t * 9)) * 9 * this.excitement : 0;
    const isBlinking = Math.sin(t * 0.85) > 0.965;
    const earTwitch = Math.sin(t * 3.7) > 0.9 ? 0.14 : 0;

    const bodyFill =
      variant === "siamese-cat"
        ? "#f1ede7"
        : variant === "calico-kitten"
          ? "#fbfaf7"
          : "#252b38";
    const accentFill =
      variant === "siamese-cat"
        ? "#4a4e69"
        : variant === "calico-kitten"
          ? pal.proton
          : "#f8fafc";
    const strokeCol = "#262e3d";

    ctx.save();
    ctx.translate(x, baseY - excitedHop);
    ctx.scale(facing, 1);

    ctx.fillStyle = "rgba(100, 116, 139, 0.16)";
    ctx.beginPath();
    ctx.ellipse(0, 2, 42, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Articulated swaying tail
    const tailSway = Math.sin(t * (2.0 + this.excitement * 4)) * 14;
    ctx.save();
    ctx.strokeStyle = variant === "siamese-cat" ? accentFill : bodyFill;
    ctx.lineWidth = 9.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-22, -10);
    ctx.bezierCurveTo(-56, -18, -64 + tailSway, -66, -40 + tailSway * 0.7, -84);
    ctx.stroke();
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();

    // Sculpted seated body with soft specular rim shading
    ctx.beginPath();
    ctx.moveTo(-28, 0);
    ctx.bezierCurveTo(-34, -36, -24, -68 + breath, -8, -74 + breath);
    ctx.lineTo(14, -74 + breath);
    ctx.bezierCurveTo(30, -64 + breath, 32, -28, 24, 0);
    ctx.closePath();
    ctx.fillStyle = bodyFill;
    ctx.fill();
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (variant === "tuxedo-cat") {
      ctx.beginPath();
      ctx.ellipse(8, -32 + breath, 12, 24, 0.1, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    } else if (variant === "calico-kitten") {
      ctx.beginPath();
      ctx.ellipse(-12, -34, 13, 18, -0.3, 0, Math.PI * 2);
      ctx.fillStyle = pal.proton + "cc";
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(10, -18, 11, 12, 0.4, 0, Math.PI * 2);
      ctx.fillStyle = "#475569";
      ctx.fill();
    }

    // Little silver laboratory bow-collar / catalyst gem
    ctx.beginPath();
    ctx.moveTo(-8, -69 + breath);
    ctx.quadraticCurveTo(6, -61 + breath, 19, -69 + breath);
    ctx.strokeStyle = pal.liquidMid;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(8, -62 + breath, 3.8, 0, Math.PI * 2);
    ctx.fillStyle = pal.accent;
    ctx.fill();

    // Raised playful paw batting softly toward floating protons!
    const pawWave = Math.sin(t * (2.6 + this.excitement * 5)) * 10;
    ctx.save();
    ctx.translate(22, -42 + breath);
    ctx.rotate(-0.45 + pawWave * 0.035);
    ctx.beginPath();
    ctx.roundRect(0, -6, 24, 11, 6);
    ctx.fillStyle = variant === "tuxedo-cat" ? "#ffffff" : variant === "siamese-cat" ? accentFill : bodyFill;
    ctx.fill();
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();

    // Expressive Head tracking protons / folding chamber
    const headTilt = Math.sin(t * 1.4) * 0.06 + (this.pointerActive ? (this.pointerY - 0.5) * 0.14 : -0.05);
    ctx.save();
    ctx.translate(4, -84 + breath);
    ctx.rotate(headTilt);

    // Pointed ears with blush lining
    ctx.save();
    ctx.rotate(-earTwitch);
    ctx.beginPath();
    ctx.moveTo(-22, -12);
    ctx.lineTo(-27, -42);
    ctx.lineTo(-4, -24);
    ctx.closePath();
    ctx.fillStyle = variant === "siamese-cat" ? accentFill : bodyFill;
    ctx.fill();
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-20, -16);
    ctx.lineTo(-23, -33);
    ctx.lineTo(-9, -22);
    ctx.closePath();
    ctx.fillStyle = pal.accent + "88";
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(22, -12);
    ctx.lineTo(27, -42);
    ctx.lineTo(4, -24);
    ctx.closePath();
    ctx.fillStyle = variant === "calico-kitten" ? "#475569" : variant === "siamese-cat" ? accentFill : bodyFill;
    ctx.fill();
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(0, -4, 27, 23, 0, 0, Math.PI * 2);
    ctx.fillStyle = bodyFill;
    ctx.fill();
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (variant === "siamese-cat") {
      ctx.beginPath();
      ctx.ellipse(3, -1, 16, 13, 0, 0, Math.PI * 2);
      ctx.fillStyle = accentFill + "d8";
      ctx.fill();
    }

    const lookX = this.pointerActive ? Math.max(-2.4, Math.min(2.4, (this.pointerX - 0.5) * 6 * facing)) : 1.6;
    const lookY = this.pointerActive ? Math.max(-2, Math.min(2, (this.pointerY - 0.5) * 5)) : -1.2;
    for (const [ex, ey] of [
      [-8, -5],
      [11, -5]
    ]) {
      if (isBlinking) {
        ctx.beginPath();
        ctx.moveTo(ex - 5, ey);
        ctx.quadraticCurveTo(ex, ey + 3, ex + 5, ey);
        ctx.strokeStyle = variant === "tuxedo-cat" ? "#ffffff" : strokeCol;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(ex, ey, 5.2, 5.6, 0, 0, Math.PI * 2);
        ctx.fillStyle = pal.electron;
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(ex + lookX * 0.65, ey + lookY * 0.65, 2.3, 3.8, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#0f172a";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex - 1.6, ey - 2, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }
    }

    ctx.fillStyle = pal.proton;
    ctx.beginPath();
    ctx.moveTo(1, 2);
    ctx.lineTo(5, 2);
    ctx.lineTo(3, 5);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = variant === "tuxedo-cat" ? "rgba(255,255,255,0.68)" : "rgba(71,85,105,0.55)";
    ctx.lineWidth = 1.1;
    for (const wy of [2, 6]) {
      ctx.beginPath();
      ctx.moveTo(18, wy);
      ctx.lineTo(33, wy - 2);
      ctx.moveTo(-16, wy);
      ctx.lineTo(-30, wy - 2);
      ctx.stroke();
    }

    if (variant === "siamese-cat" || this.traits.sub.companionAccessory === "halo") {
      ctx.beginPath();
      ctx.ellipse(0, -45 + Math.sin(t * 2.5) * 2, 19, 5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (this.traits.sub.companionAccessory === "monocle") {
      ctx.beginPath();
      ctx.arc(11, -5, 8.2, 0, Math.PI * 2);
      ctx.strokeStyle = "#d97706";
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    ctx.restore();

    if (this.excitement > 0.15 || this.discoveryFlash > 0.2) {
      ctx.strokeStyle = pal.accent;
      ctx.globalAlpha = Math.min(0.75, Math.max(this.excitement, this.discoveryFlash) * 0.65);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(14, -98, 22 + ((t * 26) % 18), -0.8, 0.8);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  private drawStylizedDog(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    t: number,
    variant: string,
    facing: 1 | -1
  ) {
    const pal = this.traits.palette;
    const breath = Math.sin(t * 2.6) * 1.9;
    const wagSpeed = 6.5 + this.impact.reactionStage * 1.2 + this.excitement * 12;
    const tailWag = Math.sin(t * wagSpeed) * (10 + this.excitement * 9);
    const excitedBounce = this.excitement > 0.08 ? Math.abs(Math.sin(t * 10)) * 10 * this.excitement : 0;
    const isBlinking = Math.sin(t * 0.92 + 1.4) > 0.968;

    const coatMain =
      variant === "sighthound-dog"
        ? "#e2e8f0"
        : variant === "lab-pup"
          ? "#f7f1e5"
          : "#e9b984";
    const coatBelly = variant === "sighthound-dog" ? "#ffffff" : "#fffcf7";
    const strokeCol = "#262e3d";

    ctx.save();
    ctx.translate(x, baseY - excitedBounce);
    ctx.scale(facing, 1);

    ctx.fillStyle = "rgba(100, 116, 139, 0.16)";
    ctx.beginPath();
    ctx.ellipse(0, 2, 46, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wagging tail
    ctx.save();
    ctx.strokeStyle = coatMain;
    ctx.lineWidth = variant === "sighthound-dog" ? 7 : 11;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (variant === "shiba-dog") {
      ctx.moveTo(-26, -14);
      ctx.bezierCurveTo(-56, -24 + tailWag * 0.5, -56 + tailWag, -64, -32 + tailWag * 0.6, -58);
    } else {
      ctx.moveTo(-26, -12);
      ctx.quadraticCurveTo(-54, -26 + tailWag, -44 + tailWag * 0.7, -54 + tailWag * 0.5);
    }
    ctx.stroke();
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();

    const bodyHeight = variant === "sighthound-dog" ? 84 : 74;
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.bezierCurveTo(-36, -34, -24, -bodyHeight + breath, -4, -bodyHeight + breath);
    ctx.lineTo(14, -bodyHeight + breath);
    ctx.bezierCurveTo(32, -bodyHeight * 0.78 + breath, 34, -24, 24, 0);
    ctx.closePath();
    ctx.fillStyle = coatMain;
    ctx.fill();
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(10, -30 + breath, 13, 24, 0.12, 0, Math.PI * 2);
    ctx.fillStyle = coatBelly;
    ctx.fill();

    if (variant === "sighthound-dog") {
      ctx.fillStyle = pal.liquidMid;
      for (const [sx, sy] of [
        [-14, -40],
        [-6, -28],
        [-16, -20]
      ]) {
        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Glowing Flask Collar Pendant
    ctx.beginPath();
    ctx.moveTo(-8, -bodyHeight + 8 + breath);
    ctx.quadraticCurveTo(6, -bodyHeight + 17 + breath, 20, -bodyHeight + 8 + breath);
    ctx.strokeStyle = pal.liquidMid;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(10, -bodyHeight + 18 + breath, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = pal.accent;
    ctx.fill();

    const headTilt = Math.sin(t * 1.9) * 0.07 + (this.pointerActive ? (this.pointerY - 0.5) * 0.14 : -0.05);
    ctx.save();
    ctx.translate(6, -bodyHeight - 10 + breath);
    ctx.rotate(headTilt);

    if (variant === "lab-pup") {
      ctx.beginPath();
      ctx.ellipse(-21, 2, 10, 18, 0.35, 0, Math.PI * 2);
      ctx.fillStyle = "#d8cab4";
      ctx.fill();
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = 1.9;
      ctx.stroke();
    } else if (variant === "sighthound-dog") {
      ctx.beginPath();
      ctx.moveTo(-14, -18);
      ctx.lineTo(-34, -26);
      ctx.lineTo(-18, -4);
      ctx.closePath();
      ctx.fillStyle = "#94a3b8";
      ctx.fill();
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    } else {
      for (const [ex, tipX] of [
        [-18, -24],
        [14, 22]
      ]) {
        ctx.beginPath();
        ctx.moveTo(ex - 7, -14);
        ctx.lineTo(tipX, -40);
        ctx.lineTo(ex + 9, -18);
        ctx.closePath();
        ctx.fillStyle = coatMain;
        ctx.fill();
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    ctx.beginPath();
    ctx.ellipse(0, -4, 26, 22, 0, 0, Math.PI * 2);
    ctx.fillStyle = coatMain;
    ctx.fill();
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 2;
    ctx.stroke();

    const snoutW = variant === "sighthound-dog" ? 21 : 15;
    ctx.beginPath();
    ctx.ellipse(16, 2, snoutW, 11, 0.05, 0, Math.PI * 2);
    ctx.fillStyle = coatBelly;
    ctx.fill();
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(16 + snoutW - 2, -2, 4.5, 3.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#1e293b";
    ctx.fill();

    if (variant === "lab-pup" || this.excitement > 0.18 || this.discoveryFlash > 0.2) {
      ctx.beginPath();
      ctx.ellipse(22, 12, 4.2, 5.5 + Math.sin(t * 10) * 1.2, 0.2, 0, Math.PI * 2);
      ctx.fillStyle = pal.proton;
      ctx.fill();
    }

    const lookX = this.pointerActive ? Math.max(-2, Math.min(2, (this.pointerX - 0.5) * 5 * facing)) : 1.5;
    for (const [ex, ey] of [
      [-4, -7],
      [11, -7]
    ]) {
      if (isBlinking) {
        ctx.beginPath();
        ctx.moveTo(ex - 4, ey);
        ctx.quadraticCurveTo(ex, ey - 3, ex + 4, ey);
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(ex, ey, 4.2, 0, Math.PI * 2);
        ctx.fillStyle = "#1e293b";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex + lookX * 0.4 - 1, ey - 1.5, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }
    }

    // Translucent reflective Alchemist Lab Goggles on forehead
    if (variant === "shiba-dog" || this.traits.sub.companionAccessory === "goggles") {
      ctx.save();
      ctx.translate(2, -20);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-22, 0);
      ctx.lineTo(22, 0);
      ctx.stroke();

      for (const gx of [-9, 9]) {
        ctx.beginPath();
        ctx.arc(gx, 0, 7.2, 0, Math.PI * 2);
        ctx.fillStyle = pal.liquidTop + "bb";
        ctx.fill();
        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(gx - 2, -2, 2, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Layer 7: Real-Time Discovery & Donation Shockwaves + Crystal Bursts
  // ---------------------------------------------------------------------------
  private drawImpactShockwaveAndBursts(ctx: CanvasRenderingContext2D) {
    const pal = this.traits.palette;

    if (this.shockwaveAlpha > 0.01) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(300, 315, this.shockwaveRadius, 0, Math.PI * 2);
      ctx.strokeStyle = pal.liquidTop;
      ctx.globalAlpha = this.shockwaveAlpha;
      ctx.lineWidth = 3.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(300, 315, this.shockwaveRadius * 0.78, 0, Math.PI * 2);
      ctx.strokeStyle = pal.accent;
      ctx.globalAlpha = this.shockwaveAlpha * 0.7;
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.restore();
    }

    for (const p of this.bursts) {
      const fade = Math.max(0, 1 - p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);

      if (p.kind === "heart") {
        ctx.beginPath();
        const s = p.r * 1.1;
        ctx.moveTo(0, s * 0.45);
        ctx.bezierCurveTo(-s, -s * 0.2, -s * 0.6, -s, 0, -s * 0.35);
        ctx.bezierCurveTo(s * 0.6, -s, s, -s * 0.2, 0, s * 0.45);
        ctx.fillStyle = p.color;
        ctx.fill();
      } else if (p.kind === "crystal") {
        const s = p.r * 1.25;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.65, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.65, 0);
        ctx.closePath();
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (p.kind === "proton") {
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-2.5, 0);
        ctx.lineTo(2.5, 0);
        ctx.moveTo(0, -2.5);
        ctx.lineTo(0, 2.5);
        ctx.stroke();
      } else {
        const s = p.r * 1.35;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.quadraticCurveTo(0, 0, s, 0);
        ctx.quadraticCurveTo(0, 0, 0, s);
        ctx.quadraticCurveTo(0, 0, -s, 0);
        ctx.quadraticCurveTo(0, 0, 0, -s);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}
