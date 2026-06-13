import { useState } from "react";

import { AuthMockup } from "./AuthMockup";
import {
  applyTheme,
  getStoredTheme,
  themePresets,
  type ThemeId,
} from "../themes/presets";

interface ThemePreviewProps {
  onClose?: () => void;
}

export function ThemePreview({ onClose }: ThemePreviewProps) {
  const [current, setCurrent] = useState<ThemeId>(getStoredTheme());

  const selectTheme = (id: ThemeId) => {
    applyTheme(id);
    setCurrent(id);
  };

  const handleApplyAndClose = (id: ThemeId) => {
    selectTheme(id);
    onClose?.();
  };

  return (
    <div className="theme-preview">
      <header className="theme-preview__header">
        <h1>Выбери палитру</h1>
        <p>3 варианта · live preview экрана входа</p>
        {current && (
          <span className="theme-preview__current">
            Сейчас: {themePresets.find((t) => t.id === current)?.name}
          </span>
        )}
      </header>

      <div className="theme-preview__list">
        {themePresets.map((preset) => (
          <article
            key={preset.id}
            className={`theme-preview__item${current === preset.id ? " theme-preview__item--selected" : ""}`}
            data-theme={preset.id}
          >
            <div className="theme-preview__meta">
              <h2 className="theme-preview__name">
                {preset.name}
                {preset.isNew && (
                  <span
                    style={{
                      marginLeft: "var(--space-2)",
                      fontSize: "var(--text-xs)",
                      color: "var(--color-accent)",
                      fontWeight: "var(--font-bold)",
                    }}
                  >
                    NEW
                  </span>
                )}
              </h2>
              <p className="theme-preview__tagline">{preset.tagline}</p>
              <p className="theme-preview__vibe">{preset.vibe}</p>
              <div className="theme-preview__swatches">
                <span
                  className="theme-preview__swatch"
                  style={{ background: preset.primary, boxShadow: `0 0 12px ${preset.primary}` }}
                  title="Primary"
                />
                <span
                  className="theme-preview__swatch"
                  style={{ background: preset.accent, boxShadow: `0 0 12px ${preset.accent}` }}
                  title="Accent"
                />
                {preset.tertiary && (
                  <span
                    className="theme-preview__swatch"
                    style={{ background: preset.tertiary, boxShadow: `0 0 12px ${preset.tertiary}` }}
                    title="Warm"
                  />
                )}
              </div>
            </div>

            <div className="theme-preview__frame">
              <AuthMockup />
            </div>

            <div className="theme-preview__actions">
              <button
                type="button"
                className="theme-preview__select"
                onClick={() => handleApplyAndClose(preset.id)}
              >
                {current === preset.id ? "✓ Выбрано — применить" : `Выбрать «${preset.name}»`}
              </button>
            </div>
          </article>
        ))}
      </div>

      {onClose && (
        <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 var(--space-4)" }}>
          <button type="button" className="theme-preview__back" onClick={onClose}>
            ← Вернуться к входу
          </button>
        </div>
      )}
    </div>
  );
}

export function isThemePreviewMode(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("preview") === "themes";
}
