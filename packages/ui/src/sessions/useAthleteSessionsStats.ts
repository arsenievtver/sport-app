import { fetchAthleteSessionsStats } from "@sport-app/api-client";
import { useCallback, useEffect, useState } from "react";

export function useAthleteSessionsStats(enabled: boolean) {
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const stats = await fetchAthleteSessionsStats();
      setSessionsCompleted(stats.sessions_completed);
    } catch {
      // Keep the last known count on transient errors.
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void refresh();
  }, [enabled, refresh]);

  return { sessionsCompleted, loading, refresh, setSessionsCompleted };
}
