export type SessionsBalanceTone = "low" | "mid" | "high";

export function getSessionsBalanceTone(balance: number): SessionsBalanceTone {
  if (balance <= 0) return "low";
  if (balance <= 2) return "mid";
  return "high";
}

interface SessionsBalanceBadgeProps {
  balance: number;
}

export function SessionsBalanceBadge({ balance }: SessionsBalanceBadgeProps) {
  const tone = getSessionsBalanceTone(balance);

  return (
    <span className={`sessions-balance sessions-balance--${tone}`}>
      Баланс: {balance}
    </span>
  );
}

interface SessionsBalanceCircleProps {
  balance: number;
  onClick?: () => void;
}

export function SessionsBalanceCircle({ balance, onClick }: SessionsBalanceCircleProps) {
  const tone = getSessionsBalanceTone(balance);
  const className = `sessions-balance sessions-balance--circle sessions-balance--${tone}`;
  const label = `Баланс: ${balance}`;

  if (onClick) {
    return (
      <button
        type="button"
        className={`sessions-balance-btn ${className}`}
        aria-label={`${label}. Добавить тренировки`}
        title="Добавить тренировки на баланс"
        onClick={onClick}
      >
        {balance}
      </button>
    );
  }

  return (
    <span className={className} aria-label={label}>
      {balance}
    </span>
  );
}
