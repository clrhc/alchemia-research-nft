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
  PET_TRICKS,
  applyGentleDecay,
  applyTamagotchiAction,
  canClaimDailyPetChest,
  claimDailyPetChest,
  companionBoostMultiplier,
  companionMoodLabel,
  cycleCompanionAccessory,
  feedGourmetAmbrosia,
  getTrickCooldownLeftSec,
  performPetTrick,
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
import { ResearcherAvatar3D } from "../character3D";
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
import {
  BASEMENT_Y,
  DEFAULT_SPACIOUS_LAYOUT,
  EXTRA_ROOM_DEFS,
  HOUSE_FLOOR_DEFS,
  HOUSE_SIZE_DEFS,
  MOVABLE_ITEMS,
  STAIR_FLIGHTS,
  WALL_STYLES,
  clampPlacementPoint,
  evaluateStairWalk,
  findNearestStationWithLayout,
  formatFloorLabel,
  getGroundElevationForFloor,
  getHouseBoundsRadius,
  getUpperFloorY,
  resolveItemPlacement,
  sanitizeCustomLayout
} from "../homeLayout";
import { declutterFloatingLabels } from "../spatialDeclutter";
import {
  COMMUNITY_FOUNTAIN_POS,
  MAX_NEIGHBORHOOD_PLOTS,
  NEIGHBORHOOD_WALK_LIMIT,
  TOWN_PARKS,
  TOWN_PARK_CENTER,
  TOWN_STREETS,
  buildNeighborhoodRoster,
  computeNeighborhoodPlacements,
  computeUpcomingBlueprintLots,
  deriveNeighborCharacterProfile,
  getExpansionBandAvenueSpan,
  getExpansionBandCount,
  getNeighborhoodGrowthStage,
  getNeighborhoodPlotSlot,
  getNeighborhoodWalkLimit
} from "../neighborhoodLayout";
import {
  createSimulatedNeighborVessels,
  loadCollectionStateForMode,
  mergeMintedVessels
} from "../../web3/contractService";
import {
  applyOnChainEstateToDecor,
  decodeExtraRoomsMask,
  encodeExtraRoomsMask,
  estimateEstateExpansionCost,
  packLabStyleBits,
  unpackLabStyleBits
} from "../../web3/estateCodec";
import {
  ACHIEVEMENT_DEFS,
  QUEST_STEPS,
  RESEARCHER_RANKS,
  claimAchievementReward,
  claimAllReadyRewards,
  claimQuestReward,
  createInitialProgressionState,
  evaluateAchievements,
  evaluateQuestChains,
  getResearcherRank,
  recordProgressionAction
} from "../progressionQuests";
import {
  AdaptivePixelRatioController,
  detectDevicePerfProfile
} from "../browserCompat";
import {
  TRAFFIC_LANE_OFFSET,
  buildTrafficRoutes,
  computeVehicleCountForTown,
  sampleRoutePose,
  selectActiveVehicleBlueprints,
  shouldVehicleYield
} from "../townVehicles";
import {
  GARDEN_PLOT_DEFS,
  PLANT_SPECIES,
  bloomAllPlantedPlots,
  computePlotGrowth,
  createInitialGardenState,
  fertilizeGardenPlot,
  harvestGardenPlot,
  loadGardenState,
  plantSeedInPlot,
  saveGardenState,
  waterGardenPlot,
  waterRandomGrowingPlot
} from "../gardenState";
import {
  ALCHEMY_RECIPES,
  addHarvestedBotanicals,
  canCraftRecipe,
  computeElixirFocusMultiplier,
  computeElixirMiningMultiplier,
  consumeCraftedItem,
  craftAlchemyRecipe,
  createInitialAlchemyState,
  getActiveElixirBuffs
} from "../alchemyCrafting";
import {
  DAILY_BOUNTY_POOL,
  TOWN_WEATHERS,
  claimDailyBounty,
  computeTownFriendshipSynergy,
  createInitialDailyBountyState,
  evaluateDailyTownBounties,
  getAutoTownWeather,
  getDailyTownBounties,
  getNeighborDailyFavor,
  isNeighborFavorFulfilled,
  markNeighborFavorFulfilled,
  recordDailyBountyAction
} from "../townEvents";
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
  deleteHomeBlueprintSlot,
  deriveNeighborLabDecor,
  getNeighborSimsStatus,
  getNextUpgradeCost,
  getRelationshipTier,
  getSimsPieActions,
  moveItemInDecor,
  initialSimsVibes,
  loadGuestbookEntries,
  loadHomeBlueprintSlots,
  loadLabDecor,
  randomizeLabDecor,
  sanitizeLabDecor,
  saveHomeBlueprintSlot,
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
    expect(migrated.seatingStyle).toBe("plush-sofa");
    expect(migrated.hasBasement).toBe(true);
    expect(migrated.houseFloors).toBe(2);
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

  it("supports spacious estate expansions, multi-story floors (1F/2F/3F), 6 cozy rooms & free-placement station moving", () => {
    expect(HOUSE_SIZE_DEFS).toHaveLength(3);
    expect(HOUSE_FLOOR_DEFS).toHaveLength(3);
    expect(EXTRA_ROOM_DEFS).toHaveLength(6);
    expect(WALL_STYLES).toHaveLength(5);
    expect(MOVABLE_ITEMS).toHaveLength(9);

    expect(getHouseBoundsRadius(1)).toBe(3.7);
    expect(getHouseBoundsRadius(2)).toBe(4.2);
    expect(getHouseBoundsRadius(3)).toBe(4.6);

    expect(getUpperFloorY(0)).toBe(BASEMENT_Y);
    expect(getUpperFloorY(1)).toBe(0.12);
    expect(getUpperFloorY(2)).toBe(2.68);
    expect(getUpperFloorY(3)).toBe(4.68);
    expect(formatFloorLabel(0)).toBe("B1");
    expect(formatFloorLabel(1)).toBe("1F");
    expect(formatFloorLabel(2)).toBe("2F");
    expect(formatFloorLabel(3)).toBe("3F");
    expect(getGroundElevationForFloor(0, 0, 0, 1)).toBe(BASEMENT_Y);
    expect(getGroundElevationForFloor(2, -2.5, -2.5, 2)).toBe(2.68);
    expect(getGroundElevationForFloor(3, 2.5, -2.5, 3)).toBe(4.68);
    expect(getGroundElevationForFloor(1, 0, 0, 1)).toBe(0.12);
    expect(getGroundElevationForFloor(1, 4.1, 4.1, 3)).toBe(0.12);

    // Default home immediately ships as multi-story architect housing (B1 Basement + 1F + 2F!)
    const defDecor = defaultLabDecor();
    expect(defDecor.hasBasement).toBe(true);
    expect(defDecor.houseFloors).toBe(2);

    // Real physically walkable architectural staircases (B1 <-> 1F <-> 2F <-> 3F)
    expect(STAIR_FLIGHTS).toHaveLength(3);
    // Mid-flight on East Basement Stairs (x = 2.7, z = -1.45 -> halfway between 1F 0.12 and B1 -2.20)
    const midB1 = evaluateStairWalk(2.7, -1.45, 1, 2, true);
    expect(midB1.onStairs).toBe(true);
    expect(midB1.flightId).toBe("b1-1f");
    expect(midB1.y).toBeCloseTo(-1.04, 1);
    expect(midB1.nextFloor).toBeUndefined();
    // Reaching bottom of Basement Stairs smoothly transitions from 1F -> B1 (0)
    const botB1 = evaluateStairWalk(2.7, -2.55, 1, 2, true);
    expect(botB1.onStairs).toBe(true);
    expect(botB1.nextFloor).toBe(0);
    // Walking back up from B1 to top landing smoothly transitions B1 -> 1F (1)
    const topFromB1 = evaluateStairWalk(2.7, -0.35, 0, 2, true);
    expect(topFromB1.onStairs).toBe(true);
    expect(topFromB1.nextFloor).toBe(1);
    // Climbing West 1F -> 2F floating stairs interpolates elevation and transitions at top landing
    const mid2F = evaluateStairWalk(-2.7, -1.45, 1, 2, true);
    expect(mid2F.onStairs).toBe(true);
    expect(mid2F.flightId).toBe("1f-2f");
    expect(mid2F.y).toBeCloseTo(1.4, 1);
    const top2F = evaluateStairWalk(-2.7, -2.55, 1, 2, true);
    expect(top2F.nextFloor).toBe(2);
    // Switchback 2F -> 3F stairs activate only when 3F Penthouse is built
    expect(evaluateStairWalk(-1.7, -1.55, 2, 2, true).onStairs).toBe(false);
    const top3F = evaluateStairWalk(-1.7, -0.55, 2, 3, true);
    expect(top3F.onStairs).toBe(true);
    expect(top3F.nextFloor).toBe(3);

    // Placement clamping respects tabletop NFT island, stairwells, B1 basement bounds & optional 0.25m snap grid
    const pushedOut = clampPlacementPoint(0.1, 0.1, 1, 1, false);
    expect(Math.hypot(pushedOut.x, pushedOut.z)).toBeGreaterThanOrEqual(1.23);

    const basementClamped = clampPlacementPoint(2.8, -1.5, 1, 0, false);
    expect(basementClamped.x).toBeLessThanOrEqual(1.95);

    const snapped = clampPlacementPoint(1.62, -2.38, 2, 1, true);
    expect(snapped.x).toBe(1.5);
    expect(snapped.z).toBe(-2.5);

    const upperCutaway = clampPlacementPoint(0.2, 2.9, 2, 2, false);
    expect(upperCutaway.z).toBeLessThanOrEqual(1.65);

    // Moving a station onto B1 Basement or Floor 2F updates proximity triggers on that floor & clears 1F!
    const basementMoved = moveItemInDecor(defaultLabDecor(), "mining", -1.25, -1.25, 0, 0);
    expect(resolveItemPlacement("mining", basementMoved.customLayout).floor).toBe(0);
    expect(findNearestStationWithLayout(-1.25, -1.25, 0, basementMoved.customLayout)).toBe("mining");
    expect(findNearestStationWithLayout(-1.25, -1.25, 1, basementMoved.customLayout)).toBeNull();

    const movedDecor = moveItemInDecor(defaultLabDecor(), "research", -2.5, -2.5, 1.0, 2);
    expect(resolveItemPlacement("research", movedDecor.customLayout)).toEqual({
      x: -2.5,
      z: -2.5,
      yaw: 1.0,
      floor: 2
    });
    expect(findNearestStationWithLayout(-2.5, -2.5, 2, movedDecor.customLayout)).toBe("research");
    expect(findNearestStationWithLayout(-2.5, -2.5, 1, movedDecor.customLayout)).toBeNull();
    expect(
      findNearestStationWithLayout(
        DEFAULT_SPACIOUS_LAYOUT.mining.x,
        DEFAULT_SPACIOUS_LAYOUT.mining.z,
        1,
        movedDecor.customLayout
      )
    ).toBe("mining");

    // Sanitizer rejects invalid coordinates and preserves valid B1 / 2F / 3F custom placements
    const cleanLayout = sanitizeCustomLayout({
      mining: { x: 99, z: -2.25, yaw: 0.5, floor: 3 },
      research: { x: -1.5, z: 1.0, yaw: 0, floor: 0 },
      badKey: { x: 1, z: 1, yaw: 0, floor: 1 }
    });
    expect(cleanLayout.mining?.x).toBe(4.5);
    expect(cleanLayout.mining?.floor).toBe(3);
    expect(cleanLayout.research?.floor).toBe(0);
    expect((cleanLayout as Record<string, unknown>).badKey).toBeUndefined();

    // New Sims Pie Menus for 6 Homely Rooms & Walkable Staircases (including B1 Basement!)
    const roomActions = getSimsPieActions({
      kind: "home-room",
      label: "Cozy Bedroom Nook",
      roomId: "bedroom",
      worldX: -3.85,
      worldZ: 1.65
    });
    expect(roomActions[0].id).toBe("room-nap");

    const stairActions = getSimsPieActions(
      { kind: "stairs", label: "Basement Stairs", worldX: 2.7, worldZ: -0.15 },
      { currentFloor: 1, maxFloors: 2, hasBasement: true }
    );
    expect(stairActions.some((a) => a.id === "floor-up" && a.label.includes("2F"))).toBe(true);
    expect(stairActions.some((a) => a.id === "floor-down" && a.label.includes("B1"))).toBe(true);
  });

  it("powers walkable town parks, botanical conservatory, 8 plant species & interactive home/park gardening", () => {
    expect(TOWN_PARKS).toHaveLength(4);
    expect(TOWN_PARK_CENTER).toEqual([15.2, 15.2]);
    expect(PLANT_SPECIES).toHaveLength(8);
    expect(GARDEN_PLOT_DEFS).toHaveLength(10);
    expect(GARDEN_PLOT_DEFS.filter((d) => d.zone === "home")).toHaveLength(4);
    expect(GARDEN_PLOT_DEFS.filter((d) => d.zone === "park")).toHaveLength(6);

    // Ensure all 4 Town Parks sit cleanly separated from Ring 1 & Ring 2 neighbor houses,
    // and every Ring 1 & Ring 2 house sits in its own 90-degree street-aligned residential plot!
    expect(TOWN_STREETS.ns).toHaveLength(4);
    expect(TOWN_STREETS.ew).toHaveLength(4);
    const roster = buildNeighborhoodRoster(1, [], 28);
    const placements = computeNeighborhoodPlacements(roster).filter((p) => p.ring <= 2);
    for (let i = 0; i < placements.length; i++) {
      const pl = placements[i];
      // Every residential lot faces squarely onto its street (0, ±PI/2, or PI)
      const quarterTurns = Math.round(pl.rotY / (Math.PI / 2));
      expect(Math.abs(pl.rotY - quarterTurns * (Math.PI / 2))).toBeLessThan(0.001);
      for (let j = i + 1; j < placements.length; j++) {
        expect(Math.hypot(pl.x - placements[j].x, pl.z - placements[j].z)).toBeGreaterThanOrEqual(5.4);
      }
    }
    for (const park of TOWN_PARKS) {
      for (const pl of placements) {
        expect(Math.hypot(park.x - pl.x, park.z - pl.z)).toBeGreaterThan(5.0);
      }
    }

    // Full plant -> water -> fertilize -> harvest lifecycle & Botanical Almanac tracking
    const t0 = 1_700_000_000_000;
    let g = createInitialGardenState(t0);
    g = plantSeedInPlot(g, "home-2", "orchid", t0);
    const early = computePlotGrowth(g.plots["home-2"], t0 + 2_000);
    expect(early.stage).toBe(1);
    expect(early.readyToHarvest).toBe(false);

    // Watering accelerates growth by +36%
    const watered = waterGardenPlot(g, "home-2", t0 + 5_000);
    expect(watered.boosted).toBe(true);
    const mid = computePlotGrowth(watered.nextState.plots["home-2"], t0 + 5_000);
    expect(mid.progress).toBeGreaterThan(early.progress + 0.3);

    // Crystal mist fertilizes straight to stage 3 ready-to-harvest bloom
    const bloomed = fertilizeGardenPlot(watered.nextState, "home-2", t0 + 6_000);
    expect(computePlotGrowth(bloomed.plots["home-2"], t0 + 6_000).stage).toBe(3);
    expect(computePlotGrowth(bloomed.plots["home-2"], t0 + 6_000).readyToHarvest).toBe(true);

    // Harvesting awards sparks, increments Almanac counts & clears plot for replanting
    const harvested = harvestGardenPlot(bloomed, "home-2", t0 + 7_000, { forceGolden: false });
    expect(harvested.harvested?.id).toBe("orchid");
    expect(harvested.sparksEarned).toBe(7);
    expect(harvested.isGolden).toBe(false);
    expect(harvested.yieldCount).toBe(1);
    expect(harvested.nextState.totalHarvests).toBe(1);
    expect(harvested.nextState.harvestedCounts.orchid).toBe(1);
    expect(harvested.nextState.plots["home-2"].speciesId).toBeNull();

    // Rare Golden Harvest yields 2x petals, 1.5x rounded sparks & Golden Almanac star!
    const replanted = fertilizeGardenPlot(
      plantSeedInPlot(harvested.nextState, "home-2", "lotus", t0 + 8_000),
      "home-2",
      t0 + 8_000
    );
    const golden = harvestGardenPlot(replanted, "home-2", t0 + 9_000, { forceGolden: true });
    expect(golden.isGolden).toBe(true);
    expect(golden.yieldCount).toBe(2);
    expect(golden.sparksEarned).toBe(14); // ceil(9 * 1.5)
    expect(golden.nextState.goldenHarvests).toBe(1);
    expect(golden.nextState.goldenSpecies?.lotus).toBe(1);

    // Weather growth multiplier accelerates plant progress & bulk Crystal Bloom blooms all planted beds
    const rainBed = plantSeedInPlot(golden.nextState, "home-3", "lavender", t0 + 10_000);
    const normalGrow = computePlotGrowth(rainBed.plots["home-3"], t0 + 20_000, 1.0);
    const rainGrow = computePlotGrowth(rainBed.plots["home-3"], t0 + 20_000, 1.5);
    expect(rainGrow.progress).toBeGreaterThan(normalGrow.progress);
    const autoWater = waterRandomGrowingPlot(rainBed, t0 + 20_000);
    expect(autoWater.wateredPlotId).not.toBeNull();
    const bloomAll = bloomAllPlantedPlots(rainBed, t0 + 20_000);
    expect(bloomAll.bloomedPlotIds).toContain("home-3");
    expect(computePlotGrowth(bloomAll.nextState.plots["home-3"], t0 + 20_000).readyToHarvest).toBe(true);

    // Persistence round-trip
    saveGardenState(314, harvested.nextState);
    expect(loadGardenState(314).totalHarvests).toBe(1);

    // Sims Pie Actions for Garden Beds (empty / growing / ready), Conservatory & Park Benches
    const plotTarget: SimsObjectTarget = {
      kind: "garden-plot",
      label: "Park Bed #1",
      plotId: "park-1",
      worldX: 12.6,
      worldZ: 12.85
    };
    expect(getSimsPieActions(plotTarget, { gardenPlotStatus: "empty" })[0].id).toBe("garden-plant-lavender");
    expect(getSimsPieActions(plotTarget, { gardenPlotStatus: "growing" })[0].id).toBe("garden-water");
    expect(getSimsPieActions(plotTarget, { gardenPlotStatus: "ready" })[0].id).toBe("garden-harvest");
    expect(
      getSimsPieActions({ kind: "conservatory", label: "Grand Botanical Conservatory", worldX: 13.6, worldZ: 12.6 })
        .some((a) => a.id === "park-tend-community")
    ).toBe(true);
    expect(
      getSimsPieActions({ kind: "park-bench", label: "Sakura Picnic Park", worldX: -14.8, worldZ: 14.5 })
        .some((a) => a.id === "park-feed-koi")
    ).toBe(true);
  });

  it("scales neighborhood plots, outer expansion road bands, walk limits & vessel merging seamlessly from 1 to 240+ minted NFTs", () => {
    expect(MAX_NEIGHBORHOOD_PLOTS).toBeGreaterThanOrEqual(240);

    // Expansion road bands & dynamic walkable radius unlock automatically as totalSupply grows!
    expect(getExpansionBandCount(8)).toBe(0);
    expect(getExpansionBandCount(24)).toBe(0);
    expect(getExpansionBandCount(25)).toBe(1); // Band 0 (Skyline Heights)
    expect(getExpansionBandCount(48)).toBe(1);
    expect(getExpansionBandCount(49)).toBe(2); // Band 1 (Innovation Ridge)
    expect(getExpansionBandCount(73)).toBe(3); // Band 2 (Horizon Estates)

    expect(getNeighborhoodWalkLimit(6)).toBe(NEIGHBORHOOD_WALK_LIMIT);
    expect(getNeighborhoodWalkLimit(21)).toBe(NEIGHBORHOOD_WALK_LIMIT);
    // At 22 minted labs (21 neighbors + 4 surveyed blueprint lots = 25), Band 0 road & bridges form!
    expect(getNeighborhoodWalkLimit(22)).toBeGreaterThan(NEIGHBORHOOD_WALK_LIMIT + 10);
    expect(getNeighborhoodWalkLimit(50)).toBeGreaterThan(getNeighborhoodWalkLimit(25));
    expect(getExpansionBandAvenueSpan(1) - getExpansionBandAvenueSpan(0)).toBeCloseTo(10.6, 5);

    // Every upcoming blueprint lot transforms into the EXACT next minted plot's position & facing!
    for (const supply of [1, 6, 9, 24, 25, 49, 130]) {
      const rosterBefore = buildNeighborhoodRoster(1, [], supply);
      const nextLots = computeUpcomingBlueprintLots(rosterBefore.length, 4);
      expect(nextLots).toHaveLength(4);
      const rosterAfter = buildNeighborhoodRoster(1, [], supply + 1);
      expect(rosterAfter).toHaveLength(rosterBefore.length + 1);
      const placedAfter = computeNeighborhoodPlacements(rosterAfter);
      const newestPlot = placedAfter[placedAfter.length - 1];
      expect(newestPlot.x).toBe(nextLots[0].x);
      expect(newestPlot.z).toBe(nextLots[0].z);
      expect(newestPlot.rotY).toBe(nextLots[0].rotY);
      expect(newestPlot.districtName).toBe(nextLots[0].districtName);
    }

    // Stress-test 160 minted NFTs across Ring 1, Ring 2 & 6 Outer Expansion Road Bands:
    // ZERO overlapping plots, 100% 90° street alignment, strictly clear of canal & radial bridges!
    const largeRoster = buildNeighborhoodRoster(1, [], 161);
    expect(largeRoster).toHaveLength(160);
    const largePlacements = computeNeighborhoodPlacements(largeRoster);
    expect(largePlacements.filter((p) => p.ring === 1)).toHaveLength(8);
    expect(largePlacements.filter((p) => p.ring === 2)).toHaveLength(16);
    expect(largePlacements.filter((p) => p.ring === 3)).toHaveLength(136);

    for (let i = 0; i < largePlacements.length; i++) {
      const a = largePlacements[i];
      const qTurns = Math.round(a.rotY / (Math.PI / 2));
      expect(Math.abs(a.rotY - qTurns * (Math.PI / 2))).toBeLessThan(0.001);
      expect(Math.hypot(a.visitX, a.visitZ)).toBeLessThan(Math.hypot(a.x, a.z));
      // Must never collide with any other plot in the entire expanding metropolis
      for (let j = i + 1; j < largePlacements.length; j++) {
        const b = largePlacements[j];
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(5.4);
      }
      // Outer Ring 3 plots stay strictly outside the r=30.2..32.0 canal!
      if (a.ring === 3) {
        expect(Math.max(Math.abs(a.x), Math.abs(a.z))).toBeGreaterThan(38);
      }
    }

    // District names evolve cleanly across bands
    expect(getNeighborhoodPlotSlot(24).districtName).toBe("Skyline Heights");
    expect(getNeighborhoodPlotSlot(48).districtName).toBe("Innovation Ridge");
    expect(getNeighborhoodPlotSlot(72).districtName).toBe("Horizon Estates");
    expect(getNeighborhoodPlotSlot(96).districtName).toBe("Starlight Commons");
    expect(getNeighborhoodPlotSlot(120).districtName).toBe("Frontier Sector 1");

    // On-chain & simulated vessel merging preserves older real tokens & applies live updates without dupes
    const wave1 = createSimulatedNeighborVessels(2, 5);
    expect(wave1.vessels).toHaveLength(5);
    expect(wave1.addedImpactEth).toBeGreaterThan(0);
    const wave2 = createSimulatedNeighborVessels(7, 4);
    const upgradedToken2 = { ...wave1.vessels[0], sectorsMask: 0b111111, valueUsd: 500 };
    const merged = mergeMintedVessels(wave1.vessels, [upgradedToken2, ...wave2.vessels]);
    expect(merged).toHaveLength(9);
    expect(merged.find((v) => v.tokenId === 2)?.sectorsMask).toBe(0b111111);
    expect(merged.find((v) => v.tokenId === 2)?.valueUsd).toBe(500);
    expect(merged[0].tokenId).toBe(10);
  });

  it("drives autonomous town vehicles cleanly in right-hand road lanes, yields to pedestrians & optimizes per device tier", () => {
    // Base routes cover inner boulevard, outer park boulevards & cross-town commuter loops
    const baseRoutes = buildTrafficRoutes(0);
    expect(baseRoutes).toHaveLength(6);
    expect(baseRoutes.every((r) => !r.isExpansionRoute)).toBe(true);

    // Expanding town appends Outer Expansion Ring driving routes across the newly paved roads!
    const expandedRoutes = buildTrafficRoutes(2);
    expect(expandedRoutes).toHaveLength(8);
    expect(expandedRoutes[6].isExpansionRoute).toBe(true);
    expect(expandedRoutes[7].isExpansionRoute).toBe(true);

    // Every sampled vehicle pose along straight segments sits strictly inside a paved 2.2m road lane!
    const innerCw = baseRoutes[0];
    const midNorth = sampleRoutePose(innerCw, 6.8);
    expect(midNorth.z).toBeCloseTo(-6.8 + TRAFFIC_LANE_OFFSET, 2);
    // Corner turn near intersection smoothly curves inside the intersection without NaN
    const cornerPose = sampleRoutePose(innerCw, innerCw.segLengths[0] - 0.2);
    expect(Number.isFinite(cornerPose.x)).toBe(true);
    expect(Number.isFinite(cornerPose.z)).toBe(true);
    expect(Number.isFinite(cornerPose.yaw)).toBe(true);

    // Vehicle politely yields when a researcher steps ahead in its lane, ignores pedestrians behind or far sideways
    expect(shouldVehicleYield(0, 0, 0, 0.2, 1.8)).toBe(true);   // Directly ahead (+Z)
    expect(shouldVehicleYield(0, 0, 0, 0.2, -1.8)).toBe(false); // Behind vehicle
    expect(shouldVehicleYield(0, 0, 0, 2.5, 1.5)).toBe(false);  // Safe on sidewalk

    // Vehicle fleet grows with totalSupply and respects device tier performance caps
    expect(computeVehicleCountForTown(3, 12)).toBe(4);
    expect(computeVehicleCountForTown(15, 12)).toBe(8);
    expect(computeVehicleCountForTown(50, 12)).toBe(12);
    expect(computeVehicleCountForTown(50, 5)).toBe(5);
    const activeBps = selectActiveVehicleBlueprints(30, 10, expandedRoutes.length);
    expect(activeBps).toHaveLength(10);
    expect(activeBps.some((b) => b.routeIndex === 6)).toBe(true);

    // Sims Pie Actions exist for clicking passing town vehicles
    const vehActions = getSimsPieActions({
      kind: "vehicle",
      label: "Pearl EV Sedan",
      vehicleId: "veh-1",
      worldX: 6.3,
      worldZ: 2.0
    });
    expect(vehActions[0].id).toBe("vehicle-wave");
    expect(vehActions[1].id).toBe("vehicle-beep");

    // Cross-browser & mobile performance profile classification
    const iphoneProf = detectDevicePerfProfile({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
      cores: 4,
      deviceMemory: 3,
      coarsePointer: true,
      screenWidth: 390
    });
    expect(iphoneProf.tier).toBe("mobile");
    expect(iphoneProf.enableHeroTransmission).toBe(false);
    expect(iphoneProf.maxPixelRatio).toBeLessThanOrEqual(1.4);
    expect(iphoneProf.maxTrafficVehicles).toBeLessThanOrEqual(6);

    const safariDesktop = detectDevicePerfProfile({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
      cores: 8,
      deviceMemory: 16,
      coarsePointer: false,
      screenWidth: 1440
    });
    expect(safariDesktop.tier).toBe("balanced");
    expect(safariDesktop.enableHeroTransmission).toBe(false);

    const desktopChrome = detectDevicePerfProfile({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
      cores: 12,
      deviceMemory: 16,
      coarsePointer: false,
      screenWidth: 1920
    });
    expect(desktopChrome.tier).toBe("high");
    expect(desktopChrome.maxPixelRatio).toBe(2.0);

    // Adaptive DPR smoothly trims pixel ratio on sustained heavy frames and restores when fast!
    const dprCtrl = new AdaptivePixelRatioController(2.0, 1.0, 2.0);
    expect(dprCtrl.getPixelRatio()).toBe(2.0);
    let lowered: number | null = null;
    for (let f = 0; f < 100; f++) {
      const next = dprCtrl.recordFrame(0.036); // ~27fps sustained
      if (next !== null) lowered = next;
    }
    expect(lowered).not.toBeNull();
    expect(lowered!).toBeLessThan(2.0);
    let restored: number | null = null;
    for (let f = 0; f < 400; f++) {
      const next = dprCtrl.recordFrame(0.015); // ~66fps sustained
      if (next !== null) restored = next;
    }
    expect(restored).not.toBeNull();
    expect(restored!).toBeGreaterThan(lowered!);
  });

  it("bit-packs on-chain V2 EstateBlueprint styles/rooms accurately and switches cleanly between Example and Base Sepolia Testnet modes", () => {
    // 1. Round-trip 6-bit homely room bitmask (exact EXTRA_ROOM_DEFS IDs)
    const allIds = EXTRA_ROOM_DEFS.map((r) => r.id);
    expect(encodeExtraRoomsMask(allIds)).toBe(0b111111);
    const sampleRooms = [allIds[0], allIds[3], allIds[5]];
    const mask = encodeExtraRoomsMask(sampleRooms);
    expect(mask).toBe(0b101001);
    expect(decodeExtraRoomsMask(mask)).toEqual(sampleRooms);

    // 2. Round-trip 64-bit packed home decor & architectural finishes
    const sampleWallStyle = WALL_STYLES[2].id;
    const customDecor = {
      ...defaultLabDecor(),
      floorStyle: "oak" as const,
      wallStyle: sampleWallStyle,
      patioDecor: "cherry-tree" as const,
      seatingStyle: "egg-chair" as const,
      barStyle: "boba" as const,
      hobbyProp: "aquarium" as const,
      rugStyle: "star-weave" as const,
      plantPack: "succulents" as const,
      lightingFixture: "fairy-orbs" as const,
      houseSize: 3 as const,
      houseFloors: 3 as const,
      hasBasement: true,
      extraRooms: [allIds[0], allIds[3]]
    };
    const packed = packLabStyleBits(customDecor);
    expect(packed).toBeGreaterThan(0n);
    const unpacked = unpackLabStyleBits(packed);
    expect(unpacked.floorStyle).toBe("oak");
    expect(unpacked.wallStyle).toBe(sampleWallStyle);
    expect(unpacked.patioDecor).toBe("cherry-tree");
    expect(unpacked.seatingStyle).toBe("egg-chair");
    expect(unpacked.barStyle).toBe("boba");
    expect(unpacked.hobbyProp).toBe("aquarium");
    expect(unpacked.rugStyle).toBe("star-weave");
    expect(unpacked.plantPack).toBe("succulents");
    expect(unpacked.lightingFixture).toBe("fairy-orbs");

    // 3. Merging on-chain EstateBlueprint onto default decor applies all multi-story upgrades & rooms
    const hydrated = applyOnChainEstateToDecor(defaultLabDecor(), {
      houseSize: 3,
      houseFloors: 3,
      hasBasement: true,
      extraRoomsMask: encodeExtraRoomsMask([allIds[0], allIds[3]]),
      gardenHarvests: 12,
      stylePackedHex: `0x${packed.toString(16)}`
    });
    expect(hydrated.houseSize).toBe(3);
    expect(hydrated.houseFloors).toBe(3);
    expect(hydrated.extraRooms).toContain(allIds[0]);
    expect(hydrated.extraRooms).toContain(allIds[3]);
    expect(hydrated.hobbyProp).toBe("aquarium");

    // 4. Incremental estate expansion cost matches Solidity _computeEstateExpansion exactly!
    const est = estimateEstateExpansionCost(
      { houseSize: 1, houseFloors: 2, hasBasement: true, extraRoomsMask: 0 },
      { houseSize: 2, houseFloors: 3, hasBasement: true, extraRoomsMask: 0b000101 }
    );
    expect(est.coinCost).toBe(80 + 90 + 90); // 260 ALCH
    expect(est.ethUnits).toBe(4);

    // 5. Mode switcher builds completely clean Example vs Base Sepolia Testnet states
    const exState = loadCollectionStateForMode("example");
    expect(exState.connectedMode).toBe("simulation");
    expect(exState.contractAddress).toBe("");
    expect(exState.totalSupply).toBe(6);
    expect(exState.vessels).toHaveLength(6);

    const testState = loadCollectionStateForMode("testnet");
    expect(testState.connectedMode).toBe("sepolia");
    expect(testState.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(testState.coinAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(testState.chainId).toBe(84532);
  });

  it("tracks multi-step progression quest chains, 14 achievement badges, researcher XP ranks & claimable spark rewards", () => {
    expect(QUEST_STEPS).toHaveLength(18); // 6 chains × 3 progressive steps (incl. Master Alchemist)
    expect(ACHIEVEMENT_DEFS).toHaveLength(14);
    expect(RESEARCHER_RANKS).toHaveLength(8);

    const baseMetrics = {
      builtRoomsCount: 0,
      houseSize: 1,
      houseFloors: 2,
      totalStationUpgrades: 0,
      builtLabWingsCount: 0,
      totalHarvests: 0,
      uniqueSpeciesHarvested: 0,
      totalMintedLabs: 6,
      expansionBandsUnlocked: 0,
      bestRelationScore: 0
    };

    let state = createInitialProgressionState();
    expect(getResearcherRank(state.xp).level).toBe(1);
    expect(evaluateQuestChains(state, baseMetrics).every((q) => !q.readyToClaim)).toBe(true);

    // Record player actions -> unlocks Step 1 quests & Common achievements
    state = recordProgressionAction(state, "furnishActions", 1);
    state = recordProgressionAction(state, "protonPops", 5);
    state = recordProgressionAction(state, "vehicleWaves", 2);
    state = recordProgressionAction(state, "floorChanges", 1);
    state = recordProgressionAction(state, "petCareActions", 2);

    const chainsBefore = evaluateQuestChains(state, baseMetrics);
    expect(chainsBefore.find((c) => c.chainId === "architect")?.readyToClaim).toBe(true);
    expect(chainsBefore.find((c) => c.chainId === "science")?.readyToClaim).toBe(true);
    expect(chainsBefore.find((c) => c.chainId === "town")?.readyToClaim).toBe(true);

    // Claim Architect Step 1 -> awards Sparks & XP and advances chain to Step 2!
    const claimArch1 = claimQuestReward(state, baseMetrics, "q-arch-1");
    expect(claimArch1.claimed).toBe(true);
    expect(claimArch1.sparksAwarded).toBe(8);
    expect(claimArch1.xpAwarded).toBe(25);
    // Double-claiming same quest is idempotent and awards 0
    expect(claimQuestReward(claimArch1.nextState, baseMetrics, "q-arch-1").claimed).toBe(false);
    state = claimArch1.nextState;
    expect(evaluateQuestChains(state, baseMetrics).find((c) => c.chainId === "architect")?.activeStep.id).toBe(
      "q-arch-2"
    );

    // Claim an unlocked achievement ("ach-traffic" -> Beep Beep Boulevard)
    const achRes = claimAchievementReward(state, baseMetrics, "ach-traffic");
    expect(achRes.claimed).toBe(true);
    expect(achRes.sparksAwarded).toBe(10);
    state = achRes.nextState;

    // Claim All Ready collects remaining quests & achievements and ranks up researcher!
    const bulk = claimAllReadyRewards(state, {
      ...baseMetrics,
      builtRoomsCount: 3,
      totalHarvests: 5,
      uniqueSpeciesHarvested: 4,
      totalMintedLabs: 26,
      expansionBandsUnlocked: 1,
      bestRelationScore: 45,
      totalStationUpgrades: 3
    });
    expect(bulk.claimedCount).toBeGreaterThanOrEqual(8);
    expect(bulk.sparksAwarded).toBeGreaterThan(150);
    expect(bulk.leveledUp).toBe(true);
    expect(bulk.newRank.level).toBeGreaterThanOrEqual(4);
    expect(bulk.newRank.unlockedTitles.length).toBeGreaterThanOrEqual(4);
  });

  it("interconnects Botanical Alchemy brewing, timed Elixir buffs, Town Weather, UTC Daily Bounties, Neighbor Favors, Pet Tricks & Blueprint Slots", () => {
    // 1. Botanical Alchemy Brewing Bench (6 recipes, Warm Kitchenette 2x yield, timed buffs)
    expect(ALCHEMY_RECIPES).toHaveLength(6);
    const now = Date.parse("2026-11-23T15:00:00Z");
    let pouch = createInitialAlchemyState();
    expect(canCraftRecipe(pouch, "mint-focus-tea")).toBe(true);

    // Kitchenette grants +1 bonus spark and can produce a 2x batch!
    const teaBrew = craftAlchemyRecipe(pouch, "mint-focus-tea", {
      hasKitchen: true,
      forceKitchenDouble: true
    });
    expect(teaBrew.crafted).toBe(true);
    expect(teaBrew.yieldCount).toBe(2);
    expect(teaBrew.kitchenBonusSparks).toBe(1);
    pouch = teaBrew.nextState;
    expect(pouch.crafted["mint-focus-tea"]).toBe(2);

    const sipped = consumeCraftedItem(pouch, "mint-focus-tea", now);
    expect(sipped.consumed).toBe(true);
    expect(sipped.buffActivated?.id).toBe("focus");
    expect(computeElixirFocusMultiplier(sipped.nextState, now + 60_000)).toBe(1.4);
    expect(getActiveElixirBuffs(sipped.nextState, now + 11 * 60_000)).toHaveLength(0);

    // Add rare flowers & brew Philosopher's Starlight Elixir (+35% Mining & Focus!)
    let rarePouch = addHarvestedBotanicals(sipped.nextState, "lotus", 1, true);
    rarePouch = addHarvestedBotanicals(rarePouch, "orchid", 1, false);
    rarePouch = addHarvestedBotanicals(rarePouch, "sakura", 1, false);
    expect(rarePouch.goldenBloomsCollected).toBe(1);
    const starBrew = craftAlchemyRecipe(rarePouch, "starlight-elixir");
    expect(starBrew.crafted).toBe(true);
    expect(starBrew.nextState.starlightCrafted).toBe(1);
    const starUsed = consumeCraftedItem(starBrew.nextState, "starlight-elixir", now);
    expect(computeElixirMiningMultiplier(starUsed.nextState, now + 1000)).toBe(1.35);
    expect(computeElixirFocusMultiplier(starUsed.nextState, now + 1000)).toBe(1.75); // 1 + 0.40 + 0.35

    // 2. Dynamic Town Weather, Rotating UTC Daily Bounties & Neighbor Favors + Friendship Synergy
    expect(TOWN_WEATHERS).toHaveLength(4);
    expect(TOWN_WEATHERS.some((w) => w.autoWatersGardens && w.gardenGrowthMult === 1.5)).toBe(true);
    expect(TOWN_WEATHERS.some((w) => w.id === getAutoTownWeather(now).id)).toBe(true);

    expect(DAILY_BOUNTY_POOL.length).toBeGreaterThanOrEqual(7);
    const day1 = getDailyTownBounties(Date.parse("2026-11-23T09:00:00Z"));
    const day1Late = getDailyTownBounties(Date.parse("2026-11-23T23:55:00Z"));
    expect(day1).toHaveLength(3);
    expect(day1.map((b) => b.id)).toEqual(day1Late.map((b) => b.id));

    let dbState = createInitialDailyBountyState(now);
    const firstBounty = day1[0];
    dbState = recordDailyBountyAction(dbState, firstBounty.metric, firstBounty.target, now);
    const evalB = evaluateDailyTownBounties(dbState, now);
    expect(evalB[0].readyToClaim).toBe(true);
    const claimedB = claimDailyBounty(dbState, firstBounty.id, now);
    expect(claimedB.claimed).toBe(true);
    expect(claimedB.sparksAwarded).toBe(firstBounty.rewardSparks);
    expect(claimDailyBounty(claimedB.nextState, firstBounty.id, now).claimed).toBe(false);

    // Neighbor Daily Favor & Best-Friend Synergy Bonus
    const fav = getNeighborDailyFavor(2, "0xabc12345", now);
    expect(["bouquet", "spark", "joke", "chat"]).toContain(fav.kind);
    expect(isNeighborFavorFulfilled(dbState, 2, now)).toBe(false);
    const fulfilledDb = markNeighborFavorFulfilled(dbState, 2, now);
    expect(isNeighborFavorFulfilled(fulfilledDb, 2, now)).toBe(true);

    const synergy = computeTownFriendshipSynergy({
      2: { tokenId: 2, score: 82, interactions: 6, lastInteractionMs: now }, // Best Friend (+6%)
      3: { tokenId: 3, score: 62, interactions: 4, lastInteractionMs: now }, // Good Friend (+3%)
      4: { tokenId: 4, score: 95, interactions: 10, lastInteractionMs: now } // Soulmate (+6%)
    });
    expect(synergy.bestFriendCount).toBe(2);
    expect(synergy.goodFriendCount).toBe(1);
    expect(synergy.bonusPct).toBe(15);
    expect(synergy.miningMultiplier).toBe(1.15);

    // 3. Trainable Pet Tricks, Cooldowns, Daily Chest & Gourmet Ambrosia
    expect(PET_TRICKS).toHaveLength(4);
    const lv1Pet: CompanionVitals = {
      energy: 50,
      mood: 50,
      curiosity: 50,
      level: 1,
      careStreak: 2,
      dailyStreak: 3,
      lastCareDay: "2026-11-23",
      petName: "Mochi",
      accessory: "bowtie",
      sleeping: false,
      lastUpdatedMs: now
    };
    // Lv.3 trick is locked for Lv.1 pet
    expect(performPetTrick(lv1Pet, "garden-sniff", now).reason).toBe("locked");
    // Lv.1 Fetch Spark succeeds & enters cooldown
    const fetchRes = performPetTrick(lv1Pet, "fetch-spark", now);
    expect(fetchRes.performed).toBe(true);
    expect(fetchRes.sparksFound).toBeGreaterThanOrEqual(4);
    expect(getTrickCooldownLeftSec(fetchRes.nextVitals, "fetch-spark", now + 5_000)).toBe(30);
    expect(performPetTrick(fetchRes.nextVitals, "fetch-spark", now + 5_000).reason).toBe("cooldown");
    // Lv.3 pet triggers Garden Helper water flag
    const lv3Garden = performPetTrick({ ...lv1Pet, level: 3 }, "garden-sniff", now);
    expect(lv3Garden.performed).toBe(true);
    expect(lv3Garden.triggerGardenWater).toBe(true);
    // Daily Companion Chest & Gourmet Pet Ambrosia
    expect(canClaimDailyPetChest(lv1Pet, now)).toBe(true);
    const chestRes = claimDailyPetChest(lv1Pet, now);
    expect(chestRes.claimed).toBe(true);
    expect(chestRes.sparksAwarded).toBe(14); // 8 + 3*2
    expect(canClaimDailyPetChest(chestRes.nextVitals, now)).toBe(false);
    const ambrosiaPet = feedGourmetAmbrosia(lv1Pet, now);
    expect(ambrosiaPet.energy).toBe(100);
    expect(ambrosiaPet.mood).toBe(100);
    expect(ambrosiaPet.curiosity).toBe(100);

    // 4. Architect Home Blueprint Save / Load / Delete Slots
    const styled = {
      ...defaultLabDecor(),
      floorStyle: "marble" as const,
      seatingStyle: "egg-chair" as const
    };
    const savedSlots = saveHomeBlueprintSlot(515, 0, styled, "Crystal Study");
    expect(savedSlots[0]?.name).toBe("Crystal Study");
    expect(savedSlots[0]?.decor.seatingStyle).toBe("egg-chair");
    expect(loadHomeBlueprintSlots(515)[0]?.decor.floorStyle).toBe("marble");
    const clearedSlots = deleteHomeBlueprintSlot(515, 0);
    expect(clearedSlots[0]).toBeNull();

    // 5. ResearcherAvatar3D builds all 9 hairstyles cleanly without front-of-face cylinder blocking
    //    and preserves shared GPU geometries safely across rebuilds & disposes!
    const defaultProf = createDefaultCharacterProfile();
    const avatar = new ResearcherAvatar3D(defaultProf, { enablePlumbob: true });
    for (const hs of HAIR_STYLES) {
      avatar.rebuild({ ...defaultProf, hairStyle: hs.id });
      avatar.update(0.016, 1.2, 0.5, true, 0.08);
      // Verify no open-ended hair cylinder in the head was flipped backward (rotation.y === Math.PI)
      avatar.root.traverse((obj) => {
        const mesh = obj as { geometry?: { type?: string }; rotation?: { y: number } };
        if (mesh.geometry?.type === "CylinderGeometry" && hs.id === "bob") {
          // Bob cylinder sits around head with open front at theta=0 (+Z), never flipped by PI!
          const isFlippedHeadCyl =
            Math.abs((mesh.rotation?.y ?? 0) - Math.PI) < 0.05 &&
            (obj.parent?.position.y ?? 0) > 0.7;
          expect(isFlippedHeadCyl).toBe(false);
        }
      });
    }
    avatar.disposeRig();
    // Creating a second avatar after disposing the first still succeeds cleanly with shared buffers
    const avatar2 = new ResearcherAvatar3D(defaultProf);
    expect(avatar2.root.children.length).toBeGreaterThan(0);
    avatar2.disposeRig();
  });
});
