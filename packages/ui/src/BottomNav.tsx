import type { CSSProperties, ReactNode } from "react";

export interface BottomNavItem {
  id: string;
  label: string;
  icon: ReactNode;
}

export interface BottomNavAction {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
}

interface BottomNavProps {
  items: BottomNavItem[];
  activeId: string;
  onChange: (id: string) => void;
  action?: BottomNavAction;
  showLabels?: boolean;
}

export function BottomNav({ items, activeId, onChange, action, showLabels = false }: BottomNavProps) {
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === activeId),
  );

  const itemsStyle = {
    "--bottom-nav-active-index": activeIndex,
    "--bottom-nav-item-count": items.length,
  } as CSSProperties;

  const compact = items.length >= 4 && !showLabels;
  const split = Boolean(action);

  const navItems = (
    <div
      className={`bottom-nav__items${compact ? " bottom-nav__items--compact" : ""}${showLabels ? " bottom-nav__items--labeled" : ""}`}
      style={itemsStyle}
    >
      <div className="bottom-nav__spotlight-track" aria-hidden="true">
        <div className="bottom-nav__spotlight" />
      </div>
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            className={`bottom-nav__item${isActive ? " bottom-nav__item--active" : ""}${showLabels ? " bottom-nav__item--labeled" : ""}`}
            aria-current={isActive ? "page" : undefined}
            aria-label={item.label}
            onClick={() => onChange(item.id)}
          >
            <span className="bottom-nav__icon-wrap">{item.icon}</span>
            {showLabels ? <span className="bottom-nav__label">{item.label}</span> : null}
          </button>
        );
      })}
    </div>
  );

  return (
    <nav
      className={`bottom-nav${split ? " bottom-nav--split" : ""}${showLabels ? " bottom-nav--labeled" : ""}`}
      aria-label="Основное меню"
    >
      <div className="bottom-nav__cluster">
        <div className="bottom-nav__bar glass">{navItems}</div>
        {action ? (
          <div className="bottom-nav__action-bar glass">
            <button
              type="button"
              className={`bottom-nav__action${action.active ? " bottom-nav__action--active" : ""}`}
              aria-label={action.label}
              aria-pressed={action.active}
              onClick={action.onClick}
            >
              <span className="bottom-nav__action-icon-wrap">{action.icon}</span>
            </button>
          </div>
        ) : null}
      </div>
    </nav>
  );
}

export function BottomNavIconHome() {
  return (
    <svg
      className="bottom-nav__icon bottom-nav__icon--home"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 10.5 12 4.75 19.5 10.5" />
      <path d="M6.25 10.25V18.5a1 1 0 0 0 1 1h9.5a1 1 0 0 0 1-1V10.25" />
      <path d="M10 18.5v-5.25h4V18.5" />
    </svg>
  );
}

export function BottomNavIconAthletes() {
  return (
    <svg
      className="bottom-nav__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function BottomNavIconInvite() {
  return (
    <svg
      className="bottom-nav__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6" />
      <path d="M22 11h-6" />
    </svg>
  );
}

export function BottomNavIconSchedule() {
  return (
    <svg
      className="bottom-nav__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 3v3" />
      <path d="M16 3v3" />
      <path d="M8 13h2" />
      <path d="M14 13h2" />
      <path d="M8 17h2" />
    </svg>
  );
}

export function BottomNavIconSettings() {
  return (
    <svg
      className="bottom-nav__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

export function BottomNavIconStats() {
  return (
    <svg
      className="bottom-nav__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 19V13" />
      <path d="M12 19V7" />
      <path d="M19 19V10" />
      <path d="M3 19h18" />
    </svg>
  );
}

export function BottomNavIconAdd() {
  return (
    <svg
      className="bottom-nav__icon bottom-nav__icon--add"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
