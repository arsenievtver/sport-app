import { useCallback, useEffect, useState } from "react";
import {
  isAndroid,
  isIos,
  isStandalonePwa,
  markInstallBannerDismissed,
  wasInstallBannerDismissed,
  type BeforeInstallPromptEvent,
} from "./install";

export type PwaInstallMode = "android" | "ios" | null;

export function usePwaInstall(storageKey: string) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<PwaInstallMode>(null);

  useEffect(() => {
    if (isStandalonePwa() || wasInstallBannerDismissed(storageKey)) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setMode("android");
    };

    const onInstalled = () => {
      setDeferredPrompt(null);
      setMode(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    let iosTimer: ReturnType<typeof setTimeout> | undefined;
    if (isIos() && !isAndroid()) {
      iosTimer = setTimeout(() => setMode("ios"), 1200);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, [storageKey]);

  const dismiss = useCallback(() => {
    markInstallBannerDismissed(storageKey);
    setMode(null);
    setDeferredPrompt(null);
  }, [storageKey]);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") {
      setMode(null);
      return;
    }
    dismiss();
  }, [deferredPrompt, dismiss]);

  const visible = mode === "ios" || (mode === "android" && deferredPrompt !== null);

  return { visible, mode, install, dismiss };
}
