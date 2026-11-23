import { useEffect } from "react";
import {
  BookOpen,
  Building2,
  Coffee,
  Compass,
  Cookie,
  Cpu,
  DoorOpen,
  Hand,
  Heart,
  Home,
  MessageCircle,
  Microscope,
  Moon,
  Pickaxe,
  Plus,
  Shirt,
  Smile,
  Sparkles,
  Sun,
  UserRound,
  Waves,
  X,
  Zap
} from "lucide-react";
import type { SimsObjectTarget, SimsPieAction } from "../engine/simsState";

interface SimsPieMenuProps {
  target: SimsObjectTarget;
  screenX: number;
  screenY: number;
  containerWidth: number;
  containerHeight: number;
  actions: SimsPieAction[];
  onSelect: (actionId: string) => void;
  onClose: () => void;
}

function pickActionIcon(id: string) {
  if (id.includes("lot-")) return Plus;
  if (id.includes("joke") || id.includes("moods")) return Smile;
  if (id.includes("chat")) return MessageCircle;
  if (id.includes("enter")) return DoorOpen;
  if (id.includes("guestbook")) return BookOpen;
  if (id.includes("feed")) return Cookie;
  if (id.includes("pet") || id.includes("cuddle")) return Heart;
  if (id.includes("play") || id.includes("spark") || id.includes("wish")) return Sparkles;
  if (id.includes("nap")) return Moon;
  if (id.includes("style") || id.includes("creator")) return Shirt;
  if (id.includes("fold") || id.includes("research")) return Cpu;
  if (id.includes("micro") || id.includes("analyze")) return Microscope;
  if (id.includes("espresso") || id.includes("brew")) return Coffee;
  if (id.includes("mine") || id.includes("harv")) return Pickaxe;
  if (id.includes("builder")) return Building2;
  if (id.includes("wave")) return Hand;
  if (id.includes("pulse")) return Zap;
  if (id.includes("home")) return Home;
  if (id.includes("neighbor") || id.includes("visit") || id.includes("inspect")) return Compass;
  if (id.includes("bench") || id.includes("meditate")) return Sun;
  if (id.includes("fountain")) return Waves;
  return UserRound;
}

/**
 * Sims-Style Contextual Frosted-Glass Radial Pie Menu.
 *
 * Clamps cleanly inside container bounds, animates wedges radially out from a
 * translucent central hub, and supports Escape / center-hub dismissal.
 */
export function SimsPieMenu({
  target,
  screenX,
  screenY,
  containerWidth,
  containerHeight,
  actions,
  onSelect,
  onClose
}: SimsPieMenuProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const count = actions.length;
  const radius = count >= 6 ? 94 : count >= 4 ? 84 : 74;
  const marginX = radius + 68;
  const marginY = radius + 48;

  // Screen-boundary collision clamping so radial buttons never clip off-card!
  const cx = Math.max(marginX, Math.min(Math.max(marginX, containerWidth - marginX), screenX));
  const cy = Math.max(marginY, Math.min(Math.max(marginY, containerHeight - marginY), screenY));

  return (
    <div
      className="sims-pie-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="sims-pie-ring"
        style={{ left: `${cx}px`, top: `${cy}px` }}
        role="menu"
        aria-label={`Actions for ${target.label}`}
      >
        {/* Soft luminous glass halo ring */}
        <div
          className="sims-pie-halo"
          style={{ width: `${radius * 2}px`, height: `${radius * 2}px` }}
        />

        {/* Plush Silver-Glass Center Target Hub */}
        <button
          type="button"
          className="sims-pie-hub clickable"
          onClick={onClose}
          title="Close action ring"
          aria-label="Close action ring"
        >
          <span className="sims-pie-hub-dot" />
          <span className="sims-pie-hub-label">{target.label}</span>
          <span className="sims-pie-hub-close">
            <X size={11} />
          </span>
        </button>

        {/* Radially Distributed Cutesy Silver-Glass Sims Action Petals */}
        {actions.map((act, idx) => {
          const angle = -Math.PI / 2 + (idx / Math.max(1, count)) * Math.PI * 2;
          const ox = Math.cos(angle) * radius;
          const oy = Math.sin(angle) * radius;
          const Icon = pickActionIcon(act.id);

          return (
            <button
              key={act.id}
              type="button"
              role="menuitem"
              className="sims-pie-btn clickable"
              style={
                {
                  "--tx": `${ox.toFixed(1)}px`,
                  "--ty": `${oy.toFixed(1)}px`,
                  "--pie-accent": act.accent,
                  animationDelay: `${idx * 24}ms`
                } as React.CSSProperties
              }
              onClick={() => {
                onSelect(act.id);
                onClose();
              }}
            >
              <span
                className="sims-pie-icon"
                style={{ "--bubble-accent": act.accent } as React.CSSProperties}
              >
                <Icon size={12} />
              </span>
              <span className="sims-pie-text">
                <strong>{act.label}</strong>
                {act.sublabel && <small>{act.sublabel}</small>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
