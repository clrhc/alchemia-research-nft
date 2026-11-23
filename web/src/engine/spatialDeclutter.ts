/**
 * Screen-Space Spatial Floating Label Decluttering & Edge Clamping Engine.
 *
 * Implements cartographic/VisionOS best practices:
 *  - Safe viewport edge clamping (respecting top HUD, bottom dock, and open right drawer)
 *  - Distance-prioritized greedy AABB overlap resolution (closest stations keep priority)
 *  - Zero layout thrashing (operates on cached pill dimensions, zero DOM reads inside rAF)
 *  - Returns exact anchor vs. placed coordinates for optional hairline SVG leader lines
 */

import type { LabStationId } from "./labStations";

export interface DeclutterInput {
  id: LabStationId;
  anchorX: number;
  anchorY: number;
  visible: boolean;
  distToCam: number;
  distToChar: number;
  width: number;
  height: number;
}

export interface DeclutterBounds {
  width: number;
  height: number;
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
}

export interface DeclutterResult {
  id: LabStationId;
  visible: boolean;
  anchorX: number;
  anchorY: number;
  /** Bottom-center X and Y where the floating pill should be placed */
  placedX: number;
  placedY: number;
  /** Distance nudged from exact 3D anchor (used to show hairline leader lines when > 14px) */
  offsetDist: number;
  zIndex: number;
}

export function declutterFloatingLabels(
  inputs: readonly DeclutterInput[],
  bounds: DeclutterBounds
): Record<LabStationId, DeclutterResult> {
  const out = {} as Record<LabStationId, DeclutterResult>;

  const active: Array<{
    input: DeclutterInput;
    x: number;
    y: number;
    halfW: number;
    h: number;
  }> = [];

  for (const inp of inputs) {
    if (!inp.visible) {
      out[inp.id] = {
        id: inp.id,
        visible: false,
        anchorX: inp.anchorX,
        anchorY: inp.anchorY,
        placedX: inp.anchorX,
        placedY: inp.anchorY,
        offsetDist: 0,
        zIndex: 1
      };
      continue;
    }

    const halfW = inp.width * 0.5;
    const minX = bounds.padLeft + halfW;
    const maxX = Math.max(minX, bounds.width - bounds.padRight - halfW);
    const minY = bounds.padTop + inp.height;
    const maxY = Math.max(minY, bounds.height - bounds.padBottom);

    const clampedX = Math.max(minX, Math.min(maxX, inp.anchorX));
    const clampedY = Math.max(minY, Math.min(maxY, inp.anchorY));

    active.push({
      input: inp,
      x: clampedX,
      y: clampedY,
      halfW,
      h: inp.height
    });
  }

  // Sort closest-to-camera first so near labels maintain spatial priority
  active.sort((a, b) => a.input.distToCam - b.input.distToCam);

  // 4-iteration greedy AABB separation pass with vertical/horizontal gentle relaxation
  const gap = 8;
  for (let iter = 0; iter < 4; iter++) {
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i];
        const b = active[j];

        const overlapX = a.halfW + b.halfW + gap - Math.abs(a.x - b.x);
        const aCenterY = a.y - a.h * 0.5;
        const bCenterY = b.y - b.h * 0.5;
        const overlapY = (a.h + b.h) * 0.5 + gap - Math.abs(aCenterY - bCenterY);

        if (overlapX > 0 && overlapY > 0) {
          // Prefer nudging along the axis with smaller overlap for minimal displacement
          if (overlapY <= overlapX * 0.85) {
            const dir = bCenterY >= aCenterY ? 1 : -1;
            b.y += dir * (overlapY * 0.8 + 1);
          } else {
            const dir = b.x >= a.x ? 1 : -1;
            b.x += dir * (overlapX * 0.6 + 1);
          }

          // Re-clamp b cleanly within safe viewport margins
          const minX = bounds.padLeft + b.halfW;
          const maxX = Math.max(minX, bounds.width - bounds.padRight - b.halfW);
          const minY = bounds.padTop + b.h;
          const maxY = Math.max(minY, bounds.height - bounds.padBottom);
          b.x = Math.max(minX, Math.min(maxX, b.x));
          b.y = Math.max(minY, Math.min(maxY, b.y));
        }
      }
    }
  }

  active.forEach((item, rank) => {
    const offsetDist = Math.hypot(item.x - item.input.anchorX, item.y - item.input.anchorY);
    out[item.input.id] = {
      id: item.input.id,
      visible: true,
      anchorX: item.input.anchorX,
      anchorY: item.input.anchorY,
      placedX: item.x,
      placedY: item.y,
      offsetDist,
      zIndex: Math.max(2, 18 - rank * 2)
    };
  });

  return out;
}
