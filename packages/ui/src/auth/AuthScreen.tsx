import { useState, type FormEvent } from "react";
import {
  clearTokens,
  fetchMe,
  isValidPhone,
  isValidPin,
  login,
  register,
  saveTokens,
} from "@sport-app/api-client";
import type { TokenResponse, UserResponse, UserRole } from "@sport-app/shared";
import { hasRole } from "@sport-app/shared";

import { BrandMark } from "./BrandMark";
import { PhoneInput } from "./PhoneInput";
import { PinInput } from "./PinInput";

export interface AuthScreenConfig {
  role: UserRole;
  roleLabel: string;
  tagline: string;
  /** Самостоятельная регистрация (только атлет) */
  allowRegister?: boolean;
  /** Подпись под формой вместо ссылки на регистрацию */
  loginHint?: string;
  /** Мотивационная строка внизу карточки */
  showStats?: boolean;
  /** Optional hero image URL — положи в public/auth-hero.webp */
  heroImageUrl?: string;
}

interface AuthScreenProps extends AuthScreenConfig {
  onAuthenticated: (user: UserResponse, tokens: TokenResponse) => void;
}

type Mode = "login" | "register";

export function AuthScreen({
  role,
  roleLabel,
  tagline,
  allowRegister = role === "athlete",
  loginHint = allowRegister
    ? undefined
    : role === "admin"
      ? "Доступ только для администраторов"
      : "Аккаунт выдаёт администратор",
  showStats = role !== "admin",
  heroImageUrl,
  onAuthenticated,
}: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit =
    isValidPhone(phone) &&
    isValidPin(pin) &&
    (!allowRegister || mode === "login" || displayName.trim().length >= 1);

  const isRegister = allowRegister && mode === "register";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setLoading(true);
    try {
      const tokens = isRegister
        ? await register({
            phone,
            pin,
            role: role as Exclude<UserRole, "admin">,
            display_name: displayName.trim(),
          })
        : await login({ phone, pin });

      saveTokens(tokens);
      const user = await fetchMe();

      if (!hasRole(user, role)) {
        clearTokens();
        setError("Это приложение не для вашей роли");
        return;
      }

      onAuthenticated(user, tokens);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Что-то пошло не так");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setPin("");
  };

  return (
    <div className="auth-screen">
      <div className="auth-screen__bg" aria-hidden>
        <div className="auth-screen__orb auth-screen__orb--primary" />
        <div className="auth-screen__orb auth-screen__orb--accent" />
        <div className="auth-screen__grid" />
        {heroImageUrl && (
          <img
            src={heroImageUrl}
            alt=""
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: "min(280px, 55vw)",
              opacity: 0.15,
              maskImage: "linear-gradient(to top, black, transparent)",
              WebkitMaskImage: "linear-gradient(to top, black, transparent)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      <span className="auth-screen__role">{roleLabel}</span>

      <div className="auth-screen__content">
        <header className="auth-brand">
          <div className="auth-brand__row">
            <BrandMark size={52} />
            <div className="auth-brand__text">
              <h1 className="auth-brand__name">sport-app</h1>
              <p className="auth-brand__tagline">{tagline}</p>
            </div>
          </div>
        </header>

        <div className="auth-card">
          <h2 className="auth-card__title">{isRegister ? "Регистрация" : "Вход"}</h2>
          {isRegister && (
            <p className="auth-card__subtitle">Создай аккаунт за минуту</p>
          )}

          {error && <p className="auth-error" role="alert">{error}</p>}

          <form onSubmit={handleSubmit}>
            {isRegister && (
              <div className="auth-field">
                <label className="auth-field__label" htmlFor="display-name">
                  Как к тебе обращаться?
                </label>
                <input
                  id="display-name"
                  className="auth-field__input"
                  type="text"
                  autoComplete="name"
                  placeholder="Имя или nickname"
                  value={displayName}
                  disabled={loading}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            )}

            <div className="auth-field">
              <label className="auth-field__label" htmlFor="phone">
                Телефон
              </label>
              <PhoneInput id="phone" value={phone} onChange={setPhone} disabled={loading} />
            </div>

            <div className="auth-field auth-field--pin">
              <label className="auth-field__label" htmlFor="pin">
                PIN
              </label>
              <PinInput id="pin" value={pin} onChange={setPin} disabled={loading} />
            </div>

            <button type="submit" className="auth-submit" disabled={!canSubmit || loading}>
              {loading ? "Загрузка…" : isRegister ? "Создать аккаунт" : "Войти"}
            </button>
          </form>

          {allowRegister && (
            <p className="auth-switch">
              {mode === "login" ? "Нет аккаунта?" : "Уже есть аккаунт?"}
              <button
                type="button"
                className="auth-switch__link"
                onClick={() => switchMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "Зарегистрироваться" : "Войти"}
              </button>
            </p>
          )}

          {!allowRegister && loginHint && <p className="auth-hint">{loginHint}</p>}

          {showStats && role === "athlete" && (
            <p className="auth-stats auth-stats--inline">
              <span className="auth-stats__chip">
                <span className="auth-stats__value">SDT</span>
                <span className="auth-stats__label">научная база</span>
              </span>
              <span className="auth-stats__sep" aria-hidden>
                ·
              </span>
              <span className="auth-stats__chip">
                <span className="auth-stats__value">24/7</span>
                <span className="auth-stats__label">твой прогресс</span>
              </span>
            </p>
          )}

          {showStats && role === "coach" && (
            <p className="auth-stats auth-stats--inline">
              <span className="auth-stats__chip">
                <span className="auth-stats__value">SDT</span>
                <span className="auth-stats__label">научная база</span>
              </span>
              <span className="auth-stats__sep" aria-hidden>
                ·
              </span>
              <span className="auth-stats__chip">
                <span className="auth-stats__value">∞</span>
                <span className="auth-stats__label">программы</span>
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
