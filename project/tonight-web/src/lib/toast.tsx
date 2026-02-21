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
    container: "border-emerald-400/40 bg-emerald-500/10 shadow-emerald-500/30",
    badge: "bg-emerald-500/20 text-emerald-100 border border-emerald-400/30",
    icon: "text-emerald-100 bg-emerald-500/20",
  },
  error: {
    container: "border-rose-400/40 bg-rose-500/10 shadow-rose-500/30",
    badge: "bg-rose-500/20 text-rose-100 border border-rose-400/30",
    icon: "text-rose-100 bg-rose-500/20",
  },
  info: {
    container: "border-border/60 bg-card/80 shadow-black/30",
    badge: "bg-primary/20 text-primary border border-primary/30",
    icon: "text-primary bg-primary/20",
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
      className={`pointer-events-auto w-full max-w-md translate-y-0 rounded-2xl border p-4 text-left shadow-[0_8px_24px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-all duration-300 ${
        styles.container
      } ${visible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles.badge}`}>
              {intent === "success" ? "Success" : intent === "error" ? "Heads up" : "Notice"}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {description === undefined || description === null ? null : typeof description === "string" || typeof description === "number" ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : (
            <div className="text-sm text-muted-foreground">{description}</div>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-full p-1.5 text-muted-foreground transition hover:bg-background/40 hover:text-foreground"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
