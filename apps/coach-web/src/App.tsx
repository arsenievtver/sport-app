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
    <AppShell title="Coach Web Desk" subtitle="Программы, библиотека упражнений, конструктор">
      <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
        Desktop-first: drag-and-drop программы, медиа упражнений, аналитика клиентов.
      </p>
      {apiOk !== null && (
        <StatusBadge ok={apiOk} label={apiOk ? "API подключён" : "API недоступен"} />
      )}
    </AppShell>
  );
}
