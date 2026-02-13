"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { CheckCircle2, Clock3, MapPin, MessageCircle, Shield, Sparkles, Users } from "lucide-react";

import UserAvatar from "@/components/UserAvatar";
import { useSocket } from "@/hooks/useSocket";
import { classNames } from "@/lib/classNames";
import type { SocketMessagePayload } from "@/lib/socket-shared";
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
    latestHostActivity?: {
      message: string;
      postedAtISO?: string | null;
      authorName?: string | null;
    };
    latestHostActivityFeed?: Array<{
      id: string;
      message: string;
      postedAtISO?: string | null;
      authorName?: string | null;
    }>;
    hostUnreadThreads?: Array<{
      joinRequestId: string;
      displayName: string;
      lastMessageSnippet: string;
      lastMessageAtISO?: string | null;
      unreadCount?: number | null;
    }>;
    guestComposer?: {
      joinRequestId?: string | null;
      disabledReason?: string | null;
    };
    hostActivityFeedPagination?: {
      hasMore: boolean;
      nextCursor?: string | null;
    };
    hostActivityLastSeenAt?: string | null;
  };
  /** JWT token for the realtime socket connection */
  socketToken?: string | null;
};

const viewerRoleCopy: Record<EventInsideExperienceProps["viewerRole"], { label: string; tone: string }> = {
  host: { label: "You are hosting", tone: "bg-amber-500/10 text-amber-700" },
  guest: { label: "You are confirmed", tone: "bg-emerald-500/10 text-emerald-600" },
  pending: { label: "Awaiting host approval", tone: "bg-sky-500/10 text-sky-600" },
};

const quickReplyTemplates: Array<{ label: string; message: string }> = [
  {
    label: "On my way",
    message: "Hey! Saw your ping — I'm on my way to the venue and will update you as soon as I'm there.",
  },
  {
    label: "Details sent",
    message: "Just dropped all the meetup details in chat. Let me know if anything's unclear!",
  },
  {
    label: "Reply soon",
    message: "Got your message and will circle back in a couple minutes. Appreciate the patience!",
  },
];

const HOST_ANNOUNCEMENT_MAX_LENGTH = 1000;

const HOST_ACTIVITY_SCROLL_THRESHOLD = 16;

type JoinRequestActionState = "approving" | "rejecting";
type HostUnreadThread = NonNullable<NonNullable<EventInsideExperienceProps["chatPreview"]>["hostUnreadThreads"]>[number];

