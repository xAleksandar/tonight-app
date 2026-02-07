"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ChevronRight, Clapperboard, UtensilsCrossed } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Screen } from "./bottom-nav"

const MOCK_CONVERSATIONS = [
  {
    id: "1",
    person: { name: "Elena K.", initials: "EK" },
    event: "Sushi Dinner",
    eventCategory: "food",
    lastMessage: "Great! See you at 9 then. I'll be at the bar.",
    time: "5 min ago",
    unread: 2,
    status: "accepted",
  },
  {
    id: "2",
    person: { name: "Sofia M.", initials: "SM" },
    event: "Live Jazz Night",
    eventCategory: "music",
    lastMessage: "Looking forward to it! Do you know the band?",
    time: "1 hour ago",
    unread: 0,
    status: "accepted",
  },
  {
    id: "3",
    person: { name: "Dan P.", initials: "DP" },
    event: "Evening Gym Session",
    eventCategory: "fitness",
    lastMessage: "",
    time: "2 hours ago",
    unread: 0,
    status: "pending",
  },
]

interface MessagesScreenProps {
  onNavigate: (screen: Screen) => void
  isDesktop?: boolean
}

export function MessagesScreen({ onNavigate, isDesktop }: MessagesScreenProps) {
  return (
    <div className="flex flex-col">
      {!isDesktop && (
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-4">
          <h1 className="text-xl font-bold text-foreground font-serif">Messages</h1>
          <p className="text-xs text-muted-foreground">Your join requests and chats</p>
        </header>
      )}

      <div className="flex flex-col">
        {MOCK_CONVERSATIONS.map((convo) => (
          <button
            key={convo.id}
            onClick={() => onNavigate("chat")}
            className="group flex items-center gap-3 border-b border-border px-4 py-3.5 text-left transition-colors hover:bg-card/60 active:bg-card/60"
          >
            <div className="relative">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">{convo.person.initials}</AvatarFallback>
              </Avatar>
              {convo.unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {convo.unread}
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground text-sm">{convo.person.name}</span>
                {convo.status === "pending" && (
                  <Badge variant="outline" className="border-amber-400/20 bg-amber-500/15 text-amber-300 text-[10px] px-1.5 py-0">
                    Pending
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{convo.event}</span>
              <p className={cn("truncate text-xs", convo.unread > 0 ? "font-medium text-foreground" : "text-muted-foreground")}>
                {convo.status === "pending" ? "Waiting for host response..." : convo.lastMessage}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] text-muted-foreground">{convo.time}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>
        ))}

        {/* Empty state hint */}
        {MOCK_CONVERSATIONS.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Clapperboard className="h-7 w-7 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">No messages yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Join an event to start chatting with people near you!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
