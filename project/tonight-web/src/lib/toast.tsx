"use client";

import { Check, Info, X } from "lucide-react";
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

const INTENT_ICON: Record<ToastIntent, { bg: string; Icon: typeof Check }> = {
  success: { bg: "bg-emerald-500", Icon: Check },
  error: { bg: "bg-rose-500", Icon: X },
  info: { bg: "bg-primary", Icon: Info },
};

export const showToast = ({ title, description, intent = "info", id, duration }: ShowToastParams) => {
  const resolvedDuration = duration ?? (intent === "error" ? 6000 : 4000);
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
    { id, duration: resolvedDuration }
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
  const { bg, Icon } = INTENT_ICON[intent];

  return (
    <div
      className={`pointer-events-auto flex w-[90vw] max-w-lg items-center gap-3 rounded-2xl border border-white/10 bg-[#12172b]/95 px-4 py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
      role="status"
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bg}`}>
        <Icon className="h-4 w-4 text-white" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-white">{title}</p>
        {description !== undefined && description !== null && (
          typeof description === "string" || typeof description === "number"
            ? <p className="mt-0.5 text-xs text-white/60">{description}</p>
            : <div className="mt-0.5 text-xs text-white/60">{description}</div>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-full p-1 text-white/40 transition hover:text-white"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
