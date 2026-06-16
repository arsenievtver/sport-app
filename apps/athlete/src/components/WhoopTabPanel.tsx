import { useWhoop } from "../hooks/useWhoop";
import { WhoopDashboard } from "./WhoopDashboard";

export function WhoopTabPanel() {
  const { status, loading, busy, error, notice, runSync, handleConnect, handleDisconnect } = useWhoop();

  const connected = Boolean(status?.connected);
  const hasDashboard = connected && Boolean(status?.last_sync);

  return (
    <section className="whoop-panel whoop-panel--tab">
      <div className="whoop-panel__header">
        <div>
          <h2 className="whoop-panel__title">WHOOP</h2>
          <p className="whoop-panel__subtitle">Recovery, сон и нагрузка с браслета — только с вашего согласия.</p>
        </div>
        {connected ? (
          <span className="whoop-panel__badge whoop-panel__badge--ok">Подключено</span>
        ) : (
          <span className="whoop-panel__badge">Не подключено</span>
        )}
      </div>

      {loading ? <p className="text-muted">Загрузка…</p> : null}
      {notice ? <p className="whoop-panel__notice">{notice}</p> : null}
      {error ? <p className="whoop-panel__error">{error}</p> : null}
      {connected && !status?.has_refresh_token ? (
        <p className="whoop-panel__warn">
          Автообновление недоступно — отключите WHOOP и подключите снова (один раз Grant).
        </p>
      ) : null}

      <div className="whoop-panel__actions">
        {!connected ? (
          <button type="button" className="whoop-btn whoop-btn--primary" disabled={busy} onClick={() => void handleConnect()}>
            Подключить WHOOP
          </button>
        ) : (
          <>
            <button type="button" className="whoop-btn whoop-btn--primary" disabled={busy} onClick={() => void runSync()}>
              {busy ? "Синхронизация…" : "Обновить данные"}
            </button>
            <button type="button" className="whoop-btn whoop-btn--ghost" disabled={busy} onClick={() => void handleDisconnect()}>
              Отключить
            </button>
          </>
        )}
      </div>

      {connected ? (
        hasDashboard && status?.last_sync ? (
          <WhoopDashboard data={status.last_sync} />
        ) : (
          <div className="whoop-panel__placeholder">
            <p>Нажмите «Обновить данные», чтобы загрузить показатели.</p>
          </div>
        )
      ) : null}
    </section>
  );
}
