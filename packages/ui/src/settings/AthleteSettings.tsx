import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  fetchAthleteCoaches,
  formatPhoneDisplay,
  joinAthleteCoach,
  resolveMediaUrl,
  updateAthleteProfile,
  uploadAthleteAvatar,
} from "@sport-app/api-client";
import {
  calculateAge,
  formatBirthDateDisplay,
  GENDER_LABELS,
  type AthleteCoachLink,
  type Gender,
  type UserResponse,
} from "@sport-app/shared";

import { AvatarCropModal } from "./AvatarCropModal";

interface AthleteSettingsProps {
  user: UserResponse;
  onUserUpdated: (user: UserResponse) => void;
  onOpenThemes: () => void;
  onLogout: () => void;
}

function SettingsSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const sectionId = `settings-section-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <section className={`settings-section glass glass--panel${open ? " settings-section--open" : ""}`}>
      <button
        type="button"
        className="settings-section__toggle"
        aria-expanded={open}
        aria-controls={sectionId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="settings-section__title">{title}</span>
        <span className="settings-section__chevron" aria-hidden="true" />
      </button>
      {open ? (
        <div className="settings-section__body" id={sectionId}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

function SettingsRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row__label">{label}</div>
      <div className="settings-row__value">{value}</div>
      {hint ? <div className="settings-row__hint">{hint}</div> : null}
    </div>
  );
}

export function AthleteSettings({
  user,
  onUserUpdated,
  onOpenThemes,
  onLogout,
}: AthleteSettingsProps) {
  const profile = user.athlete_profile;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [gender, setGender] = useState<Gender | "">(profile?.gender ?? "");
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? "");
  const [coaches, setCoaches] = useState<AthleteCoachLink[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [loadingCoaches, setLoadingCoaches] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCoach, setSavingCoach] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const avatarUrl = resolveMediaUrl(profile?.avatar_url);
  const age = calculateAge(birthDate);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setGender(profile?.gender ?? "");
    setBirthDate(profile?.birth_date ?? "");
  }, [profile?.display_name, profile?.gender, profile?.birth_date]);

  useEffect(() => {
    let cancelled = false;
    setLoadingCoaches(true);
    fetchAthleteCoaches()
      .then((items) => {
        if (!cancelled) setCoaches(items);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(`Тренеры: ${err.message}`);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCoaches(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const showMessage = (message: string) => {
    setSuccess(message);
    setError(null);
    window.setTimeout(() => setSuccess(null), 2500);
  };

  const handleProfileSave = async () => {
    if (!gender || !birthDate.trim()) {
      setError("Укажите пол и дату рождения");
      return;
    }
    setSavingProfile(true);
    setError(null);
    try {
      const updated = await updateAthleteProfile({
        display_name: displayName.trim(),
        gender,
        birth_date: birthDate,
      });
      onUserUpdated(updated);
      showMessage("Профиль сохранён");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить профиль");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Выберите изображение");
      return;
    }
    setCropFile(file);
  };

  const handleAvatarUpload = async (blob: Blob) => {
    const updated = await uploadAthleteAvatar(blob);
    onUserUpdated(updated);
    setCropFile(null);
    showMessage("Фото обновлено");
  };

  const handleJoinCoach = async () => {
    const code = inviteCode.trim();
    if (!code) return;
    setSavingCoach(true);
    setError(null);
    try {
      const link = await joinAthleteCoach({ invite_code: code });
      setCoaches((prev) => [...prev.filter((item) => item.link_id !== link.link_id), link]);
      setInviteCode("");
      showMessage("Тренер добавлен");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить тренера");
    } finally {
      setSavingCoach(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-avatar">
        <button
          type="button"
          className="settings-avatar__button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Изменить фото профиля"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="settings-avatar__image" />
          ) : (
            <span className="settings-avatar__placeholder">{displayName.slice(0, 1).toUpperCase() || "?"}</span>
          )}
          <span className="settings-avatar__badge">Изменить</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="settings-avatar__input"
          onChange={handleAvatarPick}
        />
      </div>

      {error ? <p className="settings-message settings-message--error">{error}</p> : null}
      {success ? <p className="settings-message settings-message--success">{success}</p> : null}

      <SettingsSection title="Аккаунт">
        <SettingsRow label="Телефон" value={formatPhoneDisplay(user.phone)} hint="Изменение номера скоро" />
        <SettingsRow label="PIN" value="••••••" hint="Изменение PIN скоро" />
        <label className="settings-field">
          <span className="settings-field__label">Имя</span>
          <input
            className="settings-field__input glass-input"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={120}
          />
        </label>
      </SettingsSection>

      <SettingsSection title="Личные данные">
        <div className="settings-field-grid">
          <label className="settings-field">
            <span className="settings-field__label">Пол</span>
            <select
              className="settings-field__input glass-input"
              value={gender}
              onChange={(event) => setGender(event.target.value as Gender | "")}
            >
              <option value="">Не указан</option>
              <option value="male">{GENDER_LABELS.male}</option>
              <option value="female">{GENDER_LABELS.female}</option>
            </select>
          </label>
          <label className="settings-field">
            <span className="settings-field__label">Дата рождения</span>
            <input
              className="settings-field__input glass-input"
              type="date"
              value={birthDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setBirthDate(event.target.value)}
            />
          </label>
        </div>
        <SettingsRow
          label="Возраст"
          value={age !== null ? `${age} лет` : "—"}
          hint={birthDate ? formatBirthDateDisplay(birthDate) : undefined}
        />
        <button
          type="button"
          className="settings-btn settings-btn--primary"
          onClick={() => void handleProfileSave()}
          disabled={savingProfile}
        >
          {savingProfile ? "Сохранение…" : "Сохранить профиль"}
        </button>
      </SettingsSection>

      <SettingsSection title="Физические данные">
        <p className="settings-placeholder">
          Скоро: вес, рост, целевой диапазон и другие параметры для программы тренировок.
        </p>
      </SettingsSection>

      <SettingsSection title="Результаты тренировок">
        <p className="settings-placeholder">
          Скоро: история тренировок, прогресс и личные рекорды.
        </p>
      </SettingsSection>

      <SettingsSection title="Тренеры">
        <p className="settings-section__lead">
          Выберите одного или нескольких тренеров — они увидят ваши цели, результаты и смогут назначать
          тренировки.
        </p>

        {loadingCoaches ? (
          <p className="settings-placeholder">Загрузка…</p>
        ) : coaches.length > 0 ? (
          <ul className="settings-coach-list">
            {coaches.map((coach) => {
              const coachAvatarUrl = resolveMediaUrl(coach.avatar_url);
              const initial = (coach.display_name?.slice(0, 1) ?? "?").toUpperCase();

              return (
                <li key={coach.link_id} className="settings-coach-list__item">
                  <div className="settings-coach-list__identity">
                    {coachAvatarUrl ? (
                      <img src={coachAvatarUrl} alt="" className="settings-coach-list__avatar" />
                    ) : (
                      <div className="settings-coach-list__avatar settings-coach-list__avatar--placeholder" aria-hidden="true">
                        {initial}
                      </div>
                    )}
                    <div className="settings-coach-list__name">{coach.display_name}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="settings-placeholder">Пока нет подключённых тренеров.</p>
        )}

        <div className="settings-coach-add">
          <input
            className="settings-field__input glass-input"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
            placeholder="Код приглашения тренера"
            maxLength={32}
          />
          <button
            type="button"
            className="settings-btn settings-btn--primary"
            onClick={() => void handleJoinCoach()}
            disabled={savingCoach || !inviteCode.trim()}
          >
            Добавить
          </button>
        </div>
      </SettingsSection>

      <SettingsSection title="Приложение">
        <button type="button" className="settings-link" onClick={onOpenThemes}>
          Темы оформления
        </button>
        <button type="button" className="settings-link settings-link--danger" onClick={onLogout}>
          Выйти
        </button>
      </SettingsSection>

      {cropFile ? (
        <AvatarCropModal
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onConfirm={handleAvatarUpload}
        />
      ) : null}
    </div>
  );
}
