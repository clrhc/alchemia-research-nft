import { describe, expect, it } from "vitest";
import {
  PROTEIN_BENCHMARKS,
  ResearchComputeEngine,
  buildPDBTextFromSnapshot,
  getDailyFoldingChallenge
} from "../researchCompute";
import {
  assignSecondaryStructurePSEA,
  buildMMCIFTextFromSnapshot,
  computeContactMap,
  computeNativeContactFractionQ,
  computeStructureGeometryQuality
} from "../structuralAnalysis";
import {
  PET_ACCESSORY_ORDER,
  PET_BACK_GEAR_OPTIONS,
  PET_COLOR_SWATCHES,
  PET_OUTFIT_OPTIONS,
  applyGentleDecay,
  applyTamagotchiAction,
  companionBoostMultiplier,
  companionMoodLabel,
  cycleCompanionAccessory,
  randomizeCompanionWardrobe,
  setCompanionBackGear,
  setCompanionOutfit,
  setCompanionOutfitColor,
  setCompanionPetName,
  toggleCompanionSleep,
  type CompanionVitals
} from "../tamagotchi";
import { deriveTraitsFromSeed, normalizeSeed } from "../prng";
import { computeMiningRatePerHour, countSectors, SLIDER_USD_STOPS } from "../../web3/sectors";
import {
  BACKPACK_OPTIONS,
  BOTTOM_COLORS,
  BOTTOM_STYLES,
  BUILD_SCALE_OPTIONS,
  CHARACTER_PRESETS,
  EXPRESSION_OPTIONS,
  EYEWEAR_OPTIONS,
  EYE_COLORS,
  FOOTWEAR_STYLES,
  HAIR_STYLES,
  HEADWEAR_OPTIONS,
  NECKWEAR_OPTIONS,
  OUTFIT_BASE_COLORS,
  OUTFIT_STYLES,
  createDefaultCharacterProfile,
  decodeCharacterCode,
  encodeCharacterCode,
  randomizeCharacterProfile,
  randomizeOutfitOnly,
  sanitizeCharacterProfile
} from "../characterConfig";
import {
  ONBOARDING_GRAND_BONUS_SPARKS,
  ONBOARDING_STEPS,
  completeOnboardingStep,
  createInitialOnboardingState,
  getOnboardingProgress
} from "../onboarding";
import {
  LAB_STATIONS,
  findNearestTriggeredStation,
  stationForSector
} from "../labStations";
import { declutterFloatingLabels } from "../spatialDeclutter";
import {
  COMMUNITY_FOUNTAIN_POS,
  buildNeighborhoodRoster,
  computeNeighborhoodPlacements,
  computeUpcomingBlueprintLots,
  deriveNeighborCharacterProfile,
  getNeighborhoodGrowthStage
} from "../neighborhoodLayout";
import {
  BAR_STYLES,
  FLOOR_STYLES,
  HOBBY_PROPS,
  LIGHTING_FIXTURES,
  MOOD_SHIFT_ACTIONS,
  PATIO_DECORS,
  PLANT_PACKS,
  ROOM_THEME_PRESETS,
  RUG_STYLES,
  SEATING_STYLES,
  STATION_UPGRADE_DEFS,
  addGuestbookEntry,
  applyNeighborSocialAction,
  applySimsVibeDelta,
  computeSimsMood,
  computeStationUpgradeBonuses,
  defaultLabDecor,
  deriveNeighborLabDecor,
  getNeighborSimsStatus,
  getNextUpgradeCost,
  getRelationshipTier,
  getSimsPieActions,
  initialSimsVibes,
  loadGuestbookEntries,
  loadLabDecor,
  randomizeLabDecor,
  sanitizeLabDecor,
  saveLabDecor,
  upgradeStationInDecor,
  type SimsObjectTarget
} from "../simsState";

