"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  joinStatus,
  joinStatusMessage,
  requestButtonLabel = defaultButtonLabel,
  disableRequest = false,
}: EventDetailModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const joinRequestAbortRef = useRef<AbortController | null>(null);
  const [mounted, setMounted] = useState(false);
  const [internalJoinStatus, setInternalJoinStatus] = useState<JoinRequestStatus>("idle");
  const [internalJoinMessage, setInternalJoinMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    return () => {
      joinRequestAbortRef.current?.abort();
    };
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

  const resetJoinState = useCallback(() => {
    joinRequestAbortRef.current?.abort();
    setInternalJoinStatus("idle");
    setInternalJoinMessage(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetJoinState();
    }
  }, [isOpen, resetJoinState]);

  useEffect(() => {
    resetJoinState();
  }, [event.id, resetJoinState]);

  const setJoinStatus = useCallback((status: JoinRequestStatus, message: string | null) => {
    setInternalJoinStatus(status);
    setInternalJoinMessage(message);
  }, []);

  const inferErrorMessage = useCallback(
    (status: number, fallback: string, payload?: Record<string, unknown> | null) => {
      if (status === 401) {
        return "Please log in to request a spot.";
      }
      if (status === 404) {
        return "This event could not be found.";
      }
      if (status === 409) {
        if (payload && typeof payload.error === "string") {
          return payload.error;
        }
        return "This event is no longer accepting requests.";
      }
      if (payload && typeof payload.error === "string") {
        return payload.error;
      }
      return fallback;
    },
    []
  );

  const handleInternalJoinRequest = useCallback(async () => {
    joinRequestAbortRef.current?.abort();
    const controller = new AbortController();
    joinRequestAbortRef.current = controller;

    setJoinStatus("loading", null);

    try {
      const response = await fetch("/api/join-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ eventId: event.id }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let payload: Record<string, unknown> | null = null;
        try {
          payload = (await response.json()) as Record<string, unknown>;
        } catch {
          payload = null;
        }

        const errorMessage = inferErrorMessage(
          response.status,
          "Unable to send join request. Please try again.",
          payload
        );
        throw new Error(errorMessage);
      }

      setJoinStatus("success", "Request sent! The host will follow up soon.");
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }
      console.error("Join request failed", error);
      setJoinStatus(
        "error",
        (error as Error).message || "Unable to send join request. Please try again."
      );
    }
  }, [event.id, inferErrorMessage, setJoinStatus]);

  const handleJoinRequestClick = useCallback(() => {
    if (onRequestJoin) {
      onRequestJoin(event.id);
      return;
    }
    void handleInternalJoinRequest();
  }, [event.id, handleInternalJoinRequest, onRequestJoin]);

  const effectiveJoinStatus = typeof joinStatus === "undefined" ? internalJoinStatus : joinStatus;
  const effectiveJoinMessage =
    typeof joinStatusMessage === "undefined" ? internalJoinMessage : joinStatusMessage;

  const isInternalHandler = !onRequestJoin;
  const isButtonDisabled =
    disableRequest ||
    effectiveJoinStatus === "loading" ||
    (isInternalHandler && effectiveJoinStatus === "success");

  const computedButtonLabel =
    effectiveJoinStatus === "loading"
      ? "Sending…"
      : effectiveJoinStatus === "success" && isInternalHandler
        ? "Requested"
        : requestButtonLabel;

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
            {event.description && <p className="text-sm text-zinc-600">{event.description}</p>}
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
              data-testid="join-request-button"
              onClick={handleJoinRequestClick}
              disabled={isButtonDisabled}
              className="flex items-center justify-center rounded-full bg-pink-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-pink-500 disabled:cursor-not-allowed disabled:bg-zinc-200"
            >
              {computedButtonLabel}
            </button>
          </footer>

          {effectiveJoinMessage && (
            <p
              data-testid="join-request-message"
              data-status={effectiveJoinStatus}
              className={
                effectiveJoinStatus === "error"
                  ? "text-sm text-red-600"
                  : effectiveJoinStatus === "success"
                    ? "text-sm text-emerald-600"
                    : "text-sm text-zinc-500"
              }
            >
              {effectiveJoinMessage}
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
