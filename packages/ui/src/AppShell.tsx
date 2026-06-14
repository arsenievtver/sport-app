import type { ReactNode } from "react";

interface AppShellProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function AppShell({ title, subtitle, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="app-shell__header glass glass--bar">
        <h1 className="app-shell__title">{title}</h1>
        {subtitle && <p className="app-shell__subtitle">{subtitle}</p>}
      </header>
      <main className="app-shell__main">{children}</main>
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