describe("Open-Science Protein Folding Engine (20-AA Kyte-Doolittle + 4-Replica REMC)", () => {
  it("loads all 8 real published RCSB PDB mini-protein benchmarks with valid sequences", () => {
    expect(PROTEIN_BENCHMARKS).toHaveLength(8);
    const ids = PROTEIN_BENCHMARKS.map((b) => b.pdbId);
    expect(ids).toEqual(["1L2Y", "1GB1", "1UAO", "2RVD", "1VII", "2F4K", "1FME", "2JOF"]);
    for (const b of PROTEIN_BENCHMARKS) {
      expect(b.sequence.length).toBeGreaterThanOrEqual(10);
      expect(b.nativeRgAngstrom).toBeGreaterThan(4);
    }
  });

  it("minimizes protein potential energy and executes parallel-tempering replica swaps", () => {
    const engine = new ResearchComputeEngine(
      "0x8a4f91e023c47b89d01f4e5276b98c31456fa234890bcdef1234567890ab0100",
      0,
      undefined,
      1
    );
    const initialSnap = engine.getSnapshot();
    const initialBest = initialSnap.bestEnergy;
    // Initial compact globule should already have physically reasonable Rg (not stretched off-frame!)
    expect(initialSnap.radiusOfGyration).toBeLessThan(15);

    // Run 600 Monte Carlo + pivot + replica exchange steps + Foldit wiggle/shake/buryCore
    engine.stepCompute(600);
    engine.shakePerturb();
    engine.buryCore();
    engine.wigglePolish();
    const afterSnap = engine.getSnapshot();

    expect(afterSnap.totalOps).toBeGreaterThanOrEqual(600);
    expect(afterSnap.workUnitsCompleted).toBeGreaterThanOrEqual(1);
    expect(afterSnap.bestEnergy).toBeLessThanOrEqual(initialBest);
    // Physically realistic negative folding free energy & native-range compactness!
    expect(afterSnap.bestEnergy).toBeLessThan(0);
    expect(afterSnap.radiusOfGyration).toBeGreaterThan(3.5);
    expect(afterSnap.compactnessMatchPct).toBeGreaterThanOrEqual(60);
    expect(afterSnap.endToEndDistance).toBeGreaterThan(0);
    expect(afterSnap.compactnessMatchPct).toBeLessThanOrEqual(100);
  });

  it("exports strict wwPDB v3.30 80-column ATOM records with HEADER, SEQRES, MODEL, TER, CONECT & END", () => {
    const engine = new ResearchComputeEngine(
      "0x1c7d82a941e35b64c028a7f139d05b2468ace13579bdf02468ace13579bd0401",
      4, // 1VII Villin HP36 (36 residues)
      undefined,
      42
    );
    engine.selectBenchmark(4);
    engine.stepCompute(120);
    const snap = engine.getSnapshot();
    const pdb = buildPDBTextFromSnapshot(snap);
    const lines = pdb.split("\n");

    expect(lines[0].startsWith("HEADER")).toBe(true);
    expect(lines[0]).toContain("1VII");
    expect(lines.some((l) => l.startsWith("SEQRES"))).toBe(true);
    expect(lines.some((l) => l.startsWith("MODEL"))).toBe(true);
    expect(lines.some((l) => l.startsWith("TER"))).toBe(true);
    expect(lines.some((l) => l.startsWith("ENDMDL"))).toBe(true);
    expect(lines.some((l) => l.startsWith("MASTER"))).toBe(true);
    expect(lines[lines.length - 1].trim()).toBe("END");

    const atomLines = lines.filter((l) => l.startsWith("ATOM  "));
    expect(atomLines).toHaveLength(36);
    for (const line of atomLines) {
      // Every wwPDB v3.30 ATOM record must be exactly 80 characters wide
      expect(line.length).toBe(80);
      // Columns 13-16: " CA "
      expect(line.slice(12, 16)).toBe(" CA ");
      // Column 22: Chain A
      expect(line[21]).toBe("A");
      // Columns 77-78: right-justified carbon element " C"
      expect(line.slice(76, 78)).toBe(" C");
    }
  });

  it("computes P-SEA secondary structure, 2D residue contacts, and valid wwPDB mmCIF (.cif) exports", () => {
    const engine = new ResearchComputeEngine(
      "0x8a4f91e023c47b89d01f4e5276b98c31456fa234890bcdef1234567890ab0100",
      0,
      undefined,
      7
    );
    engine.stepCompute(400);
    const snap = engine.getSnapshot();

    const ss = assignSecondaryStructurePSEA(snap.bestResidues);
    expect(ss.codes).toHaveLength(snap.bestResidues.length);
    expect(ss.helixPct + ss.sheetPct + ss.coilPct).toBe(100);

    const qPct = computeNativeContactFractionQ(snap.pdbBenchmarkId, snap.bestResidues);
    expect(qPct).toBeGreaterThanOrEqual(0);
    expect(qPct).toBeLessThanOrEqual(100);

    const geom = computeStructureGeometryQuality(snap.bestResidues);
    expect(geom.meanCaBondAngstrom).toBeGreaterThan(3.2);
    expect(geom.meanCaBondAngstrom).toBeLessThan(4.4);
    expect(geom.stericClashes).toBeGreaterThanOrEqual(0);
    expect(["Clean", "Good", "Refining"]).toContain(geom.grade);

    const contacts = computeContactMap(snap.bestResidues);
    expect(Array.isArray(contacts)).toBe(true);
    for (const c of contacts) {
      expect(c.j - c.i).toBeGreaterThanOrEqual(3);
      expect(c.distanceAngstrom).toBeLessThanOrEqual(7.8);
    }

    const cif = buildMMCIFTextFromSnapshot(snap);
    expect(cif).toContain("data_ALCH_7_");
    expect(cif).toContain("loop_");
    expect(cif).toContain("_atom_site.Cartn_x");
    const atomRows = cif.split("\n").filter((l) => l.startsWith("ATOM "));
    expect(atomRows).toHaveLength(snap.bestResidues.length);
    // All 17 mandatory _atom_site columns present per row
    expect(atomRows[0].split(/\s+/)).toHaveLength(17);
  });

  it("generates a deterministic UTC daily folding challenge with realistic negative energy target", () => {
    const c1 = getDailyFoldingChallenge(Date.parse("2026-11-23T08:00:00Z"));
    const c2 = getDailyFoldingChallenge(Date.parse("2026-11-23T22:45:00Z"));
    const cNext = getDailyFoldingChallenge(Date.parse("2026-11-24T01:00:00Z"));
    expect(c1).toEqual(c2);
    expect(c1.benchmarkIndex).not.toBe(cNext.benchmarkIndex);
    expect(c1.targetEnergyKcal).toBeLessThan(0);
  });
});

