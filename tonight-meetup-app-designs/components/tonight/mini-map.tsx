"use client"

import { MapPin } from "lucide-react"

interface MiniMapProps {
  lat: number
  lng: number
  locationName: string
}

export function MiniMap({ lat, lng, locationName }: MiniMapProps) {
  // OpenStreetMap static tile - free, no API key needed
  const zoom = 15
  const tileX = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom))
  const tileY = Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  )
  const tileUrl = `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`

  return (
    <div className="relative w-full overflow-hidden" style={{ height: 156 }}>
      {/* Map tile background */}
      <div
        className="absolute inset-0 bg-secondary/50"
        style={{
          backgroundImage: `url(${tileUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "saturate(0.3) brightness(0.45)",
        }}
      />

      {/* Subtle overlay for contrast */}
      <div className="absolute inset-0 bg-background/20" />

      {/* Pin */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
        <div className="flex flex-col items-center">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30">
            <MapPin className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="h-2 w-0.5 bg-primary/60" />
          <div className="h-1.5 w-3 rounded-full bg-primary/20 blur-[1px]" />
        </div>
      </div>

      {/* Location label */}
      <div className="absolute bottom-2 left-2 right-2">
        <div className="rounded-lg bg-card/80 px-2 py-1 backdrop-blur-sm">
          <p className="truncate text-[10px] font-medium text-foreground">{locationName}</p>
        </div>
      </div>
    </div>
  )
}
