import { useEffect, useMemo, useState } from "react";
import { fetchCoachAthletes } from "@sport-app/api-client";
import { buildAthleteInviteUrl, buildInviteShareMessage, type CoachAthleteSummary } from "@sport-app/shared";
import QRCode from "qrcode";

interface CoachInvitePanelProps {
  inviteCode: string;
  coachName: string;
  athleteAppBaseUrl: string;
}

const NEW_ATHLETE_VALUE = "";

export function CoachInvitePanel({ inviteCode, coachName, athleteAppBaseUrl }: CoachInvitePanelProps) {
  const [managedAthletes, setManagedAthletes] = useState<CoachAthleteSummary[]>([]);
  const [loadingAthletes, setLoadingAthletes] = useState(true);
  const [selectedAthleteId, setSelectedAthleteId] = useState(NEW_ATHLETE_VALUE);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchCoachAthletes()
      .then((athletes) => {
        if (cancelled) return;
        const withoutApp = athletes.filter((athlete) => !athlete.has_app);
        setManagedAthletes(withoutApp);
        if (withoutApp.length > 0) {
          setSelectedAthleteId(withoutApp[0].athlete_id);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось загрузить список атлетов");
      })
      .finally(() => {
        if (!cancelled) setLoadingAthletes(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedAthlete = useMemo(
    () => managedAthletes.find((athlete) => athlete.athlete_id === selectedAthleteId) ?? null,
    [managedAthletes, selectedAthleteId],
  );

  const claimAthleteId = selectedAthleteId || null;
  const inviteUrl = buildAthleteInviteUrl(inviteCode, athleteAppBaseUrl, claimAthleteId);
  const shareMessage = buildInviteShareMessage(inviteUrl, coachName, selectedAthlete?.display_name);

  useEffect(() => {
    let cancelled = false;
    setQrDataUrl(null);
    void QRCode.toDataURL(inviteUrl, {
      margin: 1,
      width: 512,
      color: { dark: "#050508", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось сформировать QR-код");
      });
    return () => {
      cancelled = true;
    };
  }, [inviteUrl]);

  const showStatus = (message: string) => {
    setStatus(message);
    setError(null);
    window.setTimeout(() => setStatus(null), 2500);
  };

  const handleShare = async () => {
    setError(null);
    try {
      if (navigator.share) {
        await navigator.share({
          title: "sport-app",
          text: shareMessage,
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareMessage);
        showStatus("Ссылка скопирована — вставь в мессенджер");
        return;
      }

      setError("Поделиться не удалось — скопируй ссылку вручную");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Не удалось поделиться");
    }
  };

  const handleCopyLink = async () => {
    setError(null);
    try {
      if (!navigator.clipboard?.writeText) {
        setError("Копирование недоступно в этом браузере");
        return;
      }
      await navigator.clipboard.writeText(inviteUrl);
      showStatus("Ссылка скопирована");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось скопировать ссылку");
    }
  };

  return (
    <div className="invite-page">
      <p className="invite-page__lead">
        Выбери атлета из списка — ссылка и QR будут персональными. Атлет зарегистрируется и сразу
        привяжется к своему профилю с историей тренировок.
      </p>

      {loadingAthletes ? <p className="invite-card__hint">Загружаем список…</p> : null}

      {!loadingAthletes && managedAthletes.length > 0 ? (
        <div className="invite-target glass glass--panel">
          <label className="invite-target__label" htmlFor="invite-athlete-select">
            Кому отправить приглашение
          </label>
          <select
            id="invite-athlete-select"
            className="glass-input invite-target__select"
            value={selectedAthleteId}
            onChange={(event) => setSelectedAthleteId(event.target.value)}
          >
            {managedAthletes.map((athlete) => (
              <option key={athlete.athlete_id} value={athlete.athlete_id}>
                {athlete.display_name}
              </option>
            ))}
            <option value={NEW_ATHLETE_VALUE}>Новый атлет (ещё не в списке)</option>
          </select>
        </div>
      ) : null}

      {status ? <p className="invite-banner invite-banner--success">{status}</p> : null}
      {error ? <p className="invite-banner invite-banner--error">{error}</p> : null}

      <section className="invite-card glass glass--panel">
        {qrDataUrl ? (
          <div className="invite-card__qr">
            <img src={qrDataUrl} alt="QR-код приглашения" />
          </div>
        ) : (
          <p className="invite-card__hint">Готовим QR-код…</p>
        )}
        <p className="invite-card__hint">
          {selectedAthlete
            ? `Персональная ссылка для ${selectedAthlete.display_name}`
            : "Общая ссылка для нового атлета"}
        </p>
        <p className="invite-link">{inviteUrl}</p>
        <div className="invite-actions">
          <button type="button" className="settings-btn settings-btn--primary" onClick={() => void handleShare()}>
            Поделиться
          </button>
          <button type="button" className="settings-btn settings-btn--ghost" onClick={() => void handleCopyLink()}>
            Скопировать ссылку
          </button>
        </div>
      </section>
    </div>
  );
}
