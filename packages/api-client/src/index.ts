/// <reference types="vite/client" />

import type { ApiHealth } from "@sport-app/shared";

export * from "./auth";
export { getApiBaseUrl } from "./config";

import { getApiBaseUrl } from "./config";

export async function fetchHealth(): Promise<ApiHealth> {
  const res = await fetch(`${getApiBaseUrl()}/health`);
  if (!res.ok) {
    throw new Error(`API health check failed: ${res.status}`);
  }
  return res.json();
}

export function createApiClient(baseUrl = getApiBaseUrl()) {
  return {
    baseUrl,
    health: () => fetch(`${baseUrl}/health`).then((r) => r.json() as Promise<ApiHealth>),
  };
}
