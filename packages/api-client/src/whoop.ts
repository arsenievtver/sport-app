import type {
  WhoopConnectResponse,
  WhoopStatusResponse,
  WhoopSyncResponse,
} from "@sport-app/shared";

import { authenticatedFetch, authenticatedFetchOk } from "./auth";

export async function fetchWhoopConnectUrl(): Promise<WhoopConnectResponse> {
  const res = await authenticatedFetchOk("/integrations/whoop/connect");
  return res.json() as Promise<WhoopConnectResponse>;
}

export async function fetchWhoopStatus(): Promise<WhoopStatusResponse> {
  const res = await authenticatedFetchOk("/integrations/whoop/status");
  return res.json() as Promise<WhoopStatusResponse>;
}

export async function syncWhoop(): Promise<WhoopSyncResponse> {
  const res = await authenticatedFetchOk("/integrations/whoop/sync", { method: "POST" });
  return res.json() as Promise<WhoopSyncResponse>;
}

export async function disconnectWhoop(): Promise<void> {
  const res = await authenticatedFetch("/integrations/whoop/disconnect", { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw new Error(`WHOOP disconnect failed: ${res.status}`);
  }
}
