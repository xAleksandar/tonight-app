"use client";

import { useEffect, useMemo, useRef } from 'react';

import type { SerializedMessage } from '@/lib/chat';

export type MessageListStatus = 'loading' | 'ready' | 'error';

export type ChatMessage = SerializedMessage & {
  deliveryStatus?: 'queued' | 'sending' | 'failed';
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
  onRetry?: () => void;
  className?: string;
};

export default function MessageList({
  status,
  error,
  messages,
  currentUserId,
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

  const content = useMemo(() => {
    if (isLoading) {
      return (
        <div className="space-y-3" role="status" aria-live="polite">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-16 w-full animate-pulse rounded-2xl bg-white/10" />
          ))}
        </div>
      );
    }

    if (isError) {
      return (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-100">
          <p>{error ?? 'We could not load this conversation.'}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-full border border-rose-200/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-100"
          >
            Try again
          </button>
        </div>
      );
    }

    if (!messages.length) {
      return (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-6 text-center text-sm text-white/70">
          No messages yet. Break the ice with a quick hello.
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3" aria-live="polite">
        {messages.map((message) => {
          const isSelf = message.senderId === currentUserId;
          const bubbleClass = classNames(
            'max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm',
            message.deliveryStatus === 'failed'
              ? 'border border-rose-400/50 bg-rose-500/10 text-rose-100'
              : isSelf
                ? 'rounded-br-md bg-emerald-400 text-slate-900'
                : 'rounded-bl-md border border-white/15 bg-white/5 text-white'
          );
          const statusLabel = message.deliveryStatus ? DELIVERY_STATUS_LABELS[message.deliveryStatus] : null;
          const timestampLabel = formatMessageTimestamp(message.createdAt);
          const metaLabel = statusLabel
            ? [statusLabel, timestampLabel].filter(Boolean).join(' • ')
            : timestampLabel;
          const metaTone = message.deliveryStatus === 'failed' ? 'text-rose-300' : 'text-white/50';

          return (
            <div key={message.id} className={classNames('flex flex-col gap-1', isSelf ? 'items-end' : 'items-start')}>
              <div className={bubbleClass}>{message.content}</div>
              <span className={classNames('px-2 text-[10px] uppercase tracking-wide', metaTone)}>
                {metaLabel}
              </span>
            </div>
          );
        })}
      </div>
    );
  }, [error, isError, isLoading, isReady, messages, currentUserId, onRetry]);

  return (
    <div
      ref={scrollRef}
      className={classNames('flex-1 space-y-4 overflow-y-auto px-4 py-4 text-white sm:px-6 sm:py-6', className)}
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
