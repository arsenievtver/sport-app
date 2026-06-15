import { useCallback, useEffect, useState } from "react";
import {
  disconnectWhoop,
  fetchWhoopConnectUrl,
  fetchWhoopStatus,
  syncWhoop,
} from "@sport-app/api-client";
import type { WhoopStatusResponse } from "@sport-app/shared";

export function useWhoop() {
  const [status, setStatus] = useState<WhoopStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchWhoopStatus();
      setStatus(next);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить статус WHOOP");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const runSync = useCallback(
    async (silent = false) => {
      setBusy(true);
      if (!silent) {
        setError(null);
        setNotice(null);
      }
      try {
        await syncWhoop();
        if (!silent) setNotice("Данные WHOOP обновлены");
        await loadStatus();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось синхронизировать WHOOP");
      } finally {
        setBusy(false);
      }
    },
    [loadStatus],
  );

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleConnect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { authorization_url } = await fetchWhoopConnectUrl();
      window.location.href = authorization_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось начать подключение WHOOP");
      setBusy(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await disconnectWhoop();
      setStatus({ connected: false, provider: "whoop" });
      setNotice("WHOOP отключён");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отключить WHOOP");
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    status,
    loading,
    busy,
    error,
    notice,
    loadStatus,
    runSync,
    handleConnect,
    handleDisconnect,
  };
}
