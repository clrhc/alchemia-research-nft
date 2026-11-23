import type { AlchemyTraits } from "../engine/traits";
import { LAB_SECTORS, hasSector } from "../web3/sectors";

interface LabThumbnailSvgProps {
  traits: AlchemyTraits;
  tier: number;
  sectorsMask: number;
}

const FLASK_PATHS = [
  "M90 54h20v26l28 56q3 10-8 10H70q-11 0-8-10l28-56z",
  "M91 52h18v28a36 36 0 1 1-18 0z",
  "M79 60h42l9 66-18 20H88l-18-20z",
  "M92 50h16v25c19 5 25 27 12 39 15 13 9 32-10 32H90c-19 0-25-19-10-32-13-12-7-34 12-39z",
  "M93 48h14v24l16 22-8 14 19 28q2 10-8 10H74q-10 0-8-10l19-28-8-14 16-22z"
];

const SECTOR_POS: Array<[number, number]> = [
  [36, 56],
  [164, 96],
  [36, 128],
  [164, 134],
  [164, 56],
  [100, 26]
];

export function LabThumbnailSvg({ traits, tier, sectorsMask }: LabThumbnailSvgProps) {
  const pal = traits.palette;
  const clipId = `fl-${traits.seed.slice(2, 10)}`;
  const gradId = `lg-${traits.seed.slice(2, 10)}`;
  const flaskD = FLASK_PATHS[traits.vesselIdx] || FLASK_PATHS[0];
  const isDuo = traits.familiar.species === "Duo" || tier >= 4 || hasSector(sectorsMask, 3);
  const showCat = isDuo || traits.familiar.species === "Cat";
  const showDog = isDuo || traits.familiar.species === "Dog";
  const fillY = 142 - (38 + tier * 9);

  return (
    <svg
      viewBox="0 0 200 184"
      className="lab-thumb-svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={pal.liquidTop} />
          <stop offset="55%" stopColor={pal.liquidMid} />
          <stop offset="100%" stopColor={pal.liquidBottom} />
        </linearGradient>
        <clipPath id={clipId}>
          <path d={flaskD} />
        </clipPath>
      </defs>

      {/* Architectural terrazzo rotunda plinth */}
      <ellipse
        cx="100"
        cy="148"
        rx="66"
        ry="15"
        fill="#ffffff"
        fillOpacity="0.85"
        stroke="#cbd5e1"
        strokeWidth="1"
      />
      <ellipse
        cx="100"
        cy="147"
        rx="52"
        ry="10"
        fill={pal.liquidTop}
        fillOpacity="0.18"
        stroke={pal.liquidMid}
        strokeOpacity="0.45"
        strokeWidth="0.9"
      />

      {/* Orbital blueprint rings */}
      <g fill="none" strokeOpacity="0.5">
        <circle cx="100" cy="100" r="56" stroke="#94a3b8" strokeDasharray="3 4" strokeWidth="0.9" />
        <ellipse
          cx="100"
          cy="100"
          rx="62"
          ry="22"
          transform="rotate(-24 100 100)"
          stroke={pal.liquidMid}
          strokeWidth="1.1"
        />
        <ellipse
          cx="100"
          cy="100"
          rx="62"
          ry="22"
          transform="rotate(26 100 100)"
          stroke={pal.electron}
          strokeWidth="1.1"
        />
        {tier >= 3 && (
          <circle
            cx="100"
            cy="100"
            r="68"
            stroke={pal.accent}
            strokeOpacity="0.34"
            strokeDasharray="2 5"
            strokeWidth="0.9"
          />
        )}
      </g>

      {/* 6 Sims-style room blueprint pips */}
      {LAB_SECTORS.map((sec) => {
        const [sx, sy] = SECTOR_POS[sec.id];
        const built = hasSector(sectorsMask, sec.id);
        return (
          <g key={sec.id} transform={`translate(${sx}, ${sy})`}>
            <circle
              r={built ? 5.2 : 3.4}
              fill={built ? "#ffffff" : "rgba(255,255,255,0.45)"}
              stroke={built ? sec.accent : "#cbd5e1"}
              strokeWidth={built ? 1.8 : 0.9}
            />
            {built && <circle r="2" fill={sec.accent} />}
          </g>
        );
      })}

      {/* Glass flask liquid + silhouette */}
      <g clipPath={`url(#${clipId})`}>
        <rect x="52" y={fillY} width="96" height="100" fill={`url(#${gradId})`} fillOpacity="0.86" />
        <ellipse cx="100" cy={fillY} rx="32" ry="4" fill="#ffffff" fillOpacity="0.55" />
      </g>
      <path d={flaskD} fill="none" stroke="#475569" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M94 62v26" stroke="#ffffff" strokeOpacity="0.72" strokeWidth="2.4" strokeLinecap="round" />

      {/* Folding protein mini-helix above flask */}
      <g transform="translate(100, 38)" fill="none" stroke={pal.liquidMid} strokeWidth="1.2">
        <path d="M-12 0c4-7 8-7 12 0s8 7 12 0" />
        <circle cx="-8" cy="-3.5" r="2" fill={pal.proton} stroke="none" />
        <circle cx="0" cy="0" r="2" fill={pal.electron} stroke="none" />
        <circle cx="8" cy="3.5" r="2" fill={pal.accent} stroke="none" />
      </g>

      {/* Sculptural mini Cat / Dog companion silhouettes */}
      {showCat && (
        <g transform="translate(132, 118)" fill="#252c3b" fillOpacity="0.9">
          <path d="M7 13L5 3l7 5h8l7-5-2 10c3 6 2 16-2 20H9c-4-4-5-14-2-20z" />
          <circle cx="12.5" cy="15.5" r="1.4" fill={pal.electron} />
          <circle cx="19.5" cy="15.5" r="1.4" fill={pal.electron} />
        </g>
      )}
      {showDog && (
        <g transform="translate(40, 119)" fill="#252c3b" fillOpacity="0.9">
          <path d="M8 12L6 3l7 5h8l6-4-2 10c4 4 3 15-2 18H10c-5-4-5-14-2-20z" />
          <circle cx="13" cy="15.5" r="1.4" fill={pal.accent} />
          <circle cx="19.5" cy="15.5" r="1.4" fill={pal.accent} />
        </g>
      )}
    </svg>
  );
}
