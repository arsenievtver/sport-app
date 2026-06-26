import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAdminActivityCompendiumStatus,
  importAdminActivityCompendiumPdf,
  startAdminActivityCompendiumTranslate,
} from "@sport-app/api-client";
import type { AdminActivityCompendiumStatus } from "@sport-app/shared";
import {
  activityCompendiumJobProgressPercent,
  formatActivityCompendiumImportedAt,
} from "@sport-app/shared";

import { ActivityCompendiumTable } from "./ActivityCompendiumTable";

export function ActivityCompendiumPage() {
  const [status, setStatus] = useState<AdminActivityCompendiumStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [tableRefreshKey, setTableRefreshKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStatus = useCallback(async () => {
    try {
      const data = await fetchAdminActivityCompendiumStatus();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить статус справочника");
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
      setError(err instanceof Error ? err.message : "Не удалось выполнить действие");
    } finally {
      setActionBusy(false);
    }
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setActionBusy(true);
    setError(null);
    try {
      const result = await importAdminActivityCompendiumPdf(file);
      await loadStatus();
      setTableRefreshKey((current) => current + 1);
      setError(null);
      if (result.activity_count) {
        // status polling will show job progress
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить PDF");
    } finally {
      setActionBusy(false);
    }
  };

  const job = status?.job;
  const progress = job ? activityCompendiumJobProgressPercent(job) : 0;
  const isRunning = job?.status === "running";

  return (
    <div className="admin-catalog">
      {loading ? <p className="text-muted">Загрузка…</p> : null}

      {status ? (
        <>
          <div className="admin-catalog__stats">
            <div className="admin-catalog__stat">
              <span className="admin-catalog__stat-label">Активностей в базе</span>
              <strong className="admin-catalog__stat-value">{status.activity_count}</strong>
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
              <span className="admin-catalog__stat-label">Загружено</span>
              <strong className="admin-catalog__stat-value admin-catalog__stat-value--text">
                {formatActivityCompendiumImportedAt(status.imported_at)}
              </strong>
            </div>
          </div>

          <p className="admin-catalog__hint text-secondary">
            Загрузите PDF «2024 Adult Compendium of Physical Activities» — данные импортируются в боевую базу,
            затем автоматически переводятся через Яндекс Translate. Новые активности по умолчанию скрыты от
            атлетов; включайте вручную нужные позиции.
          </p>

          {!status.translator_enabled ? (
            <p className="auth-error">
              Яндекс Translate не настроен — перевод названий недоступен (нужны ключи в .env API).
            </p>
          ) : null}

          <div className="admin-catalog__actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(event) => void handleFileSelected(event)}
            />
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              disabled={actionBusy || isRunning}
              onClick={() => fileInputRef.current?.click()}
            >
              Загрузить справочник (PDF)
            </button>
            <button
              type="button"
              className="admin-btn"
              disabled={actionBusy || isRunning || !status.translator_enabled}
              onClick={() => void runAction(startAdminActivityCompendiumTranslate)}
            >
              Перевести названия
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

          <ActivityCompendiumTable
            refreshKey={tableRefreshKey}
            majorHeadings={status.major_headings}
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
