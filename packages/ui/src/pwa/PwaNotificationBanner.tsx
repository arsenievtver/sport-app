import { useCallback, useEffect, useState } from "react";
import { isStandalonePwa, markInstallBannerDismissed, wasInstallBannerDismissed } from "./install";
import { getNotificationPermission } from "./useNotificationPermission";
import { useWebPushSubscription } from "./useWebPushSubscription";
import "./pwa-install.css";

type PwaNotificationBannerProps = {
  storageKey?: string;
  enabled?: boolean;
};

export function PwaNotificationBanner({
  storageKey = "pwa-notify-athlete",
  enabled = true,
}: PwaNotificationBannerProps) {
  const [visible, setVisible] = useState(false);
  const { subscribed, loading, error, subscribe } = useWebPushSubscription(enabled);

  useEffect(() => {
    if (!enabled || subscribed || wasInstallBannerDismissed(storageKey)) {
      setVisible(false);
      return;
    }

    const permission = getNotificationPermission();
    if (permission === "unsupported" || permission === "denied") {
      setVisible(false);
      return;
    }

    const show = () => {
      if (wasInstallBannerDismissed(storageKey)) return;
      if (getNotificationPermission() === "denied") return;
      setVisible(true);
    };

    const onInstalled = () => {
      window.setTimeout(show, 600);
    };
    window.addEventListener("appinstalled", onInstalled);

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isStandalonePwa()) {
      timer = setTimeout(show, 1400);
    }

    return () => {
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) clearTimeout(timer);
    };
  }, [enabled, storageKey, subscribed]);

  const dismiss = useCallback(() => {
    markInstallBannerDismissed(storageKey);
    setVisible(false);
  }, [storageKey]);

  const enable = useCallback(async () => {
    const ok = await subscribe();
    if (ok) {
      markInstallBannerDismissed(storageKey);
      setVisible(false);
    }
  }, [storageKey, subscribe]);

  if (!enabled || !visible || subscribed) return null;

  return (
    <div className="pwa-install" role="region" aria-label="Уведомления о тренировках">
      <div className="pwa-install__card">
        <div className="pwa-install__head">
          <div>
            <p className="pwa-install__title">Напоминания о тренировках</p>
            <p className="pwa-install__text">
              Включите уведомления — пришлём напоминание за час до тренировки.
            </p>
            {error ? (
              <p className="pwa-install__text" style={{ color: "var(--color-danger)" }}>
                {error}
              </p>
            ) : null}
          </div>
        </div>
        <div className="pwa-install__actions">
          <button
            type="button"
            className="pwa-install__btn pwa-install__btn--primary"
            disabled={loading}
            onClick={() => void enable()}
          >
            {loading ? "Включаем…" : "Включить"}
          </button>
          <button type="button" className="pwa-install__btn pwa-install__btn--ghost" onClick={dismiss}>
            Позже
          </button>
        </div>
      </div>
    </div>
  );
}
