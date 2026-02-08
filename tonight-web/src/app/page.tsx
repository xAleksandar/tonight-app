"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  Coffee,
  Compass,
  Dumbbell,
  List as ListIcon,
  Map as MapIcon,
  MapPin,
  Music,
  Plus,
  RefreshCcw,
  SlidersHorizontal,
  Sparkles,
  UtensilsCrossed,
  Waves,
  Clapperboard,
  Users,
  ChevronRight,
} from "lucide-react";

import EventMapView, { type MapPoint } from "@/components/EventMapView";
import { AuthStatusMessage } from "@/components/auth/AuthStatusMessage";
import { useRequireAuth } from "@/hooks/useRequireAuth";

const DEFAULT_RADIUS_KM = 10;
const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 50;

const MAP_HEIGHT_DESKTOP = 520;
const MAP_HEIGHT_MOBILE = 360;

type ViewMode = "list" | "map";
type CategoryId = "cinema" | "food" | "outdoor" | "music" | "fitness" | "social";

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

type CategoryDefinition = {
  id: CategoryId;
  label: string;
  keywords: string[];
  icon: typeof Sparkles;
  accent: string;
  badge: string;
};

type DecoratedEvent = NearbyEventPayload & {
  datetimeLabel: string | null;
  distanceLabel: string | null;
  categoryId: CategoryId | null;
};

const CATEGORY_DEFINITIONS: Record<CategoryId, CategoryDefinition> = {
  cinema: {
    id: "cinema",
    label: "Cinema",
    keywords: ["movie", "film", "cinema", "theater"],
    icon: Clapperboard,
    accent: "bg-sky-500/15 text-sky-200 border-sky-400/30",
    badge: "text-sky-200",
  },
  food: {
    id: "food",
    label: "Food",
    keywords: ["dinner", "eat", "restaurant", "food", "sushi", "pizza", "brunch"],
    icon: UtensilsCrossed,
    accent: "bg-amber-500/15 text-amber-200 border-amber-400/30",
    badge: "text-amber-200",
  },
  outdoor: {
    id: "outdoor",
    label: "Outdoor",
    keywords: ["walk", "hike", "outdoor", "park", "beach"],
    icon: Waves,
    accent: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
    badge: "text-emerald-200",
  },
  music: {
    id: "music",
    label: "Music",
    keywords: ["music", "concert", "band", "dj", "jazz"],
    icon: Music,
    accent: "bg-rose-500/15 text-rose-200 border-rose-400/30",
    badge: "text-rose-200",
  },
  fitness: {
    id: "fitness",
    label: "Fitness",
    keywords: ["gym", "workout", "run", "yoga", "fitness"],
    icon: Dumbbell,
    accent: "bg-lime-500/15 text-lime-200 border-lime-400/30",
    badge: "text-lime-200",
  },
  social: {
    id: "social",
    label: "Social",
    keywords: ["coffee", "board game", "hang", "meet", "social", "drink"],
    icon: Coffee,
    accent: "bg-orange-500/15 text-orange-200 border-orange-400/30",
    badge: "text-orange-200",
  },
};

const CATEGORY_ORDER: (CategoryId | "all")[] = [
  "all",
  "cinema",
  "food",
  "outdoor",
  "music",
  "fitness",
  "social",
];

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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

export default function HomePage() {
  const { status: authStatus } = useRequireAuth();

  if (authStatus === "loading") {
    return <AuthStatusMessage label="Checking your session…" />;
  }

  if (authStatus === "unauthenticated") {
    return <AuthStatusMessage label="Redirecting you to the welcome screen…" />;
  }

  if (authStatus === "error") {
    return <AuthStatusMessage label="We couldn't verify your session. Refresh to try again." />;
  }

  return <AuthenticatedHomePage />;
}

