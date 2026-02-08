"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { SerializedReport } from "@/lib/reports";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

const reasonOptions = [
  {
    value: "safety-concern",
    label: "Something feels unsafe",
    helper: "Concerning behavior, location, or gut-feel that something is off.",
  },
  {
    value: "spam-or-scam",
    label: "Spam or scam attempt",
    helper: "Phishing links, money requests, or sales pitches.",
  },
  {
    value: "harassment-or-abuse",
    label: "Harassment or abusive content",
    helper: "Threats, hate speech, or repeated unwanted contact.",
  },
  {
    value: "other",
    label: "Something else",
    helper: "A different issue that is not covered above.",
  },
] as const;

export type ReportTarget =
  | {
      type: "event";
      eventId: string;
      eventTitle?: string | null;
      hostName?: string | null;
    }
  | {
      type: "user";
      userId: string;
      displayName?: string | null;
      subtitle?: string | null;
    };

type SubmissionState = "idle" | "loading" | "success" | "error";

export type ReportModalProps = {
  isOpen: boolean;
  target: ReportTarget;
  onClose?: () => void;
  onSubmitted?: (report: SerializedReport) => void;
  defaultReason?: (typeof reasonOptions)[number]["value"];
  titleOverride?: string;
};

const DESCRIPTION_LIMIT = 600;

