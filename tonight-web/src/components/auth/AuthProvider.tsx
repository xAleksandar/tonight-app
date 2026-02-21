"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  photoUrl: string | null;
  createdAt: string;
};

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
};

const DEV_AUTH_BYPASS =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "1";

const DEV_AUTH_USER: AuthUser = {
  id: process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS_ID ?? "tonight-dev-user",
  email: process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS_EMAIL ?? "dev@tonight.test",
  displayName: process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS_NAME ?? "Tonight Dev",
  photoUrl: process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS_PHOTO ?? null,
  createdAt: process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS_CREATED_AT ?? "1970-01-01T00:00:00.000Z",
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchUser = useCallback(async () => {
    if (DEV_AUTH_BYPASS) {
      setError(null);
      setStatus("authenticated");
      setUser(DEV_AUTH_USER);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    setStatus("loading");

    try {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Unable to load session");
      }

      const payload = (await response.json()) as { user: AuthUser | null };
      if (payload.user) {
        setUser(payload.user);
        setStatus("authenticated");
        return;
      }

      setUser(null);
      setStatus("unauthenticated");
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }
      console.error("Failed to verify session", error);
      setUser(null);
      setError("Unable to verify your session. Please try again.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    fetchUser().catch((error) => {
      console.error("Unexpected auth initialization failure", error);
    });

    return () => {
      abortRef.current?.abort();
    };
  }, [fetchUser]);

  const logout = useCallback(async () => {
    if (DEV_AUTH_BYPASS) {
      setUser(DEV_AUTH_USER);
      setStatus("authenticated");
      return;
    }

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      console.error("Failed to log out", error);
    } finally {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    error,
    isAuthenticated: status === "authenticated",
    refreshUser: fetchUser,
    logout,
  }), [error, fetchUser, logout, status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
};
