"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as SliderPrimitive from "@radix-ui/react-slider";
import {
  Clock,
  Copy,
  List as ListIcon,
  Map as MapIcon,
  MapPin,
  Share2,
  SlidersHorizontal,
  Sparkles,
  ChevronRight,
  X,
} from "lucide-react";

import { MessagesModal } from "@/components/chat/MessagesModal";
import type { ConversationPreview } from "@/components/chat/conversations";
import { DesktopHeader } from "@/components/tonight/DesktopHeader";
import { DesktopSidebar } from "@/components/tonight/DesktopSidebar";
import { MobileActionBar, type MobileNavTarget } from "@/components/tonight/MobileActionBar";
import { MiniMap } from "@/components/tonight/MiniMap";
import { CATEGORY_DEFINITIONS, CATEGORY_ORDER, type CategoryId } from "@/lib/categories";
import { classNames } from "@/lib/classNames";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

import EventMapView, { type MapPoint } from "@/components/EventMapView";
import { AuthStatusMessage } from "@/components/auth/AuthStatusMessage";
import type { AuthUser } from "@/components/auth/AuthProvider";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useSocket } from "@/hooks/useSocket";
import type { SocketMessagePayload } from "@/lib/socket-shared";

const DEFAULT_RADIUS_KM = 10;
const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 50;
const VIEW_MODE_STORAGE_KEY = "tonight:view-mode";
const HOST_UPDATES_FILTER_STORAGE_KEY = "tonight:host-updates-filter";
const HOST_UPDATES_FILTER_QUERY_KEY = "hostUpdates";
const HOST_UPDATES_FILTER_QUERY_VALUE = "new";
const HOST_UPDATES_FILTER_ENABLED = "on";
const HOST_UPDATES_FILTER_DISABLED = "off";

const MAP_HEIGHT_DESKTOP = 520;
const MAP_HEIGHT_MOBILE = 360;

type ViewMode = "list" | "map";
type PrimarySection = "discover" | "people" | "messages";
type JoinRequestStatusValue = "PENDING" | "ACCEPTED" | "REJECTED";
type NearbyEventPayload = {
  id: string;
  title: string;
  description: string;
  datetime: string;
  locationName: string;
  maxParticipants: number;
  distanceMeters?: number | null;
  location: {
    latitude: number;
    longitude: number;
  };
  host?: {
    id: string;
    displayName: string | null;
    photoUrl: string | null;
    initials?: string | null;
  };
  availability?: {
    maxParticipants: number;
    acceptedCount: number;
    spotsRemaining: number;
  };
  hostDisplayName?: string | null;
  hostPhotoUrl?: string | null;
  hostInitials?: string | null;
  spotsRemaining?: number | null;
  viewerJoinRequestStatus?: JoinRequestStatusValue | null;
  hostUpdatesUnseenCount?: number | null;
};

type NearbyEventsResponse = {
  events: NearbyEventPayload[];
  meta: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
  };
};

type LocationStatus = "idle" | "locating" | "ready" | "denied" | "unsupported" | "error";
type EventsStatus = "idle" | "loading" | "success" | "error";

type DecoratedEvent = NearbyEventPayload & {
  datetimeLabel: string | null;
  distanceLabel: string | null;
  categoryId: CategoryId | null;
  hostLabel: string;
  hostInitials: string;
  hostPhotoUrl: string | null;
  spotsRemaining: number | null;
};

const eventHasUnseenHostUpdates = (
  event: Pick<DecoratedEvent, "viewerJoinRequestStatus" | "hostUpdatesUnseenCount">
) => {
  return (
    event.viewerJoinRequestStatus === "ACCEPTED" &&
    typeof event.hostUpdatesUnseenCount === "number" &&
    event.hostUpdatesUnseenCount > 0
  );
};

function formatEventTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function formatDistance(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  if (value >= 1000) {
    const kilometers = value / 1000;
    const precision = kilometers >= 10 ? 0 : 1;
    return `${kilometers.toFixed(precision)} km away`;
  }
  return `${Math.round(value)} m away`;
}

function deriveEventCategory(event: NearbyEventPayload): CategoryId | null {
  const haystack = `${event.title} ${event.description ?? ""}`.toLowerCase();
  for (const category of Object.values(CATEGORY_DEFINITIONS)) {
    if (category.keywords.some((keyword) => haystack.includes(keyword))) {
      return category.id;
    }
  }
  return null;
}

const HOST_FALLBACK_LABEL = "Your host";
const HOST_FALLBACK_INITIALS = "YN";

const buildInitialsFromLabel = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return HOST_FALLBACK_INITIALS;
  }
  const parts = trimmed.split(/\s+/).filter(Boolean).slice(0, 2);
  const initials = parts.map((segment) => segment.charAt(0).toUpperCase()).join('');
  return initials || HOST_FALLBACK_INITIALS;
};

const deriveHostLabel = (event: NearbyEventPayload) => {
  return (event.host?.displayName ?? event.hostDisplayName ?? '').trim() || HOST_FALLBACK_LABEL;
};

const deriveHostInitials = (event: NearbyEventPayload, hostLabel: string) => {
  const provided = event.host?.initials ?? event.hostInitials ?? null;
  if (provided && provided.trim()) {
    return provided.trim().slice(0, 2).toUpperCase();
  }
  if (!hostLabel) {
    return HOST_FALLBACK_INITIALS;
  }
  return buildInitialsFromLabel(hostLabel);
};

const deriveHostPhotoUrl = (event: NearbyEventPayload) => {
  return event.host?.photoUrl ?? event.hostPhotoUrl ?? null;
};

