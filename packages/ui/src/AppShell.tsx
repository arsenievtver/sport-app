import { useLayoutEffect, type ReactNode } from "react";

import { syncViewportHeight } from "./viewport";

interface AppShellProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  bottomNav?: ReactNode;
}

export function AppShell({ title, subtitle, children, bottomNav }: AppShellProps) {
  useLayoutEffect(() => {
    syncViewportHeight();
    const frame = requestAnimationFrame(syncViewportHeight);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={`app-shell${bottomNav ? " app-shell--with-bottom-nav" : ""}${subtitle ? " app-shell--with-subtitle" : ""}`}
    >
      <div className="app-shell__bg" aria-hidden />
      <header className="app-shell__header">
        <div className="app-shell__header-bar glass glass--floating-bar">
          <h1 className="app-shell__title">{title}</h1>
          {subtitle && <p className="app-shell__subtitle">{subtitle}</p>}
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
