import { useCallback, useEffect, useState } from "react";
import {
  fetchAdminMealCatalogStatus,
  startAdminMealCatalogRefresh,
  startAdminMealCatalogSync,
  startAdminMealCatalogTranslate,
} from "@sport-app/api-client";
import type { AdminMealCatalogStatus } from "@sport-app/shared";
import { formatMealCatalogSyncedAt, mealCatalogJobProgressPercent } from "@sport-app/shared";

import { MealCatalogDishesTable } from "./MealCatalogDishesTable";

export function MealCatalogPage() {
  const [status, setStatus] = useState<AdminMealCatalogStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [tableRefreshKey, setTableRefreshKey] = useState(0);

  const loadStatus = useCallback(async () => {
    try {
      const data = await fetchAdminMealCatalogStatus();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить статус каталога");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (status?.job.status !== "running") return;
    const timer = window.setInterval(() => {
      void loadStatus();
    }, 1500);
    return () => window.clearInterval(timer);
  }, [loadStatus, status?.job.status]);

  const runAction = async (action: () => Promise<void>) => {
    setActionBusy(true);
    setError(null);
    try {
      await action();
      await loadStatus();
      setTableRefreshKey((current) => current + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось запустить задачу");
    } finally {
      setActionBusy(false);
    }
  };

  const job = status?.job;
  const progress = job ? mealCatalogJobProgressPercent(job) : 0;
  const isRunning = job?.status === "running";

  return (
    <div className="admin-catalog">
      {loading ? <p className="text-muted">Загрузка…</p> : null}

      {status ? (
        <>
          <div className="admin-catalog__stats">
            <div className="admin-catalog__stat">
              <span className="admin-catalog__stat-label">Позиций в каталоге</span>
              <strong className="admin-catalog__stat-value">{status.dish_count}</strong>
            </div>
            <div className="admin-catalog__stat">
              <span className="admin-catalog__stat-label">С переводом</span>
              <strong className="admin-catalog__stat-value">{status.translated_count}</strong>
            </div>
            <div className="admin-catalog__stat">
              <span className="admin-catalog__stat-label">Без перевода</span>
              <strong className="admin-catalog__stat-value">{status.untranslated_count}</strong>
            </div>
            <div className="admin-catalog__stat">
              <span className="admin-catalog__stat-label">Обновлено</span>
              <strong className="admin-catalog__stat-value admin-catalog__stat-value--text">
                {formatMealCatalogSyncedAt(status.synced_at)}
              </strong>
            </div>
          </div>

          <p className="admin-catalog__hint text-secondary">
            Поиск у атлетов работает только по локальной базе. Синхронизация с LogMeal и перевод запускаются
            вручную — без лишних перезаписей при каждом перезапуске сервера.
          </p>

          {!status.translator_enabled ? (
            <p className="auth-error">
              Яндекс Translate не настроен — перевод названий недоступен (нужны ключи в .env API).
            </p>
          ) : null}

          <div className="admin-catalog__actions">
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              disabled={actionBusy || isRunning}
              onClick={() => void runAction(startAdminMealCatalogSync)}
            >
              Обновить из LogMeal
            </button>
            <button
              type="button"
              className="admin-btn"
              disabled={actionBusy || isRunning || !status.translator_enabled}
              onClick={() => void runAction(startAdminMealCatalogTranslate)}
            >
              Перевести названия
            </button>
            <button
              type="button"
              className="admin-btn"
              disabled={actionBusy || isRunning}
              onClick={() => void runAction(startAdminMealCatalogRefresh)}
            >
              Полное обновление
            </button>
          </div>

          {job && job.status !== "idle" ? (
            <div className="admin-catalog__job">
              <div className="admin-catalog__job-header">
                <strong>
                  {job.status === "running"
                    ? "Выполняется…"
                    : job.status === "completed"
                      ? "Готово"
                      : job.status === "failed"
                        ? "Ошибка"
                        : "Ожидание"}
                </strong>
                <span className="text-secondary">{job.message}</span>
              </div>
              {job.total > 0 ? (
                <div className="admin-catalog__progress" aria-hidden="true">
                  <div className="admin-catalog__progress-bar" style={{ width: `${progress}%` }} />
                </div>
              ) : null}
              {job.error ? <p className="auth-error">{job.error}</p> : null}
            </div>
          ) : null}

          <MealCatalogDishesTable
            refreshKey={tableRefreshKey}
            onDataChanged={() => {
              void loadStatus();
            }}
          />
        </>
      ) : null}

      {error ? <p className="auth-error">{error}</p> : null}
    </div>
  );
}
