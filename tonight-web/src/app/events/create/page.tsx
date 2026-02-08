'use client';

import { FormEvent, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import MapboxLocationPicker, { type MapCoordinates } from '@/components/MapboxLocationPicker';
import { AuthStatusMessage } from '@/components/auth/AuthStatusMessage';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { showErrorToast, showSuccessToast } from '@/lib/toast';

const TITLE_LIMITS = { min: 3, max: 120 } as const;
const DESCRIPTION_LIMITS = { min: 1, max: 2000 } as const;
const LOCATION_NAME_LIMITS = { min: 2, max: 120 } as const;
const MAX_PARTICIPANTS_LIMITS = { min: 2, max: 50 } as const;
const DEFAULT_MAX_PARTICIPANTS = 2;

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

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Host</p>
          <h1 className="text-4xl font-semibold text-zinc-900">Create an event</h1>
          <p className="text-sm text-zinc-500">
            Share something happening tonight. We’ll notify nearby people once the event is live.
          </p>
        </header>

        {statusMessage && (
          <div
            role="status"
            className={`rounded-xl border px-4 py-3 text-sm ${
              statusIntent === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {statusMessage}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-10">
          <section className="rounded-3xl bg-white p-8 shadow-sm">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Late-night ramen crawl"
                  className={`w-full rounded-2xl border px-4 py-3 text-base outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 ${
                    fieldErrors.title ? 'border-rose-400' : 'border-zinc-200'
                  }`}
                  maxLength={TITLE_LIMITS.max}
                  required
                />
                <p className="text-xs text-zinc-500">
                  {title.trim().length}/{TITLE_LIMITS.max} characters
                </p>
                {fieldErrors.title && <p className="text-xs text-rose-500">{fieldErrors.title}</p>}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Maximum participants
                </label>
                <input
                  type="number"
                  min={MAX_PARTICIPANTS_LIMITS.min}
                  max={MAX_PARTICIPANTS_LIMITS.max}
                  value={maxParticipants}
                  onChange={(event) => setMaxParticipants(Number(event.target.value) || DEFAULT_MAX_PARTICIPANTS)}
                  className={`w-full rounded-2xl border px-4 py-3 text-base outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 ${
                    fieldErrors.maxParticipants ? 'border-rose-400' : 'border-zinc-200'
                  }`}
                />
                <p className="text-xs text-zinc-500">
                  Keep it intimate ({MAX_PARTICIPANTS_LIMITS.min}-{MAX_PARTICIPANTS_LIMITS.max} people).
                </p>
                {fieldErrors.maxParticipants && (
                  <p className="text-xs text-rose-500">{fieldErrors.maxParticipants}</p>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Description
              </label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Walk us through the vibe, meetup point, and anything to bring."
                className={`min-h-[160px] w-full rounded-2xl border px-4 py-3 text-base outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 ${
                  fieldErrors.description ? 'border-rose-400' : 'border-zinc-200'
                }`}
                maxLength={DESCRIPTION_LIMITS.max}
              />
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>
                  {description.trim().length}/{DESCRIPTION_LIMITS.max} characters
                </span>
                {fieldErrors.description && <p className="text-rose-500">{fieldErrors.description}</p>}
              </div>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-8 shadow-sm">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Starts
                </label>
                <input
                  type="datetime-local"
                  value={datetimeInput}
                  onChange={(event) => setDatetimeInput(event.target.value)}
                  className={`w-full rounded-2xl border px-4 py-3 text-base outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 ${
                    fieldErrors.datetime ? 'border-rose-400' : 'border-zinc-200'
                  }`}
                  min={getInitialDateValue()}
                  required
                />
                <p className="text-xs text-zinc-500">{friendlyDatetime}</p>
                {fieldErrors.datetime && <p className="text-xs text-rose-500">{fieldErrors.datetime}</p>}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Location name
                </label>
                <input
                  type="text"
                  value={locationName}
                  onChange={(event) => setLocationName(event.target.value)}
                  placeholder="Mott & Bowery, outside the deli"
                  className={`w-full rounded-2xl border px-4 py-3 text-base outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 ${
                    fieldErrors.locationName ? 'border-rose-400' : 'border-zinc-200'
                  }`}
                  maxLength={LOCATION_NAME_LIMITS.max}
                  required
                />
                <p className="text-xs text-zinc-500">
                  Visible to attendees. {locationName.trim().length}/{LOCATION_NAME_LIMITS.max} characters
                </p>
                {fieldErrors.locationName && <p className="text-xs text-rose-500">{fieldErrors.locationName}</p>}
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-700">Pin the meetup spot</p>
                  <p className="text-xs text-zinc-500">Drop the marker where people should arrive.</p>
                </div>
                <button
                  type="button"
                  onClick={handleGeolocate}
                  className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-violet-500 hover:text-violet-600 disabled:cursor-not-allowed disabled:border-zinc-100 disabled:text-zinc-400"
                  disabled={geolocating}
                >
                  {geolocating ? 'Locating…' : 'Use my location'}
                </button>
              </div>

              <MapboxLocationPicker
                initialValue={location}
                onChange={setLocation}
                className="rounded-2xl"
              />
              {fieldErrors.location && <p className="text-xs text-rose-500">{fieldErrors.location}</p>}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-8 shadow-sm">
            <div className="space-y-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview</p>
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                <p className="text-lg font-semibold text-zinc-900">{title || 'Untitled event'}</p>
                <p className="text-sm text-zinc-500">{friendlyDatetime}</p>
                <p className="mt-2 text-sm text-zinc-600">
                  {description || 'Share the vibe so people know what to expect.'}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                  <span>{locationName || 'Add a meetup label'}</span>
                  <span>•</span>
                  <span>{location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'No coordinates yet'}</span>
                  <span>•</span>
                  <span>Up to {maxParticipants} people</span>
                </div>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-violet-600 px-8 py-3 text-base font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {submitting ? 'Publishing…' : 'Publish event'}
            </button>
            <button
              type="button"
              onClick={() => {
                setTitle('');
                setDescription('');
                setLocation(null);
                setLocationName('');
                setDatetimeInput(getInitialDateValue());
                setMaxParticipants(DEFAULT_MAX_PARTICIPANTS);
                setFieldErrors({});
                setStatusIntent('idle');
                setStatusMessage(null);
              }}
              className="rounded-full border border-zinc-200 px-8 py-3 text-base font-semibold text-zinc-700 transition hover:border-zinc-300"
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
