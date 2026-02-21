"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  Compass,
  Plus,
  Users,
  Sparkles,
  Clapperboard,
  UtensilsCrossed,
  Waves,
  Music,
  Dumbbell,
  Coffee,
  ChevronDown,
} from "lucide-react"
import type { Screen } from "./bottom-nav"

const navItems = [
  { id: "discover" as const, label: "Discover", icon: Compass },
  { id: "people" as const, label: "People Nearby", icon: Users },
]

const categories = [
  { id: null, label: "All", icon: Sparkles },
  { id: "cinema", label: "Cinema", icon: Clapperboard },
  { id: "food", label: "Food", icon: UtensilsCrossed },
  { id: "outdoor", label: "Outdoor", icon: Waves },
  { id: "music", label: "Music", icon: Music },
  { id: "fitness", label: "Fitness", icon: Dumbbell },
  { id: "social", label: "Social", icon: Coffee },
]

interface DesktopSidebarProps {
  activeScreen: Screen
  onNavigate: (screen: Screen) => void
  selectedCategory: string | null
  onCategoryChange: (cat: string | null) => void
}

export function DesktopSidebar({
  activeScreen,
  onNavigate,
  selectedCategory,
  onCategoryChange,
}: DesktopSidebarProps) {
  const [catOpen, setCatOpen] = useState(false)

  const activeCat = categories.find((c) => c.id === selectedCategory)

  return (
    <aside className="sticky top-0 flex h-dvh w-56 shrink-0 flex-col border-r border-border bg-card/40 backdrop-blur-md">
      {/* Brand */}
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold text-foreground font-serif">tonight</span>
      </div>

      {/* Nav Items */}
      <nav className="flex flex-col gap-1 px-3 pt-2" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive = activeScreen === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon className="h-4.5 w-4.5" />
              {item.label}
            </button>
          )
        })}

        {/* Categories Dropdown */}
        <div className="mt-1">
          <button
            onClick={() => setCatOpen(!catOpen)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              catOpen || selectedCategory
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            )}
          >
            {activeCat ? (
              <activeCat.icon className="h-4.5 w-4.5" />
            ) : (
              <Sparkles className="h-4.5 w-4.5" />
            )}
            <span className="flex-1 text-left">
              {selectedCategory ? activeCat?.label : "Categories"}
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                catOpen && "rotate-180"
              )}
            />
          </button>

          {catOpen && (
            <div className="ml-3 mt-1 flex flex-col gap-0.5 border-l border-border pl-3">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.id
                return (
                  <button
                    key={cat.label}
                    onClick={() => {
                      onCategoryChange(cat.id)
                      setCatOpen(false)
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <cat.icon className="h-3.5 w-3.5" />
                    {cat.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Create Event Button */}
      <div className="mt-auto px-3 pb-5">
        <button
          onClick={() => onNavigate("create")}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:opacity-90 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Post Event
        </button>
      </div>
    </aside>
  )
}
