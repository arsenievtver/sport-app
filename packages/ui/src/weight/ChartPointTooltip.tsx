import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

const EDGE_INSET_PX = 4;

interface ChartPointTooltipProps {
  anchorXPercent: number;
  anchorYPercent: number;
  children: ReactNode;
}

/** Tooltip anchored to a chart point; shifts at edges so it stays inside the chart wrap. */
export function ChartPointTooltip({ anchorXPercent, anchorYPercent, children }: ChartPointTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [leftPx, setLeftPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    const wrap = tooltip?.parentElement;
    if (!tooltip || !wrap) return;

    const wrapWidth = wrap.clientWidth;
    const tooltipWidth = tooltip.offsetWidth;
    const anchorX = (anchorXPercent / 100) * wrapWidth;
    const nextLeft = Math.max(
      EDGE_INSET_PX,
      Math.min(wrapWidth - tooltipWidth - EDGE_INSET_PX, anchorX - tooltipWidth / 2),
    );
    setLeftPx(nextLeft);
  }, [anchorXPercent, anchorYPercent, children]);

  return (
    <div
      ref={tooltipRef}
      className="weight-dynamics__tooltip weight-dynamics__tooltip--anchored"
      style={{
        left: leftPx ?? 0,
        top: `${anchorYPercent}%`,
        visibility: leftPx == null ? "hidden" : "visible",
      }}
    >
      {children}
    </div>
  );
}
