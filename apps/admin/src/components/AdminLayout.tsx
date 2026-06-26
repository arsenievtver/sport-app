import { useCallback, useEffect, useState, type ReactNode } from "react";

export type AdminPage = "users" | "meal-catalog" | "activities";

const SIDEBAR_STORAGE_KEY = "sport-admin-sidebar-collapsed";

interface AdminLayoutProps {
  page: AdminPage;
  onNavigate: (page: AdminPage) => void;
  phone: string;
  onLogout: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

const NAV_ITEMS: { id: AdminPage; label: string }[] = [
  { id: "users", label: "Пользователи" },
  { id: "meal-catalog", label: "Каталог блюд" },
  { id: "activities", label: "Активности" },
];

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function AdminLayout({
  page,
  onNavigate,
  phone,
  onLogout,
  title,
  subtitle,
  children,
}: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    document.body.classList.toggle("admin-sidebar-open", !sidebarCollapsed);
    return () => {
      document.body.classList.remove("admin-sidebar-open");
    };
  }, [sidebarCollapsed]);

  const navigate = (nextPage: AdminPage) => {
    onNavigate(nextPage);
    if (window.matchMedia("(max-width: 768px)").matches) {
      setSidebarCollapsed(true);
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div className={`admin-layout${sidebarCollapsed ? " admin-layout--sidebar-collapsed" : ""}`}>
      {!sidebarCollapsed ? (
        <button
          type="button"
          className="admin-sidebar-backdrop"
          aria-label="Закрыть меню"
          onClick={toggleSidebar}
        />
      ) : null}

      <aside className="admin-sidebar" aria-hidden={sidebarCollapsed}>
        <h1 className="admin-sidebar__brand">Sport Admin</h1>
        <nav className="admin-sidebar__nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`admin-nav-item${page === item.id ? " admin-nav-item--active" : ""}`}
              onClick={() => navigate(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar__footer">
          <p className="admin-sidebar__user">{phone}</p>
          <button type="button" className="admin-btn" onClick={onLogout}>
            Выйти
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-header">
          <button
            type="button"
            className="admin-sidebar-toggle"
            aria-expanded={!sidebarCollapsed}
            aria-label={sidebarCollapsed ? "Открыть меню" : "Скрыть меню"}
            onClick={toggleSidebar}
          >
            <span className="admin-sidebar-toggle__bar" aria-hidden="true" />
            <span className="admin-sidebar-toggle__bar" aria-hidden="true" />
            <span className="admin-sidebar-toggle__bar" aria-hidden="true" />
          </button>
          <div className="admin-header__text">
            <h2 className="admin-header__title">{title}</h2>
            {subtitle ? <p className="admin-header__subtitle">{subtitle}</p> : null}
          </div>
        </header>
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
