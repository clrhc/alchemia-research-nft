import type { AlchemyTraits } from "../engine/traits";
import { hasSector } from "../web3/sectors";

interface LabThumbnailSvgProps {
  traits: AlchemyTraits;
  tier: number;
  sectorsMask: number;
}

const FLASK_PATHS = [
  // Conical Erlenmeyer
  "M164 118h32v40l46 86q5 16-13 16H131q-18 0-13-16l46-86z",
  // Round-Bottom Boiling Flask
  "M165 114h30v42a58 58 0 1 1-30 0z",
  // Faceted Crystal Decanter
  "M146 126h68l16 104-28 30h-44l-28-30z",
  // Double-Bulb Alchemical Ampoule
  "M166 112h28v38c28 8 36 40 16 58 22 18 12 52-16 52h-28c-28 0-38-34-16-52-20-18-12-50 16-58z",
  // Tiered Distillation Spire
  "M168 108h24v34l26 32-12 22 30 46q4 18-14 18h-84q-18 0-14-18l30-46-12-22 26-32z"
];

export function LabThumbnailSvg({ traits, tier, sectorsMask }: LabThumbnailSvgProps) {
  const pal = traits.palette;
  const uid = traits.seed.slice(2, 10);
  const clipId = `fl-${uid}`;
  const bgId = `bg-${uid}`;
  const liqId = `lq-${uid}`;
  const glassId = `gl-${uid}`;
  const poolId = `pl-${uid}`;
  const flaskD = FLASK_PATHS[traits.vesselIdx] || FLASK_PATHS[0];
  const isDuo = traits.familiar.species === "Duo" || tier >= 4 || hasSector(sectorsMask, 3);
  const showCat = isDuo || traits.familiar.species === "Cat";
  const showDog = isDuo || traits.familiar.species === "Dog";
  const fillY = 250 - (54 + tier * 13);

  const hasCryo = hasSector(sectorsMask, 0);
  const hasMiner = hasSector(sectorsMask, 1);
  const hasGarden = hasSector(sectorsMask, 2);
  const hasLounge = hasSector(sectorsMask, 3);
  const hasSpire = hasSector(sectorsMask, 4);
  const hasDome = hasSector(sectorsMask, 5);

  return (
    <svg viewBox="0 0 360 360" className="lab-thumb-svg" aria-hidden="true">
      <defs>
        <radialGradient id={bgId} cx="48%" cy="38%" r="64%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="62%" stopColor="#f3f6fb" />
          <stop offset="100%" stopColor="#e5ecf6" />
        </radialGradient>
        <linearGradient id={liqId} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor={pal.liquidTop} stopOpacity="0.92" />
          <stop offset="52%" stopColor={pal.liquidMid} stopOpacity="0.9" />
          <stop offset="100%" stopColor={pal.liquidBottom} stopOpacity="0.96" />
        </linearGradient>
        <linearGradient id={glassId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.88" />
          <stop offset="35%" stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="72%" stopColor={pal.liquidTop} stopOpacity="0.16" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.65" />
        </linearGradient>
        <radialGradient id={poolId} cx="50%" cy="46%" r="54%">
          <stop offset="0%" stopColor={pal.liquidTop} stopOpacity="0.34" />
          <stop offset="65%" stopColor={pal.liquidMid} stopOpacity="0.18" />
          <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.26" />
        </radialGradient>
        <clipPath id={clipId}>
          <path d={flaskD} />
        </clipPath>
      </defs>

      {/* Pure Studio Architectural Backdrop */}
      <rect width="360" height="360" fill={`url(#${bgId})`} />

      {/* Subtle Isometric Architectural Drafting Floor Grid */}
      <g stroke="#cbd5e1" strokeOpacity="0.35" strokeWidth="0.8" fill="none">
        <ellipse cx="180" cy="264" rx="154" ry="44" strokeDasharray="3 6" />
        <ellipse cx="180" cy="264" rx="116" ry="32" />
        <line x1="28" y1="264" x2="332" y2="264" strokeOpacity="0.22" />
        <line x1="180" y1="214" x2="180" y2="314" strokeOpacity="0.22" />
      </g>

      {/* Rear Frosted-Glass Pavilion Brise-Soleil Fins */}
      <g opacity="0.72">
        {[-92, -62, -32, 32, 62, 92].map((dx, i) => (
          <rect
            key={i}
            x={180 + dx - 5}
            y={128 + Math.abs(dx) * 0.24}
            width="10"
            height={110 - Math.abs(dx) * 0.2}
            rx="3"
            fill="#ffffff"
            fillOpacity="0.65"
            stroke="#cbd5e1"
            strokeWidth="0.9"
          />
        ))}
        <path
          d="M84 150 Q180 112 276 150"
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>

      {/* Observatory Dome Arch (Sector 5) */}
      {hasDome && (
        <g fill="none" stroke="#f59e0b" strokeOpacity="0.48">
          <path d="M98 156 A82 76 0 0 1 262 156" strokeWidth="2.2" />
          <path d="M114 156 A66 64 0 0 1 246 156" strokeWidth="1.2" strokeDasharray="4 4" />
          <circle cx="180" cy="76" r="5" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.4" />
        </g>
      )}

      {/* Soft Architectural Contact Shadow */}
      <ellipse cx="180" cy="274" rx="126" ry="34" fill="#94a3b8" fillOpacity="0.2" />

      {/* Multi-Tiered Honed Alabaster Terrazzo Rotunda Plinth */}
      <path
        d="M58 258 L58 269 A122 33 0 0 0 302 269 L302 258 Z"
        fill="#dce4ef"
        stroke="#cbd5e1"
        strokeWidth="1"
      />
      <ellipse cx="180" cy="258" rx="122" ry="33" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.2" />

      {/* Recessed Luminous Reflecting Pool & Caustics */}
      <ellipse
        cx="180"
        cy="258"
        rx="98"
        ry="24"
        fill={`url(#${poolId})`}
        stroke={pal.liquidMid}
        strokeOpacity="0.38"
        strokeWidth="1"
      />
      <ellipse
        cx="180"
        cy="257"
        rx="68"
        ry="15"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.72"
        strokeWidth="1.2"
        strokeDasharray="16 9"
      />

      {/* Inner Raised Titanium Pedestal */}
      <path
        d="M126 250 L126 257 A54 14 0 0 0 234 257 L234 250 Z"
        fill="#e2e8f0"
        stroke="#cbd5e1"
        strokeWidth="0.9"
      />
      <ellipse cx="180" cy="250" rx="54" ry="14" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />

      {/* Built Sims Architectural Wings (Miniature Isometric Buildings!) */}
      {hasCryo && (
        <g transform="translate(56, 178)">
          <rect x="0" y="18" width="44" height="36" rx="6" fill="#ffffff" stroke="#38bdf8" strokeWidth="1.5" />
          <rect x="8" y="4" width="11" height="44" rx="5" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="1.2" />
          <rect x="25" y="4" width="11" height="44" rx="5" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="1.2" />
          <circle cx="22" cy="34" r="4" fill="#38bdf8" fillOpacity="0.7" />
        </g>
      )}
      {hasSpire && (
        <g transform="translate(264, 132)">
          <path d="M18 0 L28 84 L8 84 Z" fill="#ffffff" stroke="#8b5cf6" strokeWidth="1.4" />
          <ellipse cx="18" cy="24" rx="13" ry="4" fill="none" stroke="#8b5cf6" strokeWidth="1.4" />
          <ellipse cx="18" cy="48" rx="16" ry="5" fill="none" stroke="#a78bfa" strokeWidth="1.2" />
          <circle cx="18" cy="2" r="4" fill="#c4b5fd" stroke="#8b5cf6" strokeWidth="1.2" />
        </g>
      )}
      {hasMiner && (
        <g transform="translate(266, 206)">
          <polygon points="18,4 38,16 38,44 18,54 -2,44 -2,16" fill="#ffffff" stroke="#6366f1" strokeWidth="1.4" />
          <circle cx="18" cy="29" r="10" fill="#e0e7ff" stroke="#6366f1" strokeWidth="1.3" />
          <circle cx="18" cy="29" r="3.5" fill="#6366f1" />
        </g>
      )}
      {hasGarden && (
        <g transform="translate(46, 224)">
          <path d="M2 34 A26 24 0 0 1 54 34 Z" fill="#ecfdf5" fillOpacity="0.9" stroke="#10b981" strokeWidth="1.5" />
          <path d="M14 34 Q28 10 42 34" fill="none" stroke="#10b981" strokeOpacity="0.55" strokeWidth="1" />
          <circle cx="28" cy="24" r="6" fill="#34d399" fillOpacity="0.75" />
        </g>
      )}
      {hasLounge && (
        <g transform="translate(248, 244)">
          <rect x="0" y="16" width="46" height="14" rx="5" fill="#ffffff" stroke="#f472b6" strokeWidth="1.3" />
          <path d="M-2 6 L48 6 L44 16 L2 16 Z" fill="#fce7f3" stroke="#f472b6" strokeWidth="1.2" />
        </g>
      )}

      {/* Orbital Rings around Hero Vessel */}
      <g fill="none">
        <ellipse
          cx="180"
          cy="196"
          rx="106"
          ry="34"
          transform="rotate(-22 180 196)"
          stroke={pal.liquidMid}
          strokeOpacity="0.46"
          strokeWidth="1.4"
        />
        <ellipse
          cx="180"
          cy="196"
          rx="106"
          ry="34"
          transform="rotate(22 180 196)"
          stroke={pal.electron}
          strokeOpacity="0.46"
          strokeWidth="1.4"
        />
        <circle cx="272" cy="158" r="4" fill={pal.electron} />
        <circle cx="88" cy="232" r="3.5" fill={pal.proton} />
      </g>

      {/* Hero Borosilicate Glass Vessel + Shaded Liquid + Bubbles */}
      <g clipPath={`url(#${clipId})`}>
        <rect x="90" y={fillY} width="180" height="180" fill={`url(#${liqId})`} />
        <ellipse cx="180" cy={fillY} rx="58" ry="8" fill="#ffffff" fillOpacity="0.62" />
        {/* Luminous Nucleus Core inside Liquid */}
        <circle cx="180" cy={Math.min(226, fillY + 38)} r="16" fill="#ffffff" fillOpacity="0.28" />
        <circle cx="180" cy={Math.min(226, fillY + 38)} r="7.5" fill={pal.proton} fillOpacity="0.88" />
        {/* Rising Glass Bubbles */}
        <circle cx="164" cy={fillY + 20} r="3.2" fill="#ffffff" fillOpacity="0.7" />
        <circle cx="195" cy={fillY + 32} r="2.4" fill="#ffffff" fillOpacity="0.65" />
        <circle cx="176" cy={fillY + 52} r="2.8" fill="#ffffff" fillOpacity="0.58" />
      </g>
      {/* Glass Specular Coat + Precision Rim */}
      <path d={flaskD} fill={`url(#${glassId})`} stroke="#64748b" strokeWidth="2.1" strokeLinejoin="round" />
      <path d="M170 124v44" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="4" strokeLinecap="round" />
      <path d="M138 214 Q146 238 164 248" fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="3.2" strokeLinecap="round" />
      {/* Brushed Titanium Vessel Neck Ring */}
      <rect x="160" y="108" width="40" height="8" rx="4" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.2" />

      {/* Serene Mol* Colored 3D Protein Folding Sculpture Above Bottle */}
      <g transform="translate(180, 66)">
        <ellipse cx="0" cy="0" rx="44" ry="15" transform="rotate(-18)" fill="none" stroke="#cbd5e1" strokeWidth="1.3" />
        <ellipse cx="0" cy="0" rx="42" ry="14" transform="rotate(20)" fill="none" stroke={pal.accent} strokeOpacity="0.65" strokeWidth="1.2" />
        {/* Mol* Rose Helix + Amber Turn Ribbon */}
        <path
          d="M-24 6 C-16 -14, -4 -14, 2 0 C8 14, 18 12, 24 -6"
          fill="none"
          stroke="#f472b6"
          strokeWidth="4.2"
          strokeLinecap="round"
        />
        <path
          d="M-22 4 C-14 -11, -3 -11, 2 0 C8 11, 17 9, 23 -5"
          fill="none"
          stroke="#fbbf24"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeDasharray="9 11"
        />
        <circle cx="-22" cy="5" r="4.2" fill={pal.proton} stroke="#ffffff" strokeWidth="1" />
        <circle cx="-10" cy="-9" r="4.5" fill={pal.electron} stroke="#ffffff" strokeWidth="1" />
        <circle cx="2" cy="0" r="4.2" fill="#f5c26b" stroke="#ffffff" strokeWidth="1" />
        <circle cx="14" cy="9" r="4.4" fill={pal.accent} stroke="#ffffff" strokeWidth="1" />
        <circle cx="23" cy="-5" r="4" fill={pal.liquidMid} stroke="#ffffff" strokeWidth="1" />
      </g>

      {/* Sculptural Architectural Cat Companion on Porcelain Cushion */}
      {showCat && (
        <g transform="translate(226, 212)">
          <ellipse cx="22" cy="48" rx="20" ry="7" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.1" />
          <path
            d="M11 22 L8 6 L18 14 L26 14 L36 6 L33 22 C37 31 35 43 29 47 L15 47 C9 43 7 31 11 22 Z"
            fill="#283142"
            stroke="#475569"
            strokeWidth="1"
          />
          <circle cx="17.5" cy="24" r="2.2" fill={pal.electron} />
          <circle cx="26.5" cy="24" r="2.2" fill={pal.electron} />
          <path d="M16 33 Q22 36 28 33" fill="none" stroke={pal.accent} strokeWidth="2.2" strokeLinecap="round" />
        </g>
      )}

      {/* Sculptural Architectural Dog Companion on Porcelain Cushion */}
      {showDog && (
        <g transform="translate(88, 212)">
          <ellipse cx="22" cy="48" rx="20" ry="7" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.1" />
          <path
            d="M10 21 L7 8 L17 15 L27 15 L37 8 L34 21 C38 30 36 43 30 47 L14 47 C8 43 6 30 10 21 Z"
            fill="#323c4e"
            stroke="#475569"
            strokeWidth="1"
          />
          <circle cx="17.5" cy="24" r="2.2" fill={pal.accent} />
          <circle cx="26.5" cy="24" r="2.2" fill={pal.accent} />
          <path d="M16 33 Q22 36 28 33" fill="none" stroke={pal.electron} strokeWidth="2.2" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
