import { theme } from "../theme";

/** Lucide-style icons: 24×24 viewBox. */
export const ICON_VIEW_BOX = "0 0 24 24";

/** Shared stroke props for UI icons (see --icon-stroke-width in tokens.css). */
export const iconStrokeProps = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: theme.icon.strokeWidth,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Same visual weight when viewBox is not 24×24. */
export function iconStrokeWidthForViewBox(viewBoxSize: number): number {
  return theme.icon.strokeWidth * (viewBoxSize / 24);
}
