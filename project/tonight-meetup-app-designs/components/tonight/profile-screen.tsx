"use client"

import React from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Camera,
  Mail,
  Calendar,
  MapPin,
  ChevronRight,
  Settings,
  Shield,
  LogOut,
  Clapperboard,
  Users,
} from "lucide-react"
import type { Screen } from "./bottom-nav"

interface ProfileScreenProps {
  onLogout: () => void
  isDesktop?: boolean
}

export function ProfileScreen({ onLogout, isDesktop }: ProfileScreenProps) {
  return (
    <div className="flex flex-col">
      {!isDesktop && (
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-4">
          <h1 className="text-xl font-bold text-foreground font-serif">Profile</h1>
        </header>
      )}

      <div className="flex flex-col gap-4 p-4">
        {/* Avatar & Name */}
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card/60 p-6">
          <div className="relative">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">YN</AvatarFallback>
            </Avatar>
            <button
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-lg"
              aria-label="Change photo"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold text-foreground">Your Name</h2>
            <p className="text-xs text-muted-foreground">Edit your display name</p>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-foreground">3</span>
              <span className="text-[10px] text-muted-foreground">Events posted</span>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-foreground">7</span>
              <span className="text-[10px] text-muted-foreground">Events joined</span>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-foreground">12</span>
              <span className="text-[10px] text-muted-foreground">People met</span>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="flex flex-col rounded-2xl border border-border bg-card/60">
          <ProfileRow icon={<Mail className="h-4 w-4" />} label="Email" value="you@example.com" />
          <ProfileRow icon={<Calendar className="h-4 w-4" />} label="Joined" value="February 2026" />
          <ProfileRow icon={<MapPin className="h-4 w-4" />} label="Location" value="Allow access" isAction />
        </div>

        {/* My Events */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground px-1">My Active Events</h3>
          <div className="flex flex-col rounded-2xl border border-border bg-card/60">
            <div className="flex items-center gap-3 p-3.5 border-b border-border">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300 border border-sky-400/20">
                <Clapperboard className="h-4 w-4" />
              </div>
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-medium text-foreground">Going to Cinema</span>
                <span className="text-xs text-muted-foreground">Tonight, 8:30 PM</span>
              </div>
              <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">1 request</Badge>
            </div>
            <div className="flex items-center gap-3 p-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-400/20">
                <Users className="h-4 w-4" />
              </div>
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-medium text-foreground">Beach Volleyball</span>
                <span className="text-xs text-muted-foreground">Tomorrow, 5:00 PM</span>
              </div>
              <Badge variant="outline" className="border-emerald-400/20 bg-emerald-500/15 text-emerald-300 text-[10px]">Active</Badge>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="flex flex-col rounded-2xl border border-border bg-card/60">
          <SettingsRow icon={<Settings className="h-4 w-4" />} label="Settings" />
          <SettingsRow icon={<Shield className="h-4 w-4" />} label="Safety & Privacy" />
          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-4 py-3 text-left text-destructive hover:bg-destructive/5 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function ProfileRow({ icon, label, value, isAction = false }: { icon: React.ReactNode; label: string; value: string; isAction?: boolean }) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`ml-auto text-sm ${isAction ? "text-primary font-medium" : "text-foreground"}`}>{value}</span>
    </div>
  )
}

function SettingsRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex items-center gap-3 border-b border-border px-4 py-3 text-left text-foreground last:border-b-0 hover:bg-secondary/50 transition-colors">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  )
}
