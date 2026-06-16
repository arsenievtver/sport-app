/** Base URL of the athlete PWA for invite links (coach app runs on a different origin). */
export function getAthleteAppUrl(): string {
  const fromEnv = import.meta.env.VITE_ATHLETE_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const devHost = import.meta.env.VITE_DEV_HOST;
  if (devHost) {
    const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https" : "http";
    return `${protocol}://${devHost}:5173`;
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    if (hostname.startsWith("coach.")) {
      return `${protocol}//my.${hostname.slice("coach.".length)}`;
    }
  }

  return typeof window !== "undefined" ? window.location.origin : "";
}
