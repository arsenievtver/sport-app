import { useState, type ReactNode } from "react";
import { ROLE_LABELS } from "@sport-app/shared";
import {
  AppShell,
  AuthScreen,
  BottomNav,
  BottomNavIconAthletes,
  BottomNavIconInvite,
  BottomNavIconSchedule,
  BottomNavIconSettings,
  CoachAthletesPanel,
  CoachInvitePanel,
  CoachSchedulePanel,
  CoachSettings,
  PwaInstallBanner,
  useAuthSession,
} from "@sport-app/ui";
import { getAthleteAppUrl } from "./athlete-app-url";

type CoachTab = "schedule" | "athletes" | "invite" | "settings";

export default function App() {
  const { user, setUser, checking, logout } = useAuthSession("coach");
  const [tab, setTab] = useState<CoachTab>("schedule");

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
        id: "schedule",
        label: "Расписание",
        icon: <BottomNavIconSchedule />,
      },
      {
        id: "athletes",
        label: "Атлеты",
        icon: <BottomNavIconAthletes />,
      },
      {
        id: "invite",
        label: "Пригласить",
        icon: <BottomNavIconInvite />,
      },
      {
        id: "settings",
        label: "Настройки",
        icon: <BottomNavIconSettings />,
      },
    ];

    const title =
      tab === "schedule"
        ? "Расписание"
        : tab === "athletes"
          ? "Атлеты"
          : tab === "invite"
            ? "Пригласить атлета"
            : "Настройки";

    content = (
      <AppShell
        title={title}
        subtitle={tab === "schedule" ? coachName : undefined}
        contentKey={tab}
        className={tab === "schedule" ? "app-shell--schedule-landscape" : undefined}
        bottomNav={<BottomNav items={navItems} activeId={tab} onChange={(id) => setTab(id as CoachTab)} />}
      >
        {tab === "schedule" ? (
          <CoachSchedulePanel />
        ) : tab === "athletes" ? (
          <CoachAthletesPanel />
        ) : tab === "invite" ? (
          inviteCode ? (
            <CoachInvitePanel
              inviteCode={inviteCode}
              coachName={coachName}
              athleteAppBaseUrl={getAthleteAppUrl()}
            />
          ) : (
            <p className="text-muted">Код приглашения недоступен. Обратись к администратору.</p>
          )
        ) : (
          <CoachSettings user={user} onUserUpdated={setUser} onLogout={logout} />
        )}
      </AppShell>
    );
  }

  return (
    <>
      {content}
      <PwaInstallBanner appName={ROLE_LABELS.coach} />
    </>
  );
}
