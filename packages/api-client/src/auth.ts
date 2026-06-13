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
