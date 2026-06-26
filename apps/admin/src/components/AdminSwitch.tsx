interface AdminSwitchProps {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}

export function AdminSwitch({ checked, disabled = false, label, onChange }: AdminSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`admin-switch${checked ? " admin-switch--on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="admin-switch__thumb" aria-hidden="true" />
    </button>
  );
}
