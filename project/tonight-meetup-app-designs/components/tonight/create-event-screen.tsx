"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  MapPin,
  Clock,
  Type,
  AlignLeft,
  Clapperboard,
  UtensilsCrossed,
  Waves,
  Music,
  Dumbbell,
  Coffee,
  Users,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Screen } from "./bottom-nav"

const eventCategories = [
  { id: "cinema", label: "Cinema", icon: Clapperboard },
  { id: "food", label: "Food", icon: UtensilsCrossed },
  { id: "outdoor", label: "Outdoor", icon: Waves },
  { id: "music", label: "Music", icon: Music },
  { id: "fitness", label: "Fitness", icon: Dumbbell },
  { id: "social", label: "Social", icon: Coffee },
]

interface CreateEventScreenProps {
  onNavigate: (screen: Screen) => void
  isDesktop?: boolean
}

export function CreateEventScreen({ onNavigate, isDesktop }: CreateEventScreenProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [maxParticipants, setMaxParticipants] = useState(2)
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Check className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground font-serif">Event Posted!</h2>
          <p className="max-w-xs text-sm text-muted-foreground leading-relaxed">
            Your event is now visible to people nearby. You&apos;ll be notified when someone wants to join.
          </p>
          <Button onClick={() => { setSubmitted(false); onNavigate("discover") }} variant="outline" className="mt-4 rounded-xl">
            View in Discover
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      {!isDesktop && (
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-4">
          <h1 className="text-xl font-bold text-foreground font-serif">Create Event</h1>
          <p className="text-xs text-muted-foreground">Share what you&apos;re up to tonight</p>
        </header>
      )}

      <div className="flex flex-col gap-5 p-4">
        {/* Category Selection */}
        <div className="flex flex-col gap-2.5">
          <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            Category
          </label>
          <div className="grid grid-cols-3 gap-2">
            {eventCategories.map((cat) => {
              const Icon = cat.icon
              const isSelected = selectedCategory === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card/60 text-muted-foreground hover:text-foreground hover:border-primary/30"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {cat.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-2">
          <label htmlFor="event-title" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Type className="h-3.5 w-3.5 text-muted-foreground" />
            Title
          </label>
          <Input
            id="event-title"
            placeholder="e.g. Going to Cinema"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-11 rounded-xl border-border bg-card/60 text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-2">
          <label htmlFor="event-desc" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <AlignLeft className="h-3.5 w-3.5 text-muted-foreground" />
            Description
          </label>
          <textarea
            id="event-desc"
            rows={3}
            placeholder="Tell people what you're planning..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="flex w-full rounded-xl border border-border bg-card/60 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background resize-none"
          />
        </div>

        {/* Date & Time + Max Participants */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-1 flex-col gap-2">
            <label htmlFor="event-datetime" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              Date & Time
            </label>
            <Input
              id="event-datetime"
              type="datetime-local"
              className="h-11 rounded-xl border-border bg-card/60 text-foreground"
            />
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              Max Participants
            </label>
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-xl border border-border bg-card/60">
                <button
                  type="button"
                  onClick={() => setMaxParticipants((p) => Math.max(2, p - 1))}
                  disabled={maxParticipants <= 2}
                  className="flex h-10 w-10 items-center justify-center text-lg font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Decrease participants"
                >
                  -
                </button>
                <span className="flex h-10 w-10 items-center justify-center border-x border-border text-sm font-semibold text-foreground">
                  {maxParticipants}
                </span>
                <button
                  type="button"
                  onClick={() => setMaxParticipants((p) => Math.min(20, p + 1))}
                  disabled={maxParticipants >= 20}
                  className="flex h-10 w-10 items-center justify-center text-lg font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Increase participants"
                >
                  +
                </button>
              </div>
              <span className="hidden text-xs text-muted-foreground md:inline">
                You + {maxParticipants - 1} {maxParticipants - 1 === 1 ? "other" : "others"}
              </span>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            Location
          </label>
          <div className="relative flex h-36 items-center justify-center overflow-hidden rounded-2xl border border-border bg-secondary/50">
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Tap to select location on map</span>
            </div>
            {/* Grid overlay */}
            <svg className="absolute inset-0 h-full w-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="creategrid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#creategrid)" />
            </svg>
          </div>
          <Input
            placeholder="Location name (e.g. Cinema City, Downtown)"
            className="h-11 rounded-xl border-border bg-card/60 text-foreground placeholder:text-muted-foreground"
            aria-label="Location name"
          />
        </div>

        {/* Submit */}
        <Button
          onClick={() => setSubmitted(true)}
          size="lg"
          className="mt-2 h-12 rounded-xl text-base font-semibold"
        >
          Post Event
        </Button>
      </div>
    </div>
  )
}
