import type { LoginPayload, RegisterPayload, TokenResponse, UserResponse } from "@sport-app/shared";

import { getApiBaseUrl } from "./config";

const ACCESS_KEY = "sport-app:access-token";
const REFRESH_KEY = "sport-app:refresh-token";
const EXPIRES_AT_KEY = "sport-app:token-expires-at";

const REFRESH_BUFFER_MS = 60_000;

let refreshPromise: Promise<TokenResponse> | null = null;
let onAuthFailure: (() => void) | null = null;

export function saveTokens(tokens: TokenResponse): void {
  localStorage.setItem(ACCESS_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
  localStorage.setItem(EXPIRES_AT_KEY, String(Date.now() + tokens.expires_in * 1000));
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setOnAuthFailure(handler: (() => void) | null): void {
  onAuthFailure = handler;
}

function isAccessTokenExpiringSoon(): boolean {
  const expiresAt = localStorage.getItem(EXPIRES_AT_KEY);
  if (!expiresAt) return false;
  return Date.now() >= Number(expiresAt) - REFRESH_BUFFER_MS;
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

function failAuth(): never {
  clearTokens();
  onAuthFailure?.();
  throw new Error("Сессия истекла");
}

const SESSION_AUTH_ERRORS = new Set([
  "Требуется авторизация",
  "Недействительный или просроченный токен",
  "Недействительный тип токена",
  "Пользователь не найден или отключён",
]);

async function isSessionUnauthorized(res: Response): Promise<boolean> {
  try {
    const body = await res.clone().json();
    if (typeof body.detail === "string") {
      if (body.detail.includes("WHOOP")) return false;
      return SESSION_AUTH_ERRORS.has(body.detail);
    }
  } catch {
    /* ignore */
  }
  return true;
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

export async function refreshTokens(): Promise<TokenResponse> {
  const refresh = getRefreshToken();
  if (!refresh) {
    throw new Error("Нет refresh-токена");
  }

  if (refreshPromise) return refreshPromise;

  refreshPromise = postJson<TokenResponse>("/auth/refresh", { refresh_token: refresh })
    .then((tokens) => {
      saveTokens(tokens);
      return tokens;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

async function ensureValidAccessToken(): Promise<string> {
  const token = getAccessToken();
  if (!token) failAuth();

  if (isAccessTokenExpiringSoon()) {
    try {
      const tokens = await refreshTokens();
      return tokens.access_token;
    } catch {
      failAuth();
    }
  }

  return token;
}

/** Authenticated fetch: proactive refresh before expiry, retry once on 401. */
export async function authenticatedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const accessToken = await ensureValidAccessToken();

  const doFetch = (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(`${getApiBaseUrl()}${path}`, { ...init, headers });
  };

  let res = await doFetch(accessToken);

  if (res.status === 401 && (await isSessionUnauthorized(res))) {
    try {
      const tokens = await refreshTokens();
      res = await doFetch(tokens.access_token);
    } catch {
      failAuth();
    }

    if (res.status === 401 && (await isSessionUnauthorized(res))) {
      failAuth();
    }
  }

  return res;
}

export async function authenticatedFetchOk(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await authenticatedFetch(path, init);
  if (!res.ok) throw new Error(await parseError(res));
  return res;
}

export async function login(payload: LoginPayload): Promise<TokenResponse> {
  return postJson<TokenResponse>("/auth/login", payload);
}

export async function register(payload: RegisterPayload): Promise<TokenResponse> {
  return postJson<TokenResponse>("/auth/register", payload);
}

export async function fetchMe(): Promise<UserResponse> {
  const res = await authenticatedFetch("/auth/me");
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<UserResponse>;
}

/** Canonical: "" | "7" (only +7 typed) | "7" + up to 10 national digits */
export function getPhoneNational(canonical: string): string {
  if (!canonical || canonical === "7") return "";
  return canonical.startsWith("7") ? canonical.slice(1) : canonical;
}

export function formatPhoneDisplay(canonical: string): string {
  if (!canonical) return "";
  if (canonical === "7") return "+7 (";

  const national = getPhoneNational(canonical);
  const p = national.padEnd(10, "_").slice(0, 10);
  return `+7 (${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6, 8)}-${p.slice(8, 10)}`.replace(
    /[_-]+$/g,
    "",
  );
}

/** Paste, autofill, mobile keyboard fallback */
export function normalizePhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("8") && digits.length === 11) {
    digits = `7${digits.slice(1)}`;
  }

  if (digits.length >= 11 && digits.startsWith("7")) {
    return digits.slice(0, 11);
  }

  if (digits.length === 10 && !digits.startsWith("7")) {
    return `7${digits}`;
  }

  const isFormatted = raw.includes("+") || raw.includes("(");

  if (isFormatted) {
    const national = digits.startsWith("7") ? digits.slice(1) : digits;
    if (!national) return "7";
    return `7${national.slice(0, 10)}`;
  }

  if (digits === "7") return "7";

  return `7${digits.replace(/^7/, "").slice(0, 10)}`;
}

export function appendPhoneDigit(canonical: string, digit: string): string {
  if (canonical === "" && digit === "7") return "7";
  const national = getPhoneNational(canonical);
  return `7${(national + digit).slice(0, 10)}`;
}

export function backspacePhone(canonical: string): string {
  const national = getPhoneNational(canonical);
  if (national.length > 0) {
    const next = national.slice(0, -1);
    return next ? `7${next}` : "";
  }
  if (canonical === "7") return "";
  return canonical;
}

export function isValidPhone(digits: string): boolean {
  return /^7\d{10}$/.test(digits);
}

export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}
