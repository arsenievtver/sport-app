import { formatPhoneDisplay, normalizePhoneInput } from "@sport-app/api-client";

interface PhoneInputProps {
  value: string;
  onChange: (digits: string) => void;
  disabled?: boolean;
  id?: string;
}

export function PhoneInput({ value, onChange, disabled, id }: PhoneInputProps) {
  const display = formatPhoneDisplay(value);

  return (
    <input
      id={id}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      className="auth-field__input auth-field__input--phone"
      placeholder="+7 (910) 000-00-00"
      value={display}
      disabled={disabled}
      onChange={(e) => onChange(normalizePhoneInput(e.target.value))}
    />
  );
}
