"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type mapboxgl from "mapbox-gl";

import { getMapboxConfig } from "@/lib/mapbox";
import { classNames } from "@/lib/classNames";

const defaultMapboxLoader = async () => (await import("mapbox-gl")).default;
const DEFAULT_CENTER: [number, number] = [-98.5795, 39.8283];

export type MapPoint = {
  latitude: number;
  longitude: number;
};

export type EventMapItem = {
  id: string;
  title: string;
  locationName: string;
  location: MapPoint;
  datetimeISO?: string | null;
  distanceMeters?: number | null;
};

export type EventMapViewProps = {
  events: EventMapItem[];
  userLocation?: MapPoint | null;
  selectedEventId?: string | null;
  onEventSelect?: (eventId: string) => void;
  className?: string;
  height?: number;
  mapStyle?: string;
  emptyStateMessage?: string;
  mapboxLoader?: () => Promise<typeof mapboxgl>;
};

type EventMarkerEntry = {
  marker: mapboxgl.Marker;
  popup: mapboxgl.Popup;
  element: HTMLButtonElement;
  cleanup: () => void;
  event: EventMapItem;
  isHovered: boolean;
};

type MapStatus = "idle" | "loading" | "ready" | "error";

const getEventMarkerClass = ({
  isSelected,
  isHovered,
}: {
  isSelected: boolean;
  isHovered: boolean;
}) =>
  classNames(
    "pointer-events-auto grid h-5 w-5 place-items-center rounded-full border-2 text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300",
    isSelected
      ? "border-pink-100 bg-gradient-to-br from-pink-400 to-pink-500 text-white shadow-lg shadow-pink-400/50"
      : isHovered
        ? "border-pink-200 bg-gradient-to-br from-rose-400 to-pink-500 text-white shadow-md shadow-rose-400/40"
        : "border-rose-300/80 bg-gradient-to-br from-rose-400 to-pink-500 text-white shadow-md shadow-rose-400/30"
  );

const applyMarkerAppearance = (entry: EventMarkerEntry, selectedEventId: string | null) => {
  const isSelected = Boolean(selectedEventId && entry.event.id === selectedEventId);
  entry.element.className = getEventMarkerClass({
    isSelected,
    isHovered: entry.isHovered,
  });
  entry.element.setAttribute("aria-pressed", isSelected ? "true" : "false");
};

