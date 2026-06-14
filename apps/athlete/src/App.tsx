import { useState, type ReactNode } from "react";
import { ROLE_LABELS, isAthleteOnboardingComplete } from "@sport-app/shared";
import {
  AppShell,
  AthleteOnboarding,
  AuthScreen,
  isThemePreviewMode,
  PwaInstallBanner,
  ThemePreview,
  useAuthSession,
} from "@sport-app/ui";
import { WhoopPanel } from "./components/WhoopPanel";
import "./components/whoop.css";

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
  } else if (!isAthleteOnboardingComplete(user.athlete_profile)) {
    content = (
      <AthleteOnboarding
        displayName={user.athlete_profile?.display_name ?? ROLE_LABELS.athlete}
        onComplete={(updated) => setUser(updated)}
      />
    );
  } else {
    content = (
      <AppShell
        title={`Привет, ${user.athlete_profile?.display_name ?? ROLE_LABELS.athlete.toLowerCase()}!`}
        subtitle="Атлет · здоровье и тренировки"
      >
        <p className="text-secondary" style={{ marginTop: 0 }}>
          Подключите WHOOP, чтобы видеть recovery, сон и нагрузку на одном экране.
        </p>
        <WhoopPanel />
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
            bottom: "max(var(--space-4), var(--safe-bottom))",
            right: "max(var(--space-4), var(--safe-right))",
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
