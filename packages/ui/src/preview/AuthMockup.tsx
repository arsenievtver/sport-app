import { BrandMark } from "../auth/BrandMark";
import { ROLE_LABELS } from "@sport-app/shared";

/** Уменьшенный mock экрана входа — наследует CSS vars от родителя data-theme */
export function AuthMockup() {
  return (
    <div className="auth-screen">
      <div className="auth-screen__bg" aria-hidden>
        <div className="auth-screen__orb auth-screen__orb--primary" />
        <div className="auth-screen__orb auth-screen__orb--accent" />
        <div className="auth-screen__grid" />
      </div>
      <div className="auth-screen__content" style={{ paddingBottom: "var(--space-4)" }}>
        <header className="auth-brand" style={{ marginBottom: "var(--space-5)" }}>
          <BrandMark size={56} />
          <h1 className="auth-brand__name">sport-app</h1>
          <p className="auth-brand__tagline">Тренировки с тренером</p>
          <span className="auth-brand__role">{ROLE_LABELS.athlete}</span>
        </header>
        <div className="auth-card">
          <h2 className="auth-card__title">Вход</h2>
          <p className="auth-card__subtitle">Телефон и PIN</p>
          <div className="auth-field">
            <span className="auth-field__label">Номер телефона</span>
            <div className="auth-field__input" style={{ display: "flex", alignItems: "center" }}>
              +7 (910) 649-27-42
            </div>
          </div>
          <div className="auth-field">
            <span className="auth-field__label">PIN-код</span>
            <div className="auth-pin">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="auth-pin__cell auth-pin__cell--filled"
                  style={{ pointerEvents: "none" }}
                >
                  •
                </div>
              ))}
            </div>
          </div>
          <button type="button" className="auth-submit" tabIndex={-1}>
            Войти
          </button>
          <div className="auth-stats">
            <div className="auth-stats__item">
              <span className="auth-stats__value">SDT</span>
              <span className="auth-stats__label">научная база</span>
            </div>
            <div className="auth-stats__item">
              <span className="auth-stats__value">24/7</span>
              <span className="auth-stats__label">прогресс</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
