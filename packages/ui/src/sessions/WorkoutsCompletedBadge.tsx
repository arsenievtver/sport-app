interface WorkoutsCompletedBadgeProps {
  count: number;
}

export function WorkoutsCompletedBadge({ count }: WorkoutsCompletedBadgeProps) {
  return (
    <span className="workouts-completed-badge glass glass--pill" aria-label={`Тренировок: ${count}`}>
      <span className="workouts-completed-badge__lightning" aria-hidden="true" />
      <span className="workouts-completed-badge__fire" aria-hidden="true">
        🔥
      </span>
      <span className="workouts-completed-badge__count">{count}</span>
    </span>
  );
}
