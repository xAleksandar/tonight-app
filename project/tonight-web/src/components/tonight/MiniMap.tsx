"use client";

import { useMemo } from "react";
import { MapPin } from "lucide-react";

import { classNames } from "@/lib/classNames";

export type MiniMapProps = {
  latitude: number;
  longitude: number;
  locationName: string;
  className?: string;
  height?: number;
};

const DEFAULT_HEIGHT = 156;
const DEFAULT_ZOOM_LEVEL = 15;

export function MiniMap({
  latitude,
  longitude,
  locationName,
  className,
  height = DEFAULT_HEIGHT,
}: MiniMapProps) {
  const tileUrl = useMemo(() => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    const zoom = DEFAULT_ZOOM_LEVEL;
    const tileX = Math.floor(((longitude + 180) / 360) * Math.pow(2, zoom));
    const tileY = Math.floor(
      ((1 -
        Math.log(Math.tan((latitude * Math.PI) / 180) + 1 / Math.cos((latitude * Math.PI) / 180)) / Math.PI) /
        2) *
        Math.pow(2, zoom)
    );

    return `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;
  }, [latitude, longitude]);

  return (
    <div
      className={classNames("relative w-full overflow-hidden", className)}
      style={{
        height,
      }}
    >
      {tileUrl && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${tileUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "saturate(1.05) brightness(1.1)",
          }}
        />
      )}

      <div className="absolute inset-0 bg-white/15" aria-hidden />

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
        <div className="flex flex-col items-center">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/40">
            <MapPin className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="h-2 w-0.5 bg-primary/60" />
          <div className="h-1.5 w-3 rounded-full bg-primary/30 blur-[1px]" />
        </div>
      </div>

      <div className="absolute bottom-2 left-2 right-2">
        <div className="rounded-lg bg-card/80 px-2 py-1 text-[10px] font-medium text-foreground backdrop-blur-sm">
          <p className="truncate">{locationName}</p>
        </div>
      </div>
    </div>
  );
}
