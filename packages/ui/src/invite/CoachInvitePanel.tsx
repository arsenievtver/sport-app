import { useEffect, useState } from "react";
import { buildAthleteInviteUrl, buildInviteShareMessage } from "@sport-app/shared";
import QRCode from "qrcode";

interface CoachInvitePanelProps {
  inviteCode: string;
  coachName: string;
  athleteAppBaseUrl: string;
}

export function CoachInvitePanel({ inviteCode, coachName, athleteAppBaseUrl }: CoachInvitePanelProps) {
  const inviteUrl = buildAthleteInviteUrl(inviteCode, athleteAppBaseUrl);
  const shareMessage = buildInviteShareMessage(inviteUrl, coachName);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
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
        Отправь ссылку или покажи QR-код — атлет установит приложение, зарегистрируется и сразу окажется в
        твоём списке.
      </p>

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
        <p className="invite-card__hint">Покажи QR-код атлету — он отсканирует и перейдёт в приложение</p>
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
