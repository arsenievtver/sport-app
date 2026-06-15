import type { CSSProperties, ReactNode } from "react";

export interface BottomNavItem {
  id: string;
  label: string;
  icon: ReactNode;
}

interface BottomNavProps {
  items: BottomNavItem[];
  activeId: string;
  onChange: (id: string) => void;
}

export function BottomNav({ items, activeId, onChange }: BottomNavProps) {
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === activeId),
  );

  const itemsStyle = {
    "--bottom-nav-active-index": activeIndex,
  } as CSSProperties;

  return (
    <nav className="bottom-nav" aria-label="Основное меню">
      <div className="bottom-nav__bar glass">
        <div className="bottom-nav__items" style={itemsStyle}>
          <div className="bottom-nav__spotlight-track" aria-hidden="true">
            <div className="bottom-nav__spotlight" />
          </div>
          {items.map((item) => {
            const isActive = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                className={`bottom-nav__item${isActive ? " bottom-nav__item--active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
                onClick={() => onChange(item.id)}
              >
                <span className="bottom-nav__icon-wrap">{item.icon}</span>
              </button>
            );
          })}
        </div>
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