export default function ReportModal({
  isOpen,
  target,
  onClose,
  onSubmitted,
  defaultReason,
  titleOverride,
}: ReportModalProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(defaultReason ?? null);
  const [description, setDescription] = useState("");
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const reasonGroupId = useId();
  const descriptionFieldId = useId();

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.removeProperty("overflow");
      return () => {};
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      requestRef.current?.abort();
      setSubmissionState("idle");
      setStatusMessage(null);
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const resetForm = useCallback(() => {
    requestRef.current?.abort();
    setSelectedReason(defaultReason ?? null);
    setDescription("");
    setSubmissionState("idle");
    setStatusMessage(null);
  }, [defaultReason]);

  useEffect(() => {
    resetForm();
  }, [resetForm, target]);

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === overlayRef.current) {
      onClose?.();
    }
  };

  const isEventTarget = target.type === "event";
  const targetId = isEventTarget ? target.eventId : target.userId;
  const resolvedEventId = isEventTarget ? target.eventId : undefined;
  const reportedUserId = isEventTarget ? undefined : target.userId;

  useEffect(() => {
    return () => {
      requestRef.current?.abort();
    };
  }, [targetId]);

  const targetSummary = useMemo(() => {
    if (isEventTarget) {
      return target.eventTitle?.trim() || "this event";
    }
    return target.displayName?.trim() || "this person";
  }, [isEventTarget, target]);

  const subtitle = useMemo(() => {
    if (isEventTarget) {
      return target.hostName?.trim() ? `Hosted by ${target.hostName.trim()}` : undefined;
    }

    return target.subtitle?.trim() || undefined;
  }, [isEventTarget, target]);

  const modalTitle = titleOverride ?? (isEventTarget ? "Report event" : "Report user");

  const disabledReasonSelection = submissionState === "loading" || submissionState === "success";
  const isSubmitDisabled =
    !selectedReason || submissionState === "loading" || submissionState === "success";

  const remainingCharacters = DESCRIPTION_LIMIT - description.length;

  const handleSubmit = useCallback(async () => {
    if (!selectedReason || submissionState === "loading") {
      return;
    }

    setSubmissionState("loading");
    setStatusMessage(null);

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    const payload: Record<string, unknown> = {
      reason: selectedReason,
      description: description.trim() ? description.trim() : undefined,
      eventId: resolvedEventId,
      reportedUserId,
    };

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => null)) as
        | { report?: SerializedReport; error?: string }
        | null;

      if (!response.ok || !data?.report) {
        throw new Error(data?.error || "Unable to submit the report.");
      }

      setSubmissionState("success");
      setStatusMessage("Thanks for letting us know. Our team will review ASAP.");
      showSuccessToast("Report submitted", "Our safety team will review ASAP.");
      onSubmitted?.(data.report);
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }
      const message = (error as Error).message || "Unable to submit the report.";
      setSubmissionState("error");
      setStatusMessage(message);
      showErrorToast("Report failed", message);
    }
  }, [description, onSubmitted, reportedUserId, resolvedEventId, selectedReason, submissionState]);

  if (!mounted || !isOpen) {
    return null;
  }

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-zinc-200 p-2 text-sm text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-700"
          aria-label="Close report dialog"
        >
          ×
        </button>

        <div className="space-y-6">
          <header className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-pink-600">Safety first</p>
            <h2 id="report-modal-title" className="text-2xl font-semibold text-zinc-900">
              {modalTitle}
            </h2>
            <p className="text-sm text-zinc-500">
              Reports stay private. We review every submission to keep Tonight respectful and safe.
            </p>
          </header>

          <section className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              You are reporting
            </p>
            <p className="mt-1 text-lg font-semibold text-zinc-900">{targetSummary}</p>
            {subtitle ? <p className="text-sm text-zinc-500">{subtitle}</p> : null}
          </section>

          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Why are you reporting?
            </p>
            <div className="grid gap-3">
              {reasonOptions.map((option) => {
                const checked = selectedReason === option.value;
                return (
                  <label
                    key={option.value}
                    className={`relative flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                      checked
                        ? "border-pink-300 bg-pink-50/80"
                        : "border-zinc-200 bg-white hover:border-zinc-300"
                    } ${disabledReasonSelection ? "opacity-70" : ""}`}
                  >
                    <input
                      type="radio"
                      name={reasonGroupId}
                      value={option.value}
                      className="sr-only"
                      checked={checked}
                      disabled={disabledReasonSelection}
                      onChange={() => {
                        setSelectedReason(option.value);
                        if (submissionState === "error") {
                          setSubmissionState("idle");
                          setStatusMessage(null);
                        }
                      }}
                    />
                    <span
                      aria-hidden="true"
                      className={`mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold ${
                        checked ? "border-pink-500 bg-pink-500 text-white" : "border-zinc-300 text-transparent"
                      }`}
                    >
                      •
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{option.label}</p>
                      <p className="text-xs text-zinc-500">{option.helper}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor={descriptionFieldId}
                className="text-xs font-semibold uppercase tracking-wide text-zinc-500"
              >
                Add details (optional)
              </label>
              <span className="text-[11px] text-zinc-400">{remainingCharacters} left</span>
            </div>
            <textarea
              id={descriptionFieldId}
              value={description}
              onChange={(event) => {
                const nextValue = event.target.value.slice(0, DESCRIPTION_LIMIT);
                setDescription(nextValue);
                if (submissionState === "error") {
                  setSubmissionState("idle");
                  setStatusMessage(null);
                }
              }}
              disabled={submissionState === "success"}
              placeholder="Share any helpful context, dates, screenshots, or quotes."
              className="min-h-[120px] w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-100 disabled:cursor-not-allowed"
            />
          </section>

          {statusMessage ? (
            <p
              role="status"
              className={`rounded-2xl px-4 py-3 text-sm ${
                submissionState === "success"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : submissionState === "error"
                    ? "border border-rose-200 bg-rose-50 text-rose-600"
                    : "border border-zinc-200 bg-zinc-50 text-zinc-600"
              }`}
            >
              {statusMessage}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-500">
              Urgent safety issue? Email <a className="font-semibold text-pink-600" href="mailto:safety@tonight.app">safety@tonight.app</a>
            </p>
            <button
              type="button"
              onClick={() => {
                void handleSubmit();
              }}
              disabled={isSubmitDisabled}
              className="flex items-center justify-center rounded-full bg-pink-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-pink-500 disabled:cursor-not-allowed disabled:bg-zinc-200"
            >
              {submissionState === "loading"
                ? "Sending report…"
                : submissionState === "success"
                  ? "Report sent"
                  : "Submit report"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
