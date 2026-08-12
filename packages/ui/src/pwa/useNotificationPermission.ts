import { useCallback, useEffect, useState } from "react";

export type NotificationPermissionState = NotificationPermission | "unsupported";

export function getNotificationPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermissionState>(() =>
    getNotificationPermission(),
  );

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  const request = useCallback(async (): Promise<NotificationPermissionState> => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return "unsupported";
    }
    const next = await Notification.requestPermission();
    setPermission(next);
    return next;
  }, []);

  return { permission, request, supported: permission !== "unsupported" };
}
