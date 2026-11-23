import { useEffect, useMemo, useState } from "react";
import { LabThumbnailSvg } from "./LabThumbnailSvg";
import {
  getCachedLabPortrait,
  getLabPortraitKey,
  requestLabPortrait,
  type LabPortraitRequest
} from "../engine/galleryThumbRenderer";
import type { AlchemyTraits } from "../engine/traits";

interface LabPortraitProps {
  traits: AlchemyTraits;
  tier: number;
  request: LabPortraitRequest;
  alt: string;
}

/**
 * High-resolution 3D Architectural Studio Portrait for Gallery Cards.
 * Shows the upgraded isometric architectural SVG instantaneously on frame 0,
 * then cross-fades smoothly into a genuine offscreen WebGL PBR 3D studio render
 * captured from the exact NFT configuration (flask, liquid, rooms, pets, folded protein).
 */
export function LabPortrait({ traits, tier, request, alt }: LabPortraitProps) {
  const key = useMemo(() => getLabPortraitKey(request), [
    request.seed,
    request.causeId,
    request.valueUsd,
    request.sectorsMask,
    request.workUnits,
    request.petLevel
  ]);

  const [photoUrl, setPhotoUrl] = useState<string | null>(() => getCachedLabPortrait(request));

  useEffect(() => {
    const cached = getCachedLabPortrait(request);
    if (cached) {
      setPhotoUrl(cached);
      return;
    }

    let cancelled = false;
    requestLabPortrait(request).then((url) => {
      if (!cancelled && url) {
        setPhotoUrl(url);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return (
    <div className="lab-portrait-frame">
      <LabThumbnailSvg traits={traits} tier={tier} sectorsMask={request.sectorsMask} />
      {photoUrl && (
        <img
          src={photoUrl}
          alt={alt}
          className="lab-portrait-3d"
          loading="lazy"
          decoding="async"
        />
      )}
    </div>
  );
}
