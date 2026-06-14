import { useState, type ReactNode } from "react";
import { ROLE_LABELS } from "@sport-app/shared";
import { AppShell, AuthScreen, isThemePreviewMode, PwaInstallBanner, ThemePreview, useAuthSession } from "@sport-app/ui";

export default function App() {
  const { user, setUser, checking, logout } = useAuthSession("athlete");
  const [showThemes, setShowThemes] = useState(isThemePreviewMode());

  if (showThemes) {
    return <ThemePreview onClose={() => setShowThemes(false)} />;
  }

  let content: ReactNode;

  if (checking) {
    content = (
      <div className="auth-screen">
        <div className="auth-screen__bg" />
        <div className="auth-screen__content" style={{ justifyContent: "center", alignItems: "center" }}>
          <p className="text-muted">Загрузка…</p>
        </div>
      </div>
    );
  } else if (!user) {
    content = (
      <AuthScreen
        role="athlete"
        roleLabel={ROLE_LABELS.athlete}
        tagline={"Тренировки с тренером\nПрогресс который мотивирует"}
        onAuthenticated={(u) => setUser(u)}
      />
    );
  } else {
    content = (
      <AppShell
        title={`Привет, ${user.athlete_profile?.display_name ?? ROLE_LABELS.athlete.toLowerCase()}!`}
        subtitle="Атлет · главная (скоро)"
      >
        <p className="text-secondary" style={{ marginTop: 0 }}>
          Ты вошёл как {user.phone}. Здесь будет программа и логирование тренировок.
        </p>
        <button
          type="button"
          className="auth-switch__link"
          style={{ marginTop: "var(--space-4)" }}
          onClick={logout}
        >
          Выйти
        </button>
      </AppShell>
    );
  }

  return (
    <>
      {content}
      <PwaInstallBanner appName="Атлет" />
      {!checking && !user ? (
        <button
          type="button"
          onClick={() => setShowThemes(true)}
          style={{
            position: "fixed",
            bottom: "max(var(--space-4), env(safe-area-inset-bottom, 0px))",
            right: "max(var(--space-4), env(safe-area-inset-right, 0px))",
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
      ) : null}
    </>
  );
}
