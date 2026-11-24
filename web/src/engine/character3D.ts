import * as THREE from "three";
import { createFastArchitecturalGlass } from "./browserCompat";
import { createRadialGlowTexture } from "./architectTextures";
import { BUILD_SCALE_MULTIPLIER, type CharacterProfile } from "./characterConfig";

export type CharacterEmote = "wave" | "spin" | "hop";
export type CharacterPosture = "stand" | "sit" | "brew" | "analyze";

/**
 * Sculptural 3D Procedural Researcher Avatar built to harmonize with ALCHEMIA's
 * porcelain, brushed-titanium, and frosted-borosilicate architectural lab aesthetic.
 *
 * Articulated limbs, iconic Sims-style floating rotating Plumbob crystal (optional),
 * interactive Sims postures (stand/sit/brew/analyze), expressive colored blinking eyes,
 * 4 facial expressions, 3 height/build scales, 6 hairstyles, 5 lab outfits,
 * 5 eyewear styles, 5 headwear styles, 4 backpacks/drones, and heel-strike callbacks.
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
  private eyes: THREE.Mesh[] = [];
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

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
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
    return 0.84 * this.currentHeightScale;
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

    const skinMat = new THREE.MeshStandardMaterial({
      color: profile.skinTone,
      roughness: 0.46,
      metalness: 0.03
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: profile.hairColor,
      roughness: 0.42,
      metalness: 0.08
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
      roughness: 0.38,
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

    // Soft architectural ground contact shadow directly under boots
    const shadowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.24, 24),
      new THREE.MeshBasicMaterial({
        color: "#334155",
        transparent: true,
        opacity: 0.22,
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
    const legRadius = bottomStyle === "wideleg" ? 0.072 : bottomStyle === "joggers" ? 0.064 : 0.056;
    const legGeo = new THREE.CapsuleGeometry(legRadius, 0.14, 8, 12);
    const shoeGeo = new THREE.SphereGeometry(0.066, 12, 10);

    for (const side of [-1, 1]) {
      const pivot = side === -1 ? this.leftLegPivot : this.rightLegPivot;
      pivot.position.set(side * 0.085, 0.29, 0);

      const leg = new THREE.Mesh(legGeo, showBareLegs ? skinMat : trouserMat);
      leg.position.y = -0.11;
      leg.castShadow = true;
      pivot.add(leg);

      if (bottomStyle === "shorts" && profile.outfitStyle !== "sundress") {
        const shortTube = new THREE.Mesh(
          new THREE.CylinderGeometry(0.068, 0.07, 0.11, 14),
          trouserMat
        );
        shortTube.position.y = -0.04;
        shortTube.castShadow = true;
        pivot.add(shortTube);
      } else if (bottomStyle === "joggers" && !showBareLegs) {
        const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.015, 8, 16), accentMat);
        cuff.rotation.x = Math.PI / 2;
        cuff.position.y = -0.19;
        pivot.add(cuff);
      }

      if (showBareLegs || footwearStyle === "maryjanes") {
        const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.052, 0.09, 12), sockMat);
        sock.position.y = -0.195;
        pivot.add(sock);
      }

      // Footwear Styles
      const shoe = new THREE.Mesh(shoeGeo, bootMat);
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
    // Torso, 12 Clothing Silhouettes, Pleated Skirts & 6 Neckwear Details!
    // ------------------------------------------------------------------
    this.torsoGroup.position.set(0, 0.48, 0);

    const coreMat =
      profile.outfitStyle === "labcoat" || profile.outfitStyle === "overalls"
        ? accentMat
        : profile.outfitStyle === "cardigan" || profile.outfitStyle === "blazer"
          ? innerTeeMat
          : coatMat;

    const core = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, 0.18, 12, 18), coreMat);
    core.scale.set(1.02, 1.0, 0.84);
    core.castShadow = true;
    core.receiveShadow = true;
    this.torsoGroup.add(core);

    // Optional Pleated Skirt bottom layer (whenever bottomStyle === "skirt" and not sundress)
    if (bottomStyle === "skirt" && profile.outfitStyle !== "sundress") {
      const skirtMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.156, 0.235, 0.2, 22),
        trouserMat
      );
      skirtMesh.position.set(0, -0.175, 0);
      skirtMesh.castShadow = true;
      this.torsoGroup.add(skirtMesh);

      const hem = new THREE.Mesh(new THREE.TorusGeometry(0.232, 0.01, 8, 28), accentMat);
      hem.rotation.x = Math.PI / 2;
      hem.position.set(0, -0.272, 0);
      this.torsoGroup.add(hem);
    }

    if (profile.outfitStyle === "labcoat") {
      const coatBack = new THREE.Mesh(
        new THREE.CylinderGeometry(0.155, 0.215, 0.42, 20, 1, false, -Math.PI * 0.82, Math.PI * 1.64),
        coatMat
      );
      coatBack.position.set(0, -0.05, 0);
      coatBack.rotation.y = Math.PI;
      coatBack.castShadow = true;
      this.torsoGroup.add(coatBack);

      for (const side of [-1, 1]) {
        const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.16, 0.024), coatMat);
        lapel.position.set(side * 0.068, 0.08, 0.125);
        lapel.rotation.z = -side * 0.26;
        this.torsoGroup.add(lapel);
      }

      const badge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.064, 0.012), accentGlowMat);
      badge.position.set(-0.088, 0.03, 0.145);
      this.torsoGroup.add(badge);
    } else if (profile.outfitStyle === "cardigan") {
      // Cozy open-front knitted cardigan with pearl buttons & soft lapel shawl!
      const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.162, 0.195, 0.34, 20, 1, false, -Math.PI * 0.78, Math.PI * 1.56),
        coatMat
      );
      shell.position.set(0, -0.01, 0);
      shell.rotation.y = Math.PI;
      shell.castShadow = true;
      this.torsoGroup.add(shell);

      for (const side of [-1, 1]) {
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.31, 0.028), accentMat);
        trim.position.set(side * 0.066, -0.01, 0.128);
        this.torsoGroup.add(trim);
      }
      for (const by of [0.06, -0.02, -0.1]) {
        const btn = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 10), titaniumMat);
        btn.position.set(0.066, by, 0.146);
        this.torsoGroup.add(btn);
      }
    } else if (profile.outfitStyle === "sweater") {
      // Chunky folded turtleneck knit sweater with ribbed hem!
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.095, 18), coatMat);
      collar.position.set(0, 0.165, 0);
      this.torsoGroup.add(collar);

      const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.156, 0.022, 8, 24), accentMat);
      stripe.rotation.x = Math.PI / 2;
      stripe.position.set(0, 0.02, 0);
      this.torsoGroup.add(stripe);

      const hem = new THREE.Mesh(new THREE.TorusGeometry(0.156, 0.024, 8, 24), coatMat);
      hem.rotation.x = Math.PI / 2;
      hem.position.set(0, -0.11, 0);
      this.torsoGroup.add(hem);
    } else if (profile.outfitStyle === "blazer") {
      // Tailored Silver Architectural Suit Blazer with crisp lapels & pocket square!
      const jacket = new THREE.Mesh(
        new THREE.CylinderGeometry(0.162, 0.188, 0.34, 20, 1, false, -Math.PI * 0.84, Math.PI * 1.68),
        coatMat
      );
      jacket.position.set(0, -0.01, 0);
      jacket.rotation.y = Math.PI;
      jacket.castShadow = true;
      this.torsoGroup.add(jacket);

      for (const side of [-1, 1]) {
        const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.17, 0.026), coatMat);
        lapel.position.set(side * 0.064, 0.06, 0.13);
        lapel.rotation.z = -side * 0.24;
        this.torsoGroup.add(lapel);
      }
      const pocketSq = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.024, 0.012), accentMat);
      pocketSq.position.set(-0.092, 0.05, 0.145);
      this.torsoGroup.add(pocketSq);
    } else if (profile.outfitStyle === "puffer") {
      // Adorable Quilted Horizontal-Baffle Cloud Puffer Jacket!
      for (const [py, r] of [[0.09, 0.165], [0.0, 0.176], [-0.09, 0.17]] as const) {
        const baffle = new THREE.Mesh(new THREE.TorusGeometry(r, 0.044, 12, 24), coatMat);
        baffle.rotation.x = Math.PI / 2;
        baffle.scale.set(1.02, 0.86, 1.0);
        baffle.position.set(0, py, 0);
        baffle.castShadow = true;
        this.torsoGroup.add(baffle);
      }
      const highCollar = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.036, 10, 20), accentMat);
      highCollar.rotation.x = Math.PI / 2;
      highCollar.position.set(0, 0.165, 0);
      this.torsoGroup.add(highCollar);
    } else if (profile.outfitStyle === "overalls") {
      // Cute Studio Bib Overalls with twin straps, silver buckles & front bib pocket!
      const bib = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.22, 0.06), trouserMat);
      bib.position.set(0, -0.02, 0.11);
      bib.castShadow = true;
      this.torsoGroup.add(bib);

      const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.168, 0.15, 18), trouserMat);
      waist.position.set(0, -0.1, 0);
      this.torsoGroup.add(waist);

      const bibPocket = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.075, 0.02), coatMat);
      bibPocket.position.set(0, 0.01, 0.145);
      this.torsoGroup.add(bibPocket);

      for (const side of [-1, 1]) {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.2, 0.024), trouserMat);
        strap.position.set(side * 0.075, 0.11, 0.105);
        strap.rotation.x = -0.2;
        this.torsoGroup.add(strap);
        const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.028, 0.028), titaniumMat);
        buckle.position.set(side * 0.075, 0.08, 0.132);
        this.torsoGroup.add(buckle);
      }
    } else if (profile.outfitStyle === "sundress") {
      // Flared Pleated Architectural Studio Dress with waist ribbon!
      const dressSkirt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.28, 0.3, 24),
        coatMat
      );
      dressSkirt.position.set(0, -0.17, 0);
      dressSkirt.castShadow = true;
      this.torsoGroup.add(dressSkirt);

      const sash = new THREE.Mesh(new THREE.TorusGeometry(0.156, 0.024, 8, 24), accentMat);
      sash.rotation.x = Math.PI / 2;
      sash.position.set(0, -0.02, 0);
      this.torsoGroup.add(sash);

      const hemTrim = new THREE.Mesh(new THREE.TorusGeometry(0.278, 0.012, 8, 28), accentMat);
      hemTrim.rotation.x = Math.PI / 2;
      hemTrim.position.set(0, -0.315, 0);
      this.torsoGroup.add(hemTrim);
    } else if (profile.outfitStyle === "kimono") {
      // Draped Silk Haori Jacket with Obi Waist Sash & Silver Cord!
      const robe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.23, 0.36, 20),
        coatMat
      );
      robe.position.set(0, -0.04, 0);
      robe.castShadow = true;
      this.torsoGroup.add(robe);

      for (const side of [-1, 1]) {
        const collarV = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.19, 0.025), accentMat);
        collarV.position.set(side * 0.048, 0.08, 0.13);
        collarV.rotation.z = side * 0.34;
        this.torsoGroup.add(collarV);
      }

      const obi = new THREE.Mesh(new THREE.CylinderGeometry(0.174, 0.178, 0.095, 22), accentMat);
      obi.position.set(0, -0.055, 0);
      this.torsoGroup.add(obi);

      const cord = new THREE.Mesh(new THREE.TorusGeometry(0.178, 0.011, 8, 24), titaniumMat);
      cord.rotation.x = Math.PI / 2;
      cord.position.set(0, -0.055, 0);
      this.torsoGroup.add(cord);
    } else if (profile.outfitStyle === "tunic") {
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.21, 0.2, 20), coatMat);
      skirt.position.set(0, -0.14, 0);
      skirt.castShadow = true;
      this.torsoGroup.add(skirt);

      const belt = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.024, 8, 24), accentMat);
      belt.rotation.x = Math.PI / 2;
      belt.position.set(0, -0.04, 0);
      this.torsoGroup.add(belt);

      const clasp = new THREE.Mesh(new THREE.OctahedronGeometry(0.032, 0), titaniumMat);
      clasp.position.set(0, -0.04, 0.16);
      this.torsoGroup.add(clasp);
    } else if (profile.outfitStyle === "hoodie") {
      const hoodRoll = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.042, 10, 22), coatMat);
      hoodRoll.rotation.x = Math.PI / 2 + 0.15;
      hoodRoll.position.set(0, 0.155, -0.03);
      this.torsoGroup.add(hoodRoll);

      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.09, 0.036), innerTeeMat);
      pocket.position.set(0, -0.06, 0.125);
      this.torsoGroup.add(pocket);

      for (const side of [-1, 1]) {
        const string = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.11, 6), titaniumMat);
        string.position.set(side * 0.038, 0.075, 0.142);
        this.torsoGroup.add(string);
      }
    } else if (profile.outfitStyle === "jumpsuit") {
      const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.036, 0.024), accentGlowMat);
      chestStripe.position.set(0, 0.065, 0.132);
      this.torsoGroup.add(chestStripe);

      const belt = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.022, 8, 24), titaniumMat);
      belt.rotation.x = Math.PI / 2;
      belt.position.set(0, -0.06, 0);
      this.torsoGroup.add(belt);

      for (const side of [-1, 1]) {
        const pad = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), accentMat);
        pad.scale.set(1.15, 0.55, 0.9);
        pad.position.set(side * 0.16, 0.13, 0);
        this.torsoGroup.add(pad);
      }
    } else {
      // Scholar Cloak
      const cape = new THREE.Mesh(
        new THREE.CylinderGeometry(0.145, 0.26, 0.34, 24, 1, false, -Math.PI * 0.78, Math.PI * 1.56),
        accentMat
      );
      cape.position.set(0, 0.01, -0.01);
      cape.rotation.y = Math.PI;
      cape.castShadow = true;
      this.torsoGroup.add(cape);

      const brooch = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), accentGlowMat);
      brooch.position.set(0, 0.125, 0.142);
      this.torsoGroup.add(brooch);
    }

    // Neckwear & Layered Clothing Accessories (6 options!)
    this.buildNeckwear(neckwear, accentMat, accentGlowMat, titaniumMat);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.06, 0.09, 14), skinMat);
    neck.position.y = 0.19;
    this.torsoGroup.add(neck);

    this.bodyPivot.add(this.torsoGroup);

    // ------------------------------------------------------------------
    // Articulated Arms & Hands (with short sleeves for sundress / wide for kimono!)
    // ------------------------------------------------------------------
    const sleeveMat =
      profile.outfitStyle === "overalls"
        ? innerTeeMat
        : profile.outfitStyle === "hoodie"
          ? coatMat
          : coatMat;
    const shortSleeves = profile.outfitStyle === "sundress";
    const armGeo = new THREE.CapsuleGeometry(0.045, 0.16, 8, 12);
    const handGeo = new THREE.SphereGeometry(0.046, 12, 12);

    for (const side of [-1, 1]) {
      const pivot = side === -1 ? this.leftArmPivot : this.rightArmPivot;
      pivot.position.set(side * 0.195, 0.59, 0);

      const arm = new THREE.Mesh(armGeo, shortSleeves ? skinMat : sleeveMat);
      arm.position.y = -0.11;
      arm.castShadow = true;
      pivot.add(arm);

      if (shortSleeves) {
        const puffSleeve = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), coatMat);
        puffSleeve.position.y = -0.03;
        pivot.add(puffSleeve);
      } else if (profile.outfitStyle === "kimono") {
        const wideSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.095, 0.18, 14), coatMat);
        wideSleeve.position.y = -0.12;
        pivot.add(wideSleeve);
      } else {
        const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 8, 16), accentMat);
        cuff.rotation.x = Math.PI / 2;
        cuff.position.y = -0.19;
        pivot.add(cuff);
      }

      const hand = new THREE.Mesh(handGeo, skinMat);
      hand.position.y = -0.225;
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
    // Head, Luminous Colored Eyes, Sculpted Expressions, Hair & Gear
    // ------------------------------------------------------------------
    this.headPivot.position.set(0, 0.84, 0);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.185, 24, 24), skinMat);
    skull.scale.set(1.0, 0.96, 0.96);
    skull.castShadow = true;
    skull.receiveShadow = true;
    this.headPivot.add(skull);

    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), skinMat);
      ear.scale.set(0.55, 0.9, 0.75);
      ear.position.set(side * 0.18, -0.01, -0.01);
      this.headPivot.add(ear);
    }

    const irisMat = new THREE.MeshStandardMaterial({
      color: profile.eyeColor || "#141b2b",
      emissive: profile.eyeColor || "#141b2b",
      emissiveIntensity: profile.eyeColor === "#141b2b" ? 0.05 : 0.25,
      roughness: 0.1
    });
    const pupilMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.06 });
    const glintMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    const browMat = new THREE.MeshStandardMaterial({ color: profile.hairColor, roughness: 0.5 });

    for (const side of [-1, 1]) {
      if (profile.expression === "serene") {
        // Gentle closed happy arc eyes
        const arc = new THREE.Mesh(
          new THREE.TorusGeometry(0.024, 0.005, 8, 16, Math.PI * 0.85),
          pupilMat
        );
        arc.position.set(side * 0.068, 0.008, 0.168);
        arc.rotation.z = Math.PI * 0.08;
        this.headPivot.add(arc);
      } else {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 14, 14), irisMat);
        eye.position.set(side * 0.068, 0.012, 0.164);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.015, 10, 10), pupilMat);
        pupil.position.set(0, 0, 0.018);
        eye.add(pupil);
        const glint = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 8, 8), glintMat);
        glint.position.set(-0.008, 0.009, 0.024);
        eye.add(glint);
        this.headPivot.add(eye);
        this.eyes.push(eye);
      }

      // Expressive subtle eyebrows
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.032, 4, 8), browMat);
      brow.position.set(side * 0.068, 0.056, 0.166);
      brow.rotation.z =
        Math.PI / 2 +
        (profile.expression === "focused"
          ? -side * 0.18
          : profile.expression === "delighted"
            ? side * 0.14
            : side * 0.05);
      this.headPivot.add(brow);
    }

    // Soft studio blush cheeks
    const blushMat = new THREE.MeshBasicMaterial({
      color: "#f472b6",
      transparent: true,
      opacity: profile.expression === "delighted" ? 0.42 : 0.26
    });
    for (const side of [-1, 1]) {
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.028, 14), blushMat);
      blush.position.set(side * 0.105, -0.032, 0.155);
      blush.rotation.y = side * 0.42;
      this.headPivot.add(blush);
    }

    // Expression-driven mouth
    const mouthMat = new THREE.MeshBasicMaterial({ color: "#7c4a46" });
    if (profile.expression === "focused") {
      const line = new THREE.Mesh(new THREE.CapsuleGeometry(0.0045, 0.034, 4, 8), mouthMat);
      line.rotation.z = Math.PI / 2;
      line.position.set(0, -0.055, 0.172);
      this.headPivot.add(line);
    } else if (profile.expression === "delighted") {
      const openSmile = new THREE.Mesh(
        new THREE.CircleGeometry(0.026, 16, Math.PI, Math.PI),
        mouthMat
      );
      openSmile.position.set(0, -0.044, 0.173);
      this.headPivot.add(openSmile);
    } else {
      const smile = new THREE.Mesh(
        new THREE.TorusGeometry(0.028, 0.0055, 8, 16, Math.PI * 0.85),
        mouthMat
      );
      smile.position.set(0, -0.045, 0.169);
      smile.rotation.z = Math.PI * 1.075;
      this.headPivot.add(smile);
    }

    this.buildHair(profile.hairStyle, hairMat);
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
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.034, 10, 22), accentMat);
      wrap.rotation.x = Math.PI / 2 + 0.1;
      wrap.position.set(0, 0.165, 0.01);
      wrap.castShadow = true;
      this.torsoGroup.add(wrap);

      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.17, 0.024), accentMat);
      tail.position.set(0.062, 0.08, 0.135);
      tail.rotation.z = -0.14;
      this.torsoGroup.add(tail);
    } else if (neckwear === "bowtie") {
      for (const side of [-1, 1]) {
        const loop = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.068, 8), accentMat);
        loop.rotation.z = side * (Math.PI / 2);
        loop.position.set(side * 0.032, 0.142, 0.14);
        this.torsoGroup.add(loop);
      }
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 10), titaniumMat);
      knot.position.set(0, 0.142, 0.146);
      this.torsoGroup.add(knot);
    } else if (neckwear === "necklace") {
      const chain = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.008, 8, 22), titaniumMat);
      chain.rotation.x = Math.PI / 2 + 0.42;
      chain.position.set(0, 0.135, 0.035);
      this.torsoGroup.add(chain);

      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.028, 0), accentGlowMat);
      gem.position.set(0, 0.095, 0.142);
      this.torsoGroup.add(gem);
    } else if (neckwear === "stethoscope") {
      const tube = new THREE.Mesh(
        new THREE.TorusGeometry(0.115, 0.011, 8, 24, Math.PI * 1.45),
        new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.35 })
      );
      tube.rotation.x = Math.PI / 2 + 0.32;
      tube.rotation.z = -Math.PI * 0.22;
      tube.position.set(0, 0.14, 0.01);
      this.torsoGroup.add(tube);

      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.014, 14), titaniumMat);
      disc.rotation.x = Math.PI / 2;
      disc.position.set(0.075, 0.055, 0.145);
      this.torsoGroup.add(disc);
    } else if (neckwear === "tie") {
      const knot = new THREE.Mesh(new THREE.OctahedronGeometry(0.022, 0), accentMat);
      knot.position.set(0, 0.145, 0.138);
      this.torsoGroup.add(knot);
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16, 4), accentMat);
      blade.rotation.z = Math.PI;
      blade.scale.set(1, 1, 0.35);
      blade.position.set(0, 0.055, 0.14);
      this.torsoGroup.add(blade);
    }
  }

  private buildHair(style: CharacterProfile["hairStyle"], hairMat: THREE.Material) {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.194, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMat
    );
    cap.position.set(0, 0.016, -0.01);
    cap.castShadow = true;
    this.headPivot.add(cap);

    if (style === "bob") {
      const back = new THREE.Mesh(
        new THREE.CylinderGeometry(0.185, 0.21, 0.22, 20, 1, false, Math.PI * 0.2, Math.PI * 1.6),
        hairMat
      );
      back.position.set(0, -0.05, -0.02);
      back.rotation.y = Math.PI;
      back.castShadow = true;
      this.headPivot.add(back);

      const bang = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), hairMat);
      bang.scale.set(1.45, 0.55, 0.65);
      bang.position.set(-0.04, 0.125, 0.12);
      bang.rotation.z = -0.22;
      this.headPivot.add(bang);
    } else if (style === "bun") {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.095, 16, 16), hairMat);
      bun.position.set(0, 0.245, -0.05);
      bun.castShadow = true;
      this.headPivot.add(bun);

      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.078, 0.014, 8, 20),
        new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.85, roughness: 0.2 })
      );
      band.rotation.x = Math.PI / 2;
      band.position.set(0, 0.2, -0.05);
      this.headPivot.add(band);

      for (const side of [-1, 1]) {
        const lock = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.09, 6, 10), hairMat);
        lock.position.set(side * 0.155, 0.01, 0.085);
        lock.rotation.z = side * 0.15;
        this.headPivot.add(lock);
      }
    } else if (style === "spiky") {
      const tuftGeo = new THREE.ConeGeometry(0.068, 0.16, 8);
      const positions: Array<[number, number, number, number, number]> = [
        [0, 0.22, 0.05, 0.4, 0],
        [-0.08, 0.2, 0.04, 0.35, 0.45],
        [0.09, 0.19, 0.02, 0.25, -0.5],
        [0.02, 0.21, -0.06, -0.35, -0.1],
        [-0.07, 0.18, -0.07, -0.3, 0.35]
      ];
      for (const [x, y, z, rx, rz] of positions) {
        const t = new THREE.Mesh(tuftGeo, hairMat);
        t.position.set(x, y, z);
        t.rotation.set(rx, 0, rz);
        t.castShadow = true;
        this.headPivot.add(t);
      }
    } else if (style === "long") {
      const drape = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.24, 12, 18), hairMat);
      drape.scale.set(1.06, 1.0, 0.62);
      drape.position.set(0, -0.14, -0.09);
      drape.castShadow = true;
      this.headPivot.add(drape);

      for (const side of [-1, 1]) {
        const strand = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.18, 8, 12), hairMat);
        strand.position.set(side * 0.15, -0.07, 0.045);
        this.headPivot.add(strand);
      }
    } else if (style === "curly") {
      const puffGeo = new THREE.SphereGeometry(0.088, 14, 14);
      const puffs: Array<[number, number, number]> = [
        [0, 0.2, 0.02],
        [-0.12, 0.16, 0.03],
        [0.12, 0.16, 0.03],
        [-0.17, 0.07, -0.03],
        [0.17, 0.07, -0.03],
        [-0.12, 0.14, -0.11],
        [0.12, 0.14, -0.11],
        [0, 0.16, -0.14],
        [0, 0.04, -0.17]
      ];
      for (const [x, y, z] of puffs) {
        const p = new THREE.Mesh(puffGeo, hairMat);
        p.position.set(x, y, z);
        p.castShadow = true;
        this.headPivot.add(p);
      }
    } else if (style === "pigtails") {
      // Adorable Twin High Puffs with brushed-silver hair bands!
      for (const side of [-1, 1]) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.095, 16, 14), hairMat);
        puff.position.set(side * 0.21, 0.14, -0.03);
        puff.castShadow = true;
        this.headPivot.add(puff);
        const band = new THREE.Mesh(
          new THREE.TorusGeometry(0.055, 0.012, 8, 16),
          new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.85, roughness: 0.2 })
        );
        band.rotation.y = Math.PI / 2;
        band.position.set(side * 0.16, 0.125, -0.02);
        this.headPivot.add(band);
      }
    } else if (style === "ponytail") {
      // High Swept Lab Ponytail with metallic tie!
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.055, 0.013, 8, 18),
        new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.85, roughness: 0.2 })
      );
      band.position.set(0, 0.14, -0.185);
      this.headPivot.add(band);
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.22, 10, 14), hairMat);
      tail.position.set(0, 0.02, -0.245);
      tail.rotation.x = 0.24;
      tail.castShadow = true;
      this.headPivot.add(tail);
    } else if (style === "waves") {
      // Soft Layered Shoulder Waves
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const wave = new THREE.Mesh(new THREE.SphereGeometry(0.078 - i * 0.008, 14, 12), hairMat);
          wave.position.set(side * (0.165 + (i % 2) * 0.018), -0.01 - i * 0.095, -0.03 - i * 0.015);
          wave.castShadow = true;
          this.headPivot.add(wave);
        }
      }
      const backWave = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.18, 10, 14), hairMat);
      backWave.scale.set(1.05, 1.0, 0.6);
      backWave.position.set(0, -0.1, -0.095);
      this.headPivot.add(backWave);
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
        rim.position.set(side * 0.068, 0.012, 0.184);
        this.headPivot.add(rim);
      }
      const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.048, 8), titaniumMat);
      bridge.rotation.z = Math.PI / 2;
      bridge.position.set(0, 0.016, 0.184);
      this.headPivot.add(bridge);
    } else if (eyewear === "goggles") {
      const strap = new THREE.Mesh(
        new THREE.TorusGeometry(0.192, 0.014, 8, 28),
        new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.45 })
      );
      strap.rotation.x = Math.PI / 2 - 0.34;
      strap.position.set(0, 0.095, 0.01);
      this.headPivot.add(strap);

      for (const side of [-1, 1]) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.011, 10, 22), titaniumMat);
        rim.position.set(side * 0.064, 0.125, 0.168);
        rim.rotation.x = -0.34;
        this.headPivot.add(rim);

        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.044, 18), accentGlowMat);
        lens.position.copy(rim.position);
        lens.rotation.copy(rim.rotation);
        this.headPivot.add(lens);
      }
    } else if (eyewear === "visor") {
      const visor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.196, 0.196, 0.078, 24, 1, true, -Math.PI * 0.36, Math.PI * 0.72),
        glassMat
      );
      visor.position.set(0, 0.018, 0.004);
      this.headPivot.add(visor);

      const trim = new THREE.Mesh(
        new THREE.TorusGeometry(0.197, 0.007, 8, 24, Math.PI * 0.72),
        accentGlowMat
      );
      trim.rotation.x = Math.PI / 2;
      trim.rotation.z = Math.PI * 0.14;
      trim.position.set(0, 0.056, 0.004);
      this.headPivot.add(trim);
    } else if (eyewear === "shades") {
      const darkLens = new THREE.MeshStandardMaterial({
        color: "#0f172a",
        roughness: 0.08,
        metalness: 0.85
      });
      for (const side of [-1, 1]) {
        const lens = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.052, 0.018), darkLens);
        lens.position.set(side * 0.065, 0.014, 0.184);
        this.headPivot.add(lens);
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.012, 0.016), titaniumMat);
      bar.position.set(0, 0.036, 0.186);
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
      cap.position.set(0.035, 0.215, -0.015);
      cap.rotation.z = -0.22;
      cap.castShadow = true;
      this.headPivot.add(cap);

      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.048, 8), accentMat);
      stem.position.set(0.052, 0.285, -0.015);
      stem.rotation.z = -0.22;
      this.headPivot.add(stem);
    } else if (headwear === "halo") {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.014, 10, 32), accentGlowMat);
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.31;
      this.haloRing = halo;
      this.headPivot.add(halo);
    } else if (headwear === "headphones") {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.205, 0.016, 10, 28, Math.PI),
        titaniumMat
      );
      band.position.y = 0.03;
      this.headPivot.add(band);

      for (const side of [-1, 1]) {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.056, 0.045, 16), accentMat);
        cup.rotation.z = Math.PI / 2;
        cup.position.set(side * 0.205, 0.0, 0);
        cup.castShadow = true;
        this.headPivot.add(cup);
      }
    } else if (headwear === "cap") {
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.195, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.48),
        accentMat
      );
      dome.position.set(0, 0.045, 0);
      dome.castShadow = true;
      this.headPivot.add(dome);

      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.195, 0.018, 20), accentMat);
      brim.scale.set(0.95, 1, 0.72);
      brim.position.set(0, 0.075, 0.14);
      brim.rotation.x = 0.1;
      this.headPivot.add(brim);
    } else if (headwear === "catears") {
      // Cutesy Brushed-Silver Cat Ears Headband!
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.195, 0.012, 8, 28, Math.PI),
        titaniumMat
      );
      band.position.y = 0.025;
      this.headPivot.add(band);
      const innerMat = new THREE.MeshStandardMaterial({ color: "#fbcfe8", roughness: 0.45 });
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.056, 0.125, 4), titaniumMat);
        ear.position.set(side * 0.115, 0.23, 0.01);
        ear.rotation.z = -side * 0.28;
        ear.castShadow = true;
        this.headPivot.add(ear);
        const inner = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.078, 4), innerMat);
        inner.position.set(side * 0.112, 0.224, 0.03);
        inner.rotation.z = -side * 0.28;
        this.headPivot.add(inner);
      }
    } else if (headwear === "bow") {
      // Oversized Cute Pastel Ribbon Bow on crown!
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 10), accentMat);
        wing.scale.set(1.25, 0.65, 0.55);
        wing.position.set(side * 0.075, 0.225, 0.045);
        wing.rotation.z = side * 0.22;
        wing.castShadow = true;
        this.headPivot.add(wing);
      }
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 10), titaniumMat);
      knot.position.set(0, 0.22, 0.055);
      this.headPivot.add(knot);
    } else if (headwear === "beanie") {
      // Cozy Ribbed Knit Beanie with Pom-Pom!
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.202, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.54),
        accentMat
      );
      dome.position.set(0, 0.045, -0.01);
      dome.castShadow = true;
      this.headPivot.add(dome);
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.194, 0.028, 10, 28), accentMat);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.set(0, 0.075, -0.01);
      this.headPivot.add(cuff);
      const pom = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 14, 12),
        new THREE.MeshStandardMaterial({ color: "#f8fafd", roughness: 0.8 })
      );
      pom.position.set(0, 0.27, -0.02);
      this.headPivot.add(pom);
    } else if (headwear === "crown") {
      // Crystal Silver Starlight Tiara!
      const base = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.011, 8, 28), titaniumMat);
      base.rotation.x = Math.PI / 2;
      base.position.set(0, 0.195, 0.01);
      this.headPivot.add(base);
      const spikes: Array<[number, number, number]> = [
        [0, 0.255, 0.135],
        [-0.082, 0.235, 0.105],
        [0.082, 0.235, 0.105]
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

      this.holoDrone = drone;
      this.torsoGroup.add(drone);
    } else if (backpack === "wings") {
      // Translucent Iridescent Glass Fairy Wings (animated flutter in update()!)
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
      // Adorable Pastel Cloud Kitty Plush Backpack!
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
      // Flowing Silver-Trim Starlight Shoulder Capelet!
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
   * Frame-rate independent kinematic update with heel-strike synced footstep callback & turn banking.
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

    const walkBob = isMoving
      ? Math.abs(Math.sin(this.walkCycle)) * (0.04 + speedNorm * 0.032)
      : isSitting
        ? -0.14
        : Math.sin(t * 2.4) * 0.012;
    this.bodyPivot.position.y = THREE.MathUtils.lerp(
      this.bodyPivot.position.y,
      walkBob + emoteHopY,
      damp14
    );
    this.bodyPivot.rotation.y = emoteSpinY;
    this.bodyPivot.rotation.x = THREE.MathUtils.lerp(
      this.bodyPivot.rotation.x,
      isMoving ? 0.06 + speedNorm * 0.11 : isAnalyzing ? 0.1 : 0,
      damp12
    );
    // Subtle physical lean into turns!
    this.bodyPivot.rotation.z = THREE.MathUtils.lerp(
      this.bodyPivot.rotation.z,
      Math.max(-0.18, Math.min(0.18, turnBank)),
      damp12
    );

    if (this.plumbobGroup) {
      this.plumbobGroup.rotation.y = t * 1.65;
      this.plumbobGroup.position.y = 1.38 + Math.sin(t * 2.8) * 0.045;
    }

    this.headPivot.rotation.z = Math.sin(t * 1.45) * 0.045;
    this.headPivot.rotation.y = isMoving ? 0 : Math.sin(t * 0.9) * 0.12;
    const blink = Math.sin(t * 0.72 + 1.1) > 0.975;
    for (const eye of this.eyes) {
      eye.scale.y = blink ? 0.14 : 1.0;
    }

    if (this.haloRing) {
      this.haloRing.position.y = 0.31 + Math.sin(t * 2.8) * 0.016;
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
    this.root.traverse((obj) => {
      if (obj === this.root) return;
      const meshLike = obj as THREE.Mesh;
      if (meshLike.geometry) meshLike.geometry.dispose();
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
  }
}
