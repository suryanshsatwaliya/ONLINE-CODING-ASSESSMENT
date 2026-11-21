import { useState } from "react";
import "./one-time-code.css";

/* ══ One-time code ════════════════════════════════════════
   Six small cells and a caret. Digits rise into their cells;
   the cells acknowledge a digit with a small swell. The
   server remains the authority that accepts or rejects a code.

   ── SIX CELLS, ONE FIELD ────────────────────────────────
   The same call the sign-in sheet makes, for the same reasons:
   six real inputs break paste, autofill from the notification,
   backspace and screen readers. So there is one invisible
   input over the row and the cells are drawn underneath it. */

const W = 38;
const H = 48;
const G = 8;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default function OneTimeCode({
  value = "",
  onChange,
  onComplete,
  length = 6,
  corner = 8,
  disabled = false,
  autoFocus = false,
}) {
  const count = length === 4 ? 4 : 6;
  const radius = clamp(corner, 0, H / 2);
  const [focus, setFocus] = useState(false);
  const rowWidth = count * W + (count - 1) * G;
  const nextCell = Math.min(value.length, count - 1);

  const updateCode = (raw) => {
    const next = raw.replace(/\D/g, "").slice(0, count);
    onChange?.(next);
    if (value.length < count && next.length === count) onComplete?.(next);
  };

  return (
    <div className="otp" data-focus={focus} data-filled={value.length === count}>
      <div className="otp-row" style={{ width: rowWidth, height: H, "--otp-count": count, "--otp-corner": `${radius}px` }}>
        {Array.from({ length: count }, (_, index) => {
          const digit = value[index];
          return (
            <span
              key={index}
              className="otp-cell"
              data-filled={Boolean(digit)}
              data-active={focus && index === nextCell && value.length < count}
              style={{ borderRadius: radius }}
            >
              {digit && <span key={`${index}-${digit}`} className="otp-digit">{digit}</span>}
            </span>
          );
        })}

        {/* the caret follows the next empty cell */}
        <i
          className="otp-caret"
          data-on={focus && value.length < count}
          style={{ left: nextCell * (W + G) + W / 2 }}
          aria-hidden="true"
        />

        <input
          className="otp-field"
          value={value}
          onChange={(event) => updateCode(event.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          inputMode="numeric"
          autoComplete="one-time-code"
          data-1p-ignore
          data-lpignore="true"
          data-bwignore
          data-form-type="other"
          maxLength={count}
          aria-label={`${count}-digit authenticator code`}
          spellCheck={false}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      </div>
    </div>
  );
}
