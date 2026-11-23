import { useEffect, useRef, useState } from "react";

/**
 * Custom Alchemical Orbital Cursor:
 * Sleek silver-graphite nib + lagging frosted-glass halo with orbiting micro-electrons.
 * Uses direct DOM transform via rAF for ultra-fluid 60fps response.
 */
export function CustomCursor() {
  const nibRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!isFinePointer || reduced) return;

    setEnabled(true);
    document.body.classList.add("alchemia-cursor-active");

    let targetX = -120;
    let targetY = -120;
    let ringX = -120;
    let ringY = -120;
    let rafId = 0;

    const onMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (nibRef.current) {
        nibRef.current.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      }

      const el = e.target as HTMLElement | null;
      const interactive = Boolean(
        el && el.closest("button, a, input, select, [role='button'], .clickable")
      );
      ringRef.current?.classList.toggle("is-hover", interactive);
    };

    const onDown = () => {
      nibRef.current?.classList.add("is-pressed");
      ringRef.current?.classList.add("is-pressed");
    };

    const onUp = () => {
      nibRef.current?.classList.remove("is-pressed");
      ringRef.current?.classList.remove("is-pressed");
    };

    const onLeave = () => {
      targetX = -120;
      targetY = -120;
      if (nibRef.current) nibRef.current.style.transform = "translate3d(-120px, -120px, 0)";
    };

    const animate = () => {
      ringX += (targetX - ringX) * 0.18;
      ringY += (targetY - ringY) * 0.18;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
      }
      rafId = requestAnimationFrame(animate);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    rafId = requestAnimationFrame(animate);

    return () => {
      document.body.classList.remove("alchemia-cursor-active");
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div className="custom-cursor-layer" aria-hidden="true">
      <div ref={ringRef} className="cursor-ring">
        <span className="cursor-electron" />
        <span className="cursor-electron e2" />
      </div>
      <div ref={nibRef} className="cursor-nib" />
    </div>
  );
}
