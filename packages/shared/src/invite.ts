export const PENDING_INVITE_STORAGE_KEY = "sport-app:pending-invite-code";

const INVITE_PATH_PREFIX = "/join/";

export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}

export function buildAthleteInvitePath(inviteCode: string): string {
  return `${INVITE_PATH_PREFIX}${encodeURIComponent(normalizeInviteCode(inviteCode))}`;
}

export function buildAthleteInviteUrl(inviteCode: string, athleteAppBaseUrl: string): string {
  const base = athleteAppBaseUrl.replace(/\/$/, "");
  return `${base}${buildAthleteInvitePath(inviteCode)}`;
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

export function savePendingInviteCode(code: string): void {
  try {
    localStorage.setItem(PENDING_INVITE_STORAGE_KEY, normalizeInviteCode(code));
  } catch {
    // ignore quota / private mode
  }
}

export function readPendingInviteCode(): string | null {
  try {
    const code = localStorage.getItem(PENDING_INVITE_STORAGE_KEY);
    return code?.trim() ? normalizeInviteCode(code) : null;
  } catch {
    return null;
  }
}

export function clearPendingInviteCode(): void {
  try {
    localStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function captureInviteCodeFromUrl(): string | null {
  const code = parseInviteCodeFromLocation();
  if (!code) return null;

  savePendingInviteCode(code);

  const params = new URLSearchParams(window.location.search);
  params.delete("invite");
  const nextQuery = params.toString();
  const nextPath = window.location.pathname.match(/^\/join\/[^/]+\/?$/i) ? "/" : window.location.pathname;
  const nextUrl = `${nextPath}${nextQuery ? `?${nextQuery}` : ""}`;
  window.history.replaceState({}, "", nextUrl);

  return code;
}

export function buildInviteShareMessage(inviteUrl: string, coachName?: string | null): string {
  const name = coachName?.trim();
  if (name) {
    return `${name} приглашает тебя в sport-app. Переходи по ссылке — будем тренироваться вместе!\n\n${inviteUrl}`;
  }
  return `Присоединяйся ко мне в sport-app — будем тренироваться вместе!\n\n${inviteUrl}`;
}
