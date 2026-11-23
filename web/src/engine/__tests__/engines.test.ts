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
  computeNativeContactFractionQ
} from "../structuralAnalysis";
import {
  applyGentleDecay,
  applyTamagotchiAction,
  companionBoostMultiplier,
  companionMoodLabel,
  cycleCompanionAccessory,
  setCompanionPetName,
  toggleCompanionSleep,
  type CompanionVitals
} from "../tamagotchi";
import { deriveTraitsFromSeed, normalizeSeed } from "../prng";
import { computeMiningRatePerHour, countSectors, SLIDER_USD_STOPS } from "../../web3/sectors";

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
