"use client"

import React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import { Sparkles, ArrowRight, MapPin, Clock, Users } from "lucide-react"

interface WelcomeScreenProps {
  onLogin: () => void
}

export function WelcomeScreen({ onLogin }: WelcomeScreenProps) {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (email) setSent(true)
  }

  return (
    <div className="relative flex min-h-dvh flex-col">
      {/* Full-screen background photo */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/hero-friends.jpg"
          alt="Young friends enjoying a night out together"
          fill
          className="object-cover"
          priority
        />
        {/* Dark overlay gradient so text is always readable */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>

      {/* Hero Section */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12">

        <div className="relative z-10 flex flex-col items-center text-center">
          {/* Logo / Brand */}
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="mb-1 text-4xl font-bold tracking-tight text-foreground font-serif">tonight</h1>
          <p className="mb-8 max-w-xs text-base text-muted-foreground leading-relaxed">
            Free time? Meet someone new. Post what you're doing or discover what's happening nearby.
          </p>

          {/* Feature Pills */}
          <div className="mb-10 flex flex-wrap justify-center gap-3">
            <FeaturePill icon={<MapPin className="h-3.5 w-3.5" />} label="Nearby events" />
            <FeaturePill icon={<Clock className="h-3.5 w-3.5" />} label="Spontaneous" />
            <FeaturePill icon={<Users className="h-3.5 w-3.5" />} label="Meet people" />
          </div>

          {/* Auth Form */}
          {!sent ? (
            <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-3">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl border-border bg-card/60 text-foreground placeholder:text-muted-foreground shadow-sm"
                required
                aria-label="Email address"
              />
              <Button type="submit" size="lg" className="h-12 rounded-xl text-base font-semibold">
                Continue with email
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">
                {"We'll send you a magic link to sign in instantly"}
              </p>
            </form>
          ) : (
            <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card/60 p-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="text-center">
                <h2 className="mb-1 text-lg font-semibold text-foreground">Check your email</h2>
                <p className="text-sm text-muted-foreground">
                  We sent a magic link to <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>
              <Button onClick={onLogin} variant="outline" className="mt-2 rounded-xl bg-transparent">
                Open app (demo)
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Illustration Row */}
      <div className="relative z-10 border-t border-border bg-card/60/90 px-6 py-6 backdrop-blur-lg">
        <div className="mx-auto flex max-w-sm items-center justify-between gap-4">
          <StepIndicator step="1" title="Post" desc="Share your plan" />
          <div className="h-px flex-1 bg-border" />
          <StepIndicator step="2" title="Discover" desc="Browse nearby" />
          <div className="h-px flex-1 bg-border" />
          <StepIndicator step="3" title="Join" desc="Meet & enjoy" />
        </div>
      </div>
    </div>
  )
}

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
      {icon}
      {label}
    </span>
  )
}

function StepIndicator({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {step}
      </span>
      <span className="text-xs font-semibold text-foreground">{title}</span>
      <span className="text-[10px] text-muted-foreground">{desc}</span>
    </div>
  )
}
