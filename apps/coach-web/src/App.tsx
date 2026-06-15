import { ROLE_LABELS } from "@sport-app/shared";
import { AppShell, AuthScreen, useAuthSession } from "@sport-app/ui";

const REQUIRED_ROLE = "coach" as const;

export default function App() {
  const { user, setUser, checking, logout } = useAuthSession(REQUIRED_ROLE);

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
        roleLabel={ROLE_LABELS.coach}
        tagline={"Клиенты, программы и связь\nВсё в одном месте"}
        allowRegister={false}
        onAuthenticated={(u) => setUser(u)}
      />
    );
  }

  return (
    <AppShell title={user.coach_profile?.display_name ?? ROLE_LABELS.coach}>
      <p className="text-secondary" style={{ marginTop: 0 }}>
        Desktop-first: drag-and-drop программы, медиа упражнений, аналитика клиентов.
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
