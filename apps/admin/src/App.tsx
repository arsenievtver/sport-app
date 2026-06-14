import { useEffect, useState } from "react";
import { clearTokens, fetchMe, getAccessToken } from "@sport-app/api-client";
import { hasRole, ROLE_LABELS } from "@sport-app/shared";
import type { UserResponse } from "@sport-app/shared";
import { AuthScreen } from "@sport-app/ui";

import { AdminLayout, type AdminPage } from "./components/AdminLayout";
import { UsersPage } from "./components/UsersPage";
import "./admin.css";

const REQUIRED_ROLE = "admin" as const;

export default function App() {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState<AdminPage>("users");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setChecking(false);
      return;
    }
    fetchMe(token)
      .then((u) => {
        if (!hasRole(u, REQUIRED_ROLE)) {
          clearTokens();
          return;
        }
        setUser(u);
      })
      .catch(() => clearTokens())
      .finally(() => setChecking(false));
  }, []);

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

  return (
    <AdminLayout
      page={page}
      onNavigate={setPage}
      phone={user.phone}
      onLogout={() => {
        clearTokens();
        setUser(null);
      }}
      title="Пользователи"
      subtitle="Тренеры, атлеты и связи между ними"
    >
      {page === "users" && <UsersPage />}
    </AdminLayout>
  );
}
