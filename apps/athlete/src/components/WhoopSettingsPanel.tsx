import { useWhoop } from "../hooks/useWhoop";

export function WhoopSettingsPanel() {
  const { status, loading, busy, error, notice, runSync, handleConnect, handleDisconnect } = useWhoop();
  const connected = Boolean(status?.connected);

  return (
    <div className="whoop-settings">
      <div className="whoop-settings__status-row">
        <p className="whoop-settings__lead">
          Recovery, сон и нагрузка с браслета WHOOP — только с вашего согласия.
        </p>
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

      <div className="whoop-panel__actions whoop-panel__actions--settings">
        {!connected ? (
          <button
            type="button"
            className="whoop-btn whoop-btn--primary"
            disabled={busy}
            onClick={() => void handleConnect()}
          >
            Подключить WHOOP
          </button>
        ) : (
          <>
            <button
              type="button"
              className="whoop-btn whoop-btn--primary"
              disabled={busy}
              onClick={() => void runSync()}
            >
              {busy ? "Синхронизация…" : "Обновить данные"}
            </button>
            <button
              type="button"
              className="whoop-btn whoop-btn--ghost"
              disabled={busy}
              onClick={() => void handleDisconnect()}
            >
              Отключить
            </button>
          </>
        )}
      </div>
    </div>
  );
}
