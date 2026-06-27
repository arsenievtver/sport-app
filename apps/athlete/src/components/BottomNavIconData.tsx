import { ICON_VIEW_BOX, iconStrokeProps } from "@sport-app/ui";

/** Form / clipboard — stroke redraw of Form-doc.svg, matches other bottom-nav icons. */
export function BottomNavIconData() {
  return (
    <svg
      className="bottom-nav__icon bottom-nav__icon--data"
      viewBox={ICON_VIEW_BOX}
      aria-hidden="true"
      {...iconStrokeProps}
    >
      <rect x="9" y="2.5" width="6" height="3" rx="1" />
      <path d="M7 5.5h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2z" />
      <path d="M9 11h6" />
      <path d="M9 14h6" />
      <path d="M9 17h4" />
    </svg>
  );
}
