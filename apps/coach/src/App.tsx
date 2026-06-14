import { type ReactNode } from "react";
import { ROLE_LABELS, ROLE_LABELS_PLURAL } from "@sport-app/shared";
import { AppShell, AuthScreen, PwaInstallBanner, useAuthSession } from "@sport-app/ui";

export default function App() {
  const { user, setUser, checking, logout } = useAuthSession("coach");

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
        role="coach"
        roleLabel={ROLE_LABELS.coach}
        tagline={"Клиенты, программы и связь\nВсё в одном месте"}
        allowRegister={false}
        onAuthenticated={(u) => setUser(u)}
      />
    );
  } else {
    content = (
      <AppShell
        title={`${user.coach_profile?.display_name ?? ROLE_LABELS.coach}`}
        subtitle={
          user.coach_profile?.invite_code
            ? `Код приглашения: ${user.coach_profile.invite_code}`
            : "Coach · главная (скоро)"
        }
      >
        <p className="text-secondary" style={{ marginTop: 0 }}>
          Добро пожаловать. Делись кодом {user.coach_profile?.invite_code} с {ROLE_LABELS_PLURAL.athlete}.
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
      <PwaInstallBanner appName="Coach" />
    </>
  );
}