const buildPopupContent = (event: EventMapItem) => {
  const wrapper = document.createElement("div");
  wrapper.className = "rounded-xl border border-rose-400/40 bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-900 p-3 shadow-xl shadow-black/40 backdrop-blur-sm min-w-[200px]";

  const title = document.createElement("p");
  title.className = "text-sm font-semibold text-white mb-2";
  title.textContent = event.title;
  wrapper.appendChild(title);

  const venue = document.createElement("p");
  venue.className = "text-xs text-rose-200/80 mb-1.5 flex items-center gap-1";
  venue.innerHTML = `<svg class="w-3 h-3 text-rose-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg><span>${event.locationName}</span>`;
  wrapper.appendChild(venue);

  const formattedTime = formatDateTime(event.datetimeISO);
  if (formattedTime) {
    const time = document.createElement("p");
    time.className = "text-xs text-zinc-400 flex items-center gap-1";
    time.innerHTML = `<svg class="w-3 h-3 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"/><path stroke-linecap="round" stroke-width="2" d="M12 6v6l4 2"/></svg><span>${formattedTime}</span>`;
    wrapper.appendChild(time);
  }

  const formattedDistance = formatDistance(event.distanceMeters);
  if (formattedDistance) {
    const distance = document.createElement("p");
    distance.className = "text-xs text-zinc-400 flex items-center gap-1 mt-1";
    distance.innerHTML = `<svg class="w-3 h-3 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg><span>${formattedDistance}</span>`;
    wrapper.appendChild(distance);
  }

  return wrapper;
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

export default function EventMapView({
  events,
  userLocation = null,
  selectedEventId = null,
  onEventSelect,
  className,
  height = 360,
  mapStyle = "mapbox://styles/mapbox/streets-v12",
  emptyStateMessage = "No events to display",
  mapboxLoader = defaultMapboxLoader,
}: EventMapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapboxRef = useRef<typeof mapboxgl | null>(null);
  const eventMarkersRef = useRef<Map<string, EventMarkerEntry>>(new Map());
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const onEventSelectRef = useRef(onEventSelect);
  const mapboxLoaderRef = useRef(mapboxLoader);
  const [mapStatus, setMapStatus] = useState<MapStatus>("idle");
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const lastSelectedRef = useRef<string | null>(null);
  const selectedEventIdRef = useRef<string | null>(selectedEventId ?? null);

  onEventSelectRef.current = onEventSelect;
  mapboxLoaderRef.current = mapboxLoader;
  selectedEventIdRef.current = selectedEventId ?? null;

  const summaryText = useMemo(() => {
    if (!events.length) {
      return emptyStateMessage;
    }

    return events.length === 1 ? "Showing 1 event" : `Showing ${events.length} events`;
  }, [emptyStateMessage, events.length]);

  const initializeMap = useCallback(async () => {
    if (!containerRef.current) return;

    setMapStatus("loading");
    setMapError(null);
    setMapReady(false);

    try {
      const mapboxgl = await mapboxLoaderRef.current();
      mapboxRef.current = mapboxgl;
      mapboxgl.accessToken = getMapboxConfig().accessToken;

      if (!containerRef.current) {
        return;
      }

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: mapStyle,
        center: DEFAULT_CENTER,
        zoom: 3,
        cooperativeGestures: true,
      });

      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

      map.on("load", () => {
        setMapStatus("ready");
        setMapReady(true);
      });

      map.on("error", (event) => {
        if (event.error) {
          setMapStatus("error");
          setMapError(event.error.message ?? "Mapbox failed to render.");
        }
      });

      mapRef.current = map;
    } catch (error) {
      setMapStatus("error");
      setMapError(
        error instanceof Error
          ? error.message
          : "Unable to load Mapbox. Please verify your access token."
      );
    }
  }, [mapStyle]);

  useEffect(() => {
    initializeMap();

    return () => {
      eventMarkersRef.current.forEach((entry) => {
        entry.marker.remove();
        entry.popup.remove();
        entry.cleanup();
      });
      eventMarkersRef.current.clear();
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      mapboxRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapStyle) return;
    map.setStyle(mapStyle);
  }, [mapStyle]);

  useEffect(() => {
    const container = containerRef.current;
    const map = mapRef.current;
    if (!container || !map || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      map.resize();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [mapReady]);

  const syncEventMarkers = useCallback(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    const mapbox = mapboxRef.current;
    if (!map || !mapbox) return;

    const markerMap = eventMarkersRef.current;
    const nextIds = new Set(events.map((event) => event.id));

    markerMap.forEach((entry, id) => {
      if (!nextIds.has(id)) {
        entry.marker.remove();
        entry.popup.remove();
        entry.cleanup();
        markerMap.delete(id);
      }
    });

    events.forEach((event) => {
      const lngLat: [number, number] = [event.location.longitude, event.location.latitude];
      const existing = markerMap.get(event.id);

      if (existing) {
        existing.marker.setLngLat(lngLat);
        existing.popup.setDOMContent(buildPopupContent(event));
        existing.event = event;
        return;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", `${event.title} marker`);
      button.setAttribute("data-event-id", event.id);

      const marker = new mapbox.Marker({ element: button, anchor: "bottom" })
        .setLngLat(lngLat)
        .addTo(map);

      const popup = new mapbox.Popup({
        closeButton: true,
        closeOnClick: false,
        className: 'event-map-popup'
      }).setDOMContent(
        buildPopupContent(event)
      );

      marker.setPopup(popup);

      const entry: EventMarkerEntry = {
        marker,
        popup,
        element: button,
        cleanup: () => {},
        event,
        isHovered: false,
      };

      const updateAppearance = () => {
        applyMarkerAppearance(entry, selectedEventIdRef.current);
      };

      const handleClick = (nativeEvent: MouseEvent) => {
        nativeEvent.stopPropagation();
        popup.addTo(map);
        onEventSelectRef.current?.(event.id);
      };

      const handlePointerEnter = () => {
        entry.isHovered = true;
        updateAppearance();
      };

      const handlePointerLeave = () => {
        entry.isHovered = false;
        updateAppearance();
      };

      const handleFocus = () => {
        entry.isHovered = true;
        updateAppearance();
      };

      const handleBlur = () => {
        entry.isHovered = false;
        updateAppearance();
      };

      button.addEventListener("click", handleClick);
      button.addEventListener("mouseenter", handlePointerEnter);
      button.addEventListener("mouseleave", handlePointerLeave);
      button.addEventListener("focus", handleFocus);
      button.addEventListener("blur", handleBlur);

      entry.cleanup = () => {
        button.removeEventListener("click", handleClick);
        button.removeEventListener("mouseenter", handlePointerEnter);
        button.removeEventListener("mouseleave", handlePointerLeave);
        button.removeEventListener("focus", handleFocus);
        button.removeEventListener("blur", handleBlur);
      };

      updateAppearance();

      markerMap.set(event.id, entry);
    });
  }, [events, mapReady, selectedEventId]);

  useEffect(() => {
    syncEventMarkers();
  }, [syncEventMarkers]);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    eventMarkersRef.current.forEach((entry, id) => {
      applyMarkerAppearance(entry, selectedEventId ?? null);
      const isSelected = Boolean(selectedEventId && id === selectedEventId);
      if (isSelected && selectedEventId !== lastSelectedRef.current) {
        entry.popup.addTo(map);
        map.easeTo({
          center: entry.marker.getLngLat(),
          duration: 600,
          zoom: Math.max(map.getZoom(), 12),
        });
      }
    });

    lastSelectedRef.current = selectedEventId ?? null;
  }, [selectedEventId, mapReady]);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    const mapbox = mapboxRef.current;
    if (!map || !mapbox) return;

    if (!userLocation) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }

    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.className =
        "h-3 w-3 rounded-full border-2 border-white bg-sky-500 shadow shadow-sky-500/40";
      userMarkerRef.current = new mapbox.Marker({ element: el, anchor: "center" });
    }

    userMarkerRef.current
      .setLngLat([userLocation.longitude, userLocation.latitude])
      .addTo(map);
  }, [userLocation?.latitude, userLocation?.longitude, mapReady]);

  const fitBoundsToContent = useCallback(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    const mapbox = mapboxRef.current;
    if (!map || !mapbox) return;

    const bounds = new mapbox.LngLatBounds();
    let hasBounds = false;

    events.forEach((event) => {
      bounds.extend([event.location.longitude, event.location.latitude]);
      hasBounds = true;
    });

    if (userLocation) {
      bounds.extend([userLocation.longitude, userLocation.latitude]);
      hasBounds = true;
    }

    if (!hasBounds) {
      map.easeTo({ center: DEFAULT_CENTER, zoom: 3 });
      return;
    }

    if (events.length === 1 && !userLocation) {
      map.easeTo({
        center: bounds.getCenter(),
        zoom: Math.max(map.getZoom(), 12),
        duration: 600,
      });
      return;
    }

    map.fitBounds(bounds, {
      padding: { top: 48, bottom: 48, left: 48, right: 48 },
      maxZoom: 14,
      duration: 800,
    });
  }, [events, mapReady, userLocation]);

  useEffect(() => {
    fitBoundsToContent();
  }, [fitBoundsToContent]);

  const showEmptyOverlay = mapReady && !events.length;

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-zinc-700">Event map</p>
          <p className="text-xs text-zinc-500" aria-live="polite">
            {summaryText}
          </p>
        </div>
        {userLocation && (
          <p className="text-xs text-zinc-500">
            Showing around {formatCoordinate(userLocation.latitude)},{" "}
            {formatCoordinate(userLocation.longitude)}
          </p>
        )}
      </div>

      <div className="relative">
        <div
          ref={containerRef}
          className="w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50"
          style={{ height }}
          aria-label="Event map"
          role="img"
        />

        {showEmptyOverlay && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-white/85 p-6 text-center text-sm text-zinc-500">
            {emptyStateMessage}
          </div>
        )}

        {mapStatus === "error" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-white/90 p-4 text-center text-sm text-red-600">
            {mapError ?? "Map failed to load. Please try again later."}
          </div>
        )}
      </div>
    </div>
  );
}

const formatCoordinate = (value: number) => value.toFixed(4);
