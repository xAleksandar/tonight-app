"use client";

import { useEffect, useMemo, useRef } from 'react';

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

type MessageListProps = {
  status: MessageListStatus;
  error?: string | null;
  messages: ChatMessage[];
  currentUserId: string;
  counterpartId: string;
  onRetry?: () => void;
  className?: string;
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

export default function MessageList({
  status,
  error,
  messages,
  currentUserId,
  counterpartId,
  onRetry,
  className,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isLoading = status === 'loading';
  const isError = status === 'error';
  const isReady = status === 'ready';

  useEffect(() => {
    if (!scrollRef.current || !isReady) {
      return;
    }
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [isReady, messages]);

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
        <div className="space-y-3" role="status" aria-live="polite">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-16 w-full animate-pulse rounded-2xl bg-card/60"
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
            'max-w-[82%] rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-[0_15px_40px_rgba(5,7,16,0.35)] transition-all lg:max-w-[60%]',
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
          const isSeenByCounterpart = isSelf && (data.readBy ?? []).some((entry) => entry.userId === counterpartId);
          const showMetaRow = !groupedWithNext || data.deliveryStatus != null;

          return (
            <div
              key={data.id}
              className={classNames(
                'flex flex-col gap-1',
                isSelf ? 'items-end' : 'items-start',
                groupedWithPrevious ? 'pt-1.5' : 'pt-4'
              )}
            >
              <div
                className={classNames(
                  bubbleClass,
                  groupedWithPrevious && (isSelf ? 'rounded-tr-xl' : 'rounded-tl-xl'),
                  groupedWithNext && (isSelf ? 'rounded-br-md' : 'rounded-bl-md')
                )}
              >
                {data.content}
              </div>
              {showMetaRow ? (
                <div className="flex items-center gap-2 px-1 text-[10px]">
                  {metaSegments.length > 0 ? (
                    <span className={metaTone}>{metaSegments.join(' • ')}</span>
                  ) : null}
                  {isSeenByCounterpart ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-200">
                      Seen
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }, [decoratedMessages, counterpartId, error, isError, isLoading, onRetry]);

  return (
    <div
      ref={scrollRef}
      className={classNames('flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5', className)}
      aria-live={isLoading ? 'polite' : undefined}
    >
      {content}
    </div>
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
