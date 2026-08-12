import { useCallback, useEffect, useState } from "react";
import {
  createPushSubscription,
  deletePushSubscription,
  fetchPushSubscriptionStatus,
  fetchVapidPublicKey,
} from "@sport-app/api-client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

async function getReadyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export function useWebPushSubscription(enabled = true) {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const status = await fetchPushSubscriptionStatus();
      setSubscribed(status.enabled);
    } catch {
      setSubscribed(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setError("Уведомления не поддерживаются на этом устройстве");
        return false;
      }

      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }
      if (permission !== "granted") {
        setError("Разрешение на уведомления не выдано");
        return false;
      }

      const registration = await getReadyRegistration();
      if (!registration) {
        setError("Service Worker ещё не готов — попробуйте позже");
        return false;
      }

      const { public_key } = await fetchVapidPublicKey();
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(public_key) as BufferSource,
        }));

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setError("Не удалось получить ключи подписки");
        return false;
      }

      await createPushSubscription({
        endpoint: json.endpoint,
        keys: {
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
        user_agent: navigator.userAgent,
      });
      setSubscribed(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось включить уведомления");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const registration = await getReadyRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await deletePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отключить уведомления");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { subscribed, loading, error, subscribe, unsubscribe, refresh };
}
