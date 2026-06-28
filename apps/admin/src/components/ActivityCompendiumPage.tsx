import { useCallback, useEffect, useState } from "react";
import {
  fetchAdminActivityCompendiumStatus,
  startAdminActivityCompendiumTranslate,
} from "@sport-app/api-client";
import type { AdminActivityCompendiumStatus } from "@sport-app/shared";
import {
  activityCompendiumJobProgressPercent,
  formatActivityCompendiumImportedAt,
} from "@sport-app/shared";

import { ActivityCompendiumTable } from "./ActivityCompendiumTable";
import { ActivityCreateModal } from "./ActivityCreateModal";
import { ActivityGroupCreateModal } from "./ActivityGroupCreateModal";
import { ActivityGroupRenameModal } from "./ActivityGroupRenameModal";

export function ActivityCompendiumPage() {
  const [status, setStatus] = useState<AdminActivityCompendiumStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [tableRefreshKey, setTableRefreshKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [renameGroupOpen, setRenameGroupOpen] = useState(false);

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
            Справочник загружен на сервер. Добавляйте и правьте позиции вручную: группа, названия, MET и
            видимость для атлетов. Массовый импорт PDF — только через API/скрипт для повторной загрузки
            Compendium.
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
              onClick={() => setCreateGroupOpen(true)}
            >
              Создать группу
            </button>
            <button
              type="button"
              className="admin-btn"
              disabled={actionBusy || isRunning}
              onClick={() => setCreateOpen(true)}
            >
              Добавить активность
            </button>
            <button
              type="button"
              className="admin-btn"
              disabled={actionBusy || isRunning || status.major_headings.length === 0}
              onClick={() => setRenameGroupOpen(true)}
            >
              Изменить группу
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
            headingLabels={status.major_heading_labels ?? {}}
            onDataChanged={() => {
              void loadStatus();
            }}
          />

          {createGroupOpen ? (
            <ActivityGroupCreateModal
              majorHeadings={status.major_headings}
              headingLabels={status.major_heading_labels ?? {}}
              translatorEnabled={status.translator_enabled}
              onClose={() => setCreateGroupOpen(false)}
              onCreated={() => {
                setCreateGroupOpen(false);
                void loadStatus();
                setTableRefreshKey((current) => current + 1);
              }}
            />
          ) : null}

          {createOpen ? (
            <ActivityCreateModal
              majorHeadings={status.major_headings}
              headingLabels={status.major_heading_labels ?? {}}
              onClose={() => setCreateOpen(false)}
              onCreated={() => {
                setCreateOpen(false);
                void loadStatus();
                setTableRefreshKey((current) => current + 1);
              }}
            />
          ) : null}

          {renameGroupOpen ? (
            <ActivityGroupRenameModal
              majorHeadings={status.major_headings}
              headingLabels={status.major_heading_labels ?? {}}
              onClose={() => setRenameGroupOpen(false)}
              onChanged={() => {
                setRenameGroupOpen(false);
                void loadStatus();
                setTableRefreshKey((current) => current + 1);
              }}
            />
          ) : null}
        </>
      ) : null}

      {error ? <p className="auth-error">{error}</p> : null}
    </div>
  );
}
