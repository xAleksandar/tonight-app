"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Flag, Info, Send } from 'lucide-react';

import BlockUserButton from '@/components/BlockUserButton';
import MessageList, { type ChatMessage, type MessageListStatus } from '@/components/chat/MessageList';
import UserAvatar from '@/components/UserAvatar';
import { useSocket } from '@/hooks/useSocket';
import type { SerializedMessage } from '@/lib/chat';
import { showErrorToast } from '@/lib/toast';

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

export default function ChatConversation({
  joinRequestId,
  currentUserId,
  socketToken,
  context,
}: ChatConversationProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [messagesStatus, setMessagesStatus] = useState<MessagesStatus>('loading');
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [composerValue, setComposerValue] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending'>('idle');
  const [socketNotice, setSocketNotice] = useState<string | null>(null);
  const [hasBlockedCounterpart, setHasBlockedCounterpart] = useState(false);
  const [queuedMessageCount, setQueuedMessageCount] = useState(0);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const queuedMessagesRef = useRef<QueuedMessageRecord[]>([]);
  const queuedFlushInFlightRef = useRef(false);

  const counterpart = useMemo(() => {
    return context.requesterRole === 'host' ? context.participant : context.host;
  }, [context]);

  const eventTimeLabel = useMemo(() => formatDateTime(context.event.datetime), [context.event.datetime]);

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
  });

  useEffect(() => {
    if (!isConnected) {
      return;
    }
    joinRoom(joinRequestId);
  }, [isConnected, joinRequestId, joinRoom]);

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
    [appendMessage, composerValue, connectionState, hasBlockedCounterpart, isConnected, joinRequestId, queueMessageForSend, sendStatus]
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

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-[#0a0f21] via-[#090f1d] to-[#050812] text-white">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0f1426]/80 backdrop-blur supports-[backdrop-filter]:bg-[#0f1426]/60">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full border border-white/15 p-2 text-white/70 transition hover:border-white/40 hover:text-white"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <UserAvatar displayName={counterpart.displayName ?? undefined} email={counterpart.email} photoUrl={counterpart.photoUrl ?? undefined} size="sm" />
          <div className="flex flex-1 flex-col overflow-hidden">
            <p className="truncate text-base font-semibold text-white">
              {counterpart.displayName ?? counterpart.email}
            </p>
            <p className="text-sm text-white/60">{context.event.title}</p>
          </div>
          <button
            type="button"
            title="Event details coming soon"
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 transition hover:text-white"
            aria-label="Event info"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex flex-1 justify-center px-4 pb-28 pt-4 sm:px-6 md:px-8">
        <div className="flex w-full max-w-3xl flex-1 flex-col rounded-3xl border border-white/10 bg-white/5 shadow-2xl shadow-black/30">
          <div className="border-b border-white/10 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-sm font-semibold text-white/70">Tonight&apos;s plan</p>
                <p className="text-2xl font-semibold text-white">{context.event.title}</p>
                <p className="text-sm text-white/60">{[context.event.locationName, eventTimeLabel].filter(Boolean).join(' • ')}</p>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${connectionAccent}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${connectionDot}`} />
                {connectionLabel}
              </span>
            </div>
            <p className="mt-2 text-xs text-white/60">{connectionHelperText}</p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/50 bg-emerald-400/20 px-4 py-1.5 text-sm font-semibold text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Join request accepted
            </p>
            {derivedNotice ? (
              <p className="mt-2 text-sm text-amber-300">{derivedNotice}</p>
            ) : null}
          </div>

          <div className="flex flex-1 flex-col">
            <MessageList
              status={messagesStatus}
              error={messagesError}
              messages={messages}
              currentUserId={currentUserId}
              onRetry={() => fetchMessages().catch(() => {})}
            />

            <div className="flex items-center justify-center gap-4 border-t border-white/10 bg-white/5 px-6 py-3 text-[11px] text-white/70">
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
              <span className="h-3 w-px bg-white/20" />
              <button
                type="button"
                title="Reporting will be available soon"
                className="flex items-center gap-1 rounded-full border border-transparent px-3 py-2 text-white/70 transition hover:border-white/20 hover:text-white"
                disabled
              >
                <Flag className="h-3.5 w-3.5" />
                Report
              </button>
            </div>

            <div className="border-t border-white/10 bg-[#0f1426]/60 px-6 py-4 backdrop-blur">
              <form onSubmit={handleSend} className="flex items-end gap-3">
                <label htmlFor="chat-message" className="sr-only">
                  Message
                </label>
                <textarea
                  id="chat-message"
                  value={composerValue}
                  onChange={(event) => setComposerValue(event.target.value)}
                  placeholder="Send a message"
                  rows={1}
                  disabled={hasBlockedCounterpart}
                  className="min-h-[48px] flex-1 rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:border-emerald-300 focus:bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-300/40 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/40"
                />
                <button
                  type="submit"
                  disabled={sendStatus === 'sending' || composerValue.trim().length === 0 || hasBlockedCounterpart}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400 text-slate-900 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-white/30 disabled:text-white/60"
                  aria-label="Send message"
                >
                  <Send className="h-5 w-5" />
                </button>
              </form>
              {hasBlockedCounterpart ? (
                <p className="mt-2 text-sm text-white/60">
                  You blocked this user. Manage safety settings from your profile if you change your mind.
                </p>
              ) : null}
              {queuedHelperText ? (
                <p className="mt-2 text-sm text-amber-300">{queuedHelperText}</p>
              ) : null}
              {sendError ? <p className="mt-2 text-sm text-rose-300">{sendError}</p> : null}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
