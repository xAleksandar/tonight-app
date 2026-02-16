"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X, MessageCircle } from "lucide-react";
import type { EventChatAttentionPayload } from "@/components/tonight/event-inside/EventInsideExperience";

export type EventChatAttentionToastProps = {
  href: string;
  label: string;
  helperText?: string | null;
  attentionLabel?: string | null;
  snippet?: string | null;
  snippetSender?: string | null;
  snippetTimestamp?: string | null;
  onInteract?: () => void;
  attentionQueue?: EventChatAttentionPayload[];
};

const TOAST_CONTAINER_CLASS =
  "pointer-events-auto rounded-3xl border border-white/15 bg-black/65 px-4 py-4 text-white shadow-[0_20px_45px_rgba(0,0,0,0.55)] backdrop-blur-3xl";
const TOAST_SNIPPET_CYCLE_MS = 3800;

export function EventChatAttentionToast({
  href,
  label,
  helperText,
  attentionLabel,
  snippet,
  snippetSender,
  snippetTimestamp,
  onInteract,
  attentionQueue,
}: EventChatAttentionToastProps) {
  const attentionItems = useMemo(() => {
    if (!attentionQueue?.length) {
      return [] as EventChatAttentionPayload[];
    }

    return attentionQueue
      .map((item) => {
        const trimmed = typeof item.snippet === "string" ? item.snippet.trim() : "";
        if (!trimmed) {
          return null;
        }
        return { ...item, snippet: trimmed };
      })
      .filter((entry): entry is EventChatAttentionPayload => Boolean(entry?.snippet?.length) && Boolean(entry?.id));
  }, [attentionQueue]);

  const queueSignature = useMemo(() => attentionItems.map((item) => item.id).join("|"), [attentionItems]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [queueSignature]);

  useEffect(() => {
    if (attentionItems.length <= 1 || typeof window === "undefined") {
      return;
    }

    const interval = window.setInterval(() => {
      setActiveIndex((prev) => {
        const nextIndex = prev + 1;
        return nextIndex >= attentionItems.length ? 0 : nextIndex;
      });
    }, TOAST_SNIPPET_CYCLE_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [attentionItems.length, queueSignature]);

  const activeItem = attentionItems.length
    ? attentionItems[Math.min(activeIndex, attentionItems.length - 1)]
    : null;

  const resolvedAttentionLabel = attentionLabel && attentionLabel.trim().length > 0 ? attentionLabel : "New chat ping";
  const resolvedHelperText = activeItem?.helperText ?? helperText;
  const snippetSource = activeItem?.snippet ?? snippet;
  const resolvedSnippet = typeof snippetSource === "string" && snippetSource.trim().length > 0 ? snippetSource.trim() : null;
  const snippetSenderSource = activeItem?.authorName ?? snippetSender;
  const resolvedSnippetSender =
    typeof snippetSenderSource === "string" && snippetSenderSource.trim().length > 0 ? snippetSenderSource.trim() : null;
  const resolvedSnippetTimestamp = formatRelativeTime(activeItem?.timestampISO ?? snippetTimestamp);
  const ctaHref = activeItem?.href ?? href;
  const queuePositionLabel = attentionItems.length > 1 ? `${Math.min(activeIndex + 1, attentionItems.length)} of ${attentionItems.length}` : null;

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
              {resolvedHelperText ? <p className="text-sm text-white/75 line-clamp-2">{resolvedHelperText}</p> : null}
              {resolvedSnippet ? (
                <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85">
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.3em] text-white/50">
                    <span>{resolvedSnippetSender ?? "Latest activity"}</span>
                    {resolvedSnippetTimestamp ? <span className="text-white/40">{resolvedSnippetTimestamp}</span> : null}
                  </div>
                  <p className="text-sm text-white line-clamp-2">{resolvedSnippet}</p>
                  {queuePositionLabel ? (
                    <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.4em] text-white/40">{queuePositionLabel}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={ctaHref}
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