const deriveSpotsRemaining = (event: NearbyEventPayload) => {
  if (typeof event.availability?.spotsRemaining === 'number') {
    return Math.max(event.availability.spotsRemaining, 0);
  }
  if (typeof event.spotsRemaining === 'number') {
    return Math.max(event.spotsRemaining, 0);
  }
  if (typeof event.maxParticipants === 'number') {
    const accepted = event.availability?.acceptedCount ?? 0;
    return Math.max(event.maxParticipants - accepted, 0);
  }
  return null;
};

const formatSpotsLabel = (value: number | null) => {
  if (value === null || typeof value === 'undefined') {
    return null;
  }
  if (value <= 0) {
    return 'No spots left';
  }
  return value === 1 ? '1 spot left' : `${value} spots left`;
};

const copyTextToClipboard = async (value: string) => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const successful = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!successful) {
    throw new Error('execCommand copy failed');
  }
};

export default function HomePage() {
  const { status: authStatus, user: authUser } = useRequireAuth();

  if (authStatus === "loading") {
    return <AuthStatusMessage label="Checking your session…" />;
  }

  if (authStatus === "unauthenticated") {
    return <AuthStatusMessage label="Redirecting you to the welcome screen…" />;
  }

  if (authStatus === "error") {
    return <AuthStatusMessage label="We couldn't verify your session. Refresh to try again." />;
  }

  return <AuthenticatedHomePage currentUser={authUser ?? null} />;
}

