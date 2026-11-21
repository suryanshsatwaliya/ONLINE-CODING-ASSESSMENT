import { useId, useLayoutEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import "./label-input.css";

/* ══ Label input ══════════════════════════════════════════
   A field whose label is its placeholder until you are in it.
   On focus the label lifts into the top edge with a small hop
   running along its letters, the outline darkens in place, and
   the top line parts under the label from its middle outward.

   ── ONE THING MOVES ─────────────────────────────────────
   It used to DRAW its outline out of the notch, both ways
   round the field — and that was the field performing, which
   is too much for a thing you focus forty times a day. Now the
   outline is always whole; focus only changes its ink and
   opens the gap. The label is the event, and the line makes
   room for it.

   The gap is two short paths across the notch, each from the
   middle to one side, retracted from the middle outward by a
   negative dash offset. */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const W = 280;
const H = 52;
/* the lifted label's size, against its resting one */
const S = 0.78;
/* the stroke sits half a stroke inside the box so none of it
   is clipped by the svg's own edge */
const IN = 0.75;

export default function LabelInput({ label, type = "text", corner = 10, variant = "default", className = "", value = "", onChange, style, ...props }) {
  const r = clamp(corner, 0, H / 2);
  const secret = type === "password";
  const id = `lbi-${useId().replace(/:/g, "")}`;

  const [focus, setFocus] = useState(false);
  const [show, setShow] = useState(false);
  const [flip, setFlip] = useState(0);
  const box = useRef(null);
  const [width, setWidth] = useState(W);

  useLayoutEffect(() => {
    if (!box.current) return undefined;
    const resize = () => setWidth(box.current?.clientWidth || W);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(box.current);
    return () => observer.disconnect();
  }, []);

  /* the notch is the label's own width, so it is measured */
  const lab = useRef(null);
  const [lw, setLw] = useState(40);
  useLayoutEffect(() => {
    if (lab.current) setLw(lab.current.offsetWidth);
  }, [label]);

  const up = focus || String(value).length > 0;

  /* ── where the label sits, and the gap it leaves ─────────
     Never inside the corner's curve: the notch has to open on
     the straight part of the top edge, so a rounder field
     starts its label further in. */
  const lx = Math.max(14, r + 4);
  const x0 = Math.max(r * 0.6, lx - 5);
  const x1 = lx + lw * S + 5;
  const a = r - IN;
  const R = width - IN;
  const B = H - IN;
  const mid = width / 2;
  /* the gap, as two halves from its middle to each side */
  const nm = (x0 + x1) / 2;
  const gapL = `M${nm},${IN} L${x0},${IN}`;
  const gapR = `M${nm},${IN} L${x1},${IN}`;
  /* right: from the notch, clockwise, to the bottom middle */
  const right = r > 0
    ? `M${x1},${IN} L${width - r},${IN} A${a},${a} 0 0 1 ${R},${r} L${R},${H - r} A${a},${a} 0 0 1 ${width - r},${B} L${mid},${B}`
    : `M${x1},${IN} L${R},${IN} L${R},${B} L${mid},${B}`;
  /* left: from the notch, the other way round, to the same point */
  const left = r > 0
    ? `M${x0},${IN} L${r},${IN} A${a},${a} 0 0 0 ${IN},${r} L${IN},${H - r} A${a},${a} 0 0 0 ${r},${B} L${mid},${B}`
    : `M${x0},${IN} L${IN},${IN} L${IN},${B} L${mid},${B}`;

  const reveal = () => {
    setShow((current) => !current);
    setFlip((current) => current + 1);
  };

  return (
    <div className={`lbi${variant === "notched" ? " lbi-notched" : ""}`} data-up={up} data-focus={focus} data-filled={String(value).length > 0}>
      <div ref={box} className="lbi-box" style={{ borderRadius: r, "--lbi-x": `${lx}px` }}>
        <svg className="lbi-ring" viewBox={`0 0 ${width} ${H}`} aria-hidden="true">
          <path d={right} />
          <path d={left} />
          <path className="lbi-gap" d={gapL} pathLength={1} />
          <path className="lbi-gap" d={gapR} pathLength={1} />
        </svg>

        <label className="lbi-label" htmlFor={id} ref={lab}>
          {[...label].map((ch, i) => (
            <span key={i} style={{ "--i": i }}>{ch === " " ? "\u00a0" : ch}</span>
          ))}
        </label>

        <input
          {...props}
          id={id}
          className={`lbi-field${className ? ` ${className}` : ""}`}
          data-flip={flip % 2}
          type={secret && !show ? "password" : secret ? "text" : type}
          value={value}
          onChange={onChange}
          onFocus={(event) => { setFocus(true); props.onFocus?.(event); }}
          onBlur={(event) => { setFocus(false); props.onBlur?.(event); }}
          style={{
            paddingRight: secret ? 48 : lx,
            ...style,
          }}
        />

        {secret && (
          <button
            className="lbi-eye"
            type="button"
            data-show={show}
            /* keep focus in the field: the eye is a toggle on
               what you are typing, not somewhere to go */
            onPointerDown={(event) => event.preventDefault()}
            onClick={reveal}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
          >
            <Eye size={16} strokeWidth={2} aria-hidden="true" />
            <EyeOff size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
