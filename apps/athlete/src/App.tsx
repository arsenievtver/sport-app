import { useEffect, useState } from "react";
import { clearTokens, fetchMe, getAccessToken } from "@sport-app/api-client";
import { ROLE_LABELS } from "@sport-app/shared";
import type { UserResponse } from "@sport-app/shared";
import { AppShell, AuthScreen, isThemePreviewMode, ThemePreview } from "@sport-app/ui";

export default function App() {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [checking, setChecking] = useState(true);
  const [showThemes, setShowThemes] = useState(isThemePreviewMode());

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setChecking(false);
      return;
    }
    fetchMe(token)
      .then(setUser)
      .catch(() => clearTokens())
      .finally(() => setChecking(false));
  }, []);

  if (showThemes) {
    return <ThemePreview onClose={() => setShowThemes(false)} />;
  }

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
      <>
        <AuthScreen
          role="athlete"
          roleLabel={ROLE_LABELS.athlete}
          tagline="Тренировки с тренером. Прогресс, который мотивирует."
          onAuthenticated={(u) => setUser(u)}
        />
        <button
          type="button"
          onClick={() => setShowThemes(true)}
          style={{
            position: "fixed",
            bottom: "var(--space-4)",
            right: "var(--space-4)",
            zIndex: 100,
            padding: "var(--space-2) var(--space-4)",
            fontSize: "var(--text-xs)",
            fontWeight: "var(--font-semibold)",
            color: "var(--color-text-muted)",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-full)",
            cursor: "pointer",
            opacity: 0.85,
          }}
        >
          🎨 Темы
        </button>
      </>
    );
  }

  return (
    <AppShell
      title={`Привет, ${user.profile?.display_name ?? ROLE_LABELS.athlete.toLowerCase()}!`}
      subtitle="Атлет · главная (скоро)"
    >
      <p className="text-secondary" style={{ marginTop: 0 }}>
        Ты вошёл как {user.phone}. Здесь будет программа и логирование тренировок.
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
