"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flag, ShieldAlert } from 'lucide-react';

import type { SerializedMessage } from '@/lib/chat';

export type MessageListStatus = 'loading' | 'ready' | 'error';

export type ChatMessage = SerializedMessage & {
  deliveryStatus?: 'queued' | 'sending' | 'failed';
  clientReferenceId?: string;
};

const classNames = (...classes: Array<string | boolean | null | undefined>) =>
  classes.filter(Boolean).join(' ');

const DELIVERY_STATUS_LABELS: Record<NonNullable<ChatMessage['deliveryStatus']>, string> = {
  queued: 'Queued',
  sending: 'Sending…',
  failed: 'Failed to send',
};

type PopupState =
  | null
  | { phase: 'options'; x: number; y: number }
  | { phase: 'confirm' }
  | { phase: 'blocking' };

type MessageListProps = {
  status: MessageListStatus;
  error?: string | null;
  messages: ChatMessage[];
  currentUserId: string;
  counterpartId: string;
  counterpartName?: string;
  onRetry?: () => void;
  className?: string;
  onBlocked?: () => void;
  isCounterpartBlocked?: boolean;
};

type DecoratedMessage = {
  data: ChatMessage;
  isSelf: boolean;
  groupedWithPrevious: boolean;
  groupedWithNext: boolean;
};

const GROUPING_WINDOW_MS = 3 * 60 * 1000; // 3 minutes keeps bursts visually tight

const shouldGroupMessages = (current: ChatMessage, neighbor: ChatMessage | undefined) => {
  if (!neighbor) {
    return false;
  }
  if (neighbor.senderId !== current.senderId) {
    return false;
  }
  const currentTime = Date.parse(current.createdAt);
  const neighborTime = Date.parse(neighbor.createdAt);
  if (Number.isNaN(currentTime) || Number.isNaN(neighborTime)) {
    return false;
  }
  return Math.abs(currentTime - neighborTime) <= GROUPING_WINDOW_MS;
};

function getOptionsPopupStyle(x: number, y: number): React.CSSProperties {
  const popupW = 192;
  const popupH = 96;
  const pad = 8;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 400;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  let left = x + pad;
  let top = y + pad;
  if (left + popupW > vw - pad) left = x - popupW - pad;
  if (top + popupH > vh - pad) top = y - popupH - pad;
  return { position: 'fixed', left: Math.max(pad, left), top: Math.max(pad, top) };
}

