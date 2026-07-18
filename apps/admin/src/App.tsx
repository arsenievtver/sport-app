import { useState } from "react";
import { ROLE_LABELS } from "@sport-app/shared";
import { AuthScreen, useAuthSession } from "@sport-app/ui";

import { ActivityCompendiumPage } from "./components/ActivityCompendiumPage";
import { AdminLayout, type AdminPage } from "./components/AdminLayout";
import { CoachCustomWorkoutsPage } from "./components/CoachCustomWorkoutsPage";
import { MealCatalogPage } from "./components/MealCatalogPage";
import { UsersPage } from "./components/UsersPage";
import "./admin.css";

const REQUIRED_ROLE = "admin" as const;

export default function App() {
  const { user, setUser, checking, logout } = useAuthSession(REQUIRED_ROLE);
  const [page, setPage] = useState<AdminPage>("users");

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
        roleLabel={ROLE_LABELS.admin}
        tagline={"Управление платформой\nТренеры, атлеты, доступ"}
        allowRegister={false}
        onAuthenticated={(u) => setUser(u)}
      />
    );
  }

  const pageMeta =
    page === "meal-catalog"
      ? {
          title: "Каталог блюд",
          subtitle: "Синхронизация LogMeal, перевод и готовность поиска для атлетов",
        }
      : page === "activities"
        ? {
            title: "Справочник активностей",
            subtitle: "2024 Adult Compendium — MET, группы и перевод названий",
          }
        : page === "coach-workouts"
          ? {
              title: "Тренировки тренеров",
              subtitle: "Составные тренировки из кабинета тренера — только просмотр",
            }
          : {
              title: "Пользователи",
              subtitle: "Тренеры, атлеты и связи между ними",
            };

  return (
    <AdminLayout
      page={page}
      onNavigate={setPage}
      phone={user.phone}
      onLogout={logout}
      title={pageMeta.title}
      subtitle={pageMeta.subtitle}
    >
      {page === "users" && <UsersPage />}
      {page === "meal-catalog" && <MealCatalogPage />}
      {page === "activities" && <ActivityCompendiumPage />}
      {page === "coach-workouts" && <CoachCustomWorkoutsPage />}
    </AdminLayout>
  );
}