function AuthenticatedHomePage() {
  const router = useRouter();
  const handleCreate = useCallback(() => router.push("/events/create"), [router]);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
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
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [pendingRadiusKm, setPendingRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [rangeSheetOpen, setRangeSheetOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

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
    return events.map((event) => ({
      ...event,
      datetimeLabel: formatEventTime(event.datetime ?? null),
      distanceLabel: formatDistance(event.distanceMeters ?? null),
      categoryId: deriveEventCategory(event),
    }));
  }, [events]);

  const visibleEvents = useMemo(() => {
    if (!selectedCategory) return decoratedEvents;
    return decoratedEvents.filter((event) => event.categoryId === selectedCategory);
  }, [decoratedEvents, selectedCategory]);

  useEffect(() => {
    setSelectedEventId((previous) => {
      if (!visibleEvents.length) {
        return null;
      }
      if (previous && visibleEvents.some((event) => event.id === previous)) {
        return previous;
      }
      return visibleEvents[0]?.id ?? null;
    });
  }, [visibleEvents]);

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

  const mapItems = useMemo(() => {
    return visibleEvents.map((event) => ({
      id: event.id,
      title: event.title,
      locationName: event.locationName,
      location: { ...event.location },
      datetimeISO: event.datetime,
      distanceMeters: event.distanceMeters ?? undefined,
    }));
  }, [visibleEvents]);

  const locationReady = locationStatus === "ready" && !!userLocation;
  const eventsReady = eventsStatus === "success" && visibleEvents.length > 0;
  const isLoading =
    locationStatus === "locating" || (eventsStatus === "loading" && visibleEvents.length === 0);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#101227] via-[#0f1324] to-[#0a0d1c] px-4 pb-24 pt-4 text-white sm:px-6 md:pb-12 md:pt-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 md:flex-row md:gap-10">
        <DesktopSidebar
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          onCreate={handleCreate}
        />

        <div className="flex flex-1 flex-col">
          <DesktopHeader
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            radiusKm={radiusKm}
            pendingRadiusKm={pendingRadiusKm}
            onPendingRadiusChange={setPendingRadiusKm}
            onApplyRadius={applyRadiusChange}
            onOpenMobileRange={() => setRangeSheetOpen(true)}
            onRefresh={handleRefresh}
            lastUpdatedLabel={lastUpdatedLabel}
            describeLocation={describeLocation}
            rangeSummary={buildRadiusSummary(radiusKm)}
          />

          <main className="flex-1 px-4 pb-6 pt-4 md:px-8 md:pb-10">
            <MobileHero
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              describeLocation={describeLocation}
              rangeSummary={buildRadiusSummary(radiusKm)}
              radiusKm={radiusKm}
              pendingRadiusKm={pendingRadiusKm}
              onPendingRadiusChange={setPendingRadiusKm}
              onApplyRadius={applyRadiusChange}
              onOpenRange={() => {
                setPendingRadiusKm(radiusKm);
                setRangeSheetOpen(true);
              }}
              onRefresh={handleRefresh}
              lastUpdatedLabel={lastUpdatedLabel}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
            />

            <section className="mt-4 flex flex-col gap-4">
              <StatusCards
                describeLocation={describeLocation}
                lastUpdatedLabel={lastUpdatedLabel}
                rangeSummary={buildRadiusSummary(radiusKm)}
                onUpdateLocation={attemptLocationDetection}
                onRefresh={handleRefresh}
                locationStatus={locationStatus}
                eventsStatus={eventsStatus}
              />

              <CategoryRow
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
              />

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

              <div className="rounded-3xl border border-white/5 bg-white/5 p-5 shadow-xl shadow-black/20 backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white/80">Live tonight</p>
                    <p className="text-xs text-white/60">
                      Toggle between map and list to explore intimate meetups near you.
                    </p>
                  </div>
                  <ViewToggle current={viewMode} onChange={setViewMode} />
                </div>

                <div className="mt-6">
                  {isLoading && <DiscoverySkeleton viewMode={viewMode} />}

                  {!isLoading && viewMode === "map" && (
                    <EventMapView
                      events={mapItems}
                      userLocation={userLocation || undefined}
                      selectedEventId={selectedEventId}
                      onEventSelect={setSelectedEventId}
                      height={isDesktop ? MAP_HEIGHT_DESKTOP : MAP_HEIGHT_MOBILE}
                      className="text-white"
                    />
                  )}

                  {!isLoading && viewMode === "list" && (
                    <DiscoveryList
                      events={visibleEvents}
                      selectedEventId={selectedEventId}
                      onSelect={setSelectedEventId}
                      locationReady={locationReady}
                      radiusSummary={buildRadiusSummary(radiusKm)}
                    />
                  )}
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>

      <MobileActionBar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRefresh={handleRefresh}
        onCreate={handleCreate}
      />

      {rangeSheetOpen && (
        <RangeSheet
          value={pendingRadiusKm}
          onChange={setPendingRadiusKm}
          onClose={() => setRangeSheetOpen(false)}
          onApply={applyRadiusChange}
        />
      )}
    </div>
  );
}

