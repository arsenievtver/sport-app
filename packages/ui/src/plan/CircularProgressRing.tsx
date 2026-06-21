import { getPlanCompletionTone } from "@sport-app/shared";
import "./athlete-plan.css";

interface CircularProgressRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  label: string;
  sublabel?: string;
  animateFill?: boolean;
}

export function CircularProgressRing({
  percent,
  size = 120,
  strokeWidth = 10,
  label,
  sublabel,
  animateFill = false,
}: CircularProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;
  const center = size / 2;
  const tone = getPlanCompletionTone(clamped);

  return (
    <div
      className="progress-ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}${sublabel ? `, ${sublabel}` : ""}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="progress-ring__track"
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          className={`progress-ring__fill progress-ring__fill--${tone}${animateFill ? " progress-ring__fill--live" : ""}`}
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="progress-ring__center">
        <span className={`progress-ring__value progress-ring__value--${tone}`}>{label}</span>
        {sublabel ? <span className="progress-ring__sublabel">{sublabel}</span> : null}
      </div>
    </div>
  );
}
