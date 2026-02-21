"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "./useAuth";

export const useRequireAuth = (options?: { redirectTo?: string }) => {
  const router = useRouter();
  const { status, user } = useAuth();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (status !== "unauthenticated" || redirectedRef.current) {
      return;
    }

    redirectedRef.current = true;

    const target = new URL(options?.redirectTo ?? "/login", window.location.origin);

    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (!options?.redirectTo && currentPath && currentPath !== "/login") {
      target.searchParams.set("next", currentPath);
    }

    router.replace(`${target.pathname}${target.search}${target.hash}`);
  }, [options?.redirectTo, router, status]);

  return useMemo(
    () => ({
      status,
      user,
      isRedirecting: redirectedRef.current,
    }),
    [status, user]
  );
};
