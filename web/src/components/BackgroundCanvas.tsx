import { useEffect, useRef } from "react";
import { AlchemicalBackgroundPainter } from "../engine/backgroundPainter";

interface BackgroundCanvasProps {
  impactPulseSignal: number;
}

export function BackgroundCanvas({ impactPulseSignal }: BackgroundCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const painterRef = useRef<AlchemicalBackgroundPainter | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const painter = new AlchemicalBackgroundPainter(canvas);
    painterRef.current = painter;
    painter.start();

    const onResize = () => painter.resize();
    const onPointerMove = (e: PointerEvent) => {
      painter.onPointerMove(e.clientX, e.clientY);
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("button, a, input")) return;
      painter.onPointerClick(e.clientX, e.clientY);
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });

    return () => {
      painter.stop();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  useEffect(() => {
    if (impactPulseSignal > 0) {
      painterRef.current?.triggerImpactBloom();
    }
  }, [impactPulseSignal]);

  return <canvas ref={canvasRef} className="bg-paint-canvas" aria-hidden="true" />;
}
