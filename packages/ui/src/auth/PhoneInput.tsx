import { useRef } from "react";
import {
  appendPhoneDigit,
  backspacePhone,
  formatPhoneDisplay,
  normalizePhoneInput,
} from "@sport-app/api-client";

interface PhoneInputProps {
  value: string;
  onChange: (digits: string) => void;
  disabled?: boolean;
  id?: string;
}

export function PhoneInput({ value, onChange, disabled, id }: PhoneInputProps) {
  const skipChange = useRef(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === "Backspace") {
      e.preventDefault();
      skipChange.current = true;
      onChange(backspacePhone(value));
      return;
    }

    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      skipChange.current = true;
      onChange(appendPhoneDigit(value, e.key));
    }
  };

  return (
    <input
      id={id}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      className="auth-field__input auth-field__input--phone"
      placeholder="+7 (910) 000-00-00"
      value={formatPhoneDisplay(value)}
      disabled={disabled}
      onKeyDown={handleKeyDown}
      onPaste={(e) => {
        if (disabled) return;
        e.preventDefault();
        onChange(normalizePhoneInput(e.clipboardData.getData("text")));
      }}
      onChange={(e) => {
        if (skipChange.current) {
          skipChange.current = false;
          return;
        }
        onChange(normalizePhoneInput(e.target.value));
      }}
    />
  );
}
