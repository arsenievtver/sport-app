import type { LoginPayload, RegisterPayload, TokenResponse, UserResponse } from "@sport-app/shared";

import { getApiBaseUrl } from "./config";

const ACCESS_KEY = "sport-app:access-token";
const REFRESH_KEY = "sport-app:refresh-token";

export function saveTokens(tokens: TokenResponse): void {
  localStorage.setItem(ACCESS_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail) && body.detail[0]?.msg) {
      return body.detail.map((d: { msg: string }) => d.msg).join(", ");
    }
  } catch {
    /* ignore */
  }
  return `Ошибка ${res.status}`;
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<T>;
}

export async function login(payload: LoginPayload): Promise<TokenResponse> {
  return postJson<TokenResponse>("/auth/login", payload);
}

export async function register(payload: RegisterPayload): Promise<TokenResponse> {
  return postJson<TokenResponse>("/auth/register", payload);
}

export async function fetchMe(accessToken: string): Promise<UserResponse> {
  const res = await fetch(`${getApiBaseUrl()}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<UserResponse>;
}

export function normalizePhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("8") && digits.length >= 11) {
    digits = "7" + digits.slice(1);
  }
  if (digits.length === 10 && digits.startsWith("9")) {
    digits = "7" + digits;
  }
  return digits.slice(0, 11);
}

export function formatPhoneDisplay(digits: string): string {
  if (!digits) return "";
  const d = digits.startsWith("7") ? digits : "7" + digits;
  const p = d.padEnd(11, "_").slice(0, 11);
  return `+7 (${p.slice(1, 4)}) ${p.slice(4, 7)}-${p.slice(7, 9)}-${p.slice(9, 11)}`.replace(/[_-]+$/g, "");
}

export function isValidPhone(digits: string): boolean {
  return /^7\d{10}$/.test(digits);
}

export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}
