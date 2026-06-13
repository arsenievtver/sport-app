import { useState, type FormEvent } from "react";
import {
  fetchMe,
  isValidPhone,
  isValidPin,
  login,
  register,
  saveTokens,
} from "@sport-app/api-client";
import type { TokenResponse, UserResponse } from "@sport-app/shared";

import { BrandMark } from "./BrandMark";
import { PhoneInput } from "./PhoneInput";
import { PinInput } from "./PinInput";

export interface AuthScreenConfig {
  role: "athlete" | "coach";
  roleLabel: string;
  tagline: string;
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
    (mode === "login" || displayName.trim().length >= 1);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setLoading(true);
    try {
      const tokens =
        mode === "login"
          ? await login({ phone, pin })
          : await register({ phone, pin, role, display_name: displayName.trim() });

      saveTokens(tokens);
      const user = await fetchMe(tokens.access_token);
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

      <div className="auth-screen__content">
        <header className="auth-brand">
          <BrandMark size={72} />
          <h1 className="auth-brand__name">sport-app</h1>
          <p className="auth-brand__tagline">{tagline}</p>
          <span className="auth-brand__role">{roleLabel}</span>
        </header>

        <div className="auth-card">
          <h2 className="auth-card__title">{mode === "login" ? "Вход" : "Регистрация"}</h2>
          <p className="auth-card__subtitle">
            {mode === "login"
              ? "Телефон и PIN-код из 6 цифр"
              : "Создай аккаунт за минуту"}
          </p>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <form onSubmit={handleSubmit}>
            {mode === "register" && (
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
                Номер телефона
              </label>
              <PhoneInput id="phone" value={phone} onChange={setPhone} disabled={loading} />
            </div>

            <div className="auth-field">
              <label className="auth-field__label" htmlFor="pin">
                PIN-код
              </label>
              <PinInput id="pin" value={pin} onChange={setPin} disabled={loading} />
            </div>

            <button type="submit" className="auth-submit" disabled={!canSubmit || loading}>
              {loading ? "Загрузка…" : mode === "login" ? "Войти" : "Создать аккаунт"}
            </button>
          </form>

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

          {role === "athlete" && (
            <div className="auth-stats">
              <div className="auth-stats__item">
                <span className="auth-stats__value">SDT</span>
                <span className="auth-stats__label">научная база</span>
              </div>
              <div className="auth-stats__item">
                <span className="auth-stats__value">24/7</span>
                <span className="auth-stats__label">твой прогресс</span>
              </div>
            </div>
          )}

          {role === "coach" && (
            <div className="auth-stats">
              <div className="auth-stats__item">
                <span className="auth-stats__value">B2B</span>
                <span className="auth-stats__label">клиенты</span>
              </div>
              <div className="auth-stats__item">
                <span className="auth-stats__value">∞</span>
                <span className="auth-stats__label">программы</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
