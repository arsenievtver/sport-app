import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearTokens,
  fetchMe,
  getAccessToken,
  getRefreshToken,
  isTransportError,
  setOnAuthFailure,
} from "@sport-app/api-client";
import { hasRole } from "@sport-app/shared";
import type { UserResponse, UserRole } from "@sport-app/shared";

let sessionRefreshPaused = false;

/** Pause background /auth/me refresh while athlete onboarding is open. */
export function setSessionRefreshPaused(paused: boolean): void {
  sessionRefreshPaused = paused;
}

export interface AuthSession {
  user: UserResponse | null;
  setUser: (user: UserResponse | null) => void;
  checking: boolean;
  logout: () => void;
}

const RECHECK_DEBOUNCE_MS = 400;
const BOOT_RETRY_DELAYS_MS = [0, 800, 2000];

function isSessionExpiredError(err: unknown): boolean {
  return err instanceof Error && err.message === "Сессия истекла";
}

export function useAuthSession(requiredRole: UserRole): AuthSession {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [checking, setChecking] = useState(true);
  const userRef = useRef(user);
  userRef.current = user;

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  useEffect(() => {
    setOnAuthFailure(() => {
      setUser(null);
    });
    return () => setOnAuthFailure(null);
  }, []);

  const validateSession = useCallback(async (): Promise<"ok" | "logged_out" | "transient"> => {
    if (!getAccessToken() && !getRefreshToken()) {
      setUser(null);
      return "logged_out";
    }

    try {
      const nextUser = await fetchMe();
      if (!hasRole(nextUser, requiredRole)) {
        clearTokens();
        setUser(null);
        return "logged_out";
      }
      setUser(nextUser);
      return "ok";
    } catch (err) {
      if (isTransportError(err)) {
        return "transient";
      }
      if (isSessionExpiredError(err)) {
        setUser(null);
        return "logged_out";
      }
      // 5xx / unexpected: keep tokens and current user if any
      return "transient";
    }
  }, [requiredRole]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      let result: "ok" | "logged_out" | "transient" = "logged_out";

      for (let i = 0; i < BOOT_RETRY_DELAYS_MS.length; i++) {
        if (cancelled) return;
        const delay = BOOT_RETRY_DELAYS_MS[i];
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          if (cancelled) return;
        }
        result = await validateSession();
        if (result !== "transient") break;
        if (!getAccessToken() && !getRefreshToken()) {
          result = "logged_out";
          break;
        }
      }

      if (!cancelled) {
        if (result === "transient" && !userRef.current) {
          // Tokens kept; show login only if we never got a user — recheck on resume.
        }
        setChecking(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [validateSession]);

  useEffect(() => {
    let debounceId: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;

    const recheck = () => {
      if (sessionRefreshPaused) return;
      if (document.visibilityState !== "visible") return;
      if (!getAccessToken() && !getRefreshToken()) return;

      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(() => {
        if (inFlight) return;
        inFlight = true;
        void validateSession().finally(() => {
          inFlight = false;
        });
      }, RECHECK_DEBOUNCE_MS);
    };

    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    window.addEventListener("pageshow", recheck);

    return () => {
      if (debounceId) clearTimeout(debounceId);
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
      window.removeEventListener("pageshow", recheck);
    };
  }, [validateSession]);

  return { user, setUser, checking, logout };
}
