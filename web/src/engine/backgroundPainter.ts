/**
 * Living Pure-White & Silvery-Grey Background Canvas Painter.
 *
 * Continuously sketches faint, luminous silver-and-opal alchemical art (flasks,
 * orbiting atoms, protons, stylized cat/dog silhouettes, astrolabes) into the
 * pure white background AND turns the user's mouse cursor into a calligraphic
 * silvery-ink & pearlescent watercolor brush that paints living art right into
 * the website!
 */

interface BrushStroke {
  points: Array<{ x: number; y: number; r: number }>;
  hue: number;
  sat: number;
  light: number;
  alpha: number;
  age: number;
  maxAge: number;
  silver: boolean;
}

interface FloatingParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  kind: "proton" | "bubble" | "spark" | "atom";
  hue: number;
  angle: number;
  spin: number;
  age: number;
  maxAge: number;
}

interface LivingSketch {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  kind: "flask" | "atom" | "cat" | "dog" | "astrolabe";
  hue: number;
  age: number;
  maxAge: number;
  drawSpeed: number;
}

interface PaintRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  hue: number;
  age: number;
  maxAge: number;
}

export class AlchemicalBackgroundPainter {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private rafId = 0;
  private lastTime = 0;
  private enabled = true;
  private reducedMotion = false;

  private strokes: BrushStroke[] = [];
  private activeStroke: BrushStroke | null = null;
  private particles: FloatingParticle[] = [];
  private sketches: LivingSketch[] = [];
  private ripples: PaintRipple[] = [];

  private mouseX = -999;
  private mouseY = -999;
  private prevMouseX = -999;
  private prevMouseY = -999;
  private pointerMoving = false;
  private lastMoveTimestamp = 0;
  private ambientTimer = 0;
  private hueClock = 212; // starts in cool silvery-opal blue

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("2D context unavailable");
    this.ctx = context;

