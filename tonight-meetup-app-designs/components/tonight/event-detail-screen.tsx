"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  ArrowLeft,
  MapPin,
  Clock,
  Clapperboard,
  Users,
  Flag,
  ShieldAlert,
  Share2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Screen } from "./bottom-nav"

interface EventDetailScreenProps {
  onNavigate: (screen: Screen) => void
  isDesktop?: boolean
}

export function EventDetailScreen({ onNavigate, isDesktop }: EventDetailScreenProps) {
  return (
    <div className="flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <button
          onClick={() => onNavigate("discover")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back</span>
        </button>
        <button className="rounded-lg border border-border bg-card/60 p-2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Share event">
          <Share2 className="h-4 w-4" />
        </button>
      </header>

      {/* Event Hero */}
      <div className="flex flex-col gap-4 p-4">
        {/* Category + Title */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Badge className="border-sky-400/20 bg-sky-500/15 text-sky-300 gap-1 text-xs">
              <Clapperboard className="h-3 w-3" />
              Cinema
            </Badge>
            <Badge variant="outline" className="border-primary/30 text-primary text-xs">
              1 spot left
            </Badge>
          </div>
          <h1 className="text-2xl font-bold text-foreground font-serif">Going to Cinema</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Watching the new sci-fi movie tonight. Anyone wanna join? I have an extra ticket and it would be more fun with company.
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-card/60 p-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              When
            </span>
            <span className="text-sm font-semibold text-foreground">Tonight, 8:30 PM</span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-card/60 p-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              Where
            </span>
            <span className="text-sm font-semibold text-foreground">Cinema City</span>
            <span className="text-xs text-muted-foreground">1.2 km away</span>
          </div>
        </div>

        {/* Map Preview */}
        <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-border bg-secondary/50">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30">
                <MapPin className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Cinema City, Downtown</span>
            </div>
          </div>
          {/* Grid overlay to simulate map */}
          <svg className="absolute inset-0 h-full w-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="mapgrid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#mapgrid)" />
          </svg>
        </div>

        {/* Host Card */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">MR</AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-semibold text-foreground">Marco R.</span>
            <span className="text-xs text-muted-foreground">Host</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>Max 2 people</span>
          </div>
        </div>

        {/* Safety Section */}
        <div className="flex items-center justify-center gap-4 pt-1">
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ShieldAlert className="h-3.5 w-3.5" />
            Block user
          </button>
          <span className="h-3 w-px bg-border" />
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors">
            <Flag className="h-3.5 w-3.5" />
            Report
          </button>
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="sticky bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-lg p-4">
        <Button
          onClick={() => onNavigate("chat")}
          size="lg"
          className="w-full rounded-xl text-base font-semibold h-12"
        >
          Request to Join
        </Button>
      </div>
    </div>
  )
}
