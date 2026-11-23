import { useState } from "react";
import type { ResidueNode } from "../engine/researchCompute";
import type { SecondaryCode } from "../engine/structuralAnalysis";

interface SequenceRibbonBarProps {
  residues: ResidueNode[];
  secondaryCodes: SecondaryCode[];
  onHoverResidue: (index: number | null) => void;
}

const AA_FULL_NAMES: Record<string, string> = {
  A: "Alanine",
  R: "Arginine",
  N: "Asparagine",
  D: "Aspartic acid",
  C: "Cysteine",
  Q: "Glutamine",
  E: "Glutamic acid",
  G: "Glycine",
  H: "Histidine",
  I: "Isoleucine",
  L: "Leucine",
  K: "Lysine",
  M: "Methionine",
  F: "Phenylalanine",
  P: "Proline",
  S: "Serine",
  T: "Threonine",
  W: "Tryptophan",
  Y: "Tyrosine",
  V: "Valine"
};

const SS_LABELS: Record<SecondaryCode, string> = {
  H: "Alpha helix",
  E: "Beta sheet",
  C: "Coil / turn"
};

/**
 * Mol* / RCSB PDB-standard 1D secondary structure sequence ribbon with bidirectional 3D hover linking:
 *  - Alpha Helix (H): Rose/Magenta
 *  - Beta Sheet  (E): Amber/Gold
 *  - Coil/Turn   (C): Neutral Alabaster Slate
 */
export function SequenceRibbonBar({
  residues,
  secondaryCodes,
  onHoverResidue
}: SequenceRibbonBarProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (residues.length === 0) return null;

  const activeRes = hoveredIdx !== null ? residues[hoveredIdx] : null;
  const activeSS = hoveredIdx !== null ? secondaryCodes[hoveredIdx] || "C" : null;

  const describeProperty = (r: ResidueNode) => {
    if (r.aromatic) return "Hydrophobic aromatic ring";
    if (r.charge > 0) return "Positively charged (+1)";
    if (r.charge < 0) return "Negatively charged (-1)";
    if (r.hydrophobic) return "Hydrophobic core";
    return "Polar surface";
  };

  return (
    <div className="seq-ribbon-box" aria-label="Amino acid sequence with live secondary structure">
      <div className="seq-ribbon-head">
        <span className="seq-ribbon-caption">
          {activeRes && activeSS && hoveredIdx !== null
            ? `${AA_FULL_NAMES[activeRes.code1] || activeRes.label}-${hoveredIdx + 1} (${activeRes.code1}) · ${describeProperty(activeRes)} · ${SS_LABELS[activeSS]}`
            : "Hover any amino acid to spotlight it in 3D"}
        </span>
        <span className="seq-legend">
          <i style={{ background: "#ec4899" }} /> Helix
          <i style={{ background: "#f59e0b", marginLeft: 7 }} /> Sheet
          <i style={{ background: "#cbd5e1", marginLeft: 7 }} /> Coil
        </span>
      </div>

      <div
        className="seq-ribbon-cells"
        onMouseLeave={() => {
          setHoveredIdx(null);
          onHoverResidue(null);
        }}
      >
        {residues.map((r, i) => {
          const code = secondaryCodes[i] || "C";
          const isActive = hoveredIdx === i;
          return (
            <button
              key={`${i}-${r.code1}`}
              type="button"
              className={`seq-cell ss-${code} ${isActive ? "is-hovered" : ""}`}
              onMouseEnter={() => {
                setHoveredIdx(i);
                onHoverResidue(i);
              }}
              onFocus={() => {
                setHoveredIdx(i);
                onHoverResidue(i);
              }}
              onBlur={() => {
                setHoveredIdx(null);
                onHoverResidue(null);
              }}
              aria-label={`Residue ${i + 1} ${AA_FULL_NAMES[r.code1] || r.label}, ${SS_LABELS[code]}`}
            >
              {r.code1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
