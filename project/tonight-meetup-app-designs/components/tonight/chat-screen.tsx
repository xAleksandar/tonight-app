"use client"

import React from "react"

import { useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Send, ShieldAlert, Flag, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Screen } from "./bottom-nav"

const MOCK_MESSAGES = [
  { id: "1", sender: "them", text: "Hey! Would love to join for the movie tonight.", time: "8:02 PM" },
  { id: "2", sender: "me", text: "Awesome! I'm watching the new sci-fi at Cinema City.", time: "8:03 PM" },
  { id: "3", sender: "them", text: "Perfect, I've been wanting to see that! What time should I be there?", time: "8:04 PM" },
  { id: "4", sender: "me", text: "Movie starts at 8:30. Maybe meet at 8:15 by the entrance?", time: "8:05 PM" },
  { id: "5", sender: "them", text: "Great! See you at 8:15 then. I'll be wearing a blue jacket.", time: "8:06 PM" },
]

interface ChatScreenProps {
  onNavigate: (screen: Screen) => void
}

export function ChatScreen({ onNavigate }: ChatScreenProps) {
  const [newMessage, setNewMessage] = useState("")
  const [messages, setMessages] = useState(MOCK_MESSAGES)

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim()) return
    setMessages([
      ...messages,
      {
        id: String(messages.length + 1),
        sender: "me",
        text: newMessage,
        time: "Now",
      },
    ])
    setNewMessage("")
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate("messages")}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">EK</AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-semibold text-foreground">Elena K.</span>
            <span className="text-[10px] text-muted-foreground">Sushi Dinner</span>
          </div>
          <button className="rounded-lg border border-border bg-card/60 p-2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Event info">
            <Info className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4" style={{ paddingBottom: "80px" }}>
        {/* Join accepted banner */}
        <div className="mx-auto mb-2 flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-xs text-muted-foreground">Join request accepted</span>
        </div>

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn("flex flex-col gap-0.5", msg.sender === "me" ? "items-end" : "items-start")}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                msg.sender === "me"
                  ? "rounded-br-md bg-primary text-primary-foreground"
                  : "rounded-bl-md border border-border bg-card/60 text-foreground"
              )}
            >
              {msg.text}
            </div>
            <span className="px-1 text-[10px] text-muted-foreground">{msg.time}</span>
          </div>
        ))}
      </div>

      {/* Safety Actions */}
      <div className="flex items-center justify-center gap-4 border-t border-border bg-card/60/50 px-4 py-2">
        <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
          <ShieldAlert className="h-3 w-3" />
          Block
        </button>
        <span className="h-2.5 w-px bg-border" />
        <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors">
          <Flag className="h-3 w-3" />
          Report
        </button>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 border-t border-border bg-background px-4 py-3">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-xl border border-border bg-card/60 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Type a message"
          />
          <Button
            type="submit"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl"
            disabled={!newMessage.trim()}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
