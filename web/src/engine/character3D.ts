import * as THREE from "three";
import { createFastArchitecturalGlass } from "./browserCompat";
import { createRadialGlowTexture } from "./architectTextures";
import { BUILD_SCALE_MULTIPLIER, type CharacterProfile } from "./characterConfig";

export type CharacterEmote = "wave" | "spin" | "hop";
export type CharacterPosture = "stand" | "sit" | "brew" | "analyze";

// ============================================================================
// Shared Module-Level Geometries & Soft Contact Shadow Texture (Zero Duplicate
// GPU Buffer Uploads across Player + Visiting Host + 16 Strolling Town NPCs!)
// ============================================================================
interface SharedAvatarAssets {
  skullGeo: THREE.SphereGeometry;
  earGeo: THREE.SphereGeometry;
  innerEarGeo: THREE.SphereGeometry;
  noseGeo: THREE.SphereGeometry;
  scleraGeo: THREE.SphereGeometry;
  irisGeo: THREE.SphereGeometry;
  pupilGeo: THREE.SphereGeometry;
  glintLargeGeo: THREE.SphereGeometry;
  glintSmallGeo: THREE.SphereGeometry;
  lashGeo: THREE.TorusGeometry;
  browGeo: THREE.CapsuleGeometry;
  blushGeo: THREE.CircleGeometry;
  torsoCoreGeo: THREE.CapsuleGeometry;
  neckGeo: THREE.CylinderGeometry;
  armGeo: THREE.CapsuleGeometry;
  shoulderCapGeo: THREE.SphereGeometry;
  handGeo: THREE.SphereGeometry;
  shoeGeo: THREE.SphereGeometry;
  hairCapGeo: THREE.SphereGeometry;
  shadowGeo: THREE.PlaneGeometry;
  shadowTex: THREE.Texture | null;
  geometries: Set<THREE.BufferGeometry>;
}

let sharedAssetsCache: SharedAvatarAssets | null = null;

