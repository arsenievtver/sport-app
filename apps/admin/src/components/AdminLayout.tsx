import type { ReactNode } from "react";

export type AdminPage = "users" | "meal-catalog";

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
];

export function AdminLayout({
  page,
  onNavigate,
  phone,
  onLogout,
  title,
  subtitle,
  children,
}: AdminLayoutProps) {
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <h1 className="admin-sidebar__brand">Sport Admin</h1>
        <nav className="admin-sidebar__nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`admin-nav-item${page === item.id ? " admin-nav-item--active" : ""}`}
              onClick={() => onNavigate(item.id)}
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
          <h2 className="admin-header__title">{title}</h2>
          {subtitle && <p className="admin-header__subtitle">{subtitle}</p>}
        </header>
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
