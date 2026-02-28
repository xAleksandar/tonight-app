
'use client';

import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlignLeft, ArrowLeft, ChevronRight, Clock, MapPin, Sparkles, Type, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import MapboxLocationPicker, { type MapCoordinates } from '@/components/MapboxLocationPicker';
import { getMapboxConfig } from '@/lib/mapbox';
import { DesktopHeader } from '@/components/tonight/DesktopHeader';
import { DesktopSidebar } from '@/components/tonight/DesktopSidebar';
import { AuthStatusMessage } from '@/components/auth/AuthStatusMessage';
import type { AuthUser } from '@/components/auth/AuthProvider';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { CATEGORY_DEFINITIONS, type CategoryId } from '@/lib/categories';
import { Drawer } from "@/components/tonight/Drawer";
import { classNames } from '@/lib/classNames';
import { showErrorToast } from '@/lib/toast';

const TITLE_LIMITS = { min: 3, max: 120 } as const;
const DESCRIPTION_LIMITS = { min: 1, max: 2000 } as const;
const LOCATION_NAME_LIMITS = { min: 2, max: 120 } as const;
const MAX_PARTICIPANTS_LIMITS = { min: 2, max: 50 } as const;
const DEFAULT_MAX_PARTICIPANTS = 2;

const INPUT_BASE_CLASS =
  'h-12 w-full rounded-2xl border border-border/70 bg-card/60 px-4 text-sm text-foreground placeholder:text-muted-foreground shadow-inner shadow-black/10 transition focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none';

const pad = (value: number) => value.toString().padStart(2, '0');

const formatLocalDateInput = (date: Date) => {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const getInitialDateValue = () => {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const minutes = date.getMinutes();
  const remainder = minutes % 5;
  if (remainder !== 0) {
    date.setMinutes(minutes + (5 - remainder));
  }
  date.setSeconds(0);
  date.setMilliseconds(0);
  return formatLocalDateInput(date);
};

const formatReadableDatetime = (value: string) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
};

type FieldErrors = Partial<Record<'title' | 'description' | 'datetime' | 'location' | 'locationName' | 'maxParticipants', string>>;
type ApiErrorPayload = { error?: string; errors?: FieldErrors };
type LocationSuggestion = { id: string; name: string; fullName: string; coords: MapCoordinates };

export default function CreateEventPage() {
  const { status: authStatus, user: authUser } = useRequireAuth();

  if (authStatus === 'loading') return <AuthStatusMessage label="Checking your session…" />;
  if (authStatus === 'unauthenticated') return <AuthStatusMessage label="Redirecting you to the welcome screen…" />;
  if (authStatus === 'error') return <AuthStatusMessage label="We couldn't verify your session. Refresh to try again." />;

  return <AuthenticatedCreateEventPage currentUser={authUser ?? null} />;
}

