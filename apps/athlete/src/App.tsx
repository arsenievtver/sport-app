import { useEffect, useState, type ReactNode } from "react";
import {
  captureInviteCodeFromUrl,
  isAthleteOnboardingComplete,
  readPendingInviteCode,
  ROLE_LABELS,
} from "@sport-app/shared";
import {
  AppShell,
  AthleteOnboarding,
  AthleteSettings,
  AuthScreen,
  BottomNav,
  BottomNavIconHome,
  BottomNavIconSettings,
  BottomNavIconStats,
  isThemePreviewMode,
  PwaInstallBanner,
  ThemePreview,
  useAuthSession,
  usePendingCoachInvite,
} from "@sport-app/ui";
import { WhoopOAuthListener } from "./components/WhoopOAuthListener";
import { WhoopTabPanel } from "./components/WhoopTabPanel";
import { AthleteCoachesHomePanel } from "./components/AthleteCoachesHomePanel";
import "./components/whoop.css";

type AthleteTab = "home" | "whoop" | "settings";

const TAB_TITLES: Record<AthleteTab, string | ((name: string) => string)> = {
  home: (name) => `Привет, ${name}!`,
  whoop: "WHOOP",
  settings: "Настройки",
};

export default function App() {
  const { user, setUser, checking, logout } = useAuthSession("athlete");
  const [showThemes, setShowThemes] = useState(isThemePreviewMode());
  const [tab, setTab] = useState<AthleteTab>(() => {
    const whoop = new URLSearchParams(window.location.search).get("whoop");
    return whoop ? "whoop" : "home";
  });
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(() => readPendingInviteCode());

  useEffect(() => {
    const code = captureInviteCodeFromUrl();
    if (code) setPendingInviteCode(code);
  }, []);

  const onboardingComplete = Boolean(user && isAthleteOnboardingComplete(user.athlete_profile));
  const { joining, notice, coachesRefreshKey, error: inviteError } = usePendingCoachInvite(onboardingComplete);

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
        inviteHint={
          pendingInviteCode
            ? "Тренер пригласил тебя. Зарегистрируйся — мы сразу свяжем вас."
            : undefined
        }
        pendingInviteCode={pendingInviteCode}
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
    const displayName = user.athlete_profile?.display_name ?? ROLE_LABELS.athlete.toLowerCase();
    const navItems = [
      {
        id: "home",
        label: "Главная",
        icon: <BottomNavIconHome />,
      },
      {
        id: "whoop",
        label: "WHOOP",
        icon: <BottomNavIconStats />,
      },
      {
        id: "settings",
        label: "Настройки",
        icon: <BottomNavIconSettings />,
      },
    ];

    const titleEntry = TAB_TITLES[tab];
    const title = typeof titleEntry === "function" ? titleEntry(displayName) : titleEntry;

    content = (
      <>
        <WhoopOAuthListener />
        <AppShell
          title={title}
          bottomNav={<BottomNav items={navItems} activeId={tab} onChange={(id) => setTab(id as AthleteTab)} />}
        >
          {tab === "home" ? (
            <>
              {joining ? <p className="invite-banner invite-banner--info">Подключаем тренера…</p> : null}
              {notice ? <p className="invite-banner invite-banner--success">{notice}</p> : null}
              {inviteError ? <p className="invite-banner invite-banner--error">{inviteError}</p> : null}
              <AthleteCoachesHomePanel refreshKey={coachesRefreshKey > 0 ? String(coachesRefreshKey) : undefined} />
            </>
          ) : null}
          {tab === "whoop" ? <WhoopTabPanel /> : null}
          {tab === "settings" ? (
            <AthleteSettings
              user={user}
              onUserUpdated={setUser}
              onOpenThemes={() => setShowThemes(true)}
              onLogout={logout}
            />
          ) : null}
        </AppShell>
      </>
    );
  }

  return (
    <>
      {content}
      <PwaInstallBanner
        appName="Атлет"
        blockedReason={
          !checking && !user && pendingInviteCode
            ? "Приглашение тренера сохранено в ссылке. После входа можно установить приложение — тренер уже будет привязан."
            : undefined
        }
      />
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
