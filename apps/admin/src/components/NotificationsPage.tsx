import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cancelAdminScheduledPush,
  createAdminScheduledPush,
  fetchAdminPushStats,
  fetchAdminScheduledPushes,
  sendAdminPushNow,
} from "@sport-app/api-client";
import {
  SCHEDULED_PUSH_STATUS_LABELS,
  type AdminPushStats,
  type AdminScheduledPush,
} from "@sport-app/shared";

function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationsPage() {
  const [stats, setStats] = useState<AdminPushStats | null>(null);
  const [scheduled, setScheduled] = useState<AdminScheduledPush[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [sendAt, setSendAt] = useState(() => {
    const next = new Date(Date.now() + 60 * 60 * 1000);
    return toLocalDateTimeInputValue(next);
  });

  const load = useCallback(async () => {
    try {
      const [nextStats, nextScheduled] = await Promise.all([
        fetchAdminPushStats(),
        fetchAdminScheduledPushes(),
      ]);
      setStats(nextStats);
      setScheduled(nextScheduled);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить оповещения");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const recentSubscribes = useMemo(() => {
    if (!stats) return 0;
    return stats.by_day.reduce((sum, day) => sum + day.subscription_count, 0);
  }, [stats]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      if (mode === "now") {
        const result = await sendAdminPushNow({
          title,
          body,
          url: url.trim() || "/",
        });
        const summary = `Отправлено: ${result.users_sent} из ${result.users_targeted} пользователей (${result.devices_sent} устройств)`;
        if (result.devices_sent === 0) {
          const detail = result.errors?.length ? result.errors.join(" ") : "Проверьте логи API и VAPID-ключи.";
          setError(`${summary}. ${detail}`);
          setSuccess(null);
        } else {
          setSuccess(summary);
        }
      } else {
        const local = new Date(sendAt);
        if (Number.isNaN(local.getTime())) {
          throw new Error("Укажите корректную дату и время");
        }
        await createAdminScheduledPush({
          title,
          body,
          url: url.trim() || "/",
          send_at: local.toISOString(),
        });
        setSuccess("Оповещение запланировано");
      }
      setTitle("");
      setBody("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить");
    } finally {
      setBusy(false);
    }
  };

  const cancelScheduled = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await cancelAdminScheduledPush(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отменить");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-catalog">
      {loading ? <p className="text-muted">Загрузка…</p> : null}
      {error ? <p className="auth-error">{error}</p> : null}
      {success ? <p className="admin-catalog__hint" style={{ color: "var(--color-success)" }}>{success}</p> : null}

      {stats ? (
        <>
          <div className="admin-catalog__stats">
            <div className="admin-catalog__stat">
              <span className="admin-catalog__stat-label">Подписок PWA</span>
              <strong className="admin-catalog__stat-value">{stats.subscription_count}</strong>
            </div>
            <div className="admin-catalog__stat">
              <span className="admin-catalog__stat-label">Пользователей</span>
              <strong className="admin-catalog__stat-value">{stats.user_count}</strong>
            </div>
            <div className="admin-catalog__stat">
              <span className="admin-catalog__stat-label">За 14 дней</span>
              <strong className="admin-catalog__stat-value">{recentSubscribes}</strong>
            </div>
            <div className="admin-catalog__stat">
              <span className="admin-catalog__stat-label">В очереди</span>
              <strong className="admin-catalog__stat-value">{stats.pending_scheduled_count}</strong>
            </div>
          </div>

          {!stats.vapid_configured ? (
            <p className="auth-error">
              VAPID не настроен — отправка недоступна. Добавьте VAPID_PUBLIC_KEY и VAPID_PRIVATE_KEY в
              infra/prod/.env.
            </p>
          ) : null}

          <p className="admin-catalog__hint text-secondary">
            Оповещения уходят на все активные Web Push-подписки атлетов. Запланированные отправляет worker
            каждую минуту.
          </p>

          <section className="admin-catalog__table-section">
            <div className="admin-catalog__table-header">
              <h3>Отправить оповещение</h3>
            </div>
            <form
              className="admin-form"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <div className="admin-field">
                <label htmlFor="push-title">Заголовок</label>
                <input
                  id="push-title"
                  type="text"
                  value={title}
                  maxLength={200}
                  required
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Например: Новости недели"
                />
              </div>
              <div className="admin-field">
                <label htmlFor="push-body">Текст</label>
                <textarea
                  id="push-body"
                  value={body}
                  maxLength={2000}
                  required
                  rows={4}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Короткое сообщение для атлетов"
                />
              </div>
              <div className="admin-field">
                <label htmlFor="push-url">Ссылка при клике</label>
                <input
                  id="push-url"
                  type="text"
                  value={url}
                  maxLength={512}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="/"
                />
                <span className="admin-field__hint">Относительный путь в приложении атлета, по умолчанию /</span>
              </div>

              <div className="admin-field-row">
                <label className="admin-field--checkbox">
                  <input
                    type="radio"
                    name="push-mode"
                    checked={mode === "now"}
                    onChange={() => setMode("now")}
                  />
                  Отправить сейчас
                </label>
                <label className="admin-field--checkbox">
                  <input
                    type="radio"
                    name="push-mode"
                    checked={mode === "schedule"}
                    onChange={() => setMode("schedule")}
                  />
                  Запланировать
                </label>
              </div>

              {mode === "schedule" ? (
                <div className="admin-field">
                  <label htmlFor="push-send-at">Дата и время</label>
                  <input
                    id="push-send-at"
                    type="datetime-local"
                    value={sendAt}
                    required
                    onChange={(event) => setSendAt(event.target.value)}
                  />
                </div>
              ) : null}

              <div className="admin-form__actions">
                <button
                  type="submit"
                  className="admin-btn admin-btn--primary"
                  disabled={busy || !stats.vapid_configured || !title.trim() || !body.trim()}
                >
                  {busy ? "Отправка…" : mode === "now" ? "Отправить сейчас" : "Запланировать"}
                </button>
              </div>
            </form>
          </section>

          <section className="admin-catalog__table-section">
            <div className="admin-catalog__table-header">
              <h3>Запланированные и недавние</h3>
              <button type="button" className="admin-btn" disabled={busy} onClick={() => void load()}>
                Обновить
              </button>
            </div>
            {scheduled.length === 0 ? (
              <p className="text-muted">Пока нет запланированных оповещений.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Когда</th>
                      <th>Заголовок</th>
                      <th>Статус</th>
                      <th>Результат</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {scheduled.map((item) => (
                      <tr key={item.id}>
                        <td>{formatDateTime(item.send_at)}</td>
                        <td>
                          <strong>{item.title}</strong>
                          <div className="text-secondary">{item.body}</div>
                        </td>
                        <td>{SCHEDULED_PUSH_STATUS_LABELS[item.status]}</td>
                        <td>
                          {item.status === "sent"
                            ? `${item.users_sent} польз. / ${item.devices_sent} уст.`
                            : item.error || "—"}
                        </td>
                        <td>
                          {item.status === "pending" ? (
                            <button
                              type="button"
                              className="admin-btn"
                              disabled={busy}
                              onClick={() => void cancelScheduled(item.id)}
                            >
                              Отменить
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
