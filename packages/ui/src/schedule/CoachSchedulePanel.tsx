import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import {
  clearCoachScheduleWeekSlot,
  fetchCoachAthletes,
  fetchCoachScheduleTemplate,
  fetchCoachScheduleWeek,
  moveCoachScheduleWeekSlot,
  resolveMediaUrl,
  setCoachScheduleSlot,
  updateCoachScheduleSettings,
} from "@sport-app/api-client";
import type { CoachAthleteSummary, CoachScheduleSettings, ScheduleGridResponse, ScheduleSlotCell } from "@sport-app/shared";
import {
  addDays,
  formatScheduleSlotContext,
  formatWeekRange,
  mondayOfWeek,
  scheduleCellKey,
  toIsoDate,
} from "@sport-app/shared";

import { CoachScheduleSettingsForm } from "./CoachScheduleSettingsForm";
import { useLiveDataRefresh } from "../hooks/useLiveDataRefresh";

type ScheduleMode = "week" | "template";

interface SelectedCell {
  dayOfWeek: number;
  startTime: string;
  date: string | null;
  athleteName: string | null;
}

interface MoveSource {
  dayOfWeek: number;
  startTime: string;
  date: string;
  athleteName: string;
}

const LONG_PRESS_MS = 450;

function buildCellMap(cells: ScheduleSlotCell[]): Map<string, ScheduleSlotCell> {
  const map = new Map<string, ScheduleSlotCell>();
  for (const cell of cells) {
    map.set(scheduleCellKey(cell.day_of_week, cell.start_time, cell.date), cell);
  }
  return map;
}

