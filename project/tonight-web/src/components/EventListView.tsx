"use client";

import { useMemo } from "react";

export type EventListItem = {
  id: string;
  title: string;
  locationName: string;
  datetimeISO?: string | null;
  distanceMeters?: number | null;
  description?: string | null;
};

export type EventListViewProps = {
  events: EventListItem[];
  selectedEventId?: string | null;
  onEventSelect?: (eventId: string) => void;
  className?: string;
  emptyStateMessage?: string;
  showSummary?: boolean;
};

export default function EventListView({
  events,
  selectedEventId = null,
  onEventSelect,
  className,
  emptyStateMessage = "No nearby events yet",
  showSummary = true,
}: EventListViewProps) {
  const summaryText = useMemo(() => {
    if (!events.length) {
      return emptyStateMessage;
    }

    return events.length === 1 ? "Showing 1 event" : `Showing ${events.length} events`;
  }, [emptyStateMessage, events.length]);

  return (
    <div className={className}>
      {showSummary && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-zinc-700">Event list</p>
            <p className="text-xs text-zinc-500" aria-live="polite">
              {summaryText}
            </p>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <EmptyState message={emptyStateMessage} />
      ) : (
        <ul className="space-y-3" aria-label="Nearby events">
          {events.map((event) => {
            const formattedDate = formatDateTime(event.datetimeISO);
            const formattedDistance = formatDistance(event.distanceMeters);
            const isSelected = selectedEventId === event.id;

            return (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => onEventSelect?.(event.id)}
                  className={[
                    "w-full rounded-xl border p-4 text-left transition-all",
                    isSelected
                      ? "border-pink-200 bg-pink-50 shadow-sm"
                      : "border-zinc-200 bg-white hover:border-pink-200 hover:bg-pink-50/50",
                  ].join(" ")}
                  aria-pressed={isSelected}
                  aria-label={`View details for ${event.title}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-zinc-900">{event.title}</p>
                      <p className="flex items-center gap-2 text-sm text-zinc-600">
                        <span className="inline-flex h-2 w-2 rounded-full bg-zinc-400" aria-hidden />
                        {event.locationName}
                      </p>
                      {formattedDate && (
                        <p className="text-sm text-zinc-500">{formattedDate}</p>
                      )}
                      {event.description && (
                        <p className="text-sm text-zinc-500">{event.description}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end text-right text-sm text-zinc-500">
                      {formattedDistance && (
                        <span className="font-medium text-zinc-700">{formattedDistance}</span>
                      )}
                      <span className="text-xs text-pink-600">View details →</span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white px-4 text-center">
    <p className="text-sm text-zinc-500">{message}</p>
  </div>
);

const formatDateTime = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatDistance = (value?: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  if (value >= 1000) {
    const kilometers = value / 1000;
    const precision = kilometers >= 10 ? 0 : 1;
    return `${kilometers.toFixed(precision)} km away`;
  }

  return `${Math.round(value)} m away`;
};