function AuthenticatedCreateEventPage({ currentUser }: { currentUser: AuthUser | null }) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [datetimeInput, setDatetimeInput] = useState(getInitialDateValue);
  const [locationName, setLocationName] = useState('');
  const [maxParticipants, setMaxParticipants] = useState<number>(DEFAULT_MAX_PARTICIPANTS);
  const [location, setLocation] = useState<MapCoordinates | null>(null);
  const [mapCenter, setMapCenter] = useState<MapCoordinates | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusIntent, setStatusIntent] = useState<'idle' | 'error' | 'success'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [geolocating, setGeolocating] = useState(false);
  const [mobileStep, setMobileStep] = useState(1);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const mobileContentRef = useRef<HTMLDivElement>(null);
  const suggestionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const friendlyDatetime = useMemo(() => formatReadableDatetime(datetimeInput), [datetimeInput]);

  // On every step change: scroll to top and clear any lingering field errors
  useEffect(() => {
    mobileContentRef.current?.scrollTo({ top: 0 });
    setFieldErrors({});
  }, [mobileStep]);

  // Silently pre-fetch user location for map center
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMapCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {},
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
    );
  }, []);

  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) {
      showErrorToast('Turn on location services', 'Your browser does not support geolocation.');
      return;
    }
    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        setLocation(coords);
        setStatusIntent('idle');
        setStatusMessage(null);
        setGeolocating(false);
        const { accessToken } = getMapboxConfig();
        fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${coords.lng},${coords.lat}.json?access_token=${accessToken}&limit=1&language=en`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            const name = data?.features?.[0]?.place_name ?? '';
            if (name) setLocationName(name);
          })
          .catch(() => {});
      },
      (error) => {
        console.error('Geolocation failed', error);
        showErrorToast('Unable to detect location', 'Try selecting it manually on the map.');
        setGeolocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => () => { if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current); }, []);

  const fetchLocationSuggestions = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const { accessToken } = getMapboxConfig();
      const proximity = mapCenter ?? location;
      const proximityParam = proximity ? `&proximity=${proximity.lng},${proximity.lat}` : '';
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${accessToken}&autocomplete=true&limit=5&language=en${proximityParam}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const items: LocationSuggestion[] = (data.features ?? []).map((f: { id: string; text: string; place_name: string; center: [number, number] }) => ({
        id: f.id,
        name: f.text,
        fullName: f.place_name,
        coords: { lng: f.center[0], lat: f.center[1] },
      }));
      setSuggestions(items);
    } catch {
      // Swallow errors — autocomplete is best-effort
    }
  }, [mapCenter, location]);

  const handleLocationNameChange = (value: string) => {
    setLocationName(value);
    if (value.trim().length < 2) {
      setShowSuggestions(false);
      setSuggestions([]);
      return;
    }
    setShowSuggestions(true);
    if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current);
    suggestionDebounceRef.current = setTimeout(() => {
      fetchLocationSuggestions(value);
    }, 300);
  };

  const handleSuggestionSelect = (suggestion: LocationSuggestion) => {
    setLocationName(suggestion.fullName);
    setLocation(suggestion.coords);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleParticipantChange = (delta: number) => {
    setMaxParticipants((prev) => {
      const next = Math.max(MAX_PARTICIPANTS_LIMITS.min, Math.min(MAX_PARTICIPANTS_LIMITS.max, prev + delta));
      return Number.isFinite(next) ? next : DEFAULT_MAX_PARTICIPANTS;
    });
  };

  const validateStep = (step: number): FieldErrors => {
    const errors: FieldErrors = {};
    if (step === 1) {
      const trimmedTitle = title.trim();
      if (trimmedTitle.length < TITLE_LIMITS.min || trimmedTitle.length > TITLE_LIMITS.max) {
        errors.title = `Title must be between ${TITLE_LIMITS.min} and ${TITLE_LIMITS.max} characters.`;
      }
      const trimmedDescription = description.trim();
      if (trimmedDescription.length < DESCRIPTION_LIMITS.min) {
        errors.description = 'Description is required.';
      } else if (trimmedDescription.length > DESCRIPTION_LIMITS.max) {
        errors.description = `Description must be under ${DESCRIPTION_LIMITS.max} characters.`;
      }
    } else if (step === 2) {
      const date = datetimeInput ? new Date(datetimeInput) : null;
      if (!date || Number.isNaN(date.getTime())) {
        errors.datetime = 'Please choose a valid date and time.';
      } else if (date.getTime() <= Date.now()) {
        errors.datetime = 'Events must start in the future.';
      }
      if (Number.isNaN(maxParticipants) || maxParticipants < MAX_PARTICIPANTS_LIMITS.min || maxParticipants > MAX_PARTICIPANTS_LIMITS.max) {
        errors.maxParticipants = `Max participants must be between ${MAX_PARTICIPANTS_LIMITS.min} and ${MAX_PARTICIPANTS_LIMITS.max}.`;
      }
    }
    setFieldErrors(errors);
    return errors;
  };

  const validateBeforeSubmit = (): FieldErrors => {
    const errors: FieldErrors = {};
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < TITLE_LIMITS.min || trimmedTitle.length > TITLE_LIMITS.max) {
      errors.title = `Title must be between ${TITLE_LIMITS.min} and ${TITLE_LIMITS.max} characters.`;
    }
    const trimmedDescription = description.trim();
    if (trimmedDescription.length < DESCRIPTION_LIMITS.min) {
      errors.description = 'Description is required.';
    } else if (trimmedDescription.length > DESCRIPTION_LIMITS.max) {
      errors.description = `Description must be under ${DESCRIPTION_LIMITS.max} characters.`;
    }
    const date = datetimeInput ? new Date(datetimeInput) : null;
    if (!date || Number.isNaN(date.getTime())) {
      errors.datetime = 'Please choose a valid date and time.';
    } else if (date.getTime() <= Date.now()) {
      errors.datetime = 'Events must start in the future.';
    }
    if (!location) {
      errors.location = 'Pick a spot on the map to continue.';
    }
    const trimmedLocationName = locationName.trim();
    if (trimmedLocationName.length < LOCATION_NAME_LIMITS.min || trimmedLocationName.length > LOCATION_NAME_LIMITS.max) {
      errors.locationName = `Location name must be between ${LOCATION_NAME_LIMITS.min} and ${LOCATION_NAME_LIMITS.max} characters.`;
    }
    if (Number.isNaN(maxParticipants) || maxParticipants < MAX_PARTICIPANTS_LIMITS.min || maxParticipants > MAX_PARTICIPANTS_LIMITS.max) {
      errors.maxParticipants = `Max participants must be between ${MAX_PARTICIPANTS_LIMITS.min} and ${MAX_PARTICIPANTS_LIMITS.max}.`;
    }
    setFieldErrors(errors);
    return errors;
  };

  const handleContinue = () => {
    const errors = validateStep(mobileStep);
    if (Object.keys(errors).length > 0) {
      showErrorToast('Fix the highlighted fields', 'Update the form before continuing.');
      return;
    }
    setMobileStep((prev) => Math.min(prev + 1, 3));
  };

  const handleBack = () => {
    if (mobileStep === 1) {
      router.back();
    } else {
      setFieldErrors({});
      setMobileStep((prev) => prev - 1);
    }
  };

  const submitEvent = async () => {
    setStatusIntent('idle');
    setStatusMessage(null);

    const errors = validateBeforeSubmit();
    if (Object.keys(errors).length > 0) {
      showErrorToast('Fix the highlighted fields', 'Update the form before publishing.');
      return;
    }
    if (!location) return;

    const datetimeIso = new Date(datetimeInput).toISOString();
    setSubmitting(true);
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          datetime: datetimeIso,
          location: { latitude: location.lat, longitude: location.lng },
          locationName: locationName.trim(),
          maxParticipants,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload & { event?: { id: string } };

      if (!response.ok) {
        setFieldErrors((prev) => ({ ...prev, ...(payload.errors ?? {}) }));
        setStatusIntent('error');
        const message = payload.error ?? 'Could not create the event.';
        setStatusMessage(message);
        showErrorToast('Unable to publish event', message);
        return;
      }

      sessionStorage.setItem('tonight:event-created', '1');
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Failed to create event', error);
      setStatusIntent('error');
      const message = 'Unexpected error while creating the event. Please try again.';
      setStatusMessage(message);
      showErrorToast('Unexpected error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitEvent();
  };

  const errorBorderClass = 'border-rose-400/80 focus:border-rose-400 focus:ring-rose-400/30';
  const categories = Object.values(CATEGORY_DEFINITIONS);

  return (
    <div className="min-h-dvh bg-background text-foreground">

      {/* ── Mobile: step-by-step flow ── */}
      <div className="fixed inset-0 flex flex-col md:hidden">

        {/* Step header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border/60 bg-background/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur-lg">
          <button
            type="button"
            onClick={handleBack}
            aria-label={mobileStep === 1 ? 'Back' : 'Previous step'}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/60 text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Step {mobileStep} of 3</p>
            <p className="text-base font-semibold leading-tight text-foreground">
              {mobileStep === 1 && 'Event details'}
              {mobileStep === 2 && 'Date & guests'}
              {mobileStep === 3 && 'Location'}
            </p>
          </div>
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={classNames(
                  'rounded-full transition-all duration-200',
                  s === mobileStep ? 'h-2 w-5 bg-primary' : s < mobileStep ? 'h-2 w-2 bg-primary/50' : 'h-2 w-2 bg-border/60'
                )}
              />
            ))}
          </div>
        </div>

        {/* Scrollable step content */}
        <div ref={mobileContentRef} className="flex-1 overflow-y-auto px-4 py-5">
          <div>

            {/* Step 1: Event details */}
            {mobileStep === 1 && (
              <div className="space-y-5">
                <section className="rounded-3xl border border-border/60 bg-card/40 p-4 shadow-xl shadow-black/25">
                  <header className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category</p>
                      <p className="text-xs text-muted-foreground/80">Optional: highlight the vibe.</p>
                    </div>
                    {selectedCategory && (
                      <button type="button" onClick={() => setSelectedCategory(null)} className="text-[11px] font-semibold text-primary">
                        Clear
                      </button>
                    )}
                  </header>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setCategoryDrawerOpen(true)}
                      className="inline-flex w-full items-center justify-between rounded-2xl border border-border/60 bg-background/40 px-4 py-3 text-sm font-semibold text-foreground transition hover:border-primary/60"
                    >
                      <span className="flex items-center gap-2">
                        {selectedCategory && (() => {
                          const def = CATEGORY_DEFINITIONS[selectedCategory];
                          return <def.icon className="h-4 w-4 text-primary" />;
                        })()}
                        {selectedCategory ? CATEGORY_DEFINITIONS[selectedCategory].label : 'Pick a category'}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </section>

                <section className="rounded-3xl border border-border/60 bg-card/40 p-4 shadow-xl shadow-black/25">
                  <div className="space-y-5">
                    <FormField label="Title" icon={Type}>
                      <input
                        id="event-title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Going to cinema"
                        className={classNames(INPUT_BASE_CLASS, fieldErrors.title && errorBorderClass)}
                        maxLength={TITLE_LIMITS.max}
                      />
                      <FieldMeta>{title.trim().length}/{TITLE_LIMITS.max} characters</FieldMeta>
                      {fieldErrors.title && <FieldError message={fieldErrors.title} />}
                    </FormField>

                    <FormField label="Description" icon={AlignLeft}>
                      <textarea
                        id="event-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Tell people what you're planning..."
                        className={classNames(INPUT_BASE_CLASS, 'min-h-[120px] resize-none py-3', fieldErrors.description && errorBorderClass)}
                        maxLength={DESCRIPTION_LIMITS.max}
                      />
                      <FieldMeta>{description.trim().length}/{DESCRIPTION_LIMITS.max} characters</FieldMeta>
                      {fieldErrors.description && <FieldError message={fieldErrors.description} />}
                    </FormField>
                  </div>
                </section>
              </div>
            )}

            {/* Step 2: Date & guests */}
            {mobileStep === 2 && (
              <div className="space-y-5">
                <section className="rounded-3xl border border-border/60 bg-card/40 p-4 shadow-xl shadow-black/25">
                  <div className="space-y-5">
                    <FormField label="Date & time" icon={Clock}>
                      <input
                        id="event-datetime"
                        type="datetime-local"
                        value={datetimeInput}
                        onChange={(e) => setDatetimeInput(e.target.value)}
                        className={classNames(INPUT_BASE_CLASS, fieldErrors.datetime && errorBorderClass)}
                        min={getInitialDateValue()}
                      />
                      <FieldMeta>{friendlyDatetime}</FieldMeta>
                      {fieldErrors.datetime && <FieldError message={fieldErrors.datetime} />}
                    </FormField>

                    <FormField label="Max participants" icon={Users}>
                      <div className="space-y-2">
                        <div className="flex items-center rounded-2xl border border-border/70 bg-card/50 text-foreground">
                          <button
                            type="button"
                            onClick={() => handleParticipantChange(-1)}
                            className="flex h-12 w-12 items-center justify-center text-lg font-semibold text-muted-foreground transition hover:text-foreground"
                            aria-label="Decrease participants"
                          >
                            -
                          </button>
                          <span className="flex h-12 flex-1 items-center justify-center border-x border-border/70 text-lg font-semibold">
                            {maxParticipants}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleParticipantChange(1)}
                            className="flex h-12 w-12 items-center justify-center text-lg font-semibold text-muted-foreground transition hover:text-foreground"
                            aria-label="Increase participants"
                          >
                            +
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          You + {Math.max(1, maxParticipants - 1)} {maxParticipants - 1 === 1 ? 'other' : 'others'}
                        </p>
                      </div>
                      {fieldErrors.maxParticipants && <FieldError message={fieldErrors.maxParticipants} />}
                    </FormField>
                  </div>
                </section>
              </div>
            )}

            {/* Step 3: Location */}
            {mobileStep === 3 && (
              <div className="space-y-5">
                <section className="rounded-3xl border border-border/60 bg-card/40 p-4 shadow-xl shadow-black/25">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location</p>
                    <p className="text-xs text-muted-foreground/80">Search by name or tap the map to drop a pin.</p>
                  </div>

                  <div className="mt-4 space-y-3">
                    <MapboxLocationPicker
                      label="Event location"
                      initialValue={location}
                      initialCenter={mapCenter}
                      onChange={setLocation}
                      onLocationName={(name) => {
                        setLocationName(name);
                        setSuggestions([]);
                        setShowSuggestions(false);
                      }}
                      tone="dark"
                      className="rounded-2xl border border-border/40 bg-card/30 p-3"
                    />
                    {fieldErrors.location && <FieldError message={fieldErrors.location} />}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label
                          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                          htmlFor="event-location-name"
                        >
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground/70" />
                          Location name
                        </label>
                        <button
                          type="button"
                          onClick={handleGeolocate}
                          disabled={geolocating}
                          className="text-xs font-semibold text-primary transition hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {geolocating ? 'Locating…' : 'Use my location'}
                        </button>
                      </div>
                      <input
                        id="event-location-name"
                        type="text"
                        value={locationName}
                        onChange={(e) => handleLocationNameChange(e.target.value)}
                        onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                        onBlur={() => setShowSuggestions(false)}
                        placeholder="Search or type a place name…"
                        className={classNames(INPUT_BASE_CLASS, fieldErrors.locationName && errorBorderClass)}
                        maxLength={LOCATION_NAME_LIMITS.max}
                        autoComplete="off"
                      />
                      <FieldMeta>
                        {locationName.trim().length}/{LOCATION_NAME_LIMITS.max} characters
                      </FieldMeta>
                      {fieldErrors.locationName && <FieldError message={fieldErrors.locationName} />}
                    </div>

                    {showSuggestions && suggestions.length > 0 && (
                      <div className="rounded-2xl border border-border/60 bg-card shadow-xl overflow-hidden">
                        {suggestions.map((s) => {
                          const ctx = s.fullName.startsWith(s.name + ', ') ? s.fullName.slice(s.name.length + 2) : '';
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); handleSuggestionSelect(s); }}
                              className="flex w-full flex-col gap-0.5 border-b border-border/40 px-4 py-3 text-left last:border-0 hover:bg-card/80 transition-colors"
                            >
                              <span className="text-sm font-medium text-foreground">{s.name}</span>
                              {ctx && <span className="text-xs text-muted-foreground line-clamp-1">{ctx}</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>

                {statusMessage && <StatusBanner intent={statusIntent} message={statusMessage} />}
              </div>
            )}
          </div>
        </div>

        {/* Static bottom action button */}
        <div className="shrink-0 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4">
          {mobileStep < 3 ? (
            <button
              type="button"
              onClick={handleContinue}
              disabled={mobileStep === 1 && (
                title.trim().length < TITLE_LIMITS.min ||
                title.trim().length > TITLE_LIMITS.max ||
                description.trim().length < DESCRIPTION_LIMITS.min ||
                description.trim().length > DESCRIPTION_LIMITS.max
              )}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={submitEvent}
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Publishing…' : 'Create event'}
            </button>
          )}
        </div>
      </div>

      {/* ── Desktop: full single-page form ── */}
      <div className="hidden md:flex md:min-h-dvh">
        <DesktopSidebar
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          onCreate={() => router.push('/events/create')}
          onNavigateDiscover={() => router.push('/')}
          onNavigatePeople={() => router.push('/people')}
          onNavigateMessages={() => router.push('/messages')}
          activePrimaryNav="discover"
        />

        <div className="flex flex-1 flex-col">
          <DesktopHeader
            title="Create"
            subtitle="Share what you're planning tonight"
            onNavigateProfile={() => router.push('/profile')}
            onNavigateMessages={() => router.push('/messages')}
            userDisplayName={currentUser?.displayName ?? null}
            userEmail={currentUser?.email ?? null}
            userPhotoUrl={currentUser?.photoUrl ?? null}
          />

          <main className="flex-1 px-10 pb-12 pt-8">
            <div className="mx-auto w-full max-w-4xl space-y-6">
              {statusMessage && <StatusBanner intent={statusIntent} message={statusMessage} />}

              <form onSubmit={onSubmit} className="space-y-6">
                {/* Category */}
                <section className="rounded-3xl border border-border/60 bg-card/40 p-5 shadow-xl shadow-black/25">
                  <header className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category</p>
                      <p className="text-xs text-muted-foreground/80">Optional: highlight the vibe.</p>
                    </div>
                    {selectedCategory && (
                      <button type="button" onClick={() => setSelectedCategory(null)} className="text-[11px] font-semibold text-primary">
                        Clear
                      </button>
                    )}
                  </header>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setSelectedCategory(category.id)}
                        className={classNames(
                          'flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-4 text-xs font-semibold transition',
                          selectedCategory === category.id
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border/60 bg-background/40 text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <category.icon className="h-5 w-5" />
                        {category.label}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Title & Description */}
                <section className="rounded-3xl border border-border/60 bg-card/40 p-5 shadow-xl shadow-black/25">
                  <div className="space-y-5">
                    <FormField label="Title" icon={Type}>
                      <input
                        id="event-title-desktop"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Going to cinema"
                        className={classNames(INPUT_BASE_CLASS, fieldErrors.title && errorBorderClass)}
                        maxLength={TITLE_LIMITS.max}
                        required
                      />
                      <FieldMeta>{title.trim().length}/{TITLE_LIMITS.max} characters</FieldMeta>
                      {fieldErrors.title && <FieldError message={fieldErrors.title} />}
                    </FormField>

                    <FormField label="Description" icon={AlignLeft}>
                      <textarea
                        id="event-description-desktop"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Tell people what you're planning..."
                        className={classNames(INPUT_BASE_CLASS, 'min-h-[140px] resize-none py-3', fieldErrors.description && errorBorderClass)}
                        maxLength={DESCRIPTION_LIMITS.max}
                      />
                      <FieldMeta>{description.trim().length}/{DESCRIPTION_LIMITS.max} characters</FieldMeta>
                      {fieldErrors.description && <FieldError message={fieldErrors.description} />}
                    </FormField>
                  </div>
                </section>

                {/* Date & Participants */}
                <section className="rounded-3xl border border-border/60 bg-card/40 p-5 shadow-xl shadow-black/25">
                  <div className="grid grid-cols-2 gap-5">
                    <FormField label="Date & time" icon={Clock}>
                      <input
                        id="event-datetime-desktop"
                        type="datetime-local"
                        value={datetimeInput}
                        onChange={(e) => setDatetimeInput(e.target.value)}
                        className={classNames(INPUT_BASE_CLASS, fieldErrors.datetime && errorBorderClass)}
                        min={getInitialDateValue()}
                        required
                      />
                      <FieldMeta>{friendlyDatetime}</FieldMeta>
                      {fieldErrors.datetime && <FieldError message={fieldErrors.datetime} />}
                    </FormField>

                    <FormField label="Max participants" icon={Users}>
                      <div className="space-y-2">
                        <div className="flex items-center rounded-2xl border border-border/70 bg-card/50 text-foreground">
                          <button
                            type="button"
                            onClick={() => handleParticipantChange(-1)}
                            className="flex h-12 w-12 items-center justify-center text-lg font-semibold text-muted-foreground transition hover:text-foreground"
                            aria-label="Decrease participants"
                          >
                            -
                          </button>
                          <span className="flex h-12 flex-1 items-center justify-center border-x border-border/70 text-lg font-semibold">
                            {maxParticipants}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleParticipantChange(1)}
                            className="flex h-12 w-12 items-center justify-center text-lg font-semibold text-muted-foreground transition hover:text-foreground"
                            aria-label="Increase participants"
                          >
                            +
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          You + {Math.max(1, maxParticipants - 1)} {maxParticipants - 1 === 1 ? 'other' : 'others'}
                        </p>
                      </div>
                      {fieldErrors.maxParticipants && <FieldError message={fieldErrors.maxParticipants} />}
                    </FormField>
                  </div>
                </section>

                {/* Location */}
                <section className="rounded-3xl border border-border/60 bg-card/40 p-5 shadow-xl shadow-black/25">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location</p>
                    <p className="text-xs text-muted-foreground/80">Search by name or tap the map to drop a pin.</p>
                  </div>

                  <div className="mt-4 space-y-3">
                    <MapboxLocationPicker
                      label="Event location"
                      initialValue={location}
                      initialCenter={mapCenter}
                      onChange={setLocation}
                      onLocationName={(name) => {
                        setLocationName(name);
                        setSuggestions([]);
                        setShowSuggestions(false);
                      }}
                      tone="dark"
                      className="rounded-2xl border border-border/40 bg-card/30 p-3"
                    />
                    {fieldErrors.location && <FieldError message={fieldErrors.location} />}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label
                          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                          htmlFor="event-location-name-desktop"
                        >
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground/70" />
                          Location name
                        </label>
                        <button
                          type="button"
                          onClick={handleGeolocate}
                          disabled={geolocating}
                          className="text-xs font-semibold text-primary transition hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {geolocating ? 'Locating…' : 'Use my location'}
                        </button>
                      </div>
                      <input
                        id="event-location-name-desktop"
                        type="text"
                        value={locationName}
                        onChange={(e) => handleLocationNameChange(e.target.value)}
                        onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                        onBlur={() => setShowSuggestions(false)}
                        placeholder="Search or type a place name…"
                        className={classNames(INPUT_BASE_CLASS, fieldErrors.locationName && errorBorderClass)}
                        maxLength={LOCATION_NAME_LIMITS.max}
                        autoComplete="off"
                        required
                      />
                      <FieldMeta>
                        {locationName.trim().length}/{LOCATION_NAME_LIMITS.max} characters
                      </FieldMeta>
                      {fieldErrors.locationName && <FieldError message={fieldErrors.locationName} />}
                    </div>

                    {showSuggestions && suggestions.length > 0 && (
                      <div className="rounded-2xl border border-border/60 bg-card shadow-xl overflow-hidden">
                        {suggestions.map((s) => {
                          const ctx = s.fullName.startsWith(s.name + ', ') ? s.fullName.slice(s.name.length + 2) : '';
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); handleSuggestionSelect(s); }}
                              className="flex w-full flex-col gap-0.5 border-b border-border/40 px-4 py-3 text-left last:border-0 hover:bg-card/80 transition-colors"
                            >
                              <span className="text-sm font-medium text-foreground">{s.name}</span>
                              {ctx && <span className="text-xs text-muted-foreground line-clamp-1">{ctx}</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>

                {/* Submit row */}
                <div className="flex flex-col gap-3 border-t border-white/5 pt-4 text-sm text-muted-foreground">
                  <p>You can edit or cancel the event later from your profile.</p>
                  <div className="flex items-center justify-end gap-4">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        setTitle('');
                        setDescription('');
                        setDatetimeInput(getInitialDateValue());
                        setLocationName('');
                        setMaxParticipants(DEFAULT_MAX_PARTICIPANTS);
                        setLocation(null);
                        setFieldErrors({});
                        setStatusMessage(null);
                        setSelectedCategory(null);
                      }}
                      className="text-sm font-semibold text-muted-foreground hover:text-primary"
                    >
                      Reset form
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center justify-center rounded-2xl bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting ? 'Publishing…' : 'Post event'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </main>
        </div>
      </div>

      {/* Category drawer — used in mobile step 1 */}
      <Drawer
        isOpen={categoryDrawerOpen}
        onClose={() => setCategoryDrawerOpen(false)}
        title="Choose a category"
        className="md:hidden"
      >
        <div className="grid grid-cols-2 gap-3">
          {categories.filter((c) => c.id !== 'other').map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => {
                setSelectedCategory(category.id);
                setCategoryDrawerOpen(false);
              }}
              className={classNames(
                'flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-xs font-semibold transition',
                selectedCategory === category.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/60 bg-background/40 text-muted-foreground hover:text-foreground'
              )}
            >
              <category.icon className="h-5 w-5" />
              {category.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('other');
              setCategoryDrawerOpen(false);
            }}
            className={classNames(
              'col-span-2 flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-xs font-semibold transition',
              selectedCategory === 'other'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border/60 bg-background/40 text-muted-foreground hover:text-foreground'
            )}
          >
            <Sparkles className="h-4 w-4" />
            Other
          </button>
        </div>
      </Drawer>

      {/* MobileActionBar intentionally omitted — nav is hidden during create flow */}
    </div>
  );
}

type StatusBannerProps = { intent: 'idle' | 'error' | 'success'; message: string };
function StatusBanner({ intent, message }: StatusBannerProps) {
  const isSuccess = intent === 'success';
  return (
    <div
      role="status"
      className={classNames(
        'rounded-3xl border px-5 py-4 text-sm shadow-lg shadow-black/30',
        isSuccess
          ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-50'
          : 'border-rose-400/50 bg-rose-500/10 text-rose-100'
      )}
    >
      {message}
    </div>
  );
}

type FormFieldProps = { label: string; icon: LucideIcon; children: ReactNode };
function FormField({ label, icon: Icon, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
        {label}
      </label>
      {children}
    </div>
  );
}

function FieldError({ message }: { message: string }) {
  return <p className="text-xs text-rose-300">{message}</p>;
}

function FieldMeta({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}
