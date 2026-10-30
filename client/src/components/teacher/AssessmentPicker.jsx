import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

function labelFor(assessment) {
  const status = assessment.status === "ENDED" ? "Completed" : assessment.status;
  return `${assessment.title || "Untitled assessment"} · ${status}`;
}

export default function AssessmentPicker({ assessments = [], value = "", onChange, ariaLabel = "Select assessment", placeholder = "Choose an assessment…" }) {
  const [open, setOpen] = useState(false);
  const [opensUp, setOpensUp] = useState(false);
  const [optionsMaxHeight, setOptionsMaxHeight] = useState(608);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const selected = assessments.find((assessment) => assessment._id === value);
  const visibleAssessments = assessments.filter((assessment) => labelFor(assessment).toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    if (!open) return undefined;
    const root = document.documentElement;
    const body = document.body;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    searchRef.current?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, [open]);

  function togglePicker() {
    if (open) {
      setOpen(false);
      return;
    }
    const bounds = rootRef.current?.getBoundingClientRect();
    const below = bounds ? window.innerHeight - bounds.bottom - 20 : window.innerHeight;
    const above = bounds ? bounds.top - 20 : 0;
    const shouldOpenUp = below < 700 && above >= below;
    const availableSpace = Math.max(160, (shouldOpenUp ? above : below) - 100);
    setOpensUp(shouldOpenUp);
    setOptionsMaxHeight(Math.min(608, availableSpace));
    setOpen(true);
  }

  function choose(assessmentId) {
    onChange(assessmentId);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="assessment-picker" ref={rootRef}>
      <button
        type="button"
        className={`assessment-picker-trigger${open ? " is-open" : ""}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={togglePicker}
      >
        <span className={selected ? "" : "is-placeholder"}>{selected ? labelFor(selected) : placeholder}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className={`assessment-picker-popover${opensUp ? " opens-up" : ""}`}>
          <label className="assessment-picker-search">
            <Search size={16} aria-hidden="true" />
            <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assessments" aria-label="Search assessments" />
          </label>
          <div className="assessment-picker-options" style={{ maxHeight: `${optionsMaxHeight}px` }} role="listbox" aria-label={ariaLabel}>
            <button type="button" role="option" aria-selected={!value} className={`assessment-picker-option${!value ? " is-selected" : ""}`} onClick={() => choose("")}>
              <span>{placeholder}</span>{!value && <Check size={16} aria-hidden="true" />}
            </button>
            {visibleAssessments.map((assessment) => {
              const isSelected = assessment._id === value;
              return (
                <button type="button" role="option" aria-selected={isSelected} className={`assessment-picker-option${isSelected ? " is-selected" : ""}`} key={assessment._id} onClick={() => choose(assessment._id)}>
                  <span>{labelFor(assessment)}</span>{isSelected && <Check size={16} aria-hidden="true" />}
                </button>
              );
            })}
            {!visibleAssessments.length && <div className="assessment-picker-no-results">No matching assessments.</div>}
          </div>
          <div className="assessment-picker-count">{visibleAssessments.length} assessment{visibleAssessments.length === 1 ? "" : "s"}</div>
        </div>
      )}
    </div>
  );
}
