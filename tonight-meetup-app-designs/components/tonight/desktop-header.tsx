"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { MessageCircle, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Screen } from "./bottom-nav"

interface DesktopHeaderProps {
  activeScreen: Screen
  onNavigate: (screen: Screen) => void
  unreadCount?: number
  title: string
  subtitle?: string
}

export function DesktopHeader({
  activeScreen,
  onNavigate,
  unreadCount = 0,
  title,
  subtitle,
}: DesktopHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-lg px-6 py-4">
      <div>
        <h1 className="text-xl font-bold text-foreground font-serif">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {/* Messages icon */}
        <button
          onClick={() => onNavigate("messages")}
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-full border transition-all",
            activeScreen === "messages"
              ? "border-primary/40 bg-primary/15 text-primary"
              : "border-border bg-card/60 text-muted-foreground hover:text-foreground hover:border-primary/30"
          )}
          aria-label="Messages"
        >
          <MessageCircle className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Profile avatar */}
        <button
          onClick={() => onNavigate("profile")}
          className="transition-all"
          aria-label="Profile"
        >
          <Avatar className={cn(
            "h-10 w-10 border transition-all",
            activeScreen === "profile"
              ? "border-primary/40 ring-2 ring-primary/20"
              : "border-border hover:border-primary/30"
          )}>
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">YN</AvatarFallback>
          </Avatar>
        </button>
      </div>
    </header>
  )
}
