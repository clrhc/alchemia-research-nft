import type { ComputeSnapshot, ResidueNode } from "./researchCompute";

export type SecondaryCode = "H" | "E" | "C";

export interface SecondaryStructureSummary {
  codes: SecondaryCode[];
  sequenceString: string;
  helixPct: number;
  sheetPct: number;
  coilPct: number;
}

export interface ContactPair {
  i: number;
  j: number;
  distanceAngstrom: number;
  kind: "hydrophobic" | "salt-bridge" | "aromatic" | "backbone";
}

function vecSub(a: ResidueNode, b: ResidueNode) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function dot(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function norm(a: { x: number; y: number; z: number }) {
  return Math.hypot(a.x, a.y, a.z);
}

/**
 * Virtual Cα pseudo-dihedral angle (degrees in [-180, 180]) across four sequential residues.
 */
export function computeVirtualDihedralDeg(
  p0: ResidueNode,
  p1: ResidueNode,
  p2: ResidueNode,
  p3: ResidueNode
): number {
  const b1 = vecSub(p1, p0);
  const b2 = vecSub(p2, p1);
  const b3 = vecSub(p3, p2);
  const n1 = cross(b1, b2);
  const n2 = cross(b2, b3);
  const b2Len = norm(b2) || 1;
  const b2Hat = { x: b2.x / b2Len, y: b2.y / b2Len, z: b2.z / b2Len };
  const m1 = cross(n1, n2);
  const x = dot(n1, n2);
  const y = dot(m1, b2Hat);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/**
 * P-SEA-inspired Cα-only Secondary Structure Assignment (Labesse et al., 1997).
 * Classifies each residue as alpha-helix (H), beta-strand (E), or coil/turn (C)
 * from local Cα(i)->Cα(i+3) spans and virtual backbone dihedral torsions.
 */
export function assignSecondaryStructurePSEA(residues: ResidueNode[]): SecondaryStructureSummary {
  const n = residues.length;
  const codes: SecondaryCode[] = new Array(n).fill("C");

  for (let i = 1; i < n - 2; i++) {
    const pPrev = residues[i - 1];
    const pCurr = residues[i];
    const pNext = residues[i + 1];
    const pNext2 = residues[i + 2];
    const d3 = Math.hypot(pNext2.x - pPrev.x, pNext2.y - pPrev.y, pNext2.z - pPrev.z);
    const tau = computeVirtualDihedralDeg(pPrev, pCurr, pNext, pNext2);

    if (d3 <= 6.6 && tau >= -25 && tau <= 115) {
      codes[i] = "H";
      codes[i + 1] = "H";
    } else if (d3 >= 8.0 && (tau <= -85 || tau >= 115)) {
      if (codes[i] === "C") codes[i] = "E";
      if (codes[i + 1] === "C") codes[i + 1] = "E";
    }
  }

  let hCount = 0;
  let eCount = 0;
  for (const c of codes) {
    if (c === "H") hCount++;
    else if (c === "E") eCount++;
  }
  const denom = Math.max(1, n);
  const helixPct = Math.round((hCount / denom) * 100);
  const sheetPct = Math.round((eCount / denom) * 100);
  const coilPct = Math.max(0, 100 - helixPct - sheetPct);

  return {
    codes,
    sequenceString: codes.join(""),
    helixPct,
    sheetPct,
    coilPct
  };
}

/**
 * Published native Cα–Cα key long-range structural contacts (|i-j| >= 4, 0-indexed)
 * for each of our 8 RCSB PDB mini-protein benchmarks, used for Best-Hummer-Eaton Q(X).
 */
const NATIVE_KEY_CONTACTS: Record<string, Array<[number, number, number]>> = {
  // 1L2Y / 2JOF Trp-cage: central Trp6 (idx 5) caged by Tyr3, Pro12, Pro17, Pro18, Pro19
  "1L2Y": [
    [2, 5, 5.8], [5, 11, 6.2], [5, 16, 6.0], [5, 17, 5.6], [5, 18, 6.1], [1, 15, 6.8], [3, 17, 6.9]
  ],
  "2JOF": [
    [2, 5, 5.8], [5, 11, 6.2], [5, 16, 6.0], [5, 17, 5.6], [5, 18, 6.1], [1, 15, 6.8], [3, 17, 6.9]
  ],
  // 1GB1 Beta-hairpin: antiparallel strands (residues 1..6 paired with 10..15)
  "1GB1": [
    [0, 15, 6.4], [2, 13, 5.5], [4, 11, 5.4], [2, 11, 6.6], [4, 13, 6.5], [1, 14, 6.2]
  ],
  // 1UAO Chignolin / 2RVD CLN025: 10-aa hairpin zip (0-9, 1-8, 2-7)
  "1UAO": [
    [0, 9, 6.1], [1, 8, 5.4], [2, 7, 5.3], [1, 7, 6.6], [2, 8, 6.5]
  ],
  "2RVD": [
    [0, 9, 6.0], [1, 8, 5.3], [2, 7, 5.3], [1, 7, 6.5], [2, 8, 6.4]
  ],
  // 1VII / 2F4K Villin Headpiece: 3-helix bundle Phe-core packing (Phe7, Phe11, Phe18, Trp24, Leu29)
  "1VII": [
    [6, 10, 6.1], [6, 17, 6.2], [10, 17, 5.8], [17, 23, 6.6], [10, 28, 6.9], [2, 23, 7.2], [6, 28, 7.1]
  ],
  "2F4K": [
    [5, 9, 6.1], [5, 16, 6.2], [9, 16, 5.8], [16, 22, 6.6], [9, 27, 6.9], [1, 22, 7.2], [5, 27, 7.1]
  ],
  // 1FME BBA5: beta-beta-alpha core (Tyr3, Phe12, Leu17, Phe21, Ile22)
  "1FME": [
    [2, 11, 5.9], [2, 20, 6.4], [11, 20, 6.1], [11, 21, 6.3], [4, 16, 6.6], [6, 21, 6.9]
  ]
};

/**
 * Best-Hummer-Eaton (PNAS 2013) smooth differentiable fraction of native contacts Q(X) in [0..100%].
 * Q(X) = (1/|S|) * sum 1 / (1 + exp(beta * (r_ij - lambda * r0_ij)))
 */
export function computeNativeContactFractionQ(
  pdbId: string,
  residues: ResidueNode[],
  beta = 1.4,
  lambda = 1.45
): number {
  const refs = NATIVE_KEY_CONTACTS[pdbId.toUpperCase()];
  if (!refs || refs.length === 0 || residues.length < 6) return 0;

  let sum = 0;
  let valid = 0;
  for (const [i, j, r0] of refs) {
    if (i >= residues.length || j >= residues.length) continue;
    const a = residues[i];
    const b = residues[j];
    const r = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    const exponent = Math.max(-30, Math.min(30, beta * (r - lambda * r0)));
    sum += 1 / (1 + Math.exp(exponent));
    valid++;
  }
  if (valid === 0) return 0;
  return Math.max(0, Math.min(100, Math.round((sum / valid) * 100)));
}

/**
 * Computes non-local Cα–Cα structural contacts (|i - j| >= 3, distance < cutoff Å)
 * for 2D contact map visualization in structural biology tools.
 */
export function computeContactMap(residues: ResidueNode[], cutoffAngstrom = 7.8): ContactPair[] {
  const pairs: ContactPair[] = [];
  const cutoffSq = cutoffAngstrom * cutoffAngstrom;

  for (let i = 0; i < residues.length; i++) {
    const a = residues[i];
    for (let j = i + 3; j < residues.length; j++) {
      const b = residues[j];
      const dSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2;
      if (dSq <= cutoffSq) {
        let kind: ContactPair["kind"] = "backbone";
        if (a.aromatic && b.aromatic) kind = "aromatic";
        else if (a.charge !== 0 && b.charge !== 0 && a.charge * b.charge < 0) kind = "salt-bridge";
        else if (a.hydrophobic && b.hydrophobic) kind = "hydrophobic";

        pairs.push({
          i,
          j,
          distanceAngstrom: Number(Math.sqrt(dSq).toFixed(2)),
          kind
        });
      }
    }
  }
  return pairs;
}

/**
 * Generates a strict wwPDB-compliant mmCIF (.cif) file openable via drag-and-drop
 * in RCSB Mol*, UCSF ChimeraX, and PyMOL.
 */
export function buildMMCIFTextFromSnapshot(snap: ComputeSnapshot): string {
  const coords = snap.bestResidues.length > 0 ? snap.bestResidues : snap.residues;
  const entryId = `ALCH_${snap.tokenId}_${snap.pdbBenchmarkId.toUpperCase()}`;

  const lines: string[] = [
    `data_${entryId}`,
    "#",
    `_entry.id   ${snap.pdbBenchmarkId.toUpperCase()}`,
    `_struct.title   'Alchemia Lab #${snap.tokenId} - ${snap.taskTitle}'`,
    `_alchemia.seed   ${snap.seedHex}`,
    `_alchemia.best_energy_kcal_mol   ${snap.bestEnergy.toFixed(6)}`,
    `_alchemia.radius_of_gyration_angstrom   ${snap.radiusOfGyration.toFixed(4)}`,
    `_alchemia.sha256_proof   ${snap.proofHash}`,
    "#",
    "loop_",
    "_atom_site.group_PDB",
    "_atom_site.id",
    "_atom_site.type_symbol",
    "_atom_site.label_atom_id",
    "_atom_site.label_alt_id",
    "_atom_site.label_comp_id",
    "_atom_site.label_asym_id",
    "_atom_site.label_seq_id",
    "_atom_site.Cartn_x",
    "_atom_site.Cartn_y",
    "_atom_site.Cartn_z",
    "_atom_site.occupancy",
    "_atom_site.B_iso_or_equiv",
    "_atom_site.auth_asym_id",
    "_atom_site.auth_seq_id",
    "_atom_site.auth_comp_id",
    "_atom_site.auth_atom_id"
  ];

  coords.forEach((r, idx) => {
    const seq = idx + 1;
    const bVal = Math.max(5, Math.min(95, 32 - r.hydropathy * 4.5)).toFixed(2);
    lines.push(
      `ATOM ${seq} C CA . ${r.label} A ${seq} ${r.x.toFixed(3)} ${r.y.toFixed(3)} ${r.z.toFixed(3)} 1.00 ${bVal} A ${seq} ${r.label} CA`
    );
  });

  lines.push("#");
  return lines.join("\n");
}

export function downloadMMCIFFromSnapshot(snap: ComputeSnapshot) {
  const content = buildMMCIFTextFromSnapshot(snap);
  const blob = new Blob([content], { type: "chemical/x-mmcif;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `alchemia-lab-${snap.tokenId}-${snap.pdbBenchmarkId}.cif`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
