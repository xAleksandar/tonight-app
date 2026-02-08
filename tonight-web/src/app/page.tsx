'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import EventMapView, { type MapPoint } from '@/components/EventMapView';
import EventListView from '@/components/EventListView';

const MAP_HEIGHT = 460;

type ViewMode = 'map' | 'list';

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

type LocationStatus = 'idle' | 'locating' | 'ready' | 'denied' | 'unsupported' | 'error';

type EventsStatus = 'idle' | 'loading' | 'success' | 'error';

export default function HomePage() {
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<MapPoint | null>(null);
  const [events, setEvents] = useState<NearbyEventPayload[]>([]);
  const [eventsStatus, setEventsStatus] = useState<EventsStatus>('idle');
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [searchMeta, setSearchMeta] = useState<NearbyEventsResponse['meta'] | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const fetchAbortRef = useRef<AbortController | null>(null);

  const describeLocation = useMemo(() => {
    switch (locationStatus) {
      case 'locating':
        return 'Detecting your location…';
      case 'ready':
        if (!userLocation) return 'Location ready';
        return `${formatCoordinate(userLocation.latitude)}, ${formatCoordinate(userLocation.longitude)}`;
      case 'denied':
        return locationError ?? 'Location permission denied.';
      case 'unsupported':
        return 'Your browser does not support geolocation.';
      case 'error':
        return locationError ?? 'Unable to determine your location.';
      default:
        return 'Waiting for location access…';
    }
  }, [locationError, locationStatus, userLocation]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastFetchedAt) {
      return 'Never';
    }
    try {
      return new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      }).format(lastFetchedAt);
    } catch {
      return lastFetchedAt.toLocaleTimeString();
    }
  }, [lastFetchedAt]);

  const attemptLocationDetection = useCallback(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setLocationStatus('unsupported');
      setLocationError('Geolocation is not available in this browser.');
      return;
    }

    setLocationStatus('locating');
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationStatus('ready');
        setLocationError(null);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationStatus('denied');
          setLocationError('We need your permission to find events nearby.');
        } else {
          setLocationStatus('error');
          setLocationError('Unable to determine your location. Try again in a moment.');
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  }, []);

  const fetchEventsForLocation = useCallback(
    async (coords: MapPoint) => {
      fetchAbortRef.current?.abort();
      const controller = new AbortController();
      fetchAbortRef.current = controller;

      setEventsStatus('loading');
      setEventsError(null);

      const params = new URLSearchParams({
        lat: coords.latitude.toString(),
        lng: coords.longitude.toString(),
      });

      try {
        const response = await fetch(`/api/events/nearby?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to load events');
        }

        const payload = (await response.json()) as NearbyEventsResponse;
        setEvents(payload.events ?? []);
        setSearchMeta(payload.meta ?? null);
        setEventsStatus('success');
        setLastFetchedAt(new Date());
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }
        console.error('Failed to fetch nearby events', error);
        setEventsStatus('error');
        setEventsError('Unable to load nearby events. Please try again.');
      }
    },
    []
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
      console.error('Unexpected error while fetching events', error);
    });
  }, [fetchEventsForLocation, userLocation]);

  useEffect(() => {
    setSelectedEventId((previous) => {
      if (!events.length) {
        return null;
      }
      if (previous && events.some((event) => event.id === previous)) {
        return previous;
      }
      return events[0]?.id ?? null;
    });
  }, [events]);

  const handleRefresh = useCallback(() => {
    if (userLocation) {
      fetchEventsForLocation(userLocation).catch((error) => {
        console.error('Refresh failed', error);
      });
      return;
    }
    attemptLocationDetection();
  }, [attemptLocationDetection, fetchEventsForLocation, userLocation]);

  const mapItems = useMemo(() => {
    return events.map((event) => ({
      id: event.id,
      title: event.title,
      locationName: event.locationName,
      location: { ...event.location },
      datetimeISO: event.datetime,
      distanceMeters: event.distanceMeters ?? undefined,
    }));
  }, [events]);

  const listItems = useMemo(() => {
    return events.map((event) => ({
      id: event.id,
      title: event.title,
      locationName: event.locationName,
      description: event.description,
      datetimeISO: event.datetime,
      distanceMeters: event.distanceMeters ?? undefined,
    }));
  }, [events]);

  const radiusSummary = useMemo(() => {
    if (!searchMeta) return null;
    if (searchMeta.radiusMeters >= 1000) {
      return `${(searchMeta.radiusMeters / 1000).toFixed(1)} km radius`;
    }
    return `${Math.round(searchMeta.radiusMeters)} m radius`;
  }, [searchMeta]);

  const renderContent = () => {
    if (locationStatus === 'denied' || locationStatus === 'unsupported') {
      return (
        <CardMessage
          intent="warning"
          title="Turn on location services"
          message={
            locationError ??
            'We need access to your approximate location to find pop-up events around you.'
          }
          actionLabel="Try again"
          onAction={attemptLocationDetection}
        />
      );
    }

    if (locationStatus === 'error') {
      return (
        <CardMessage
          intent="warning"
          title="Location unavailable"
          message={locationError ?? 'Something went wrong while determining your position.'}
          actionLabel="Retry"
          onAction={attemptLocationDetection}
        />
      );
    }

    if (locationStatus !== 'ready' || !userLocation) {
      return <LoadingPlaceholder viewMode={viewMode} />;
    }

    if (eventsStatus === 'loading' && events.length === 0) {
      return <LoadingPlaceholder viewMode={viewMode} />;
    }

    if (eventsStatus === 'error') {
      return (
        <CardMessage
          intent="error"
          title="Couldn’t load nearby events"
          message={eventsError ?? 'Please try again in a moment.'}
          actionLabel="Retry"
          onAction={handleRefresh}
        />
      );
    }

    if (viewMode === 'list') {
      return (
        <EventListView
          events={listItems}
          selectedEventId={selectedEventId}
          onEventSelect={setSelectedEventId}
        />
      );
    }

    return (
      <EventMapView
        events={mapItems}
        userLocation={userLocation}
        selectedEventId={selectedEventId}
        onEventSelect={setSelectedEventId}
        height={MAP_HEIGHT}
      />
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-zinc-50 px-4 py-10 text-zinc-900">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-pink-600">Tonight</p>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold text-zinc-900">Discover what’s happening near you</h1>
              <p className="text-sm text-zinc-500">
                We’ll use your current location to surface intimate meetups, pop-ups, and spontaneous plans
                hosted by the Tonight community.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={eventsStatus === 'loading' || locationStatus === 'locating'}
                className="rounded-full border border-zinc-200 px-6 py-2 text-sm font-semibold text-zinc-700 transition hover:border-pink-200 hover:text-pink-600 disabled:cursor-not-allowed disabled:border-zinc-100 disabled:text-zinc-400"
              >
                {eventsStatus === 'loading' ? 'Refreshing…' : 'Refresh feed'}
              </button>
              <Link
                href="/events/create"
                className="rounded-full bg-pink-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-pink-500"
              >
                Host an event
              </Link>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Current location</p>
                <p className="text-lg font-semibold text-zinc-900">{describeLocation}</p>
              </div>
              <button
                type="button"
                onClick={attemptLocationDetection}
                disabled={locationStatus === 'locating'}
                className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-600 transition hover:border-pink-200 hover:text-pink-600 disabled:cursor-not-allowed disabled:border-zinc-100 disabled:text-zinc-300"
              >
                {locationStatus === 'locating' ? 'Locating…' : 'Update'}
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              We only store the coordinates you share for this search. You can update or revoke permission any
              time in your browser settings.
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Search scope</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-2">
              <p className="text-3xl font-semibold text-zinc-900">
                {radiusSummary ?? '—'}
              </p>
              <p className="text-sm text-zinc-500">Last updated {lastUpdatedLabel}</p>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              We automatically search a tight radius first. Refresh to pull the latest events or expand your
              range from the mobile app (coming soon).
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-zinc-700">Live tonight</p>
              <p className="text-xs text-zinc-500">Toggle between map and list views to explore nearby events.</p>
            </div>
            <ViewToggle current={viewMode} onChange={setViewMode} />
          </div>

          <div className="mt-6">{renderContent()}</div>
        </section>
      </div>
    </div>
  );
}

type ViewToggleProps = {
  current: ViewMode;
  onChange: (mode: ViewMode) => void;
};

const ViewToggle = ({ current, onChange }: ViewToggleProps) => {
  const options: { value: ViewMode; label: string }[] = [
    { value: 'map', label: 'Map view' },
    { value: 'list', label: 'List view' },
  ];

  return (
    <div className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 p-1 text-sm font-semibold text-zinc-600">
      {options.map((option) => {
        const isActive = option.value === current;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={[
              'rounded-full px-4 py-1.5 transition',
              isActive ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800',
            ].join(' ')}
            aria-pressed={isActive}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

type CardMessageProps = {
  intent: 'warning' | 'error';
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
};

const CardMessage = ({ intent, title, message, actionLabel, onAction }: CardMessageProps) => {
  const styles =
    intent === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-amber-200 bg-amber-50 text-amber-700';

  return (
    <div className={`rounded-2xl border p-6 text-sm ${styles}`}>
      <p className="text-base font-semibold">{title}</p>
      <p className="mt-2 text-sm">{message}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-4 rounded-full border border-current px-4 py-2 text-xs font-semibold uppercase tracking-wide"
      >
        {actionLabel}
      </button>
    </div>
  );
};

type LoadingPlaceholderProps = {
  viewMode: ViewMode;
};

const LoadingPlaceholder = ({ viewMode }: LoadingPlaceholderProps) => {
  if (viewMode === 'list') {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            className="h-24 w-full rounded-2xl border border-zinc-100 bg-zinc-50 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="h-[460px] w-full animate-pulse rounded-2xl border border-zinc-100 bg-zinc-50"
      role="status"
      aria-live="polite"
    />
  );
};

const formatCoordinate = (value: number) => value.toFixed(4);