export function CoachSchedulePanel() {
  const [mode, setMode] = useState<ScheduleMode>("week");
  const [weekMonday, setWeekMonday] = useState(() => mondayOfWeek(new Date()));
  const [grid, setGrid] = useState<ScheduleGridResponse | null>(null);
  const [athletes, setAthletes] = useState<CoachAthleteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [moveSource, setMoveSource] = useState<MoveSource | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const longPressCell = useRef<SelectedCell | null>(null);

  const loadGrid = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const data =
        mode === "template"
          ? await fetchCoachScheduleTemplate()
          : await fetchCoachScheduleWeek(toIsoDate(weekMonday));
      setGrid(data);
    } catch (err) {
      if (!options?.silent) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить расписание");
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [mode, weekMonday]);

  const refreshGrid = useCallback(() => loadGrid({ silent: true }), [loadGrid]);

  useEffect(() => {
    void loadGrid();
  }, [loadGrid]);

  useLiveDataRefresh(refreshGrid);

  useEffect(() => {
    void fetchCoachAthletes()
      .then(setAthletes)
      .catch(() => setAthletes([]));
  }, []);

  const cellMap = useMemo(() => (grid ? buildCellMap(grid.cells) : new Map()), [grid]);

  const weekLabel =
    grid?.week_start && grid.week_end ? formatWeekRange(grid.week_start, grid.week_end) : null;

  const handleModeChange = (nextMode: ScheduleMode) => {
    if (nextMode === "week") {
      setWeekMonday(mondayOfWeek(new Date()));
    }
    setMode(nextMode);
    setMoveSource(null);
    setSelectedCell(null);
  };

  const handleAssign = async (athleteId: string) => {
    if (!selectedCell || !grid) return;
    setSaving(true);
    setError(null);
    try {
      const response = await setCoachScheduleSlot({
        day_of_week: selectedCell.dayOfWeek,
        start_time: selectedCell.startTime,
        athlete_id: athleteId,
        occurrence_date: mode === "week" ? selectedCell.date : null,
      });
      setGrid(response);
      setSelectedCell(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось назначить атлета");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!selectedCell || !grid) return;
    setSaving(true);
    setError(null);
    try {
      let response: ScheduleGridResponse;
      if (mode === "week" && selectedCell.date) {
        if (selectedCell.athleteName) {
          response = await setCoachScheduleSlot({
            day_of_week: selectedCell.dayOfWeek,
            start_time: selectedCell.startTime,
            athlete_id: null,
            occurrence_date: selectedCell.date,
          });
        } else {
          response = await clearCoachScheduleWeekSlot({
            date: selectedCell.date,
            start_time: selectedCell.startTime,
          });
        }
      } else {
        response = await setCoachScheduleSlot({
          day_of_week: selectedCell.dayOfWeek,
          start_time: selectedCell.startTime,
          athlete_id: null,
        });
      }
      setGrid(response);
      setSelectedCell(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось очистить слот");
    } finally {
      setSaving(false);
    }
  };

  const handleStartMove = () => {
    if (!selectedCell?.date || !selectedCell.athleteName) return;
    setMoveSource({
      dayOfWeek: selectedCell.dayOfWeek,
      startTime: selectedCell.startTime,
      date: selectedCell.date,
      athleteName: selectedCell.athleteName,
    });
    setSelectedCell(null);
  };

  const handleMoveTarget = async (day: { day_of_week: number; date: string | null }, startTime: string) => {
    if (!moveSource || mode !== "week" || !day.date) return;
    if (moveSource.date === day.date && moveSource.startTime === startTime) {
      setMoveSource(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await moveCoachScheduleWeekSlot({
        from_date: moveSource.date,
        from_time: moveSource.startTime,
        to_date: day.date,
        to_time: startTime,
      });
      setGrid(response);
      setMoveSource(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось перенести");
    } finally {
      setSaving(false);
    }
  };

  const openCell = (cell: ScheduleSlotCell) => {
    if (moveSource && mode === "week" && cell.date) {
      const targetCell = cellMap.get(scheduleCellKey(cell.day_of_week, cell.start_time, cell.date));
      if (!targetCell?.athlete) {
        void handleMoveTarget({ day_of_week: cell.day_of_week, date: cell.date }, cell.start_time);
      }
      return;
    }

    setSelectedCell({
      dayOfWeek: cell.day_of_week,
      startTime: cell.start_time,
      date: cell.date,
      athleteName: cell.athlete?.display_name ?? null,
    });
  };

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressCell.current = null;
  };

  const startLongPress = (cell: ScheduleSlotCell, event: PointerEvent<HTMLButtonElement>) => {
    if (mode !== "week" || !cell.date || !cell.athlete) return;
    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    clearLongPress();
    longPressCell.current = {
      dayOfWeek: cell.day_of_week,
      startTime: cell.start_time,
      date: cell.date,
      athleteName: cell.athlete.display_name,
    };
    longPressTimer.current = window.setTimeout(() => {
      if (!longPressCell.current?.date) return;
      setMoveSource({
        dayOfWeek: longPressCell.current.dayOfWeek,
        startTime: longPressCell.current.startTime,
        date: longPressCell.current.date,
        athleteName: longPressCell.current.athleteName ?? "",
      });
      setSelectedCell(null);
      window.getSelection()?.removeAllRanges();
      if (navigator.vibrate) navigator.vibrate(20);
      clearLongPress();
    }, LONG_PRESS_MS);
  };

  const handleSettingsSave = async (settings: CoachScheduleSettings) => {
    setSaving(true);
    setError(null);
    try {
      await updateCoachScheduleSettings(settings);
      setSettingsOpen(false);
      await loadGrid();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить настройки");
    } finally {
      setSaving(false);
    }
  };

  let panelContent;

  if (loading && !grid) {
    panelContent = <p className="text-muted">Загрузка расписания…</p>;
  } else if (!grid) {
    panelContent = <p className="schedule-message schedule-message--error">{error ?? "Расписание недоступно"}</p>;
  } else {
    panelContent = (
      <div className="schedule-panel">
        <div className="schedule-toolbar">
          <div className="schedule-mode-toggle glass glass--panel">
            <button
              type="button"
              className={`schedule-mode-toggle__btn${mode === "week" ? " schedule-mode-toggle__btn--active" : ""}`}
              onClick={() => handleModeChange("week")}
            >
              Неделя
            </button>
            <button
              type="button"
              className={`schedule-mode-toggle__btn${mode === "template" ? " schedule-mode-toggle__btn--active" : ""}`}
              onClick={() => handleModeChange("template")}
            >
              Шаблон
            </button>
          </div>

          {mode === "week" ? (
            <div className="schedule-week-nav">
              <button
                type="button"
                className="schedule-week-nav__btn"
                aria-label="Предыдущая неделя"
                onClick={() => setWeekMonday((prev) => addDays(prev, -7))}
              >
                ←
              </button>
              <div className="schedule-week-nav__label">{weekLabel}</div>
              <button
                type="button"
                className="schedule-week-nav__btn"
                aria-label="Следующая неделя"
                onClick={() => setWeekMonday((prev) => addDays(prev, 7))}
              >
                →
              </button>
              <button
                type="button"
                className="schedule-settings-btn"
                aria-label="Настройки сетки"
                onClick={() => setSettingsOpen(true)}
              >
                ⚙
              </button>
            </div>
          ) : (
            <div className="schedule-week-nav">
              <p className="schedule-hint" style={{ flex: 1, margin: 0 }}>
                Шаблон повторяется каждую неделю
              </p>
              <button
                type="button"
                className="schedule-settings-btn"
                aria-label="Настройки сетки"
                onClick={() => setSettingsOpen(true)}
              >
                ⚙
              </button>
            </div>
          )}

          {moveSource ? (
            <p className="schedule-hint">
              Перенос: {moveSource.athleteName}. Выберите свободный слот или{" "}
              <button type="button" className="settings-link" onClick={() => setMoveSource(null)}>
                отмена
              </button>
            </p>
          ) : (
            <p className="schedule-hint">
              {mode === "week"
                ? "Тап — назначить. Удержание занятого слота — перенос на эту неделю."
                : "Тап по ячейке — назначить атлета в шаблон."}
            </p>
          )}
        </div>

        {error ? <p className="schedule-message schedule-message--error">{error}</p> : null}

        <div className="schedule-grid-wrap glass glass--panel">
          <div className="schedule-grid-scroll">
            <div
              className="schedule-grid"
              style={{ "--schedule-day-count": grid.days.length } as CSSProperties}
            >
              <div className="schedule-grid__corner" />
              {grid.days.map((day) => (
                <div key={`${day.day_of_week}-${day.date ?? "t"}`} className="schedule-grid__day">
                  <span>{day.label}</span>
                </div>
              ))}

              {grid.time_slots.map((startTime) => (
                <ScheduleGridRow
                  key={startTime}
                  startTime={startTime}
                  days={grid.days}
                  cellMap={cellMap}
                  moveSource={moveSource}
                  onOpen={openCell}
                  onLongPressStart={startLongPress}
                  onLongPressEnd={clearLongPress}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {panelContent}

      {selectedCell ? (
        <ScheduleAthleteSheet
          athletes={athletes}
          mode={mode}
          dayOfWeek={selectedCell.dayOfWeek}
          startTime={selectedCell.startTime}
          date={selectedCell.date}
          occupied={Boolean(selectedCell.athleteName)}
          canMove={mode === "week" && Boolean(selectedCell.athleteName && selectedCell.date)}
          saving={saving}
          onAssign={handleAssign}
          onClear={handleClear}
          onMove={handleStartMove}
          onClose={() => setSelectedCell(null)}
        />
      ) : null}

      {settingsOpen && grid ? (
        <ScheduleSettingsSheet
          settings={grid.settings}
          saving={saving}
          onSave={handleSettingsSave}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </>
  );
}

function ScheduleGridRow({
  startTime,
  days,
  cellMap,
  moveSource,
  onOpen,
  onLongPressStart,
  onLongPressEnd,
}: {
  startTime: string;
  days: ScheduleGridResponse["days"];
  cellMap: Map<string, ScheduleSlotCell>;
  moveSource: MoveSource | null;
  onOpen: (cell: ScheduleSlotCell) => void;
  onLongPressStart: (cell: ScheduleSlotCell, event: PointerEvent<HTMLButtonElement>) => void;
  onLongPressEnd: () => void;
}) {
  return (
    <>
      <div className="schedule-grid__time">{startTime}</div>
      {days.map((day) => {
        const cell = cellMap.get(scheduleCellKey(day.day_of_week, startTime, day.date));
        if (!cell) return <div key={`${day.day_of_week}-${startTime}`} className="schedule-cell" />;

        const isMoveSource =
          moveSource &&
          moveSource.dayOfWeek === cell.day_of_week &&
          moveSource.startTime === cell.start_time &&
          moveSource.date === cell.date;
        const isMoveTarget = moveSource && !cell.athlete;
        const className = [
          "schedule-cell",
          cell.athlete ? "schedule-cell--occupied" : "schedule-cell--empty",
          cell.is_exception ? "schedule-cell--exception" : "",
          isMoveSource ? "schedule-cell--move-source" : "",
          isMoveTarget ? "schedule-cell--move-target" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div key={`${day.day_of_week}-${startTime}-${day.date ?? "t"}`} className={className}>
            <button
              type="button"
              className="schedule-cell__btn"
              onClick={() => onOpen(cell)}
              onPointerDown={(event) => onLongPressStart(cell, event)}
              onPointerUp={onLongPressEnd}
              onPointerLeave={onLongPressEnd}
              onPointerCancel={onLongPressEnd}
              onContextMenu={(event) => event.preventDefault()}
            >
              {cell.athlete ? (
                <span className="schedule-cell__name">{cell.athlete.display_name}</span>
              ) : (
                <span className="schedule-cell__plus" aria-hidden="true">
                  +
                </span>
              )}
            </button>
          </div>
        );
      })}
    </>
  );
}

function ScheduleAthleteSheet({
  athletes,
  mode,
  dayOfWeek,
  startTime,
  date,
  occupied,
  canMove,
  saving,
  onAssign,
  onClear,
  onMove,
  onClose,
}: {
  athletes: CoachAthleteSummary[];
  mode: ScheduleMode;
  dayOfWeek: number;
  startTime: string;
  date: string | null;
  occupied: boolean;
  canMove: boolean;
  saving: boolean;
  onAssign: (athleteId: string) => void;
  onClear: () => void;
  onMove: () => void;
  onClose: () => void;
}) {
  const slotContext = formatScheduleSlotContext(mode, dayOfWeek, startTime, date);

  return (
    <div className="schedule-sheet-backdrop" onClick={onClose}>
      <div className="schedule-sheet glass glass--panel" onClick={(event) => event.stopPropagation()}>
        <div className="schedule-sheet__header">
          <div className="schedule-sheet__heading">
            <h2 className="schedule-sheet__title">{occupied ? "Слот" : "Выберите атлета"}</h2>
            <p className="schedule-sheet__subtitle">{slotContext}</p>
          </div>
          <button type="button" className="schedule-sheet__close" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        {!occupied ? (
          <div className="schedule-sheet__list">
            {athletes.length === 0 ? (
              <p className="text-muted" style={{ padding: "var(--space-4)" }}>
                Нет атлетов. Добавьте на вкладке «Атлеты».
              </p>
            ) : (
              athletes.map((athlete) => {
                const avatarUrl = resolveMediaUrl(athlete.avatar_url);
                const initial = (athlete.display_name?.slice(0, 1) ?? "?").toUpperCase();
                return (
                  <button
                    key={athlete.athlete_id}
                    type="button"
                    className="schedule-sheet__athlete"
                    disabled={saving}
                    onClick={() => onAssign(athlete.athlete_id)}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="schedule-sheet__avatar" />
                    ) : (
                      <span className="schedule-sheet__avatar schedule-sheet__avatar--placeholder">{initial}</span>
                    )}
                    <span>{athlete.display_name}</span>
                  </button>
                );
              })
            )}
          </div>
        ) : null}

        {occupied ? (
          <div className="schedule-sheet__actions">
            <button type="button" className="schedule-sheet__action" disabled={saving} onClick={onClear}>
              Убрать из слота
            </button>
            {canMove ? (
              <button type="button" className="schedule-sheet__action" disabled={saving} onClick={onMove}>
                Перенести на эту неделю
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ScheduleSettingsSheet({
  settings,
  saving,
  onSave,
  onClose,
}: {
  settings: CoachScheduleSettings;
  saving: boolean;
  onSave: (settings: CoachScheduleSettings) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="schedule-sheet-backdrop" onClick={onClose}>
      <div className="schedule-sheet glass glass--panel" onClick={(event) => event.stopPropagation()}>
        <div className="schedule-sheet__header">
          <h2 className="schedule-sheet__title">Настройки сетки</h2>
          <button type="button" className="schedule-sheet__close" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <div className="schedule-sheet__body">
          <CoachScheduleSettingsForm settings={settings} saving={saving} onSave={onSave} />
        </div>
      </div>
    </div>
  );
}
