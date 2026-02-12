"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { CheckCircle2, Clock3, MapPin, MessageCircle, Shield, Sparkles, Users } from "lucide-react";

import UserAvatar from "@/components/UserAvatar";
import { classNames } from "@/lib/classNames";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

export type EventInsideExperienceProps = {
  event: {
    id: string;
    title: string;
    description?: string | null;
    startDateISO?: string | null;
    locationName?: string | null;
    vibeTags?: string[];
    entryNotes?: string[];
    capacityLabel?: string;
  };
  host: {
    id: string;
    displayName: string;
    bio?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  };
  attendees: Array<{
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    status: "confirmed" | "pending" | "waitlist";
    blurb?: string | null;
  }>;
  joinRequests: Array<{
    id: string;
    userId: string;
    displayName: string;
    intro?: string | null;
    submittedAtISO?: string | null;
    mutualFriends?: number | null;
  }>;
  viewerRole: "host" | "guest" | "pending";
  chatPreview?: {
    lastMessageSnippet?: string | null;
    lastMessageAtISO?: string | null;
    unreadCount?: number | null;
    participantCount?: number | null;
    ctaLabel?: string | null;
    ctaHref?: string | null;
    ctaDisabledReason?: string | null;
    hostUnreadThreads?: Array<{
      joinRequestId: string;
      displayName: string;
      lastMessageSnippet: string;
      lastMessageAtISO?: string | null;
      unreadCount?: number | null;
    }>;
  };
};

const viewerRoleCopy: Record<EventInsideExperienceProps["viewerRole"], { label: string; tone: string }> = {
  host: { label: "You are hosting", tone: "bg-amber-500/10 text-amber-700" },
  guest: { label: "You are confirmed", tone: "bg-emerald-500/10 text-emerald-600" },
  pending: { label: "Awaiting host approval", tone: "bg-sky-500/10 text-sky-600" },
};

type JoinRequestActionState = "approving" | "rejecting";
type HostUnreadThread = NonNullable<NonNullable<EventInsideExperienceProps["chatPreview"]>["hostUnreadThreads"]>[number];

