import type { ReactNode } from "react";

interface AppShellProps {
  title: string;
  subtitle?: string;
  headerEnd?: ReactNode;
  children?: ReactNode;
  bottomNav?: ReactNode;
  className?: string;
}

export function AppShell({ title, subtitle, headerEnd, children, bottomNav, className }: AppShellProps) {
  return (
    <div
      className={`app-shell${bottomNav ? " app-shell--with-bottom-nav" : ""}${subtitle ? " app-shell--with-subtitle" : ""}${className ? ` ${className}` : ""}`}
    >
      <header className="app-shell__header">
        <div className="app-shell__header-bar glass glass--floating-bar">
          <div className="app-shell__header-inner">
            <div className="app-shell__header-text">
              <h1 className="app-shell__title">{title}</h1>
              {subtitle && <p className="app-shell__subtitle">{subtitle}</p>}
            </div>
            {headerEnd}
          </div>
        </div>
      </header>
      <main className="app-shell__main">{children}</main>
      {bottomNav}
    </div>
  );
}

interface StatusBadgeProps {
  ok: boolean;
  label: string;
}

export function StatusBadge({ ok, label }: StatusBadgeProps) {
  return (
    <span className={ok ? "badge badge-success" : "badge badge-danger"}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "var(--radius-full)",
          background: "currentColor",
        }}
      />
      {label}
    </span>
  );
}