export function EventInsideExperience({
  event,
  host,
  attendees,
  joinRequests,
  viewerRole,
  chatPreview,
  socketToken,
}: EventInsideExperienceProps) {
  const [pendingRequests, setPendingRequests] = useState(joinRequests);
  const [roster, setRoster] = useState(attendees);
  const [requestActionState, setRequestActionState] = useState<Record<string, JoinRequestActionState | undefined>>({});
  const [hostUnreadThreads, setHostUnreadThreads] = useState<HostUnreadThread[]>(chatPreview?.hostUnreadThreads ?? []);
  const [markingThreadId, setMarkingThreadId] = useState<string | null>(null);

  const [quickReplyState, setQuickReplyState] = useState<Record<string, "sending" | undefined>>({});
  const [inlineComposerState, setInlineComposerState] = useState<Record<string, { value: string; status?: "sending" }>>({});
  const guestComposerConfig = viewerRole === "guest" ? chatPreview?.guestComposer : undefined;
  const [guestComposerValue, setGuestComposerValue] = useState("");
  const [guestComposerStatus, setGuestComposerStatus] = useState<"idle" | "sending">("idle");
  const isHostViewer = viewerRole === "host";
  const isGuestViewer = viewerRole === "guest";
  const hostActivityListRef = useRef<HTMLUListElement | null>(null);
  const [hasHostActivityNotice, setHasHostActivityNotice] = useState(false);
  const initialHostActivityEntries: Array<{ id: string; message: string; postedAtISO?: string | null; authorName?: string | null }> = useMemo(
    () =>
      isGuestViewer
        ? chatPreview?.latestHostActivityFeed && chatPreview.latestHostActivityFeed.length > 0
          ? chatPreview.latestHostActivityFeed
          : chatPreview?.latestHostActivity
            ? [
                {
                  id: "latest-host-activity",
                  message: chatPreview.latestHostActivity.message,
                  postedAtISO: chatPreview.latestHostActivity.postedAtISO,
                  authorName: chatPreview.latestHostActivity.authorName ?? host.displayName,
                },
              ]
            : []
        : [],
    [chatPreview?.latestHostActivity, chatPreview?.latestHostActivityFeed, host.displayName, isGuestViewer]
  );
  const [hostActivityEntries, setHostActivityEntries] = useState(initialHostActivityEntries);
  const [hostActivityPagination, setHostActivityPagination] = useState(chatPreview?.hostActivityFeedPagination);
  const [hostActivityLoading, setHostActivityLoading] = useState(false);
  const [hostActivityLastSeenAt, setHostActivityLastSeenAt] = useState(chatPreview?.hostActivityLastSeenAt ?? null);
  const [hostActivityCursorStatus, setHostActivityCursorStatus] = useState<"idle" | "saving">("idle");
  const [hostAnnouncementValue, setHostAnnouncementValue] = useState("");
  const [hostAnnouncementStatus, setHostAnnouncementStatus] = useState<"idle" | "sending">("idle");
  const guestJoinRequestId = guestComposerConfig?.joinRequestId?.trim() || null;
  const realtimeHostActivityEnabled = Boolean(socketToken && isGuestViewer && guestJoinRequestId);
  const latestHostActivityTimestamp = hostActivityEntries.length ? hostActivityEntries[0]?.postedAtISO ?? null : null;

  useEffect(() => {
    setPendingRequests(joinRequests);
  }, [joinRequests]);

  useEffect(() => {
    setRoster(attendees);
  }, [attendees]);

  useEffect(() => {
    setHostUnreadThreads(chatPreview?.hostUnreadThreads ?? []);
  }, [chatPreview?.hostUnreadThreads]);

  useEffect(() => {
    setInlineComposerState((prev) => {
      const activeIds = new Set(hostUnreadThreads.map((thread) => thread.joinRequestId));
      let mutated = false;
      const next = { ...prev };
      for (const key of Object.keys(prev)) {
        if (!activeIds.has(key)) {
          delete next[key];
          mutated = true;
        }
      }
      return mutated ? next : prev;
    });
  }, [hostUnreadThreads]);

  useEffect(() => {
    setGuestComposerValue("");
    setGuestComposerStatus("idle");
  }, [guestComposerConfig?.joinRequestId]);

  useEffect(() => {
    setHostActivityEntries(initialHostActivityEntries);
    setHostActivityPagination(chatPreview?.hostActivityFeedPagination);
  }, [initialHostActivityEntries, chatPreview?.hostActivityFeedPagination]);

  useEffect(() => {
    setHostActivityLastSeenAt(chatPreview?.hostActivityLastSeenAt ?? null);
  }, [chatPreview?.hostActivityLastSeenAt]);

  useEffect(() => {
    if (!isGuestViewer) {
      setHasHostActivityNotice((prev) => (prev ? false : prev));
      return;
    }

    if (hostActivityCursorStatus === "saving") {
      return;
    }

    if (!latestHostActivityTimestamp) {
      setHasHostActivityNotice((prev) => (prev ? false : prev));
      return;
    }

    const latestTime = parseIsoTimestamp(latestHostActivityTimestamp);
    const seenTime = parseIsoTimestamp(hostActivityLastSeenAt);
    if (!latestTime) {
      return;
    }

    const shouldShow = !seenTime || latestTime > seenTime;
    setHasHostActivityNotice((prev) => (prev === shouldShow ? prev : shouldShow));
  }, [hostActivityCursorStatus, hostActivityLastSeenAt, isGuestViewer, latestHostActivityTimestamp]);

  const acknowledgeHostActivityUpdates = useCallback(
    async (timestamp?: string | null) => {
      const targetTimestamp = timestamp ?? latestHostActivityTimestamp;
      if (!isGuestViewer || hostActivityCursorStatus === "saving" || !targetTimestamp) {
        return;
      }

      setHostActivityCursorStatus("saving");
      try {
        const response = await fetch(`/api/events/${event.id}/host-activity`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ lastSeenAt: targetTimestamp }),
        });

        if (!response.ok) {
          const message = await readErrorPayload(response, "Unable to update host activity status.");
          throw new Error(message);
        }

        const payload = (await response.json()) as { lastSeenAt?: string | null };
        const nextTimestamp = payload.lastSeenAt ?? targetTimestamp;
        setHostActivityLastSeenAt(nextTimestamp);
        setHasHostActivityNotice(false);
      } catch (error) {
        const message = (error as Error)?.message ?? "Unable to update host activity status.";
        showErrorToast("Update failed", message);
        setHasHostActivityNotice(true);
      } finally {
        setHostActivityCursorStatus("idle");
      }
    },
    [event.id, hostActivityCursorStatus, isGuestViewer, latestHostActivityTimestamp]
  );

  useEffect(() => {
    const listEl = hostActivityListRef.current;
    if (!listEl) {
      return;
    }

    const handleScroll = () => {
      const scrolled = listEl.scrollTop > HOST_ACTIVITY_SCROLL_THRESHOLD;
      if (!scrolled && hasHostActivityNotice) {
        setHasHostActivityNotice(false);
        void acknowledgeHostActivityUpdates(latestHostActivityTimestamp);
      }
    };

    listEl.addEventListener("scroll", handleScroll);
    return () => {
      listEl.removeEventListener("scroll", handleScroll);
    };
  }, [acknowledgeHostActivityUpdates, hasHostActivityNotice, hostActivityEntries.length, latestHostActivityTimestamp]);

  const groupedAttendees = useMemo(() => groupAttendees(roster), [roster]);
  const stats = useMemo(() => buildStats(event, groupedAttendees), [event, groupedAttendees]);
  const chatCtaLabel = chatPreview?.ctaLabel ?? "Open chat";
  const rawChatHref = chatPreview?.ctaHref ?? "";
  const chatCtaHref = rawChatHref.trim() ? rawChatHref.trim() : null;
  const chatCtaDisabledReason = chatPreview?.ctaDisabledReason;

  const hostActivityListShouldScroll = hostActivityEntries.length > 3;
  const hostActivityListClasses = classNames(
    "mt-3 space-y-3",
    hostActivityListShouldScroll ? "max-h-64 overflow-y-auto pr-1" : null
  );

  const hostActivityDividerIndex = useMemo(() => {
    if (!isGuestViewer || !hostActivityLastSeenAt || hostActivityEntries.length === 0) {
      return null;
    }

    const lastSeenTimestamp = parseIsoTimestamp(hostActivityLastSeenAt);
    if (!lastSeenTimestamp) {
      return null;
    }

    let hasNewerEntries = false;
    for (let index = 0; index < hostActivityEntries.length; index += 1) {
      const entry = hostActivityEntries[index];
      const entryTimestamp = parseIsoTimestamp(entry?.postedAtISO);

      if (!entryTimestamp) {
        continue;
      }

      if (entryTimestamp > lastSeenTimestamp) {
        hasNewerEntries = true;
        continue;
      }

      if (hasNewerEntries) {
        return index;
      }

      return null;
    }

    return null;
  }, [hostActivityEntries, hostActivityLastSeenAt, isGuestViewer]);

  const scrollHostActivityToTop = useCallback(() => {
    const listEl = hostActivityListRef.current;
    if (!listEl) {
      return;
    }

    if (typeof listEl.scrollTo === "function") {
      listEl.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      listEl.scrollTop = 0;
    }
    setHasHostActivityNotice(false);
  }, []);

  const handleRealtimeHostActivity = useCallback(
    (payload: SocketMessagePayload) => {
      if (!realtimeHostActivityEnabled || !guestJoinRequestId) {
        return;
      }

      if (payload.joinRequestId !== guestJoinRequestId || payload.senderId !== host.id) {
        return;
      }

      setHostActivityEntries((prev) => {
        if (prev.some((entry) => entry.id === payload.id)) {
          return prev;
        }
        const nextEntry = {
          id: payload.id,
          message: payload.content,
          postedAtISO: payload.createdAt,
          authorName: host.displayName ?? host.email ?? "Host",
        };
        const listEl = hostActivityListRef.current;
        const scrolledAway = listEl ? listEl.scrollTop > HOST_ACTIVITY_SCROLL_THRESHOLD : false;
        if (scrolledAway) {
          setHasHostActivityNotice(true);
        } else {
          scrollHostActivityToTop();
          void acknowledgeHostActivityUpdates(payload.createdAt ?? latestHostActivityTimestamp);
        }
        return [nextEntry, ...prev];
      });
    },
    [
      acknowledgeHostActivityUpdates,
      guestJoinRequestId,
      host.displayName,
      host.email,
      host.id,
      latestHostActivityTimestamp,
      realtimeHostActivityEnabled,
    ]
  );

  const { isConnected, joinRoom } = useSocket({
    token: realtimeHostActivityEnabled ? socketToken ?? undefined : undefined,
    autoConnect: realtimeHostActivityEnabled,
    readinessEndpoint: "/api/socket/io",
    onMessage: realtimeHostActivityEnabled ? handleRealtimeHostActivity : undefined,
  });

  useEffect(() => {
    if (!realtimeHostActivityEnabled || !isConnected || !guestJoinRequestId) {
      return;
    }
    joinRoom(guestJoinRequestId);
  }, [guestJoinRequestId, isConnected, joinRoom, realtimeHostActivityEnabled]);

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

  const sendMessageToThread = async ({
    joinRequestId,
    message,
    fallback = "Unable to send this message.",
  }: {
    joinRequestId: string;
    message: string;
    fallback?: string;
  }) => {
    const response = await fetch(`/api/chat/${joinRequestId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: message }),
    });

    if (!response.ok) {
      const messagePayload = await readErrorPayload(response, fallback);
      throw new Error(messagePayload);
    }

    try {
      const markResponse = await fetch(`/api/chat/${joinRequestId}/mark-read`, {
        method: "POST",
      });
      if (!markResponse.ok) {
        console.error("Unable to mark thread as read after sending message", await markResponse.text());
      }
    } catch (markError) {
      console.error("Message mark-read follow-up failed", markError);
    }

    setHostUnreadThreads((prev) => prev.filter((thread) => thread.joinRequestId !== joinRequestId));
  };

  const handleQuickReplySend = async (joinRequestId: string, message: string) => {
    const fallback = "Unable to send this quick reply.";
    setQuickReplyState((prev) => ({
      ...prev,
      [joinRequestId]: "sending",
    }));

    try {
      await sendMessageToThread({ joinRequestId, message, fallback });
      showSuccessToast("Reply sent");
    } catch (error) {
      const messagePayload = (error as Error)?.message ?? fallback;
      showErrorToast("Reply failed", messagePayload);
    } finally {
      setQuickReplyState((prev) => {
        const next = { ...prev };
        delete next[joinRequestId];
        return next;
      });
    }
  };

  const handleInlineComposerChange = (joinRequestId: string, value: string) => {
    setInlineComposerState((prev) => ({
      ...prev,
      [joinRequestId]: {
        value,
        status: prev[joinRequestId]?.status,
      },
    }));
  };

  const handleInlineComposerClear = (joinRequestId: string) => {
    setInlineComposerState((prev) => {
      if (!prev[joinRequestId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[joinRequestId];
      return next;
    });
  };

  const handleInlineComposerSend = async (joinRequestId: string) => {
    const entry = inlineComposerState[joinRequestId];
    const rawValue = entry?.value ?? "";
    const trimmed = rawValue.trim();
    if (!trimmed) {
      showErrorToast("Message required", "Type a message before sending.");
      return;
    }

    setInlineComposerState((prev) => ({
      ...prev,
      [joinRequestId]: {
        value: rawValue,
        status: "sending",
      },
    }));

    const fallback = "Unable to send this reply.";
    try {
      await sendMessageToThread({ joinRequestId, message: trimmed, fallback });
      showSuccessToast("Reply sent");
      setInlineComposerState((prev) => {
        const next = { ...prev };
        delete next[joinRequestId];
        return next;
      });
    } catch (error) {
      const messagePayload = (error as Error)?.message ?? fallback;
      showErrorToast("Reply failed", messagePayload);
      setInlineComposerState((prev) => ({
        ...prev,
        [joinRequestId]: {
          value: rawValue,
          status: undefined,
        },
      }));
    }
  };

  const handleGuestComposerSend = async () => {
    if (!guestComposerConfig?.joinRequestId) {
      showErrorToast("Chat unavailable", "You cannot message this event right now.");
      return;
    }

    const trimmed = guestComposerValue.trim();
    if (!trimmed) {
      showErrorToast("Message required", "Type a message before sending.");
      return;
    }

    setGuestComposerStatus("sending");
    const fallback = "Unable to send this message.";

    try {
      await sendMessageToThread({
        joinRequestId: guestComposerConfig.joinRequestId,
        message: trimmed,
        fallback,
      });
      showSuccessToast("Message sent");
      setGuestComposerValue("");
    } catch (error) {
      const messagePayload = (error as Error)?.message ?? fallback;
      showErrorToast("Message failed", messagePayload);
    } finally {
      setGuestComposerStatus("idle");
    }
  };

  const handleHostAnnouncementSend = async () => {
    if (!isHostViewer) {
      showErrorToast("Announcement unavailable", "Only hosts can publish announcements.");
      return;
    }

    const trimmed = hostAnnouncementValue.trim();
    if (!trimmed) {
      showErrorToast("Message required", "Type an announcement before publishing.");
      return;
    }

    const fallback = "Unable to publish this announcement.";
    setHostAnnouncementStatus("sending");

    try {
      const response = await fetch(`/api/events/${event.id}/host-activity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!response.ok) {
        const message = await readErrorPayload(response, fallback);
        throw new Error(message);
      }

      showSuccessToast("Announcement published");
      setHostAnnouncementValue("");
    } catch (error) {
      const message = (error as Error)?.message ?? fallback;
      showErrorToast("Publish failed", message);
    } finally {
      setHostAnnouncementStatus("idle");
    }
  };

  const handleLoadMoreHostUpdates = async () => {
    if (!isGuestViewer || hostActivityLoading || !hostActivityPagination?.hasMore) {
      return;
    }

    setHostActivityLoading(true);
    const fallback = "Unable to load more host updates.";
    const before = hostActivityPagination?.nextCursor;
    const query = before ? `?before=${encodeURIComponent(before)}` : "";

    try {
      const response = await fetch(`/api/events/${event.id}/host-activity${query}`);
      if (!response.ok) {
        const message = await readErrorPayload(response, fallback);
        throw new Error(message);
      }

      const payload = (await response.json()) as {
        updates?: Array<{ id: string; message: string; postedAtISO?: string | null; authorName?: string | null }>;
        hasMore?: boolean;
        nextCursor?: string | null;
      };

      setHostActivityEntries((prev) => [...prev, ...(payload.updates ?? [])]);
      if (payload?.hasMore) {
        setHostActivityPagination({ hasMore: true, nextCursor: payload.nextCursor ?? null });
      } else {
        setHostActivityPagination({ hasMore: false, nextCursor: null });
      }
    } catch (error) {
      const message = (error as Error)?.message ?? fallback;
      showErrorToast("Load failed", message);
    } finally {
      setHostActivityLoading(false);
    }
  };

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
            {hostActivityEntries.length > 0 ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
                  {hostActivityEntries.length > 1 ? "Host updates" : "Latest host update"}
                </p>
                {hasHostActivityNotice ? (
                  <div className="mt-3 flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        scrollHostActivityToTop();
                        void acknowledgeHostActivityUpdates(latestHostActivityTimestamp);
                      }}
                      disabled={hostActivityCursorStatus === "saving"}
                      className="inline-flex items-center gap-2 rounded-full bg-primary/20 px-3 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60 disabled:opacity-60"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                      {hostActivityCursorStatus === "saving" ? "Marking seen…" : "New update · Jump to latest"}
                    </button>
                  </div>
                ) : null}
                <ul
                  ref={hostActivityListRef}
                  data-testid="host-updates-list"
                  className={hostActivityListClasses}
                >
                  {hostActivityEntries.map((activity, index) => (
                    <Fragment key={activity.id}>
                      {hostActivityDividerIndex === index ? (
                        <li className="relative flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-primary/80">
                          <span className="h-px flex-1 rounded-full bg-primary/30" aria-hidden />
                          <span>New since you last checked</span>
                          <span className="h-px flex-1 rounded-full bg-primary/30" aria-hidden />
                        </li>
                      ) : null}
                      <li className="rounded-xl border border-white/5 bg-white/5 p-3">
                        <p className="text-sm text-white/80">{activity.message}</p>
                        <p className="mt-2 text-xs text-white/50">
                          {activity.authorName ?? host.displayName}
                          {" · "}
                          {formatRelativeTime(activity.postedAtISO)}
                        </p>
                      </li>
                    </Fragment>
                  ))}
                </ul>
                {hostActivityPagination?.hasMore ? (
                  <button
                    type="button"
                    onClick={handleLoadMoreHostUpdates}
                    className="mt-4 w-full rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold text-white/80 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={hostActivityLoading}
                  >
                    {hostActivityLoading ? "Loading…" : "See earlier updates"}
                  </button>
                ) : null}
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
            {isHostViewer ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Broadcast to guests</p>
                <p className="mt-1 text-xs text-white/60">
                  Share schedule changes or arrival info. Accepted guests see these inside their Host updates feed.
                </p>
                <textarea
                  rows={3}
                  value={hostAnnouncementValue}
                  onChange={(event) => setHostAnnouncementValue(event.target.value)}
                  placeholder="Post an announcement (multi-line supported)"
                  maxLength={HOST_ANNOUNCEMENT_MAX_LENGTH}
                  className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  disabled={hostAnnouncementStatus === "sending"}
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleHostAnnouncementSend}
                    className="rounded-xl bg-primary/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={hostAnnouncementStatus === "sending" || hostAnnouncementValue.trim().length === 0}
                  >
                    {hostAnnouncementStatus === "sending" ? "Publishing…" : "Publish announcement"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setHostAnnouncementValue("")}
                    className="text-xs font-semibold text-white/60 transition hover:text-white"
                    disabled={hostAnnouncementStatus === "sending" || hostAnnouncementValue.length === 0}
                  >
                    Clear
                  </button>
                  <span className="ml-auto text-[11px] text-white/50">
                    {hostAnnouncementValue.length}/{HOST_ANNOUNCEMENT_MAX_LENGTH}
                  </span>
                </div>
              </div>
            ) : null}
            {viewerRole === "guest" && guestComposerConfig ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Message the host</p>
                <p className="mt-1 text-xs text-white/60">Send a quick update without leaving this screen.</p>
                <textarea
                  rows={3}
                  value={guestComposerValue}
                  onChange={(event) => setGuestComposerValue(event.target.value)}
                  placeholder="Share an update or ask a quick question"
                  className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  disabled={
                    guestComposerStatus === "sending" ||
                    Boolean(guestComposerConfig.disabledReason) ||
                    !guestComposerConfig.joinRequestId
                  }
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGuestComposerSend}
                    className="rounded-xl bg-primary/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={
                      guestComposerStatus === "sending" ||
                      Boolean(guestComposerConfig.disabledReason) ||
                      !guestComposerConfig.joinRequestId ||
                      guestComposerValue.trim().length === 0
                    }
                  >
                    {guestComposerStatus === "sending" ? "Sending…" : "Send message"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuestComposerValue("")}
                    className="text-xs font-semibold text-white/60 transition hover:text-white"
                    disabled={guestComposerStatus === "sending" || guestComposerValue.length === 0}
                  >
                    Clear
                  </button>
                </div>
                {guestComposerConfig.disabledReason ? (
                  <p className="mt-2 text-xs text-white/60">{guestComposerConfig.disabledReason}</p>
                ) : null}
              </div>
            ) : null}
            {hostUnreadThreads.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-primary/20 bg-black/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">Guests needing replies</p>
                <ul className="mt-3 space-y-2">
                  {hostUnreadThreads.map((thread) => {
                    const composerEntry = inlineComposerState[thread.joinRequestId];
                    const composerValue = composerEntry?.value ?? "";
                    const composerSending = composerEntry?.status === "sending";
                    const composerSendDisabled = composerSending || composerValue.trim().length === 0;
                    const quickReplyBusy = quickReplyState[thread.joinRequestId] === "sending";

                    return (
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
                        <div className="rounded-xl bg-white/5 p-2 text-xs text-white/70 space-y-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Quick replies</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {quickReplyTemplates.map((template) => (
                                <button
                                  key={template.label}
                                  type="button"
                                  onClick={() => handleQuickReplySend(thread.joinRequestId, template.message)}
                                  className="rounded-lg border border-primary/30 px-3 py-1 text-[11px] font-semibold text-primary/80 transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                                  disabled={quickReplyBusy}
                                >
                                  {quickReplyBusy ? "Sending…" : template.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Custom reply</p>
                            <textarea
                              rows={2}
                              value={composerValue}
                              onChange={(event) => handleInlineComposerChange(thread.joinRequestId, event.target.value)}
                              placeholder="Type a custom reply"
                              className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/40 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
                              disabled={composerSending}
                            />
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleInlineComposerSend(thread.joinRequestId)}
                                className="rounded-lg bg-primary/80 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={composerSendDisabled}
                              >
                                {composerSending ? "Sending…" : "Send reply"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleInlineComposerClear(thread.joinRequestId)}
                                className="text-[11px] font-semibold text-white/60 transition hover:text-white"
                                disabled={composerSending || composerValue.length === 0}
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleMarkThreadAsRead(thread.joinRequestId)}
                          className="w-full rounded-xl border border-primary/30 px-3 py-2 text-xs font-semibold text-primary/80 transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={markingThreadId === thread.joinRequestId}
                        >
                          {markingThreadId === thread.joinRequestId ? "Marking…" : "Mark as read"}
                        </button>
                      </li>
                    );
                  })}
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

const parseIsoTimestamp = (value?: string | null): number | null => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
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
