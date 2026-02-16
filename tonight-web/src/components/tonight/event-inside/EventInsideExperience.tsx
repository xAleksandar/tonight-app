"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { CheckCircle2, Clock3, Copy, MapPin, MessageCircle, Share2, Shield, Sparkles, Users } from "lucide-react";

import UserAvatar from "@/components/UserAvatar";
import { useSocket } from "@/hooks/useSocket";
import { classNames } from "@/lib/classNames";
import type { SocketMessagePayload, JoinRequestStatusChangedPayload } from "@/lib/socket-shared";
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
  viewerRole: "host" | "guest" | "pending" | "public";
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
    guestMessagePreview?: Array<{
      id: string;
      authorName: string;
      authorAvatarUrl?: string | null;
      content: string;
      postedAtISO?: string | null;
      isViewer?: boolean;
    }>;
    hostActivityFeedPagination?: {
      hasMore: boolean;
      nextCursor?: string | null;
    };
    hostActivityLastSeenAt?: string | null;
  };
  hostFriendInvites?: Array<{
    joinRequestId: string;
    userId: string;
    displayName: string;
    avatarUrl?: string | null;
    lastEventTitle?: string | null;
    lastInteractionAtISO?: string | null;
    lastInviteAtISO?: string | null;
    nextInviteAvailableAtISO?: string | null;
    currentEventInviteAtISO?: string | null;
  }>;
  /** JWT token for the realtime socket connection */
  socketToken?: string | null;
  /** Join request ID for pending guests to receive approval notifications */
  pendingJoinRequestId?: string | null;
};