function createSoftShadowTexture(): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, "rgba(30, 41, 59, 0.34)");
  grad.addColorStop(0.55, "rgba(51, 65, 85, 0.16)");
  grad.addColorStop(1, "rgba(51, 65, 85, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function getSharedAvatarAssets(): SharedAvatarAssets {
  if (sharedAssetsCache) return sharedAssetsCache;
  const skullGeo = new THREE.SphereGeometry(0.186, 26, 22);
  const earGeo = new THREE.SphereGeometry(0.038, 10, 10);
  const innerEarGeo = new THREE.SphereGeometry(0.022, 8, 8);
  const noseGeo = new THREE.SphereGeometry(0.014, 10, 10);
  const scleraGeo = new THREE.SphereGeometry(0.031, 14, 12);
  const irisGeo = new THREE.SphereGeometry(0.023, 14, 12);
  const pupilGeo = new THREE.SphereGeometry(0.013, 10, 10);
  const glintLargeGeo = new THREE.SphereGeometry(0.0072, 8, 8);
  const glintSmallGeo = new THREE.SphereGeometry(0.0038, 6, 6);
  const lashGeo = new THREE.TorusGeometry(0.03, 0.0044, 6, 14, Math.PI * 0.84);
  const browGeo = new THREE.CapsuleGeometry(0.0056, 0.032, 4, 8);
  const blushGeo = new THREE.CircleGeometry(0.028, 14);
  const torsoCoreGeo = new THREE.CapsuleGeometry(0.15, 0.185, 12, 18);
  const neckGeo = new THREE.CylinderGeometry(0.05, 0.058, 0.092, 14);
  const armGeo = new THREE.CapsuleGeometry(0.044, 0.16, 8, 12);
  const shoulderCapGeo = new THREE.SphereGeometry(0.052, 10, 10);
  const handGeo = new THREE.SphereGeometry(0.044, 12, 10);
  const shoeGeo = new THREE.SphereGeometry(0.066, 12, 10);
  // Strictly upper hemisphere (<= 0.50*PI) so when tilted back, front hairline sits naturally high above eyebrows!
  const hairCapGeo = new THREE.SphereGeometry(0.196, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const shadowGeo = new THREE.PlaneGeometry(0.56, 0.56);

  const geometries = new Set<THREE.BufferGeometry>([
    skullGeo,
    earGeo,
    innerEarGeo,
    noseGeo,
    scleraGeo,
    irisGeo,
    pupilGeo,
    glintLargeGeo,
    glintSmallGeo,
    lashGeo,
    browGeo,
    blushGeo,
    torsoCoreGeo,
    neckGeo,
    armGeo,
    shoulderCapGeo,
    handGeo,
    shoeGeo,
    hairCapGeo,
    shadowGeo
  ]);

  sharedAssetsCache = {
    skullGeo,
    earGeo,
    innerEarGeo,
    noseGeo,
    scleraGeo,
    irisGeo,
    pupilGeo,
    glintLargeGeo,
    glintSmallGeo,
    lashGeo,
    browGeo,
    blushGeo,
    torsoCoreGeo,
    neckGeo,
    armGeo,
    shoulderCapGeo,
    handGeo,
    shoeGeo,
    hairCapGeo,
    shadowGeo,
    shadowTex: createSoftShadowTexture(),
    geometries
  };
  return sharedAssetsCache;
}

/**
 * Sculptural 3D Procedural Researcher Avatar built to harmonize with ALCHEMIA's
 * porcelain, brushed-titanium, and frosted-borosilicate architectural lab aesthetic.
 *
 * Features sculpted glossy studio eyes with sclera, dual catchlights & lashes,
 * soft nose & rosy blush, 9 face-framing hairstyles with zero front-face clipping,
 * 12 tailored outfits, 5 bottoms, 5 footwear styles, 6 neckwear options,
 * 5 eyewear styles, 9 headwear styles, 7 backpacks/wings/drones,
 * shared GPU geometry pooling, and natural breathing/stride/emote animation.
 */
export class ResearcherAvatar3D {
  public readonly root = new THREE.Group();

  private enablePlumbob: boolean;
  private plumbobScale: number;
  private plumbobGroup: THREE.Group | null = null;
  private plumbobMat: THREE.MeshPhysicalMaterial | null = null;
  private plumbobColor = "#10b981";
  private statusTagSprite: THREE.Sprite | null = null;
  private statusTagTex: THREE.CanvasTexture | null = null;
  private lastStatusKey = "";
  private brewCup: THREE.Mesh | null = null;
  private posture: CharacterPosture = "stand";

  private scaleGroup = new THREE.Group();
  private bodyPivot = new THREE.Group();
  private torsoGroup = new THREE.Group();
  private headPivot = new THREE.Group();
  private leftArmPivot = new THREE.Group();
  private rightArmPivot = new THREE.Group();
  private leftLegPivot = new THREE.Group();
  private rightLegPivot = new THREE.Group();
  private eyes: THREE.Object3D[] = [];
  private hairSwayParts: THREE.Object3D[] = [];
  private holoDrone: THREE.Group | null = null;
  private haloRing: THREE.Mesh | null = null;
  private leftWing: THREE.Object3D | null = null;
  private rightWing: THREE.Object3D | null = null;
  private hoverRings: THREE.Mesh[] = [];
  private shadowDisc: THREE.Mesh | null = null;
  private ownedTextures: THREE.Texture[] = [];

  private currentHeightScale = 1.0;
  private walkCycle = 0;
  private prevStrideSign = 0;
  private emoteKind: CharacterEmote | null = null;
  private emoteTime = 0;
  private emoteDuration = 0;

  constructor(
    profile: CharacterProfile,
    options?: { enablePlumbob?: boolean; plumbobScale?: number; initialPlumbobHex?: string }
  ) {
    this.enablePlumbob = Boolean(options?.enablePlumbob);
    this.plumbobScale = options?.plumbobScale ?? 1.0;
    if (options?.initialPlumbobHex) this.plumbobColor = options.initialPlumbobHex;
    this.root.add(this.scaleGroup);
    this.rebuild(profile);
  }

  public setStatusTag(name: string, subtitle: string, moodHex: string) {
    const key = `${name}|${subtitle}|${moodHex}`;
    if (key === this.lastStatusKey && this.statusTagSprite) return;
    this.lastStatusKey = key;

    if (typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 84;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 300, 64, 32);
    ctx.fill();
    ctx.strokeStyle = moodHex;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Mini Plumbob diamond badge inside the nameplate
    ctx.fillStyle = moodHex;
    ctx.beginPath();
    ctx.moveTo(36, 26);
    ctx.lineTo(46, 42);
    ctx.lineTo(36, 58);
    ctx.lineTo(26, 42);
    ctx.closePath();
    ctx.fill();

    ctx.font = "700 22px 'Inter', sans-serif";
    ctx.fillStyle = "#1a1f2c";
    ctx.fillText(name.slice(0, 16), 58, 39);

    ctx.font = "600 15px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#475569";
    ctx.fillText(subtitle.slice(0, 22), 58, 60);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    if (this.statusTagSprite) {
      const mat = this.statusTagSprite.material as THREE.SpriteMaterial;
      this.statusTagTex?.dispose();
      mat.map = tex;
      mat.needsUpdate = true;
      this.statusTagTex = tex;
    } else {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.94, depthWrite: false })
      );
      sp.scale.set(0.86, 0.23, 1);
      sp.position.set(0, this.enablePlumbob ? 1.66 : 1.38, 0);
      this.statusTagSprite = sp;
      this.statusTagTex = tex;
      this.bodyPivot.add(sp);
    }
  }

  public setPosture(posture: CharacterPosture) {
    this.posture = posture;
    if (this.brewCup) {
      this.brewCup.visible = posture === "brew";
    }
  }

  public getPosture(): CharacterPosture {
    return this.posture;
  }

  public setPlumbobColor(hex: string) {
    this.plumbobColor = hex;
    if (this.plumbobMat) {
      this.plumbobMat.color.set(hex);
      this.plumbobMat.emissive.set(hex);
    }
  }

  /** Returns the character's head center height in local Y (for dynamic camera framing!) */
  public getHeadHeight(): number {
    return 0.85 * this.currentHeightScale;
  }

  public getTorsoHeight(): number {
    return 0.54 * this.currentHeightScale;
  }

  public triggerEmote(kind: CharacterEmote) {
    this.emoteKind = kind;
    this.emoteTime = 0;
    this.emoteDuration = kind === "spin" ? 0.65 : kind === "wave" ? 1.05 : 0.48;
  }

  public rebuild(profile: CharacterProfile) {
    this.disposeRig();
    const shared = getSharedAvatarAssets();

    this.scaleGroup = new THREE.Group();
    this.currentHeightScale = BUILD_SCALE_MULTIPLIER[profile.buildScale] ?? 1.0;
    this.scaleGroup.scale.setScalar(this.currentHeightScale);

    this.bodyPivot = new THREE.Group();
    this.torsoGroup = new THREE.Group();
    this.headPivot = new THREE.Group();
    this.leftArmPivot = new THREE.Group();
    this.rightArmPivot = new THREE.Group();
    this.leftLegPivot = new THREE.Group();
    this.rightLegPivot = new THREE.Group();
    this.eyes = [];
    this.hairSwayParts = [];
    this.holoDrone = null;
    this.haloRing = null;
    this.leftWing = null;
    this.rightWing = null;
    this.hoverRings = [];

    const accentColor = new THREE.Color(profile.outfitAccent);
    const baseHex = profile.outfitBaseColor || "#f8fafd";
    const bottomHex = profile.bottomColor || "#263042";
    const bottomStyle = profile.bottomStyle || "slacks";
    const footwearStyle = profile.footwearStyle || "boots";
    const neckwear = profile.neckwear || "none";
    const porcelainWhite = "#f8fafd";

    const skinColorObj = new THREE.Color(profile.skinTone);
    const innerEarColor = skinColorObj.clone().lerp(new THREE.Color("#f4a6b5"), 0.28);

    const skinMat = new THREE.MeshStandardMaterial({
      color: skinColorObj,
      roughness: 0.44,
      metalness: 0.02
    });
    const innerEarMat = new THREE.MeshStandardMaterial({
      color: innerEarColor,
      roughness: 0.5,
      metalness: 0.02
    });
    // Satin-sheen hair material catches gentle studio rim highlights (so dark hair looks lush, never flat!)
    const hairColorObj = new THREE.Color(profile.hairColor);
    const hairMat = new THREE.MeshPhysicalMaterial({
      color: hairColorObj,
      emissive: hairColorObj,
      emissiveIntensity: 0.06,
      roughness: 0.42,
      metalness: 0.08,
      clearcoat: 0.28,
      clearcoatRoughness: 0.42
    });
    const coatMat = new THREE.MeshStandardMaterial({
      color:
        profile.outfitStyle === "hoodie"
          ? baseHex === "#f8fafd"
            ? profile.outfitAccent
            : baseHex
          : profile.outfitStyle === "jumpsuit" && baseHex === "#f8fafd"
            ? "#313c50"
            : baseHex,
      roughness: 0.4,
      metalness: 0.05
    });
    const innerTeeMat = new THREE.MeshStandardMaterial({
      color: porcelainWhite,
      roughness: 0.48,
      metalness: 0.03
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: profile.outfitAccent,
      roughness: 0.28,
      metalness: 0.16
    });
    const accentGlowMat = new THREE.MeshStandardMaterial({
      color: profile.outfitAccent,
      emissive: accentColor,
      emissiveIntensity: 0.72,
      roughness: 0.18
    });
    const trouserMat = new THREE.MeshStandardMaterial({
      color: profile.outfitStyle === "jumpsuit" ? coatMat.color : bottomHex,
      roughness: 0.46,
      metalness: 0.06
    });
    const sockMat = new THREE.MeshStandardMaterial({
      color: "#f8fafc",
      roughness: 0.65
    });
    const bootMat = new THREE.MeshStandardMaterial({
      color:
        footwearStyle === "sneakers"
          ? "#f8fafd"
          : footwearStyle === "loafers"
            ? "#64748b"
            : footwearStyle === "maryjanes"
              ? "#334155"
              : footwearStyle === "hoverkicks"
                ? "#e2e8f0"
                : "#1e2636",
      roughness: footwearStyle === "loafers" || footwearStyle === "hoverkicks" ? 0.18 : 0.28,
      metalness: footwearStyle === "loafers" || footwearStyle === "hoverkicks" ? 0.48 : 0.24
    });
    const titaniumMat = new THREE.MeshStandardMaterial({
      color: "#cbd5e1",
      roughness: 0.18,
      metalness: 0.9
    });
    const glassMat = createFastArchitecturalGlass({
      color: "#e8f3ff",
      opacity: 0.52,
      roughness: 0.06
    });

    // Soft radial feathered contact shadow under shoes (looks grounded without hard disc edges!)
    const shadowDisc = new THREE.Mesh(
      shared.shadowGeo,
      shared.shadowTex
        ? new THREE.MeshBasicMaterial({
            map: shared.shadowTex,
            transparent: true,
            depthWrite: false
          })
        : new THREE.MeshBasicMaterial({
            color: "#334155",
            transparent: true,
            opacity: 0.2,
            depthWrite: false
          })
    );
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.006;
    this.shadowDisc = shadowDisc;
    this.root.add(shadowDisc);

    // ------------------------------------------------------------------
    // Legs, Bottoms (5 styles!) & Footwear (5 styles!) (hip height y = 0.29)
    // ------------------------------------------------------------------
    const showBareLegs =
      bottomStyle === "shorts" || bottomStyle === "skirt" || profile.outfitStyle === "sundress";
    const legRadius = bottomStyle === "wideleg" ? 0.07 : bottomStyle === "joggers" ? 0.062 : 0.054;
    const legGeo = new THREE.CapsuleGeometry(legRadius, 0.14, 8, 12);

    for (const side of [-1, 1]) {
      const pivot = side === -1 ? this.leftLegPivot : this.rightLegPivot;
      pivot.position.set(side * 0.082, 0.29, 0);

      const leg = new THREE.Mesh(legGeo, showBareLegs ? skinMat : trouserMat);
      leg.position.y = -0.11;
      leg.castShadow = true;
      pivot.add(leg);

      if (bottomStyle === "shorts" && profile.outfitStyle !== "sundress") {
        const shortTube = new THREE.Mesh(
          new THREE.CylinderGeometry(0.066, 0.068, 0.11, 14),
          trouserMat
        );
        shortTube.position.y = -0.04;
        shortTube.castShadow = true;
        pivot.add(shortTube);
      } else if (bottomStyle === "joggers" && !showBareLegs) {
        const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 8, 16), accentMat);
        cuff.rotation.x = Math.PI / 2;
        cuff.position.y = -0.19;
        pivot.add(cuff);
      }

      if (showBareLegs || footwearStyle === "maryjanes") {
        const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.05, 0.09, 12), sockMat);
        sock.position.y = -0.195;
        pivot.add(sock);
      }

      // Footwear Styles
      const shoe = new THREE.Mesh(shared.shoeGeo, bootMat);
      if (footwearStyle === "sneakers") {
        shoe.scale.set(1.04, 0.7, 1.4);
        shoe.position.set(0, -0.242, 0.028);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.022, 0.06), accentMat);
        stripe.position.set(0, -0.236, 0.032);
        pivot.add(stripe);
        const thickSole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.068, 0.072, 0.026, 14),
          innerTeeMat
        );
        thickSole.position.set(0, -0.274, 0.026);
        pivot.add(thickSole);
      } else if (footwearStyle === "loafers") {
        shoe.scale.set(0.92, 0.56, 1.38);
        shoe.position.set(0, -0.252, 0.028);
        const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.016, 0.024), titaniumMat);
        buckle.position.set(0, -0.222, 0.045);
        pivot.add(buckle);
      } else if (footwearStyle === "maryjanes") {
        shoe.scale.set(0.95, 0.52, 1.28);
        shoe.position.set(0, -0.255, 0.022);
        const strap = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.009, 8, 16), accentMat);
        strap.rotation.x = Math.PI / 2 - 0.3;
        strap.position.set(0, -0.225, 0.024);
        pivot.add(strap);
      } else if (footwearStyle === "hoverkicks") {
        shoe.scale.set(1.0, 0.68, 1.38);
        shoe.position.set(0, -0.242, 0.025);
        const glowRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.07, 0.011, 8, 22),
          accentGlowMat
        );
        glowRing.rotation.x = Math.PI / 2;
        glowRing.position.set(0, -0.28, 0.022);
        pivot.add(glowRing);
        this.hoverRings.push(glowRing);
      } else {
        shoe.scale.set(0.95, 0.65, 1.32);
        shoe.position.set(0, -0.245, 0.024);
        const soleTrim = new THREE.Mesh(
          new THREE.CylinderGeometry(0.058, 0.062, 0.016, 12),
          accentMat
        );
        soleTrim.position.set(0, -0.275, 0.02);
        pivot.add(soleTrim);
      }
      shoe.castShadow = true;
      pivot.add(shoe);

      this.bodyPivot.add(pivot);
    }

    // ------------------------------------------------------------------
    // Torso, 12 Tailored Clothing Silhouettes, Skirts & 6 Neckwear Options
    // ------------------------------------------------------------------
    this.torsoGroup.position.set(0, 0.48, 0);

    const coreMat =
      profile.outfitStyle === "labcoat" || profile.outfitStyle === "overalls"
        ? accentMat
        : profile.outfitStyle === "cardigan" || profile.outfitStyle === "blazer"
          ? innerTeeMat
          : coatMat;

    const core = new THREE.Mesh(shared.torsoCoreGeo, coreMat);
    core.scale.set(1.02, 1.0, 0.84);
    core.castShadow = true;
    core.receiveShadow = true;
    this.torsoGroup.add(core);

    // Optional Pleated Skirt bottom layer (whenever bottomStyle === "skirt" and not sundress)
    if (bottomStyle === "skirt" && profile.outfitStyle !== "sundress") {
      const skirtMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.152, 0.232, 0.2, 22),
        trouserMat
      );
      skirtMesh.position.set(0, -0.175, 0);
      skirtMesh.castShadow = true;
      this.torsoGroup.add(skirtMesh);

      const hem = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.01, 8, 28), accentMat);
      hem.rotation.x = Math.PI / 2;
      hem.position.set(0, -0.272, 0);
      this.torsoGroup.add(hem);
    }

    if (profile.outfitStyle === "labcoat") {
      const coatBack = new THREE.Mesh(
        new THREE.CylinderGeometry(0.152, 0.212, 0.42, 20, 1, false, -Math.PI * 0.82, Math.PI * 1.64),
        coatMat
      );
      coatBack.position.set(0, -0.05, 0);
      coatBack.rotation.y = Math.PI;
      coatBack.castShadow = true;
      this.torsoGroup.add(coatBack);

      for (const side of [-1, 1]) {
        const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.16, 0.022), coatMat);
        lapel.position.set(side * 0.066, 0.08, 0.122);
        lapel.rotation.z = -side * 0.26;
        this.torsoGroup.add(lapel);
      }

      const badge = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.062, 0.012), accentGlowMat);
      badge.position.set(-0.086, 0.03, 0.142);
      this.torsoGroup.add(badge);
    } else if (profile.outfitStyle === "cardigan") {
      const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.158, 0.192, 0.34, 20, 1, false, -Math.PI * 0.78, Math.PI * 1.56),
        coatMat
      );
      shell.position.set(0, -0.01, 0);
      shell.rotation.y = Math.PI;
      shell.castShadow = true;
      this.torsoGroup.add(shell);

      for (const side of [-1, 1]) {
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.31, 0.026), accentMat);
        trim.position.set(side * 0.064, -0.01, 0.125);
        this.torsoGroup.add(trim);
      }
      for (const by of [0.06, -0.02, -0.1]) {
        const btn = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 10), titaniumMat);
        btn.position.set(0.064, by, 0.144);
        this.torsoGroup.add(btn);
      }
    } else if (profile.outfitStyle === "sweater") {
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.092, 0.09, 18), coatMat);
      collar.position.set(0, 0.162, 0);
      this.torsoGroup.add(collar);

      const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.02, 8, 24), accentMat);
      stripe.rotation.x = Math.PI / 2;
      stripe.position.set(0, 0.02, 0);
      this.torsoGroup.add(stripe);

      const hem = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.022, 8, 24), coatMat);
      hem.rotation.x = Math.PI / 2;
      hem.position.set(0, -0.11, 0);
      this.torsoGroup.add(hem);
    } else if (profile.outfitStyle === "blazer") {
      const jacket = new THREE.Mesh(
        new THREE.CylinderGeometry(0.158, 0.185, 0.34, 20, 1, false, -Math.PI * 0.84, Math.PI * 1.68),
        coatMat
      );
      jacket.position.set(0, -0.01, 0);
      jacket.rotation.y = Math.PI;
      jacket.castShadow = true;
      this.torsoGroup.add(jacket);

      for (const side of [-1, 1]) {
        const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.17, 0.024), coatMat);
        lapel.position.set(side * 0.062, 0.06, 0.126);
        lapel.rotation.z = -side * 0.24;
        this.torsoGroup.add(lapel);
      }
      const pocketSq = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.024, 0.012), accentMat);
      pocketSq.position.set(-0.09, 0.05, 0.142);
      this.torsoGroup.add(pocketSq);
    } else if (profile.outfitStyle === "puffer") {
      for (const [py, r] of [[0.09, 0.162], [0.0, 0.172], [-0.09, 0.166]] as const) {
        const baffle = new THREE.Mesh(new THREE.TorusGeometry(r, 0.042, 12, 24), coatMat);
        baffle.rotation.x = Math.PI / 2;
        baffle.scale.set(1.02, 0.86, 1.0);
        baffle.position.set(0, py, 0);
        baffle.castShadow = true;
        this.torsoGroup.add(baffle);
      }
      const highCollar = new THREE.Mesh(new THREE.TorusGeometry(0.102, 0.034, 10, 20), accentMat);
      highCollar.rotation.x = Math.PI / 2;
      highCollar.position.set(0, 0.162, 0);
      this.torsoGroup.add(highCollar);
    } else if (profile.outfitStyle === "overalls") {
      const bib = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.22, 0.058), trouserMat);
      bib.position.set(0, -0.02, 0.106);
      bib.castShadow = true;
      this.torsoGroup.add(bib);

      const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.156, 0.164, 0.15, 18), trouserMat);
      waist.position.set(0, -0.1, 0);
      this.torsoGroup.add(waist);

      const bibPocket = new THREE.Mesh(new THREE.BoxGeometry(0.108, 0.072, 0.02), coatMat);
      bibPocket.position.set(0, 0.01, 0.14);
      this.torsoGroup.add(bibPocket);

      for (const side of [-1, 1]) {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.2, 0.022), trouserMat);
        strap.position.set(side * 0.072, 0.11, 0.102);
        strap.rotation.x = -0.2;
        this.torsoGroup.add(strap);
        const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.026, 0.026), titaniumMat);
        buckle.position.set(side * 0.072, 0.08, 0.128);
        this.torsoGroup.add(buckle);
      }
    } else if (profile.outfitStyle === "sundress") {
      const dressSkirt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.148, 0.276, 0.3, 24),
        coatMat
      );
      dressSkirt.position.set(0, -0.17, 0);
      dressSkirt.castShadow = true;
      this.torsoGroup.add(dressSkirt);

      const sash = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.022, 8, 24), accentMat);
      sash.rotation.x = Math.PI / 2;
      sash.position.set(0, -0.02, 0);
      this.torsoGroup.add(sash);

      const hemTrim = new THREE.Mesh(new THREE.TorusGeometry(0.274, 0.012, 8, 28), accentMat);
      hemTrim.rotation.x = Math.PI / 2;
      hemTrim.position.set(0, -0.315, 0);
      this.torsoGroup.add(hemTrim);
    } else if (profile.outfitStyle === "kimono") {
      const robe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.156, 0.226, 0.36, 20),
        coatMat
      );
      robe.position.set(0, -0.04, 0);
      robe.castShadow = true;
      this.torsoGroup.add(robe);

      for (const side of [-1, 1]) {
        const collarV = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.19, 0.024), accentMat);
        collarV.position.set(side * 0.046, 0.08, 0.126);
        collarV.rotation.z = side * 0.34;
        this.torsoGroup.add(collarV);
      }

      const obi = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.174, 0.092, 22), accentMat);
      obi.position.set(0, -0.055, 0);
      this.torsoGroup.add(obi);

      const cord = new THREE.Mesh(new THREE.TorusGeometry(0.174, 0.011, 8, 24), titaniumMat);
      cord.rotation.x = Math.PI / 2;
      cord.position.set(0, -0.055, 0);
      this.torsoGroup.add(cord);
    } else if (profile.outfitStyle === "tunic") {
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.156, 0.208, 0.2, 20), coatMat);
      skirt.position.set(0, -0.14, 0);
      skirt.castShadow = true;
      this.torsoGroup.add(skirt);

      const belt = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.022, 8, 24), accentMat);
      belt.rotation.x = Math.PI / 2;
      belt.position.set(0, -0.04, 0);
      this.torsoGroup.add(belt);

      const clasp = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), titaniumMat);
      clasp.position.set(0, -0.04, 0.156);
      this.torsoGroup.add(clasp);
    } else if (profile.outfitStyle === "hoodie") {
      const hoodRoll = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 10, 22), coatMat);
      hoodRoll.rotation.x = Math.PI / 2 + 0.15;
      hoodRoll.position.set(0, 0.152, -0.03);
      this.torsoGroup.add(hoodRoll);

      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.088, 0.034), innerTeeMat);
      pocket.position.set(0, -0.06, 0.122);
      this.torsoGroup.add(pocket);

      for (const side of [-1, 1]) {
        const string = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.108, 6), titaniumMat);
        string.position.set(side * 0.038, 0.075, 0.138);
        this.torsoGroup.add(string);
      }
    } else if (profile.outfitStyle === "jumpsuit") {
      const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.034, 0.022), accentGlowMat);
      chestStripe.position.set(0, 0.065, 0.128);
      this.torsoGroup.add(chestStripe);

      const belt = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.02, 8, 24), titaniumMat);
      belt.rotation.x = Math.PI / 2;
      belt.position.set(0, -0.06, 0);
      this.torsoGroup.add(belt);

      for (const side of [-1, 1]) {
        const pad = new THREE.Mesh(new THREE.SphereGeometry(0.066, 12, 10), accentMat);
        pad.scale.set(1.15, 0.55, 0.9);
        pad.position.set(side * 0.156, 0.13, 0);
        this.torsoGroup.add(pad);
      }
    } else {
      // Scholar Cloak
      const cape = new THREE.Mesh(
        new THREE.CylinderGeometry(0.142, 0.256, 0.34, 24, 1, false, -Math.PI * 0.78, Math.PI * 1.56),
        accentMat
      );
      cape.position.set(0, 0.01, -0.01);
      cape.rotation.y = Math.PI;
      cape.castShadow = true;
      this.torsoGroup.add(cape);

      const brooch = new THREE.Mesh(new THREE.OctahedronGeometry(0.038, 0), accentGlowMat);
      brooch.position.set(0, 0.125, 0.138);
      this.torsoGroup.add(brooch);
    }

    // Neckwear & Layered Clothing Accessories (6 options!)
    this.buildNeckwear(neckwear, accentMat, accentGlowMat, titaniumMat);

    const neck = new THREE.Mesh(shared.neckGeo, skinMat);
    neck.position.y = 0.192;
    this.torsoGroup.add(neck);

    this.bodyPivot.add(this.torsoGroup);

    // ------------------------------------------------------------------
    // Articulated Arms, Rounded Shoulders & Hands
    // ------------------------------------------------------------------
    const sleeveMat = profile.outfitStyle === "overalls" ? innerTeeMat : coatMat;
    const shortSleeves = profile.outfitStyle === "sundress";

    for (const side of [-1, 1]) {
      const pivot = side === -1 ? this.leftArmPivot : this.rightArmPivot;
      pivot.position.set(side * 0.188, 0.59, 0);

      // Smooth rounded shoulder cap eliminates arm-socket seam during waves & strides
      const shoulder = new THREE.Mesh(shared.shoulderCapGeo, shortSleeves ? coatMat : sleeveMat);
      shoulder.position.y = -0.015;
      pivot.add(shoulder);

      const arm = new THREE.Mesh(shared.armGeo, shortSleeves ? skinMat : sleeveMat);
      arm.position.y = -0.11;
      arm.castShadow = true;
      pivot.add(arm);

      if (shortSleeves) {
        const puffSleeve = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), coatMat);
        puffSleeve.position.y = -0.03;
        pivot.add(puffSleeve);
      } else if (profile.outfitStyle === "kimono") {
        const wideSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.094, 0.18, 14), coatMat);
        wideSleeve.position.y = -0.12;
        pivot.add(wideSleeve);
      } else {
        const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.0095, 8, 16), accentMat);
        cuff.rotation.x = Math.PI / 2;
        cuff.position.y = -0.188;
        pivot.add(cuff);
      }

      const hand = new THREE.Mesh(shared.handGeo, skinMat);
      hand.position.y = -0.222;
      hand.castShadow = true;
      pivot.add(hand);

      // Tiny glowing espresso/elixir cup held in right hand when performing "brew" interaction
      if (side === 1) {
        const cup = new THREE.Mesh(
          new THREE.CylinderGeometry(0.032, 0.025, 0.064, 12),
          new THREE.MeshStandardMaterial({
            color: "#fef3c7",
            emissive: "#f59e0b",
            emissiveIntensity: 0.65,
            roughness: 0.2
          })
        );
        cup.position.set(0, -0.245, 0.045);
        cup.visible = this.posture === "brew";
        this.brewCup = cup;
        pivot.add(cup);
      }

      this.bodyPivot.add(pivot);
    }

    // ------------------------------------------------------------------
    // Sculpted Studio Head, Layered Glossy Eyes, Lashes, Nose & Expressions
    // ------------------------------------------------------------------
    this.headPivot.position.set(0, 0.85, 0);

    const skull = new THREE.Mesh(shared.skullGeo, skinMat);
    skull.scale.set(1.01, 0.97, 0.96);
    skull.castShadow = true;
    skull.receiveShadow = true;
    this.headPivot.add(skull);

    // Subtle sculpted button nose adds instant 3D charm from every angle
    const nose = new THREE.Mesh(shared.noseGeo, skinMat);
    nose.scale.set(0.95, 0.72, 0.85);
    nose.position.set(0, -0.015, 0.178);
    this.headPivot.add(nose);

    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(shared.earGeo, skinMat);
      ear.scale.set(0.54, 0.92, 0.72);
      ear.position.set(side * 0.182, -0.01, -0.008);
      this.headPivot.add(ear);

      const innerEar = new THREE.Mesh(shared.innerEarGeo, innerEarMat);
      innerEar.scale.set(0.42, 0.78, 0.5);
      innerEar.position.set(side * 0.19, -0.01, 0.004);
      this.headPivot.add(innerEar);
    }

    const scleraMat = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      roughness: 0.18,
      metalness: 0.02
    });
    const irisMat = new THREE.MeshStandardMaterial({
      color: profile.eyeColor || "#1e293b",
      emissive: profile.eyeColor || "#1e293b",
      emissiveIntensity: profile.eyeColor === "#141b2b" ? 0.08 : 0.24,
      roughness: 0.08,
      metalness: 0.08
    });
    const pupilMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.05 });
    const glintMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    const browColorObj = hairColorObj.clone().lerp(new THREE.Color("#1e293b"), 0.25);
    const browMat = new THREE.MeshStandardMaterial({ color: browColorObj, roughness: 0.55 });
    const lashMat = new THREE.MeshStandardMaterial({ color: "#1e2433", roughness: 0.4 });

    for (const side of [-1, 1]) {
      if (profile.expression === "serene") {
        // Gentle happy-closed curved eye arcs
        const arc = new THREE.Mesh(shared.lashGeo, lashMat);
        arc.position.set(side * 0.066, 0.008, 0.168);
        arc.rotation.z = Math.PI * 0.08;
        this.headPivot.add(arc);
      } else {
        // Layered studio eye group: white sclera + vibrant iris + deep pupil + dual catchlights + upper lash!
        const eyeGroup = new THREE.Group();
        eyeGroup.position.set(side * 0.066, 0.012, 0.164);
        eyeGroup.rotation.y = side * 0.24;

        const sclera = new THREE.Mesh(shared.scleraGeo, scleraMat);
        sclera.scale.set(1.02, 1.12, 0.42);
        eyeGroup.add(sclera);

        const iris = new THREE.Mesh(shared.irisGeo, irisMat);
        iris.scale.set(0.98, 1.1, 0.48);
        iris.position.set(0, -0.001, 0.008);
        eyeGroup.add(iris);

        const pupil = new THREE.Mesh(shared.pupilGeo, pupilMat);
        pupil.scale.set(1.0, 1.08, 0.5);
        pupil.position.set(0, -0.001, 0.014);
        eyeGroup.add(pupil);

        // Dual studio catchlights give warm animated life!
        const glint1 = new THREE.Mesh(shared.glintLargeGeo, glintMat);
        glint1.position.set(-0.008, 0.01, 0.02);
        eyeGroup.add(glint1);

        const glint2 = new THREE.Mesh(shared.glintSmallGeo, glintMat);
        glint2.position.set(0.008, -0.009, 0.019);
        eyeGroup.add(glint2);

        // Crisp upper eyelash curve
        const lash = new THREE.Mesh(shared.lashGeo, lashMat);
        lash.position.set(0, 0.009, 0.012);
        lash.rotation.z = Math.PI * 0.08;
        eyeGroup.add(lash);

        this.headPivot.add(eyeGroup);
        this.eyes.push(eyeGroup);
      }

      // Expressive sculpted eyebrows sitting cleanly below the hairline
      const brow = new THREE.Mesh(shared.browGeo, browMat);
      brow.position.set(side * 0.066, 0.06, 0.164);
      brow.rotation.y = side * 0.22;
      brow.rotation.z =
        Math.PI / 2 +
        (profile.expression === "focused"
          ? -side * 0.16
          : profile.expression === "delighted"
            ? side * 0.14
            : side * 0.05);
      this.headPivot.add(brow);
    }

    // Soft studio rosy blush cheeks
    const blushMat = new THREE.MeshBasicMaterial({
      color: "#fb7185",
      transparent: true,
      opacity: profile.expression === "delighted" ? 0.36 : 0.22,
      depthWrite: false
    });
    for (const side of [-1, 1]) {
      const blush = new THREE.Mesh(shared.blushGeo, blushMat);
      blush.scale.set(1.22, 0.72, 1);
      blush.position.set(side * 0.104, -0.032, 0.156);
      blush.rotation.y = side * 0.44;
      this.headPivot.add(blush);
    }

    // Expression-driven mouth
    const mouthMat = new THREE.MeshBasicMaterial({ color: "#7c4a46" });
    if (profile.expression === "focused") {
      const line = new THREE.Mesh(new THREE.CapsuleGeometry(0.0042, 0.03, 4, 8), mouthMat);
      line.rotation.z = Math.PI / 2;
      line.position.set(0, -0.058, 0.172);
      this.headPivot.add(line);
    } else if (profile.expression === "delighted") {
      const openSmile = new THREE.Mesh(
        new THREE.CircleGeometry(0.025, 16, Math.PI, Math.PI),
        mouthMat
      );
      openSmile.position.set(0, -0.047, 0.174);
      this.headPivot.add(openSmile);
      const tongue = new THREE.Mesh(
        new THREE.CircleGeometry(0.015, 12, Math.PI, Math.PI),
        new THREE.MeshBasicMaterial({ color: "#f472b6" })
      );
      tongue.position.set(0, -0.055, 0.175);
      this.headPivot.add(tongue);
    } else {
      const smile = new THREE.Mesh(
        new THREE.TorusGeometry(0.026, 0.0052, 8, 16, Math.PI * 0.85),
        mouthMat
      );
      smile.position.set(0, -0.048, 0.17);
      smile.rotation.z = Math.PI * 1.075;
      this.headPivot.add(smile);
    }

    this.buildHair(profile.hairStyle, hairMat, titaniumMat);
    this.buildEyewear(profile.eyewear, titaniumMat, accentGlowMat, glassMat);
    this.buildHeadwear(profile.headwear, titaniumMat, accentMat, accentGlowMat);

    this.bodyPivot.add(this.headPivot);
    this.buildBackpack(profile.backpack, profile.outfitAccent, titaniumMat, glassMat, accentGlowMat);

    // Iconic Sims-style floating rotating translucent Plumbob crystal above active researcher!
    if (this.enablePlumbob) {
      const pGroup = new THREE.Group();
      pGroup.position.set(0, 1.38, 0);
      const pMat = new THREE.MeshPhysicalMaterial({
        color: this.plumbobColor,
        emissive: this.plumbobColor,
        emissiveIntensity: 0.72,
        roughness: 0.08,
        metalness: 0.15,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.9
      });
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.088, 0), pMat);
      crystal.scale.set(0.68, 1.48, 0.68);
      pGroup.add(crystal);

      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.092, 0)),
        new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.7 })
      );
      wire.scale.copy(crystal.scale);
      pGroup.add(wire);

      if (typeof document !== "undefined") {
        const glowTex = createRadialGlowTexture(this.plumbobColor);
        this.ownedTextures.push(glowTex);
        const glow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowTex,
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        glow.scale.set(0.42, 0.52, 1);
        pGroup.add(glow);
      }

      this.plumbobMat = pMat;
      pGroup.scale.setScalar(this.plumbobScale);
      this.plumbobGroup = pGroup;
      this.bodyPivot.add(pGroup);
    }

    this.scaleGroup.add(this.bodyPivot);
    this.root.add(this.scaleGroup);
    if (this.lastStatusKey) {
      const [n, sub, col] = this.lastStatusKey.split("|");
      this.lastStatusKey = "";
      this.setStatusTag(n, sub, col);
    }
  }

  private buildNeckwear(
    neckwear: NonNullable<CharacterProfile["neckwear"]>,
    accentMat: THREE.Material,
    accentGlowMat: THREE.Material,
    titaniumMat: THREE.Material
  ) {
    if (neckwear === "none") return;

    if (neckwear === "scarf") {
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.096, 0.032, 10, 22), accentMat);
      wrap.rotation.x = Math.PI / 2 + 0.1;
      wrap.position.set(0, 0.165, 0.01);
      wrap.castShadow = true;
      this.torsoGroup.add(wrap);

      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.165, 0.022), accentMat);
      tail.position.set(0.06, 0.08, 0.132);
      tail.rotation.z = -0.14;
      this.torsoGroup.add(tail);
    } else if (neckwear === "bowtie") {
      for (const side of [-1, 1]) {
        const loop = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.064, 8), accentMat);
        loop.rotation.z = side * (Math.PI / 2);
        loop.position.set(side * 0.03, 0.142, 0.138);
        this.torsoGroup.add(loop);
      }
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 10), titaniumMat);
      knot.position.set(0, 0.142, 0.144);
      this.torsoGroup.add(knot);
    } else if (neckwear === "necklace") {
      const chain = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.008, 8, 22), titaniumMat);
      chain.rotation.x = Math.PI / 2 + 0.42;
      chain.position.set(0, 0.135, 0.035);
      this.torsoGroup.add(chain);

      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.026, 0), accentGlowMat);
      gem.position.set(0, 0.095, 0.14);
      this.torsoGroup.add(gem);
    } else if (neckwear === "stethoscope") {
      const tube = new THREE.Mesh(
        new THREE.TorusGeometry(0.112, 0.011, 8, 24, Math.PI * 1.45),
        new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.35 })
      );
      tube.rotation.x = Math.PI / 2 + 0.32;
      tube.rotation.z = -Math.PI * 0.22;
      tube.position.set(0, 0.14, 0.01);
      this.torsoGroup.add(tube);

      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.014, 14), titaniumMat);
      disc.rotation.x = Math.PI / 2;
      disc.position.set(0.074, 0.055, 0.142);
      this.torsoGroup.add(disc);
    } else if (neckwear === "tie") {
      const knot = new THREE.Mesh(new THREE.OctahedronGeometry(0.02, 0), accentMat);
      knot.position.set(0, 0.145, 0.136);
      this.torsoGroup.add(knot);
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.155, 4), accentMat);
      blade.rotation.z = Math.PI;
      blade.scale.set(1, 1, 0.35);
      blade.position.set(0, 0.055, 0.138);
      this.torsoGroup.add(blade);
    }
  }

  /**
   * Builds all 9 sculpted hairstyles cleanly framing the face (+Z) with zero clipping!
   * Note Three.js CylinderGeometry convention: theta = 0 is +Z (front of face),
   * so open-front wrap cylinders span thetaStart = 0.38*PI .. 1.62*PI with rotation.y = 0!
   */
  private buildHair(
    style: CharacterProfile["hairStyle"],
    hairMat: THREE.Material,
    titaniumMat: THREE.Material
  ) {
    const shared = getSharedAvatarAssets();

    // Tilted upper-hemisphere crown cap: hairline sits cleanly at y ≈ +0.092 above eyebrows,
    // while sweeping down naturally over the back nape of the head!
    const cap = new THREE.Mesh(shared.hairCapGeo, hairMat);
    cap.position.set(0, 0.028, -0.022);
    cap.rotation.x = -0.32;
    cap.castShadow = true;
    this.headPivot.add(cap);

    // Subtle back-of-head volume cushion so every hairstyle looks lush from 360° orbit
    const nape = new THREE.Mesh(new THREE.SphereGeometry(0.165, 18, 14), hairMat);
    nape.scale.set(0.96, 0.88, 0.78);
    nape.position.set(0, -0.01, -0.072);
    nape.castShadow = true;
    this.headPivot.add(nape);

    // Helper: soft side-swept forehead bangs staying cleanly above y >= +0.084 (never blocking eyes!)
    const addSidePartBangs = (flip = 1) => {
      const mainSweep = new THREE.Mesh(new THREE.SphereGeometry(0.088, 14, 12), hairMat);
      mainSweep.scale.set(1.42, 0.44, 0.58);
      mainSweep.position.set(-0.042 * flip, 0.128, 0.128);
      mainSweep.rotation.set(0.14, 0.15 * flip, -0.22 * flip);
      this.headPivot.add(mainSweep);

      const accentSweep = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), hairMat);
      accentSweep.scale.set(1.18, 0.4, 0.52);
      accentSweep.position.set(0.082 * flip, 0.124, 0.118);
      accentSweep.rotation.set(0.14, -0.25 * flip, 0.24 * flip);
      this.headPivot.add(accentSweep);
    };

    if (style === "buzz") {
      // Clean architectural cropped taper with subtle sideburns behind the cheeks
      for (const side of [-1, 1]) {
        const taper = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.052, 6, 8), hairMat);
        taper.position.set(side * 0.172, 0.015, 0.022);
        taper.rotation.z = side * 0.12;
        this.headPivot.add(taper);
      }
    } else if (style === "bob") {
      // Sleek chin-length architectural bob: open 136° front window around +Z (rotation.y = 0!)
      const bobWrap = new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.194,
          0.204,
          0.22,
          24,
          1,
          true,
          Math.PI * 0.38,
          Math.PI * 1.24
        ),
        hairMat
      );
      bobWrap.position.set(0, -0.052, -0.016);
      bobWrap.castShadow = true;
      // Double-sided inner shell so looking slightly upward never reveals a hollow edge
      (bobWrap.material as THREE.Material).side = THREE.DoubleSide;
      this.headPivot.add(bobWrap);

      // Gently curved lower bob cushion tucking inward at the back
      const bobHem = new THREE.Mesh(
        new THREE.TorusGeometry(0.186, 0.024, 8, 22, Math.PI * 1.24),
        hairMat
      );
      bobHem.rotation.x = Math.PI / 2;
      bobHem.rotation.z = Math.PI * 0.88;
      bobHem.position.set(0, -0.155, -0.016);
      this.headPivot.add(bobHem);

      // Delicate side-framing locks hugging cleanly outside the cheeks (z = 0.05, clear of face!)
      for (const side of [-1, 1]) {
        const sideLock = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.135, 8, 12), hairMat);
        sideLock.position.set(side * 0.176, -0.042, 0.042);
        sideLock.rotation.z = -side * 0.12;
        sideLock.castShadow = true;
        this.headPivot.add(sideLock);
      }

      addSidePartBangs(1);
    } else if (style === "bun") {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.094, 16, 16), hairMat);
      bun.position.set(0, 0.252, -0.055);
      bun.castShadow = true;
      this.headPivot.add(bun);

      const band = new THREE.Mesh(new THREE.TorusGeometry(0.076, 0.014, 8, 20), titaniumMat);
      band.rotation.x = Math.PI / 2;
      band.position.set(0, 0.205, -0.055);
      this.headPivot.add(band);

      for (const side of [-1, 1]) {
        const lock = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.09, 6, 10), hairMat);
        lock.position.set(side * 0.168, -0.005, 0.055);
        lock.rotation.z = side * 0.12;
        this.headPivot.add(lock);
      }
      addSidePartBangs(-1);
    } else if (style === "spiky") {
      const tuftGeo = new THREE.ConeGeometry(0.064, 0.155, 8);
      const positions: Array<[number, number, number, number, number]> = [
        [0, 0.228, 0.045, 0.36, 0],
        [-0.085, 0.208, 0.032, 0.3, 0.44],
        [0.092, 0.198, 0.018, 0.22, -0.48],
        [0.02, 0.215, -0.068, -0.35, -0.1],
        [-0.075, 0.185, -0.078, -0.3, 0.35],
        [0.08, 0.175, -0.075, -0.28, -0.35]
      ];
      for (const [x, y, z, rx, rz] of positions) {
        const t = new THREE.Mesh(tuftGeo, hairMat);
        t.position.set(x, y, z);
        t.rotation.set(rx, 0, rz);
        t.castShadow = true;
        this.headPivot.add(t);
      }
    } else if (style === "long") {
      const drape = new THREE.Mesh(new THREE.CapsuleGeometry(0.168, 0.25, 12, 18), hairMat);
      drape.scale.set(1.06, 1.0, 0.56);
      drape.position.set(0, -0.15, -0.112);
      drape.castShadow = true;
      this.headPivot.add(drape);
      this.hairSwayParts.push(drape);

      for (const side of [-1, 1]) {
        const strand = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.19, 8, 12), hairMat);
        strand.position.set(side * 0.168, -0.082, 0.032);
        strand.rotation.z = -side * 0.06;
        strand.castShadow = true;
        this.headPivot.add(strand);
      }
      addSidePartBangs(1);
    } else if (style === "curly") {
      const puffGeo = new THREE.SphereGeometry(0.082, 14, 14);
      const puffs: Array<[number, number, number]> = [
        [0, 0.215, 0.015],
        [-0.115, 0.178, 0.022],
        [0.115, 0.178, 0.022],
        [-0.178, 0.085, -0.02],
        [0.178, 0.085, -0.02],
        [-0.175, -0.015, -0.035],
        [0.175, -0.015, -0.035],
        [-0.12, 0.145, -0.115],
        [0.12, 0.145, -0.115],
        [0, 0.165, -0.145],
        [0, 0.04, -0.172]
      ];
      for (const [x, y, z] of puffs) {
        const p = new THREE.Mesh(puffGeo, hairMat);
        p.position.set(x, y, z);
        p.castShadow = true;
        this.headPivot.add(p);
      }
    } else if (style === "pigtails") {
      addSidePartBangs(1);
      for (const side of [-1, 1]) {
        const pigtailPivot = new THREE.Group();
        pigtailPivot.position.set(side * 0.17, 0.125, -0.03);

        const band = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.012, 8, 16), titaniumMat);
        band.rotation.y = Math.PI / 2;
        pigtailPivot.add(band);

        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.088, 16, 14), hairMat);
        puff.position.set(side * 0.052, 0.012, -0.01);
        puff.castShadow = true;
        pigtailPivot.add(puff);

        const tailDrop = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.12, 8, 12), hairMat);
        tailDrop.position.set(side * 0.072, -0.085, -0.02);
        tailDrop.rotation.z = side * 0.18;
        tailDrop.castShadow = true;
        pigtailPivot.add(tailDrop);

        this.headPivot.add(pigtailPivot);
        this.hairSwayParts.push(pigtailPivot);
      }
    } else if (style === "ponytail") {
      addSidePartBangs(-1);
      const ponyPivot = new THREE.Group();
      ponyPivot.position.set(0, 0.14, -0.188);

      const band = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.013, 8, 18), titaniumMat);
      ponyPivot.add(band);

      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.066, 0.22, 10, 14), hairMat);
      tail.position.set(0, -0.12, -0.06);
      tail.rotation.x = 0.26;
      tail.castShadow = true;
      ponyPivot.add(tail);

      this.headPivot.add(ponyPivot);
      this.hairSwayParts.push(ponyPivot);
    } else if (style === "waves") {
      addSidePartBangs(1);
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const wave = new THREE.Mesh(new THREE.SphereGeometry(0.074 - i * 0.008, 14, 12), hairMat);
          wave.position.set(side * (0.172 + (i % 2) * 0.015), -0.015 - i * 0.095, -0.025 - i * 0.015);
          wave.castShadow = true;
          this.headPivot.add(wave);
        }
      }
      const backWave = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.2, 10, 14), hairMat);
      backWave.scale.set(1.05, 1.0, 0.58);
      backWave.position.set(0, -0.11, -0.105);
      this.headPivot.add(backWave);
      this.hairSwayParts.push(backWave);
    }
  }

  private buildEyewear(
    eyewear: CharacterProfile["eyewear"],
    titaniumMat: THREE.Material,
    accentGlowMat: THREE.Material,
    glassMat: THREE.Material
  ) {
    if (eyewear === "none") return;

    if (eyewear === "round") {
      for (const side of [-1, 1]) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.0065, 8, 22), titaniumMat);
        rim.position.set(side * 0.066, 0.012, 0.188);
        this.headPivot.add(rim);
      }
      const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.046, 8), titaniumMat);
      bridge.rotation.z = Math.PI / 2;
      bridge.position.set(0, 0.016, 0.188);
      this.headPivot.add(bridge);
    } else if (eyewear === "goggles") {
      const strap = new THREE.Mesh(
        new THREE.TorusGeometry(0.194, 0.014, 8, 28),
        new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.45 })
      );
      strap.rotation.x = Math.PI / 2 - 0.34;
      strap.position.set(0, 0.1, 0.006);
      this.headPivot.add(strap);

      for (const side of [-1, 1]) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.011, 10, 22), titaniumMat);
        rim.position.set(side * 0.062, 0.132, 0.168);
        rim.rotation.x = -0.34;
        this.headPivot.add(rim);

        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.042, 18), accentGlowMat);
        lens.position.copy(rim.position);
        lens.rotation.copy(rim.rotation);
        this.headPivot.add(lens);
      }
    } else if (eyewear === "visor") {
      const visor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.198, 0.198, 0.076, 24, 1, true, -Math.PI * 0.36, Math.PI * 0.72),
        glassMat
      );
      visor.position.set(0, 0.018, 0.006);
      this.headPivot.add(visor);

      const trim = new THREE.Mesh(
        new THREE.TorusGeometry(0.199, 0.007, 8, 24, Math.PI * 0.72),
        accentGlowMat
      );
      trim.rotation.x = Math.PI / 2;
      trim.rotation.z = Math.PI * 0.14;
      trim.position.set(0, 0.056, 0.006);
      this.headPivot.add(trim);
    } else if (eyewear === "shades") {
      const darkLens = new THREE.MeshStandardMaterial({
        color: "#0f172a",
        roughness: 0.08,
        metalness: 0.85
      });
      for (const side of [-1, 1]) {
        const lens = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.05, 0.018), darkLens);
        lens.position.set(side * 0.064, 0.014, 0.188);
        this.headPivot.add(lens);
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.188, 0.012, 0.016), titaniumMat);
      bar.position.set(0, 0.036, 0.19);
      this.headPivot.add(bar);
    }
  }

  private buildHeadwear(
    headwear: CharacterProfile["headwear"],
    titaniumMat: THREE.Material,
    accentMat: THREE.Material,
    accentGlowMat: THREE.Material
  ) {
    if (headwear === "none") return;

    if (headwear === "beret") {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.175, 22, 14), accentMat);
      cap.scale.set(1.22, 0.38, 1.16);
      cap.position.set(0.035, 0.22, -0.02);
      cap.rotation.z = -0.22;
      cap.castShadow = true;
      this.headPivot.add(cap);

      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.048, 8), accentMat);
      stem.position.set(0.052, 0.29, -0.02);
      stem.rotation.z = -0.22;
      this.headPivot.add(stem);
    } else if (headwear === "halo") {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.014, 10, 32), accentGlowMat);
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.315;
      this.haloRing = halo;
      this.headPivot.add(halo);
    } else if (headwear === "headphones") {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.208, 0.016, 10, 28, Math.PI),
        titaniumMat
      );
      band.position.y = 0.032;
      this.headPivot.add(band);

      for (const side of [-1, 1]) {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.056, 0.045, 16), accentMat);
        cup.rotation.z = Math.PI / 2;
        cup.position.set(side * 0.208, 0.0, 0);
        cup.castShadow = true;
        this.headPivot.add(cup);
      }
    } else if (headwear === "cap") {
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.198, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.46),
        accentMat
      );
      dome.position.set(0, 0.052, -0.008);
      dome.castShadow = true;
      this.headPivot.add(dome);

      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.195, 0.018, 20), accentMat);
      brim.scale.set(0.95, 1, 0.72);
      brim.position.set(0, 0.095, 0.14);
      brim.rotation.x = 0.08;
      this.headPivot.add(brim);
    } else if (headwear === "catears") {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.198, 0.012, 8, 28, Math.PI),
        titaniumMat
      );
      band.position.y = 0.028;
      this.headPivot.add(band);
      const innerMat = new THREE.MeshStandardMaterial({ color: "#fbcfe8", roughness: 0.45 });
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.056, 0.125, 4), titaniumMat);
        ear.position.set(side * 0.115, 0.235, 0.01);
        ear.rotation.z = -side * 0.28;
        ear.castShadow = true;
        this.headPivot.add(ear);
        const inner = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.078, 4), innerMat);
        inner.position.set(side * 0.112, 0.228, 0.03);
        inner.rotation.z = -side * 0.28;
        this.headPivot.add(inner);
      }
    } else if (headwear === "bow") {
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 10), accentMat);
        wing.scale.set(1.25, 0.65, 0.55);
        wing.position.set(side * 0.075, 0.23, 0.042);
        wing.rotation.z = side * 0.22;
        wing.castShadow = true;
        this.headPivot.add(wing);
      }
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 10), titaniumMat);
      knot.position.set(0, 0.225, 0.052);
      this.headPivot.add(knot);
    } else if (headwear === "beanie") {
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.204, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.5),
        accentMat
      );
      dome.position.set(0, 0.056, -0.014);
      dome.rotation.x = -0.18;
      dome.castShadow = true;
      this.headPivot.add(dome);
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.194, 0.026, 10, 28), accentMat);
      cuff.rotation.x = Math.PI / 2 - 0.18;
      cuff.position.set(0, 0.095, -0.012);
      this.headPivot.add(cuff);
      const pom = new THREE.Mesh(
        new THREE.SphereGeometry(0.054, 14, 12),
        new THREE.MeshStandardMaterial({ color: "#f8fafd", roughness: 0.8 })
      );
      pom.position.set(0, 0.275, -0.04);
      this.headPivot.add(pom);
    } else if (headwear === "crown") {
      const base = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.011, 8, 28), titaniumMat);
      base.rotation.x = Math.PI / 2;
      base.position.set(0, 0.2, 0.008);
      this.headPivot.add(base);
      const spikes: Array<[number, number, number]> = [
        [0, 0.26, 0.132],
        [-0.082, 0.24, 0.102],
        [0.082, 0.24, 0.102]
      ];
      spikes.forEach(([sx, sy, sz], i) => {
        const sp = new THREE.Mesh(
          new THREE.OctahedronGeometry(i === 0 ? 0.032 : 0.022, 0),
          i === 0 ? accentGlowMat : titaniumMat
        );
        sp.scale.set(0.7, 1.5, 0.7);
        sp.position.set(sx, sy, sz);
        this.headPivot.add(sp);
      });
    }
  }

  private buildBackpack(
    backpack: CharacterProfile["backpack"],
    accentHex: string,
    titaniumMat: THREE.Material,
    glassMat: THREE.Material,
    accentGlowMat: THREE.Material
  ) {
    if (backpack === "none") return;

    if (backpack === "flaskpack") {
      const pack = new THREE.Group();
      pack.position.set(0, 0.02, -0.17);

      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.24, 0.06), titaniumMat);
      frame.castShadow = true;
      pack.add(frame);

      for (const side of [-1, 1]) {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.2, 14), glassMat);
        tube.position.set(side * 0.044, 0.01, -0.04);
        pack.add(tube);

        const liquid = new THREE.Mesh(
          new THREE.CylinderGeometry(0.026, 0.026, 0.13, 12),
          accentGlowMat
        );
        liquid.position.set(side * 0.044, -0.015, -0.04);
        pack.add(liquid);
      }

      this.torsoGroup.add(pack);
    } else if (backpack === "satchel") {
      const strap = new THREE.Mesh(
        new THREE.TorusGeometry(0.185, 0.014, 8, 28),
        new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.55 })
      );
      strap.rotation.set(0.15, 0.55, 0.55);
      this.torsoGroup.add(strap);

      const bag = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.14, 0.07),
        new THREE.MeshStandardMaterial({ color: "#d6c5ae", roughness: 0.62 })
      );
      bag.position.set(0.16, -0.11, -0.06);
      bag.rotation.y = 0.4;
      bag.castShadow = true;
      this.torsoGroup.add(bag);
    } else if (backpack === "holodrone") {
      const drone = new THREE.Group();
      drone.position.set(-0.34, 0.46, -0.14);

      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.062, 0), accentGlowMat);
      drone.add(core);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.01, 8, 24), titaniumMat);
      ring.rotation.x = Math.PI / 2;
      drone.add(ring);

      if (typeof document !== "undefined") {
        const glowTex = createRadialGlowTexture(accentHex);
        this.ownedTextures.push(glowTex);
        const glow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowTex,
            transparent: true,
            opacity: 0.68,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        glow.scale.set(0.32, 0.32, 1);
        drone.add(glow);
      }

      this.holoDrone = drone;
      this.torsoGroup.add(drone);
    } else if (backpack === "wings") {
      const wingMat = createFastArchitecturalGlass({
        color: accentHex,
        emissive: accentHex,
        emissiveIntensity: 0.42,
        roughness: 0.08,
        opacity: 0.68,
        side: THREE.DoubleSide
      });
      for (const side of [-1, 1]) {
        const wingPivot = new THREE.Group();
        wingPivot.position.set(side * 0.06, 0.05, -0.145);

        const upper = new THREE.Mesh(new THREE.CircleGeometry(0.18, 16), wingMat);
        upper.scale.set(1.25, 0.68, 1);
        upper.position.set(side * 0.17, 0.07, -0.02);
        upper.rotation.z = side * 0.36;
        wingPivot.add(upper);

        const lower = new THREE.Mesh(new THREE.CircleGeometry(0.125, 14), wingMat);
        lower.scale.set(1.1, 0.65, 1);
        lower.position.set(side * 0.12, -0.075, -0.02);
        lower.rotation.z = -side * 0.25;
        wingPivot.add(lower);

        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.007, 6, 20), titaniumMat);
        rim.scale.set(1.4, 0.72, 1);
        rim.position.set(side * 0.16, 0.07, -0.018);
        rim.rotation.z = side * 0.36;
        wingPivot.add(rim);

        if (side === -1) this.leftWing = wingPivot;
        else this.rightWing = wingPivot;
        this.torsoGroup.add(wingPivot);
      }
    } else if (backpack === "plushpack") {
      const pack = new THREE.Group();
      pack.position.set(0, -0.01, -0.18);
      const plushMat = new THREE.MeshStandardMaterial({ color: "#fdf2f8", roughness: 0.82 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 14), plushMat);
      body.scale.set(1.05, 1.1, 0.72);
      body.castShadow = true;
      pack.add(body);
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.07, 4), plushMat);
        ear.position.set(side * 0.068, 0.115, 0);
        ear.rotation.z = -side * 0.25;
        pack.add(ear);
        const eye = new THREE.Mesh(
          new THREE.SphereGeometry(0.014, 8, 8),
          new THREE.MeshBasicMaterial({ color: "#334155" })
        );
        eye.position.set(side * 0.042, 0.02, -0.082);
        pack.add(eye);
      }
      const bow = new THREE.Mesh(new THREE.OctahedronGeometry(0.028, 0), accentGlowMat);
      bow.position.set(0, -0.055, -0.085);
      pack.add(bow);
      this.torsoGroup.add(pack);
    } else if (backpack === "capelet") {
      const drape = new THREE.Mesh(
        new THREE.CylinderGeometry(0.135, 0.29, 0.42, 22, 1, true, Math.PI * 0.62, Math.PI * 0.76),
        glassMat
      );
      drape.position.set(0, -0.04, -0.02);
      this.torsoGroup.add(drape);
      const starClasp = new THREE.Mesh(new THREE.OctahedronGeometry(0.034, 0), accentGlowMat);
      starClasp.position.set(0, 0.145, -0.15);
      this.torsoGroup.add(starClasp);
    }
  }

  /**
   * Frame-rate independent kinematic update with heel-strike synced footstep callback,
   * natural breathing chest motion, subtle hair sway, eye blinks & turn banking.
   */
  public update(
    dt: number,
    t: number,
    speedNorm: number,
    isMoving: boolean,
    turnBank = 0,
    onFootstep?: () => void
  ) {
    const damp12 = 1 - Math.exp(-12 * dt);
    const damp14 = 1 - Math.exp(-14 * dt);

    if (isMoving) {
      this.walkCycle += dt * (8.4 + speedNorm * 5.2);
      const curSign = Math.sin(this.walkCycle) >= 0 ? 1 : -1;
      if (this.prevStrideSign !== 0 && curSign !== this.prevStrideSign && speedNorm > 0.2) {
        onFootstep?.();
      }
      this.prevStrideSign = curSign;
    } else {
      this.prevStrideSign = 0;
    }

    const isSitting = !isMoving && this.posture === "sit";
    const isBrewing = !isMoving && this.posture === "brew";
    const isAnalyzing = !isMoving && this.posture === "analyze";

    const stride = isMoving ? Math.sin(this.walkCycle) * (0.42 + speedNorm * 0.34) : 0;
    const targetLeftLeg = isSitting ? -1.36 : stride;
    const targetRightLeg = isSitting ? -1.36 : -stride;
    const armStride = isMoving ? -stride * 0.88 : Math.sin(t * 1.8) * 0.04;
    const targetLeftArm = isSitting
      ? -0.45
      : isAnalyzing
        ? -0.92 + Math.sin(t * 9.5) * 0.14
        : armStride;

    this.leftLegPivot.rotation.x = THREE.MathUtils.lerp(this.leftLegPivot.rotation.x, targetLeftLeg, damp14);
    this.rightLegPivot.rotation.x = THREE.MathUtils.lerp(this.rightLegPivot.rotation.x, targetRightLeg, damp14);
    this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, targetLeftArm, damp12);
    this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(this.leftArmPivot.rotation.z, 0.14, damp12);

    let emoteHopY = 0;
    let emoteSpinY = 0;
    let waving = false;

    if (this.emoteKind) {
      this.emoteTime += dt;
      const p = Math.min(1, this.emoteTime / Math.max(0.01, this.emoteDuration));
      if (this.emoteKind === "hop") {
        emoteHopY = Math.sin(p * Math.PI) * 0.2;
      } else if (this.emoteKind === "spin") {
        emoteSpinY = p * Math.PI * 2;
        emoteHopY = Math.sin(p * Math.PI) * 0.12;
      } else if (this.emoteKind === "wave") {
        waving = true;
        emoteHopY = Math.sin(p * Math.PI) * 0.06;
        this.rightArmPivot.rotation.z = -2.35 + Math.sin(t * 18) * 0.34;
        this.rightArmPivot.rotation.x = -0.35;
      }
      if (p >= 1) {
        this.emoteKind = null;
      }
    }

    if (!waving) {
      const targetRightArmX = isBrewing
        ? -1.25 + Math.sin(t * 3.8) * 0.18
        : isAnalyzing
          ? -0.92 + Math.cos(t * 9.2) * 0.14
          : isSitting
            ? -0.45
            : -armStride;
      this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(
        this.rightArmPivot.rotation.x,
        targetRightArmX,
        damp12
      );
      this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(
        this.rightArmPivot.rotation.z,
        isBrewing ? -0.35 : -0.14,
        damp12
      );
    }

    // Subtle organic breathing motion on torso
    this.torsoGroup.scale.y = 1 + Math.sin(t * 2.2) * 0.012;

    const walkBob = isMoving
      ? Math.abs(Math.sin(this.walkCycle)) * (0.038 + speedNorm * 0.03)
      : isSitting
        ? -0.14
        : Math.sin(t * 2.2) * 0.01;
    this.bodyPivot.position.y = THREE.MathUtils.lerp(
      this.bodyPivot.position.y,
      walkBob + emoteHopY,
      damp14
    );
    this.bodyPivot.rotation.y = emoteSpinY;
    this.bodyPivot.rotation.x = THREE.MathUtils.lerp(
      this.bodyPivot.rotation.x,
      isMoving ? 0.055 + speedNorm * 0.1 : isAnalyzing ? 0.1 : 0,
      damp12
    );
    // Subtle physical lean into turns
    const clampedBank = Math.max(-0.18, Math.min(0.18, turnBank));
    this.bodyPivot.rotation.z = THREE.MathUtils.lerp(this.bodyPivot.rotation.z, clampedBank, damp12);

    if (this.plumbobGroup) {
      this.plumbobGroup.rotation.y = t * 1.65;
      this.plumbobGroup.position.y = 1.38 + Math.sin(t * 2.8) * 0.045;
    }

    // Natural head tilt & look into turns
    this.headPivot.rotation.z = Math.sin(t * 1.45) * 0.036 - clampedBank * 0.35;
    this.headPivot.rotation.y = isMoving
      ? THREE.MathUtils.lerp(this.headPivot.rotation.y, -clampedBank * 0.75, damp12)
      : Math.sin(t * 0.85) * 0.12;

    const blink = Math.sin(t * 0.72 + 1.1) > 0.976;
    for (const eye of this.eyes) {
      eye.scale.y = blink ? 0.12 : 1.0;
    }

    // Gentle lively bounce on long hair / ponytails / pigtails while walking!
    if (this.hairSwayParts.length > 0) {
      const sway = isMoving ? 0.08 + Math.abs(Math.sin(this.walkCycle)) * 0.12 : Math.sin(t * 1.8) * 0.03;
      for (const hp of this.hairSwayParts) {
        hp.rotation.x = THREE.MathUtils.lerp(hp.rotation.x, sway, damp12);
      }
    }

    if (this.haloRing) {
      this.haloRing.position.y = 0.315 + Math.sin(t * 2.8) * 0.016;
      this.haloRing.rotation.z = t * 0.9;
    }

    if (this.holoDrone) {
      this.holoDrone.position.set(
        -0.34 + Math.sin(t * 1.8) * 0.04,
        0.44 + Math.cos(t * 2.4) * 0.06,
        -0.12 + Math.cos(t * 1.5) * 0.04
      );
      this.holoDrone.rotation.y = t * 2.1;
    }

    if (this.leftWing && this.rightWing) {
      const flutter = Math.sin(t * (isMoving ? 9.5 : 4.2)) * 0.24;
      this.leftWing.rotation.y = -0.32 - flutter;
      this.rightWing.rotation.y = 0.32 + flutter;
    }

    if (this.hoverRings.length > 0) {
      const pulse = 0.94 + Math.sin(t * 5.2) * 0.09;
      for (const ring of this.hoverRings) {
        ring.scale.setScalar(pulse);
      }
    }

    if (this.shadowDisc) {
      const s = Math.max(0.7, (1 - (walkBob + emoteHopY) * 0.85) * this.currentHeightScale);
      this.shadowDisc.scale.setScalar(s);
    }
  }

  public disposeRig() {
    const shared = sharedAssetsCache;
    this.root.traverse((obj) => {
      if (obj === this.root) return;
      const meshLike = obj as THREE.Mesh;
      if (meshLike.geometry && (!shared || !shared.geometries.has(meshLike.geometry))) {
        meshLike.geometry.dispose();
      }
      if (meshLike.material) {
        const mats = Array.isArray(meshLike.material) ? meshLike.material : [meshLike.material];
        for (const m of mats) m.dispose();
      }
    });
    for (const tex of this.ownedTextures) tex.dispose();
    this.ownedTextures = [];
    this.statusTagTex?.dispose();
    this.statusTagTex = null;
    this.statusTagSprite = null;
    while (this.root.children.length > 0) {
      this.root.remove(this.root.children[0]);
    }
    this.shadowDisc = null;
    this.plumbobGroup = null;
    this.plumbobMat = null;
    this.brewCup = null;
    this.leftWing = null;
    this.rightWing = null;
    this.hoverRings = [];
    this.hairSwayParts = [];
  }
}
