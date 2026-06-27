import { useWhoop } from "../hooks/useWhoop";
import { AthleteWeightDynamicsPanel } from "./AthleteWeightDynamicsPanel";
import { AthleteWorkoutDynamicsPanel } from "./AthleteWorkoutDynamicsPanel";
import { WhoopDashboard, WhoopDashboardHero } from "./WhoopDashboard";

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
  const refresh = () => void runSync();

  return (
    <>
      <AthleteWeightDynamicsPanel
        openFormSignal={openWeightFormSignal}
        onMeasurementAdded={onWeightMeasurementAdded}
      />
      <AthleteWorkoutDynamicsPanel />
      {connected ? (
        <div className="whoop-tab-content">
          {notice ? <p className="whoop-panel__notice whoop-tab-feedback">{notice}</p> : null}
          {error ? <p className="whoop-panel__error whoop-tab-feedback">{error}</p> : null}
          {loading ? <p className="text-muted whoop-tab-loading">Загрузка WHOOP…</p> : null}
          {!loading && hasDashboard && status?.last_sync ? (
            <WhoopDashboard
              data={status.last_sync}
              onRefresh={refresh}
              busy={busy}
              refreshDisabled={loading}
            />
          ) : null}
          {!loading && !hasDashboard ? (
            <div className="whoop-dashboard">
              <WhoopDashboardHero
                heading="Показатели ещё не загружены"
                onRefresh={refresh}
                busy={busy}
                refreshDisabled={loading}
              />
              <div className="whoop-panel__placeholder">
                <p>Нажмите иконку обновления, чтобы загрузить данные с WHOOP.</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
