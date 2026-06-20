import { useWhoop } from "../hooks/useWhoop";
import { AthleteWeightDynamicsPanel } from "./AthleteWeightDynamicsPanel";
import { WhoopDashboard } from "./WhoopDashboard";

export function AthleteDataTabPanel({
  openWeightFormSignal = 0,
  onWeightMeasurementAdded,
}: {
  openWeightFormSignal?: number;
  onWeightMeasurementAdded?: () => void;
} = {}) {
  const { status, loading, busy, error, notice, runSync } = useWhoop();
  const connected = Boolean(status?.connected);
  const hasDashboard = connected && Boolean(status?.last_sync);

  return (
    <>
      <AthleteWeightDynamicsPanel
        openFormSignal={openWeightFormSignal}
        onMeasurementAdded={onWeightMeasurementAdded}
      />
      {connected ? (
        <>
          <div className="whoop-tab-toolbar">
            <button
              type="button"
              className="whoop-btn whoop-btn--primary whoop-btn--compact"
              disabled={busy || loading}
              onClick={() => void runSync()}
            >
              {busy ? "Синхронизация…" : "Обновить данные WHOOP"}
            </button>
          </div>
          {notice ? <p className="whoop-panel__notice whoop-tab-feedback">{notice}</p> : null}
          {error ? <p className="whoop-panel__error whoop-tab-feedback">{error}</p> : null}
          {loading ? <p className="text-muted">Загрузка WHOOP…</p> : null}
          {!loading && hasDashboard && status?.last_sync ? (
            <WhoopDashboard data={status.last_sync} />
          ) : null}
          {!loading && !hasDashboard ? (
            <div className="whoop-panel__placeholder">
              <p>Нажмите «Обновить данные WHOOP», чтобы загрузить показатели.</p>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
