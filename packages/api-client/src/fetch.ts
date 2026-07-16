export const FETCH_TIMEOUT_MS = 30_000;

/** Network / timeout — not an auth rejection; callers must not clear tokens. */
export class TransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransportError";
  }
}

export function isTransportError(err: unknown): boolean {
  if (err instanceof TransportError) return true;
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "TransportError") return true;
  if (err instanceof Error && err.name === "AbortError") return true;
  return false;
}

export function humanizeFetchError(err: unknown): string {
  if (err instanceof DOMException && err.name === "AbortError") {
    return "Долго нет ответа. Проверьте интернет и попробуйте ещё раз.";
  }
  if (err instanceof Error) {
    if (err.name === "AbortError") {
      return "Долго нет ответа. Проверьте интернет и попробуйте ещё раз.";
    }
    const msg = err.message.toLowerCase();
    if (
      err.message === "Failed to fetch" ||
      msg.includes("networkerror") ||
      msg.includes("load failed") ||
      msg.includes("network request failed")
    ) {
      return "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.";
    }
    return err.message;
  }
  return "Что-то пошло не так. Попробуйте ещё раз.";
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (init.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      init.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    throw new TransportError(humanizeFetchError(err));
  } finally {
    clearTimeout(timeoutId);
  }
}
