import { useEffect, useState } from "react";
import { clearTokens, fetchMe, getAccessToken } from "@sport-app/api-client";
import { hasRole, ROLE_LABELS } from "@sport-app/shared";
import type { UserResponse } from "@sport-app/shared";
import { AppShell, AuthScreen } from "@sport-app/ui";

const REQUIRED_ROLE = "admin" as const;

export default function App() {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setChecking(false);
      return;
    }
    fetchMe(token)
      .then((u) => {
        if (!hasRole(u, REQUIRED_ROLE)) {
          clearTokens();
          return;
        }
        setUser(u);
      })
      .catch(() => clearTokens())
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="auth-screen">
        <div className="auth-screen__bg" />
        <div className="auth-screen__content" style={{ justifyContent: "center", alignItems: "center" }}>
          <p className="text-muted">Загрузка…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        role={REQUIRED_ROLE}
        roleLabel={ROLE_LABELS.admin}
        tagline={"Управление платформой\nТренеры, атлеты, доступ"}
        allowRegister={false}
        onAuthenticated={(u) => setUser(u)}
      />
    );
  }

  return (
    <AppShell title="Admin" subtitle="Панель суперюзера">
      <p className="text-secondary" style={{ marginTop: 0 }}>
        Подключение тренеров, модерация, метрики платформы.
      </p>
      <p className="text-muted" style={{ marginTop: "var(--space-2)", fontSize: "var(--text-sm)" }}>
        Вошёл: {user.phone}
      </p>
      <button
        type="button"
        className="auth-switch__link"
        style={{ marginTop: "var(--space-4)" }}
        onClick={() => {
          clearTokens();
          setUser(null);
        }}
      >
        Выйти
      </button>
    </AppShell>
  );
}
