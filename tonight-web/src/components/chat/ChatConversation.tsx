"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarPlus, Copy, Flag, Info, MapPin, Send, Share2, X } from 'lucide-react';

import BlockUserButton from '@/components/BlockUserButton';
import MessageList, { type ChatMessage, type MessageListStatus } from '@/components/chat/MessageList';
import UserAvatar from '@/components/UserAvatar';
import { useSocket } from '@/hooks/useSocket';
import type { SerializedMessage } from '@/lib/chat';
import type { SocketReadReceiptEventPayload } from '@/lib/socket-shared';
import { showErrorToast, showSuccessToast } from '@/lib/toast';

export type ChatParticipantSummary = {
  id: string;
  displayName: string | null;
  email: string;
  photoUrl: string | null;
};

export type ChatConversationContext = {
  requesterRole: 'host' | 'participant';
  host: ChatParticipantSummary;
  participant: ChatParticipantSummary;
  event: {
    id: string;
    title: string;
    locationName: string;
    datetime: string;
  };
};

const STATUS_LABELS: Record<string, string> = {
  connected: 'Live updates active',
  connecting: 'Connecting…',
  idle: 'Offline',
  error: 'Realtime unavailable',
  reconnecting: 'Reconnecting…',
};

type ConversationMessage = ChatMessage;
type QueuedMessageRecord = {
  clientReferenceId: string;
  content: string;
};

type MessagesStatus = MessageListStatus;

type ChatConversationProps = {
  joinRequestId: string;
  currentUserId: string;
  socketToken: string;
  context: ChatConversationContext;
};

const readErrorPayload = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload?.error) {
      return payload.error;
    }
  } catch {
    // Ignore parsing failures; use fallback below.
  }
  return fallback;
};

