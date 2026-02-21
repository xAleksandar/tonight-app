"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { classNames } from "@/lib/classNames";

type MobileBottomDrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function MobileBottomDrawer({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: MobileBottomDrawerProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div className={classNames("fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm md:hidden", className)}>
      <button
        type="button"
        aria-label="Close drawer"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />

      <div className="relative z-10 rounded-t-3xl border border-border/60 bg-card/95 px-5 pb-6 pt-4 shadow-[0_-20px_60px_rgba(0,0,0,0.65)]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <button type="button" onClick={onClose} className="rounded-full border border-border/60 p-2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Close</span>
          </button>
        </div>

        <div className="space-y-4 text-foreground">{children}</div>

        {footer && <div className="mt-5 border-t border-border/50 pt-4 text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
