import type { ReactNode } from "react";

interface AppShellProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function AppShell({ title, subtitle, children }: AppShellProps) {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header className="glass glass--bar" style={{ minHeight: "var(--header-height)", padding: "var(--space-4) var(--space-5)" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-xl)",
            fontWeight: "var(--font-semibold)",
            letterSpacing: "var(--tracking-tight)",
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              margin: "var(--space-1) 0 0",
              color: "var(--color-text-secondary)",
              fontSize: "var(--text-sm)",
            }}
          >
            {subtitle}
          </p>
        )}
      </header>
      <main
        style={{
          flex: 1,
          padding: "var(--space-5)",
          maxWidth: "var(--content-max-width)",
          width: "100%",
          margin: "0 auto",
        }}
      >
        {children}
      </main>
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