export default function MessageList({
  status,
  error,
  messages,
  currentUserId,
  counterpartId,
  counterpartName,
  onRetry,
  className,
  onBlocked,
  isCounterpartBlocked,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isLoading = status === 'loading';
  const isError = status === 'error';
  const isReady = status === 'ready';

  const [popup, setPopup] = useState<PopupState>(null);
  const [blockError, setBlockError] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      blockAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!scrollRef.current || !isReady) {
      return;
    }
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [isReady, messages]);

  const closePopup = useCallback(() => {
    setPopup(null);
    setBlockError(null);
  }, []);

  const startLongPress = useCallback((clientX: number, clientY: number) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      setPopup({ phase: 'options', x: clientX, y: clientY });
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    }, 500);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleBlock = useCallback(async () => {
    setPopup({ phase: 'blocking' });
    setBlockError(null);
    blockAbortRef.current?.abort();
    const controller = new AbortController();
    blockAbortRef.current = controller;
    try {
      const response = await fetch('/api/users/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: counterpartId }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null) as { block?: unknown; error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? 'Unable to block this user.');
      setPopup(null);
      setBlockError(null);
      onBlocked?.();
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setBlockError((err as Error).message ?? 'Unable to block this user.');
      setPopup({ phase: 'confirm' });
    } finally {
      blockAbortRef.current = null;
    }
  }, [counterpartId, onBlocked]);

  const decoratedMessages = useMemo<DecoratedMessage[]>(() => {
    return messages.map((message, index) => {
      const previous = messages[index - 1];
      const next = messages[index + 1];
      const groupedWithPrevious = shouldGroupMessages(message, previous);
      const groupedWithNext = shouldGroupMessages(message, next);
      return {
        data: message,
        isSelf: message.senderId === currentUserId,
        groupedWithPrevious,
        groupedWithNext,
      };
    });
  }, [messages, currentUserId]);

  const content = useMemo(() => {
    if (isLoading) {
      return (
        <div className="space-y-2" role="status" aria-live="polite">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-9 w-full animate-pulse rounded-2xl bg-card/60"
            />
          ))}
        </div>
      );
    }

    if (isError) {
      return (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground">
          <p>{error ?? 'We could not load this conversation.'}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-full border border-destructive/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide"
          >
            Try again
          </button>
        </div>
      );
    }

    if (!decoratedMessages.length) {
      return (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
          No messages yet. Break the ice with a quick hello.
        </div>
      );
    }

    return (
      <div className="flex flex-col" aria-live="polite">
        {decoratedMessages.map(({ data, isSelf, groupedWithPrevious, groupedWithNext }) => {
          const bubbleClass = classNames(
            'max-w-[82%] break-words rounded-3xl px-3 py-1.5 text-sm leading-snug shadow-[0_15px_40px_rgba(5,7,16,0.35)] transition-all lg:max-w-[60%]',
            data.deliveryStatus === 'failed'
              ? 'border border-destructive/40 bg-destructive/10 text-destructive-foreground'
              : isSelf
                ? 'rounded-br-xl bg-gradient-to-br from-primary/85 via-primary to-primary/90 text-primary-foreground'
                : 'rounded-bl-xl border border-border/60 bg-card/70 text-foreground'
          );
          const statusLabel = data.deliveryStatus ? DELIVERY_STATUS_LABELS[data.deliveryStatus] : null;
          const timestampLabel = formatMessageTimestamp(data.createdAt);
          const metaSegments = [statusLabel, timestampLabel].filter(Boolean);
          const metaTone = data.deliveryStatus === 'failed' ? 'text-destructive-foreground' : 'text-muted-foreground';
          const showMetaRow = !groupedWithNext || data.deliveryStatus != null;
          const canLongPress = !isSelf && !isCounterpartBlocked;

          return (
            <div
              key={data.id}
              className={classNames(
                'flex flex-col gap-1',
                isSelf ? 'items-end' : 'items-start',
                groupedWithPrevious ? 'pt-0.5' : 'pt-2.5'
              )}
            >
              {!isSelf && !groupedWithPrevious && counterpartName ? (
                <p className="mb-0.5 px-1 text-[10px] font-medium text-white/50">{counterpartName}</p>
              ) : null}
              <div
                className={classNames(
                  bubbleClass,
                  groupedWithPrevious && (isSelf ? 'rounded-tr-xl' : 'rounded-tl-xl'),
                  groupedWithNext && (isSelf ? 'rounded-br-md' : 'rounded-bl-md'),
                  canLongPress ? 'select-none' : ''
                )}
                onTouchStart={canLongPress ? (e) => startLongPress(e.touches[0].clientX, e.touches[0].clientY) : undefined}
                onTouchEnd={canLongPress ? cancelLongPress : undefined}
                onTouchMove={canLongPress ? cancelLongPress : undefined}
                onMouseDown={canLongPress ? (e) => startLongPress(e.clientX, e.clientY) : undefined}
                onMouseUp={canLongPress ? cancelLongPress : undefined}
                onMouseLeave={canLongPress ? cancelLongPress : undefined}
                onContextMenu={canLongPress ? (e) => { e.preventDefault(); setPopup({ phase: 'options', x: e.clientX, y: e.clientY }); } : undefined}
              >
                {data.content}
              </div>
              {showMetaRow ? (
                <div className="flex items-center gap-2 px-1 text-[10px]">
                  {metaSegments.length > 0 ? (
                    <span className={metaTone}>{metaSegments.join(' • ')}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }, [decoratedMessages, counterpartId, counterpartName, error, isError, isLoading, isCounterpartBlocked, onRetry, startLongPress, cancelLongPress]);

  return (
    <>
      <div
        ref={scrollRef}
        className={classNames('flex-1 overflow-y-auto px-3 py-3', className)}
        aria-live={isLoading ? 'polite' : undefined}
      >
        {content}
      </div>

      {popup !== null ? (
        <div
          className="fixed inset-0 z-50 bg-black/20"
          onClick={closePopup}
          onContextMenu={(e) => e.preventDefault()}
        >
          {popup.phase === 'options' ? (
            <div
              className="absolute min-w-[192px] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl"
              style={getOptionsPopupStyle(popup.x, popup.y)}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-foreground transition hover:bg-background/60"
                onClick={() => {
                  setBlockError(null);
                  setPopup({ phase: 'confirm' });
                }}
              >
                <ShieldAlert className="h-4 w-4 text-rose-400" />
                Block {counterpartName ?? 'user'}
              </button>
              <div className="border-t border-border/60" />
              <button
                type="button"
                disabled
                className="flex w-full cursor-not-allowed items-center gap-3 px-4 py-3 text-left text-sm text-muted-foreground opacity-50"
                title="Reporting will be available soon"
              >
                <Flag className="h-4 w-4" />
                Report
              </button>
            </div>
          ) : (
            <div
              className="absolute left-1/2 top-1/2 w-72 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/60 bg-card p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="font-semibold text-foreground">
                Block {counterpartName ?? 'this user'}?
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                They won&apos;t be able to message you, join your events, or see your plans.
              </p>
              {blockError ? (
                <p className="mt-2 text-xs text-destructive">{blockError}</p>
              ) : null}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={closePopup}
                  disabled={popup.phase === 'blocking'}
                  className="flex-1 rounded-full border border-border/60 px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-background/60 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleBlock()}
                  disabled={popup.phase === 'blocking'}
                  className="flex-1 rounded-full bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {popup.phase === 'blocking' ? 'Blocking…' : 'Block user'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}

const formatMessageTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleTimeString();
  }
};
