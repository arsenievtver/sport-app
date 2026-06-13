import { useEffect, useState, type ReactNode } from "react";
import { clearTokens, fetchMe, getAccessToken } from "@sport-app/api-client";
import { hasRole, ROLE_LABELS, ROLE_LABELS_PLURAL } from "@sport-app/shared";
import type { UserResponse } from "@sport-app/shared";
import { AppShell, AuthScreen, PwaInstallBanner } from "@sport-app/ui";

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
        if (!hasRole(u, "coach")) {
          clearTokens();
          return;
        }
        setUser(u);
      })
      .catch(() => clearTokens())
      .finally(() => setChecking(false));
  }, []);

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

  return (
    <>
      {content}
      <PwaInstallBanner appName="Coach" />
    </>
  );
}
