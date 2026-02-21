'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import UserAvatar from '@/components/UserAvatar';
import { showErrorToast, showSuccessToast } from '@/lib/toast';

type JoinRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

const STATUS_LABELS: Record<JoinRequestStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
};

const STATUS_BADGE_STYLES: Record<JoinRequestStatus, string> = {
  PENDING: 'border border-amber-400/40 bg-amber-400/10 text-amber-200',
  ACCEPTED: 'border border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  REJECTED: 'border border-rose-400/40 bg-rose-400/10 text-rose-200',
};

type JoinRequestWithUser = {
  id: string;
  eventId: string;
  userId: string;
  status: JoinRequestStatus;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    photoUrl: string | null;
    createdAt: string;
  };
};

type JoinRequestsResponse = {
  joinRequests: JoinRequestWithUser[];
};

type EventResponse = {
  event: {
    id: string;
    title: string;
    description: string;
    datetime: string;
    locationName: string;
    maxParticipants: number;
    status: string;
  };
};

type ActionNotice = {
  intent: 'success' | 'error';
  message: string;
};

type RequestActionState = 'accepting' | 'rejecting';

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
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

const formatRelativeTimeFromNow = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const now = Date.now();
  const diffMs = date.getTime() - now;
  const absMs = Math.abs(diffMs);
  const table: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
    { unit: 'year', ms: 1000 * 60 * 60 * 24 * 365 },
    { unit: 'month', ms: 1000 * 60 * 60 * 24 * 30 },
    { unit: 'week', ms: 1000 * 60 * 60 * 24 * 7 },
    { unit: 'day', ms: 1000 * 60 * 60 * 24 },
    { unit: 'hour', ms: 1000 * 60 * 60 },
    { unit: 'minute', ms: 1000 * 60 },
  ];

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const entry of table) {
    if (absMs >= entry.ms) {
      const valueRounded = Math.round(diffMs / entry.ms);
      return formatter.format(valueRounded, entry.unit);
    }
  }
  return 'just now';
};

const readErrorPayload = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload && typeof payload.error === 'string' && payload.error.trim().length > 0) {
      return payload.error.trim();
    }
  } catch {
    // Ignore JSON parsing failures; we'll use the fallback below.
  }
  return fallback;
};

const normalizeParam = (value: string | string[] | undefined) => {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value[0];
  }
  return '';
};