type DesktopSidebarProps = {
  selectedCategory: CategoryId | null;
  onCategoryChange: (category: CategoryId | null) => void;
  onCreate: () => void;
};

function DesktopSidebar({ selectedCategory, onCategoryChange, onCreate }: DesktopSidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-white/5 bg-white/5 px-5 py-8 shadow-xl shadow-black/30 backdrop-blur md:flex md:flex-col">
      <div className="flex items-center gap-3 text-white">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-400 text-slate-900 shadow-lg shadow-emerald-500/40">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <p className="text-lg font-semibold leading-tight">Tonight</p>
          <p className="text-xs text-white/70">Discover real-life meetups</p>
        </div>
      </div>

      <div className="mt-8 space-y-2">
        <p className="text-xs uppercase tracking-wide text-white/50">Navigation</p>
        <div className="rounded-2xl bg-white/5 p-2">
          <SidebarButton icon={Compass} label="Discover" active />
          <SidebarButton icon={Users} label="People nearby" disabled />
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <div className="flex items-center justify-between text-xs text-white/60">
          <span>Categories</span>
          {selectedCategory && (
            <button
              type="button"
              onClick={() => onCategoryChange(null)}
              className="text-[11px] font-medium text-emerald-300 hover:text-emerald-200"
            >
              Clear
            </button>
          )}
        </div>
        <div className="space-y-1">
          {CATEGORY_ORDER.map((entry) => {
            if (entry === "all") {
              return (
                <SidebarCategoryButton
                  key="all"
                  label="All"
                  active={!selectedCategory}
                  onClick={() => onCategoryChange(null)}
                />
              );
            }
            const definition = CATEGORY_DEFINITIONS[entry];
            return (
              <SidebarCategoryButton
                key={definition.id}
                label={definition.label}
                icon={definition.icon}
                active={selectedCategory === definition.id}
                onClick={() => onCategoryChange(definition.id)}
              />
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={onCreate}
        className="mt-auto flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-900 shadow-xl shadow-emerald-500/40 transition hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        Host an event
      </button>
    </aside>
  );
}

type DesktopHeaderProps = {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  radiusKm: number;
  pendingRadiusKm: number;
  onPendingRadiusChange: (value: number) => void;
  onApplyRadius: () => void;
  onOpenMobileRange: () => void;
  onRefresh: () => void;
  lastUpdatedLabel: string;
  describeLocation: string;
  rangeSummary: string;
};

function DesktopHeader({
  viewMode,
  onViewModeChange,
  radiusKm,
  pendingRadiusKm,
  onPendingRadiusChange,
  onApplyRadius,
  onOpenMobileRange,
  onRefresh,
  lastUpdatedLabel,
  describeLocation,
  rangeSummary,
}: DesktopHeaderProps) {
  return (
    <header className="hidden border-b border-white/5 bg-white/5 px-8 py-6 text-white shadow-lg shadow-black/30 backdrop-blur md:block">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-emerald-300">Tonight</p>
          <h1 className="text-3xl font-semibold leading-tight">Discover what's happening near you</h1>
          <p className="text-sm text-white/70">
            We hand-curate intimate plans hosted by locals. Share your vibe or request to join a meetup.
          </p>
        </div>
        <div className="flex flex-col gap-3 text-sm text-white/70">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/50">Current location</p>
            <p className="text-sm font-semibold text-white">{describeLocation}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-white/50">Radius</p>
            <p className="text-sm font-semibold text-white">{rangeSummary}</p>
          </div>
          <p className="text-xs text-white/60">Last updated {lastUpdatedLabel}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <div className="hidden items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 lg:flex">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-white/50">Radius</p>
            <p className="text-sm font-semibold">{Math.round(pendingRadiusKm)} km</p>
          </div>
          <input
            type="range"
            min={MIN_RADIUS_KM}
            max={MAX_RADIUS_KM}
            value={pendingRadiusKm}
            onChange={(event) => onPendingRadiusChange(Number(event.target.value))}
            className="h-1 w-40 accent-emerald-400"
          />
          <button
            type="button"
            onClick={onApplyRadius}
            className="rounded-full bg-emerald-400/90 px-4 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-emerald-300"
          >
            Apply
          </button>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={onOpenMobileRange}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {Math.round(radiusKm)} km
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <ViewToggle current={viewMode} onChange={onViewModeChange} />
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-semibold text-white transition hover:border-emerald-300 hover:text-emerald-200"
          >
            Refresh feed
          </button>
          <Link
            href="/events/create"
            className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-300"
          >
            Host an event
          </Link>
        </div>
      </div>
    </header>
  );
}

type MobileHeroProps = {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  describeLocation: string;
  rangeSummary: string;
  radiusKm: number;
  pendingRadiusKm: number;
  onPendingRadiusChange: (value: number) => void;
  onApplyRadius: () => void;
  onOpenRange: () => void;
  onRefresh: () => void;
  lastUpdatedLabel: string;
  selectedCategory: CategoryId | null;
  onCategoryChange: (category: CategoryId | null) => void;
};

type MobileActionBarProps = {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onRefresh: () => void;
  onCreate: () => void;
};

function MobileHero({
  viewMode,
  onViewModeChange,
  describeLocation,
  rangeSummary,
  radiusKm,
  pendingRadiusKm,
  onPendingRadiusChange,
  onApplyRadius,
  onOpenRange,
  onRefresh,
  lastUpdatedLabel,
  selectedCategory,
  onCategoryChange,
}: MobileHeroProps) {
  return (
    <section className="sticky top-0 z-30 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-white/10 px-4 py-5 text-white shadow-xl shadow-black/40 backdrop-blur md:hidden">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-emerald-300">Tonight</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight">Discover nearby meetups</h1>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-full border border-white/20 px-4 py-1.5 text-xs font-semibold text-white"
        >
          Refresh
        </button>
      </div>

      <div className="mt-4 space-y-2 text-sm text-white/80">
        <p>
          <span className="text-white/60">Current location:</span> {describeLocation}
        </p>
        <p>
          <span className="text-white/60">Range:</span> {rangeSummary}
        </p>
        <p className="text-xs text-white/60">Last updated {lastUpdatedLabel}</p>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onViewModeChange("list")}
          className={classNames(
            "flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm",
            viewMode === "list" ? "bg-white text-slate-900" : "bg-white/10 text-white"
          )}
        >
          <ListIcon className="h-4 w-4" />
          List
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange("map")}
          className={classNames(
            "flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm",
            viewMode === "map" ? "bg-white text-slate-900" : "bg-white/10 text-white"
          )}
        >
          <MapIcon className="h-4 w-4" />
          Map
        </button>
        <button
          type="button"
          onClick={() => {
            onPendingRadiusChange(radiusKm);
            onOpenRange();
          }}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-sm"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {Math.round(radiusKm)} km
        </button>
      </div>

      <div className="mt-4">
        <CategoryRow selectedCategory={selectedCategory} onCategoryChange={onCategoryChange} compact />
      </div>
    </section>
  );
}


function MobileActionBar({ viewMode, onViewModeChange, onRefresh, onCreate }: MobileActionBarProps) {
  const options: { value: ViewMode; label: string; icon: typeof ListIcon }[] = [
    { value: 'list', label: 'List', icon: ListIcon },
    { value: 'map', label: 'Map', icon: MapIcon },
  ];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 px-4 md:hidden">
      <div className="pointer-events-auto space-y-3 rounded-3xl border border-white/10 bg-[#111428]/90 p-4 text-white shadow-2xl shadow-black/40 backdrop-blur">
        <div className="flex items-center gap-2">
          {options.map((option) => {
            const Icon = option.icon;
            const isActive = viewMode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onViewModeChange(option.value)}
                className={classNames(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-2xl px-3 py-2 text-sm',
                  isActive ? 'bg-white text-slate-900 shadow' : 'border border-white/10 bg-white/5 text-white/80'
                )}
                aria-pressed={isActive}
              >
                <Icon className="h-4 w-4" />
                {option.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white/90"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/40"
          >
            <Plus className="h-4 w-4" />
            Host
          </button>
        </div>
      </div>
    </div>
  );
}


type StatusCardsProps = {
  describeLocation: string;
  lastUpdatedLabel: string;
  rangeSummary: string;
  onUpdateLocation: () => void;
  onRefresh: () => void;
  locationStatus: LocationStatus;
  eventsStatus: EventsStatus;
};

function StatusCards({
  describeLocation,
  lastUpdatedLabel,
  rangeSummary,
  onUpdateLocation,
  onRefresh,
  locationStatus,
  eventsStatus,
}: StatusCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/60">Location</p>
            <p className="text-sm font-semibold text-white">{describeLocation}</p>
          </div>
          <button
            type="button"
            onClick={onUpdateLocation}
            className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white"
          >
            {locationStatus === "locating" ? "Locating…" : "Update"}
          </button>
        </div>
        <p className="mt-2 text-xs text-white/60">Last updated {lastUpdatedLabel}</p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/60">Search scope</p>
            <p className="text-sm font-semibold text-white">{rangeSummary}</p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white"
          >
            {eventsStatus === "loading" ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <p className="mt-2 text-xs text-white/60">Adjust your radius anytime from the controls above.</p>
      </div>
    </div>
  );
}

type CategoryRowProps = {
  selectedCategory: CategoryId | null;
  onCategoryChange: (category: CategoryId | null) => void;
  compact?: boolean;
};

function CategoryRow({ selectedCategory, onCategoryChange, compact = false }: CategoryRowProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-white/60">
        <span>Categories</span>
        {selectedCategory && (
          <button
            type="button"
            onClick={() => onCategoryChange(null)}
            className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200"
          >
            Clear
          </button>
        )}
      </div>
      <div
        className={classNames(
          "flex gap-2",
          compact ? "overflow-x-auto" : "flex-wrap",
          !compact && "flex-wrap"
        )}
        style={compact ? { WebkitOverflowScrolling: "touch" } : undefined}
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
                    ? "border-emerald-400 bg-emerald-400/10 text-emerald-200"
                    : "border-white/15 bg-white/5 text-white/70"
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
                  ? "border-emerald-400 bg-emerald-400/10 text-emerald-200"
                  : "border-white/15 bg-white/5 text-white/70"
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

type ViewToggleProps = {
  current: ViewMode;
  onChange: (mode: ViewMode) => void;
};

function ViewToggle({ current, onChange }: ViewToggleProps) {
  const options: { value: ViewMode; label: string; icon: typeof ListIcon }[] = [
    { value: "list", label: "List", icon: ListIcon },
    { value: "map", label: "Map", icon: MapIcon },
  ];

  return (
    <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1 text-sm text-white/70">
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = option.value === current;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={classNames(
              "flex items-center gap-1 rounded-full px-4 py-1.5",
              isActive ? "bg-white text-slate-900 shadow" : "text-white/70"
            )}
            aria-pressed={isActive}
          >
            <Icon className="h-4 w-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

type DiscoveryListProps = {
  events: DecoratedEvent[];
  selectedEventId: string | null;
  onSelect: (eventId: string) => void;
  locationReady: boolean;
  radiusSummary: string;
};

function DiscoveryList({ events, selectedEventId, onSelect, locationReady, radiusSummary }: DiscoveryListProps) {
  if (!locationReady) {
    return <DiscoverySkeleton viewMode="list" />;
  }

  if (events.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-10 text-center text-sm text-white/60">
        <p>No nearby events yet within {radiusSummary}. Try widening your radius or refreshing.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {events.map((event) => {
        const definition = event.categoryId ? CATEGORY_DEFINITIONS[event.categoryId] : null;
        const Icon = definition?.icon ?? Sparkles;
        return (
          <button
            key={event.id}
            type="button"
            onClick={() => onSelect(event.id)}
            className={classNames(
              "flex flex-col gap-3 rounded-3xl border bg-white/5 p-4 text-left transition",
              selectedEventId === event.id
                ? "border-emerald-400/60 shadow-lg shadow-emerald-500/30"
                : "border-white/10 hover:border-emerald-200/40"
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={classNames(
                  "flex h-12 w-12 items-center justify-center rounded-2xl border text-sm",
                  definition?.accent ?? "border-white/10 bg-white/10"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{event.title}</p>
                <p className="text-xs text-white/60">{event.locationName}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-white/40" />
            </div>
            <p className="line-clamp-2 text-xs text-white/70">{event.description}</p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
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
            </div>
            <div className="flex items-center gap-2 text-xs text-white/60">
              <span className="rounded-full border border-white/15 px-2 py-0.5">
                Up to {event.maxParticipants} people
              </span>
              {definition && (
                <span className={classNames("rounded-full px-2 py-0.5 text-[11px]", definition.badge)}>
                  {definition.label}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
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
    <div className="rounded-3xl border border-amber-300/40 bg-amber-400/10 p-5 text-amber-100">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-amber-100/80">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-4 rounded-full border border-amber-200/50 px-4 py-1.5 text-xs font-semibold text-amber-100"
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
        className="absolute inset-0 bg-black/60"
        aria-label="Close range selector"
        onClick={onClose}
      />
      <div className="relative w-full rounded-t-3xl border border-white/10 bg-[#111428] p-6 text-white shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-white/20" />
        <h2 className="text-lg font-semibold">Discovery range</h2>
        <p className="text-sm text-white/70">Slide to adjust how far we search for events.</p>
        <div className="mt-6 space-y-6">
          <div>
            <div className="flex items-center justify-between text-sm text-white/80">
              <span>Distance</span>
              <span className="font-semibold text-white">{Math.round(value)} km</span>
            </div>
            <input
              type="range"
              min={MIN_RADIUS_KM}
              max={MAX_RADIUS_KM}
              value={value}
              onChange={(event) => onChange(Number(event.target.value))}
              className="mt-4 h-1.5 w-full accent-emerald-400"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-white/50">
              <span>{MIN_RADIUS_KM} km</span>
              <span>{MAX_RADIUS_KM} km</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onApply}
            className="w-full rounded-2xl bg-emerald-400 py-3 text-sm font-semibold text-slate-900"
          >
            Apply radius
          </button>
        </div>
      </div>
    </div>
  );
}

type SidebarButtonProps = {
  icon: typeof Compass;
  label: string;
  active?: boolean;
  disabled?: boolean;
};

function SidebarButton({ icon: Icon, label, active, disabled }: SidebarButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={classNames(
        "flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm text-white/80",
        active && "bg-white text-slate-900",
        disabled && "opacity-40"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

type SidebarCategoryButtonProps = {
  label: string;
  icon?: typeof Sparkles;
  active: boolean;
  onClick: () => void;
};

function SidebarCategoryButton({ label, icon: Icon = Sparkles, active, onClick }: SidebarCategoryButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm",
        active ? "bg-emerald-400/20 text-emerald-200" : "text-white/70"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

type DiscoverySkeletonProps = {
  viewMode: ViewMode;
};

function DiscoverySkeleton({ viewMode }: DiscoverySkeletonProps) {
  if (viewMode === "map") {
    return (
      <div className="h-[320px] animate-pulse rounded-3xl border border-white/10 bg-white/5 md:h-[420px]" />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className="h-40 animate-pulse rounded-3xl border border-white/5 bg-white/5"
        />
      ))}
    </div>
  );
}

const formatCoordinate = (value: number) => value.toFixed(4);

const buildRadiusSummary = (radiusKm: number) => `${Math.round(radiusKm)} km radius`;