describe("Tamagotchi Vitals, Daily Streaks & Boost Multiplier", () => {
  const baseVitals: CompanionVitals = {
    energy: 60,
    mood: 60,
    curiosity: 60,
    level: 1,
    careStreak: 1,
    dailyStreak: 1,
    lastCareDay: "2026-11-22",
    petName: "",
    accessory: "auto",
    sleeping: false,
    lastUpdatedMs: Date.parse("2026-11-22T12:00:00Z")
  };

  it("decays gently over hours without ever dropping below cozy floor", () => {
    const decayed = applyGentleDecay(baseVitals, Date.parse("2026-11-26T12:00:00Z"));
    expect(decayed.energy).toBe(18);
    expect(decayed.mood).toBe(22);
    expect(decayed.curiosity).toBe(20);
    expect(companionMoodLabel(decayed)).toBe("Sleepy");
  });

  it("pauses vitals decay during nap mode and cycles 3D wardrobe styles cleanly", () => {
    const napping = toggleCompanionSleep(baseVitals, Date.parse("2026-11-22T12:00:00Z"));
    expect(napping.sleeping).toBe(true);
    expect(companionMoodLabel(napping)).toBe("Napping");
    const after24h = applyGentleDecay(napping, Date.parse("2026-11-23T12:00:00Z"));
    expect(after24h.energy).toBe(60);
    expect(after24h.mood).toBe(60);

    const styled1 = cycleCompanionAccessory(napping);
    const styled2 = cycleCompanionAccessory(styled1);
    expect(styled1.accessory).toBe("bowtie");
    expect(styled2.accessory).toBe("beret");

    // Full 3D Animal Clothing Boutique catalogs & setters
    expect(PET_OUTFIT_OPTIONS).toHaveLength(8);
    expect(PET_ACCESSORY_ORDER).toHaveLength(13);
    expect(PET_BACK_GEAR_OPTIONS).toHaveLength(4);
    expect(PET_COLOR_SWATCHES).toHaveLength(8);

    const dressed = setCompanionOutfitColor(
      setCompanionBackGear(setCompanionOutfit(styled2, "labcoat"), "wings"),
      "#38bdf8"
    );
    expect(dressed.outfit).toBe("labcoat");
    expect(dressed.backGear).toBe("wings");
    expect(dressed.outfitColor).toBe("#38bdf8");

    const shuffled = randomizeCompanionWardrobe(dressed);
    expect(PET_OUTFIT_OPTIONS.some((o) => o.id === shuffled.outfit)).toBe(true);
    expect(PET_BACK_GEAR_OPTIONS.some((b) => b.id === shuffled.backGear)).toBe(true);
    expect(shuffled.outfitColor).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("increments daily streak on consecutive day care and calculates 1.0x–1.4x lab boost", () => {
    const next = applyTamagotchiAction(baseVitals, "pet", Date.parse("2026-11-23T12:00:00Z"));
    expect(next.dailyStreak).toBe(2);
    expect(next.lastCareDay).toBe("2026-11-23");
    expect(companionBoostMultiplier(next)).toBeGreaterThan(1.1);
    expect(companionBoostMultiplier({ ...next, energy: 100, mood: 100, curiosity: 100 })).toBe(1.4);

    const named = setCompanionPetName(next, "  Mochi the Chemist  ");
    expect(named.petName).toBe("Mochi the Chemist");
  });
});

describe("Deterministic Seed Traits & Sims Sector Math", () => {
  it("derives deterministic traits and accurate mining rate bonuses across all 6 rooms", () => {
    const s1 = normalizeSeed("0x8a4f91e023c47b89d01f4e5276b98c31456fa234890bcdef1234567890ab0100");
    const t1 = deriveTraitsFromSeed(s1);
    const t2 = deriveTraitsFromSeed(s1);
    expect(t1).toEqual(t2);

    expect(SLIDER_USD_STOPS[0]).toBe(1);
    expect(SLIDER_USD_STOPS[SLIDER_USD_STOPS.length - 1]).toBe(500);
    expect(countSectors(0b111111)).toBe(6);
    // Tier 5 (25) + all 6 rooms (4+14+8+6+18+28 = 78) + 80 WU cap (40) = 143 ALCH/hr
    expect(computeMiningRatePerHour(5, 0b111111, 100)).toBe(143);
  });
});

describe("Walkable 3D Researcher Character Creator & Spatial Lab Stations", () => {
  it("creates, presets, randomizes, sanitizes, and round-trip encodes researcher avatar profiles & full clothing wardrobe", () => {
    const def = createDefaultCharacterProfile();
    expect(def.name).toBe("Dr. Aria");
    expect(CHARACTER_PRESETS).toHaveLength(8);
    expect(OUTFIT_STYLES).toHaveLength(12);
    expect(OUTFIT_BASE_COLORS).toHaveLength(8);
    expect(BOTTOM_STYLES).toHaveLength(5);
    expect(BOTTOM_COLORS).toHaveLength(7);
    expect(FOOTWEAR_STYLES).toHaveLength(5);
    expect(NECKWEAR_OPTIONS).toHaveLength(6);
    expect(HAIR_STYLES).toHaveLength(9);
    expect(HEADWEAR_OPTIONS).toHaveLength(9);
    expect(BACKPACK_OPTIONS).toHaveLength(7);
    expect(HAIR_STYLES.some((h) => h.id === def.hairStyle)).toBe(true);
    expect(OUTFIT_STYLES.some((o) => o.id === def.outfitStyle)).toBe(true);
    expect(EYE_COLORS.some((c) => c.hex === def.eyeColor)).toBe(true);
    expect(EXPRESSION_OPTIONS.some((e) => e.id === def.expression)).toBe(true);
    expect(BUILD_SCALE_OPTIONS.some((b) => b.id === def.buildScale)).toBe(true);

    const rand = randomizeCharacterProfile("  Prof. Ada  ");
    expect(rand.name).toBe("Prof. Ada");
    expect(EYEWEAR_OPTIONS.some((e) => e.id === rand.eyewear)).toBe(true);
    expect(HEADWEAR_OPTIONS.some((h) => h.id === rand.headwear)).toBe(true);
    expect(BACKPACK_OPTIONS.some((b) => b.id === rand.backpack)).toBe(true);
    expect(BOTTOM_STYLES.some((b) => b.id === rand.bottomStyle)).toBe(true);
    expect(FOOTWEAR_STYLES.some((f) => f.id === rand.footwearStyle)).toBe(true);
    expect(NECKWEAR_OPTIONS.some((n) => n.id === rand.neckwear)).toBe(true);

    // Shuffle clothes only keeps character identity intact
    const restyled = randomizeOutfitOnly(rand);
    expect(restyled.name).toBe(rand.name);
    expect(restyled.skinTone).toBe(rand.skinTone);
    expect(OUTFIT_STYLES.some((o) => o.id === restyled.outfitStyle)).toBe(true);

    const encoded = encodeCharacterCode(rand);
    const decoded = decodeCharacterCode(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.name).toBe("Prof. Ada");
    expect(decoded?.outfitStyle).toBe(rand.outfitStyle);
    expect(decoded?.outfitBaseColor).toBe(rand.outfitBaseColor);
    expect(decoded?.bottomStyle).toBe(rand.bottomStyle);
    expect(decoded?.bottomColor).toBe(rand.bottomColor);
    expect(decoded?.footwearStyle).toBe(rand.footwearStyle);
    expect(decoded?.neckwear).toBe(rand.neckwear);
    expect(decoded?.eyeColor).toBe(rand.eyeColor);
    expect(decoded?.expression).toBe(rand.expression);
    expect(decoded?.buildScale).toBe(rand.buildScale);

    const sanitized = sanitizeCharacterProfile({
      name: "   ",
      skinTone: "not-a-color",
      eyeColor: "bad",
      expression: "invalid" as unknown as typeof def.expression,
      buildScale: "giant" as unknown as typeof def.buildScale,
      hairStyle: "invalid" as unknown as typeof def.hairStyle,
      outfitStyle: "cardigan",
      bottomStyle: "skirt",
      footwearStyle: "hoverkicks",
      neckwear: "scarf"
    });
    expect(sanitized.name).toBe(def.name);
    expect(sanitized.skinTone).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(sanitized.eyeColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(sanitized.expression).toBe(def.expression);
    expect(sanitized.buildScale).toBe(def.buildScale);
    expect(sanitized.hairStyle).toBe(def.hairStyle);
    expect(sanitized.outfitStyle).toBe("cardigan");
    expect(sanitized.bottomStyle).toBe("skirt");
    expect(sanitized.footwearStyle).toBe("hoverkicks");
    expect(sanitized.neckwear).toBe("scarf");
  });

  it("maps all 5 spatial lab stations, detects floor pad proximity, and declutters overlapping labels", () => {
    expect(LAB_STATIONS).toHaveLength(5);
    for (const st of LAB_STATIONS) {
      expect(findNearestTriggeredStation(st.padX, st.padZ)).toBe(st.id);
    }
    expect(findNearestTriggeredStation(0, 3.0)).toBeNull();
    expect(stationForSector(0)).toBe("research");
    expect(stationForSector(1)).toBe("mining");
    expect(stationForSector(2)).toBe("builder");
    expect(stationForSector(3)).toBe("pet");
    expect(stationForSector(4)).toBe("mining");
    expect(stationForSector(5)).toBe("research");

    // Stress-test spatial decluttering: two labels projected onto the exact same pixel + one off-edge
    const placed = declutterFloatingLabels(
      [
        {
          id: "research",
          anchorX: 400,
          anchorY: 300,
          visible: true,
          distToCam: 4.5,
          distToChar: 0.4,
          width: 150,
          height: 42
        },
        {
          id: "mining",
          anchorX: 400,
          anchorY: 300,
          visible: true,
          distToCam: 6.2,
          distToChar: 2.1,
          width: 150,
          height: 42
        },
        {
          id: "pet",
          anchorX: 1180,
          anchorY: 20,
          visible: true,
          distToCam: 5.5,
          distToChar: 1.8,
          width: 140,
          height: 42
        }
      ],
      {
        width: 1200,
        height: 760,
        padLeft: 14,
        padRight: 444,
        padTop: 68,
        padBottom: 96
      }
    );

    // Closest station stays near its anchor; overlapping station separates cleanly without collision
    const ySep = Math.abs(placed.research.placedY - placed.mining.placedY);
    expect(ySep).toBeGreaterThanOrEqual(40);
    // Off-edge station clamps strictly inside safe top & right-drawer bounds
    expect(placed.pet.placedX).toBeLessThanOrEqual(1200 - 444 - 70);
    expect(placed.pet.placedY).toBeGreaterThanOrEqual(68 + 42);
    expect(placed.pet.offsetDist).toBeGreaterThan(20);
  });
});

describe("Living Minted NFT Neighborhood & Sims Interactivity", () => {
  it("grows the neighborhood deterministically as totalSupply increases and prioritizes real minted vessels", () => {
    const known = [
      {
        tokenId: 1,
        seed: "0x8a4f91e023c47b89d01f4e5276b98c31456fa234890bcdef1234567890ab0100",
        causeId: 0,
        causeName: "Cancer & Precision Oncology",
        minter: "0x1111…2222",
        valueUsd: 25,
        complexityTier: 3,
        sectorsMask: 0b000111,
        workUnits: 9
      },
      {
        tokenId: 2,
        seed: "0x1c7d82a941e35b64c028a7f139d05b2468ace13579bdf02468ace13579bd0401",
        causeId: 1,
        causeName: "Longevity & Cellular Repair",
        minter: "0x3333…4444",
        valueUsd: 100,
        complexityTier: 4,
        sectorsMask: 0b111111,
        workUnits: 21
      }
    ];

    // Active lab #1 is excluded from neighbors; totalSupply=42 grows across all 3 rings!
    const roster = buildNeighborhoodRoster(1, known, 42);
    expect(roster).toHaveLength(41);
    expect(roster.some((n) => n.tokenId === 1)).toBe(false);
    expect(roster[0].tokenId).toBe(2);
    expect(roster[0].sectorsMask).toBe(0b111111);

    // 8 Ring 1 (Inner Boulevard) + 16 Ring 2 (Walkable Canal Suburbs) + 17 Ring 3 (Outer Skyline Towers)
    const placements = computeNeighborhoodPlacements(roster);
    expect(placements.filter((p) => p.ring === 1)).toHaveLength(8);
    expect(placements.filter((p) => p.ring === 2)).toHaveLength(16);
    expect(placements.filter((p) => p.ring === 3)).toHaveLength(17);
    expect(COMMUNITY_FOUNTAIN_POS).toEqual([0, 5.45]);

    for (const pl of placements.filter((p) => p.ring === 1 || p.ring === 2)) {
      const dist = Math.hypot(pl.x, pl.z);
      const visitDist = Math.hypot(pl.visitX, pl.visitZ);
      expect(dist).toBeGreaterThan(7.5);
      expect(visitDist).toBeLessThan(dist);
    }

    // Upcoming surveyed "Next Mint" blueprint lots stay cleanly ahead of occupied plots
    const nextLots = computeUpcomingBlueprintLots(6, 4);
    expect(nextLots).toHaveLength(4);
    expect(nextLots[0].ring).toBe(1);
    expect(nextLots[2].ring).toBe(2);

    // Civic growth milestones evolve smoothly as total minted labs grow
    expect(getNeighborhoodGrowthStage(2).title).toBe("Pioneer Plaza");
    expect(getNeighborhoodGrowthStage(6).title).toBe("Boulevard Hamlet");
    expect(getNeighborhoodGrowthStage(14).transitUnlocked).toBe(true);
    expect(getNeighborhoodGrowthStage(30).skylineUnlocked).toBe(true);
    expect(getNeighborhoodGrowthStage(60).title).toBe("Research Metropolis");

    // Neighbor NPC derivation is deterministic per minted lab seed
    const npc1 = deriveNeighborCharacterProfile(roster[0]);
    const npc2 = deriveNeighborCharacterProfile(roster[0]);
    expect(npc1).toEqual(npc2);
    expect(npc1.name.length).toBeGreaterThan(1);
  });

  it("computes Sims Plumbob moods, persists full 8-category home furnishings & station upgrades, and generates pie actions for all world entities", () => {
    // Full 8-category Home Furnishing Catalog (43 procedural 3D items!) + 5 Station Upgrades
    expect(FLOOR_STYLES).toHaveLength(6);
    expect(PATIO_DECORS).toHaveLength(6);
    expect(SEATING_STYLES).toHaveLength(5);
    expect(BAR_STYLES).toHaveLength(5);
    expect(HOBBY_PROPS).toHaveLength(6);
    expect(RUG_STYLES).toHaveLength(5);
    expect(PLANT_PACKS).toHaveLength(5);
    expect(LIGHTING_FIXTURES).toHaveLength(5);
    expect(ROOM_THEME_PRESETS).toHaveLength(3);
    expect(STATION_UPGRADE_DEFS).toHaveLength(5);

    // Interactive 5-step Housewarming Welcome Guide progression & grand bonus sparks
    expect(ONBOARDING_STEPS).toHaveLength(5);
    let ob = createInitialOnboardingState();
    expect(getOnboardingProgress(ob).doneCount).toBe(0);
    expect(getOnboardingProgress(ob).nextStep?.id).toBe("walk");

    const s1 = completeOnboardingStep(ob, "walk");
    expect(s1.newlyCompleted).toBe(true);
    expect(s1.stepReward).toBe(3);
    expect(s1.grandBonusAwarded).toBe(false);
    // Re-completing same step is idempotent with 0 duplicate rewards
    expect(completeOnboardingStep(s1.nextState, "walk").newlyCompleted).toBe(false);

    ob = completeOnboardingStep(s1.nextState, "pet").nextState;
    ob = completeOnboardingStep(ob, "furnish").nextState;
    ob = completeOnboardingStep(ob, "town").nextState;
    const finalStep = completeOnboardingStep(ob, "mood");
    expect(finalStep.grandBonusAwarded).toBe(true);
    expect(finalStep.totalReward).toBe(5 + ONBOARDING_GRAND_BONUS_SPARKS);
    expect(getOnboardingProgress(finalStep.nextState).allDone).toBe(true);

    // Backward-compatible partial migration preserves old saved { floorStyle, patioDecor }
    const migrated = sanitizeLabDecor({ floorStyle: "oak", patioDecor: "cherry-tree" });
    expect(migrated.floorStyle).toBe("oak");
    expect(migrated.patioDecor).toBe("cherry-tree");
    expect(migrated.seatingStyle).toBe("bench");
    expect(migrated.stationUpgrades).toEqual({ research: 1, mining: 1, pet: 1, builder: 1, lounge: 1 });

    // Full save/load & progressive station upgrades (Lv. 1 -> 2 -> 3)
    const customDecor = {
      ...defaultLabDecor(),
      floorStyle: "obsidian" as const,
      patioDecor: "mini-orrery" as const,
      seatingStyle: "egg-chair" as const,
      barStyle: "boba" as const,
      hobbyProp: "aquarium" as const,
      rugStyle: "star-weave" as const,
      plantPack: "succulents" as const,
      lightingFixture: "fairy-orbs" as const
    };
    saveLabDecor(99, customDecor);
    expect(loadLabDecor(99)).toEqual(customDecor);

    expect(getNextUpgradeCost(1)).toBe(10);
    expect(getNextUpgradeCost(2)).toBe(25);
    expect(getNextUpgradeCost(3)).toBeNull();

    const lv2Mining = upgradeStationInDecor(customDecor, "mining");
    expect(lv2Mining.stationUpgrades.mining).toBe(2);
    const lv3Mining = upgradeStationInDecor(lv2Mining, "mining");
    expect(lv3Mining.stationUpgrades.mining).toBe(3);
    const lv3Research = upgradeStationInDecor(upgradeStationInDecor(lv3Mining, "research"), "research");
    const lv3Pet = upgradeStationInDecor(upgradeStationInDecor(lv3Research, "pet"), "pet");
    const lv3Lounge = upgradeStationInDecor(upgradeStationInDecor(lv3Pet, "lounge"), "lounge");

    const bonuses = computeStationUpgradeBonuses(lv3Lounge.stationUpgrades);
    expect(bonuses.miningMult).toBe(1.35);
    expect(bonuses.focusMult).toBe(1.5);
    expect(bonuses.energyFunMult).toBe(1.6);
    expect(bonuses.petBoostBonus).toBe(0.25);
    expect(bonuses.extraFoldSpark).toBe(1);
    expect(bonuses.totalUpgrades).toBe(8);

    // Randomize look preserves earned station upgrades!
    const randDecor = randomizeLabDecor(lv3Lounge.stationUpgrades);
    expect(randDecor.stationUpgrades).toEqual(lv3Lounge.stationUpgrades);
    expect(SEATING_STYLES.some((s) => s.id === randDecor.seatingStyle)).toBe(true);

    const base = initialSimsVibes();
    expect(MOOD_SHIFT_ACTIONS).toHaveLength(6);
    expect(computeSimsMood({ energy: 25, focus: 80, social: 80, fun: 80 }).name).toBe("Drowsy");
    expect(computeSimsMood({ energy: 95, focus: 92, social: 90, fun: 90 }).name).toBe("Inspired");
    expect(computeSimsMood({ energy: 70, focus: 88, social: 60, fun: 65 }).name).toBe("Focused");
    expect(computeSimsMood({ energy: 70, focus: 60, social: 88, fun: 65 }).name).toBe("Social");
    expect(computeSimsMood({ energy: 72, focus: 62, social: 65, fun: 90 }).name).toBe("Playful");
    // Active moodlet shifts live Plumbob mood immediately
    expect(
      computeSimsMood(
        { energy: 75, focus: 70, social: 70, fun: 70 },
        { id: "m1", label: "Goofy Vibes", mood: "Playful", source: "Self", expiresAtMs: Date.now() + 60000 }
      ).name
    ).toBe("Playful");

    const boosted = applySimsVibeDelta(base, { energy: 50, focus: -200, social: 5, fun: 20 });
    expect(boosted.energy).toBe(100);
    expect(boosted.focus).toBe(12);
    expect(boosted.fun).toBe(100);

    // Sims Relationships grow smoothly across all 6 tiers & update NPC live moods
    expect(getRelationshipTier(0).tier).toBe("Stranger");
    expect(getRelationshipTier(20).tier).toBe("Acquaintance");
    expect(getRelationshipTier(40).tier).toBe("Lab Buddy");
    expect(getRelationshipTier(60).tier).toBe("Good Friend");
    expect(getRelationshipTier(80).tier).toBe("Best Friend");
    expect(getRelationshipTier(95).tier).toBe("Research Soulmate");

    const relSeed = "0x1c7d82a941e35b64c028a7f139d05b2468ace13579bdf02468ace13579bd0401";
    const r0 = getNeighborSimsStatus(202, relSeed, {});
    expect(r0.tier).toBe("Stranger");
    const step1 = applyNeighborSocialAction({}, 202, relSeed, "joke", "outgoing");
    expect(step1.delta).toBe(14); // 11 base + 3 Outgoing trait bonus
    expect(step1.status.mood).toBe("Playful");
    const step2 = applyNeighborSocialAction(step1.nextMap, 202, relSeed, "spark", "outgoing");
    expect(step2.leveledUp).toBe(true);
    expect(step2.status.tier).toBe("Acquaintance");
    expect(step2.status.mood).toBe("Inspired");

    const targets: SimsObjectTarget[] = [
      { kind: "pet", label: "Pet", worldX: 1, worldZ: 1 },
      { kind: "flask", label: "Flask", worldX: 0, worldZ: 0 },
      { kind: "bench", label: "Bench", worldX: 0, worldZ: 2 },
      { kind: "espresso", label: "Espresso", worldX: -1, worldZ: 1.5 },
      { kind: "microscope", label: "Microscope", worldX: -1.3, worldZ: -0.8 },
      { kind: "harvester", label: "Harvester", worldX: 1.4, worldZ: -0.6 },
      { kind: "hobby", label: "Jellyfish Aquarium", hobbyId: "aquarium", worldX: -1.34, worldZ: 1.68 },
      { kind: "player", label: "Dr. Aria", worldX: 0, worldZ: 1.4 },
      { kind: "fountain", label: "Fountain", worldX: 0, worldZ: 5.45 },
      { kind: "neighbor-lab", label: "Lab #2", tokenId: 2, worldX: -6, worldZ: 3 },
      { kind: "neighbor-npc", label: "Mateo", tokenId: 2, npcName: "Mateo", worldX: -5, worldZ: 3 },
      { kind: "visiting-host", label: "Mateo (Host)", tokenId: 2, hostName: "Mateo", worldX: -0.7, worldZ: 1.2 },
      { kind: "blueprint-lot", label: "Open Lot #10", lotNumber: 10, worldX: 16, worldZ: 14 }
    ];

    for (const target of targets) {
      const actions = getSimsPieActions(target);
      expect(actions.length).toBeGreaterThanOrEqual(3);
      for (const act of actions) {
        expect(act.id.length).toBeGreaterThan(2);
        expect(act.label.length).toBeGreaterThan(2);
        expect(act.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }

    // Visiting another user's home: neighbor-lab leads with Enter Home, visiting-host supports Guestbook & Return Home
    expect(getSimsPieActions(targets[9])[0].id).toBe("neighbor-enter");
    expect(getSimsPieActions(targets[11]).some((a) => a.id === "host-guestbook")).toBe(true);
    expect(getSimsPieActions(targets[11]).some((a) => a.id === "return-home")).toBe(true);
    // Hobby props expose contextual Sims interactions
    expect(getSimsPieActions(targets[6])[0].id).toBe("hobby-watch");

    // Deterministic neighbor decor + cozy guestbook persistence
    const seed = "0x1c7d82a941e35b64c028a7f139d05b2468ace13579bdf02468ace13579bd0401";
    const d1 = deriveNeighborLabDecor(seed);
    const d2 = deriveNeighborLabDecor(seed);
    expect(d1).toEqual(d2);
    expect(FLOOR_STYLES.some((f) => f.id === d1.floorStyle)).toBe(true);

    const seededNotes = loadGuestbookEntries(77, seed);
    expect(seededNotes.length).toBeGreaterThanOrEqual(2);
    const afterSign = addGuestbookEntry(77, seed, {
      authorName: "Dr. Aria",
      authorTitle: "Bio-Alchemist",
      message: "Loved visiting your cryo lab!",
      accent: "#38bdf8"
    });
    expect(afterSign[0].authorName).toBe("Dr. Aria");
    expect(afterSign[0].message).toBe("Loved visiting your cryo lab!");
    expect(loadGuestbookEntries(77, seed)[0].message).toBe("Loved visiting your cryo lab!");
  });
});
