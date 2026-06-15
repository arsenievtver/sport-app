import { useWhoop } from "../hooks/useWhoop";
import { WhoopDashboard } from "./WhoopDashboard";

export function WhoopHomePanel() {
  const { status, loading, busy, error, notice, runSync } = useWhoop();

  if (loading || !status?.connected) {
    return null;
  }

  const hasDashboard = Boolean(status.last_sync);

  return (
    <section className="whoop-panel whoop-panel--home">
      <div className="whoop-panel__header">
        <div>
          <h2 className="whoop-panel__title">WHOOP</h2>
          {notice ? <p className="whoop-panel__notice">{notice}</p> : null}
          {error ? <p className="whoop-panel__error">{error}</p> : null}
        </div>
        <button
          type="button"
          className="whoop-btn whoop-btn--primary whoop-btn--compact"
          disabled={busy}
          onClick={() => void runSync()}
        >
          {busy ? "…" : "Обновить"}
        </button>
      </div>

      {hasDashboard && status.last_sync ? (
        <WhoopDashboard data={status.last_sync} />
      ) : (
        <div className="whoop-panel__placeholder">
          <p>Нажмите «Обновить», чтобы загрузить данные.</p>
          <button type="button" className="whoop-btn whoop-btn--primary" disabled={busy} onClick={() => void runSync()}>
            {busy ? "Загрузка…" : "Загрузить данные"}
          </button>
        </div>
      )}
    </section>
  );
}
