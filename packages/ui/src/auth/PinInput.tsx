import {
  useLayoutEffect,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
}

const LENGTH = 6;

function activeCellIndex(digitCount: number): number {
  if (digitCount >= LENGTH) return LENGTH - 1;
  return digitCount;
}

export function PinInput({ value, onChange, disabled, id }: PinInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const mounted = useRef(false);
  const digits = value.padEnd(LENGTH, "").slice(0, LENGTH).split("");
  const digitCount = value.replace(/\D/g, "").length;
  const activeIndex = activeCellIndex(digitCount);

  const focusCell = (index: number) => {
    refs.current[index]?.focus({ preventScroll: true });
  };

  useLayoutEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    focusCell(activeIndex);
  }, [activeIndex]);

  const updateAt = (index: number, char: string) => {
    const next = digits.slice();
    next[index] = char;
    onChange(next.join("").replace(/\s/g, "").slice(0, LENGTH));
  };

  const handleChange = (_index: number, raw: string) => {
    const incoming = raw.replace(/\D/g, "");

    if (!incoming) {
      if (digitCount > 0) updateAt(digitCount - 1, "");
      return;
    }

    if (incoming.length > 1) {
      onChange(incoming.slice(0, LENGTH));
      return;
    }

    const target = activeCellIndex(digitCount);
    if (digitCount >= LENGTH) {
      updateAt(LENGTH - 1, incoming);
      return;
    }
    updateAt(target, incoming);
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      e.preventDefault();
      updateAt(index - 1, "");
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (pasted) onChange(pasted);
  };

  const handleContainerClick = () => {
    if (!disabled) focusCell(activeIndex);
  };

  return (
    <div className="auth-pin" id={id} onPaste={handlePaste} onClick={handleContainerClick}>
      {Array.from({ length: LENGTH }, (_, i) => {
        const isActive = i === activeIndex;
        return (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            tabIndex={isActive ? 0 : -1}
            className={[
              "auth-pin__cell",
              digits[i] && digits[i] !== " " ? "auth-pin__cell--filled" : "",
              isActive ? "auth-pin__cell--active" : "auth-pin__cell--inactive",
            ]
              .filter(Boolean)
              .join(" ")}
            value={digits[i] === " " ? "" : digits[i] || ""}
            disabled={disabled}
            aria-label={`Цифра PIN ${i + 1}`}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
          />
        );
      })}
    </div>
  );
}
