import { useCallback, useEffect, useState } from "react";
import {
  clearTokens,
  fetchMe,
  getAccessToken,
  getRefreshToken,
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

export function useAuthSession(requiredRole: UserRole): AuthSession {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [checking, setChecking] = useState(true);

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

  const validateSession = useCallback(async () => {
    if (!getAccessToken() && !getRefreshToken()) {
      setUser(null);
      return;
    }

    try {
      const nextUser = await fetchMe();
      if (!hasRole(nextUser, requiredRole)) {
        clearTokens();
        setUser(null);
        return;
      }
      setUser(nextUser);
    } catch {
      clearTokens();
      setUser(null);
    }
  }, [requiredRole]);

  useEffect(() => {
    validateSession().finally(() => setChecking(false));
  }, [validateSession]);

  useEffect(() => {
    const recheck = () => {
      if (sessionRefreshPaused) return;
      if (document.visibilityState !== "visible") return;
      if (!getAccessToken() && !getRefreshToken()) return;
      void validateSession();
    };

    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    window.addEventListener("pageshow", recheck);

    return () => {
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
      window.removeEventListener("pageshow", recheck);
    };
  }, [validateSession]);

  return { user, setUser, checking, logout };
}
