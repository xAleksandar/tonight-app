"use client";

import { Copy, MapPin, Share2, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { classNames } from "@/lib/classNames";
import { buildEventInviteShareText, buildEventShareUrl, formatEventShareMoment } from "@/lib/eventShare";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { Drawer } from "@/components/tonight/Drawer";

export type EventCreatedSummary = {
  id: string;
  title: string;
  datetimeISO?: string | null;
  locationName?: string | null;
};

type EventCreatedModalProps = {
  event: EventCreatedSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onViewEvent?: () => void;
  onCreateAnother?: () => void;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(date);
};

export function EventCreatedModal({ event, isOpen, onClose, onViewEvent, onCreateAnother }: EventCreatedModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [shareSupported, setShareSupported] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "sharing">("idle");
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied">("idle");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      document.body?.style?.removeProperty("overflow");
      setShareState("idle");
      setCopyState("idle");
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setShareSupported(typeof navigator !== "undefined" && typeof navigator.share === "function");

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const shareUrl = useMemo(() => {
    if (!event) {
      return "";
    }
    return buildEventShareUrl(event.id);
  }, [event]);

  const shareText = useMemo(() => {
    if (!event) {
      return "";
    }
    return buildEventInviteShareText({
      title: event.title,
      startDateISO: event.datetimeISO,
      locationName: event.locationName,
    });
  }, [event]);

  const friendlyMoment = useMemo(() => formatDateTime(event?.datetimeISO), [event?.datetimeISO]);
  const momentLabel = useMemo(() => formatEventShareMoment(event?.datetimeISO), [event?.datetimeISO]);

  if (!mounted || !event) {
    return null;
  }

  const handleOverlayClick = (target: EventTarget | null) => {
    if (target === overlayRef.current) {
      onClose();
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) {
      return;
    }
    try {
      setCopyState("copying");
      await copyTextToClipboard(shareUrl);
      setCopyState("copied");
      showSuccessToast("Invite link copied", "Share it anywhere to fill your guest list.");
      setTimeout(() => setCopyState("idle"), 3000);
    } catch (error) {
      setCopyState("idle");
      showErrorToast("Unable to copy", (error as Error)?.message ?? "Copy failed. Try again.");
    }
  };

  const handleShare = async () => {
    if (!shareUrl) {
      return;
    }
    try {
      setShareState("sharing");
      if (shareSupported && typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: event.title,
          url: shareUrl,
          text: shareText,
        });
        showSuccessToast("Share sheet opened", "Pick any app to send your invite.");
      } else {
        await copyTextToClipboard(`${shareText} ${shareUrl}`.trim());
        showSuccessToast("Copied invite copy", "Paste it anywhere to invite friends.");
        setCopyState("copied");
        setTimeout(() => setCopyState("idle"), 3000);
      }
    } catch (error) {
      if ((error as Error)?.name === "AbortError") {
        return;
      }
      showErrorToast("Share failed", (error as Error)?.message ?? "Unable to open the share sheet.");
    } finally {
      setShareState("idle");
    }
  };

  const mobileContent = (
    <Drawer isOpen={isOpen} onClose={onClose} title="Event created" className="md:hidden">
      <div className="space-y-4">
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Now live</p>
          <p className="mt-1 text-base font-semibold text-zinc-900">{event.title}</p>
          <p className="mt-1 text-xs text-zinc-500">{friendlyMoment ?? "Time to be announced"}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {event.locationName ?? "Location shared after guests are accepted"}
          </p>
        </div>

        <div className="grid gap-3">
          <button
            type="button"
            onClick={handleShare}
            disabled={shareState === "sharing"}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Share2 className="h-4 w-4" />
            {shareSupported ? (shareState === "sharing" ? "Opening share sheet…" : "Share invite") : "Share invite copy"}
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            disabled={copyState === "copying"}
            className={classNames(
              "inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300",
              copyState === "copied" ? "bg-emerald-50 text-emerald-700" : "bg-white"
            )}
          >
            <Copy className="h-4 w-4" />
            {copyState === "copying" ? "Copying…" : copyState === "copied" ? "Link copied" : "Copy invite link"}
          </button>
        </div>

        <div className="grid gap-2">
          {onViewEvent && (
            <button
              type="button"
              onClick={onViewEvent}
              className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-800 transition hover:border-zinc-300"
            >
              Open event page
            </button>
          )}
          {onCreateAnother && (
            <button
              type="button"
              onClick={onCreateAnother}
              className="inline-flex items-center justify-center rounded-2xl border border-transparent bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Create another
            </button>
          )}
        </div>
      </div>
    </Drawer>
  );

  const desktopContent = (
    <div
      ref={overlayRef}
      className={classNames(
        "fixed inset-0 z-50 items-end justify-center bg-black/60 px-3 py-4 sm:items-center sm:px-6 sm:py-10 md:flex",
        isOpen ? "flex" : "hidden"
      )}
      onClick={(event) => handleOverlayClick(event.target)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-created-title"
    >
      <div className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-[32px] bg-white text-zinc-900 shadow-2xl sm:max-h-[90vh] sm:flex-row">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white/90 text-sm text-zinc-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-zinc-800"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col gap-4 bg-gradient-to-b from-pink-500 via-fuchsia-500 to-indigo-600 px-6 pb-10 pt-12 text-white sm:w-2/5 sm:pt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">Event published</p>
          <h2 id="event-created-title" className="text-3xl font-semibold leading-tight text-white">
            Spread the word
          </h2>
          <p className="text-sm text-white/85">
            Copy the invite link or jump to the event page to manage incoming requests.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-1">
            <DetailSlot tone="dark" label="Event" value={event.title} icon={<Sparkles className="h-4 w-4 text-amber-200" />} />
            <DetailSlot tone="dark" label="When" value={friendlyMoment ?? "Coming soon"} icon={<Share2 className="h-4 w-4 text-white" />} />
            <DetailSlot tone="dark" label="Location" value={event.locationName ?? "Hidden until accepted"} icon={<MapPin className="h-4 w-4 text-emerald-200" />} />
            <DetailSlot tone="dark" label="Moment" value={momentLabel ?? "Invite-only"} icon={<Copy className="h-4 w-4 text-cyan-100" />} />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-6 pt-8 sm:px-8 sm:pb-8 sm:pt-10">
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleShare}
              disabled={shareState === "sharing"}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Share2 className="h-4 w-4" />
              {shareSupported ? (shareState === "sharing" ? "Opening share sheet…" : "Share invite") : "Share invite copy"}
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              disabled={copyState === "copying"}
              className={classNames(
                "inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300",
                copyState === "copied" ? "bg-emerald-50 text-emerald-700" : "bg-white"
              )}
            >
              <Copy className="h-4 w-4" />
              {copyState === "copying" ? "Copying…" : copyState === "copied" ? "Link copied" : "Copy invite link"}
            </button>

            <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/80 px-4 py-3 text-xs text-zinc-500 sm:text-sm">
              <p className="break-all font-mono">{shareUrl}</p>
            </div>
          </div>

          <div className="mt-auto grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onViewEvent}
              className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-800 transition hover:border-zinc-300"
            >
              Open event page
            </button>
            <button
              type="button"
              onClick={onCreateAnother}
              className="inline-flex items-center justify-center rounded-2xl border border-transparent bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Create another
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {mobileContent}
      {createPortal(desktopContent, document.body)}
    </>
  );
}

type DetailSlotProps = {
  label: string;
  value: string;
  icon?: ReactNode;
  tone?: "light" | "dark";
};

const DetailSlot = ({ label, value, icon, tone = "light" }: DetailSlotProps) => (
  <div
    className={classNames(
      "rounded-2xl border p-3",
      tone === "dark" ? "border-white/20 bg-white/10 text-white" : "border-white/60 bg-white/80 text-zinc-900"
    )}
  >
    <p
      className={classNames(
        "text-[11px] font-semibold uppercase tracking-wide",
        tone === "dark" ? "text-white/75" : "text-zinc-500"
      )}
    >
      {label}
    </p>
    <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
      {icon}
      <span className="break-words">{value}</span>
    </p>
  </div>
);

async function copyTextToClipboard(value: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard is unavailable in this environment.');
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.top = '-1000px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const successful = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!successful) {
    throw new Error('Unable to copy to clipboard.');
  }
}

export default EventCreatedModal;
