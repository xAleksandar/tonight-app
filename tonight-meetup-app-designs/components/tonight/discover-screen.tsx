"use client"

import React from "react"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  MapPin,
  Clock,
  SlidersHorizontal,
  List,
  Map as MapIcon,
  ChevronRight,
  Clapperboard,
  UtensilsCrossed,
  Waves,
  Music,
  Dumbbell,
  Coffee,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Screen } from "./bottom-nav"

const MOCK_EVENTS = [
  {
    id: "1",
    title: "Going to Cinema",
    description: "Watching the new sci-fi movie tonight. Anyone wanna join?",
    host: { name: "Marco R.", avatar: "", initials: "MR" },
    category: "cinema",
    datetime: "Tonight, 8:30 PM",
    location: "Cinema City, Downtown",
    distance: "1.2 km",
    spotsLeft: 1,
  },
  {
    id: "2",
    title: "Sushi Dinner",
    description: "Craving sushi. Looking for company at my fav spot!",
    host: { name: "Elena K.", avatar: "", initials: "EK" },
    category: "food",
    datetime: "Tonight, 9:00 PM",
    location: "Sakura Restaurant",
    distance: "2.8 km",
    spotsLeft: 1,
  },
  {
    id: "3",
    title: "Beach Sunset Walk",
    description: "Evening walk along the coast, great for photos.",
    host: { name: "Luca T.", avatar: "", initials: "LT" },
    category: "outdoor",
    datetime: "Tonight, 7:00 PM",
    location: "Marina Bay Beach",
    distance: "4.5 km",
    spotsLeft: 1,
  },
  {
    id: "4",
    title: "Live Jazz Night",
    description: "A local band playing at Blue Note. Free entry!",
    host: { name: "Sofia M.", avatar: "", initials: "SM" },
    category: "music",
    datetime: "Tonight, 10:00 PM",
    location: "Blue Note Bar",
    distance: "3.1 km",
    spotsLeft: 1,
  },
  {
    id: "5",
    title: "Evening Gym Session",
    description: "Hitting the gym. Could use a workout buddy.",
    host: { name: "Dan P.", avatar: "", initials: "DP" },
    category: "fitness",
    datetime: "Tonight, 7:30 PM",
    location: "FitZone Gym",
    distance: "0.8 km",
    spotsLeft: 1,
  },
  {
    id: "6",
    title: "Coffee & Board Games",
    description: "Chill evening with board games at a cozy cafe.",
    host: { name: "Ana B.", avatar: "", initials: "AB" },
    category: "social",
    datetime: "Tonight, 8:00 PM",
    location: "The Bean Counter Cafe",
    distance: "1.9 km",
    spotsLeft: 1,
  },
]

const categoryIcons: Record<string, React.ReactNode> = {
  cinema: <Clapperboard className="h-4 w-4" />,
  food: <UtensilsCrossed className="h-4 w-4" />,
  outdoor: <Waves className="h-4 w-4" />,
  music: <Music className="h-4 w-4" />,
  fitness: <Dumbbell className="h-4 w-4" />,
  social: <Coffee className="h-4 w-4" />,
}

const categoryColors: Record<string, string> = {
  cinema: "bg-sky-500/15 text-sky-300 border-sky-400/20",
  food: "bg-amber-500/15 text-amber-300 border-amber-400/20",
  outdoor: "bg-emerald-500/15 text-emerald-300 border-emerald-400/20",
  music: "bg-rose-500/15 text-rose-300 border-rose-400/20",
  fitness: "bg-lime-500/15 text-lime-300 border-lime-400/20",
  social: "bg-orange-500/15 text-orange-300 border-orange-400/20",
}

interface DiscoverScreenProps {
  onNavigate: (screen: Screen) => void
  isDesktop?: boolean
  desktopCategory?: string | null
}

