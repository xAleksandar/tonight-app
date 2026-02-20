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
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

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

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchUser = useCallback(async () => {
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

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const removeListener = App.addListener("appUrlOpen", (data) => {
      const url = data?.url;
      if (!url) {
        return;
      }
      if (url.includes("/auth/verify")) {
        window.location.href = url;
      }
    });

    return () => {
      removeListener.then((handler) => handler.remove()).catch(() => undefined);
    };
  }, []);

  const logout = useCallback(async () => {
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
