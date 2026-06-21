import { useCountUp } from "../hooks/useCountUp";

interface WorkoutsCompletedBadgeProps {
  count: number;
  animate?: boolean;
}

export function WorkoutsCompletedBadge({ count, animate = true }: WorkoutsCompletedBadgeProps) {
  const displayCount = useCountUp(count, { enabled: animate, duration: 850, delay: 200 });

  return (
    <span className="workouts-completed-badge glass glass--pill" aria-label={`Тренировок: ${count}`}>
      <span className="workouts-completed-badge__lightning" aria-hidden="true" />
      <span className="workouts-completed-badge__fire" aria-hidden="true">
        🔥
      </span>
      <span className="workouts-completed-badge__count">{displayCount}</span>
    </span>
  );
}
