"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowRight, Clock, MapPin, Sparkles, Users } from "lucide-react";

import { showErrorToast, showSuccessToast } from "@/lib/toast";

const normalizeEmail = (value: string) => value.trim().toLowerCase();

type Status = "idle" | "submitting" | "success" | "error";

type ApiResponse = { error?: string; magicLinkUrl?: string };

type WelcomeScreenProps = {
  defaultEmail?: string;
  redirectMessage?: string;
};

export function WelcomeScreen({ defaultEmail = "", redirectMessage }: WelcomeScreenProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string>("");
  const [magicLinkUrl, setMagicLinkUrl] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = normalizeEmail(email);

    if (!normalized) {
      setMessage("Enter a valid email to continue.");
      setStatus("error");
      showErrorToast("Enter a valid email", "We need your email to send a magic link.");
      return;
    }

    setStatus("submitting");
    setMessage(null);

    try {
      const response = await fetch("/api/auth/request-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as ApiResponse;
        throw new Error(payload.error ?? "Unable to send magic link.");
      }

      const payload = (await response.json()) as ApiResponse;
      setSubmittedEmail(normalized);
      setMagicLinkUrl(payload.magicLinkUrl ?? null);
      setStatus("success");
      setMessage(null);
    } catch (error) {
      console.error("Magic link request failed", error);
      setStatus("error");
      const errorMessage = (error as Error).message ?? "Something went wrong. Try again.";
      setMessage(errorMessage);
      showErrorToast("Unable to send magic link", errorMessage);
    }
  };

  const showForm = status !== "success";

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="absolute inset-0">
        <Image
          src="/hero-friends.jpg"
          alt="Young friends enjoying a night out"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <div className="mb-6 flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30">
              <Sparkles className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground font-serif">tonight</h1>
            <p className="max-w-xs text-sm text-muted-foreground leading-relaxed">
              Free time? Meet someone new. Post what you&apos;re doing or discover what&apos;s happening nearby.
            </p>
            {redirectMessage ? (
              <span className="rounded-full border border-border/60 bg-card/60 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {redirectMessage}
              </span>
            ) : null}
          </div>

          <div className="mb-10 flex flex-wrap justify-center gap-3 text-xs font-medium text-muted-foreground">
            <FeaturePill icon={<MapPin className="h-3.5 w-3.5" />} label="Nearby events" />
            <FeaturePill icon={<Clock className="h-3.5 w-3.5" />} label="Spontaneous" />
            <FeaturePill icon={<Users className="h-3.5 w-3.5" />} label="Meet people" />
          </div>

          {showForm ? (
            <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
              <label className="sr-only" htmlFor="welcome-email">
                Email address
              </label>
              <input
                id="welcome-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                className="h-12 rounded-xl border border-border/70 bg-card/60 px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                disabled={status === "submitting"}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:bg-primary/90 disabled:opacity-60"
              >
                {status === "submitting" ? "Sending magic link…" : "Continue with email"}
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="text-xs text-muted-foreground">We&apos;ll send you a magic link to sign in instantly.</p>
              {status === "error" && message ? (
                <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive-foreground">
                  {message}
                </p>
              ) : null}
            </form>
          ) : (
            <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-border/60 bg-card/70 p-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-foreground">Check your email</p>
                <p className="text-sm text-muted-foreground">
                  We sent a magic link to <span className="font-medium text-foreground">{submittedEmail}</span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Open the link on this device to jump into Tonight.</p>
              {magicLinkUrl ? (
                <a
                  href={magicLinkUrl}
                  className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  Direct login (dev only)
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setStatus("idle");
                  setMessage(null);
                  setMagicLinkUrl(null);
                  setEmail("");
                }}
                className="rounded-full border border-border/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Use a different email
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 border-t border-border/60 bg-card/60 px-6 py-6 text-muted-foreground backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between gap-4 text-center">
          <StepIndicator step="1" title="Post" desc="Share your plan" />
          <div className="h-px flex-1 bg-border/50" />
          <StepIndicator step="2" title="Discover" desc="Browse nearby" />
          <div className="h-px flex-1 bg-border/50" />
          <StepIndicator step="3" title="Join" desc="Meet & enjoy" />
        </div>
      </div>
    </div>
  );
}

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
      {icon}
      {label}
    </span>
  );
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
  );
}
