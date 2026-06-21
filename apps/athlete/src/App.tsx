import { useEffect, useState, type ReactNode } from "react";
import {
  captureInviteCodeFromUrl,
  isAthleteOnboardingComplete,
  readPendingInviteCode,
  ROLE_LABELS,
} from "@sport-app/shared";
import {
  AppShell,
  AthleteMyPlanPanel,
  AthleteOnboarding,
  AthleteQuickActions,
  AthleteSettings,
  AthleteWeekProgressPanel,
  AthleteWorkoutsPanel,
  AuthScreen,
  BottomNav,
  BottomNavIconAdd,
  BottomNavIconHome,
  BottomNavIconSettings,
  isThemePreviewMode,
  PwaInstallBanner,
  ThemePreview,
  useAuthSession,
  usePendingCoachInvite,
  PullToRefresh,
  useAthleteSessionsStats,
  WorkoutsCompletedBadge,
  type AthleteQuickActionId,
} from "@sport-app/ui";
import { WhoopOAuthListener } from "./components/WhoopOAuthListener";
import { AthleteDataTabPanel } from "./components/AthleteDataTabPanel";
import { AthleteNutritionPanel } from "./components/AthleteNutritionPanel";
import { BottomNavIconData } from "./components/BottomNavIconData";
import { WhoopSettingsPanel } from "./components/WhoopSettingsPanel";
import { AthleteUpcomingSessionsPanel } from "./components/AthleteUpcomingSessionsPanel";
import { AthleteLastSessionPanel } from "./components/AthleteLastSessionPanel";
import { AthleteAddWorkoutModal } from "./components/AthleteAddWorkoutModal";
import "./components/whoop.css";

type AthleteTab = "home" | "data" | "settings";
type HomeOverlay = AthleteQuickActionId | null;

const TAB_TITLES: Record<AthleteTab, string | ((name: string) => string)> = {
  home: (name) => `Привет, ${name}!`,
  data: "Данные",
  settings: "Настройки",
};

export default function App() {
  const { user, setUser, checking, logout } = useAuthSession("athlete");
  const [showThemes, setShowThemes] = useState(isThemePreviewMode());
  const [tab, setTab] = useState<AthleteTab>(() => {
    const whoop = new URLSearchParams(window.location.search).get("whoop");
    return whoop ? "data" : "home";
  });
  const [addWorkoutOpen, setAddWorkoutOpen] = useState(false);
  const [homeOverlay, setHomeOverlay] = useState<HomeOverlay>(null);
  const [weekProgressRefreshKey, setWeekProgressRefreshKey] = useState(0);
  const [openWeightFormSignal, setOpenWeightFormSignal] = useState(0);
  const [returnToWorkoutAfterWeight, setReturnToWorkoutAfterWeight] = useState(false);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(() => readPendingInviteCode());

  useEffect(() => {
    const code = captureInviteCodeFromUrl();
    if (code) setPendingInviteCode(code);
  }, []);

  const onboardingComplete = Boolean(user && isAthleteOnboardingComplete(user.athlete_profile));
  const { joining, notice, coachesRefreshKey, error: inviteError } = usePendingCoachInvite(onboardingComplete);
  const {
    sessionsCompleted,
    loading: sessionsStatsLoading,
    refresh: refreshSessionsStats,
    setSessionsCompleted,
  } = useAthleteSessionsStats(onboardingComplete);

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
        id: "data",
        label: "Данные",
        icon: <BottomNavIconData />,
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
          contentKey={tab}
          headerEnd={
            <WorkoutsCompletedBadge count={sessionsCompleted} animate={!sessionsStatsLoading} />
          }
          bottomNav={
            <BottomNav
              items={navItems}
              activeId={tab}
              showLabels
              onChange={(id) => setTab(id as AthleteTab)}
              action={{
                id: "add-activity",
                label: "Добавить активность",
                icon: <BottomNavIconAdd />,
                active: addWorkoutOpen,
                onClick: () => setAddWorkoutOpen(true),
              }}
            />
          }
        >
          {tab === "home" ? (
            homeOverlay === "my-plan" ? (
              <AthleteMyPlanPanel
                onBack={() => setHomeOverlay(null)}
                onSaved={() => setWeekProgressRefreshKey((value) => value + 1)}
              />
            ) : homeOverlay === "nutrition" ? (
              <AthleteNutritionPanel onBack={() => setHomeOverlay(null)} />
            ) : homeOverlay === "workouts" ? (
              <AthleteWorkoutsPanel
                refreshKey={sessionsCompleted}
                onBack={() => setHomeOverlay(null)}
              />
            ) : (
              <PullToRefresh
                onRefresh={async () => {
                  await refreshSessionsStats();
                  setWeekProgressRefreshKey((value) => value + 1);
                }}
              >
                {joining ? <p className="invite-banner invite-banner--info">Подключаем тренера…</p> : null}
                {notice ? <p className="invite-banner invite-banner--success">{notice}</p> : null}
                {inviteError ? <p className="invite-banner invite-banner--error">{inviteError}</p> : null}
                <AthleteWeekProgressPanel
                  refreshKey={`${coachesRefreshKey}-${weekProgressRefreshKey}-${sessionsCompleted}`}
                />
                <AthleteQuickActions onAction={setHomeOverlay} />
                <AthleteUpcomingSessionsPanel refreshKey={coachesRefreshKey > 0 ? String(coachesRefreshKey) : undefined} />
                <AthleteLastSessionPanel refreshKey={sessionsCompleted} />
              </PullToRefresh>
            )
          ) : null}
          {tab === "data" ? (
            <AthleteDataTabPanel
              openWeightFormSignal={openWeightFormSignal}
              onWeightMeasurementAdded={() => {
                if (returnToWorkoutAfterWeight) {
                  setReturnToWorkoutAfterWeight(false);
                  setAddWorkoutOpen(true);
                }
              }}
            />
          ) : null}
          {tab === "settings" ? (
            <AthleteSettings
              user={user}
              onUserUpdated={setUser}
              onOpenThemes={() => setShowThemes(true)}
              onLogout={logout}
              whoopSection={<WhoopSettingsPanel />}
            />
          ) : null}
        </AppShell>
        <AthleteAddWorkoutModal
          open={addWorkoutOpen}
          refreshKey={coachesRefreshKey > 0 ? String(coachesRefreshKey) : undefined}
          onClose={() => setAddWorkoutOpen(false)}
          onGoToWeightData={() => {
            setAddWorkoutOpen(false);
            setReturnToWorkoutAfterWeight(true);
            setOpenWeightFormSignal((value) => value + 1);
            setTab("data");
          }}
          onWorkoutAdded={(count) => {
            setSessionsCompleted(count);
            setWeekProgressRefreshKey((value) => value + 1);
          }}
        />
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