export default function JoinRequestsManagementPage() {
  const params = useParams<{ id?: string | string[] }>();
  const eventId = normalizeParam(params?.id);
  const [eventTitle, setEventTitle] = useState<string>('');
  const [eventDate, setEventDate] = useState<string | null>(null);
  const [eventLocation, setEventLocation] = useState<string>('');
  const [maxParticipants, setMaxParticipants] = useState<number | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequestWithUser[]>([]);
  const [pageStatus, setPageStatus] = useState<'idle' | 'loading' | 'error'>('loading');
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<Record<string, RequestActionState>>({});
  const [actionNotices, setActionNotices] = useState<Record<string, ActionNotice | undefined>>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadData = useCallback(async () => {
    if (!eventId) {
      setPageStatus('error');
      setPageError('Missing event id.');
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setPageStatus('loading');
    setPageError(null);

    try {
      const eventResponse = await fetch(`/api/events/${eventId}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!eventResponse.ok) {
        const message = await readErrorPayload(eventResponse, 'Unable to load this event.');
        setPageStatus('error');
        setPageError(message);
        return;
      }
      const { event } = (await eventResponse.json()) as EventResponse;
      setEventTitle(event.title);
      setEventLocation(event.locationName);
      setEventDate(formatDateTime(event.datetime));
      setMaxParticipants(event.maxParticipants);

      const requestsResponse = await fetch(`/api/join-requests/for-event/${eventId}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!requestsResponse.ok) {
        const message = await readErrorPayload(
          requestsResponse,
          requestsResponse.status === 403
            ? 'You are not allowed to view requests for this event.'
            : 'Unable to load join requests.'
        );
        setPageStatus('error');
        setPageError(message);
        return;
      }
      const { joinRequests: records } = (await requestsResponse.json()) as JoinRequestsResponse;
      setJoinRequests(records ?? []);
      setActionNotices({});
      setPageStatus('idle');
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return;
      }
      console.error('Failed to load join requests page', error);
      setPageStatus('error');
      setPageError('Something went wrong while loading this page.');
    }
  }, [eventId]);

  useEffect(() => {
    void loadData();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [loadData]);

  const statistics = useMemo(() => {
    const pending = joinRequests.filter((request) => request.status === 'PENDING').length;
    const accepted = joinRequests.filter((request) => request.status === 'ACCEPTED').length;
    const rejected = joinRequests.filter((request) => request.status === 'REJECTED').length;
    return { pending, accepted, rejected };
  }, [joinRequests]);

  const pendingRequests = useMemo(
    () => joinRequests.filter((request) => request.status === 'PENDING'),
    [joinRequests]
  );
  const acceptedRequests = useMemo(
    () => joinRequests.filter((request) => request.status === 'ACCEPTED'),
    [joinRequests]
  );
  const rejectedRequests = useMemo(
    () => joinRequests.filter((request) => request.status === 'REJECTED'),
    [joinRequests]
  );

  const refresh = useCallback(() => {
    void loadData();
  }, [loadData]);

  const heroMeta = useMemo(
    () => [
      { label: 'Plan', value: eventTitle || 'Waiting for event…' },
      { label: 'When', value: eventDate ?? 'TBD' },
      { label: 'Where', value: eventLocation || 'TBD' },
      {
        label: 'Capacity',
        value: typeof maxParticipants === 'number' ? `${maxParticipants} guests` : '—',
      },
    ],
    [eventDate, eventLocation, eventTitle, maxParticipants]
  );

  const updateStatus = useCallback(
    async (joinRequestId: string, nextStatus: 'accepted' | 'rejected') => {
      setActionState((prev) => ({
        ...prev,
        [joinRequestId]: nextStatus === 'accepted' ? 'accepting' : 'rejecting',
      }));
      setActionNotices((prev) => ({ ...prev, [joinRequestId]: undefined }));
      try {
        const response = await fetch(`/api/join-requests/${joinRequestId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        });
        if (!response.ok) {
          const message = await readErrorPayload(
            response,
            nextStatus === 'accepted' ? 'Unable to accept this request.' : 'Unable to reject this request.'
          );
          throw new Error(message);
        }
        const payload = (await response.json()) as { joinRequest: Pick<JoinRequestWithUser, 'id' | 'status' | 'updatedAt'> };
        setJoinRequests((prev) =>
          prev.map((request) =>
            request.id === joinRequestId
              ? { ...request, status: payload.joinRequest.status as JoinRequestStatus, updatedAt: payload.joinRequest.updatedAt }
              : request
          )
        );
        const successMessage = nextStatus === 'accepted' ? 'Request accepted.' : 'Request rejected.';
        setActionNotices((prev) => ({
          ...prev,
          [joinRequestId]: {
            intent: 'success',
            message: successMessage,
          },
        }));
        showSuccessToast(successMessage);
      } catch (error) {
        console.error('Failed to update join request', error);
        const fallback = 'Unable to update this request right now.';
        const message = (error as Error).message ?? fallback;
        setActionNotices((prev) => ({
          ...prev,
          [joinRequestId]: {
            intent: 'error',
            message,
          },
        }));
        showErrorToast('Join request update failed', message);
      } finally {
        setActionState((prev) => {
          const next = { ...prev };
          delete next[joinRequestId];
          return next;
        });
      }
    },
    []
  );

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#0c1024] via-[#090f1d] to-[#05070f] px-4 py-10 text-foreground sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="rounded-[32px] border border-white/10 bg-white/5 px-6 py-8 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary/80">Host tools</p>
              <h1 className="mt-2 text-4xl font-semibold text-white">Join requests</h1>
              <p className="mt-3 text-sm text-white/70">
                {eventTitle
                  ? `Review and confirm guests for ${eventTitle}.`
                  : 'Review tonight’s guests and confirm who’s in.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={refresh}
                className="rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/60 hover:text-white disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/40"
                disabled={pageStatus === 'loading'}
              >
                {pageStatus === 'loading' ? 'Refreshing…' : 'Refresh list'}
              </button>
              <Link
                href="/events/create"
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/40 transition hover:bg-primary/90"
              >
                Create another event
              </Link>
            </div>
          </div>
          <div className="mt-6 grid gap-4 text-sm text-white/80 sm:grid-cols-2 lg:grid-cols-4">
            {heroMeta.map((entry) => (
              <div
                key={entry.label}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-inner shadow-black/20"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{entry.label}</p>
                <p className="mt-1 text-base font-semibold text-white">{entry.value}</p>
              </div>
            ))}
          </div>
        </header>

        {pageError ? (
          <div className="rounded-3xl border border-rose-400/40 bg-rose-500/10 px-5 py-4 text-sm text-rose-100 shadow-lg shadow-rose-900/20">
            {pageError}
          </div>
        ) : null}

        {pageStatus === 'loading' ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-6 text-sm text-white/70 shadow-lg shadow-black/20">Loading join requests…</div>
        ) : null}

        {pageStatus === 'idle' && !pageError ? (
          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Pending" value={statistics.pending} accent="text-amber-200" />
            <StatCard label="Accepted" value={statistics.accepted} accent="text-emerald-200" />
            <StatCard label="Rejected" value={statistics.rejected} accent="text-rose-200" />
          </section>
        ) : null}

        {pageStatus === 'idle' && !pageError ? (
          <div className="space-y-10">
            <RequestSection
              title="Pending"
              description="Review each request and choose who to bring in tonight."
              emptyMessage="No pending requests"
              requests={pendingRequests}
              actionState={actionState}
              actionNotices={actionNotices}
              onDecision={updateStatus}
            />
            <RequestSection
              title="Accepted"
              description="Guests you have already confirmed."
              emptyMessage="No accepted guests yet"
              requests={acceptedRequests}
              actionState={actionState}
              actionNotices={actionNotices}
              onDecision={undefined}
              readOnly
            />
            <RequestSection
              title="Rejected"
              description="Requests you decided to pass on."
              emptyMessage="No rejected requests"
              requests={rejectedRequests}
              actionState={actionState}
              actionNotices={actionNotices}
              onDecision={undefined}
              readOnly
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

type RequestSectionProps = {
  title: string;
  description: string;
  emptyMessage: string;
  requests: JoinRequestWithUser[];
  actionState: Record<string, RequestActionState | undefined>;
  actionNotices: Record<string, ActionNotice | undefined>;
  onDecision?: (id: string, status: 'accepted' | 'rejected') => void;
  readOnly?: boolean;
};

const RequestSection = ({
  title,
  description,
  emptyMessage,
  requests,
  actionState,
  actionNotices,
  onDecision,
  readOnly = false,
}: RequestSectionProps) => {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-white/70">{description}</p>
      </div>
      {requests.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-white/15 bg-white/5 px-4 py-6 text-center text-sm text-white/60">
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              actionState={actionState[request.id]}
              notice={actionNotices[request.id]}
              onDecision={onDecision}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </section>
  );
};

type RequestCardProps = {
  request: JoinRequestWithUser;
  actionState?: RequestActionState;
  notice?: ActionNotice;
  onDecision?: (id: string, status: 'accepted' | 'rejected') => void;
  readOnly?: boolean;
};

const RequestCard = ({ request, actionState, notice, onDecision, readOnly = false }: RequestCardProps) => {
  const relativeTime = formatRelativeTimeFromNow(request.createdAt);
  const joined = formatDateTime(request.user.createdAt);
  const isAccepting = actionState === 'accepting';
  const isRejecting = actionState === 'rejecting';
  const waiting = isAccepting || isRejecting;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white shadow-xl shadow-black/20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <UserAvatar
            displayName={request.user.displayName ?? undefined}
            email={request.user.email}
            photoUrl={request.user.photoUrl ?? undefined}
            size="md"
          />
          <div className="space-y-1">
            <p className="text-base font-semibold text-white">
              {request.user.displayName ?? request.user.email}
            </p>
            <p className="text-sm text-white/70">
              {relativeTime ? `Requested ${relativeTime}` : 'Request time unavailable'}
            </p>
            {joined ? <p className="text-xs text-white/50">On Tonight since {joined}</p> : null}
          </div>
        </div>
        <span className={`inline-flex h-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE_STYLES[request.status]}`}>
          {STATUS_LABELS[request.status]}
        </span>
      </div>

      {!readOnly && (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onDecision?.(request.id, 'rejected')}
            disabled={waiting}
            className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white/80 transition hover:border-rose-200/60 hover:text-rose-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/40"
          >
            {waiting && isRejecting ? 'Passing…' : 'Pass'}
          </button>
          <button
            type="button"
            onClick={() => onDecision?.(request.id, 'accepted')}
            disabled={waiting}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
          >
            {waiting && isAccepting ? 'Inviting…' : 'Invite'}
          </button>
        </div>
      )}

      {notice ? (
        <p
          className={`mt-3 text-sm ${notice.intent === 'error' ? 'text-rose-200' : 'text-emerald-200'}`}
        >
          {notice.message}
        </p>
      ) : null}
    </div>
  );
};

type StatCardProps = {
  label: string;
  value: number;
  accent: string;
};

const StatCard = ({ label, value, accent }: StatCardProps) => {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/20">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/60">{label}</p>
      <p className={`mt-3 text-4xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
};
