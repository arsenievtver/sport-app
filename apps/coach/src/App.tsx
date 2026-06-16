import { useState, type ReactNode } from "react";
import { ROLE_LABELS, ROLE_LABELS_PLURAL } from "@sport-app/shared";
import {
  AppShell,
  AuthScreen,
  BottomNav,
  BottomNavIconHome,
  BottomNavIconSettings,
  CoachAthletesPanel,
  PwaInstallBanner,
  useAuthSession,
} from "@sport-app/ui";

type CoachTab = "home" | "settings";

export default function App() {
  const { user, setUser, checking, logout } = useAuthSession("coach");
  const [tab, setTab] = useState<CoachTab>("home");

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
    const coachName = user.coach_profile?.display_name ?? ROLE_LABELS.coach;
    const inviteCode = user.coach_profile?.invite_code;
    const navItems = [
      {
        id: "home",
        label: "Главная",
        icon: <BottomNavIconHome />,
      },
      {
        id: "settings",
        label: "Настройки",
        icon: <BottomNavIconSettings />,
      },
    ];

    content = (
      <AppShell
        title={tab === "home" ? coachName : "Настройки"}
        bottomNav={<BottomNav items={navItems} activeId={tab} onChange={(id) => setTab(id as CoachTab)} />}
      >
        {tab === "home" ? (
          <>
            <p className="text-secondary" style={{ marginTop: 0 }}>
              Добро пожаловать. Делись кодом {inviteCode} с {ROLE_LABELS_PLURAL.athlete}.
            </p>
            <h2 style={{ margin: "var(--space-5) 0 var(--space-3)", fontSize: "var(--text-lg)" }}>Мои атлеты</h2>
            <CoachAthletesPanel />
          </>
        ) : (
          <>
            <p className="text-secondary" style={{ marginTop: 0 }}>
              Настройки профиля тренера и аккаунта.
            </p>
            {inviteCode ? (
              <p className="text-secondary" style={{ marginTop: "var(--space-4)" }}>
                Код приглашения: <strong>{inviteCode}</strong>
              </p>
            ) : null}
            <button
              type="button"
              className="auth-switch__link"
              style={{ marginTop: "var(--space-4)" }}
              onClick={logout}
            >
              Выйти
            </button>
          </>
        )}
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
