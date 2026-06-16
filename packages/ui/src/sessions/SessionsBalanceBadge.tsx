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
}

export function SessionsBalanceCircle({ balance }: SessionsBalanceCircleProps) {
  const tone = getSessionsBalanceTone(balance);

  return (
    <span className={`sessions-balance sessions-balance--circle sessions-balance--${tone}`} aria-label={`Баланс: ${balance}`}>
      {balance}
    </span>
  );
}
