export const WEIGHT_KG_MIN = 20;
export const WEIGHT_KG_MAX = 300;
export const WEIGHT_CHART_PADDING_KG = 2;
export const WEIGHT_CHART_ENTRY_LIMIT = 10;

export interface AthleteWeightEntry {
  id: string;
  entry_date: string;
  weight_kg: number;
}

export interface AthleteWeightDynamics {
  entries: AthleteWeightEntry[];
  current_weight_kg?: number | null;
  weight_target_min_kg?: number | null;
  weight_target_max_kg?: number | null;
}

export interface AthleteWeightMeasurementPayload {
  weight_kg: number;
}

export function parseWeightInput(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  return value;
}

export function isValidWeightKg(value: number): boolean {
  return value >= WEIGHT_KG_MIN && value <= WEIGHT_KG_MAX;
}

export function formatWeightKg(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1).replace(".", ",");
}

export function formatWeightMeasurementDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Chart axis label: 14.05 */
export function formatWeightChartDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}`;
}

export interface WeightChartBounds {
  yMin: number;
  yMax: number;
}

export function computeWeightChartBounds(entries: AthleteWeightEntry[]): WeightChartBounds | null {
  if (entries.length === 0) return null;

  let dataMin = entries[0].weight_kg;
  let dataMax = entries[0].weight_kg;
  for (const entry of entries) {
    dataMin = Math.min(dataMin, entry.weight_kg);
    dataMax = Math.max(dataMax, entry.weight_kg);
  }

  return {
    yMin: dataMin - WEIGHT_CHART_PADDING_KG,
    yMax: dataMax + WEIGHT_CHART_PADDING_KG,
  };
}

export function weightToChartY(
  weightKg: number,
  bounds: WeightChartBounds,
  chartTop: number,
  chartBottom: number,
): number {
  const span = bounds.yMax - bounds.yMin;
  if (span <= 0) return (chartTop + chartBottom) / 2;
  const ratio = (weightKg - bounds.yMin) / span;
  return chartBottom - ratio * (chartBottom - chartTop);
}
