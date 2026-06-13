import { useEffect, useState } from "react";
import { fetchHealth } from "@sport-app/api-client";
import { AppShell, StatusBadge } from "@sport-app/ui";

export default function App() {
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetchHealth()
      .then(() => setApiOk(true))
      .catch(() => setApiOk(false));
  }, []);

  return (
    <AppShell title="Admin" subtitle="Панель суперюзера">
      <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
        Подключение тренеров, модерация, метрики платформы.
      </p>
      {apiOk !== null && (
        <StatusBadge ok={apiOk} label={apiOk ? "API подключён" : "API недоступен"} />
      )}
    </AppShell>
  );
}
