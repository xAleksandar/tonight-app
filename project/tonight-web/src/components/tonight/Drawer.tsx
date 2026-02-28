"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { classNames } from "@/lib/classNames";

type DrawerProps = {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  panelClassName?: string;
};

export function Drawer({ isOpen, title, onClose, children, className, panelClassName }: DrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className={classNames(
        "fixed inset-0 z-50 flex items-end justify-center p-0",
        !isOpen && "pointer-events-none",
        className
      )}
      role="dialog"
      aria-modal="true"
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        className={classNames(
          "absolute inset-0 bg-black/60 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0"
        )}
      />

      <div
        className={classNames(
          "relative w-full max-w-xl rounded-t-3xl bg-card text-foreground shadow-2xl transition-transform duration-300 ease-out",
          isOpen ? "translate-y-0" : "translate-y-full",
          panelClassName
        )}
      >
        <div className="relative flex items-center justify-center border-b border-border/60 px-5 pb-3 pt-4">
          {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition hover:bg-card/80 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 pb-6 pt-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
