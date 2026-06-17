import type { InputHTMLAttributes } from "react";

interface NativeTemporalInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  type: "date" | "time" | "datetime-local";
  wrapperClassName?: string;
}

export function NativeTemporalInput({
  type,
  className = "",
  wrapperClassName = "",
  ...props
}: NativeTemporalInputProps) {
  return (
    <span className={`native-temporal${wrapperClassName ? ` ${wrapperClassName}` : ""}`}>
      <input type={type} className={`native-temporal__input${className ? ` ${className}` : ""}`} {...props} />
    </span>
  );
}
