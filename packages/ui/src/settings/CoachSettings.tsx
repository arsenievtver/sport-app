import { useRef, useState } from "react";
import { formatPhoneDisplay, resolveMediaUrl, uploadCoachAvatar } from "@sport-app/api-client";
import type { UserResponse } from "@sport-app/shared";

import { CoachWorkoutsPanel } from "../workouts/CoachWorkoutsPanel";
import { AvatarCropModal } from "./AvatarCropModal";

interface CoachSettingsProps {
  user: UserResponse;
  onUserUpdated: (user: UserResponse) => void;
  onLogout: () => void;
  onViewChange?: (view: "settings" | "workouts") => void;
}

export function CoachSettings({ user, onUserUpdated, onLogout, onViewChange }: CoachSettingsProps) {
  const profile = user.coach_profile;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [view, setView] = useState<"settings" | "workouts">("settings");

  const openWorkouts = () => {
    setView("workouts");
    onViewChange?.("workouts");
  };

  const backToSettings = () => {
    setView("settings");
    onViewChange?.("settings");
  };

  if (view === "workouts") {
    return <CoachWorkoutsPanel onBack={backToSettings} />;
  }

  const displayName = profile?.display_name ?? "Тренер";
  const avatarUrl = resolveMediaUrl(profile?.avatar_url);

  const showMessage = (message: string) => {
    setSuccess(message);
    setError(null);
    window.setTimeout(() => setSuccess(null), 2500);
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
    const updated = await uploadCoachAvatar(blob);
    onUserUpdated(updated);
    setCropFile(null);
    showMessage("Фото обновлено");
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

      <section className="settings-section glass glass--panel settings-section--open">
        <div className="settings-section__body">
          <div className="settings-row">
            <div className="settings-row__label">Имя</div>
            <div className="settings-row__value">{displayName}</div>
          </div>
          <div className="settings-row">
            <div className="settings-row__label">Телефон</div>
            <div className="settings-row__value">{formatPhoneDisplay(user.phone)}</div>
          </div>
          {profile?.invite_code ? (
            <div className="settings-row">
              <div className="settings-row__label">Код приглашения</div>
              <div className="settings-row__value">{profile.invite_code}</div>
              <div className="settings-row__hint">Поделись кодом с атлетами для связки</div>
            </div>
          ) : null}
        </div>
      </section>

      <button type="button" className="settings-link" onClick={openWorkouts}>
        Мои тренировки
      </button>

      <button type="button" className="settings-link settings-link--danger" onClick={onLogout}>
        Выйти
      </button>

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