    this.reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.resize();
    this.seedInitialSketches();
  }

  public start() {
    this.lastTime = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;
      this.update(dt, now);
      this.render(now);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  public stop() {
    cancelAnimationFrame(this.rafId);
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
    if (!val) {
      this.strokes = [];
      this.particles = [];
      this.ripples = [];
    }
  }

  public clearPaint() {
    this.strokes = [];
    this.activeStroke = null;
    this.particles = [];
    this.ripples = [];
  }

  public resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private pickMarginX(): number {
    const w = Math.max(this.width, 900);
    if (w < 720) {
      return Math.random() < 0.5 ? w * (0.04 + Math.random() * 0.14) : w * (0.82 + Math.random() * 0.14);
    }
    // Keep ambient sketches framing the left & right atelier margins cleanly away from centered hero text
    const safeHalf = Math.min(w * 0.28, 320);
    const leftEdge = Math.max(84, w * 0.5 - safeHalf - 40);
    const rightStart = Math.min(w - 84, w * 0.5 + safeHalf + 40);
    if (Math.random() < 0.5) {
      return 64 + Math.random() * Math.max(40, leftEdge - 64);
    }
    return rightStart + Math.random() * Math.max(40, w - 64 - rightStart);
  }

  private seedInitialSketches() {
    const kinds: LivingSketch["kind"][] = ["flask", "atom", "cat", "dog", "astrolabe"];
    for (let i = 0; i < 6; i++) {
      this.sketches.push({
        x: this.pickMarginX(),
        y: (0.14 + (i % 3) * 0.3 + Math.random() * 0.12) * Math.max(this.height, 700),
        scale: 0.72 + Math.random() * 0.48,
        rotation: (Math.random() - 0.5) * 0.28,
        kind: kinds[i % kinds.length],
        hue: [215, 255, 195, 330, 175][i % 5],
        age: Math.random() * 5,
        maxAge: 18 + Math.random() * 10,
        drawSpeed: 0.32
      });
    }
  }

  public onPointerMove(x: number, y: number) {
    if (!this.enabled || this.reducedMotion) return;

    if (this.prevMouseX < -500) {
      this.prevMouseX = x;
      this.prevMouseY = y;
    }

    const dx = x - this.prevMouseX;
    const dy = y - this.prevMouseY;
    const dist = Math.hypot(dx, dy);

    this.mouseX = x;
    this.mouseY = y;
    this.pointerMoving = true;
    this.lastMoveTimestamp = performance.now();

    if (dist < 2.2) return;

    // Velocity-sensitive calligraphic nib width (faster -> sleeker hairline, slower -> lush mist)
    const radius = Math.max(1.8, Math.min(18, 16 - dist * 0.14));

    if (!this.activeStroke || this.activeStroke.points.length > 36) {
      this.hueClock = (this.hueClock + 9) % 360;
      const isSilver = Math.random() < 0.55;
      const paletteHues = [212, 232, 192, 268, 336, 168];
      const hue = paletteHues[Math.floor(this.hueClock / 60) % paletteHues.length];
      this.activeStroke = {
        points: [{ x: this.prevMouseX, y: this.prevMouseY, r: radius }],
        hue,
        sat: isSilver ? 14 : 48,
        light: isSilver ? 72 : 76,
        alpha: isSilver ? 0.24 : 0.19,
        age: 0,
        maxAge: 9.5,
        silver: isSilver
      };
      this.strokes.push(this.activeStroke);
      if (this.strokes.length > 58) this.strokes.shift();
    }

    this.activeStroke.points.push({ x, y, r: radius });

    // Spawn delicate floating protons, atoms, and glass bubbles along the brush trail
    if (dist > 6 && Math.random() < 0.36) {
      const roll = Math.random();
      const kind: FloatingParticle["kind"] =
        roll < 0.34 ? "bubble" : roll < 0.62 ? "proton" : roll < 0.85 ? "spark" : "atom";
      this.particles.push({
        x: x + (Math.random() - 0.5) * 18,
        y: y + (Math.random() - 0.5) * 18,
        vx: dx * 0.03 + (Math.random() - 0.5) * 14,
        vy: -10 - Math.random() * 22 + dy * 0.02,
        radius: kind === "atom" ? 7 + Math.random() * 5 : 2.5 + Math.random() * 4.5,
        kind,
        hue: [215, 342, 194, 264, 166][Math.floor(Math.random() * 5)],
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 2.2,
        age: 0,
        maxAge: 3.4 + Math.random() * 3.4
      });
      if (this.particles.length > 90) this.particles.shift();
    }

    this.prevMouseX = x;
    this.prevMouseY = y;
  }

  public onPointerClick(x: number, y: number) {
    if (!this.enabled || this.reducedMotion) return;

    const hues = [215, 265, 192, 338, 170];
    const hue = hues[Math.floor(Math.random() * hues.length)];

    this.ripples.push({
      x,
      y,
      radius: 8,
      maxRadius: 115 + Math.random() * 55,
      hue,
      age: 0,
      maxAge: 2.1
    });

    // Paint a living calligraphic alchemy sketch right where the user clicked!
    const kinds: LivingSketch["kind"][] = ["flask", "atom", "cat", "dog", "astrolabe"];
    this.sketches.push({
      x,
      y,
      scale: 0.62 + Math.random() * 0.28,
      rotation: (Math.random() - 0.5) * 0.22,
      kind: kinds[Math.floor(Math.random() * kinds.length)],
      hue,
      age: 0,
      maxAge: 14,
      drawSpeed: 0.95
    });
    if (this.sketches.length > 14) this.sketches.shift();

    for (let i = 0; i < 9; i++) {
      const a = (Math.PI * 2 * i) / 9 + Math.random() * 0.4;
      const spd = 24 + Math.random() * 42;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 8,
        radius: 3 + Math.random() * 4,
        kind: i % 3 === 0 ? "proton" : i % 3 === 1 ? "atom" : "bubble",
        hue,
        angle: a,
        spin: (Math.random() - 0.5) * 3,
        age: 0,
        maxAge: 2.8 + Math.random() * 2.2
      });
    }
  }

  public triggerImpactBloom() {
    if (!this.enabled) return;
    const cx = this.width * (0.35 + Math.random() * 0.3);
    const cy = this.height * (0.28 + Math.random() * 0.32);
    this.onPointerClick(cx, cy);
  }

  private update(dt: number, now: number) {
    if (this.pointerMoving && now - this.lastMoveTimestamp > 140) {
      this.pointerMoving = false;
      this.activeStroke = null;
    }

    // Periodically paint new serene ambient alchemy sketches into the white margins
    this.ambientTimer += dt;
    if (this.enabled && !this.reducedMotion && this.ambientTimer > 4.2) {
      this.ambientTimer = 0;
      if (this.sketches.length < 8) {
        const kinds: LivingSketch["kind"][] = ["flask", "atom", "cat", "dog", "astrolabe"];
        this.sketches.push({
          x: this.pickMarginX(),
          y: 90 + Math.random() * Math.max(200, this.height - 180),
          scale: 0.68 + Math.random() * 0.46,
          rotation: (Math.random() - 0.5) * 0.25,
          kind: kinds[Math.floor(Math.random() * kinds.length)],
          hue: [214, 252, 195, 336, 174][Math.floor(Math.random() * 5)],
          age: 0,
          maxAge: 19 + Math.random() * 10,
          drawSpeed: 0.36
        });
      }
    }

    for (let i = this.strokes.length - 1; i >= 0; i--) {
      this.strokes[i].age += dt;
      if (this.strokes[i].age >= this.strokes[i].maxAge) {
        if (this.strokes[i] === this.activeStroke) this.activeStroke = null;
        this.strokes.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.985;
      p.vy = p.vy * 0.985 - 3.5 * dt;
      p.angle += p.spin * dt;
      if (p.age >= p.maxAge) this.particles.splice(i, 1);
    }

    for (let i = this.sketches.length - 1; i >= 0; i--) {
      this.sketches[i].age += dt;
      if (this.sketches[i].age >= this.sketches[i].maxAge) {
        this.sketches.splice(i, 1);
      }
    }

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.age += dt;
      const t = Math.min(1, r.age / r.maxAge);
      r.radius = 8 + (r.maxRadius - 8) * (1 - Math.pow(1 - t, 3));
      if (r.age >= r.maxAge) this.ripples.splice(i, 1);
    }
  }

  private render(now: number) {
    const ctx = this.ctx;
    const t = now * 0.001;

    // 1. Pure Luminous Porcelain-White Base with ultra-subtle cool silver sheen
    const bgGrad = ctx.createLinearGradient(0, 0, this.width, this.height);
    bgGrad.addColorStop(0, "#ffffff");
    bgGrad.addColorStop(0.58, "#fcfdfe");
    bgGrad.addColorStop(1, "#f3f5f9");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Subtle drifting iridescent silver-white atmospheric blooms (makes glassmorphism pop!)
    const bloom1X = this.width * (0.2 + Math.sin(t * 0.14) * 0.08);
    const bloom1Y = this.height * (0.24 + Math.cos(t * 0.11) * 0.07);
    const g1 = ctx.createRadialGradient(bloom1X, bloom1Y, 10, bloom1X, bloom1Y, Math.max(this.width, 700) * 0.42);
    g1.addColorStop(0, "rgba(194, 214, 245, 0.17)");
    g1.addColorStop(0.5, "rgba(216, 224, 238, 0.08)");
    g1.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, this.width, this.height);

    const bloom2X = this.width * (0.8 + Math.cos(t * 0.12) * 0.08);
    const bloom2Y = this.height * (0.68 + Math.sin(t * 0.15) * 0.08);
    const g2 = ctx.createRadialGradient(bloom2X, bloom2Y, 10, bloom2X, bloom2Y, Math.max(this.width, 700) * 0.45);
    g2.addColorStop(0, "rgba(232, 214, 244, 0.15)");
    g2.addColorStop(0.55, "rgba(205, 226, 235, 0.07)");
    g2.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, this.width, this.height);

    // Faint silver atelier dot grid
    ctx.fillStyle = "rgba(148, 163, 184, 0.14)";
    const step = 48;
    for (let gx = (this.width % step) / 2; gx < this.width; gx += step) {
      for (let gy = (this.height % step) / 2; gy < this.height; gy += step) {
        ctx.fillRect(gx, gy, 1.1, 1.1);
      }
    }

    if (!this.enabled) return;

    // 2. Living Self-Painting Alchemical Sketches
    for (const sk of this.sketches) {
      this.drawLivingSketch(ctx, sk, t);
    }

    // 3. Mouse-Painted Silvery-Ink & Pearlescent Watercolor Brush Strokes
    for (const stroke of this.strokes) {
      if (stroke.points.length < 2) continue;
      const life = 1 - stroke.age / stroke.maxAge;
      const fade = Math.min(1, stroke.age * 3.5) * Math.pow(life, 1.45);

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Soft watercolor halo ribbon
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const mx = (stroke.points[i].x + stroke.points[i + 1].x) * 0.5;
        const my = (stroke.points[i].y + stroke.points[i + 1].y) * 0.5;
        ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, mx, my);
      }
      const last = stroke.points[stroke.points.length - 1];
      ctx.lineTo(last.x, last.y);

      const avgR = stroke.points[Math.floor(stroke.points.length / 2)].r;
      ctx.strokeStyle = `hsla(${stroke.hue}, ${stroke.sat}%, ${stroke.light}%, ${stroke.alpha * fade * 0.55})`;
      ctx.lineWidth = avgR * 2.1;
      ctx.stroke();

      // Crisp sterling-silver calligraphic core stroke
      ctx.strokeStyle = stroke.silver
        ? `rgba(140, 152, 172, ${0.28 * fade})`
        : `hsla(${stroke.hue}, 52%, 58%, ${0.26 * fade})`;
      ctx.lineWidth = Math.max(1.1, avgR * 0.22);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Click Watercolor & Silver Alchemy Ripples
    for (const r of this.ripples) {
      const fade = Math.pow(1 - r.age / r.maxAge, 1.6);
      ctx.save();
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${r.hue}, 44%, 64%, ${0.34 * fade})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius * 0.72, 0, Math.PI * 2);
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = `rgba(148, 163, 184, ${0.28 * fade})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // 5. Floating Painted Protons, Atoms & Glass Bubbles
    for (const p of this.particles) {
      const life = 1 - p.age / p.maxAge;
      const fade = Math.min(1, p.age * 4) * life;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      if (p.kind === "bubble") {
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(130, 146, 170, ${0.42 * fade})`;
        ctx.fillStyle = `hsla(${p.hue}, 60%, 88%, ${0.24 * fade})`;
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-p.radius * 0.3, -p.radius * 0.3, p.radius * 0.24, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.85 * fade})`;
        ctx.fill();
      } else if (p.kind === "proton") {
        ctx.beginPath();
        ctx.arc(0, 0, p.radius + 1.4, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 72%, 68%, ${0.34 * fade})`;
        ctx.fill();
        ctx.strokeStyle = `hsla(${p.hue}, 64%, 56%, ${0.52 * fade})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        // '+' proton mark
        ctx.rotate(-p.angle);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * fade})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(-2.5, 0);
        ctx.lineTo(2.5, 0);
        ctx.moveTo(0, -2.5);
        ctx.lineTo(0, 2.5);
        ctx.stroke();
      } else if (p.kind === "atom") {
        ctx.strokeStyle = `rgba(130, 144, 168, ${0.38 * fade})`;
        ctx.lineWidth = 0.9;
        for (let k = 0; k < 2; k++) {
          ctx.save();
          ctx.rotate((k * Math.PI) / 2 + 0.45);
          ctx.beginPath();
          ctx.ellipse(0, 0, p.radius * 1.4, p.radius * 0.5, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        ctx.beginPath();
        ctx.arc(0, 0, 2.3, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 68%, 62%, ${0.65 * fade})`;
        ctx.fill();
      } else {
        // 4-point silver alchemy star spark
        const s = p.radius * 1.1;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.quadraticCurveTo(0, 0, s, 0);
        ctx.quadraticCurveTo(0, 0, 0, s);
        ctx.quadraticCurveTo(0, 0, -s, 0);
        ctx.quadraticCurveTo(0, 0, 0, -s);
        ctx.fillStyle = `rgba(148, 163, 184, ${0.5 * fade})`;
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private drawLivingSketch(ctx: CanvasRenderingContext2D, sk: LivingSketch, t: number) {
    const drawIn = Math.min(1, sk.age * sk.drawSpeed);
    const fadeOut = Math.min(1, Math.max(0, (sk.maxAge - sk.age) / 4));
    const mobileAtten = this.width < 680 ? 0.36 : 1.0;
    const alpha = drawIn * fadeOut * 0.34 * mobileAtten;
    if (alpha <= 0.005) return;

    const floatY = Math.sin(t * 0.8 + sk.x * 0.01) * 6;
    ctx.save();
    ctx.translate(sk.x, sk.y + floatY);
    ctx.rotate(sk.rotation + Math.sin(t * 0.4 + sk.y) * 0.03);
    ctx.scale(sk.scale * (this.width < 680 ? 0.72 : 1), sk.scale * (this.width < 680 ? 0.72 : 1));

    // Subtle pearlescent watercolor aura behind sketch
    const aura = ctx.createRadialGradient(0, 0, 6, 0, 0, 88);
    aura.addColorStop(0, `hsla(${sk.hue}, 55%, 82%, ${alpha * 0.42})`);
    aura.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 88, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(130, 143, 165, ${alpha * 1.35})`;
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Progressive calligraphy dash reveal effect
    const dashLen = 620;
    ctx.setLineDash([dashLen * drawIn, dashLen]);

    if (sk.kind === "flask") {
      // Stylized Erlenmeyer flask + meniscus + rising bubble
      ctx.beginPath();
      ctx.moveTo(-14, -56);
      ctx.lineTo(14, -56);
      ctx.moveTo(-11, -56);
      ctx.lineTo(-11, -22);
      ctx.lineTo(-42, 40);
      ctx.quadraticCurveTo(-46, 52, -32, 52);
      ctx.lineTo(32, 52);
      ctx.quadraticCurveTo(46, 52, 42, 40);
      ctx.lineTo(11, -22);
      ctx.lineTo(11, -56);
      ctx.stroke();

      // Meniscus wave
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(-28, 16);
      ctx.quadraticCurveTo(0, 10 + Math.sin(t * 2.2) * 3, 28, 16);
      ctx.strokeStyle = `hsla(${sk.hue}, 65%, 64%, ${alpha * 1.4})`;
      ctx.stroke();

      // Tiny bubbles
      for (let b = 0; b < 3; b++) {
        const by = 38 - ((t * 14 + b * 15) % 40);
        ctx.beginPath();
        ctx.arc(-8 + b * 8, by, 2.5 + (b % 2), 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (sk.kind === "atom") {
      ctx.setLineDash([]);
      for (let k = 0; k < 3; k++) {
        ctx.save();
        ctx.rotate((k * Math.PI) / 3 + t * 0.22);
        ctx.beginPath();
        ctx.ellipse(0, 0, 52 * drawIn, 19 * drawIn, 0, 0, Math.PI * 2);
        ctx.stroke();
        const ea = t * (1.2 + k * 0.35) + k * 2;
        const ex = Math.cos(ea) * 52 * drawIn;
        const ey = Math.sin(ea) * 19 * drawIn;
        ctx.beginPath();
        ctx.arc(ex, ey, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${sk.hue}, 70%, 62%, ${alpha * 1.7})`;
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 7 * drawIn, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${sk.hue}, 65%, 72%, ${alpha * 1.4})`;
      ctx.fill();
    } else if (sk.kind === "cat") {
      // Minimalist one-line calligraphic sitting cat with curving tail
      ctx.beginPath();
      ctx.moveTo(-22, 44);
      ctx.quadraticCurveTo(-30, 12, -20, -14);
      ctx.lineTo(-24, -40); // left ear
      ctx.lineTo(-8, -26);
      ctx.quadraticCurveTo(0, -30, 8, -26);
      ctx.lineTo(24, -40); // right ear
      ctx.lineTo(20, -14);
      ctx.quadraticCurveTo(30, 12, 22, 44);
      ctx.lineTo(-22, 44);
      ctx.stroke();

      // Tail sway
      const sway = Math.sin(t * 1.6 + sk.x) * 8;
      ctx.beginPath();
      ctx.moveTo(22, 38);
      ctx.bezierCurveTo(48, 34, 54 + sway, 4, 38 + sway * 0.7, -8);
      ctx.stroke();

      // Eyes
      ctx.setLineDash([]);
      ctx.fillStyle = `hsla(${sk.hue}, 60%, 62%, ${alpha * 1.7})`;
      ctx.beginPath();
      ctx.arc(-8, -12, 2.2, 0, Math.PI * 2);
      ctx.arc(8, -12, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (sk.kind === "dog") {
      // Minimalist calligraphic Shiba/hound silhouette with wagging tail
      ctx.beginPath();
      ctx.moveTo(-24, 42);
      ctx.quadraticCurveTo(-28, 12, -18, -10);
      ctx.lineTo(-28, -32);
      ctx.lineTo(-10, -24);
      ctx.quadraticCurveTo(2, -28, 14, -22);
      ctx.lineTo(28, -32);
      ctx.lineTo(22, -8);
      ctx.quadraticCurveTo(34, 4, 24, 14); // snout curve
      ctx.quadraticCurveTo(26, 30, 18, 42);
      ctx.closePath();
      ctx.stroke();

      const wag = Math.sin(t * 3.4 + sk.y) * 7;
      ctx.beginPath();
      ctx.moveTo(-24, 34);
      ctx.quadraticCurveTo(-48, 16 + wag, -34, -2 + wag);
      ctx.stroke();
    } else {
      // Rotating sacred alchemy astrolabe
      ctx.setLineDash([]);
      ctx.rotate(t * 0.12);
      ctx.beginPath();
      ctx.arc(0, 0, 56 * drawIn, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, 42 * drawIn, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // Inscribed equilateral triangle
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3 - Math.PI / 2;
        const px = Math.cos(a) * 42 * drawIn;
        const py = Math.sin(a) * 42 * drawIn;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }
}
