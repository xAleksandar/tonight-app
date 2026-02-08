
'use client';

import { FormEvent, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlignLeft, CalendarDays, MapPin, Sparkles, Type, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import MapboxLocationPicker, { type MapCoordinates } from '@/components/MapboxLocationPicker';
import { AuthStatusMessage } from '@/components/auth/AuthStatusMessage';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { showErrorToast, showSuccessToast } from '@/lib/toast';

const TITLE_LIMITS = { min: 3, max: 120 } as const;
const DESCRIPTION_LIMITS = { min: 1, max: 2000 } as const;
const LOCATION_NAME_LIMITS = { min: 2, max: 120 } as const;
const MAX_PARTICIPANTS_LIMITS = { min: 2, max: 50 } as const;
const DEFAULT_MAX_PARTICIPANTS = 2;

const INPUT_BASE_CLASS =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/30 focus:outline-none transition';

const HOSTING_TIPS = [
  {
    title: 'Set the vibe',
    description: 'Describe the atmosphere, dress code, and anything guests should bring before they request to join.',
  },
  {
    title: 'Keep it intimate',
    description: 'Tonight meetups shine when they stay small. Pick a cap that matches the plan and update it later if needed.',
  },
  {
    title: 'Pin it precisely',
    description: 'Drop the marker exactly where guests should meet so navigation is effortless when they are en route.',
  },
] as const;

type FieldErrors = Partial<Record<'title' | 'description' | 'datetime' | 'location' | 'locationName' | 'maxParticipants', string>>;

type ApiErrorPayload = {
  error?: string;
  errors?: FieldErrors;
};

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

export default function CreateEventPage() {
  const { status: authStatus } = useRequireAuth();

  if (authStatus === 'loading') {
    return <AuthStatusMessage label="Checking your session…" />;
  }

  if (authStatus === 'unauthenticated') {
    return <AuthStatusMessage label="Redirecting you to the welcome screen…" />;
  }

  if (authStatus === 'error') {
    return <AuthStatusMessage label="We couldn't verify your session. Refresh to try again." />;
  }

  return <AuthenticatedCreateEventPage />;
}

function AuthenticatedCreateEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [datetimeInput, setDatetimeInput] = useState(getInitialDateValue);
  const [locationName, setLocationName] = useState('');
  const [maxParticipants, setMaxParticipants] = useState<number>(DEFAULT_MAX_PARTICIPANTS);
  const [location, setLocation] = useState<MapCoordinates | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusIntent, setStatusIntent] = useState<'idle' | 'error' | 'success'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [geolocating, setGeolocating] = useState(false);

  const friendlyDatetime = useMemo(() => formatReadableDatetime(datetimeInput), [datetimeInput]);

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

  const errorBorderClass = 'border-rose-400/70 focus:border-rose-300 focus:ring-rose-400/30';

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#101227] via-[#0f1324] to-[#050814] px-4 py-6 text-white sm:px-6 md:py-10">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <header className="rounded-3xl border border-white/10 bg-white/5 px-6 py-8 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                <Sparkles className="h-3.5 w-3.5" />
                Host
              </div>
              <h1 className="mt-4 text-3xl font-semibold leading-tight">Create an event</h1>
              <p className="mt-2 text-sm text-white/70">
                Share what you're planning tonight. We'll surface it to people nearby once it's live.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryStat icon={MapPin} label="Meetup label" value={locationName.trim() || 'Add a location'} />
              <SummaryStat icon={CalendarDays} label="Starts" value={friendlyDatetime} />
              <SummaryStat icon={Users} label="Capacity" value={`Up to ${maxParticipants} people`} />
            </div>
          </div>
        </header>

        {statusMessage && (
          <div
            role="status"
            className={`rounded-3xl border px-5 py-4 text-sm shadow-lg shadow-black/40 ${
              statusIntent === 'success'
                ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-50'
                : 'border-rose-400/50 bg-rose-500/10 text-rose-100'
            }`}
          >
            {statusMessage}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-8">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/30">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="event-title" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/60">
                  <Type className="h-3.5 w-3.5 text-white/40" />
                  Title
                </label>
                <input
                  id="event-title"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Late-night ramen crawl"
                  className={`${INPUT_BASE_CLASS} ${fieldErrors.title ? errorBorderClass : ''}`}
                  maxLength={TITLE_LIMITS.max}
                  required
                />
                <p className="text-xs text-white/60">
                  {title.trim().length}/{TITLE_LIMITS.max} characters
                </p>
                {fieldErrors.title && <p className="text-xs text-rose-300">{fieldErrors.title}</p>}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/60">
                  <Users className="h-3.5 w-3.5 text-white/40" />
                  Maximum participants
                </label>
                <input
                  type="number"
                  min={MAX_PARTICIPANTS_LIMITS.min}
                  max={MAX_PARTICIPANTS_LIMITS.max}
                  value={maxParticipants}
                  onChange={(event) => setMaxParticipants(Number(event.target.value) || DEFAULT_MAX_PARTICIPANTS)}
                  className={`${INPUT_BASE_CLASS} ${fieldErrors.maxParticipants ? errorBorderClass : ''}`}
                />
                <p className="text-xs text-white/60">
                  Keep it intimate ({MAX_PARTICIPANTS_LIMITS.min}-{MAX_PARTICIPANTS_LIMITS.max} people).
                </p>
                {fieldErrors.maxParticipants && <p className="text-xs text-rose-300">{fieldErrors.maxParticipants}</p>}
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <label htmlFor="event-description" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/60">
                <AlignLeft className="h-3.5 w-3.5 text-white/40" />
                Description
              </label>
              <textarea
                id="event-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Walk us through the vibe, meetup point, and anything to bring."
                className={`${INPUT_BASE_CLASS} min-h-[160px] ${fieldErrors.description ? errorBorderClass : ''}`}
                maxLength={DESCRIPTION_LIMITS.max}
              />
              <div className="flex flex-wrap items-center justify-between text-xs text-white/60">
                <span>
                  {description.trim().length}/{DESCRIPTION_LIMITS.max} characters
                </span>
                {fieldErrors.description && <p className="text-rose-300">{fieldErrors.description}</p>}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/30">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="event-datetime" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/60">
                  <CalendarDays className="h-3.5 w-3.5 text-white/40" />
                  Starts
                </label>
                <input
                  id="event-datetime"
                  type="datetime-local"
                  value={datetimeInput}
                  onChange={(event) => setDatetimeInput(event.target.value)}
                  className={`${INPUT_BASE_CLASS} ${fieldErrors.datetime ? errorBorderClass : ''}`}
                  min={getInitialDateValue()}
                  required
                />
                <p className="text-xs text-white/60">{friendlyDatetime}</p>
                {fieldErrors.datetime && <p className="text-xs text-rose-300">{fieldErrors.datetime}</p>}
              </div>

              <div className="space-y-2">
                <label htmlFor="event-location-name" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/60">
                  <MapPin className="h-3.5 w-3.5 text-white/40" />
                  Location name
                </label>
                <input
                  id="event-location-name"
                  type="text"
                  value={locationName}
                  onChange={(event) => setLocationName(event.target.value)}
                  placeholder="Mott & Bowery, outside the deli"
                  className={`${INPUT_BASE_CLASS} ${fieldErrors.locationName ? errorBorderClass : ''}`}
                  maxLength={LOCATION_NAME_LIMITS.max}
                  required
                />
                <p className="text-xs text-white/60">
                  Visible to attendees. {locationName.trim().length}/{LOCATION_NAME_LIMITS.max} characters
                </p>
                {fieldErrors.locationName && <p className="text-xs text-rose-300">{fieldErrors.locationName}</p>}
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Location</p>
                  <p className="text-sm text-white/80">Drop the marker where guests should meet.</p>
                </div>
                <button
                  type="button"
                  onClick={handleGeolocate}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-emerald-300 hover:text-emerald-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/40"
                  disabled={geolocating}
                >
                  {geolocating ? 'Locating…' : 'Use my location'}
                </button>
              </div>

              <MapboxLocationPicker
                label="Event location"
                initialValue={location}
                onChange={setLocation}
                tone="dark"
                className="rounded-3xl border border-white/5 bg-white/5 p-4"
              />
              {fieldErrors.location && <p className="text-xs text-rose-300">{fieldErrors.location}</p>}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/30">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Preview</p>
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-lg font-semibold text-white">{title || 'Untitled event'}</p>
              <p className="text-sm text-white/70">{friendlyDatetime}</p>
              <p className="mt-2 text-sm text-white/80">
                {description || 'Share the vibe so people know what to expect.'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/60">
                <span>{locationName || 'Add a meetup label'}</span>
                <span>•</span>
                <span>
                  {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'No coordinates yet'}
                </span>
                <span>•</span>
                <span>Up to {maxParticipants} people</span>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6 shadow-xl shadow-black/30">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Hosting tips</p>
            <p className="mt-2 text-sm text-white/75">Little reminders to keep Tonight meetups delightful.</p>
            <ul className="mt-4 grid gap-4 md:grid-cols-3">
              {HOSTING_TIPS.map((tip) => (
                <li key={tip.title} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                  <p className="text-sm font-semibold text-white">{tip.title}</p>
                  <p className="mt-1 text-xs text-white/70">{tip.description}</p>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-emerald-400 px-6 py-2.5 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/40 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-white/30 disabled:text-white/60"
            >
              {submitting ? 'Publishing…' : 'Publish event'}
            </button>
            <button
              type="button"
              disabled={submitting}
              className="rounded-full border border-white/15 px-6 py-2.5 text-sm font-semibold text-white transition hover:border-white/40 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/40"
              onClick={() => {
                setTitle('');
                setDescription('');
                setDatetimeInput(getInitialDateValue());
                setLocationName('');
                setMaxParticipants(DEFAULT_MAX_PARTICIPANTS);
                setLocation(null);
                setFieldErrors({});
                setStatusMessage(null);
              }}
            >
              Reset form
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type SummaryStatProps = {
  icon: LucideIcon;
  label: string;
  value: string;
};

function SummaryStat({ icon: Icon, label, value }: SummaryStatProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <span className="rounded-xl bg-white/10 p-2 text-emerald-200">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-white/60">{label}</p>
        <p className="text-sm font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}
