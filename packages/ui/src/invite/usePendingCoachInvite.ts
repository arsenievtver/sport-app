import { useEffect, useState } from "react";
import { joinAthleteCoach } from "@sport-app/api-client";
import { clearPendingInviteCode, readPendingInviteCode } from "@sport-app/shared";

export interface PendingCoachInviteState {
  joining: boolean;
  notice: string | null;
  coachesRefreshKey: number;
  error: string | null;
}

export function usePendingCoachInvite(enabled: boolean): PendingCoachInviteState {
  const [joining, setJoining] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [coachesRefreshKey, setCoachesRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const inviteCode = readPendingInviteCode();
    if (!inviteCode) return;

    let cancelled = false;
    setJoining(true);
    setError(null);

    void joinAthleteCoach({ invite_code: inviteCode })
      .then((link) => {
        if (cancelled) return;
        clearPendingInviteCode();
        setNotice(`Тренер ${link.display_name} добавлен`);
        setCoachesRefreshKey((value) => value + 1);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        clearPendingInviteCode();
        if (err.message.includes("уже добавлен")) {
          setCoachesRefreshKey((value) => value + 1);
          return;
        }
        setError(err.message || "Не удалось подключить тренера");
      })
      .finally(() => {
        if (!cancelled) setJoining(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { joining, notice, coachesRefreshKey, error };
}
