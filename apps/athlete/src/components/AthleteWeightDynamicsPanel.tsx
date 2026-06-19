import { useCallback, useEffect, useMemo, useState } from "react";
import { addAthleteWeightMeasurement, fetchAthleteWeightDynamics } from "@sport-app/api-client";
import type { AthleteWeightDynamics, AthleteWeightEntry } from "@sport-app/shared";
import {
  computeWeightChartBounds,
  formatBirthDateDisplay,
  formatWeightChartDate,
  formatWeightKg,
  isValidWeightKg,
  parseWeightInput,
  weightToChartY,
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
} from "@sport-app/shared";

const CHART_WIDTH = 320;
const CHART_HEIGHT = 200;
const PLOT_LEFT = 40;
const PLOT_RIGHT = 308;
const PLOT_TOP = 16;
const PLOT_BOTTOM = 168;

interface ChartPoint {
  x: number;
  y: number;
  entry: AthleteWeightEntry;
}

function buildChartPoints(entries: AthleteWeightEntry[], bounds: NonNullable<ReturnType<typeof computeWeightChartBounds>>): ChartPoint[] {
  if (entries.length === 0) return [];
  const plotWidth = PLOT_RIGHT - PLOT_LEFT;
  const step = entries.length === 1 ? 0 : plotWidth / (entries.length - 1);

  return entries.map((entry, index) => ({
    entry,
    x: PLOT_LEFT + step * index,
    y: weightToChartY(entry.weight_kg, bounds, PLOT_TOP, PLOT_BOTTOM),
  }));
}

function buildSmoothLinePath(points: ChartPoint[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const following = points[index + 2] ?? next;

    const control1X = current.x + (next.x - previous.x) / 6;
    const control1Y = current.y + (next.y - previous.y) / 6;
    const control2X = next.x - (following.x - current.x) / 6;
    const control2Y = next.y - (following.y - current.y) / 6;

    path += ` C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${next.x} ${next.y}`;
  }
  return path;
}

function WeightChart({
  entries,
  targetMin,
  targetMax,
}: {
  entries: AthleteWeightEntry[];
  targetMin?: number | null;
  targetMax?: number | null;
}) {
  const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null);
  const bounds = useMemo(() => computeWeightChartBounds(entries), [entries]);
  const points = useMemo(
    () => (bounds ? buildChartPoints(entries, bounds) : []),
    [bounds, entries],
  );
  const linePath = useMemo(() => buildSmoothLinePath(points), [points]);

  if (!bounds || entries.length === 0) {
    return (
      <div className="weight-dynamics__chart-empty">
        <p className="text-secondary">Добавь первое измерение — график появится здесь.</p>
      </div>
    );
  }

  const hasTargetZone =
    targetMin != null && targetMax != null && targetMax >= targetMin;
  const targetTop = hasTargetZone
    ? weightToChartY(targetMax, bounds, PLOT_TOP, PLOT_BOTTOM)
    : null;
  const targetBottom = hasTargetZone
    ? weightToChartY(targetMin, bounds, PLOT_TOP, PLOT_BOTTOM)
    : null;
  const yTicks = [bounds.yMin, (bounds.yMin + bounds.yMax) / 2, bounds.yMax];

  return (
    <div className="weight-dynamics__chart-wrap">
      {hoveredPoint ? (
        <div
          className="weight-dynamics__tooltip"
          style={{
            left: `${(hoveredPoint.x / CHART_WIDTH) * 100}%`,
            top: `${(hoveredPoint.y / CHART_HEIGHT) * 100}%`,
          }}
        >
          {formatWeightKg(hoveredPoint.entry.weight_kg)} кг ·{" "}
          {formatBirthDateDisplay(hoveredPoint.entry.entry_date)}
        </div>
      ) : null}
      <svg
        className="weight-dynamics__chart"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label="График динамики веса"
        onMouseLeave={() => setHoveredPoint(null)}
      >
      {hasTargetZone && targetTop != null && targetBottom != null ? (
        <rect
          className="weight-dynamics__target-zone"
          x={PLOT_LEFT}
          y={targetTop}
          width={PLOT_RIGHT - PLOT_LEFT}
          height={Math.max(targetBottom - targetTop, 1)}
        />
      ) : null}

      {yTicks.map((tick) => {
        const y = weightToChartY(tick, bounds, PLOT_TOP, PLOT_BOTTOM);
        return (
          <g key={tick}>
            <line
              className="weight-dynamics__grid-line"
              x1={PLOT_LEFT}
              x2={PLOT_RIGHT}
              y1={y}
              y2={y}
            />
            <text className="weight-dynamics__axis-label weight-dynamics__axis-label--y" x={4} y={y + 4}>
              {formatWeightKg(tick)}
            </text>
          </g>
        );
      })}

      {points.length > 1 ? <path className="weight-dynamics__line" d={linePath} /> : null}

      {points.map((point) => {
        const isHovered = hoveredPoint?.entry.id === point.entry.id;
        return (
          <g key={point.entry.id}>
            <circle
              className="weight-dynamics__point-hit"
              cx={point.x}
              cy={point.y}
              r="12"
              tabIndex={0}
              onMouseEnter={() => setHoveredPoint(point)}
              onTouchStart={() => setHoveredPoint(point)}
              onFocus={() => setHoveredPoint(point)}
              onBlur={() => setHoveredPoint(null)}
            />
            <circle
              className={`weight-dynamics__point${isHovered ? " weight-dynamics__point--active" : ""}`}
              cx={point.x}
              cy={point.y}
              r={isHovered ? 4 : 3}
            />
            <text
              className="weight-dynamics__axis-label weight-dynamics__axis-label--x"
              x={point.x}
              y={CHART_HEIGHT - 6}
              textAnchor="middle"
            >
              {formatWeightChartDate(point.entry.entry_date)}
            </text>
          </g>
        );
      })}
      </svg>
    </div>
  );
}

