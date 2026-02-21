
'use client';

import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlignLeft, Clock, MapPin, Sparkles, Type, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import MapboxLocationPicker, { type MapCoordinates } from '@/components/MapboxLocationPicker';
import { DesktopHeader } from '@/components/tonight/DesktopHeader';
import { DesktopSidebar } from '@/components/tonight/DesktopSidebar';
import { MobileActionBar } from '@/components/tonight/MobileActionBar';
import { MobileBottomDrawer } from '@/components/tonight/MobileBottomDrawer';
import { AuthStatusMessage } from '@/components/auth/AuthStatusMessage';
import type { AuthUser } from '@/components/auth/AuthProvider';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { CATEGORY_DEFINITIONS, type CategoryId } from '@/lib/categories';
import { classNames } from '@/lib/classNames';
import { showErrorToast, showSuccessToast } from '@/lib/toast';

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
  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

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

type ApiErrorPayload = {
  error?: string;
  errors?: FieldErrors;
};

export default function CreateEventPage() {
  const { status: authStatus, user: authUser } = useRequireAuth();

  if (authStatus === 'loading') {
    return <AuthStatusMessage label="Checking your session…" />;
  }

  if (authStatus === 'unauthenticated') {
    return <AuthStatusMessage label="Redirecting you to the welcome screen…" />;
  }

  if (authStatus === 'error') {
    return <AuthStatusMessage label="We couldn't verify your session. Refresh to try again." />;
  }

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

  const friendlyDatetime = useMemo(() => formatReadableDatetime(datetimeInput), [datetimeInput]);
  const categories = useMemo(() => Object.values(CATEGORY_DEFINITIONS), []);
  const selectedCategoryDefinition = selectedCategory ? CATEGORY_DEFINITIONS[selectedCategory] : null;
  const categoryTriggerLabel = selectedCategoryDefinition ? selectedCategoryDefinition.label : 'Choose a category';
  const CategoryTriggerIcon = selectedCategoryDefinition?.icon ?? Sparkles;

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMapCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        // Silently fail - user hasn't granted permission or it failed
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
    );
  }, []);

  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) {
      setStatusIntent('error');
      setStatusMessage('Your browser does not support geolocation.');
      showErrorToast('Turn on location services', 'Your browser does not support geolocation.');
      return;
    }

    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setStatusIntent('idle');
        setStatusMessage(null);
        setGeolocating(false);
      },
      (error) => {
        console.error('Geolocation failed', error);
        setStatusIntent('error');
        setStatusMessage('Unable to detect your location. Try selecting it on the map.');
        showErrorToast('Unable to detect location', 'Try selecting it manually on the map.');
        setGeolocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const handleParticipantChange = (delta: number) => {
    setMaxParticipants((prev) => {
      const next = Math.max(MAX_PARTICIPANTS_LIMITS.min, Math.min(MAX_PARTICIPANTS_LIMITS.max, prev + delta));
      return Number.isFinite(next) ? next : DEFAULT_MAX_PARTICIPANTS;
    });
  };

  const validateBeforeSubmit = () => {
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

    if (
      Number.isNaN(maxParticipants) ||
      maxParticipants < MAX_PARTICIPANTS_LIMITS.min ||
      maxParticipants > MAX_PARTICIPANTS_LIMITS.max
    ) {
      errors.maxParticipants = `Max participants must be between ${MAX_PARTICIPANTS_LIMITS.min} and ${MAX_PARTICIPANTS_LIMITS.max}.`;
    }

    setFieldErrors(errors);
    return errors;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusIntent('idle');
    setStatusMessage(null);

    const errors = validateBeforeSubmit();
    if (Object.keys(errors).length > 0) {
      showErrorToast('Fix the highlighted fields', 'Update the form before publishing.');
      return;
    }

    if (!location) {
      return;
    }

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

      setStatusIntent('success');
      setStatusMessage('Event created! Redirecting…');
      showSuccessToast('Event published', 'Your meetup is now live in the feed.');
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

  const errorBorderClass = 'border-rose-400/80 focus:border-rose-400 focus:ring-rose-400/30';

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#101227] via-[#0f1324] to-[#050814] text-foreground">
      <div className="flex min-h-dvh flex-col md:flex-row">
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

          <main className="flex-1 px-4 pb-28 pt-4 md:px-10 md:pb-12 md:pt-8">
            <div className="mx-auto w-full max-w-4xl space-y-5 md:space-y-6">
              <MobileCreateHero />

              {statusMessage && (
                <StatusBanner intent={statusIntent} message={statusMessage} />
              )}

              <form onSubmit={onSubmit} className="space-y-5 md:space-y-6">
                <section className="rounded-3xl border border-border/60 bg-card/40 p-4 shadow-xl shadow-black/25 md:p-5">
                  <header className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category</p>
                      <p className="text-xs text-muted-foreground/80">Optional: highlight the vibe.</p>
                      {selectedCategoryDefinition && (
                        <p className="mt-1 text-sm font-semibold text-foreground">{selectedCategoryDefinition.label}</p>
                      )}
                    </div>
                    {selectedCategory && (
                      <button
                        type="button"
                        onClick={() => setSelectedCategory(null)}
                        className="text-[11px] font-semibold text-primary"
                      >
                        Clear
                      </button>
                    )}
                  </header>
                  <div className="mt-4 hidden gap-3 md:grid md:grid-cols-3">
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
                  <div className="mt-3 md:hidden">
                    <button
                      type="button"
                      onClick={() => setCategoryDrawerOpen(true)}
                      className="flex w-full items-center justify-between rounded-2xl border border-border/70 bg-background/40 px-4 py-3 text-left text-sm font-semibold text-foreground shadow-inner shadow-black/10"
                    >
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Selected vibe</p>
                        <p className="text-base font-semibold text-foreground">{categoryTriggerLabel}</p>
                      </div>
                      <CategoryTriggerIcon className="h-5 w-5 text-primary" aria-hidden="true" />
                    </button>
                  </div>
                </section>

                <section className="rounded-3xl border border-border/60 bg-card/40 p-4 shadow-xl shadow-black/25 md:p-5">
                  <div className="space-y-4">
                    <FormField label="Title" icon={Type}>
                      <input
                        id="event-title"
                        type="text"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Going to cinema"
                        className={classNames(INPUT_BASE_CLASS, fieldErrors.title && errorBorderClass)}
                        maxLength={TITLE_LIMITS.max}
                        required
                      />
                      <FieldMeta>
                        {title.trim().length}/{TITLE_LIMITS.max} characters
                      </FieldMeta>
                      {fieldErrors.title && <FieldError message={fieldErrors.title} />}
                    </FormField>

                    <FormField label="Description" icon={AlignLeft}>
                      <textarea
                        id="event-description"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Tell people what you're planning..."
                        className={classNames(INPUT_BASE_CLASS, 'min-h-[140px] resize-none py-3', fieldErrors.description && errorBorderClass)}
                        maxLength={DESCRIPTION_LIMITS.max}
                      />
                      <FieldMeta>
                        {description.trim().length}/{DESCRIPTION_LIMITS.max} characters
                      </FieldMeta>
                      {fieldErrors.description && <FieldError message={fieldErrors.description} />}
                    </FormField>
                  </div>
                </section>

                <section className="rounded-3xl border border-border/60 bg-card/40 p-4 shadow-xl shadow-black/25 md:p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="Date & time" icon={Clock}>
                      <input
                        id="event-datetime"
                        type="datetime-local"
                        value={datetimeInput}
                        onChange={(event) => setDatetimeInput(event.target.value)}
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

                <section className="rounded-3xl border border-border/60 bg-card/40 p-4 shadow-xl shadow-black/25 md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location</p>
                      <p className="text-xs text-muted-foreground/80">Drop the meetup pin and name the spot.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleGeolocate}
                      className="rounded-full border border-border/70 px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={geolocating}
                    >
                      {geolocating ? 'Locating…' : 'Use my location'}
                    </button>
                  </div>

                  <div className="mt-4 space-y-4">
                    <MapboxLocationPicker
                      label="Event location"
                      initialValue={location}
                      initialCenter={mapCenter}
                      onChange={setLocation}
                      tone="dark"
                      className="rounded-2xl border border-border/40 bg-card/30 p-3"
                    />
                    {fieldErrors.location && <FieldError message={fieldErrors.location} />}

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="event-location-name">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground/70" />
                        Location name
                      </label>
                      <input
                        id="event-location-name"
                        type="text"
                        value={locationName}
                        onChange={(event) => setLocationName(event.target.value)}
                        placeholder="Cinema City, Downtown"
                        className={classNames(INPUT_BASE_CLASS, fieldErrors.locationName && errorBorderClass)}
                        maxLength={LOCATION_NAME_LIMITS.max}
                        required
                      />
                      <FieldMeta>
                        Visible to attendees. {locationName.trim().length}/{LOCATION_NAME_LIMITS.max} characters
                      </FieldMeta>
                      {fieldErrors.locationName && <FieldError message={fieldErrors.locationName} />}
                    </div>
                  </div>
                </section>

                <div className="flex flex-col gap-3 border-t border-white/5 pt-4 text-sm text-muted-foreground">
                  <p>You can edit or cancel the event later from your profile.</p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <button
                      type="button"
                      className="text-sm font-semibold text-muted-foreground hover:text-primary"
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
                      disabled={submitting}
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

              <MobileBottomDrawer
                open={categoryDrawerOpen}
                onClose={() => setCategoryDrawerOpen(false)}
                title="Pick a category"
                footer={
                  selectedCategory ? (
                    <button
                      type="button"
                      className="text-sm font-semibold text-primary"
                      onClick={() => setSelectedCategory(null)}
                    >
                      Clear selection
                    </button>
                  ) : null
                }
              >
                <p className="text-xs text-muted-foreground">Tap to switch the vibe for your meetup.</p>
                <div className="grid grid-cols-2 gap-3">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(category.id);
                        setCategoryDrawerOpen(false);
                      }}
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
              </MobileBottomDrawer>
            </div>
          </main>
        </div>
      </div>

      <MobileActionBar
        active="create"
        onNavigateDiscover={() => router.push('/')}
        onNavigatePeople={() => router.push('/people')}
        onCreate={() => router.push('/events/create')}
        onOpenProfile={() => router.push('/profile')}
      />
    </div>
  );
}

function MobileCreateHero() {
  return (
    <div className="rounded-3xl border border-border/70 bg-card/50 px-5 py-4 text-foreground shadow-xl shadow-black/20 md:hidden">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Tonight</p>
      <h1 className="mt-1 text-2xl font-serif font-semibold leading-tight">Create event</h1>
      <p className="text-xs text-muted-foreground">Share what you're up to tonight</p>
    </div>
  );
}

type SummaryItemProps = {
  label: string;
  value: string;
};

function SummaryItem({ label, value }: SummaryItemProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/30 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

type StatusBannerProps = {
  intent: 'idle' | 'error' | 'success';
  message: string;
};

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

type FormFieldProps = {
  label: string;
  icon: LucideIcon;
  children: ReactNode;
};

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

type FieldErrorProps = {
  message: string;
};

function FieldError({ message }: FieldErrorProps) {
  return <p className="text-xs text-rose-300">{message}</p>;
}

type FieldMetaProps = {
  children: ReactNode;
};

function FieldMeta({ children }: FieldMetaProps) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}
