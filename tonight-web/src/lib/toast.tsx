"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { type ReactNode } from "react";
import toast from "react-hot-toast";

export type ToastIntent = "success" | "error" | "info";

export type ShowToastParams = {
  title: string;
  description?: ReactNode;
  intent?: ToastIntent;
  id?: string;
  duration?: number;
};

const INTENT_STYLES: Record<ToastIntent, { container: string; badge: string; icon: string }> = {
  success: {
    container: "border-emerald-200/80 shadow-emerald-500/10",
    badge: "bg-emerald-50 text-emerald-600",
    icon: "text-emerald-600 bg-emerald-100",
  },
  error: {
    container: "border-rose-200/80 shadow-rose-500/10",
    badge: "bg-rose-50 text-rose-600",
    icon: "text-rose-600 bg-rose-100",
  },
  info: {
    container: "border-zinc-200/80 shadow-zinc-900/10",
    badge: "bg-zinc-100 text-zinc-600",
    icon: "text-zinc-600 bg-zinc-100",
  },
};

export const showToast = ({ title, description, intent = "info", id, duration }: ShowToastParams) => {
  const resolvedDuration = duration ?? (intent === "error" ? 6000 : 4200);
  return toast.custom(
    (t) => (
      <ToastCard
        intent={intent}
        title={title}
        description={description}
        visible={t.visible}
        onDismiss={() => toast.dismiss(t.id)}
      />
    ),
    {
      id,
      duration: resolvedDuration,
      position: "top-center",
    }
  );
};

export const showSuccessToast = (title: string, description?: ReactNode) =>
  showToast({ title, description, intent: "success" });

export const showErrorToast = (title: string, description?: ReactNode) =>
  showToast({ title, description, intent: "error" });

export const showInfoToast = (title: string, description?: ReactNode) =>
  showToast({ title, description, intent: "info" });

type ToastCardProps = {
  intent: ToastIntent;
  title: string;
  description?: ReactNode;
  visible: boolean;
  onDismiss: () => void;
};

function ToastCard({ intent, title, description, visible, onDismiss }: ToastCardProps) {
  const styles = INTENT_STYLES[intent];
  const Icon = intent === "success" ? CheckCircle2 : intent === "error" ? XCircle : Info;

  return (
    <div
      className={`pointer-events-auto w-full max-w-sm translate-y-0 rounded-3xl border bg-white/95 p-4 text-left text-zinc-900 shadow-[0_25px_80px_rgba(15,23,42,0.18)] backdrop-blur transition-all duration-200 ${
        styles.container
      } ${visible ? "opacity-100" : "opacity-0"}`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${styles.icon}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${styles.badge}`}>
              {intent === "success" ? "Success" : intent === "error" ? "Heads up" : "Notice"}
            </span>
          </div>
          <p className="text-sm font-semibold text-zinc-900">{title}</p>
          {description ? <p className="text-sm text-zinc-600">{description}</p> : null}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full p-1 text-zinc-400 transition hover:text-zinc-600"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