const sortMessages = (items: ConversationMessage[]) =>
  [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

const formatDateTime = (value: string) => {
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

const formatRetryCountdown = (value: number | null) => {
  if (value == null) {
    return null;
  }
  const seconds = Math.ceil(value / 1000);
  if (seconds <= 0) {
    return 'soon';
  }
  return `${seconds}s`;
};

const createClientMessageId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const classNames = (...classes: Array<string | boolean | null | undefined>) =>
  classes.filter(Boolean).join(' ');

export default function ChatConversation({
  joinRequestId,
  currentUserId,
  socketToken,
  context,
}: ChatConversationProps) {
  const router = useRouter();
  const eventSheetTitleId = useId();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [messagesStatus, setMessagesStatus] = useState<MessagesStatus>('loading');
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [composerValue, setComposerValue] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending'>('idle');
  const [socketNotice, setSocketNotice] = useState<string | null>(null);
  const [hasBlockedCounterpart, setHasBlockedCounterpart] = useState(false);
  const [queuedMessageCount, setQueuedMessageCount] = useState(0);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [isCurrentlyTyping, setIsCurrentlyTyping] = useState(false);
  const [isEventSheetOpen, setIsEventSheetOpen] = useState(false);
  const [isCopyingLocation, setIsCopyingLocation] = useState(false);
  const [isCalendarExporting, setIsCalendarExporting] = useState(false);
  const [eventShareUrl, setEventShareUrl] = useState<string | null>(`https://tonight.app/events/${context.event.id}`);
  const [eventShareCopyState, setEventShareCopyState] = useState<'idle' | 'copying' | 'copied'>('idle');
  const [eventShareShareState, setEventShareShareState] = useState<'idle' | 'sharing'>('idle');
  const [eventShareSupported, setEventShareSupported] = useState(false);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const queuedMessagesRef = useRef<QueuedMessageRecord[]>([]);
  const queuedFlushInFlightRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const isHostViewer = context.requesterRole === 'host';
  const counterpart = useMemo(() => {
    return isHostViewer ? context.participant : context.host;
  }, [context, isHostViewer]);
  const counterpartId = counterpart.id;

  const eventTimeLabel = useMemo(() => formatDateTime(context.event.datetime), [context.event.datetime]);
  const eventInviteShareText = useMemo(
    () => buildChatEventInviteShareText(context.event.title, eventTimeLabel, context.event.locationName),
    [context.event.locationName, context.event.title, eventTimeLabel]
  );
  const eventStartDate = useMemo(() => {
    const date = new Date(context.event.datetime);
    return Number.isNaN(date.getTime()) ? null : date;
  }, [context.event.datetime]);
  const mapsUrl = useMemo(() => {
    if (!context.event.locationName) {
      return null;
    }
    const query = encodeURIComponent(context.event.locationName);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }, [context.event.locationName]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const origin = window.location?.origin?.trim().length ? window.location.origin : 'https://tonight.app';
    setEventShareUrl(`${origin}/events/${context.event.id}`);
  }, [context.event.id]);

  useEffect(() => {
    setEventShareSupported(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  const appendMessage = useCallback((message: SerializedMessage) => {
    setMessages((previous) => {
      if (previous.some((existing) => existing.id === message.id)) {
        return previous;
      }
      return sortMessages([...previous, message]);
    });
  }, []);

  const fetchMessages = useCallback(async () => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setMessagesStatus('loading');
    setMessagesError(null);

    try {
      const response = await fetch(`/api/chat/${joinRequestId}/messages`, {
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!response.ok) {
        const message = await readErrorPayload(response, 'Unable to load this conversation.');
        throw new Error(message);
      }

      const payload = (await response.json()) as { messages?: SerializedMessage[] };
      setMessages((previous) => {
        const optimistic = previous.filter((message) => message.deliveryStatus);
        const next = sortMessages([...(payload.messages ?? []), ...optimistic]);
        return next;
      });
      setMessagesStatus('ready');
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return;
      }
      console.error('Failed to load chat messages', error);
      setMessagesStatus('error');
      setMessagesError((error as Error).message ?? 'Unable to load this conversation.');
    }
  }, [joinRequestId]);

  const handleReadReceipt = useCallback(
    (payload: SocketReadReceiptEventPayload) => {
      if (payload.joinRequestId !== joinRequestId) {
        return;
      }
      if (payload.readerId === currentUserId) {
        return;
      }
      setMessages((previous) => {
        let changed = false;
        const receiptMap = new Map(payload.receipts.map((entry) => [entry.messageId, entry.readAt]));
        const next = previous.map((message) => {
          if (!receiptMap.has(message.id)) {
            return message;
          }
          const alreadyAcknowledged = (message.readBy ?? []).some((entry) => entry.userId === payload.readerId);
          if (alreadyAcknowledged) {
            return message;
          }
          changed = true;
          return {
            ...message,
            readBy: [...(message.readBy ?? []), { userId: payload.readerId, readAt: receiptMap.get(message.id)! }],
          };
        });
        return changed ? next : previous;
      });
    },
    [currentUserId, joinRequestId]
  );

  useEffect(() => {
    fetchMessages().catch((error) => {
      console.error('Unexpected chat fetch failure', error);
    });
    return () => {
      fetchAbortRef.current?.abort();
    };
  }, [fetchMessages]);

  const {
    connectionState,
    isConnected,
    joinRoom,
    sendTypingStart,
    sendTypingStop,
    nextRetryInMs,
    reconnectAttempt,
  } = useSocket({
    token: socketToken,
    readinessEndpoint: '/api/socket/io',
    onMessage: (payload) => {
      if (payload.joinRequestId === joinRequestId) {
        appendMessage(payload);
      }
    },
    onError: (error) => {
      console.error('Socket connection error', error);
      setSocketNotice('Real-time updates are unavailable. Sending messages will still work.');
    },
    onDisconnect: (reason) => {
      if (reason !== 'io client disconnect') {
        setSocketNotice((previous) => previous ?? 'We lost the live connection. Messages will auto-resume soon.');
      }
    },
    onTyping: (payload) => {
      if (payload.joinRequestId === joinRequestId && payload.userId !== currentUserId) {
        setIsOtherUserTyping(true);
      }
    },
    onTypingStop: (payload) => {
      if (payload.joinRequestId === joinRequestId && payload.userId !== currentUserId) {
        setIsOtherUserTyping(false);
      }
    },
    onReadReceipt: handleReadReceipt,
  });

  useEffect(() => {
    if (!isConnected) {
      return;
    }
    joinRoom(joinRequestId);
  }, [isConnected, joinRequestId, joinRoom]);

  // Mark messages as read when chat opens and when connected
  useEffect(() => {
    const markAsRead = async () => {
      try {
        await fetch(`/api/chat/${joinRequestId}/mark-read`, {
          method: 'POST',
        });
      } catch (error) {
        console.error('Failed to mark messages as read:', error);
      }
    };

    if (isConnected) {
      markAsRead();
    }
  }, [joinRequestId, isConnected]);

  // Clean up typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isCurrentlyTyping) {
        sendTypingStop(joinRequestId);
      }
    };
  }, [isCurrentlyTyping, joinRequestId, sendTypingStop]);

  // Handle input change with typing indicators
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setComposerValue(newValue);

    // Start typing indicator
    if (!isCurrentlyTyping && newValue.length > 0) {
      setIsCurrentlyTyping(true);
      sendTypingStart(joinRequestId);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing indicator after 3 seconds of no input
    if (newValue.length > 0) {
      typingTimeoutRef.current = setTimeout(() => {
        setIsCurrentlyTyping(false);
        sendTypingStop(joinRequestId);
      }, 3000);
    } else {
      // Empty input - stop typing immediately
      setIsCurrentlyTyping(false);
      sendTypingStop(joinRequestId);
    }
  }, [isCurrentlyTyping, joinRequestId, sendTypingStart, sendTypingStop]);

  useLayoutEffect(() => {
    if (!composerRef.current) {
      return;
    }
    const textarea = composerRef.current;
    textarea.style.height = '0px';
    const nextHeight = Math.min(textarea.scrollHeight, 220);
    textarea.style.height = `${nextHeight}px`;
  }, [composerValue]);

  const queueMessageForSend = useCallback(
    (content: string) => {
      const clientReferenceId = `queued-${createClientMessageId()}`;
      const optimisticMessage: ConversationMessage = {
        id: clientReferenceId,
        clientReferenceId,
        joinRequestId,
        senderId: currentUserId,
        content,
        createdAt: new Date().toISOString(),
        deliveryStatus: 'queued',
        readBy: [],
      };

      queuedMessagesRef.current.push({ clientReferenceId, content });
      setQueuedMessageCount(queuedMessagesRef.current.length);
      setMessages((previous) => sortMessages([...previous, optimisticMessage]));
    },
    [currentUserId, joinRequestId]
  );

  const flushQueuedMessages = useCallback(async () => {
    if (queuedFlushInFlightRef.current || hasBlockedCounterpart) {
      return;
    }

    queuedFlushInFlightRef.current = true;
    try {
      while (queuedMessagesRef.current.length) {
        const next = queuedMessagesRef.current[0];
        setMessages((previous) =>
          previous.map((message) =>
            message.id === next.clientReferenceId
              ? { ...message, deliveryStatus: 'sending' as const }
              : message
          )
        );

        try {
          const response = await fetch(`/api/chat/${joinRequestId}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content: next.content }),
          });

          if (!response.ok) {
            const message = await readErrorPayload(response, 'Unable to send this message.');
            throw new Error(message);
          }

          const payload = (await response.json()) as { message: SerializedMessage };
          setMessages((previous) => {
            const remaining = previous.filter((message) => message.id !== next.clientReferenceId);
            return sortMessages([...remaining, payload.message]);
          });
          setSendError(null);
        } catch (error) {
          console.error('Failed to flush queued chat message', error);
          const failureMessage = (error as Error).message ?? 'Unable to send this message.';
          setMessages((previous) =>
            previous.map((message) =>
              message.id === next.clientReferenceId
                ? { ...message, deliveryStatus: 'failed' as const }
                : message
            )
          );
          showErrorToast('Message not sent', failureMessage);
          setSendError(failureMessage);
          queuedMessagesRef.current.shift();
          setQueuedMessageCount(queuedMessagesRef.current.length);
          break;
        }

        queuedMessagesRef.current.shift();
        setQueuedMessageCount(queuedMessagesRef.current.length);
      }
    } finally {
      queuedFlushInFlightRef.current = false;
    }
  }, [hasBlockedCounterpart, joinRequestId]);

  useEffect(() => {
    if (!isConnected || !queuedMessagesRef.current.length) {
      return;
    }
    flushQueuedMessages().catch((error) => {
      console.error('Unexpected queued flush failure', error);
    });
  }, [flushQueuedMessages, isConnected]);

  useEffect(() => {
    if (!hasBlockedCounterpart || !queuedMessagesRef.current.length) {
      return;
    }
    queuedMessagesRef.current = [];
    setQueuedMessageCount(0);
    setMessages((previous) => previous.filter((message) => !message.deliveryStatus));
  }, [hasBlockedCounterpart]);

  const handleSend = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (sendStatus === 'sending' || hasBlockedCounterpart) {
        if (hasBlockedCounterpart) {
          setSendError('You blocked this user. Unblock them from your profile to keep chatting.');
        }
        return;
      }

      const trimmed = composerValue.trim();
      if (!trimmed) {
        setComposerValue('');
        return;
      }

      // Stop typing indicator when sending
      if (isCurrentlyTyping) {
        setIsCurrentlyTyping(false);
        sendTypingStop(joinRequestId);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      }

      setSendError(null);

      if (!isConnected && connectionState !== 'error') {
        queueMessageForSend(trimmed);
        setComposerValue('');
        return;
      }

      setSendStatus('sending');

      try {
        const response = await fetch(`/api/chat/${joinRequestId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: trimmed }),
        });

        if (!response.ok) {
          const message = await readErrorPayload(response, 'Unable to send this message.');
          throw new Error(message);
        }

        const payload = (await response.json()) as { message: SerializedMessage };
        appendMessage(payload.message);
        setComposerValue('');
      } catch (error) {
        console.error('Failed to send chat message', error);
        const message = (error as Error).message ?? 'Unable to send this message.';
        setSendError(message);
        showErrorToast('Message not sent', message);
      } finally {
        setSendStatus('idle');
      }
    },
    [appendMessage, composerValue, connectionState, hasBlockedCounterpart, isConnected, isCurrentlyTyping, joinRequestId, queueMessageForSend, sendStatus, sendTypingStop]
  );

  const connectionLabel = (() => {
    if (connectionState === 'reconnecting') {
      const countdown = formatRetryCountdown(nextRetryInMs);
      if (countdown) {
        return `Reconnecting in ${countdown}`;
      }
    }
    return STATUS_LABELS[connectionState] ?? 'Connecting…';
  })();

  const connectionHelperText = (() => {
    switch (connectionState) {
      case 'connected':
        return 'Live updates are active.';
      case 'connecting':
        return 'Establishing secure real-time updates…';
      case 'reconnecting': {
        const countdown = formatRetryCountdown(nextRetryInMs);
        if (countdown) {
          return `Retry ${Math.max(reconnectAttempt, 1)} in ${countdown}.`;
        }
        return 'Attempting to reconnect…';
      }
      case 'idle':
        return 'Offline. Messages will queue until we reconnect.';
      case 'error':
        return 'Realtime is unavailable. Sending still works over the API.';
      default:
        return '';
    }
  })();

  const connectionAccent = connectionState === 'connected'
    ? 'text-emerald-200 border-emerald-300/40 bg-emerald-400/10'
    : connectionState === 'error'
      ? 'text-rose-200 border-rose-400/40 bg-rose-500/10'
      : 'text-amber-200 border-amber-400/30 bg-amber-500/10';
  const connectionDot = connectionState === 'connected'
    ? 'bg-emerald-300'
    : connectionState === 'error'
      ? 'bg-rose-300'
      : 'bg-amber-300 animate-pulse';

  const queuedHelperText = queuedMessageCount > 0
    ? `${queuedMessageCount === 1 ? '1 message' : `${queuedMessageCount} messages`} will send automatically once the connection returns.`
    : null;

  const derivedNotice = socketNotice
    ?? (connectionState === 'reconnecting'
      ? 'We lost the live connection. Messages will send once we reconnect.'
      : connectionState === 'idle'
        ? 'You are offline. We will keep retrying in the background.'
        : connectionState === 'error'
          ? 'Realtime is unavailable, but you can keep chatting.'
          : null);

  const hasLocationDetails = Boolean(context.event.locationName && context.event.locationName.trim().length > 0);
  const quickActionButtonClass = (disabled?: boolean) =>
    classNames(
      'inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border/60 px-4 py-3 text-sm font-semibold transition',
      disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-background/80'
    );
  const inlineChipClass = (disabled?: boolean) =>
    classNames(
      'inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs font-semibold transition',
      disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-background/80'
    );

  const handleCopyAddress = useCallback(async () => {
    if (!hasLocationDetails || !context.event.locationName) {
      showErrorToast('Location coming soon', 'The host will drop the full address shortly.');
      return;
    }
    try {
      setIsCopyingLocation(true);
      const value = context.event.locationName.trim();
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      } else {
        throw new Error('Clipboard unavailable');
      }
      showSuccessToast('Address copied', value);
    } catch (error) {
      console.error('Failed to copy address', error);
      showErrorToast('Unable to copy the address', 'Please copy it manually for now.');
    } finally {
      setIsCopyingLocation(false);
    }
  }, [context.event.locationName, hasLocationDetails]);

  const handleCopyInviteLink = useCallback(async () => {
    if (!eventShareUrl) {
      showErrorToast('Invite link not ready', 'The invite link is still loading. Try again in a moment.');
      return;
    }
    try {
      setEventShareCopyState('copying');
      await copyTextToClipboard(eventShareUrl);
      setEventShareCopyState('copied');
      showSuccessToast('Invite link copied', 'Drop it anywhere to fast-pass your friends.');
    } catch (error) {
      setEventShareCopyState('idle');
      const message = (error as Error)?.message ?? 'Copy the link manually for now.';
      showErrorToast('Copy failed', message);
    }
  }, [eventShareUrl]);

  const handleShareInviteLink = useCallback(async () => {
    if (!eventShareUrl) {
      showErrorToast('Share unavailable', 'The invite link is still loading. Try again shortly.');
      return;
    }

    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      await handleCopyInviteLink();
      return;
    }

    try {
      setEventShareShareState('sharing');
      await navigator.share({
        title: context.event.title,
        text: eventInviteShareText,
        url: eventShareUrl,
      });
      showSuccessToast('Share sheet ready', 'Pick any app to send this plan.');
    } catch (error) {
      const dismissed =
        error instanceof DOMException
          ? error.name === 'AbortError'
          : typeof error === 'object' && error !== null && 'name' in error && (error as { name?: string }).name === 'AbortError';
      if (!dismissed) {
        const message = (error as Error)?.message ?? 'Copy the link instead.';
        showErrorToast('Share failed', message);
      }
    } finally {
      setEventShareShareState('idle');
    }
  }, [context.event.title, eventInviteShareText, eventShareUrl, handleCopyInviteLink]);

  const handleOpenMaps = useCallback(() => {
    if (!mapsUrl) {
      showErrorToast('Location coming soon', 'Maps will unlock once the host shares the venue.');
      return;
    }
    if (typeof window === 'undefined') {
      showErrorToast('Maps unavailable in this view', 'Open this chat in a browser to launch maps.');
      return;
    }
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  }, [mapsUrl]);

  const handleAddToCalendar = useCallback(() => {
    if (!eventStartDate) {
      showErrorToast('Schedule not ready', 'Add to calendar will unlock once the host locks the time.');
      return;
    }
    if (typeof document === 'undefined') {
      showErrorToast('Export unavailable', 'Open this chat in a browser to save the invite.');
      return;
    }
    const formatForICS = (value: Date) => value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const escapeForICS = (value: string) =>
      value
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
    try {
      setIsCalendarExporting(true);
      const defaultDurationMs = 2 * 60 * 60 * 1000;
      const endsAt = new Date(eventStartDate.getTime() + defaultDurationMs);
      const title = (context.event.title || 'Tonight plan').trim();
      const locationLabel = context.event.locationName?.trim() ?? '';
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tonight.app';
      const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Tonight//Chat//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${joinRequestId}@tonight.app`,
        `DTSTAMP:${formatForICS(new Date())}`,
        `DTSTART:${formatForICS(eventStartDate)}`,
        `DTEND:${formatForICS(endsAt)}`,
        `SUMMARY:${escapeForICS(title)}`,
      ];
      if (locationLabel) {
        lines.push(`LOCATION:${escapeForICS(locationLabel)}`);
      }
      lines.push(
        `DESCRIPTION:${escapeForICS(`Chat thread: ${origin}/chat/${joinRequestId}`)}`,
        `URL:${origin}/events/${context.event.id}`,
        'END:VEVENT',
        'END:VCALENDAR'
      );
      const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const trigger = document.createElement('a');
      trigger.href = url;
      const fileTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tonight-plan';
      trigger.download = `${fileTitle}.ics`;
      document.body.appendChild(trigger);
      trigger.click();
      document.body.removeChild(trigger);
      setTimeout(() => URL.revokeObjectURL(url), 0);
      showSuccessToast('Calendar invite ready', 'Import it to block off your night.');
    } catch (error) {
      console.error('Failed to generate calendar invite', error);
      showErrorToast('Unable to create calendar invite', 'Please try again in a moment.');
    } finally {
      setIsCalendarExporting(false);
    }
  }, [context.event.id, context.event.locationName, context.event.title, eventStartDate, joinRequestId]);

  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(circle_at_top,_rgba(8,10,20,1),_rgba(3,4,9,1))] text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full border border-border/60 bg-background/50 p-2 text-muted-foreground transition hover:bg-background/80 hover:text-foreground"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <UserAvatar displayName={counterpart.displayName ?? undefined} email={counterpart.email} photoUrl={counterpart.photoUrl ?? undefined} size="sm" />
          <div className="flex flex-1 flex-col overflow-hidden">
            <p className="truncate text-base font-semibold">
              {counterpart.displayName ?? counterpart.email}
            </p>
            <p className="text-xs text-muted-foreground">{context.event.title}</p>
          </div>
          <button
            type="button"
            onClick={() => setIsEventSheetOpen(true)}
            className="rounded-xl border border-border/60 bg-card/60 p-2 text-muted-foreground transition hover:text-foreground"
            aria-label="Event info"
          >
            <Info className="h-4 w-4" />
          </button>
          <Link
            href={`/events/${context.event.id}`}
            prefetch
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/20 sm:inline-flex"
          >
            View plan
          </Link>
        </div>
        <div className="mx-auto w-full max-w-4xl px-4 pb-3">
          <div
            className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            data-testid="chat-inline-actions"
          >
            <button
              type="button"
              onClick={handleCopyAddress}
              disabled={!hasLocationDetails || isCopyingLocation}
              className={inlineChipClass(!hasLocationDetails || isCopyingLocation)}
              title={!hasLocationDetails ? 'Location details coming soon' : undefined}
            >
              <Copy className="h-3.5 w-3.5" />
              {isCopyingLocation ? 'Copying…' : 'Copy address'}
            </button>
            <button
              type="button"
              onClick={handleOpenMaps}
              disabled={!mapsUrl}
              className={inlineChipClass(!mapsUrl)}
              title={!mapsUrl ? 'Maps unlock once the host confirms the venue.' : undefined}
            >
              <MapPin className="h-3.5 w-3.5" />
              Open in Maps
            </button>
            <button
              type="button"
              onClick={handleAddToCalendar}
              disabled={!eventStartDate || isCalendarExporting}
              className={inlineChipClass(!eventStartDate || isCalendarExporting)}
              title={!eventStartDate ? 'Add to calendar will be available once timing is set.' : undefined}
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              {isCalendarExporting ? 'Building invite…' : 'Add to calendar'}
            </button>
            {isHostViewer ? (
              <>
                <span className="mx-1 hidden h-4 w-px self-center bg-border/40 sm:block" aria-hidden="true" />
                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  disabled={!eventShareUrl || eventShareCopyState === 'copying'}
                  className={inlineChipClass(!eventShareUrl || eventShareCopyState === 'copying')}
                >
                  <Copy className="h-3.5 w-3.5" />
                  {eventShareCopyState === 'copying'
                    ? 'Copying…'
                    : eventShareCopyState === 'copied'
                      ? 'Link copied'
                      : 'Copy invite link'}
                </button>
                {eventShareSupported ? (
                  <button
                    type="button"
                    onClick={handleShareInviteLink}
                    disabled={!eventShareUrl || eventShareShareState === 'sharing'}
                    className={inlineChipClass(!eventShareUrl || eventShareShareState === 'sharing')}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    {eventShareShareState === 'sharing' ? 'Sharing…' : 'Share invite'}
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto w-full max-w-3xl px-4 pt-5">
          <div className="flex flex-col gap-4">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-100/80 px-4 py-1 text-xs font-semibold text-emerald-900 shadow-inner shadow-emerald-900/30">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Join request accepted
            </div>
            <div className="rounded-3xl border border-border/60 bg-card/70 px-5 py-4 shadow-[0_25px_80px_rgba(0,0,0,0.35)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Tonight&apos;s plan</p>
                  <p className="text-base font-semibold text-foreground">{context.event.title}</p>
                  <p className="text-xs text-muted-foreground">{[context.event.locationName, eventTimeLabel].filter(Boolean).join(' • ')}</p>
                </div>
                <span className={classNames('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold backdrop-blur', connectionAccent)}>
                  <span className={classNames('h-1.5 w-1.5 rounded-full', connectionDot)} />
                  {connectionLabel}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">{connectionHelperText}</p>
              {derivedNotice ? <p className="mt-2 text-xs text-amber-400">{derivedNotice}</p> : null}
            </div>
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-48 pt-4">
          <MessageList
            status={messagesStatus}
            error={messagesError}
            messages={messages}
            currentUserId={currentUserId}
            counterpartId={counterpartId}
            onRetry={() => fetchMessages().catch(() => {})}
            className="!px-0"
          />
          {isOtherUserTyping && (
            <div className="mt-4 rounded-2xl border border-border/60 bg-card/70 px-4 py-2 text-xs italic text-muted-foreground" aria-live="polite">
              {counterpart.displayName || counterpart.email.split('@')[0]} is typing...
            </div>
          )}
        </section>
      </main>

      <footer className="sticky bottom-0 z-40 border-t border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <span className={classNames('inline-flex items-center gap-2 rounded-full border px-3 py-1 font-semibold', connectionAccent)}>
              <span className={classNames('h-1.5 w-1.5 rounded-full', connectionDot)} />
              {connectionLabel}
            </span>
            <div className="flex items-center gap-4">
              <BlockUserButton
                targetUserId={counterpart.id}
                targetDisplayName={counterpart.displayName ?? counterpart.email}
                className="items-center text-[11px]"
                label="Block"
                confirmTitle={counterpart.displayName ? `Block ${counterpart.displayName}?` : 'Block this user?'}
                confirmMessage="They won’t be able to message you, join your events, or see your plans."
                disabled={hasBlockedCounterpart}
                onBlocked={() => {
                  setHasBlockedCounterpart(true);
                  setComposerValue('');
                  setSendError('You blocked this user. Messages are now disabled.');
                }}
              />
              <span className="hidden h-3 w-px bg-border/70 sm:block" />
              <button
                type="button"
                title="Reporting will be available soon"
                className="flex items-center gap-1 text-[11px] text-muted-foreground"
                disabled
              >
                <Flag className="h-3 w-3" />
                Report
              </button>
            </div>
          </div>

          <form onSubmit={handleSend} className="flex flex-col gap-3 rounded-3xl border border-border/80 bg-card/80 p-4 shadow-[0_25px_120px_rgba(0,0,0,0.45)]">
            <div className="flex items-end gap-3">
              <label htmlFor="chat-message" className="sr-only">
                Message
              </label>
              <textarea
                id="chat-message"
                ref={composerRef}
                value={composerValue}
                onChange={handleInputChange}
                placeholder="Type a message"
                rows={1}
                disabled={hasBlockedCounterpart}
                className="max-h-48 min-h-[52px] w-full flex-1 resize-none rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                disabled={sendStatus === 'sending' || composerValue.trim().length === 0 || hasBlockedCounterpart}
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-border"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              {hasBlockedCounterpart ? (
                <p>You blocked this user. Manage safety settings from your profile if you change your mind.</p>
              ) : null}
              {queuedHelperText ? <p className="text-amber-400">{queuedHelperText}</p> : null}
              {sendError ? <p className="text-destructive">{sendError}</p> : null}
            </div>
          </form>
        </div>
      </footer>

      {isEventSheetOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={eventSheetTitleId}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 py-6 sm:items-center"
        >
          <button
            type="button"
            className="absolute inset-0 h-full w-full"
            aria-label="Close event info"
            onClick={() => setIsEventSheetOpen(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-3xl border border-border/70 bg-card/95 p-6 shadow-[0_35px_120px_rgba(0,0,0,0.55)] backdrop-blur">
            <button
              type="button"
              onClick={() => setIsEventSheetOpen(false)}
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Tonight's plan</p>
                <h2 id={eventSheetTitleId} className="mt-2 text-2xl font-semibold text-foreground">
                  {context.event.title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {[context.event.locationName, eventTimeLabel].filter(Boolean).join(' • ') || 'Details coming soon'}
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/40 p-3">
                <UserAvatar
                  size="sm"
                  displayName={context.host.displayName ?? undefined}
                  email={context.host.email}
                  photoUrl={context.host.photoUrl ?? undefined}
                />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Hosted by</p>
                  <p className="text-sm font-semibold">{context.host.displayName ?? context.host.email}</p>
                </div>
              </div>

              <div className="space-y-2 rounded-2xl border border-border/60 bg-background/40 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Where</span>
                  <span className="font-medium text-foreground">{context.event.locationName ?? 'TBA'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">When</span>
                  <span className="font-medium text-foreground">{eventTimeLabel ?? 'TBA'}</span>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border/60 bg-background/40 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Quick actions</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={handleCopyAddress}
                    disabled={!hasLocationDetails || isCopyingLocation}
                    className={quickActionButtonClass(!hasLocationDetails || isCopyingLocation)}
                    title={!hasLocationDetails ? 'Location details coming soon' : undefined}
                  >
                    <Copy className="h-4 w-4" />
                    {isCopyingLocation ? 'Copying…' : 'Copy address'}
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenMaps}
                    disabled={!mapsUrl}
                    className={quickActionButtonClass(!mapsUrl)}
                    title={!mapsUrl ? 'Maps unlock once the host confirms the venue.' : undefined}
                  >
                    <MapPin className="h-4 w-4" />
                    Open in Maps
                  </button>
                  <button
                    type="button"
                    onClick={handleAddToCalendar}
                    disabled={!eventStartDate || isCalendarExporting}
                    className={quickActionButtonClass(!eventStartDate || isCalendarExporting)}
                    title={!eventStartDate ? 'Add to calendar will be available once timing is set.' : undefined}
                  >
                    <CalendarPlus className="h-4 w-4" />
                    {isCalendarExporting ? 'Building invite…' : 'Add to calendar'}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href={`/events/${context.event.id}`}
                  prefetch
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  Open full event
                </Link>
                <button
                  type="button"
                  onClick={() => setIsEventSheetOpen(false)}
                  className="inline-flex flex-1 items-center justify-center rounded-2xl border border-border/60 px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-background/80"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildChatEventInviteShareText(title: string, eventMomentLabel: string | null, locationName?: string | null) {
  const parts: string[] = [`Join me at "${title}"`];
  if (eventMomentLabel) {
    parts.push(`on ${eventMomentLabel}`);
  }
  const locationLabel = locationName?.trim();
  if (locationLabel) {
    parts.push(`near ${locationLabel}`);
  }
  parts.push('Request access on Tonight.');
  return parts.join(' ');
}

async function copyTextToClipboard(value: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard unavailable');
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.top = '-1000px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const successful = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!successful) {
    throw new Error('Unable to copy to clipboard.');
  }
}