export function EventInsideExperience({
  event,
  host,
  attendees,
  joinRequests,
  viewerRole,
  chatPreview,
}: EventInsideExperienceProps) {
  const [pendingRequests, setPendingRequests] = useState(joinRequests);
  const [roster, setRoster] = useState(attendees);
  const [requestActionState, setRequestActionState] = useState<Record<string, JoinRequestActionState | undefined>>({});
  const [hostUnreadThreads, setHostUnreadThreads] = useState<HostUnreadThread[]>(chatPreview?.hostUnreadThreads ?? []);
  const [markingThreadId, setMarkingThreadId] = useState<string | null>(null);

  useEffect(() => {
    setPendingRequests(joinRequests);
  }, [joinRequests]);

  useEffect(() => {
    setRoster(attendees);
  }, [attendees]);

  useEffect(() => {
    setHostUnreadThreads(chatPreview?.hostUnreadThreads ?? []);
  }, [chatPreview?.hostUnreadThreads]);

  const groupedAttendees = useMemo(() => groupAttendees(roster), [roster]);
  const stats = useMemo(() => buildStats(event, groupedAttendees), [event, groupedAttendees]);
  const chatCtaLabel = chatPreview?.ctaLabel ?? "Open chat";
  const rawChatHref = chatPreview?.ctaHref ?? "";
  const chatCtaHref = rawChatHref.trim() ? rawChatHref.trim() : null;
  const chatCtaDisabledReason = chatPreview?.ctaDisabledReason;

  const handleMarkThreadAsRead = async (joinRequestId: string) => {
    const fallback = "Unable to mark this thread as read.";
    setMarkingThreadId(joinRequestId);
    try {
      const response = await fetch(`/api/chat/${joinRequestId}/mark-read`, {
        method: "POST",
      });

      if (!response.ok) {
        const message = await readErrorPayload(response, fallback);
        throw new Error(message);
      }

      setHostUnreadThreads((prev) => prev.filter((thread) => thread.joinRequestId !== joinRequestId));
      showSuccessToast("Marked as read");
    } catch (error) {
      const message = (error as Error)?.message ?? fallback;
      showErrorToast("Action failed", message);
    } finally {
      setMarkingThreadId(null);
    }
  };

  const handleJoinRequestDecision = useCallback(
    async ({
      requestId,
      userId,
      displayName,
      nextStatus,
    }: {
      requestId: string;
      userId: string;
      displayName: string;
      nextStatus: "accepted" | "rejected";
    }) => {
      const intent: JoinRequestActionState = nextStatus === "accepted" ? "approving" : "rejecting";
      setRequestActionState((prev) => ({
        ...prev,
        [requestId]: intent,
      }));

      try {
        const response = await fetch(`/api/join-requests/${requestId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: nextStatus }),
        });

        if (!response.ok) {
          const fallback = nextStatus === "accepted" ? "Unable to approve this request." : "Unable to reject this request.";
          const message = await readErrorPayload(response, fallback);
          throw new Error(message);
        }

        setPendingRequests((prev) => prev.filter((request) => request.id !== requestId));
        setRoster((prev) => {
          let found = false;
          const status = nextStatus === "accepted" ? "confirmed" : "waitlist";
          const blurb = nextStatus === "accepted" ? "Coming tonight" : "Moved to waitlist";

          const nextRoster = prev.map((attendee) => {
            if (attendee.id === userId) {
              found = true;
              return { ...attendee, status, blurb };
            }
            return attendee;
          });

          if (!found) {
            nextRoster.push({
              id: userId,
              displayName,
              status,
              blurb,
            });
          }

          return nextRoster;
        });

        showSuccessToast(nextStatus === "accepted" ? "Guest confirmed" : "Request rejected");
      } catch (error) {
        const fallback = nextStatus === "accepted" ? "Unable to approve this request." : "Unable to reject this request.";
        const message = (error as Error)?.message ?? fallback;
        showErrorToast("Join request update failed", message);
      } finally {
        setRequestActionState((prev) => {
          const next = { ...prev };
          delete next[requestId];
          return next;
        });
      }
    },
    []
  );

  return (
    <section className="space-y-8">
      <header className="rounded-3xl border border-white/15 bg-white/5 p-6 text-white shadow-2xl shadow-primary/5 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={classNames(
              "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
              viewerRoleCopy[viewerRole].tone
            )}
          >
            {viewerRoleCopy[viewerRole].label}
          </span>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Clock3 className="h-4 w-4" />
            <span>{formatDateTime(event.startDateISO) ?? "Time TBA"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <MapPin className="h-4 w-4" />
            <span>{event.locationName ?? "Location coming soon"}</span>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-white">{event.title}</h1>
          {event.description ? <p className="text-base text-white/70">{event.description}</p> : null}
          {event.vibeTags && event.vibeTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {event.vibeTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/70"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <SectionHeading icon={Sparkles} title="Tonight's plan" subtitle="Everything guests need once they're inside" />
            <dl className="grid gap-4 sm:grid-cols-3">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-white/60">{stat.label}</dt>
                  <dd className="mt-2 text-lg font-semibold text-white">{stat.value}</dd>
                  {stat.subLabel ? <p className="text-xs text-white/60">{stat.subLabel}</p> : null}
                </div>
              ))}
            </dl>
            {event.entryNotes && event.entryNotes.length ? (
              <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Entrance checklist</p>
                <ul className="mt-3 list-disc space-y-1 pl-5">
                  {event.entryNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          <Card>
            <SectionHeading icon={Users} title="Attendees" subtitle="Confirmed + pending guests" />
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              {(["confirmed", "pending", "waitlist"] as const).map((bucket) => {
                const bucketLabel = bucket === "confirmed" ? "Confirmed" : bucket === "pending" ? "Awaiting reply" : "Waitlist";
                const bucketColor =
                  bucket === "confirmed"
                    ? "text-emerald-300"
                    : bucket === "pending"
                      ? "text-sky-300"
                      : "text-zinc-300";
                const people = groupedAttendees[bucket];
                return (
                  <div key={bucket} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className={classNames("text-xs font-semibold uppercase tracking-wide", bucketColor)}>
                      {bucketLabel} · {people.length}
                    </p>
                    <ul className="mt-3 space-y-2">
                      {people.length === 0 ? (
                        <li className="text-sm text-white/50">No one yet.</li>
                      ) : (
                        people.map((person) => (
                          <li key={person.id} className="flex items-center gap-3 rounded-xl bg-black/20 px-3 py-2">
                            <UserAvatar displayName={person.displayName} photoUrl={person.avatarUrl ?? undefined} size="sm" />
                            <div>
                              <p className="text-sm font-semibold text-white">{person.displayName}</p>
                              {person.blurb ? <p className="text-xs text-white/60">{person.blurb}</p> : null}
                            </div>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <SectionHeading icon={CheckCircle2} title="Join requests" subtitle="Hosts see who's waiting" />
            {pendingRequests.length === 0 ? (
              <p className="mt-4 text-sm text-white/60">No new requests right now.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {pendingRequests.map((request) => {
                  const actionState = requestActionState[request.id];
                  const isApproving = actionState === "approving";
                  const isRejecting = actionState === "rejecting";
                  const busy = Boolean(actionState);
                  return (
                    <li key={request.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-start gap-3">
                        <UserAvatar displayName={request.displayName} size="sm" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white">{request.displayName}</p>
                          <p className="text-xs text-white/60">
                            Sent {formatRelativeTime(request.submittedAtISO)}
                            {typeof request.mutualFriends === "number" && request.mutualFriends > 0
                              ? ` · ${request.mutualFriends} mutual`
                              : ""}
                          </p>
                          {request.intro ? <p className="mt-2 text-sm text-white/80">“{request.intro}”</p> : null}
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleJoinRequestDecision({
                              requestId: request.id,
                              userId: request.userId,
                              displayName: request.displayName,
                              nextStatus: "accepted",
                            })
                          }
                          className="flex-1 rounded-xl bg-emerald-500/80 px-3 py-2 text-sm font-semibold text-emerald-950"
                          disabled={busy}
                        >
                          {isApproving ? "Approving…" : "Approve"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleJoinRequestDecision({
                              requestId: request.id,
                              userId: request.userId,
                              displayName: request.displayName,
                              nextStatus: "rejected",
                            })
                          }
                          className="flex-1 rounded-xl border border-white/20 px-3 py-2 text-sm font-semibold text-white/80"
                          disabled={busy}
                        >
                          {isRejecting ? "Passing…" : "Pass"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-4 text-xs text-white/50">
              Actions update the live join-requests API, so every tap stays in sync with the host tools page.
            </p>
          </Card>

          <Card>
            <SectionHeading icon={MessageCircle} title="Event chat" subtitle="Hosts + guests coordinate here" />
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/20 p-3 text-primary">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {chatPreview?.participantCount ? `${chatPreview.participantCount} people in chat` : "Event thread"}
                  </p>
                  <p className="text-xs text-white/60">
                    {chatPreview?.lastMessageSnippet ?? "No messages yet. Say hi once you're accepted."}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-white/60">
                <span>{formatRelativeTime(chatPreview?.lastMessageAtISO)}</span>
                {chatPreview?.unreadCount ? (
                  <span className="rounded-full bg-primary/20 px-3 py-1 text-primary">
                    {chatPreview.unreadCount} unread
                  </span>
                ) : null}
              </div>
              {chatCtaHref ? (
                <Link
                  href={chatCtaHref}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-primary/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {chatCtaLabel}
                </Link>
              ) : (
                <button
                  type="button"
                  className="mt-4 w-full rounded-xl bg-primary/60 px-4 py-2 text-sm font-semibold text-white opacity-70"
                  disabled
                >
                  {chatCtaLabel}
                </button>
              )}
              {!chatCtaHref && chatCtaDisabledReason ? (
                <p className="mt-2 text-xs text-white/60">{chatCtaDisabledReason}</p>
              ) : null}
            </div>
            {hostUnreadThreads.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-primary/20 bg-black/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">Guests needing replies</p>
                <ul className="mt-3 space-y-2">
                  {hostUnreadThreads.map((thread) => (
                    <li key={thread.joinRequestId} className="space-y-2">
                      <Link
                        href={`/chat/${thread.joinRequestId}`}
                        className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-white/5 p-3 text-left transition hover:border-primary/40"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white">{thread.displayName}</p>
                          <p className="text-xs text-white/70 line-clamp-2">{thread.lastMessageSnippet}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 text-[11px] text-white/60">
                          <span>{formatRelativeTime(thread.lastMessageAtISO)}</span>
                          {thread.unreadCount ? (
                            <span className="rounded-full bg-primary/30 px-2 py-0.5 text-primary">{thread.unreadCount} new</span>
                          ) : null}
                        </div>
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleMarkThreadAsRead(thread.joinRequestId)}
                        className="w-full rounded-xl border border-primary/30 px-3 py-2 text-xs font-semibold text-primary/80 transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={markingThreadId === thread.joinRequestId}
                      >
                        {markingThreadId === thread.joinRequestId ? "Marking…" : "Mark as read"}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="mt-4 flex items-center gap-2 text-xs text-white/50">
              <Shield className="h-3.5 w-3.5" />
              <span>Hosts can remove disruptive guests. Reports escalate to the safety team.</span>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

const Card = ({ children }: { children: ReactNode }) => (
  <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/30 backdrop-blur">
    {children}
  </div>
);

const SectionHeading = ({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  subtitle?: string;
}) => (
  <div className="flex items-center gap-3">
    <div className="rounded-2xl bg-white/10 p-2 text-white">
      <Icon className="h-4.5 w-4.5" />
    </div>
    <div>
      <p className="text-sm font-semibold text-white">{title}</p>
      {subtitle ? <p className="text-xs text-white/60">{subtitle}</p> : null}
    </div>
  </div>
);

const groupAttendees = (
  attendees: EventInsideExperienceProps["attendees"]
): Record<"confirmed" | "pending" | "waitlist", EventInsideExperienceProps["attendees"]> => {
  return attendees.reduce(
    (acc, attendee) => {
      acc[attendee.status].push(attendee);
      return acc;
    },
    { confirmed: [], pending: [], waitlist: [] } as Record<"confirmed" | "pending" | "waitlist", EventInsideExperienceProps["attendees"]>
  );
};

const buildStats = (
  event: EventInsideExperienceProps["event"],
  grouped: ReturnType<typeof groupAttendees>
): Array<{ label: string; value: string; subLabel?: string }> => {
  const confirmed = grouped.confirmed.length;
  const pending = grouped.pending.length;
  const waitlist = grouped.waitlist.length;
  return [
    {
      label: "Capacity",
      value: event.capacityLabel ?? `${confirmed} confirmed`,
      subLabel: pending > 0 ? `${pending} pending / ${waitlist} waitlisted` : undefined,
    },
    {
      label: "Host",
      value: "Manual approvals",
      subLabel: "Every request requires a host tap",
    },
    {
      label: "Safety",
      value: "Vetted guests",
      subLabel: "Reports + chat monitoring land here",
    },
  ];
};

const formatDateTime = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(date);
};

const formatRelativeTime = (value?: string | null) => {
  if (!value) return "moments ago";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "moments ago";
  const deltaMs = date.getTime() - Date.now();
  const deltaMinutes = Math.round(deltaMs / (1000 * 60));
  if (Math.abs(deltaMinutes) < 1) {
    return "just now";
  }
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(deltaMinutes) < 60) {
    return formatter.format(Math.round(deltaMinutes), "minute");
  }
  const deltaHours = Math.round(deltaMinutes / 60);
  if (Math.abs(deltaHours) < 24) {
    return formatter.format(deltaHours, "hour");
  }
  const deltaDays = Math.round(deltaHours / 24);
  return formatter.format(deltaDays, "day");
};

const readErrorPayload = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload && typeof payload.error === "string" && payload.error.trim().length > 0) {
      return payload.error.trim();
    }
  } catch {
    // Ignore JSON parsing issues and fall back to the default message.
  }
  return fallback;
};
