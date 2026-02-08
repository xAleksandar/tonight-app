"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type mapboxgl from "mapbox-gl";

import { getMapboxConfig } from "@/lib/mapbox";

const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 }; // Continental US centroid
const DEFAULT_ZOOM = 3;
const FOCUSED_ZOOM = 12;

export type MapCoordinates = {
  lat: number;
  lng: number;
};

export type MapboxLocationPickerProps = {
  /** Optional label rendered above the map */
  label?: string;
  /** Initial coordinate rendered on first paint */
  initialValue?: MapCoordinates | null;
  /** Called whenever the user selects a new coordinate */
  onChange?: (coords: MapCoordinates) => void;
  /** Optional className passed to the root container */
  className?: string;
  /** Optional inline height (px). Default: 320 */
  height?: number;
  /** Mapbox style URL. Defaults to `mapbox://styles/mapbox/streets-v12` */
  mapStyle?: string;
  /** Marker fill color */
  markerColor?: string;
  /** When true the map becomes read-only */
  disabled?: boolean;
};

const formatCoordinate = (value: number) => value.toFixed(5);

const areCoordsEqual = (a?: MapCoordinates | null, b?: MapCoordinates | null) => {
  if (!a || !b) return false;
  return Math.abs(a.lat - b.lat) < 0.00001 && Math.abs(a.lng - b.lng) < 0.00001;
};

export default function MapboxLocationPicker({
  label = "Event location",
  initialValue = null,
  onChange,
  className,
  height = 320,
  mapStyle = "mapbox://styles/mapbox/streets-v12",
  markerColor = "#DB2777",
  disabled = false,
}: MapboxLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const mapboxRef = useRef<typeof mapboxgl | null>(null);
  const disabledRef = useRef(disabled);
  const onChangeRef = useRef(onChange);
  const [selected, setSelected] = useState<MapCoordinates | null>(initialValue);
  const [mapStatus, setMapStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  disabledRef.current = disabled;
  onChangeRef.current = onChange;

  const instruction = useMemo(() => {
    if (disabled) {
      return "Location selection is disabled.";
    }

    if (!mapReady) {
      return "Loading map…";
    }

    if (selected) {
      return "Click a different spot to move the marker.";
    }

    return "Click anywhere on the map to drop a marker.";
  }, [disabled, mapReady, selected]);

  const placeMarker = useCallback(
    (coords: MapCoordinates, { flyTo = true }: { flyTo?: boolean } = {}) => {
      const map = mapRef.current;
      const mapbox = mapboxRef.current;
      if (!map || !mapbox) return;

      if (!markerRef.current) {
        markerRef.current = new mapbox.Marker({ color: markerColor });
      }

      markerRef.current.setLngLat([coords.lng, coords.lat]).addTo(map);

      if (flyTo) {
        map.flyTo({
          center: [coords.lng, coords.lat],
          zoom: Math.max(map.getZoom(), FOCUSED_ZOOM),
          essential: true,
        });
      }
    },
    [markerColor]
  );

  useEffect(() => {
    if (!initialValue || !mapReady) {
      if (!initialValue) {
        setSelected((prev) => {
          if (!prev) {
            return prev;
          }
          markerRef.current?.remove();
          markerRef.current = null;
          return null;
        });
      }
      return;
    }

    setSelected((prev) => {
      if (areCoordsEqual(prev, initialValue)) {
        return prev;
      }
      return initialValue;
    });

    placeMarker(initialValue, { flyTo: false });
  }, [initialValue?.lat, initialValue?.lng, mapReady, placeMarker]);

  useEffect(() => {
    let disposed = false;

    const initializeMap = async () => {
      if (!containerRef.current) {
        return;
      }

      setMapStatus("loading");
      setMapError(null);

      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        mapboxRef.current = mapboxgl;
        mapboxgl.accessToken = getMapboxConfig().accessToken;

        if (!containerRef.current || disposed) {
          return;
        }

        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: mapStyle,
          center: [initialValue?.lng ?? DEFAULT_CENTER.lng, initialValue?.lat ?? DEFAULT_CENTER.lat],
          zoom: initialValue ? FOCUSED_ZOOM : DEFAULT_ZOOM,
          cooperativeGestures: true,
        });

        map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

        const handleClick = (event: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
          if (disabledRef.current) {
            return;
          }

          const coords = { lat: event.lngLat.lat, lng: event.lngLat.lng };
          setSelected(coords);
          placeMarker(coords);
          onChangeRef.current?.(coords);
        };

        map.on("click", handleClick);
        map.on("load", () => {
          if (disposed) return;
          setMapStatus("ready");
          setMapReady(true);
          if (initialValue) {
            placeMarker(initialValue, { flyTo: false });
          }
        });

        map.on("error", (event) => {
          if (event.error && !disposed) {
            setMapStatus("error");
            setMapError(event.error.message ?? "Mapbox failed to render.");
          }
        });

        mapRef.current = map;
      } catch (error) {
        if (disposed) return;
        setMapStatus("error");
        setMapError(
          error instanceof Error
            ? error.message
            : "Unable to load Mapbox. Please verify your access token."
        );
      }
    };

    initializeMap();

    return () => {
      disposed = true;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const interactions = [
      map.scrollZoom,
      map.boxZoom,
      map.dragRotate,
      map.dragPan,
      map.keyboard,
      map.doubleClickZoom,
      map.touchZoomRotate,
    ];

    interactions.forEach((interaction) => {
      if (!interaction) return;
      if (disabled) {
        interaction.disable();
      } else {
        interaction.enable();
      }
    });

    const canvas = map.getCanvas();
    canvas.style.cursor = disabled ? "not-allowed" : "crosshair";
  }, [disabled]);

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

  const coordinateSummary = selected
    ? `${formatCoordinate(selected.lat)}, ${formatCoordinate(selected.lng)}`
    : mapReady
      ? "No location selected"
      : "";

  return (
    <div className={className}>
      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-700">{label}</p>
          <p className="text-xs text-zinc-500" aria-live="polite">
            {instruction}
          </p>
        </div>
        {coordinateSummary && (
          <p className="text-xs font-mono text-zinc-500">{coordinateSummary}</p>
        )}
      </div>

      <div className="relative">
        <div
          ref={containerRef}
          className="w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50"
          style={{ height }}
          aria-label="Mapbox location picker"
          role="img"
        />
        {disabled && (
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-white/60 backdrop-blur-[1px]" />
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
