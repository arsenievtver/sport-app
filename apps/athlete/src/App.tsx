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
  isThemePreviewMode,
  PwaInstallBanner,
  ThemePreview,
  useAuthSession,
  usePendingCoachInvite,
} from "@sport-app/ui";
import { WhoopHomePanel } from "./components/WhoopHomePanel";
import { WhoopOAuthListener } from "./components/WhoopOAuthListener";
import { WhoopSettingsPanel } from "./components/WhoopSettingsPanel";
import { AthleteCoachesHomePanel } from "./components/AthleteCoachesHomePanel";
import "./components/whoop.css";

type AthleteTab = "home" | "settings";

export default function App() {
  const { user, setUser, checking, logout } = useAuthSession("athlete");
  const [showThemes, setShowThemes] = useState(isThemePreviewMode());
  const [tab, setTab] = useState<AthleteTab>("home");
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
            ? "Тренер пригласил тебя в sport-app. Войди или зарегистрируйся — мы сразу свяжем вас."
            : undefined
        }
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
        id: "settings",
        label: "Настройки",
        icon: <BottomNavIconSettings />,
      },
    ];

    content = (
      <>
        <WhoopOAuthListener />
        <AppShell
          title={tab === "home" ? `Привет, ${displayName}!` : "Настройки"}
          bottomNav={<BottomNav items={navItems} activeId={tab} onChange={(id) => setTab(id as AthleteTab)} />}
        >
          {joining ? <p className="invite-banner invite-banner--info">Подключаем тренера…</p> : null}
          {notice ? <p className="invite-banner invite-banner--success">{notice}</p> : null}
          {inviteError ? <p className="invite-banner invite-banner--error">{inviteError}</p> : null}
          {tab === "home" ? (
            <>
              <AthleteCoachesHomePanel refreshKey={coachesRefreshKey > 0 ? String(coachesRefreshKey) : undefined} />
              <WhoopHomePanel />
            </>
          ) : (
            <AthleteSettings
              user={user}
              onUserUpdated={setUser}
              onOpenThemes={() => setShowThemes(true)}
              onLogout={logout}
              whoopSection={<WhoopSettingsPanel />}
            />
          )}
        </AppShell>
      </>
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
