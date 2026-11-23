import * as THREE from "three";

/**
 * Procedural Architectural Studio Textures (Zero external assets; instant & on-chain friendly).
 * Gives the 3D scene authentic honed alabaster terrazzo, brushed titanium metal,
 * an architect-app CAD blueprint drafting floor, soft contact AO, and optical bloom sprites.
 */

export function createAlabasterTerrazzoTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#fafbfd";
  ctx.fillRect(0, 0, size, size);

  // Subtle Carrara mineral clouding
  for (let i = 0; i < 28; i++) {
    const x = (i * 197) % size;
    const y = (i * 313) % size;
    const r = 45 + (i % 5) * 28;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, "rgba(218, 225, 236, 0.22)");
    g.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }

  // Delicate architectural marble micro-veins
  ctx.strokeStyle = "rgba(182, 192, 208, 0.24)";
  ctx.lineWidth = 1.1;
  for (let v = 0; v < 9; v++) {
    ctx.beginPath();
    let vx = (v * 73) % size;
    let vy = 0;
    ctx.moveTo(vx, vy);
    for (let s = 0; s < 16; s++) {
      vx += Math.sin(s * 0.9 + v) * 18 + 6;
      vy += size / 16;
      ctx.lineTo(vx, vy);
    }
    ctx.stroke();
  }

  // Fine architectural terrazzo quartz aggregate flecks
  let seed = 48271;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 380; i++) {
    const fx = rand() * size;
    const fy = rand() * size;
    const fr = 0.7 + rand() * 1.9;
    ctx.fillStyle =
      i % 4 === 0
        ? "rgba(148, 163, 184, 0.22)"
        : i % 4 === 1
          ? "rgba(203, 213, 225, 0.34)"
          : "rgba(255, 255, 255, 0.7)";
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createBrushedTitaniumTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#d3dbe6";
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y++) {
    const shade = 204 + Math.floor(Math.sin(y * 1.7) * 10 + Math.cos(y * 0.43) * 7);
    ctx.fillStyle = `rgb(${shade}, ${shade + 4}, ${shade + 11})`;
    ctx.fillRect(0, y, size, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createArchitecturalBlueprintFloorTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;

  // Fine millimeter CAD drafting grid
  ctx.strokeStyle = "rgba(160, 174, 192, 0.2)";
  ctx.lineWidth = 1;
  const step = 32;
  for (let i = 0; i <= size; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  // Concentric architectural radius dimension circles
  const radii = [215, 290, 375, 445];
  radii.forEach((r, idx) => {
    ctx.beginPath();
    if (idx % 2 === 1) ctx.setLineDash([6, 8]);
    else ctx.setLineDash([]);
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = idx === 0 ? "rgba(120, 136, 160, 0.34)" : "rgba(148, 163, 184, 0.24)";
    ctx.lineWidth = idx === 0 ? 1.5 : 1;
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // Axial architectural section cut lines (A-A' & B-B')
  ctx.strokeStyle = "rgba(130, 145, 168, 0.3)";
  ctx.lineWidth = 1.2;
  ctx.setLineDash([12, 8, 2, 8]);
  ctx.beginPath();
  ctx.moveTo(56, cy);
  ctx.lineTo(size - 56, cy);
  ctx.moveTo(cx, 56);
  ctx.lineTo(cx, size - 56);
  ctx.stroke();
  ctx.setLineDash([]);

  // Crisp architectural callout typography
  ctx.font = "500 13px 'JetBrains Mono', monospace";
  ctx.fillStyle = "rgba(115, 130, 152, 0.56)";
  ctx.textAlign = "center";
  ctx.fillText("N ↑", cx, 84);
  ctx.fillText("SECTION A — A'", cx + 310, cy - 10);
  ctx.fillText("SCALE 1:25 · ELEV +0.00m", cx, size - 68);
  ctx.fillText("R 2.40m", cx + 266, cy + 264);

  // Clean architectural scale bar on front edge
  const barY = size - 96;
  const barX = cx - 96;
  ctx.strokeStyle = "rgba(115, 130, 152, 0.45)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(barX, barY, 192, 6);
  ctx.fillStyle = "rgba(115, 130, 152, 0.45)";
  ctx.fillRect(barX, barY, 48, 6);
  ctx.fillRect(barX + 96, barY, 48, 6);

  // Radial vignette fade to transparent at edges so sheet blends into white cyclorama
  ctx.globalCompositeOperation = "destination-in";
  const mask = ctx.createRadialGradient(cx, cy, 180, cx, cy, 505);
  mask.addColorStop(0, "rgba(0,0,0,1)");
  mask.addColorStop(0.75, "rgba(0,0,0,0.85)");
  mask.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createRadialGlowTexture(colorHex: string): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.26, colorHex);
  g.addColorStop(0.62, `${colorHex}44`);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSoftAOTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const g = ctx.createRadialGradient(size / 2, size / 2, 12, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(45, 58, 82, 0.24)");
  g.addColorStop(0.55, "rgba(71, 85, 105, 0.09)");
  g.addColorStop(1, "rgba(71, 85, 105, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

export type MoodBubbleKind = "heart" | "treat" | "ball" | "sparkle" | "zzz";

/**
 * Crisp miniature frosted-glass 3D Tamagotchi mood bubble sprite texture.
 * Pure visual iconography (no cluttered text) for cozy pet feedback.
 */
export function createMoodBubbleTexture(kind: MoodBubbleKind): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, size, size);

  // Soft white frosted-glass circular speech bubble with tiny tail
  ctx.save();
  ctx.shadowColor = "rgba(71, 85, 105, 0.22)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.beginPath();
  ctx.arc(64, 56, 36, 0, Math.PI * 2);
  ctx.fill();
  // Little tail dot
  ctx.beginPath();
  ctx.arc(64, 102, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(148, 163, 184, 0.48)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(64, 56, 36, 0, Math.PI * 2);
  ctx.stroke();

  if (kind === "heart") {
    ctx.fillStyle = "#f472b6";
    ctx.beginPath();
    ctx.moveTo(64, 71);
    ctx.bezierCurveTo(64, 71, 44, 58, 44, 47);
    ctx.bezierCurveTo(44, 40, 50, 36, 56, 39);
    ctx.bezierCurveTo(60, 41, 64, 46, 64, 46);
    ctx.bezierCurveTo(64, 46, 68, 41, 72, 39);
    ctx.bezierCurveTo(78, 36, 84, 40, 84, 47);
    ctx.bezierCurveTo(84, 58, 64, 71, 64, 71);
    ctx.fill();
  } else if (kind === "treat") {
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.moveTo(64, 37);
    ctx.lineTo(79, 56);
    ctx.lineTo(64, 75);
    ctx.lineTo(49, 56);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#a7f3d0";
    ctx.beginPath();
    ctx.arc(60, 51, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "ball") {
    const g = ctx.createRadialGradient(58, 50, 3, 64, 56, 17);
    g.addColorStop(0, "#bae6fd");
    g.addColorStop(0.55, "#38bdf8");
    g.addColorStop(1, "#6366f1");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(64, 56, 16, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "zzz") {
    ctx.fillStyle = "#64748b";
    ctx.font = "600 22px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("z", 54, 62);
    ctx.font = "600 17px 'Inter', sans-serif";
    ctx.fillText("z", 71, 49);
  } else {
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.moveTo(64, 36);
    ctx.quadraticCurveTo(64, 56, 84, 56);
    ctx.quadraticCurveTo(64, 56, 64, 76);
    ctx.quadraticCurveTo(64, 56, 44, 56);
    ctx.quadraticCurveTo(64, 56, 64, 36);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
