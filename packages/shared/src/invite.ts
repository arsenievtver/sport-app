export const PENDING_INVITE_STORAGE_KEY = "sport-app:pending-invite-code";
export const PENDING_INVITE_COOKIE_KEY = "sport-app-invite";
export const PENDING_CLAIM_STORAGE_KEY = "sport-app:pending-claim-athlete-id";

const INVITE_PATH_PREFIX = "/join/";
const INVITE_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 14;

export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}

export function buildAthleteInvitePath(inviteCode: string): string {
  return `${INVITE_PATH_PREFIX}${encodeURIComponent(normalizeInviteCode(inviteCode))}`;
}

export function buildAthleteInviteUrl(
  inviteCode: string,
  athleteAppBaseUrl: string,
  claimAthleteId?: string | null,
): string {
  const base = athleteAppBaseUrl.replace(/\/$/, "");
  const path = `${base}${buildAthleteInvitePath(inviteCode)}`;
  if (claimAthleteId?.trim()) {
    return `${path}?claim=${encodeURIComponent(claimAthleteId.trim())}`;
  }
  return path;
}

export function parseClaimAthleteIdFromLocation(
  search = typeof window !== "undefined" ? window.location.search : "",
): string | null {
  const fromQuery = new URLSearchParams(search).get("claim");
  return fromQuery?.trim() || null;
}

export function parseInviteCodeFromLocation(
  pathname = typeof window !== "undefined" ? window.location.pathname : "",
  search = typeof window !== "undefined" ? window.location.search : "",
): string | null {
  const fromPath = pathname.match(/^\/join\/([^/]+)\/?$/i)?.[1];
  if (fromPath) {
    const decoded = decodeURIComponent(fromPath);
    if (decoded.trim()) return normalizeInviteCode(decoded);
  }

  const fromQuery = new URLSearchParams(search).get("invite");
  if (fromQuery?.trim()) return normalizeInviteCode(fromQuery);

  return null;
}

function readInviteCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${PENDING_INVITE_COOKIE_KEY}=([^;]*)`));
  if (!match?.[1]) return null;
  try {
    const decoded = decodeURIComponent(match[1]);
    return decoded.trim() ? normalizeInviteCode(decoded) : null;
  } catch {
    return null;
  }
}

function writeInviteCookie(code: string): void {
  if (typeof document === "undefined") return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${PENDING_INVITE_COOKIE_KEY}=${encodeURIComponent(
    normalizeInviteCode(code),
  )}; Path=/; Max-Age=${INVITE_COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure}`;
}

function clearInviteCookie(): void {
  if (typeof document === "undefined") return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${PENDING_INVITE_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

function stripInviteFromUrl(): void {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  params.delete("invite");
  params.delete("claim");
  const nextQuery = params.toString();
  const nextPath = window.location.pathname.match(/^\/join\/[^/]+\/?$/i) ? "/" : window.location.pathname;
  const nextUrl = `${nextPath}${nextQuery ? `?${nextQuery}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
}

export function savePendingClaimAthleteId(athleteId: string): void {
  const trimmed = athleteId.trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(PENDING_CLAIM_STORAGE_KEY, trimmed);
  } catch {
    // ignore
  }
}

export function readPendingClaimAthleteId(): string | null {
  const fromUrl = parseClaimAthleteIdFromLocation();
  if (fromUrl) {
    savePendingClaimAthleteId(fromUrl);
    return fromUrl;
  }

  try {
    const fromStorage = localStorage.getItem(PENDING_CLAIM_STORAGE_KEY);
    if (fromStorage?.trim()) return fromStorage.trim();
  } catch {
    // ignore
  }

  return null;
}

export function clearPendingClaimAthleteId(): void {
  try {
    localStorage.removeItem(PENDING_CLAIM_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function savePendingInviteCode(code: string): void {
  const normalized = normalizeInviteCode(code);
  try {
    localStorage.setItem(PENDING_INVITE_STORAGE_KEY, normalized);
  } catch {
    // ignore quota / private mode
  }
  writeInviteCookie(normalized);
}

export function readPendingInviteCode(): string | null {
  const fromUrl = parseInviteCodeFromLocation();
  if (fromUrl) {
    savePendingInviteCode(fromUrl);
    return fromUrl;
  }

  try {
    const fromStorage = localStorage.getItem(PENDING_INVITE_STORAGE_KEY);
    if (fromStorage?.trim()) return normalizeInviteCode(fromStorage);
  } catch {
    // ignore
  }

  const fromCookie = readInviteCookie();
  if (fromCookie) {
    savePendingInviteCode(fromCookie);
    return fromCookie;
  }

  return null;
}

export function clearPendingInviteCode(): void {
  try {
    localStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
  } catch {
    // ignore
  }
  clearInviteCookie();
  clearPendingClaimAthleteId();
  stripInviteFromUrl();
}

/** Сохраняет код из URL, но не убирает /join/… — так iOS сохраняет ссылку при «На экран Домой». */
export function captureInviteCodeFromUrl(): string | null {
  const code = parseInviteCodeFromLocation();
  if (!code) return null;
  savePendingInviteCode(code);

  const claimId = parseClaimAthleteIdFromLocation();
  if (claimId) savePendingClaimAthleteId(claimId);

  return code;
}

export function buildInviteShareMessage(
  inviteUrl: string,
  coachName?: string | null,
  athleteName?: string | null,
): string {
  const coach = coachName?.trim();
  const athlete = athleteName?.trim();
  if (coach && athlete) {
    return `${coach} приглашает тебя в sport-app. Переходи по ссылке — твоя история тренировок уже ждёт!\n\n${inviteUrl}`;
  }
  if (coach) {
    return `${coach} приглашает тебя в sport-app. Переходи по ссылке — будем тренироваться вместе!\n\n${inviteUrl}`;
  }
  return `Присоединяйся ко мне в sport-app — будем тренироваться вместе!\n\n${inviteUrl}`;
}
