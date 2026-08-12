/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { clientsClaim } from "workbox-core";

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

self.addEventListener("push", (event) => {
  let title = "sport-app";
  let body = "Новое уведомление";
  let url = "/";
  let data: Record<string, unknown> = {};

  try {
    const payload = event.data?.json() as Record<string, unknown> | undefined;
    if (payload) {
      data = payload;
      if (typeof payload.title === "string" && payload.title.trim()) title = payload.title;
      if (typeof payload.body === "string" && payload.body.trim()) body = payload.body;
      if (typeof payload.url === "string" && payload.url.trim()) url = payload.url;
    } else {
      const text = event.data?.text();
      if (text) body = text;
    }
  } catch {
    const text = event.data?.text();
    if (text) body = text;
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { ...data, url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    typeof event.notification.data?.url === "string" ? event.notification.data.url : "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            await (client as WindowClient).navigate(targetUrl);
          }
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});