export function AthleteWeightDynamicsPanel({
  openFormSignal = 0,
  onMeasurementAdded,
}: {
  /** Инкремент открывает форму (например, переход из «Добавить тренировку»). */
  openFormSignal?: number;
  onMeasurementAdded?: () => void;
} = {}) {
  const [data, setData] = useState<AthleteWeightDynamics | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [weightInput, setWeightInput] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchAthleteWeightDynamics();
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить динамику веса");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (openFormSignal > 0) {
      setShowForm(true);
      setError(null);
    }
  }, [openFormSignal]);

  const handleAddMeasurement = async () => {
    const parsed = parseWeightInput(weightInput);
    if (parsed == null) {
      setError("Введите вес в килограммах");
      return;
    }
    if (!isValidWeightKg(parsed)) {
      setError(`Вес должен быть от ${WEIGHT_KG_MIN} до ${WEIGHT_KG_MAX} кг`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const next = await addAthleteWeightMeasurement({ weight_kg: parsed });
      setData(next);
      setWeightInput("");
      setShowForm(false);
      onMeasurementAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить измерение");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="weight-dynamics glass glass--panel">
      <div className="weight-dynamics__header">
        <h2 className="weight-dynamics__title">Динамика веса</h2>
        {data?.current_weight_kg != null ? (
          <p className="weight-dynamics__current">
            Сейчас <strong>{formatWeightKg(data.current_weight_kg)} кг</strong>
          </p>
        ) : null}
      </div>

      {loading ? <p className="text-muted">Загрузка…</p> : null}
      {!loading && data ? (
        <WeightChart
          entries={data.entries}
          targetMin={data.weight_target_min_kg}
          targetMax={data.weight_target_max_kg}
        />
      ) : null}

      {data?.weight_target_min_kg != null && data?.weight_target_max_kg != null ? (
        <p className="weight-dynamics__target-hint text-secondary">
          Целевой диапазон: {formatWeightKg(data.weight_target_min_kg)}–{formatWeightKg(data.weight_target_max_kg)} кг
        </p>
      ) : null}

      {showForm ? (
        <div className="weight-dynamics__form">
          <label className="weight-dynamics__field">
            <span className="weight-dynamics__label text-secondary">Вес, кг</span>
            <input
              type="text"
              inputMode="decimal"
              className="weight-dynamics__input"
              placeholder="72,4"
              value={weightInput}
              disabled={busy}
              onChange={(event) => setWeightInput(event.target.value)}
            />
          </label>
          <div className="weight-dynamics__form-actions">
            <button
              type="button"
              className="btn btn-outline btn-outline--primary"
              disabled={busy}
              onClick={() => void handleAddMeasurement()}
            >
              {busy ? "Сохраняем…" : "Добавить"}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={() => {
                setShowForm(false);
                setWeightInput("");
                setError(null);
              }}
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-outline btn-outline--primary btn--block"
          disabled={loading || busy}
          onClick={() => setShowForm(true)}
        >
          Добавить измерение
        </button>
      )}

      {error ? <p className="auth-error weight-dynamics__error">{error}</p> : null}
    </section>
  );
}
