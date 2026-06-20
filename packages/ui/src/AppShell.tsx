import { useEffect, useRef, type ReactNode } from "react";

function getScrollTop(): number {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

const TOP_LOCK_PX = 8;
const HIDE_AFTER_PX = 24;

function useScrollHeaderAutoHide(enabled: boolean) {
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shell = shellRef.current;
    if (!enabled || !shell) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let hidden = false;
    let rafId = 0;

    const apply = () => {
      const scrollY = getScrollTop();

      if (scrollY <= TOP_LOCK_PX) {
        hidden = false;
      } else if (scrollY > HIDE_AFTER_PX) {
        hidden = true;
      }

      shell.classList.toggle("app-shell--header-hidden", hidden);
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(apply);
    };

    shell.classList.add("app-shell--scroll-header-autohide");
    apply();

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      shell.classList.remove("app-shell--scroll-header-autohide", "app-shell--header-hidden");
    };
  }, [enabled]);

  return shellRef;
}

interface AppShellProps {
  title: string;
  subtitle?: string;
  headerEnd?: ReactNode;
  children?: ReactNode;
  bottomNav?: ReactNode;
  className?: string;
  scrollHeaderFade?: boolean;
}

export function AppShell({
  title,
  subtitle,
  headerEnd,
  children,
  bottomNav,
  className,
  scrollHeaderFade = true,
}: AppShellProps) {
  const shellRef = useScrollHeaderAutoHide(scrollHeaderFade);

  return (
    <div
      ref={shellRef}
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
