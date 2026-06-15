import { useEffect } from "react";
import { fetchWhoopStatus, syncWhoop } from "@sport-app/api-client";

export function WhoopOAuthListener() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const whoop = params.get("whoop");
    if (!whoop) return;

    const reason = params.get("reason");
    params.delete("whoop");
    params.delete("reason");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);

    if (whoop === "connected") {
      void (async () => {
        await fetchWhoopStatus();
        await syncWhoop();
      })();
      return;
    }

    if (whoop === "error") {
      console.error(`WHOOP OAuth error: ${reason ?? "unknown"}`);
    }
  }, []);

  return null;
}