function AuthenticatedHomePage({ currentUser }: { currentUser: AuthUser | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams?.toString() ?? "";
  const handleCreate = useCallback(() => router.push("/events/create"), [router]);
  const [messagesModalOpen, setMessagesModalOpen] = useState(false);
  const explicitViewParam = searchParams?.get("view");
  const derivedPrimarySection = useMemo<MobileNavTarget>(() => {
    if (messagesModalOpen) {
      return "messages";
    }
    if (!pathname) {
      return "discover";
    }
    if (pathname.startsWith("/people")) {
      return "people";
    }
    if (pathname.startsWith("/messages") || pathname.startsWith("/chat")) {
      return "messages";
    }
    if (pathname.startsWith("/profile")) {
      return "profile";
    }
    if (pathname.startsWith("/events/create")) {
      return "create";
    }
    return "discover";
  }, [messagesModalOpen, pathname]);
  const desktopPrimarySection: PrimarySection =
    derivedPrimarySection === "people"
      ? "people"
      : derivedPrimarySection === "messages"
        ? "messages"
        : "discover";
  const handleCloseMessages = useCallback(() => {
    setMessagesModalOpen(false);
  }, []);
  const handleToggleMessages = useCallback(() => {
    setMessagesModalOpen((current) => !current);
  }, []);
  const handleNavigateDiscover = useCallback(() => {
    handleCloseMessages();
    router.push("/");
  }, [handleCloseMessages, router]);
  const handleNavigatePeople = useCallback(() => {
    setMessagesModalOpen(false);
    router.push("/people");
  }, [router]);
  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      if (conversationId.startsWith("demo-")) {
        return;
      }
      setMessagesModalOpen(false);
      router.push(`/chat/${conversationId}`);
    },
    [router]
  );
  const messagesEmptyStateAction = useMemo(
    () => ({ label: "Browse Discover", onAction: handleCloseMessages }),
    [handleCloseMessages]
  );
  const initialView: ViewMode = explicitViewParam === "map" ? "map" : "list";
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<MapPoint | null>(null);
  const [events, setEvents] = useState<NearbyEventPayload[]>([]);
  const [eventsStatus, setEventsStatus] = useState<EventsStatus>("idle");
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [searchMeta, setSearchMeta] = useState<NearbyEventsResponse["meta"] | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [showOnlyHostUpdates, setShowOnlyHostUpdates] = useState(false);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [pendingRadiusKm, setPendingRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [rangeSheetOpen, setRangeSheetOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const hostUpdatesQueryValueRef = useRef(searchParams?.get(HOST_UPDATES_FILTER_QUERY_KEY) ?? null);
  const hostUpdatesPrefInitializedRef = useRef(false);
  const hostUpdatesShareUrl = useMemo(() => {
    if (typeof window === 'undefined' || !pathname) {
      return null;
    }
    const params = new URLSearchParams(searchParamsString);
    params.set(HOST_UPDATES_FILTER_QUERY_KEY, HOST_UPDATES_FILTER_QUERY_VALUE);
    const queryString = params.toString();
    return `${window.location.origin}${pathname}${queryString ? `?${queryString}` : ''}`;
  }, [pathname, searchParamsString]);

  const unreadMessageCount = useMemo(
    () => conversations.reduce((total, conversation) => total + (conversation.unreadCount ?? 0), 0),
    [conversations]
  );
  const handleSelectEvent = useCallback(
    (eventId: string) => {
      setSelectedEventId(eventId);
      router.push(`/events/${eventId}`);
    },
    [router]
  );

  const fetchConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/conversations');
      if (!response.ok) {
        throw new Error('Failed to load conversations');
      }
      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setConversations([]);
    }
  }, []);

  // Real-time updates for conversation list
  const handleMessageReceived = useCallback((payload: SocketMessagePayload) => {
    setConversations(prev => {
      const updated = prev.map(conv => {
        if (conv.id === payload.joinRequestId) {
          return {
            ...conv,
            messageSnippet: payload.content,
            updatedAtLabel: 'Just now',
            // Increment unread if message from other user
            unreadCount: payload.senderId !== currentUser?.id
              ? (conv.unreadCount ?? 0) + 1
              : conv.unreadCount ?? 0
          };
        }
        return conv;
      });

      // Move updated conversation to top
      const updatedConvIndex = updated.findIndex(c => c.id === payload.joinRequestId);
      if (updatedConvIndex > 0) {
        const [updatedConv] = updated.splice(updatedConvIndex, 1);
        updated.unshift(updatedConv);
      }

      return updated;
    });
  }, [currentUser?.id]);

  // Connect to Socket.IO for real-time updates
  useSocket({
    token: null, // Token read from cookies automatically
    autoConnect: true,
    onMessage: handleMessageReceived
  });

  useEffect(() => {
    if (currentUser) {
      fetchConversations();
    }
  }, [currentUser, fetchConversations]);

  useEffect(() => {
    if (explicitViewParam === "map" || explicitViewParam === "list") {
      setViewMode((current) => (current === explicitViewParam ? current : (explicitViewParam as ViewMode)));
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (stored === "map" || stored === "list") {
        setViewMode((current) => (current === stored ? current : (stored as ViewMode)));
      }
    } catch (error) {
      console.warn("Unable to read persisted view mode", error);
    }
  }, [explicitViewParam]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch (error) {
      console.warn("Unable to persist view mode", error);
    }
  }, [viewMode]);

  useEffect(() => {
    const queryValue = searchParams?.get(HOST_UPDATES_FILTER_QUERY_KEY) ?? null;
    const previousValue = hostUpdatesQueryValueRef.current;
    hostUpdatesQueryValueRef.current = queryValue;

    if (queryValue === HOST_UPDATES_FILTER_QUERY_VALUE) {
      hostUpdatesPrefInitializedRef.current = true;
      setShowOnlyHostUpdates(true);
      return;
    }

    if (previousValue === HOST_UPDATES_FILTER_QUERY_VALUE && queryValue !== HOST_UPDATES_FILTER_QUERY_VALUE) {
      hostUpdatesPrefInitializedRef.current = true;
      setShowOnlyHostUpdates(false);
      return;
    }

    if (!hostUpdatesPrefInitializedRef.current) {
      if (typeof window === "undefined") {
        hostUpdatesPrefInitializedRef.current = true;
        return;
      }
      try {
        const stored = window.localStorage.getItem(HOST_UPDATES_FILTER_STORAGE_KEY);
        setShowOnlyHostUpdates(stored === HOST_UPDATES_FILTER_ENABLED);
      } catch (error) {
        console.warn("Unable to read host updates filter preference", error);
        setShowOnlyHostUpdates(false);
      }
      hostUpdatesPrefInitializedRef.current = true;
    }
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(
        HOST_UPDATES_FILTER_STORAGE_KEY,
        showOnlyHostUpdates ? HOST_UPDATES_FILTER_ENABLED : HOST_UPDATES_FILTER_DISABLED
      );
    } catch (error) {
      console.warn("Unable to persist host updates filter preference", error);
    }
  }, [showOnlyHostUpdates]);

  useEffect(() => {
    if (!pathname) {
      return;
    }
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    const queryActive = params.get(HOST_UPDATES_FILTER_QUERY_KEY) === HOST_UPDATES_FILTER_QUERY_VALUE;
    if (queryActive === showOnlyHostUpdates) {
      return;
    }
    if (showOnlyHostUpdates) {
      params.set(HOST_UPDATES_FILTER_QUERY_KEY, HOST_UPDATES_FILTER_QUERY_VALUE);
    } else {
      params.delete(HOST_UPDATES_FILTER_QUERY_KEY);
    }
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [pathname, router, searchParams, showOnlyHostUpdates]);

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);

      if (!pathname) {
        return;
      }

      const currentParam = searchParams?.get("view");
      const normalizedCurrent: ViewMode = currentParam === "map" ? "map" : "list";
      if (normalizedCurrent === mode) {
        return;
      }

      const nextParams = new URLSearchParams(searchParams?.toString() ?? "");
      if (mode === "list") {
        nextParams.delete("view");
      } else {
        nextParams.set("view", mode);
      }

      const queryString = nextParams.toString();
      const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(nextUrl, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const fetchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const handleChange = () => setIsDesktop(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const describeLocation = useMemo(() => {
    switch (locationStatus) {
      case "locating":
        return "Detecting your location…";
      case "ready":
        if (!userLocation) return "Location ready";
        return `${formatCoordinate(userLocation.latitude)}, ${formatCoordinate(userLocation.longitude)}`;
      case "denied":
        return locationError ?? "Location permission denied.";
      case "unsupported":
        return "Your browser does not support geolocation.";
      case "error":
        return locationError ?? "Unable to determine your location.";
      default:
        return "Waiting for location access…";
    }
  }, [locationError, locationStatus, userLocation]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastFetchedAt) {
      return "Never";
    }
    try {
      return new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(lastFetchedAt);
    } catch {
      return lastFetchedAt.toLocaleTimeString();
    }
  }, [lastFetchedAt]);

  const attemptLocationDetection = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setLocationStatus("unsupported");
      setLocationError("Geolocation is not available in this browser.");
      return;
    }

    setLocationStatus("locating");
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationStatus("ready");
        setLocationError(null);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationStatus("denied");
          setLocationError("We need your permission to find events nearby.");
        } else {
          setLocationStatus("error");
          setLocationError("Unable to determine your location. Try again in a moment.");
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  }, []);

  const fetchEventsForLocation = useCallback(
    async (coords: MapPoint, overrideRadiusKm?: number) => {
      fetchAbortRef.current?.abort();
      const controller = new AbortController();
      fetchAbortRef.current = controller;

      setEventsStatus("loading");
      setEventsError(null);

      const params = new URLSearchParams({
        lat: coords.latitude.toString(),
        lng: coords.longitude.toString(),
      });

      const radiusValue = Math.round((overrideRadiusKm ?? radiusKm) * 1000);
      params.set("radius", radiusValue.toString());

      try {
        const response = await fetch(`/api/events/nearby?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to load events");
        }

        const payload = (await response.json()) as NearbyEventsResponse;
        setEvents(payload.events ?? []);
        setSearchMeta(payload.meta ?? null);
        setEventsStatus("success");
        setLastFetchedAt(new Date());
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        console.error("Failed to fetch nearby events", error);
        setEventsStatus("error");
        setEventsError("Unable to load nearby events. Please try again.");
      }
    },
    [radiusKm]
  );

  useEffect(() => {
    attemptLocationDetection();
    return () => {
      fetchAbortRef.current?.abort();
    };
  }, [attemptLocationDetection]);

  useEffect(() => {
    if (!userLocation) {
      return;
    }
    fetchEventsForLocation(userLocation).catch((error) => {
      console.error("Unexpected error while fetching events", error);
    });
  }, [fetchEventsForLocation, userLocation]);

  useEffect(() => {
    if (!searchMeta?.radiusMeters) {
      return;
    }
    const km = Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, Number(searchMeta.radiusMeters) / 1000));
    setRadiusKm(km);
    setPendingRadiusKm(km);
  }, [searchMeta?.radiusMeters]);

  const decoratedEvents = useMemo<DecoratedEvent[]>(() => {
    return events.map((event) => {
      const hostLabel = deriveHostLabel(event);
      return {
        ...event,
        datetimeLabel: formatEventTime(event.datetime ?? null),
        distanceLabel: formatDistance(event.distanceMeters ?? null),
        categoryId: deriveEventCategory(event),
        hostLabel,
        hostInitials: deriveHostInitials(event, hostLabel),
        hostPhotoUrl: deriveHostPhotoUrl(event),
        spotsRemaining: deriveSpotsRemaining(event),
      };
    });
  }, [events]);

  const hostUpdatesEligibleCount = useMemo(() => {
    return decoratedEvents.filter((event) => eventHasUnseenHostUpdates(event)).length;
  }, [decoratedEvents]);

  const visibleEvents = useMemo(() => {
    let next = decoratedEvents;
    if (selectedCategory) {
      next = next.filter((event) => event.categoryId === selectedCategory);
    }
    if (showOnlyHostUpdates) {
      next = next.filter((event) => eventHasUnseenHostUpdates(event));
    }
    return next;
  }, [decoratedEvents, selectedCategory, showOnlyHostUpdates]);

  useEffect(() => {
    setSelectedEventId((previous) => {
      if (!visibleEvents.length) {
        return null;
      }
      if (previous && visibleEvents.some((event) => event.id === previous)) {
        return previous;
      }
      return null;
    });
  }, [visibleEvents]);

  useEffect(() => {
    if (eventsStatus !== "success") {
      return;
    }
    if (!hostUpdatesEligibleCount && showOnlyHostUpdates) {
      setShowOnlyHostUpdates(false);
    }
  }, [eventsStatus, hostUpdatesEligibleCount, showOnlyHostUpdates]);

  const handleRefresh = useCallback(() => {
    if (userLocation) {
      fetchEventsForLocation(userLocation).catch((error) => {
        console.error("Refresh failed", error);
      });
      return;
    }
    attemptLocationDetection();
  }, [attemptLocationDetection, fetchEventsForLocation, userLocation]);

  const applyRadiusChange = useCallback(() => {
    setRadiusKm(pendingRadiusKm);
    if (userLocation) {
      fetchEventsForLocation(userLocation, pendingRadiusKm).catch((error) => {
        console.error("Radius refresh failed", error);
      });
    }
    setRangeSheetOpen(false);
  }, [fetchEventsForLocation, pendingRadiusKm, userLocation]);

  const openRangeSheet = useCallback(() => {
    setPendingRadiusKm(radiusKm);
    setRangeSheetOpen(true);
  }, [radiusKm]);

  const mapItems = useMemo(() => {
    return visibleEvents.map((event) => ({
      id: event.id,
      title: event.title,
      locationName: event.locationName,
      location: { ...event.location },
      datetimeISO: event.datetime,
      distanceMeters: event.distanceMeters ?? undefined,
      viewerJoinRequestStatus: event.viewerJoinRequestStatus ?? null,
      hostUpdatesUnseenCount: typeof event.hostUpdatesUnseenCount === 'number' ? event.hostUpdatesUnseenCount : null,
    }));
  }, [visibleEvents]);

  const locationReady = locationStatus === "ready" && !!userLocation;
  const isLoading =
    locationStatus === "locating" || (eventsStatus === "loading" && visibleEvents.length === 0);

  return (
    <>
      <div className="flex h-dvh flex-col overflow-hidden text-foreground md:flex-row md:h-auto md:min-h-dvh">
        <DesktopSidebar
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          onCreate={handleCreate}
          onNavigateDiscover={handleNavigateDiscover}
          onNavigatePeople={handleNavigatePeople}
          onNavigateMessages={handleToggleMessages}
          activePrimaryNav={desktopPrimarySection}
        />

        <div className="flex flex-1 flex-col">
          <DesktopHeader
            title="Discover"
            subtitle="Events near you"
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            onNavigateProfile={() => router.push("/profile")}
            onNavigateMessages={handleToggleMessages}
            unreadCount={unreadMessageCount}
            userDisplayName={currentUser?.displayName ?? null}
            userEmail={currentUser?.email ?? null}
            userPhotoUrl={currentUser?.photoUrl ?? null}
          />

          <MobileHero
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            radiusKm={radiusKm}
            onOpenRange={openRangeSheet}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />

          <main className="flex-1 overflow-y-auto pb-20 pt-0 md:px-10 md:pb-12 md:pt-8">
            <div className="mx-auto w-full max-w-5xl px-4 md:px-0">
              <section className="mt-4 flex flex-col gap-4">
                {locationStatus === "denied" || locationStatus === "unsupported" ? (
                  <AlertPanel
                    title="Turn on location services"
                    description={
                      locationError ??
                      "We need access to your approximate location to find pop-up events around you."
                    }
                    actionLabel="Retry"
                    onAction={attemptLocationDetection}
                  />
                ) : locationStatus === "error" ? (
                  <AlertPanel
                    title="Location unavailable"
                    description={locationError ?? "Unable to determine your location right now."}
                    actionLabel="Try again"
                    onAction={attemptLocationDetection}
                  />
                ) : eventsStatus === "error" ? (
                  <AlertPanel
                    title="Couldn't load nearby events"
                    description={eventsError ?? "Please try again in a moment."}
                    actionLabel="Refresh"
                    onAction={handleRefresh}
                  />
                ) : null}

                {locationStatus !== "ready" && locationStatus !== "locating" && (
                  <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 shadow-lg shadow-primary/10">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-semibold text-foreground">Enable location access</p>
                        <p className="text-xs text-muted-foreground">
                          We need your location to show events happening near you.
                        </p>
                        <button
                          type="button"
                          onClick={attemptLocationDetection}
                          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md transition hover:brightness-110"
                        >
                          Grant access
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {isLoading && <DiscoverySkeleton viewMode={viewMode} />}

                {!isLoading && decoratedEvents.length > 0 && (
                  <HostUpdatesFilterToggle
                    active={showOnlyHostUpdates}
                    availableCount={hostUpdatesEligibleCount}
                    onToggle={() => setShowOnlyHostUpdates((current) => !current)}
                    shareUrl={hostUpdatesShareUrl}
                  />
                )}

                {!isLoading && viewMode === "map" && (
                  <div className="overflow-hidden rounded-3xl border border-border/70 bg-background/40">
                    <div className="border-b border-border/60 bg-card/40 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Filter events
                        </p>
                        {selectedCategory && (
                          <button
                            type="button"
                            onClick={() => setSelectedCategory(null)}
                            className="text-[11px] font-semibold text-primary transition hover:text-primary/80"
                          >
                            Clear filter
                          </button>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                        {CATEGORY_ORDER.filter((id) => id !== "all").map((categoryId) => {
                          const category = CATEGORY_DEFINITIONS[categoryId];
                          if (!category) return null;
                          const isSelected = selectedCategory === category.id;
                          return (
                            <button
                              key={category.id}
                              type="button"
                              onClick={() => setSelectedCategory(isSelected ? null : category.id)}
                              className={classNames(
                                "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                                isSelected
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground"
                              )}
                            >
                              <category.icon className="h-4 w-4" />
                              {category.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <EventMapView
                      events={mapItems}
                      userLocation={userLocation || undefined}
                      selectedEventId={selectedEventId}
                      onEventSelect={handleSelectEvent}
                      height={isDesktop ? MAP_HEIGHT_DESKTOP : MAP_HEIGHT_MOBILE}
                    />
                  </div>
                )}

                {!isLoading && viewMode === "list" && (
                  <DiscoveryList
                    events={visibleEvents}
                    selectedEventId={selectedEventId}
                    onSelect={handleSelectEvent}
                    locationReady={locationReady}
                    radiusSummary={buildRadiusSummary(radiusKm)}
                    hostUpdatesFilterActive={showOnlyHostUpdates}
                    onClearHostUpdatesFilter={() => setShowOnlyHostUpdates(false)}
                  />
                )}
              </section>
            </div>
          </main>
        </div>
      </div>

      <MobileActionBar
        active={derivedPrimarySection}
        onNavigateDiscover={handleNavigateDiscover}
        onNavigatePeople={handleNavigatePeople}
        onNavigateMessages={handleToggleMessages}
        onCreate={handleCreate}
        onOpenProfile={() => router.push("/profile")}
        messagesUnreadCount={unreadMessageCount}
      />

      {rangeSheetOpen && (
        <RangeSheet
          value={pendingRadiusKm}
          onChange={setPendingRadiusKm}
          onClose={() => setRangeSheetOpen(false)}
          onApply={applyRadiusChange}
        />
      )}

      <MessagesModal
        isOpen={messagesModalOpen}
        onClose={handleCloseMessages}
        conversations={conversations}
        onSelectConversation={handleSelectConversation}
        emptyStateAction={messagesEmptyStateAction}
      />
    </>
  );
}

type DiscoveryPrimaryNavProps = {
  activeSection: PrimarySection;
  unreadCount: number;
  onSelectDiscover: () => void;
  onSelectPeople: () => void;
  onToggleMessages: () => void;
};

function DiscoveryPrimaryNav({
  activeSection,
  unreadCount,
  onSelectDiscover,
  onSelectPeople,
  onToggleMessages,
}: DiscoveryPrimaryNavProps) {
  return (
    <nav className="hidden border-b border-white/5 bg-background/80 px-10 py-3 text-sm text-muted-foreground md:flex">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSelectDiscover}
          className={classNames(
            "rounded-full px-4 py-2 font-semibold transition",
            activeSection === "discover"
              ? "bg-primary text-primary-foreground shadow-[0_12px_30px_rgba(62,36,255,0.35)]"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-pressed={activeSection === "discover"}
        >
          Discover tonight
        </button>
        <button
          type="button"
          onClick={onSelectPeople}
          className={classNames(
            "rounded-full px-4 py-2 font-semibold transition",
            activeSection === "people"
              ? "bg-primary text-primary-foreground shadow-[0_12px_30px_rgba(62,36,255,0.35)]"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-pressed={activeSection === "people"}
        >
          People nearby
        </button>
        <button
          type="button"
          onClick={onToggleMessages}
          className={classNames(
            "flex items-center gap-2 rounded-full px-4 py-2 font-semibold transition",
            activeSection === "messages"
              ? "bg-primary text-primary-foreground shadow-[0_12px_30px_rgba(62,36,255,0.35)]"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-pressed={activeSection === "messages"}
        >
          Messages
          {unreadCount > 0 && (
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}

type MobileHeroProps = {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  radiusKm: number;
  onOpenRange: () => void;
  selectedCategory: CategoryId | null;
  onCategoryChange: (category: CategoryId | null) => void;
};

function MobileHero({
  viewMode,
  onViewModeChange,
  radiusKm,
  onOpenRange,
  selectedCategory,
  onCategoryChange,
}: MobileHeroProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 pb-3 pt-[calc(env(safe-area-inset-top)+16px)] text-foreground shadow-[0_12px_32px_rgba(2,6,23,0.65)] backdrop-blur-lg md:hidden">
      <div className="mb-3 flex items-center justify-between gap-2 px-4">
        <div>
          <h1 className="text-2xl font-serif font-semibold leading-tight">Discover</h1>
          <p className="text-xs text-muted-foreground">Events near you</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-card/60 p-1">
            <button
              type="button"
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
              onClick={() => onViewModeChange('list')}
              className={classNames(
                'rounded-lg px-2 py-1.5 transition-colors',
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <ListIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Map view"
              aria-pressed={viewMode === 'map'}
              onClick={() => onViewModeChange('map')}
              className={classNames(
                'rounded-lg px-2 py-1.5 transition-colors',
                viewMode === 'map'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <MapIcon className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={onOpenRange}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {Math.round(radiusKm)} km
          </button>
        </div>
      </div>

      <div className="-mx-4 overflow-hidden">
        <div className="px-4 pb-1">
          <CategoryRow
            selectedCategory={selectedCategory}
            onCategoryChange={onCategoryChange}
            compact
            showLabel={false}
          />
        </div>
      </div>
    </header>
  );
}

type DiscoverySummaryProps = {
  describeLocation: string;
  lastUpdatedLabel: string;
  rangeSummary: string;
  onUpdateLocation: () => void;
  onRefresh: () => void;
  onAdjustRange?: () => void;
  locationStatus: LocationStatus;
  eventsStatus: EventsStatus;
};

function DiscoverySummary({
  describeLocation,
  lastUpdatedLabel,
  rangeSummary,
  onUpdateLocation,
  onRefresh,
  onAdjustRange,
  locationStatus,
  eventsStatus,
}: DiscoverySummaryProps) {
  return (
    <div className="grid gap-3 md:grid-cols-3 md:gap-4">
      <div className="rounded-2xl border border-border/70 bg-card/40 p-4 shadow-sm shadow-black/20">
        <div className="flex items-center justify-between text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location</p>
            <p className="text-sm font-semibold text-foreground">{describeLocation}</p>
          </div>
          <button
            type="button"
            onClick={onUpdateLocation}
            className="rounded-full border border-border/80 px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary"
          >
            {locationStatus === "locating" ? "Locating…" : "Update"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">We use this to surface hosts near you.</p>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/40 p-4 shadow-sm shadow-black/20">
        <div className="flex items-center justify-between text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Range</p>
            <p className="text-sm font-semibold text-foreground">{rangeSummary}</p>
          </div>
          <div className="flex items-center gap-2">
            {typeof onAdjustRange === "function" && (
              <button
                type="button"
                onClick={onAdjustRange}
                className="rounded-full border border-border/80 px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary"
              >
                Adjust
              </button>
            )}
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-full border border-border/80 px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary"
            >
              {eventsStatus === "loading" ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {onAdjustRange
            ? "Change how far out we look or refresh results whenever things feel stale."
            : "Adjust the radius from the list or map controls."}
        </p>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/40 p-4 shadow-sm shadow-black/20">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last updated</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{lastUpdatedLabel}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Tap refresh anytime to pull the latest nearby plans.
        </p>
      </div>
    </div>
  );
}

type CategoryRowProps = {
  selectedCategory: CategoryId | null;
  onCategoryChange: (category: CategoryId | null) => void;
  compact?: boolean;
  showLabel?: boolean;
};

function CategoryRow({ selectedCategory, onCategoryChange, compact = false, showLabel = true }: CategoryRowProps) {
  return (
    <div className="space-y-2">
      {showLabel && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Categories</span>
          {selectedCategory && (
            <button
              type="button"
              onClick={() => onCategoryChange(null)}
              className="text-[11px] font-medium text-primary"
            >
              Clear
            </button>
          )}
        </div>
      )}
      <div
        data-testid={compact ? "mobile-category-scroll" : undefined}
        className={classNames(
          "flex gap-2",
          compact ? "overflow-x-auto pb-1 pr-4 pl-4" : "flex-wrap"
        )}
        style={
          compact
            ? {
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }
            : undefined
        }
      >
        {CATEGORY_ORDER.map((entry) => {
          if (entry === "all") {
            return (
              <button
                key="all"
                type="button"
                onClick={() => onCategoryChange(null)}
                className={classNames(
                  "flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium",
                  selectedCategory === null
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/70 bg-card/60 text-muted-foreground"
                )}
              >
                <Sparkles className="h-4 w-4" />
                All
              </button>
            );
          }
          const definition = CATEGORY_DEFINITIONS[entry];
          const Icon = definition.icon;
          return (
            <button
              key={definition.id}
              type="button"
              onClick={() => onCategoryChange(definition.id)}
              className={classNames(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
                selectedCategory === definition.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/70 bg-card/60 text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {definition.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type DiscoveryListProps = {
  events: DecoratedEvent[];
  selectedEventId: string | null;
  onSelect: (eventId: string) => void;
  locationReady: boolean;
  radiusSummary: string;
  hostUpdatesFilterActive?: boolean;
  onClearHostUpdatesFilter?: () => void;
};

export function DiscoveryList({
  events,
  selectedEventId,
  onSelect,
  locationReady,
  radiusSummary,
  hostUpdatesFilterActive = false,
  onClearHostUpdatesFilter,
}: DiscoveryListProps) {
  if (!locationReady) {
    return <DiscoverySkeleton viewMode="list" />;
  }

  if (events.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border/60 bg-card/40 p-10 text-center text-sm text-muted-foreground">
        {hostUpdatesFilterActive ? (
          <div className="space-y-4">
            <p>No events with new host updates within {radiusSummary}.</p>
            {typeof onClearHostUpdatesFilter === "function" && (
              <button
                type="button"
                onClick={onClearHostUpdatesFilter}
                className="inline-flex items-center justify-center rounded-full border border-border/70 px-4 py-2 text-xs font-semibold text-primary transition hover:border-primary hover:text-primary"
              >
                Show all nearby events
              </button>
            )}
          </div>
        ) : (
          <p>No nearby events yet within {radiusSummary}. Try widening your radius or refreshing.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {events.map((event) => {
        const definition = event.categoryId ? CATEGORY_DEFINITIONS[event.categoryId] : null;
        const Icon = definition?.icon ?? Sparkles;
        const spotsLabel = formatSpotsLabel(event.spotsRemaining);
        const hasCoordinates =
          typeof event.location?.latitude === "number" && typeof event.location?.longitude === "number";
        const viewerIsAcceptedGuest = event.viewerJoinRequestStatus === "ACCEPTED";
        const hostUpdatesUnseen =
          viewerIsAcceptedGuest && typeof event.hostUpdatesUnseenCount === "number" && event.hostUpdatesUnseenCount > 0
            ? event.hostUpdatesUnseenCount
            : null;
        const hostUpdatesIndicator =
          typeof hostUpdatesUnseen === "number" && hostUpdatesUnseen > 0
            ? {
                value: hostUpdatesUnseen > 99 ? "99+" : hostUpdatesUnseen.toString(),
                plural: hostUpdatesUnseen > 1,
              }
            : null;
        return (
          <button
            key={event.id}
            type="button"
            onClick={() => onSelect(event.id)}
            className={classNames(
              "group flex w-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/60 text-left transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.99] md:max-w-[330px]",
              selectedEventId === event.id && "border-primary/60 shadow-primary/20"
            )}
          >
            {hasCoordinates ? (
              <MiniMap
                latitude={event.location.latitude}
                longitude={event.location.longitude}
                locationName={event.locationName}
                className="w-full"
              />
            ) : (
              <div className="h-[156px] w-full border-b border-border/60 bg-secondary/40" />
            )}
            <div className="flex flex-1 flex-col gap-3 border-t border-border/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <div
                    className={classNames(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-sm",
                      definition?.accent ?? "border-border/70 bg-background/60"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight text-foreground">{event.title}</p>
                    <p className="line-clamp-2 min-h-[2.8rem] text-sm leading-[1.4rem] text-muted-foreground">
                      {event.description ?? "Host will share details once you request to join."}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                {event.datetimeLabel && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {event.datetimeLabel}
                  </span>
                )}
                {event.distanceLabel && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {event.distanceLabel}
                  </span>
                )}
                {hostUpdatesIndicator && (
                  <span
                    data-testid="host-updates-pill"
                    className="ml-auto inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300"
                  >
                    <Sparkles className="h-3 w-3" aria-hidden />
                    <span>
                      {hostUpdatesIndicator.value} new
                    </span>
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 border-t border-border/50 pt-3">
                <HostAvatar photoUrl={event.hostPhotoUrl} initials={event.hostInitials} label={event.hostLabel} />
                <span className="text-xs text-muted-foreground">{event.hostLabel}</span>
                {spotsLabel && (
                  <span className="ml-auto rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    {spotsLabel}
                  </span>
                )}
                {definition && (
                  <span className={classNames("rounded-full px-2 py-0.5 text-[10px] font-semibold", definition.badge)}>
                    {definition.label}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
        })}
      </div>
    </div>
  );
}

type HostUpdatesFilterToggleProps = {
  active: boolean;
  availableCount: number;
  onToggle: () => void;
  shareUrl: string | null;
};

function HostUpdatesFilterToggle({ active, availableCount, onToggle, shareUrl }: HostUpdatesFilterToggleProps) {
  const disabled = availableCount === 0;
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied">("idle");
  const [shareState, setShareState] = useState<"idle" | "sharing">("idle");
  const [canUseWebShare, setCanUseWebShare] = useState(false);

  useEffect(() => {
    if (copyState !== "copied") {
      return;
    }
    const timeout = window.setTimeout(() => setCopyState("idle"), 2500);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  useEffect(() => {
    setCopyState("idle");
  }, [shareUrl]);

  useEffect(() => {
    if (typeof navigator === "undefined") {
      return;
    }
    setCanUseWebShare(typeof navigator.share === "function");
  }, []);

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl || disabled) {
      return;
    }
    try {
      setCopyState("copying");
      await copyTextToClipboard(shareUrl);
      setCopyState("copied");
      showSuccessToast("Filtered link copied", "Sharing this link highlights events with fresh host updates.");
    } catch (error) {
      console.error("Failed to copy filtered host updates link", error);
      setCopyState("idle");
      showErrorToast("Couldn't copy link", "Copy it manually from the address bar instead.");
    }
  }, [disabled, shareUrl]);

  const handleShareLink = useCallback(async () => {
    if (!shareUrl || disabled || !canUseWebShare || typeof navigator === "undefined" || typeof navigator.share !== "function") {
      return;
    }
    try {
      setShareState("sharing");
      await navigator.share({
        title: "Tonight — host updates near you",
        text: "Here are the plans with fresh host announcements.",
        url: shareUrl,
      });
      showSuccessToast("Share link ready", "Your filtered discovery link is in the native share sheet.");
    } catch (error) {
      const dismissed =
        error instanceof DOMException
          ? error.name === "AbortError"
          : typeof error === "object" && error !== null && "name" in error && (error as { name?: string }).name === "AbortError";
      if (!dismissed) {
        console.error("Failed to share filtered host updates link", error);
        showErrorToast("Couldn't open share sheet", "Copy the link instead.");
      }
    } finally {
      setShareState("idle");
    }
  }, [canUseWebShare, disabled, shareUrl]);

  const copyDisabled = disabled || !shareUrl || copyState === "copying";
  const shareDisabled = disabled || !shareUrl || !canUseWebShare || shareState === "sharing";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/40 px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-foreground">New host updates</p>
        <p className="text-xs text-muted-foreground">
          {disabled
            ? "No fresh host announcements nearby right now."
            : active
              ? "Filtering to events waiting on your attention."
              : "Highlight plans with unseen host announcements."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (!disabled) {
              onToggle();
            }
          }}
          disabled={disabled}
          className={classNames(
            "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition",
            disabled
              ? "cursor-not-allowed border-border/60 text-muted-foreground"
              : active
                ? "border-amber-300/60 bg-amber-400/10 text-amber-100"
                : "border-border/70 text-muted-foreground hover:border-amber-300 hover:text-amber-50"
          )}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {active ? "Showing updates" : "New host updates"}
          {availableCount > 0 && (
            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-50">
              {availableCount > 99 ? "99+" : availableCount}
            </span>
          )}
        </button>
        {canUseWebShare && (
          <button
            type="button"
            onClick={handleShareLink}
            disabled={shareDisabled}
            className={classNames(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
              shareDisabled
                ? "cursor-not-allowed border-border/60 text-muted-foreground"
                : "border-border/70 text-muted-foreground hover:text-foreground"
            )}
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden />
            {shareState === "sharing" ? "Sharing…" : "Share filtered link"}
          </button>
        )}
        <button
          type="button"
          onClick={handleCopyLink}
          disabled={copyDisabled}
          className={classNames(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
            copyDisabled
              ? "cursor-not-allowed border-border/60 text-muted-foreground"
              : "border-border/70 text-muted-foreground hover:text-foreground"
          )}
        >
          <Copy className="h-3.5 w-3.5" aria-hidden />
          {copyState === "copied" ? "Link copied" : copyState === "copying" ? "Copying…" : "Copy filtered link"}
        </button>
      </div>
    </div>
  );
}

type HostAvatarProps = {
  photoUrl: string | null;
  initials: string;
  label: string;
};

function HostAvatar({ photoUrl, initials, label }: HostAvatarProps) {
  if (photoUrl) {
    return (
      <span className="inline-flex h-6 w-6 overflow-hidden rounded-full border border-border/70 bg-card/50">
        <img src={photoUrl} alt={`${label} avatar`} className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-card/50 text-[10px] font-semibold text-foreground">
      {initials}
    </span>
  );
}


type AlertPanelProps = {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
};

function AlertPanel({ title, description, actionLabel, onAction }: AlertPanelProps) {
  return (
    <div className="rounded-3xl border border-amber-400/40 bg-amber-400/10 p-5 text-amber-100">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-amber-100/80">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-4 rounded-full border border-amber-200/60 px-4 py-1.5 text-xs font-semibold text-amber-100"
      >
        {actionLabel}
      </button>
    </div>
  );
}

type RangeSheetProps = {
  value: number;
  onChange: (value: number) => void;
  onApply: () => void;
  onClose: () => void;
};

function RangeSheet({ value, onChange, onApply, onClose }: RangeSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close range selector"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-t-[32px] border border-white/10 bg-[#0a0f21]/95 px-5 pb-8 pt-6 text-white shadow-[0_-32px_120px_rgba(2,6,23,0.75)]">
        <div className="mx-auto mb-4 h-1 w-16 rounded-full bg-white/15" />
        <button
          type="button"
          aria-label="Close range selector"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full border border-white/10 p-1.5 text-white/60 transition hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="space-y-1 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/60">Discovery</p>
          <h2 className="text-2xl font-serif font-semibold text-white">Discovery range</h2>
          <p className="text-sm text-white/70">Fine-tune how far out we should look for nearby plans.</p>
        </div>
        <div className="mt-6 space-y-6">
          <div>
            <div className="flex items-center justify-between text-sm text-white/80">
              <span>Distance</span>
              <span className="font-semibold text-white">{Math.round(value)} km</span>
            </div>
            <SliderPrimitive.Root
              className="relative mt-5 flex h-8 w-full touch-none select-none items-center"
              max={MAX_RADIUS_KM}
              min={MIN_RADIUS_KM}
              step={1}
              value={[value]}
              aria-label="Discovery range"
              onValueChange={([next]) => {
                if (typeof next === "number") {
                  onChange(next);
                }
              }}
            >
              <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-white/12">
                <SliderPrimitive.Range className="absolute h-full rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.45)]" />
              </SliderPrimitive.Track>
              <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-[3px] border-[#050713] bg-white shadow-[0_6px_18px_rgba(0,0,0,0.45)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300" />
            </SliderPrimitive.Root>
            <div className="mt-2 flex items-center justify-between text-xs text-white/50">
              <span>{MIN_RADIUS_KM} km</span>
              <span>{MAX_RADIUS_KM} km</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onApply}
            className="w-full rounded-2xl bg-emerald-400/90 py-3 text-sm font-semibold text-[#051217] shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-300"
          >
            Apply radius
          </button>
        </div>
      </div>
    </div>
  );
}

type DiscoverySkeletonProps = {
  viewMode: ViewMode;
};

function DiscoverySkeleton({ viewMode }: DiscoverySkeletonProps) {
  if (viewMode === "map") {
    return (
      <div className="h-[320px] animate-pulse rounded-3xl border border-border/70 bg-card/40 md:h-[420px]" />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className="h-40 animate-pulse rounded-3xl border border-border/60 bg-card/40"
        />
      ))}
    </div>
  );
}

const formatCoordinate = (value: number) => value.toFixed(4);

const buildRadiusSummary = (radiusKm: number) => `${Math.round(radiusKm)} km radius`;
