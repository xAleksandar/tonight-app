"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import UserAvatar from "./UserAvatar";

export type EventDetail = {
  id: string;
  title: string;
  description?: string | null;
  datetimeISO?: string | null;
  locationName?: string | null;
  location?: {
    latitude: number;
    longitude: number;
  } | null;
  maxParticipants?: number | null;
  attendeeCount?: number | null;
};

export type HostProfile = {
  id: string;
  displayName?: string | null;
  email?: string | null;
  photoUrl?: string | null;
};

type JoinRequestStatus = "idle" | "loading" | "success" | "error";

type EventDetailModalProps = {
  event: EventDetail;
  host: HostProfile;
  isOpen: boolean;
  onClose?: () => void;
  onRequestJoin?: (eventId: string) => void;
  joinStatus?: JoinRequestStatus;
  joinStatusMessage?: string | null;
  requestButtonLabel?: string;
  disableRequest?: boolean;
};

const defaultButtonLabel = "Request to Join";

export default function EventDetailModal({
  event,
  host,
  isOpen,
  onClose,
  onRequestJoin,
  joinStatus = "idle",
  joinStatusMessage = null,
  requestButtonLabel = defaultButtonLabel,
  disableRequest = false,
}: EventDetailModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.removeProperty("overflow");
      return () => {};
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === overlayRef.current) {
      onClose?.();
    }
  };

  const capacitySummary = useMemo(() => {
    const { attendeeCount, maxParticipants } = event;
    if (typeof maxParticipants === "number" && maxParticipants > 0) {
      const confirmed = typeof attendeeCount === "number" ? attendeeCount : null;
      if (typeof confirmed === "number") {
        const clampedConfirmed = Math.max(0, Math.min(confirmed, maxParticipants));
        const remaining = Math.max(0, maxParticipants - clampedConfirmed);
        return `${clampedConfirmed}/${maxParticipants} spots filled (${remaining} left)`;
      }
      return `${maxParticipants} spots total`;
    }
    return "Capacity not shared";
  }, [event]);

  const formattedDatetime = useMemo(() => formatDateTime(event.datetimeISO), [event.datetimeISO]);
  const coordinateSummary = useMemo(() => formatCoordinates(event.location), [event.location]);

  if (!mounted || !isOpen) {
    return null;
  }

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
      aria-labelledby="event-detail-title"
      aria-modal="true"
      role="dialog"
    >
      <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-zinc-200 p-2 text-sm text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-700"
          aria-label="Close"
        >
          ×
        </button>

        <div className="space-y-6">
          <header className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-pink-600">Featured meetup</p>
            <h2 id="event-detail-title" className="text-3xl font-semibold text-zinc-900">
              {event.title}
            </h2>
            {event.description && (
              <p className="text-sm text-zinc-600">{event.description}</p>
            )}
          </header>

          <section className="grid gap-4 rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4 sm:grid-cols-2">
            <DetailField label="When" value={formattedDatetime ?? "Date coming soon"} />
            <DetailField label="Where" value={event.locationName ?? "Location TBA"} />
            <DetailField label="Coordinates" value={coordinateSummary ?? "Hidden until accepted"} />
            <DetailField label="Capacity" value={capacitySummary} />
          </section>

          <section className="flex flex-col gap-4 rounded-2xl border border-zinc-100 p-4 sm:flex-row sm:items-center">
            <UserAvatar
              displayName={host.displayName}
              email={host.email ?? undefined}
              photoUrl={host.photoUrl}
              size="md"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-zinc-900">Hosted by</p>
              <p className="text-base font-semibold text-zinc-900">
                {host.displayName ?? host.email ?? "An anonymous host"}
              </p>
              {host.email && <p className="text-sm text-zinc-500">{host.email}</p>}
            </div>
          </section>

          <footer className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-zinc-500">
              Bring your best vibe. Hosts accept guests manually and may ask quick follow-up questions.
            </div>
            <button
              type="button"
              onClick={() => onRequestJoin?.(event.id)}
              disabled={disableRequest || joinStatus === "loading"}
              className="flex items-center justify-center rounded-full bg-pink-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-pink-500 disabled:cursor-not-allowed disabled:bg-zinc-200"
            >
              {joinStatus === "loading" ? "Sending…" : requestButtonLabel}
            </button>
          </footer>

          {joinStatusMessage && (
            <p
              className={
                joinStatus === "error"
                  ? "text-sm text-red-600"
                  : joinStatus === "success"
                    ? "text-sm text-emerald-600"
                    : "text-sm text-zinc-500"
              }
            >
              {joinStatusMessage}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

type DetailFieldProps = {
  label: string;
  value: string;
};

const DetailField = ({ label, value }: DetailFieldProps) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
    <p className="mt-1 text-base font-medium text-zinc-900">{value}</p>
  </div>
);

const formatDateTime = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
};

const formatCoordinates = (coords?: EventDetail["location"] | null) => {
  if (!coords) return null;
  const { latitude, longitude } = coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
};
