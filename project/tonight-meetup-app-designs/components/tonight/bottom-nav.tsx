"use client"

import { cn } from "@/lib/utils"
import { Compass, Plus, MessageCircle, User, Users } from "lucide-react"

const navItems = [
  { id: "discover", label: "Discover", icon: Compass },
  { id: "people", label: "People", icon: Users },
  { id: "create", label: "Post", icon: Plus },
  { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "profile", label: "Profile", icon: User },
] as const

export type Screen = (typeof navItems)[number]["id"] | "welcome" | "event-detail" | "chat"

interface BottomNavProps {
  activeScreen: Screen
  onNavigate: (screen: Screen) => void
  unreadCount?: number
}

export function BottomNav({ activeScreen, onNavigate, unreadCount = 0 }: BottomNavProps) {
  return (
    <nav className="sticky bottom-0 z-50 border-t border-border bg-card/55 backdrop-blur-lg" role="navigation" aria-label="Main navigation">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = activeScreen === item.id
          const isCreate = item.id === "create"

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-xs transition-all",
                isCreate
                  ? "text-foreground"
                  : isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
            >
              {isCreate ? (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                  <item.icon className="h-5 w-5" />
                </span>
              ) : (
                <>
                  <span className="relative">
                    <item.icon className="h-5 w-5" />
                    {item.id === "messages" && unreadCount > 0 && (
                      <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                        {unreadCount}
                      </span>
                    )}
                  </span>
                  <span className="font-medium">{item.label}</span>
                </>
              )}
            </button>
          )
        })}
      </div>
      <div className="h-safe-area-inset-bottom" />
    </nav>
  )
}
