"use client";

import { useEffect, useMemo, useState } from "react";

const TICK_INTERVAL_MS = 1000;

export type SnoozeCountdown = {
  isActive: boolean;
  remainingMs: number;
  secondsRemaining: number;
  label: string | null;
};

export function useSnoozeCountdown(targetISO?: string | null): SnoozeCountdown {
  const computeRemaining = () => {
    if (!targetISO) {
      return 0;
    }
    const targetTimestamp = Date.parse(targetISO);
    if (Number.isNaN(targetTimestamp)) {
      return 0;
    }
    return Math.max(targetTimestamp - Date.now(), 0);
  };

  const [remainingMs, setRemainingMs] = useState<number>(() => computeRemaining());

  useEffect(() => {
    if (!targetISO || typeof window === "undefined") {
      setRemainingMs(0);
      return;
    }

    const targetTimestamp = Date.parse(targetISO);
    if (Number.isNaN(targetTimestamp)) {
      setRemainingMs(0);
      return;
    }

    setRemainingMs(Math.max(targetTimestamp - Date.now(), 0));

    const interval = window.setInterval(() => {
      const nextRemaining = targetTimestamp - Date.now();
      if (nextRemaining <= 0) {
        setRemainingMs(0);
        window.clearInterval(interval);
      } else {
        setRemainingMs(nextRemaining);
      }
    }, TICK_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [targetISO]);

  const secondsRemaining = useMemo(() => {
    if (!targetISO || remainingMs <= 0) {
      return 0;
    }
    return Math.max(Math.ceil(remainingMs / 1000), 0);
  }, [remainingMs, targetISO]);

  const label = useMemo(() => {
    if (secondsRemaining <= 0) {
      return null;
    }
    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;
    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, "0")} left`;
    }
    return `${seconds}s left`;
  }, [secondsRemaining]);

  return {
    isActive: Boolean(targetISO) && secondsRemaining > 0,
    remainingMs,
    secondsRemaining,
    label,
  };
}
