"use client"

import { useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
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
  SlidersHorizontal,
  ChevronRight,
  Clapperboard,
  UtensilsCrossed,
  Waves,
  Music,
  Dumbbell,
  Coffee,
  Users,
  MessageCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Screen } from "./bottom-nav"

const MOCK_PEOPLE = [
  {
    id: "1",
    name: "Alice W.",
    initials: "AW",
    distance: "0.5 km",
    events: [
      { title: "Going to Sea", category: "outdoor", icon: Waves },
    ],
    bio: "Beach lover. Looking for travel buddies!",
  },
  {
    id: "2",
    name: "Marco R.",
    initials: "MR",
    distance: "1.2 km",
    events: [
      { title: "Going to Cinema", category: "cinema", icon: Clapperboard },
    ],
    bio: "Movie enthusiast. Always up for a late show.",
  },
  {
    id: "3",
    name: "Sofia M.",
    initials: "SM",
    distance: "3.1 km",
    events: [
      { title: "Live Jazz Night", category: "music", icon: Music },
    ],
    bio: "Jazz fan, coffee addict. Let's hang out!",
  },
  {
    id: "4",
    name: "Elena K.",
    initials: "EK",
    distance: "2.8 km",
    events: [
      { title: "Sushi Dinner", category: "food", icon: UtensilsCrossed },
    ],
    bio: "Foodie exploring the city one restaurant at a time.",
  },
  {
    id: "5",
    name: "Dan P.",
    initials: "DP",
    distance: "0.8 km",
    events: [
      { title: "Evening Gym Session", category: "fitness", icon: Dumbbell },
    ],
    bio: "Fitness buff. Always better with a workout partner.",
  },
  {
    id: "6",
    name: "Ana B.",
    initials: "AB",
    distance: "1.9 km",
    events: [
      { title: "Coffee & Board Games", category: "social", icon: Coffee },
    ],
    bio: "Board game nerd. Catan anyone?",
  },
]

const categoryColors: Record<string, string> = {
  cinema: "bg-sky-500/15 text-sky-300 border-sky-400/20",
  food: "bg-amber-500/15 text-amber-300 border-amber-400/20",
  outdoor: "bg-emerald-500/15 text-emerald-300 border-emerald-400/20",
  music: "bg-rose-500/15 text-rose-300 border-rose-400/20",
  fitness: "bg-lime-500/15 text-lime-300 border-lime-400/20",
  social: "bg-orange-500/15 text-orange-300 border-orange-400/20",
}

interface PeopleScreenProps {
  onNavigate: (screen: Screen) => void
  isDesktop?: boolean
}

export function PeopleScreen({ onNavigate, isDesktop }: PeopleScreenProps) {
  const [range, setRange] = useState([10])

  return (
    <div className="flex flex-col">
      {!isDesktop && (
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 pb-3 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground font-serif">People Nearby</h1>
              <p className="text-xs text-muted-foreground">Discover who&apos;s planning something</p>
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <button className="flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {range[0]} km
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-3xl border-border bg-card/60">
                <SheetHeader>
                  <SheetTitle className="text-foreground">People Range</SheetTitle>
                  <SheetDescription className="text-muted-foreground">Set how far away you want to discover people with plans</SheetDescription>
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
                  <Button className="rounded-xl">Apply</Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Explanation Banner */}
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">People range</span> shows users near you who have events, even if the event location is far away. Perfect for coordinating travel together!
            </p>
          </div>
        </header>
      )}

      <div className={cn("gap-3 p-4", isDesktop ? "grid grid-cols-2 xl:grid-cols-3" : "flex flex-col")}>
        {MOCK_PEOPLE.map((person) => (
          <div
            key={person.id}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-4 transition-all hover:border-primary/30"
          >
            {/* Person Info */}
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">{person.initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col">
                <span className="font-semibold text-foreground text-sm">{person.name}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {person.distance} from you
                </span>
              </div>
              <button
                onClick={() => onNavigate("chat")}
                className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Contact
              </button>
            </div>

            {/* Bio */}
            <p className="text-xs text-muted-foreground">{person.bio}</p>

            {/* Their Events */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Their events</span>
              {person.events.map((event) => {
                const Icon = event.icon
                return (
                  <button
                    key={event.title}
                    onClick={() => onNavigate("event-detail")}
                    className="group flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-left transition-colors hover:border-primary/30"
                  >
                    <div className={cn("flex h-7 w-7 items-center justify-center rounded-md border", categoryColors[event.category])}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="flex-1 text-xs font-medium text-foreground">{event.title}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
