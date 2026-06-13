export function BrandMark({ size = 64 }: { size?: number }) {
  return (
    <svg
      className="auth-brand__logo"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="brand-grad" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--color-primary)" />
          <stop offset="1" stopColor="var(--color-success)" />
        </linearGradient>
        <linearGradient id="brand-accent" x1="32" y1="20" x2="32" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--color-accent)" stopOpacity="0.9" />
          <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" stroke="url(#brand-grad)" strokeWidth="2" opacity="0.25" />
      <path
        d="M18 38 C22 28, 28 22, 32 22 C36 22, 42 28, 46 38"
        stroke="url(#brand-grad)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M22 42 L32 26 L42 42"
        stroke="url(#brand-accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="32" cy="44" r="3" fill="url(#brand-grad)" />
    </svg>
  );
}
