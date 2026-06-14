import { useCallback, useEffect, useState } from "react";
import {
  disconnectWhoop,
  fetchWhoopConnectUrl,
  fetchWhoopStatus,
  syncWhoop,
} from "@sport-app/api-client";
import type { WhoopStatusResponse } from "@sport-app/shared";

import { WhoopDashboard } from "./WhoopDashboard";

export function WhoopPanel() {
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

  const runSync = useCallback(async (silent = false) => {
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
  }, [loadStatus]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const whoop = params.get("whoop");
    if (!whoop) return;

    const reason = params.get("reason");
    params.delete("whoop");
    params.delete("reason");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);

    if (whoop === "connected") {
      setNotice("WHOOP подключён — загружаем данные…");
      void (async () => {
        await loadStatus();
        await runSync(true);
        setNotice("WHOOP подключён, дашборд готов");
      })();
      return;
    }

    if (whoop === "error") {
      setError(`Ошибка подключения WHOOP: ${reason ?? "unknown"}`);
    }
  }, [loadStatus, runSync]);

  async function handleConnect() {
    setBusy(true);
    setError(null);
    try {
      const { authorization_url } = await fetchWhoopConnectUrl();
      window.location.href = authorization_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось начать подключение WHOOP");
      setBusy(false);
    }
  }

  async function handleDisconnect() {
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
  }

  const hasDashboard = Boolean(status?.connected && status.last_sync);

  return (
    <section className="whoop-panel">
      <div className="whoop-panel__header">
        <div>
          <h2 className="whoop-panel__title">WHOOP</h2>
          <p className="whoop-panel__subtitle">
            Recovery, сон и нагрузка с браслета — только с вашего согласия.
          </p>
        </div>
        {status?.connected ? (
          <span className="whoop-panel__badge whoop-panel__badge--ok">Подключено</span>
        ) : (
          <span className="whoop-panel__badge">Не подключено</span>
        )}
      </div>

      {loading ? <p className="text-muted">Загрузка…</p> : null}
      {notice ? <p className="whoop-panel__notice">{notice}</p> : null}
      {error ? <p className="whoop-panel__error">{error}</p> : null}
      {status?.connected && !status.has_refresh_token ? (
        <p className="whoop-panel__warn">
          Автообновление недоступно — отключите WHOOP и подключите снова (один раз Grant).
        </p>
      ) : null}

      <div className="whoop-panel__actions">
        {!status?.connected ? (
          <button type="button" className="whoop-btn whoop-btn--primary" disabled={busy} onClick={handleConnect}>
            Подключить WHOOP
          </button>
        ) : (
          <>
            <button type="button" className="whoop-btn whoop-btn--primary" disabled={busy} onClick={() => void runSync()}>
              {busy ? "Синхронизация…" : "Обновить"}
            </button>
            <button type="button" className="whoop-btn whoop-btn--ghost" disabled={busy} onClick={handleDisconnect}>
              Отключить
            </button>
          </>
        )}
      </div>

      {hasDashboard && status?.last_sync ? <WhoopDashboard data={status.last_sync} /> : null}

      {status?.connected && !status.last_sync && !busy ? (
        <div className="whoop-panel__placeholder">
          <p>WHOOP подключён. Нажмите «Обновить», чтобы загрузить дашборд.</p>
          <button type="button" className="whoop-btn whoop-btn--primary" onClick={() => void runSync()}>
            Загрузить данные
          </button>
        </div>
      ) : null}
    </section>
  );
}
