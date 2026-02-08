"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

import type { SerializedBlockRecord } from '@/lib/blocking';

const combineClasses = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(' ');

type SubmissionState = 'idle' | 'loading' | 'success' | 'error';

type InlineNotice = {
  type: 'success' | 'error';
  message: string;
};

type BlockUserButtonProps = {
  targetUserId: string;
  targetDisplayName?: string | null;
  className?: string;
  label?: string;
  confirmTitle?: string;
  confirmMessage?: string;
  confirmCtaLabel?: string;
  confirmCancelLabel?: string;
  initiallyBlocked?: boolean;
  disabled?: boolean;
  onBlocked?: (block: SerializedBlockRecord) => void;
};

export default function BlockUserButton({
  targetUserId,
  targetDisplayName,
  className,
  label = 'Block',
  confirmTitle,
  confirmMessage,
  confirmCtaLabel = 'Block user',
  confirmCancelLabel = 'Cancel',
  initiallyBlocked = false,
  disabled = false,
  onBlocked,
}: BlockUserButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hasBlocked, setHasBlocked] = useState(initiallyBlocked);
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [inlineNotice, setInlineNotice] = useState<InlineNotice | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const buttonId = useId();
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();

  useEffect(() => {
    setHasBlocked(initiallyBlocked);
    setInlineNotice(null);
    setDialogError(null);
    setSubmissionState('idle');
  }, [initiallyBlocked, targetUserId]);

  useEffect(() => {
    return () => {
      requestRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!confirmOpen) {
      return undefined;
    }

    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setConfirmOpen(false);
        setDialogError(null);
      }
    };

    const handleOutsideClick = (event: MouseEvent) => {
      const dialogNode = dialogRef.current;
      if (!dialogNode) {
        return;
      }
      if (event.target instanceof Node && !dialogNode.contains(event.target)) {
        setConfirmOpen(false);
        setDialogError(null);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [confirmOpen]);

  const resolvedConfirmTitle = useMemo(() => {
    if (confirmTitle) {
      return confirmTitle;
    }
    if (targetDisplayName) {
      return `Block ${targetDisplayName}?`;
    }
    return 'Block this user?';
  }, [confirmTitle, targetDisplayName]);

  const resolvedConfirmMessage = useMemo(() => {
    if (confirmMessage) {
      return confirmMessage;
    }
    return 'They will no longer be able to message you, join your events, or see your plans.';
  }, [confirmMessage]);

  const resolvedDisabled = disabled || hasBlocked;

  const handleCancel = useCallback(() => {
    requestRef.current?.abort();
    setConfirmOpen(false);
    setDialogError(null);
    setSubmissionState('idle');
  }, []);

  const handleOpenConfirm = useCallback(() => {
    if (resolvedDisabled) {
      return;
    }
    setConfirmOpen(true);
    setDialogError(null);
    setInlineNotice(null);
  }, [resolvedDisabled]);

  const handleBlock = useCallback(async () => {
    if (submissionState === 'loading') {
      return;
    }

    setSubmissionState('loading');
    setDialogError(null);
    setInlineNotice(null);

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    try {
      const response = await fetch('/api/users/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetUserId }),
        signal: controller.signal,
      });

      const payload = (await response
        .json()
        .catch(() => null)) as { block?: SerializedBlockRecord; error?: string } | null;

      if (!response.ok || !payload?.block) {
        const message = payload?.error ?? 'Unable to block this user.';
        throw new Error(message);
      }

      setSubmissionState('success');
      setConfirmOpen(false);
      setDialogError(null);
      setHasBlocked(true);
      setInlineNotice({
        type: 'success',
        message: targetDisplayName ? `${targetDisplayName} has been blocked.` : 'User blocked.',
      });
      onBlocked?.(payload.block);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return;
      }
      const message = (error as Error).message ?? 'Unable to block this user.';
      setSubmissionState('error');
      setDialogError(message);
    } finally {
      requestRef.current = null;
    }
  }, [onBlocked, submissionState, targetDisplayName, targetUserId]);

  const buttonLabel = hasBlocked ? 'Blocked' : label;
  const helperColor = inlineNotice?.type === 'success' ? 'text-emerald-600' : 'text-rose-600';

  return (
    <div className={combineClasses('relative inline-flex flex-col items-start', className)}>
      <button
        id={buttonId}
        type="button"
        onClick={handleOpenConfirm}
        disabled={resolvedDisabled}
        className={combineClasses(
          'inline-flex items-center gap-1.5 rounded-full border border-transparent px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-200 focus-visible:ring-offset-2',
          hasBlocked
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-zinc-200 bg-white/80 text-zinc-600 hover:text-zinc-900',
          resolvedDisabled && !hasBlocked ? 'opacity-60' : ''
        )}
        aria-pressed={hasBlocked}
      >
        <ShieldAlert className="h-3.5 w-3.5" />
        {buttonLabel}
      </button>

      {inlineNotice ? (
        <p className={combineClasses('mt-1 text-[11px]', helperColor)} role="status">
          {inlineNotice.message}
        </p>
      ) : null}

      {confirmOpen ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          aria-describedby={dialogDescriptionId}
          className="absolute left-1/2 top-full z-20 mt-3 w-64 -translate-x-1/2 rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-2xl"
        >
          <p id={dialogTitleId} className="text-sm font-semibold text-zinc-900">
            {resolvedConfirmTitle}
          </p>
          <p id={dialogDescriptionId} className="mt-1 text-xs text-zinc-500">
            {resolvedConfirmMessage}
          </p>

          {dialogError ? (
            <p className="mt-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-600">
              {dialogError}
            </p>
          ) : null}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 rounded-full border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
            >
              {confirmCancelLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                void handleBlock();
              }}
              className="flex-1 rounded-full bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              disabled={submissionState === 'loading'}
            >
              {submissionState === 'loading' ? 'Blocking…' : confirmCtaLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
