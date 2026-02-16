"use client";

import Link from "next/link";
import { X, MessageCircle } from "lucide-react";

export type EventChatAttentionToastProps = {
  href: string;
  label: string;
  helperText?: string | null;
  attentionLabel?: string | null;
  snippet?: string | null;
  snippetSender?: string | null;
  snippetTimestamp?: string | null;
  onInteract?: () => void;
};

const TOAST_CONTAINER_CLASS =
  "pointer-events-auto rounded-3xl border border-white/15 bg-black/65 px-4 py-4 text-white shadow-[0_20px_45px_rgba(0,0,0,0.55)] backdrop-blur-3xl";

export function EventChatAttentionToast({
  href,
  label,
  helperText,
  attentionLabel,
  snippet,
  snippetSender,
  snippetTimestamp,
  onInteract,
}: EventChatAttentionToastProps) {
  const resolvedAttentionLabel = attentionLabel && attentionLabel.trim().length > 0 ? attentionLabel : "New chat ping";
  const resolvedSnippet = typeof snippet === "string" && snippet.trim().length > 0 ? snippet.trim() : null;
  const resolvedSnippetSender = typeof snippetSender === "string" && snippetSender.trim().length > 0 ? snippetSender.trim() : null;
  const resolvedSnippetTimestamp = formatRelativeTime(snippetTimestamp);

  const handleInteract = () => {
    onInteract?.();
  };

  return (
    <div className="fixed inset-x-4 bottom-28 z-[60] md:bottom-8 md:right-10 md:inset-x-auto md:w-[360px]">
      <div className={TOAST_CONTAINER_CLASS} role="status" aria-live="polite">
        <div className="flex items-start gap-3">
          <span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-primary">
            <MessageCircle className="h-5 w-5" aria-hidden />
          </span>
          <div className="flex-1 space-y-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">{resolvedAttentionLabel}</p>
              <p className="text-base font-semibold text-white">Jump back into chat</p>
              {helperText ? <p className="text-sm text-white/75 line-clamp-2">{helperText}</p> : null}
              {resolvedSnippet ? (
                <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
                    {resolvedSnippetSender ?? "Latest activity"}
                    {resolvedSnippetTimestamp ? <span className="text-white/50"> · {resolvedSnippetTimestamp}</span> : null}
                  </p>
                  <p className="text-sm text-white line-clamp-2">{resolvedSnippet}</p>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={href}
                prefetch={false}
                onClick={handleInteract}
                className="inline-flex flex-1 items-center justify-center rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_10px_35px_rgba(236,72,153,0.4)] transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {label}
              </Link>
              <button
                type="button"
                onClick={handleInteract}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/40 hover:text-white"
                aria-label="Dismiss chat alert"
              >
                <X className="h-4 w-4" />
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (Math.abs(diffMinutes) < 1) {
    return "just now";
  }

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, "day");
}
