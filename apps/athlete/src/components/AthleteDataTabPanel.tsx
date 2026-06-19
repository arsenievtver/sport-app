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
  const { status, loading } = useWhoop();
  const connected = Boolean(status?.connected);
  const hasDashboard = connected && Boolean(status?.last_sync);

  return (
    <>
      <AthleteWeightDynamicsPanel
        openFormSignal={openWeightFormSignal}
        onMeasurementAdded={onWeightMeasurementAdded}
      />
      {connected ? (
        <section className="whoop-panel whoop-panel--tab">
          {loading ? <p className="text-muted">Загрузка WHOOP…</p> : null}
          {!loading && hasDashboard && status?.last_sync ? (
            <WhoopDashboard data={status.last_sync} />
          ) : null}
          {!loading && !hasDashboard ? (
            <div className="whoop-panel__placeholder">
              <p>Нажмите «Обновить данные» в настройках WHOOP, чтобы загрузить показатели.</p>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