const viewerRoleCopy: Record<EventInsideExperienceProps["viewerRole"], { label: string; tone: string }> = {
  host: { label: "You are hosting", tone: "bg-amber-500/10 text-amber-700" },
  guest: { label: "You are confirmed", tone: "bg-emerald-500/10 text-emerald-600" },
  pending: { label: "Awaiting host approval", tone: "bg-sky-500/10 text-sky-600" },
  public: { label: "Event details", tone: "bg-slate-500/10 text-slate-400" },
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

const HOST_FRIEND_INVITE_COOLDOWN_MS = 15 * 60 * 1000;

type HostFriendInviteTemplateId = "save-spot" | "last-minute" | "vibe-match";

type HostFriendInviteTemplateDefinition = {
  id: HostFriendInviteTemplateId;
  label: string;
  helperCopy: string;
  buildSegments: (context: HostFriendInviteTemplateBuildContext) => Array<string | null | undefined>;
};

type HostFriendInviteTemplateBuildContext = {
  firstName: string;
  eventTitle: string;
  eventMomentLabel?: string | null;
  eventLocationLabel?: string | null;
  eventShareUrl: string;
};

type HostFriendInviteTemplateOption = {
  id: HostFriendInviteTemplateId;
  label: string;
  helperCopy: string;
  buildMessage: (displayName: string) => string;
};

const HOST_FRIEND_INVITE_TEMPLATE_DEFINITIONS: HostFriendInviteTemplateDefinition[] = [
  {
    id: "save-spot",
    label: "Save you a spot",
    helperCopy: "Great for personal invites when you want to reserve a seat for someone specific.",
    buildSegments: ({ firstName, eventTitle, eventMomentLabel, eventLocationLabel, eventShareUrl }) => [
      `Hey ${firstName}!`,
      `I'm hosting \"${eventTitle}\" tonight.`,
      eventMomentLabel ? `It starts ${eventMomentLabel}.` : null,
      eventLocationLabel ? `We're meeting near ${eventLocationLabel}.` : null,
      `Want me to save you a spot? Request access on Tonight: ${eventShareUrl}`,
    ],
  },
  {
    id: "last-minute",
    label: "Last-minute seat",
    helperCopy: "Use when a spot opens close to doors and you need a fast reply.",
    buildSegments: ({ firstName, eventTitle, eventMomentLabel, eventShareUrl }) => [
      `Quick ping for you, ${firstName}.`,
      `A spot just opened for \"${eventTitle}\"${eventMomentLabel ? ` (${eventMomentLabel})` : ""}.`,
      `If you're free, tap this Tonight link and I'll fast-pass you: ${eventShareUrl}`,
    ],
  },
  {
    id: "vibe-match",
    label: "This vibe is yours",
    helperCopy: "Sell the vibe when you know they'd mesh with the crowd.",
    buildSegments: ({ firstName, eventTitle, eventMomentLabel, eventLocationLabel, eventShareUrl }) => [
      `${firstName}, this night's vibe is totally you.`,
      `We're calling it \"${eventTitle}\"${eventMomentLabel ? ` (${eventMomentLabel})` : ""}${eventLocationLabel ? ` near ${eventLocationLabel}` : ""}.`,
      `Jump in via Tonight so I can add you: ${eventShareUrl}`,
    ],
  },
];

const DEFAULT_HOST_FRIEND_TEMPLATE_ID: HostFriendInviteTemplateId = "save-spot";

type HostFriendInviteEntry = NonNullable<EventInsideExperienceProps["hostFriendInvites"]>[number];

type HostFriendSelectionBlockedEntry = {
  friend: HostFriendInviteEntry;
  reason: string;
  type: "cooldown" | "event";
  nextInviteAvailableAtISO?: string | null;
  currentEventInviteAtISO?: string | null;
  eventInviteOverrideAvailable: boolean;
  eventInviteCoolingDown: boolean;
};

type HostFriendSelectionEligibility = {
  eligible: boolean;
  blockedEntry?: HostFriendSelectionBlockedEntry;
};

type JoinRequestActionState = "approving" | "rejecting";
type HostUnreadThread = NonNullable<NonNullable<EventInsideExperienceProps["chatPreview"]>["hostUnreadThreads"]>[number];

type HostFriendInviteDispatchResult = { joinRequestId: string; status: "sent" | "failed"; error?: string };

type HostFriendInviteGuardrailState = Record<string, { lastInviteAtISO: string | null; nextInviteAvailableAtISO: string | null }>;

type HostFriendSelectionSummary = {
  sentCount: number;
  skippedCount: number;
  failedCount: number;
  timestampISO: string;
};

export function EventInsideExperience({
  event,
  host,
  attendees,
  joinRequests,
  viewerRole,
  chatPreview,
  hostFriendInvites,
  socketToken,
  pendingJoinRequestId,
}: EventInsideExperienceProps) {
  const [pendingRequests, setPendingRequests] = useState(joinRequests);
  const [roster, setRoster] = useState(attendees);
  const [requestActionState, setRequestActionState] = useState<Record<string, JoinRequestActionState | undefined>>({});
  const [hostUnreadThreads, setHostUnreadThreads] = useState<HostUnreadThread[]>(chatPreview?.hostUnreadThreads ?? []);
  const [markingThreadId, setMarkingThreadId] = useState<string | null>(null);
  const [eventShareUrl, setEventShareUrl] = useState<string | null>(null);
  const [eventShareCopyState, setEventShareCopyState] = useState<"idle" | "copying" | "copied">("idle");
  const [eventShareShareState, setEventShareShareState] = useState<"idle" | "sharing">("idle");
  const [eventShareSupported, setEventShareSupported] = useState(false);
  const [hostFriendSearchValue, setHostFriendSearchValue] = useState("");
  const [hostFriendComposerState, setHostFriendComposerState] = useState<Record<string, { value: string; status?: "sending" }>>({});
  const [hostFriendSelectionState, setHostFriendSelectionState] = useState<Record<string, boolean>>({});
  const [hostFriendSelectionStatus, setHostFriendSelectionStatus] = useState<"idle" | "sending">("idle");
  const [hostFriendSelectionSkippedExpanded, setHostFriendSelectionSkippedExpanded] = useState(false);
  const [hostFriendSelectionSkippedHistory, setHostFriendSelectionSkippedHistory] = useState<string[]>([]);
  const [hostFriendInviteGuardrails, setHostFriendInviteGuardrails] = useState<HostFriendInviteGuardrailState>({});
  const [hostFriendEventInviteState, setHostFriendEventInviteState] = useState<Record<string, string | null>>({});
  const [hostFriendEventInviteOverrides, setHostFriendEventInviteOverrides] = useState<Record<string, string | null>>({});
  const [hostFriendSelectionSummary, setHostFriendSelectionSummary] = useState<HostFriendSelectionSummary | null>(null);

  const [hostFriendTemplateId, setHostFriendTemplateId] = useState<HostFriendInviteTemplateId>(DEFAULT_HOST_FRIEND_TEMPLATE_ID);

  const hostFriendTemplateSelectId = "host-friend-template-select";
  const hostFriendSearchInputId = "host-friend-search-input";

  const [quickReplyState, setQuickReplyState] = useState<Record<string, "sending" | undefined>>({});
  const [inlineComposerState, setInlineComposerState] = useState<Record<string, { value: string; status?: "sending" }>>({});
  const guestComposerConfig = viewerRole === "guest" ? chatPreview?.guestComposer : undefined;
  const guestMessagePreviewEntries = viewerRole === "guest" ? chatPreview?.guestMessagePreview ?? [] : [];
  const [guestComposerValue, setGuestComposerValue] = useState("");
  const [guestComposerStatus, setGuestComposerStatus] = useState<"idle" | "sending">("idle");
  const [joinRequestStatus, setJoinRequestStatus] = useState<"idle" | "submitting" | "submitted">("idle");
  const isHostViewer = viewerRole === "host";
  const isGuestViewer = viewerRole === "guest";
  const isPendingViewer = viewerRole === "pending";
  const isPublicViewer = viewerRole === "public";
  const hostFriendInviteEntries = useMemo(
    () => (isHostViewer ? hostFriendInvites ?? [] : []),
    [isHostViewer, hostFriendInvites]
  );
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
  const hostActivityLastSeenTimestamp = useMemo(() => parseIsoTimestamp(hostActivityLastSeenAt), [hostActivityLastSeenAt]);
  const [hostActivityCursorStatus, setHostActivityCursorStatus] = useState<"idle" | "saving">("idle");
  const [hostAnnouncementValue, setHostAnnouncementValue] = useState("");
  const [hostAnnouncementStatus, setHostAnnouncementStatus] = useState<"idle" | "sending">("idle");
  const guestJoinRequestId = guestComposerConfig?.joinRequestId?.trim() || null;
  const realtimeHostActivityEnabled = Boolean(socketToken && isGuestViewer && guestJoinRequestId);
  const realtimeJoinApprovalEnabled = Boolean(socketToken && isPendingViewer && pendingJoinRequestId);
  const activeJoinRequestId = guestJoinRequestId || pendingJoinRequestId || null;
  const socketEnabled = realtimeHostActivityEnabled || realtimeJoinApprovalEnabled;
  const latestHostActivityTimestamp = hostActivityEntries.length ? hostActivityEntries[0]?.postedAtISO ?? null : null;
  const eventInviteShareText = useMemo(() => buildEventInviteShareText(event), [event]);

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
    if (!hostFriendInviteEntries.length) {
      setHostFriendComposerState({});
      return;
    }

    setHostFriendComposerState((prev) => {
      const activeIds = new Set(hostFriendInviteEntries.map((entry) => entry.joinRequestId));
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
  }, [hostFriendInviteEntries]);

  useEffect(() => {
    if (!hostFriendInviteEntries.length) {
      setHostFriendSelectionState({});
      return;
    }

    setHostFriendSelectionState((prev) => {
      const activeIds = new Set(hostFriendInviteEntries.map((entry) => entry.joinRequestId));
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
  }, [hostFriendInviteEntries]);

  useEffect(() => {
    if (!hostFriendInviteEntries.length) {
      setHostFriendSelectionSummary(null);
    }
  }, [hostFriendInviteEntries.length]);

  useEffect(() => {
    if (!hostFriendInviteEntries.length) {
      setHostFriendInviteGuardrails({});
      return;
    }

    setHostFriendInviteGuardrails((prev) => {
      const next: HostFriendInviteGuardrailState = { ...prev };
      const activeIds = new Set(hostFriendInviteEntries.map((entry) => entry.joinRequestId));
      let mutated = false;

      for (const key of Object.keys(next)) {
        if (!activeIds.has(key)) {
          delete next[key];
          mutated = true;
        }
      }

      for (const entry of hostFriendInviteEntries) {
        const incoming = {
          lastInviteAtISO: entry.lastInviteAtISO ?? null,
          nextInviteAvailableAtISO: entry.nextInviteAvailableAtISO ?? null,
        };
        const existing = next[entry.joinRequestId];
        if (
          !existing ||
          existing.lastInviteAtISO !== incoming.lastInviteAtISO ||
          existing.nextInviteAvailableAtISO !== incoming.nextInviteAvailableAtISO
        ) {
          next[entry.joinRequestId] = incoming;
          mutated = true;
        }
      }

      return mutated ? next : prev;
    });
  }, [hostFriendInviteEntries]);

  useEffect(() => {
    if (!hostFriendInviteEntries.length) {
      setHostFriendEventInviteState({});
      return;
    }

    setHostFriendEventInviteState((prev) => {
      const next: Record<string, string | null> = {};
      for (const entry of hostFriendInviteEntries) {
        const incoming = entry.currentEventInviteAtISO ?? null;
        const previous = prev[entry.joinRequestId] ?? null;

        if (incoming && previous) {
          const incomingTime = parseIsoTimestamp(incoming)?.getTime() ?? 0;
          const previousTime = parseIsoTimestamp(previous)?.getTime() ?? 0;
          next[entry.joinRequestId] = incomingTime >= previousTime ? incoming : previous;
        } else if (incoming) {
          next[entry.joinRequestId] = incoming;
        } else if (previous) {
          next[entry.joinRequestId] = previous;
        } else {
          next[entry.joinRequestId] = null;
        }
      }
      return next;
    });
  }, [hostFriendInviteEntries]);

  useEffect(() => {
    if (!hostFriendInviteEntries.length) {
      setHostFriendEventInviteOverrides({});
      return;
    }

    setHostFriendEventInviteOverrides((prev) => {
      const activeIds = new Set(hostFriendInviteEntries.map((entry) => entry.joinRequestId));
      let mutated = false;
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (!activeIds.has(key)) {
          delete next[key];
          mutated = true;
        }
      }
      return mutated ? next : prev;
    });
  }, [hostFriendInviteEntries]);

  useEffect(() => {
    if (!hostFriendSelectionSkippedHistory.length) {
      return;
    }

    const activeIds = new Set(hostFriendInviteEntries.map((entry) => entry.joinRequestId));
    setHostFriendSelectionSkippedHistory((prev) => {
      const filtered = prev.filter((id) => activeIds.has(id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [hostFriendInviteEntries, hostFriendSelectionSkippedHistory]);

  useEffect(() => {
    if (!Object.keys(hostFriendInviteGuardrails).length) {
      return;
    }

    setHostFriendSelectionState((prev) => {
      let mutated = false;
      const next = { ...prev };
      for (const joinRequestId of Object.keys(prev)) {
        if (isInviteGuardrailActive(hostFriendInviteGuardrails[joinRequestId]?.nextInviteAvailableAtISO)) {
          delete next[joinRequestId];
          mutated = true;
        }
      }
      return mutated ? next : prev;
    });
  }, [hostFriendInviteGuardrails]);

  useEffect(() => {
    setHostFriendSelectionState((prev) => {
      let mutated = false;
      const next = { ...prev };
      for (const joinRequestId of Object.keys(prev)) {
        const currentEventInviteAtISO = hostFriendEventInviteState[joinRequestId];
        const overrideToken = hostFriendEventInviteOverrides[joinRequestId];
        if (currentEventInviteAtISO && overrideToken !== currentEventInviteAtISO) {
          delete next[joinRequestId];
          mutated = true;
        }
      }
      return mutated ? next : prev;
    });
  }, [hostFriendEventInviteOverrides, hostFriendEventInviteState]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location) {
      const origin = window.location.origin && window.location.origin !== "null" ? window.location.origin : "https://tonight.app";
      setEventShareUrl(`${origin}/events/${event.id}`);
    } else {
      setEventShareUrl(`https://tonight.app/events/${event.id}`);
    }
    setEventShareSupported(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, [event.id]);

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
    const seenTime = hostActivityLastSeenTimestamp;
    if (!latestTime) {
      return;
    }

    const shouldShow = !seenTime || latestTime > seenTime;
    setHasHostActivityNotice((prev) => (prev === shouldShow ? prev : shouldShow));
  }, [hostActivityCursorStatus, hostActivityLastSeenTimestamp, isGuestViewer, latestHostActivityTimestamp]);

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
  const eventMomentLabel = useMemo(() => formatEventShareMoment(event.startDateISO), [event.startDateISO]);
  const resolvedEventShareUrl = eventShareUrl ?? `https://tonight.app/events/${event.id}`;
  const hostFriendInviteTemplateOptions = useMemo(
    () =>
      buildHostFriendInviteTemplates({
        eventTitle: event.title,
        eventMomentLabel,
        eventLocationLabel: event.locationName ?? null,
        eventShareUrl: resolvedEventShareUrl,
      }),
    [event.locationName, event.title, eventMomentLabel, resolvedEventShareUrl]
  );
  const activeHostFriendTemplate = hostFriendInviteTemplateOptions.find((option) => option.id === hostFriendTemplateId) ?? hostFriendInviteTemplateOptions[0] ?? null;
  const hostFriendTemplateHelperCopy = activeHostFriendTemplate?.helperCopy ?? "Templates adapt to your event details.";
  const hostFriendTemplateOptionsAvailable = hostFriendInviteTemplateOptions.length > 0;
  useEffect(() => {
    if (!hostFriendTemplateOptionsAvailable) {
      return;
    }

    const templateExists = hostFriendInviteTemplateOptions.some((option) => option.id === hostFriendTemplateId);
    if (!templateExists) {
      setHostFriendTemplateId(hostFriendInviteTemplateOptions[0].id);
    }
  }, [hostFriendInviteTemplateOptions, hostFriendTemplateId, hostFriendTemplateOptionsAvailable]);

  const filteredHostFriendInvites = useMemo(() => {
    if (!hostFriendInviteEntries.length) {
      return [];
    }

    const query = hostFriendSearchValue.trim().toLowerCase();
    if (!query) {
      return hostFriendInviteEntries;
    }

    return hostFriendInviteEntries.filter((friend) => friend.displayName.toLowerCase().includes(query));
  }, [hostFriendInviteEntries, hostFriendSearchValue]);
  const hostFriendSearchActive = hostFriendSearchValue.trim().length > 0;
  const hostFriendInviteEmptyCopy = hostFriendSearchActive
    ? "No friends match this search yet."
    : "We’ll surface your recent Tonight friends here as they RSVP to your events.";
  const getHostFriendGuardrailFor = useCallback(
    (joinRequestId: string) => {
      const stateEntry = hostFriendInviteGuardrails[joinRequestId];
      if (stateEntry) {
        return stateEntry;
      }
      const fallback = hostFriendInviteEntries.find((entry) => entry.joinRequestId === joinRequestId);
      return {
        lastInviteAtISO: fallback?.lastInviteAtISO ?? null,
        nextInviteAvailableAtISO: fallback?.nextInviteAvailableAtISO ?? null,
      };
    },
    [hostFriendInviteEntries, hostFriendInviteGuardrails]
  );
  const evaluateHostFriendSelectionEligibility = useCallback(
    (friend: HostFriendInviteEntry): HostFriendSelectionEligibility => {
      const guardrail = getHostFriendGuardrailFor(friend.joinRequestId);
      const nextInviteAvailableAtISO = guardrail.nextInviteAvailableAtISO ?? null;
      const inviteGuardrailActive = isInviteGuardrailActive(nextInviteAvailableAtISO);
      const currentEventInviteAtISO = hostFriendEventInviteState[friend.joinRequestId] ?? friend.currentEventInviteAtISO ?? null;
      const overrideToken = hostFriendEventInviteOverrides[friend.joinRequestId] ?? null;
      const eventInviteLocked = Boolean(currentEventInviteAtISO && overrideToken !== currentEventInviteAtISO);
      const eventInviteCooldownUntilISO = getEventInviteCooldownUntil(currentEventInviteAtISO);
      const eventInviteCoolingDown = Boolean(currentEventInviteAtISO) && isInviteGuardrailActive(eventInviteCooldownUntilISO);
      const eventInviteOverrideAvailable = eventInviteLocked && !eventInviteCoolingDown;

      if (inviteGuardrailActive || eventInviteLocked) {
        return {
          eligible: false,
          blockedEntry: {
            friend,
            reason: inviteGuardrailActive
              ? nextInviteAvailableAtISO
                ? `Cooling down — try again ${formatRelativeTime(nextInviteAvailableAtISO)}.`
                : "Cooling down — invited moments ago."
              : eventInviteCoolingDown && eventInviteCooldownUntilISO
                ? `Already pinged for this event — try again ${formatRelativeTime(eventInviteCooldownUntilISO)}.`
                : `Already invited to ${event.title}.`,
            type: inviteGuardrailActive ? "cooldown" : "event",
            nextInviteAvailableAtISO,
            currentEventInviteAtISO,
            eventInviteOverrideAvailable,
            eventInviteCoolingDown,
          },
        };
      }

      return { eligible: true };
    },
    [event.title, getHostFriendGuardrailFor, hostFriendEventInviteOverrides, hostFriendEventInviteState]
  );
  const hostFriendSelectedEntries = useMemo(
    () => hostFriendInviteEntries.filter((friend) => Boolean(hostFriendSelectionState[friend.joinRequestId])),
    [hostFriendInviteEntries, hostFriendSelectionState]
  );
  const hostFriendSelectedCount = hostFriendSelectedEntries.length;
  const hostFriendSelectionActive = hostFriendSelectedCount > 0;
  const hostFriendSelectionBreakdown = useMemo(() => {
    return hostFriendSelectedEntries.reduce(
      (acc, friend) => {
        const { eligible, blockedEntry } = evaluateHostFriendSelectionEligibility(friend);
        if (!eligible && blockedEntry) {
          acc.blockedEntries.push(blockedEntry);
          return acc;
        }

        acc.eligibleEntries.push(friend);
        return acc;
      },
      { eligibleEntries: [] as HostFriendInviteEntry[], blockedEntries: [] as HostFriendSelectionBlockedEntry[] }
    );
  }, [evaluateHostFriendSelectionEligibility, hostFriendSelectedEntries]);
  const hostFriendSelectionEligibleEntries = hostFriendSelectionBreakdown.eligibleEntries;
  const hostFriendSelectionBlockedEntries = hostFriendSelectionBreakdown.blockedEntries;
  const hostFriendSelectionEligibleCount = hostFriendSelectionEligibleEntries.length;
  const hostFriendSelectionSkippedCount = hostFriendSelectionBlockedEntries.length;
  const hostFriendSelectionHasSkipped = hostFriendSelectionSkippedCount > 0;
  const hostFriendSelectionReadyLabel =
    hostFriendSelectionEligibleCount === 1
      ? "1 friend ready to ping"
      : `${hostFriendSelectionEligibleCount} friends ready to ping`;
  const hostFriendSelectionSkippedLabel =
    hostFriendSelectionSkippedCount === 1
      ? "1 selection paused"
      : `${hostFriendSelectionSkippedCount} selections paused`;
  const hostFriendSelectionSkippedHelperLabel = hostFriendSelectionSkippedCount === 1 ? "that friend" : "those friends";
  const hostFriendSelectionCtaLabel =
    hostFriendSelectionEligibleCount === 0
      ? "No eligible friends right now"
      : hostFriendSelectionEligibleCount === 1
        ? "Send template to 1 friend"
        : `Send template to ${hostFriendSelectionEligibleCount} friends`;
  const hostFriendSelectionSkippedHistorySet = useMemo(
    () => new Set(hostFriendSelectionSkippedHistory),
    [hostFriendSelectionSkippedHistory]
  );
  const hostFriendSelectionSkippedHistoryEntries = useMemo(() => {
    if (!hostFriendSelectionSkippedHistorySet.size) {
      return [];
    }
    return hostFriendInviteEntries.filter((friend) => hostFriendSelectionSkippedHistorySet.has(friend.joinRequestId));
  }, [hostFriendInviteEntries, hostFriendSelectionSkippedHistorySet]);
  const hostFriendSelectionSkippedHistoryCount = hostFriendSelectionSkippedHistoryEntries.length;
  const hostFriendSelectionSkippedReselectableEntries = useMemo(
    () =>
      hostFriendSelectionSkippedHistoryEntries.filter((friend) => evaluateHostFriendSelectionEligibility(friend).eligible),
    [evaluateHostFriendSelectionEligibility, hostFriendSelectionSkippedHistoryEntries]
  );
  const hostFriendSelectionSkippedReselectableCount = hostFriendSelectionSkippedReselectableEntries.length;
  const hostFriendSelectionSkippedReadyLabel =
    hostFriendSelectionSkippedReselectableCount === 1
      ? "1 friend ready again"
      : `${hostFriendSelectionSkippedReselectableCount} friends ready again`;
  const hostFriendSelectionSummaryRelativeTime = hostFriendSelectionSummary?.timestampISO
    ? formatRelativeTime(hostFriendSelectionSummary.timestampISO)
    : null;
  const hostFriendSelectionSummaryHasSkipped = Boolean(hostFriendSelectionSummary?.skippedCount);
  const hostFriendSelectionSummaryHasFailures = Boolean(hostFriendSelectionSummary?.failedCount);

  useEffect(() => {
    if (!hostFriendSelectionActive) {
      setHostFriendSelectionSkippedExpanded(false);
    }
  }, [hostFriendSelectionActive]);

  useEffect(() => {
    if (!hostFriendSelectionHasSkipped) {
      setHostFriendSelectionSkippedExpanded(false);
    }
  }, [hostFriendSelectionHasSkipped]);
  const stampHostFriendInviteGuardrail = useCallback((joinRequestId: string, lastInviteSourceISO?: string) => {
    const baseTimestamp = lastInviteSourceISO ? new Date(lastInviteSourceISO) : new Date();
    const nextTimestamp = new Date(baseTimestamp.getTime() + HOST_FRIEND_INVITE_COOLDOWN_MS);
    setHostFriendInviteGuardrails((prev) => ({
      ...prev,
      [joinRequestId]: {
        lastInviteAtISO: baseTimestamp.toISOString(),
        nextInviteAvailableAtISO: nextTimestamp.toISOString(),
      },
    }));
  }, []);

  const logHostFriendEventInvite = useCallback(
    async (joinRequestId: string) => {
      const friend = hostFriendInviteEntries.find((entry) => entry.joinRequestId === joinRequestId);
      if (!friend) {
        return;
      }

      try {
        const response = await fetch(`/api/events/${event.id}/invite-logs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: friend.userId,
            sourceJoinRequestId: friend.joinRequestId,
          }),
        });

        if (!response.ok) {
          console.error("Unable to persist event invite log", await response.text());
          return;
        }

        const payload = (await response.json()) as { invitedAtISO?: string | null };
        const invitedAtISO = payload?.invitedAtISO ?? new Date().toISOString();
        setHostFriendEventInviteState((prev) => ({
          ...prev,
          [friend.joinRequestId]: invitedAtISO,
        }));
        setHostFriendEventInviteOverrides((prev) => {
          if (!prev[friend.joinRequestId]) {
            return prev;
          }
          const next = { ...prev };
          delete next[friend.joinRequestId];
          return next;
        });
      } catch (error) {
        console.error("Failed to log event invite", error);
      }
    },
    [event.id, hostFriendInviteEntries]
  );
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
    if (!isGuestViewer || !hostActivityEntries.length || !hostActivityLastSeenTimestamp) {
      return null;
    }

    let hasNewerEntries = false;
    for (let index = 0; index < hostActivityEntries.length; index += 1) {
      const entry = hostActivityEntries[index];
      const entryTimestamp = parseIsoTimestamp(entry?.postedAtISO);

      if (!entryTimestamp) {
        continue;
      }

      if (entryTimestamp > hostActivityLastSeenTimestamp) {
        hasNewerEntries = true;
        continue;
      }

      if (hasNewerEntries) {
        return index;
      }

      return null;
    }

    return null;
  }, [hostActivityEntries, hostActivityLastSeenTimestamp, isGuestViewer]);

  const hostActivityUnseenCount = useMemo(() => {
    if (!isGuestViewer || !hostActivityEntries.length) {
      return 0;
    }

    const lastSeen = hostActivityLastSeenTimestamp;
    return hostActivityEntries.reduce((count, entry) => {
      const entryTimestamp = parseIsoTimestamp(entry?.postedAtISO);
      if (!entryTimestamp) {
        return count;
      }

      if (!lastSeen || entryTimestamp > lastSeen) {
        return count + 1;
      }

      return count;
    }, 0);
  }, [hostActivityEntries, hostActivityLastSeenTimestamp, isGuestViewer]);

  const hostActivityHeaderUnseenLabel = hostActivityUnseenCount > 0 ? `${hostActivityUnseenCount} new` : null;
  const hostActivityNoticeCtaLabel =
    hostActivityUnseenCount > 1
      ? `${hostActivityUnseenCount} new updates`
      : hostActivityUnseenCount === 1
        ? "1 new update"
        : "New update";

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

  const handleJoinRequestStatusChanged = useCallback(
    (payload: JoinRequestStatusChangedPayload) => {
      // Only handle if this is for the current join request and status is ACCEPTED
      if (!activeJoinRequestId || payload.joinRequestId !== activeJoinRequestId) {
        return;
      }

      if (payload.status === "ACCEPTED") {
        showSuccessToast("Request approved!", "The host has approved your join request.");

        // Reload the page to update all data and show full guest experience
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    },
    [activeJoinRequestId]
  );

  const handleCopyEventInvite = useCallback(async () => {
    if (!eventShareUrl) {
      showErrorToast("Copy failed", "Invite link is still loading. Try again in a second.");
      return;
    }

    try {
      setEventShareCopyState("copying");
      await copyTextToClipboard(eventShareUrl);
      setEventShareCopyState("copied");
      showSuccessToast("Invite link copied", "Send it anywhere to start approvals.");
    } catch (error) {
      setEventShareCopyState("idle");
      const message = (error as Error)?.message ?? "Grab the link from your browser bar instead.";
      showErrorToast("Copy failed", message);
    }
  }, [eventShareUrl]);

  const handleShareEventInvite = useCallback(async () => {
    if (!eventShareUrl) {
      showErrorToast("Share unavailable", "Invite link is still loading. Try again in a moment.");
      return;
    }

    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      await handleCopyEventInvite();
      return;
    }

    try {
      setEventShareShareState("sharing");
      await navigator.share({
        title: event.title,
        text: eventInviteShareText,
        url: eventShareUrl,
      });
      showSuccessToast("Share sheet ready", "Pick any app to send this invite.");
    } catch (error) {
      const dismissed =
        error instanceof DOMException
          ? error.name === "AbortError"
          : typeof error === "object" && error !== null && "name" in error && (error as { name?: string }).name === "AbortError";
      if (!dismissed) {
        const message = (error as Error)?.message ?? "Copy the link instead.";
        showErrorToast("Share failed", message);
      }
    } finally {
      setEventShareShareState("idle");
    }
  }, [event.title, eventInviteShareText, eventShareUrl, handleCopyEventInvite]);

  const handleJoinRequest = useCallback(async () => {
    if (joinRequestStatus !== "idle") {
      return;
    }

    try {
      setJoinRequestStatus("submitting");
      const response = await fetch("/api/join-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ eventId: event.id }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const message = errorData?.error ?? "Unable to submit join request";
        throw new Error(message);
      }

      setJoinRequestStatus("submitted");
      showSuccessToast("Request sent!", "The host will review your request soon.");

      // Reload the page to show the updated status
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      setJoinRequestStatus("idle");
      const message = (error as Error)?.message ?? "Unable to submit join request";
      showErrorToast("Request failed", message);
    }
  }, [event.id, joinRequestStatus]);

  const { isConnected, joinRoom } = useSocket({
    token: socketEnabled ? socketToken ?? undefined : undefined,
    autoConnect: socketEnabled,
    readinessEndpoint: "/api/socket/io",
    onMessage: realtimeHostActivityEnabled ? handleRealtimeHostActivity : undefined,
    onJoinRequestStatusChanged: socketEnabled ? handleJoinRequestStatusChanged : undefined,
  });

  useEffect(() => {
    if (!socketEnabled || !isConnected || !activeJoinRequestId) {
      return;
    }
    joinRoom(activeJoinRequestId);
  }, [activeJoinRequestId, isConnected, joinRoom, socketEnabled]);

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
          const status: "confirmed" | "pending" | "waitlist" = nextStatus === "accepted" ? "confirmed" : "waitlist";
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

  const dispatchHostFriendInvites = async (
    invites: Array<{ joinRequestId: string; message: string; fallback?: string }>
  ): Promise<HostFriendInviteDispatchResult[]> => {
    const results: HostFriendInviteDispatchResult[] = [];
    for (const invite of invites) {
      try {
        await sendMessageToThread({
          joinRequestId: invite.joinRequestId,
          message: invite.message,
          fallback: invite.fallback ?? "Unable to send this invite.",
        });
        results.push({ joinRequestId: invite.joinRequestId, status: "sent" });
      } catch (error) {
        results.push({
          joinRequestId: invite.joinRequestId,
          status: "failed",
          error: (error as Error)?.message ?? invite.fallback ?? "Unable to send this invite.",
        });
      }
    }
    return results;
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

  const buildHostFriendInviteTemplateMessage = useCallback(
    (displayName: string, templateId?: HostFriendInviteTemplateId) => {
      if (hostFriendInviteTemplateOptions.length === 0) {
        return buildFallbackHostFriendInviteTemplate({
          displayName,
          eventTitle: event.title,
          eventMomentLabel,
          eventLocationLabel: event.locationName ?? null,
          eventShareUrl: resolvedEventShareUrl,
        });
      }

      const targetId = templateId ?? hostFriendTemplateId;
      const template =
        hostFriendInviteTemplateOptions.find((option) => option.id === targetId) ?? hostFriendInviteTemplateOptions[0];
      return template.buildMessage(displayName);
    },
    [event.locationName, event.title, eventMomentLabel, hostFriendInviteTemplateOptions, hostFriendTemplateId, resolvedEventShareUrl]
  );

  const handleHostFriendComposerChange = (joinRequestId: string, value: string) => {
    setHostFriendComposerState((prev) => ({
      ...prev,
      [joinRequestId]: {
        value,
        status: prev[joinRequestId]?.status,
      },
    }));
  };

  const handleHostFriendComposerClear = (joinRequestId: string) => {
    setHostFriendComposerState((prev) => {
      if (!prev[joinRequestId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[joinRequestId];
      return next;
    });
  };

  const handleHostFriendUseTemplate = (
    joinRequestId: string,
    displayName: string,
    templateId?: HostFriendInviteTemplateId
  ) => {
    const templateValue = buildHostFriendInviteTemplateMessage(displayName, templateId);
    setHostFriendComposerState((prev) => ({
      ...prev,
      [joinRequestId]: {
        value: templateValue,
        status: prev[joinRequestId]?.status,
      },
    }));
  };

  const handleHostFriendSelectionToggle = (joinRequestId: string) => {
    setHostFriendSelectionState((prev) => {
      const next = { ...prev };
      if (next[joinRequestId]) {
        delete next[joinRequestId];
      } else {
        next[joinRequestId] = true;
      }
      return next;
    });
  };

  const handleHostFriendEventInviteOverride = (joinRequestId: string, invitedAtISO?: string | null) => {
    if (!invitedAtISO) {
      return;
    }
    if (isEventInviteCooldownActive(invitedAtISO)) {
      showErrorToast("Still cooling down", "Give them a little more time before re-inviting.");
      return;
    }

    setHostFriendEventInviteOverrides((prev) => ({
      ...prev,
      [joinRequestId]: invitedAtISO,
    }));
    showSuccessToast("Re-invite enabled", "You can nudge this friend again.");
  };

  const handleHostFriendSelectionClear = () => {
    setHostFriendSelectionState((prev) => {
      if (Object.keys(prev).length === 0) {
        return prev;
      }
      return {};
    });
  };

  const handleHostFriendSelectionReselectSkipped = () => {
    if (hostFriendSelectionStatus === "sending") {
      return;
    }

    if (!hostFriendSelectionSkippedReselectableEntries.length) {
      showErrorToast("Still cooling down", "We’ll light this back up once friends are ready again.");
      return;
    }

    setHostFriendSelectionState((prev) => {
      const next = { ...prev };
      for (const friend of hostFriendSelectionSkippedReselectableEntries) {
        next[friend.joinRequestId] = true;
      }
      return next;
    });

    setHostFriendSelectionSkippedHistory((prev) => {
      if (!prev.length) {
        return prev;
      }
      const readyIds = new Set(hostFriendSelectionSkippedReselectableEntries.map((friend) => friend.joinRequestId));
      const filtered = prev.filter((id) => !readyIds.has(id));
      return filtered.length === prev.length ? prev : filtered;
    });

    const readyCount = hostFriendSelectionSkippedReselectableEntries.length;
    const label = readyCount === 1 ? "Friend reselected" : "Friends reselected";
    const helper = readyCount === 1 ? "They’re back in your selection." : `${readyCount} friends are ready again.`;
    showSuccessToast(label, helper);
  };

  const triggerHostFriendSkippedReselect = () => {
    setHostFriendSelectionSkippedExpanded(true);
    handleHostFriendSelectionReselectSkipped();
  };

  const handleHostFriendSelectionSend = async () => {
    if (!hostFriendSelectedEntries.length) {
      showErrorToast("No friends selected", "Pick at least one friend before sending.");
      return;
    }

    const eligibleEntries = hostFriendSelectionEligibleEntries;

    if (!eligibleEntries.length) {
      showErrorToast("Invite cooling down", "Everyone you selected was invited recently. Give them a moment before re-sending.");
      return;
    }

    const skippedEntries = hostFriendSelectionBlockedEntries;
    setHostFriendSelectionSkippedHistory(skippedEntries.map((entry) => entry.friend.joinRequestId));

    setHostFriendSelectionStatus("sending");
    const invites = eligibleEntries.map((friend) => ({
      joinRequestId: friend.joinRequestId,
      message: buildHostFriendInviteTemplateMessage(friend.displayName),
      fallback: `Unable to send an invite to ${friend.displayName}.`,
    }));

    try {
      const results = await dispatchHostFriendInvites(invites);
      const failures = new Set(results.filter((result) => result.status === "failed").map((result) => result.joinRequestId));
      const successes = results.filter((result) => result.status === "sent");

      if (successes.length > 0) {
        const sentCount = successes.length;
        const skippedCount = skippedEntries.length;
        const failedCount = failures.size;
        const summaryLabel = sentCount === 1 ? "Invite sent" : "Invites sent";
        const summaryTextSegments: string[] = [
          sentCount === 1 ? "1 invite delivered." : `${sentCount} invites delivered.`,
        ];
        if (skippedCount > 0) {
          summaryTextSegments.push(
            skippedCount === 1 ? "1 friend skipped (cooldown)." : `${skippedCount} friends skipped (cooldown).`
          );
        }
        if (failedCount > 0) {
          summaryTextSegments.push(
            failedCount === 1 ? "1 invite failed (see error)." : `${failedCount} invites failed (see error).`
          );
        }

        setHostFriendSelectionSummary({
          sentCount,
          skippedCount,
          failedCount,
          timestampISO: new Date().toISOString(),
        });

        const toastDescription = (
          <div className="space-y-2">
            <p className="text-sm">
              {summaryTextSegments.join(" ")}
            </p>
            {skippedCount > 0 ? (
              <button
                type="button"
                onClick={triggerHostFriendSkippedReselect}
                className="rounded-full border border-foreground/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground transition hover:border-foreground/40"
              >
                Reselect skipped friends
              </button>
            ) : null}
          </div>
        );

        showSuccessToast(summaryLabel, toastDescription);
        successes.forEach((result) => {
          stampHostFriendInviteGuardrail(result.joinRequestId);
        });
        await Promise.all(successes.map((result) => logHostFriendEventInvite(result.joinRequestId)));
      }

      if (failures.size > 0) {
        const firstFailure = results.find((result) => failures.has(result.joinRequestId));
        const failedLabel = failures.size === results.length ? "Invites failed" : "Some invites failed";
        const failedMessage = firstFailure?.error ?? "Unable to send some invites.";
        showErrorToast(failedLabel, failedMessage);
      }

      setHostFriendSelectionState((prev) => {
        if (!successes.length) {
          return prev;
        }
        const next = { ...prev };
        for (const result of successes) {
          delete next[result.joinRequestId];
        }
        return next;
      });
    } catch (error) {
      const message = (error as Error)?.message ?? "Unable to send these invites.";
      showErrorToast("Invites failed", message);
    } finally {
      setHostFriendSelectionStatus("idle");
    }
  };

  const handleHostFriendInviteSend = async (joinRequestId: string) => {
    const guardrail = getHostFriendGuardrailFor(joinRequestId);
    if (isInviteGuardrailActive(guardrail.nextInviteAvailableAtISO)) {
      showErrorToast("Invite cooling down", "Give them a moment before sending another DM.");
      return;
    }

    const friend = hostFriendInviteEntries.find((entry) => entry.joinRequestId === joinRequestId);
    const currentEventInviteAtISO = hostFriendEventInviteState[joinRequestId] ?? friend?.currentEventInviteAtISO ?? null;
    if (currentEventInviteAtISO) {
      const overrideToken = hostFriendEventInviteOverrides[joinRequestId];
      const overrideActive = overrideToken === currentEventInviteAtISO;
      if (!overrideActive) {
        if (isEventInviteCooldownActive(currentEventInviteAtISO)) {
          showErrorToast("Invite cooling down", "Give them a little more time before nudging this event again.");
        } else {
          showErrorToast("Already invited", '"Re-invite anyway" unlocks this friend once you\'re sure.');
        }
        return;
      }
    }

    const entry = hostFriendComposerState[joinRequestId];
    const rawValue = entry?.value ?? "";
    const trimmed = rawValue.trim();

    if (!trimmed) {
      showErrorToast("Message required", "Personalize the invite before sending.");
      return;
    }

    setHostFriendComposerState((prev) => ({
      ...prev,
      [joinRequestId]: {
        value: rawValue,
        status: "sending",
      },
    }));

    const fallback = "Unable to send this invite.";
    let results: HostFriendInviteDispatchResult[] = [];
    try {
      results = await dispatchHostFriendInvites([{ joinRequestId, message: trimmed, fallback }]);
    } catch (error) {
      const messagePayload = (error as Error)?.message ?? fallback;
      showErrorToast("Invite failed", messagePayload);
      setHostFriendComposerState((prev) => ({
        ...prev,
        [joinRequestId]: {
          value: rawValue,
          status: undefined,
        },
      }));
      return;
    }

    const result = results[0];
    if (!result || result.status === "failed") {
      showErrorToast("Invite failed", result?.error ?? fallback);
      setHostFriendComposerState((prev) => ({
        ...prev,
        [joinRequestId]: {
          value: rawValue,
          status: undefined,
        },
      }));
      return;
    }

    showSuccessToast("Invite sent");
    stampHostFriendInviteGuardrail(joinRequestId);
    await logHostFriendEventInvite(joinRequestId);
    setHostFriendComposerState((prev) => {
      const next = { ...prev };
      delete next[joinRequestId];
      return next;
    });
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
                    {hostActivityEntries.length > 1 ? "Host updates" : "Latest host update"}
                  </p>
                  {isGuestViewer && hostActivityHeaderUnseenLabel ? (
                    <span
                      data-testid="host-updates-unseen-count"
                      className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
                    >
                      {hostActivityHeaderUnseenLabel}
                    </span>
                  ) : null}
                </div>
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
                      {hostActivityCursorStatus === "saving" ? "Marking seen…" : `${hostActivityNoticeCtaLabel} · Jump to latest`}
                    </button>
                  </div>
                ) : null}
                <ul
                  ref={hostActivityListRef}
                  data-testid="host-updates-list"
                  className={hostActivityListClasses}
                >
                  {hostActivityEntries.map((activity, index) => {
                    const entryTimestamp = parseIsoTimestamp(activity?.postedAtISO);
                    const isNewEntry = Boolean(
                      isGuestViewer && (!hostActivityLastSeenTimestamp || (entryTimestamp && entryTimestamp > hostActivityLastSeenTimestamp))
                    );

                    return (
                      <Fragment key={activity.id}>
                        {hostActivityDividerIndex === index ? (
                          <li className="relative flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-primary/80">
                            <span className="h-px flex-1 rounded-full bg-primary/30" aria-hidden />
                            <span>New since you last checked</span>
                            <span className="h-px flex-1 rounded-full bg-primary/30" aria-hidden />
                          </li>
                        ) : null}
                        <li className="rounded-xl border border-white/5 bg-white/5 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm text-white/80">{activity.message}</p>
                            {isNewEntry ? (
                              <span
                                data-testid="host-update-new-pill"
                                className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
                              >
                                New
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-xs text-white/50">
                            {activity.authorName ?? host.displayName}
                            {" · "}
                            {formatRelativeTime(activity.postedAtISO)}
                          </p>
                        </li>
                      </Fragment>
                    );
                  })}
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
            {isHostViewer ? (
              <div className="mt-5 space-y-5">
                <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/80">Share event invite</p>
                  <p className="mt-1 text-xs text-white/70">Send the deep link with context without leaving this page.</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {eventShareSupported ? (
                      <button
                        type="button"
                        onClick={() => {
                          void handleShareEventInvite();
                        }}
                        disabled={!eventShareUrl || eventShareShareState === "sharing"}
                        className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary/90 transition hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Share2 className="h-3.5 w-3.5" aria-hidden />
                        {eventShareShareState === "sharing" ? "Sharing…" : "Share event invite"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        void handleCopyEventInvite();
                      }}
                      disabled={!eventShareUrl || eventShareCopyState === "copying"}
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white/80 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                      {eventShareCopyState === "copying" ? "Copying…" : eventShareCopyState === "copied" ? "Link copied" : "Copy invite link"}
                    </button>
                  </div>
                  <p className="mt-2 break-all text-[11px] text-white/60">{eventShareUrl ?? "Preparing invite link…"}</p>
                </div>

                {hostFriendInviteEntries.length ? (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Invite Tonight friends</p>
                        <p className="mt-1 text-xs text-white/60">Pick a past guest and DM them without leaving this page.</p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <div className="w-full sm:w-56">
                          <label
                            htmlFor={hostFriendSearchInputId}
                            className="text-[11px] font-semibold uppercase tracking-wide text-white/60"
                          >
                            Search friends
                          </label>
                          <input
                            id={hostFriendSearchInputId}
                            type="search"
                            value={hostFriendSearchValue}
                            onChange={(event) => setHostFriendSearchValue(event.target.value)}
                            placeholder="Search by name"
                            className="mt-1 w-full rounded-full border border-white/15 bg-black/40 px-4 py-2 text-xs text-white placeholder:text-white/40 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
                          />
                        </div>
                        {hostFriendTemplateOptionsAvailable ? (
                          <div className="w-full sm:w-56">
                            <label
                              htmlFor={hostFriendTemplateSelectId}
                              className="text-[11px] font-semibold uppercase tracking-wide text-white/60"
                            >
                              Invite template
                            </label>
                            <select
                              id={hostFriendTemplateSelectId}
                              value={hostFriendTemplateId}
                              onChange={(event) => setHostFriendTemplateId(event.target.value as HostFriendInviteTemplateId)}
                              className="mt-1 w-full rounded-full border border-white/15 bg-black/40 px-4 py-2 text-xs text-white focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
                            >
                              {hostFriendInviteTemplateOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {hostFriendTemplateOptionsAvailable ? (
                      <p className="mt-2 text-[11px] text-white/60">{hostFriendTemplateHelperCopy}</p>
                    ) : null}
                    {hostFriendSelectionActive ? (
                      <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/90">Multi-send ready</p>
                          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            {hostFriendSelectedCount}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-white/70">
                          We’ll send the {activeHostFriendTemplate?.label ?? "default"} template to each friend with their name auto-filled.
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
                          <span className="rounded-full bg-white/15 px-2 py-0.5 text-white/90">{hostFriendSelectionReadyLabel}</span>
                          {hostFriendSelectionHasSkipped ? (
                            <>
                              <span className="rounded-full bg-amber-200/20 px-2 py-0.5 text-amber-100">{hostFriendSelectionSkippedLabel}</span>
                              <button
                                type="button"
                                onClick={() => setHostFriendSelectionSkippedExpanded((prev) => !prev)}
                                className="text-[11px] font-semibold text-primary/90 underline-offset-2 hover:underline"
                                aria-expanded={hostFriendSelectionSkippedExpanded}
                                disabled={hostFriendSelectionStatus === "sending"}
                              >
                                {hostFriendSelectionSkippedExpanded ? "Hide skipped" : "Review skipped"}
                              </button>
                            </>
                          ) : null}
                        </div>
                        {hostFriendSelectionHasSkipped ? (
                          <div className="mt-3 rounded-xl border border-amber-200/30 bg-amber-100/5 p-3">
                            <p className="text-xs text-amber-100">
                              We’ll hold {hostFriendSelectionSkippedHelperLabel} until cooldowns clear or you override them.
                            </p>
                            {hostFriendSelectionSkippedExpanded ? (
                              <ul className="mt-3 space-y-2">
                                {hostFriendSelectionBlockedEntries.map((entry) => {
                                  const friend = entry.friend;
                                  const canOverride =
                                    entry.type === "event" && entry.eventInviteOverrideAvailable && entry.currentEventInviteAtISO;
                                  return (
                                    <li key={friend.joinRequestId} className="rounded-lg border border-white/10 bg-black/30 p-3">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                          <p className="text-sm font-semibold text-white">{friend.displayName}</p>
                                          <p className="text-xs text-white/70">{entry.reason}</p>
                                        </div>
                                        {canOverride ? (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleHostFriendEventInviteOverride(friend.joinRequestId, entry.currentEventInviteAtISO)
                                            }
                                            className="rounded-full border border-white/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/40"
                                          >
                                            Re-enable + send
                                          </button>
                                        ) : null}
                                      </div>
                                      {entry.type === "cooldown" && entry.nextInviteAvailableAtISO ? (
                                        <p className="mt-1 text-[11px] text-white/50">
                                          Ready again {formatRelativeTime(entry.nextInviteAvailableAtISO)}.
                                        </p>
                                      ) : null}
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {hostFriendSelectedEntries.map((friend) => (
                            <button
                              key={friend.joinRequestId}
                              type="button"
                              onClick={() => handleHostFriendSelectionToggle(friend.joinRequestId)}
                              className="group inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold text-white/80 transition hover:border-white/40"
                              disabled={hostFriendSelectionStatus === "sending"}
                            >
                              {friend.displayName}
                              <span aria-hidden className="text-white/50 transition group-hover:text-white">×</span>
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleHostFriendSelectionSend}
                            className="rounded-full bg-primary/80 px-4 py-1.5 text-xs font-semibold text-black transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={hostFriendSelectionStatus === "sending" || hostFriendSelectionEligibleCount === 0}
                          >
                            {hostFriendSelectionStatus === "sending" ? "Sending…" : hostFriendSelectionCtaLabel}
                          </button>
                          <button
                            type="button"
                            onClick={handleHostFriendSelectionClear}
                            className="text-[11px] font-semibold text-white/70 transition hover:text-white"
                            disabled={hostFriendSelectionStatus === "sending"}
                          >
                            Clear selection
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {hostFriendSelectionSummary ? (
                      <div className="mt-4 rounded-2xl border border-white/15 bg-black/30 p-3" data-testid="multi-send-summary">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Last multi-send summary</p>
                            <p className="text-xs text-white/60">
                              {hostFriendSelectionSummary.sentCount === 1
                                ? "1 invite delivered"
                                : `${hostFriendSelectionSummary.sentCount} invites delivered`}
                              {hostFriendSelectionSummaryHasSkipped
                                ? hostFriendSelectionSummary.skippedCount === 1
                                  ? " · 1 skipped"
                                  : ` · ${hostFriendSelectionSummary.skippedCount} skipped`
                                : ""}
                              {hostFriendSelectionSummaryHasFailures
                                ? hostFriendSelectionSummary.failedCount === 1
                                  ? " · 1 failed"
                                  : ` · ${hostFriendSelectionSummary.failedCount} failed`
                                : ""}
                              {hostFriendSelectionSummaryRelativeTime ? ` · ${hostFriendSelectionSummaryRelativeTime}` : ""}
                            </p>
                          </div>
                          {hostFriendSelectionSummaryHasSkipped ? (
                            <button
                              type="button"
                              onClick={triggerHostFriendSkippedReselect}
                              className="rounded-full border border-white/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/45 disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={hostFriendSelectionSkippedReselectableCount === 0 || hostFriendSelectionStatus === "sending"}
                            >
                              {hostFriendSelectionSkippedReselectableCount > 0 ? "Reselect skipped friends" : "Waiting for cooldowns"}
                            </button>
                          ) : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">
                            {hostFriendSelectionSummary.sentCount === 1
                              ? "1 invite sent"
                              : `${hostFriendSelectionSummary.sentCount} invites sent`}
                          </span>
                          {hostFriendSelectionSummaryHasSkipped ? (
                            <span className="rounded-full bg-amber-200/20 px-2 py-0.5 text-amber-50">
                              {hostFriendSelectionSummary.skippedCount === 1
                                ? "1 skipped"
                                : `${hostFriendSelectionSummary.skippedCount} skipped`}
                            </span>
                          ) : null}
                          {hostFriendSelectionSummaryHasFailures ? (
                            <span className="rounded-full bg-rose-200/25 px-2 py-0.5 text-rose-50">
                              {hostFriendSelectionSummary.failedCount === 1
                                ? "1 failed"
                                : `${hostFriendSelectionSummary.failedCount} failed`}
                            </span>
                          ) : null}
                        </div>
                        {hostFriendSelectionSummaryHasSkipped ? (
                          <p className="mt-2 text-[11px] text-white/60">
                            {hostFriendSelectionSkippedReselectableCount > 0
                              ? "Tap reselect to drop cooled-down friends back into your selection."
                              : "We’ll light up the reselect button once cooldowns lift."}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {hostFriendSelectionSkippedHistoryCount > 0 ? (
                      <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-black/30 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Skipped friends</p>
                          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80">
                            {hostFriendSelectionSkippedHistoryCount}
                          </span>
                          {hostFriendSelectionSkippedReselectableCount > 0 ? (
                            <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                              {hostFriendSelectionSkippedReadyLabel}
                            </span>
                          ) : (
                            <span className="text-[11px] text-white/50">Waiting for cooldowns</span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-white/60">
                          {hostFriendSelectionSkippedReselectableCount > 0
                            ? "We’ll drop them back into your selection once you tap the button."
                            : "We’ll re-enable the button once cooldowns lift."}
                        </p>
                        {hostFriendSelectionSkippedHistoryEntries.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {hostFriendSelectionSkippedHistoryEntries.map((friend) => (
                              <span
                                key={friend.joinRequestId}
                                className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold text-white/70"
                              >
                                {friend.displayName}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={handleHostFriendSelectionReselectSkipped}
                          className="mt-3 rounded-full border border-white/30 px-4 py-1.5 text-xs font-semibold text-white/80 transition hover:border-white/50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={hostFriendSelectionSkippedReselectableCount === 0 || hostFriendSelectionStatus === "sending"}
                        >
                          {hostFriendSelectionSkippedReselectableCount > 0
                            ? `Reselect skipped ${hostFriendSelectionSkippedReselectableCount === 1 ? "friend" : "friends"}`
                            : "Reselect skipped friends"}
                        </button>
                      </div>
                    ) : null}
                    {filteredHostFriendInvites.length === 0 ? (
                      <p className="mt-4 text-xs text-white/60">{hostFriendInviteEmptyCopy}</p>
                    ) : (
                      <ul className="mt-4 space-y-3">
                        {filteredHostFriendInvites.map((friend) => {
                          const composerEntry = hostFriendComposerState[friend.joinRequestId];
                          const composerValue = composerEntry?.value ?? "";
                          const composerBusy = composerEntry?.status === "sending";
                          const guardrail = getHostFriendGuardrailFor(friend.joinRequestId);
                          const lastInviteAtISO = guardrail.lastInviteAtISO;
                          const nextInviteAvailableAtISO = guardrail.nextInviteAvailableAtISO;
                          const inviteGuardrailActive = isInviteGuardrailActive(nextInviteAvailableAtISO);
                          const currentEventInviteAtISO =
                            hostFriendEventInviteState[friend.joinRequestId] ?? friend.currentEventInviteAtISO ?? null;
                          const eventInviteOverrideToken = hostFriendEventInviteOverrides[friend.joinRequestId] ?? null;
                          const eventInviteOverrideActive =
                            Boolean(currentEventInviteAtISO) && eventInviteOverrideToken === currentEventInviteAtISO;
                          const eventInviteCooldownUntilISO = getEventInviteCooldownUntil(currentEventInviteAtISO);
                          const eventInviteCoolingDown =
                            Boolean(currentEventInviteAtISO) && isInviteGuardrailActive(eventInviteCooldownUntilISO);
                          const eventInviteLocked = Boolean(currentEventInviteAtISO && !eventInviteOverrideActive);
                          const eventInviteOverrideAvailable = eventInviteLocked && !eventInviteCoolingDown;
                          const sendDisabled =
                            composerBusy || composerValue.trim().length === 0 || inviteGuardrailActive || eventInviteLocked;
                          const lastActiveLabel = friend.lastInteractionAtISO
                            ? `Active ${formatRelativeTime(friend.lastInteractionAtISO)}`
                            : "Recently active";
                          const inviteHistoryLabel = lastInviteAtISO ? `Invited ${formatRelativeTime(lastInviteAtISO)}` : null;
                          const inviteCooldownLabel =
                            inviteGuardrailActive && nextInviteAvailableAtISO
                              ? `Give them a moment — try again ${formatRelativeTime(nextInviteAvailableAtISO)}.`
                              : null;
                          const alreadyInvitedLabel = currentEventInviteAtISO
                            ? `Already invited to ${event.title} · ${formatRelativeTime(currentEventInviteAtISO)}`
                            : null;
                          const eventInviteLockLabel = eventInviteLocked
                            ? eventInviteCoolingDown && eventInviteCooldownUntilISO
                              ? `Already pinged for this event — try again ${formatRelativeTime(eventInviteCooldownUntilISO)}.`
                              : "Already invited to this event. Re-enable below if you truly need to re-invite."
                            : null;
                          const isSelected = Boolean(hostFriendSelectionState[friend.joinRequestId]);

                          return (
                            <li key={friend.joinRequestId} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                              <div className="flex flex-wrap items-start gap-3">
                                <UserAvatar
                                  displayName={friend.displayName}
                                  photoUrl={friend.avatarUrl ?? undefined}
                                  size="sm"
                                />
                                <div className="min-w-[160px] flex-1">
                                  <p className="text-sm font-semibold text-white">{friend.displayName}</p>
                                  {friend.lastEventTitle ? (
                                    <p className="text-xs text-white/60">Last joined: {friend.lastEventTitle}</p>
                                  ) : null}
                                  <p className="text-[11px] text-white/50">{lastActiveLabel}</p>
                                  {inviteHistoryLabel ? (
                                    <p className="text-[11px] text-white/50">{inviteHistoryLabel}</p>
                                  ) : null}
                                  {alreadyInvitedLabel ? (
                                    <p className="text-[11px] font-semibold text-primary/80">{alreadyInvitedLabel}</p>
                                  ) : null}
                                  {eventInviteLocked && alreadyInvitedLabel ? (
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      {eventInviteLockLabel ? (
                                        <p className="text-[11px] font-semibold text-amber-200">{eventInviteLockLabel}</p>
                                      ) : null}
                                      {eventInviteOverrideAvailable && currentEventInviteAtISO ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleHostFriendEventInviteOverride(friend.joinRequestId, currentEventInviteAtISO)
                                          }
                                          className="rounded-full border border-white/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/40"
                                        >
                                          Re-invite anyway
                                        </button>
                                      ) : null}
                                    </div>
                                  ) : null}
                                  {inviteCooldownLabel ? (
                                    <p className="text-[11px] font-semibold text-amber-300">{inviteCooldownLabel}</p>
                                  ) : null}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleHostFriendUseTemplate(friend.joinRequestId, friend.displayName, hostFriendTemplateId)
                                    }
                                    className="text-[11px] font-semibold text-primary/80 transition hover:text-primary"
                                    disabled={composerBusy || inviteGuardrailActive || eventInviteLocked}
                                  >
                                    Use template
                                  </button>
                                  <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/60">
                                    <input
                                      type="checkbox"
                                      className="h-3.5 w-3.5 rounded border border-white/30 bg-black/40 text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                                      checked={isSelected}
                                      onChange={() => handleHostFriendSelectionToggle(friend.joinRequestId)}
                                      aria-label={`Select ${friend.displayName}`}
                                      disabled={hostFriendSelectionStatus === "sending" || inviteGuardrailActive || eventInviteLocked}
                                    />
                                    <span>{isSelected ? "Selected" : "Select"}</span>
                                  </label>
                                </div>
                              </div>
                              <textarea
                                rows={2}
                                value={composerValue}
                                onChange={(event) => handleHostFriendComposerChange(friend.joinRequestId, event.target.value)}
                                placeholder={`Tell ${friend.displayName.split(' ')[0] ?? friend.displayName} why this night fits them`}
                                className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/40 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
                                disabled={composerBusy || inviteGuardrailActive || eventInviteLocked}
                              />
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleHostFriendInviteSend(friend.joinRequestId)}
                                  className="rounded-xl bg-primary/80 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60"
                                  disabled={sendDisabled}
                                >
                                  {composerBusy ? "Sending…" : "Send DM"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleHostFriendComposerClear(friend.joinRequestId)}
                                  className="text-[11px] font-semibold text-white/60 transition hover:text-white"
                                  disabled={composerBusy || composerValue.length === 0 || eventInviteLocked}
                                >
                                  Clear
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
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
              {isGuestViewer && guestMessagePreviewEntries.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Latest in chat</p>
                  <ul className="mt-2 space-y-2">
                    {guestMessagePreviewEntries.map((message) => (
                      <li key={message.id} className="rounded-xl border border-white/5 bg-black/30 px-3 py-2">
                        <div className="flex items-center justify-between gap-3 text-[11px] text-white/60">
                          <p className="font-semibold text-white">
                            {message.isViewer ? "You" : message.authorName}
                          </p>
                          <span>{formatRelativeTime(message.postedAtISO)}</span>
                        </div>
                        <p className="mt-1 text-sm text-white/70 line-clamp-2">{message.content}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {chatCtaHref ? (
                <Link
                  href={chatCtaHref}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-primary/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {chatCtaLabel}
                </Link>
              ) : isPublicViewer ? (
                <button
                  type="button"
                  onClick={handleJoinRequest}
                  disabled={joinRequestStatus !== "idle"}
                  className="mt-4 w-full rounded-xl bg-primary/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {joinRequestStatus === "submitting" ? "Sending request..." : joinRequestStatus === "submitted" ? "Request sent!" : chatCtaLabel}
                </button>
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

const isInviteGuardrailActive = (value?: string | null) => {
  const timestamp = parseIsoTimestamp(value);
  return typeof timestamp === "number" && timestamp > Date.now();
};

const getEventInviteCooldownUntil = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const timestamp = parseIsoTimestamp(value);
  if (typeof timestamp !== "number") {
    return null;
  }
  return new Date(timestamp + HOST_FRIEND_INVITE_COOLDOWN_MS).toISOString();
};

const isEventInviteCooldownActive = (value?: string | null) => {
  const cooldownUntil = getEventInviteCooldownUntil(value);
  return isInviteGuardrailActive(cooldownUntil);
};

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

function buildEventInviteShareText(event: EventInsideExperienceProps["event"]) {
  const parts: string[] = [`Join me at "${event.title}"`];
  const when = formatEventShareMoment(event.startDateISO);
  if (when) {
    parts.push(`on ${when}`);
  }
  const locationLabel = event.locationName?.trim();
  if (locationLabel) {
    parts.push(`near ${locationLabel}`);
  }
  parts.push('Request access on Tonight.');
  return parts.join(' ');
}

function buildHostFriendInviteTemplates({
  eventTitle,
  eventMomentLabel,
  eventLocationLabel,
  eventShareUrl,
}: {
  eventTitle: string;
  eventMomentLabel?: string | null;
  eventLocationLabel?: string | null;
  eventShareUrl: string;
}): HostFriendInviteTemplateOption[] {
  return HOST_FRIEND_INVITE_TEMPLATE_DEFINITIONS.map((definition) => ({
    id: definition.id,
    label: definition.label,
    helperCopy: definition.helperCopy,
    buildMessage: (displayName: string) =>
      joinInviteSegments(
        definition.buildSegments({
          firstName: extractFirstName(displayName),
          eventTitle,
          eventMomentLabel,
          eventLocationLabel,
          eventShareUrl,
        })
      ),
  }));
}

function buildFallbackHostFriendInviteTemplate({
  displayName,
  eventTitle,
  eventMomentLabel,
  eventLocationLabel,
  eventShareUrl,
}: {
  displayName: string;
  eventTitle: string;
  eventMomentLabel?: string | null;
  eventLocationLabel?: string | null;
  eventShareUrl: string;
}) {
  return joinInviteSegments([
    `Hey ${extractFirstName(displayName)}!`,
    `I'm hosting "${eventTitle}" soon.`,
    eventMomentLabel ? `It starts ${eventMomentLabel}.` : null,
    eventLocationLabel ? `We're near ${eventLocationLabel}.` : null,
    `Pop in via Tonight so I can add you: ${eventShareUrl}`,
  ]);
}

function extractFirstName(displayName?: string | null) {
  if (!displayName) {
    return "friend";
  }
  const trimmed = displayName.trim();
  if (!trimmed) {
    return "friend";
  }
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function joinInviteSegments(segments: Array<string | null | undefined>) {
  return segments.filter((segment) => typeof segment === "string" && segment.trim().length > 0).join(" ");
}

function formatEventShareMoment(value?: string | null) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

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