export function DiscoverScreen({ onNavigate, isDesktop, desktopCategory }: DiscoverScreenProps) {
  const [viewMode, setViewMode] = useState<"list" | "map">("list")
  const [range, setRange] = useState([10])
  const [mobileCategory, setMobileCategory] = useState<string | null>(null)

  const selectedCategory = isDesktop ? (desktopCategory ?? null) : mobileCategory
  const setSelectedCategory = isDesktop ? () => {} : setMobileCategory

  const categories = [
    { id: null, label: "All", icon: <Sparkles className="h-3.5 w-3.5" /> },
    { id: "cinema", label: "Cinema", icon: <Clapperboard className="h-3.5 w-3.5" /> },
    { id: "food", label: "Food", icon: <UtensilsCrossed className="h-3.5 w-3.5" /> },
    { id: "outdoor", label: "Outdoor", icon: <Waves className="h-3.5 w-3.5" /> },
    { id: "music", label: "Music", icon: <Music className="h-3.5 w-3.5" /> },
    { id: "fitness", label: "Fitness", icon: <Dumbbell className="h-3.5 w-3.5" /> },
    { id: "social", label: "Social", icon: <Coffee className="h-3.5 w-3.5" /> },
  ]

  const filteredEvents = selectedCategory
    ? MOCK_EVENTS.filter((e) => e.category === selectedCategory)
    : MOCK_EVENTS

  return (
    <div className="flex flex-col">
      {/* Mobile Header - hidden on desktop */}
      {!isDesktop && (
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 pb-3 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground font-serif">Discover</h1>
              <p className="text-xs text-muted-foreground">Events near you</p>
            </div>
            <div className="flex items-center gap-2">
              {/* View Toggle */}
              <div className="flex items-center rounded-lg border border-border bg-card/60 p-0.5">
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "rounded-md p-1.5 transition-colors",
                    viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="List view"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("map")}
                  className={cn(
                    "rounded-md p-1.5 transition-colors",
                    viewMode === "map" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="Map view"
                >
                  <MapIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Range Filter */}
              <Sheet>
                <SheetTrigger asChild>
                  <button className="relative flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    {range[0]} km
                  </button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-3xl border-border bg-card/60">
                  <SheetHeader>
                    <SheetTitle className="text-foreground">Discovery Range</SheetTitle>
                    <SheetDescription className="text-muted-foreground">Set the maximum distance for events you want to see</SheetDescription>
                  </SheetHeader>
                  <div className="mt-6 flex flex-col gap-6 pb-8">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Distance</span>
                        <span className="font-semibold text-primary">{range[0]} km</span>
                      </div>
                      <Slider
                        value={range}
                        onValueChange={setRange}
                        max={50}
                        min={1}
                        step={1}
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>1 km</span>
                        <span>50 km</span>
                      </div>
                    </div>
                    <Button className="rounded-xl">Apply Filter</Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* Category Chips */}
          <div className="-mx-4 overflow-hidden">
            <div
              className="flex gap-2 px-4 pb-1"
              style={{
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              {categories.map((cat) => (
                <button
                  key={cat.label}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                    selectedCategory === cat.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {cat.icon}
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </header>
      )}

      {/* Content */}
      {viewMode === "list" ? (
        <div className={cn("gap-3 p-4", isDesktop ? "grid grid-cols-2 xl:grid-cols-3" : "flex flex-col")}>
          {filteredEvents.map((event) => (
            <button
              key={event.id}
              onClick={() => onNavigate("event-detail")}
              className="group flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-4 text-left transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 active:scale-[0.98]"
            >
              {/* Category Icon */}
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", categoryColors[event.category])}>
                {categoryIcons[event.category]}
              </div>

              {/* Content */}
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground leading-snug">{event.title}</h3>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="line-clamp-1 text-xs text-muted-foreground">{event.description}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {event.datetime}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {event.distance}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={event.host.avatar || "/placeholder.svg"} alt={event.host.name} />
                    <AvatarFallback className="bg-secondary text-[10px] text-secondary-foreground">{event.host.initials}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">{event.host.name}</span>
                  <Badge variant="outline" className="ml-auto border-primary/30 text-primary text-[10px] px-1.5 py-0">
                    {event.spotsLeft} spot left
                  </Badge>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="relative flex flex-col items-center justify-center bg-secondary/50" style={{ height: "calc(100dvh - 180px)" }}>
          {/* Map Placeholder */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <MapIcon className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Map View</p>
            <p className="max-w-xs text-xs text-muted-foreground leading-relaxed">
              Events will appear as pins on a Mapbox map. Each pin shows the event category and distance from your location.
            </p>
          </div>

          {/* Floating event pins mockup */}
          <div className="absolute inset-0 overflow-hidden">
            {filteredEvents.slice(0, 4).map((event, i) => {
              const positions = [
                { left: "20%", top: "25%" },
                { left: "65%", top: "20%" },
                { left: "45%", top: "55%" },
                { left: "75%", top: "65%" },
              ]
              return (
                <div
                  key={event.id}
                  className="absolute"
                  style={positions[i]}
                >
                  <div className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 shadow-lg", categoryColors[event.category], "bg-card/60")}>
                    {categoryIcons[event.category]}
                    <span className="text-xs font-medium">{event.distance}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
