import type { ContactPair } from "../engine/structuralAnalysis";

interface ContactMapSvgProps {
  residueCount: number;
  contacts: ContactPair[];
}

const CONTACT_COLORS: Record<ContactPair["kind"], string> = {
  hydrophobic: "#fb7185",
  "salt-bridge": "#38bdf8",
  aromatic: "#f59e0b",
  backbone: "#94a3b8"
};

/**
 * Compact 2D Residue-Residue Distance Contact Map (standard structural biology chart).
 * Symmetric matrix where each point (i, j) marks an active non-local Cα contact (< 7.8 Å).
 */
export function ContactMapSvg({ residueCount, contacts }: ContactMapSvgProps) {
  const n = Math.max(4, residueCount);
  const size = 128;
  const pad = 8;
  const span = size - pad * 2;
  const cell = span / n;

  return (
    <div className="contact-map-wrap">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="contact-map-svg"
        role="img"
        aria-label={`2D protein contact map showing ${contacts.length} residue contacts`}
      >
        <rect
          x={pad}
          y={pad}
          width={span}
          height={span}
          rx={6}
          fill="#ffffff"
          stroke="rgba(148,163,184,0.34)"
          strokeWidth="1"
        />
        <line
          x1={pad}
          y1={pad}
          x2={pad + span}
          y2={pad + span}
          stroke="rgba(148,163,184,0.35)"
          strokeDasharray="2 3"
          strokeWidth="0.9"
        />
        {contacts.map((c, idx) => {
          const x1 = pad + (c.i + 0.5) * cell;
          const y1 = pad + (c.j + 0.5) * cell;
          const r = Math.max(1.6, Math.min(3.4, cell * 0.44));
          const fill = CONTACT_COLORS[c.kind];
          return (
            <g key={`${c.i}-${c.j}-${idx}`}>
              <circle cx={x1} cy={y1} r={r} fill={fill} fillOpacity="0.86" />
              <circle cx={y1} cy={x1} r={r} fill={fill} fillOpacity="0.86" />
            </g>
          );
        })}
      </svg>
      <div className="contact-map-legend">
        <span><i style={{ background: "#fb7185" }} /> Hydrophobic</span>
        <span><i style={{ background: "#38bdf8" }} /> Salt bridge</span>
        <span><i style={{ background: "#f59e0b" }} /> Aromatic</span>
      </div>
    </div>
  );
}
