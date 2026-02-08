"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Flag, Info, Send } from 'lucide-react';

import BlockUserButton from '@/components/BlockUserButton';
import MessageList, { type MessageListStatus } from '@/components/chat/MessageList';
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

const sortMessages = (items: SerializedMessage[]) =>
  [...items].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

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

export default function ChatConversation({
  joinRequestId,
  currentUserId,
  socketToken,
  context,
}: ChatConversationProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<SerializedMessage[]>([]);
  const [messagesStatus, setMessagesStatus] = useState<MessagesStatus>('loading');
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [composerValue, setComposerValue] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending'>('idle');
  const [socketNotice, setSocketNotice] = useState<string | null>(null);
  const [hasBlockedCounterpart, setHasBlockedCounterpart] = useState(false);
  const fetchAbortRef = useRef<AbortController | null>(null);

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
      setMessages(sortMessages(payload.messages ?? []));
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

  const { connectionState, isConnected, joinRoom } = useSocket({
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
  });

  useEffect(() => {
    if (!isConnected) {
      return;
    }
    joinRoom(joinRequestId);
  }, [isConnected, joinRequestId, joinRoom]);

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

      setSendStatus('sending');
      setSendError(null);

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
    [appendMessage, composerValue, hasBlockedCounterpart, joinRequestId, sendStatus]
  );

  const connectionLabel = STATUS_LABELS[connectionState] ?? 'Connecting…';
  const connectionAccent = connectionState === 'connected' ? 'text-emerald-600 border-emerald-100 bg-emerald-50' : connectionState === 'error' ? 'text-rose-600 border-rose-100 bg-rose-50' : 'text-amber-600 border-amber-100 bg-amber-50';
  const connectionDot = connectionState === 'connected' ? 'bg-emerald-500' : connectionState === 'error' ? 'bg-rose-500' : 'bg-amber-500 animate-pulse';

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-zinc-50 via-white to-zinc-100 text-zinc-900">
      <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full border border-zinc-200 p-2 text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-800"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <UserAvatar displayName={counterpart.displayName ?? undefined} email={counterpart.email} photoUrl={counterpart.photoUrl ?? undefined} size="sm" />
          <div className="flex flex-1 flex-col overflow-hidden">
            <p className="truncate text-base font-semibold">
              {counterpart.displayName ?? counterpart.email}
            </p>
            <p className="text-sm text-zinc-500">{context.event.title}</p>
          </div>
          <button
            type="button"
            title="Event details coming soon"
            className="rounded-xl border border-zinc-200 bg-white p-2 text-zinc-500 transition hover:text-zinc-800"
            aria-label="Event info"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex flex-1 justify-center px-4 py-6">
        <div className="flex w-full max-w-3xl flex-1 flex-col rounded-3xl border border-zinc-100 bg-white shadow-sm">
          <div className="border-b border-zinc-100 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-600">Tonight&apos;s plan</p>
                <p className="text-2xl font-semibold text-zinc-900">{context.event.title}</p>
                <p className="text-sm text-zinc-500">{[context.event.locationName, eventTimeLabel].filter(Boolean).join(' • ')}</p>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${connectionAccent}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${connectionDot}`} />
                {connectionLabel}
              </span>
            </div>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Join request accepted
            </p>
            {socketNotice ? (
              <p className="mt-2 text-sm text-amber-600">{socketNotice}</p>
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

            <div className="flex items-center justify-center gap-4 border-t border-zinc-100 bg-zinc-50/80 px-6 py-3 text-[11px] text-zinc-500">
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
                  setSocketNotice('You blocked this user. Messages are disabled going forward.');
                }}
              />
              <span className="h-3 w-px bg-zinc-200" />
              <button
                type="button"
                title="Reporting will be available soon"
                className="flex items-center gap-1 rounded-full border border-transparent px-3 py-2 transition hover:border-zinc-200 hover:text-zinc-800"
                disabled
              >
                <Flag className="h-3.5 w-3.5" />
                Report
              </button>
            </div>

            <div className="border-t border-zinc-100 bg-white px-6 py-4">
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
                  className="min-h-[48px] flex-1 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-pink-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-pink-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
                />
                <button
                  type="submit"
                  disabled={sendStatus === 'sending' || composerValue.trim().length === 0 || hasBlockedCounterpart}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-600 text-white transition hover:bg-pink-500 disabled:cursor-not-allowed disabled:bg-pink-200"
                  aria-label="Send message"
                >
                  <Send className="h-5 w-5" />
                </button>
              </form>
              {hasBlockedCounterpart ? (
                <p className="mt-2 text-sm text-zinc-500">
                  You blocked this user. Manage safety settings from your profile if you change your mind.
                </p>
              ) : null}
              {sendError ? <p className="mt-2 text-sm text-rose-600">{sendError}</p> : null}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
