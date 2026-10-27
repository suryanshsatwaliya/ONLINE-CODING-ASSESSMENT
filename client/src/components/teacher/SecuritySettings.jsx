const enforcementKeys = [
  "requireFullscreen",
  "monitorTabSwitching",
  "monitorWindowFocus",
  "monitorPageExit",
  "blockCopy",
  "blockPaste",
  "blockCut",
  "blockContextMenu",
];
const terminatingEvents = [
  "FULLSCREEN_EXIT",
  "TAB_HIDDEN",
  "WINDOW_BLUR",
  "COPY_ATTEMPT",
  "PASTE_ATTEMPT",
  "CUT_ATTEMPT",
  "CONTEXT_MENU_ATTEMPT",
  "PAGE_EXIT_ATTEMPT",
  "DISCONNECTED",
  "RECONNECTED",
];
const eventLabels = {
  FULLSCREEN_EXIT: "Fullscreen exited",
  TAB_HIDDEN: "Tab switched or hidden",
  WINDOW_BLUR: "Assessment window lost focus",
  WINDOW_FOCUS: "Assessment window focused",
  COPY_ATTEMPT: "Copy attempt",
  PASTE_ATTEMPT: "Paste attempt",
  CUT_ATTEMPT: "Cut attempt",
  CONTEXT_MENU_ATTEMPT: "Right-click attempt",
  PAGE_EXIT_ATTEMPT: "Page exit attempt",
  DISCONNECTED: "Connection lost",
  RECONNECTED: "Connection restored",
};
const ruleOptions = [
  { value: "IGNORE", label: "Ignore" },
  { value: "LOG", label: "Record", title: "Save to the teacher log without warning the student or increasing the warning count." },
  { value: "WARNING", label: "Warning", title: "Show a warning and count it toward the configured warning limit." },
];
const allowActionOptions = [
  { value: "IGNORE", label: "Allow", title: "Allow the clipboard or context-menu action without recording it." },
  ruleOptions[1],
  ruleOptions[2],
];
const enforcementByEvent = {
  FULLSCREEN_EXIT: "requireFullscreen",
  TAB_HIDDEN: "monitorTabSwitching",
  WINDOW_BLUR: "monitorWindowFocus",
  WINDOW_FOCUS: "monitorWindowFocus",
  COPY_ATTEMPT: "blockCopy",
  PASTE_ATTEMPT: "blockPaste",
  CUT_ATTEMPT: "blockCut",
  CONTEXT_MENU_ATTEMPT: "blockContextMenu",
  PAGE_EXIT_ATTEMPT: "monitorPageExit",
};
const allowableEvents = new Set(["COPY_ATTEMPT", "PASTE_ATTEMPT", "CUT_ATTEMPT", "CONTEXT_MENU_ATTEMPT"]);
const baseEventRules = {
  FULLSCREEN_EXIT: "WARNING",
  TAB_HIDDEN: "WARNING",
  WINDOW_BLUR: "WARNING",
  COPY_ATTEMPT: "WARNING",
  PASTE_ATTEMPT: "WARNING",
  CUT_ATTEMPT: "WARNING",
  CONTEXT_MENU_ATTEMPT: "WARNING",
  PAGE_EXIT_ATTEMPT: "WARNING",
  WINDOW_FOCUS: "LOG",
  DISCONNECTED: "LOG",
  RECONNECTED: "LOG",
};
export const strictSecurity = {
  strictExamMode: true,
  ...Object.fromEntries(enforcementKeys.map((key) => [key, true])),
  maxWarnings: 3,
  warningAction: "AUTO_SUBMIT",
  eventRules: baseEventRules,
};
const relaxedSecurity = {
  strictExamMode: false,
  ...Object.fromEntries(enforcementKeys.map((key) => [key, false])),
  maxWarnings: 3,
  warningAction: "AUTO_SUBMIT",
  eventRules: {
    ...baseEventRules,
    FULLSCREEN_EXIT: "LOG",
    TAB_HIDDEN: "LOG",
    WINDOW_BLUR: "LOG",
    COPY_ATTEMPT: "LOG",
    PASTE_ATTEMPT: "LOG",
    CUT_ATTEMPT: "LOG",
    CONTEXT_MENU_ATTEMPT: "LOG",
    PAGE_EXIT_ATTEMPT: "LOG",
  },
};
export const defaultSecurity = {
  ...strictSecurity,
};

function strictIsEnabled(value) {
  if (typeof value.strictExamMode === "boolean") return value.strictExamMode;
  return enforcementKeys.every((key) => value[key]) &&
    terminatingEvents.slice(0, 8).every((event) => value.eventRules?.[event] === "WARNING");
}

export default function SecuritySettings({ value, onChange }) {
  value ||= defaultSecurity;
  const enabled = strictIsEnabled(value);
  const eventRules = { ...baseEventRules, ...(value.eventRules || {}) };
  const toggleStrict = (checked) => {
    if (checked) onChange({ ...strictSecurity, eventRules: { ...strictSecurity.eventRules } });
    else onChange({ ...relaxedSecurity, eventRules: { ...relaxedSecurity.eventRules } });
  };
  const set = (key, next) => onChange({ ...value, [key]: next });
  const setEventRule = (event, rule) => {
    const nextRules = { ...eventRules, [event]: rule };
    const key = enforcementByEvent[event];
    const next = { ...value, eventRules: nextRules };
    if (key) {
      if (event === "WINDOW_BLUR" || event === "WINDOW_FOCUS") {
        next.monitorWindowFocus = ["WINDOW_BLUR", "WINDOW_FOCUS"].some((name) => nextRules[name] !== "IGNORE");
      } else next[key] = rule !== "IGNORE";
    }
    onChange(next);
  };
  return (
    <div className="security-mode">
      <label className={`security-mode-card${enabled ? " is-enabled" : ""}`}>
        <span className="security-mode-copy">
          <strong>Strict exam mode</strong>
          <small>Control fullscreen, tab/window changes, clipboard actions and right-click from one place.</small>
        </span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => toggleStrict(e.target.checked)}
          aria-label="Enable strict exam mode"
        />
      </label>
      <div className={`security-event-settings${enabled ? " is-open" : ""}`} aria-hidden={!enabled} inert={!enabled}>
        <div className="security-event-content">
        <div className="security-event-global form-grid">
          <label className="field">Maximum warnings<input type="number" min="1" max="100" value={value.maxWarnings ?? 1} onChange={(e) => set("maxWarnings", Number(e.target.value))} /></label>
          <div className="field"><span>At the warning limit</span><div className="security-warning-action"><strong>Submit &amp; grade</strong></div></div>
        </div>
        <div className="security-event-grid">
          {Object.entries(eventLabels).map(([event, label]) => {
            const options = allowableEvents.has(event) ? allowActionOptions : ruleOptions;
            return <div className="security-event-item" key={event}><strong>{label}</strong><div className="security-choice-group" role="group" aria-label={`${label} rule`}>
            {options.map((option) => <button key={option.value} type="button" title={option.value === "LOG" ? undefined : option.title || option.label} aria-pressed={(eventRules[event] || "LOG") === option.value} className={`security-choice${(eventRules[event] || "LOG") === option.value ? " is-selected" : ""}`} onClick={() => setEventRule(event, option.value)}>{option.label}{option.value === "LOG" && <span className="security-record-info"><span className="security-info-icon" aria-hidden="true">i</span><span className="security-info-tooltip" role="tooltip">Record this event in the teacher’s activity log. It does not show a warning or increase the warning count.</span></span>}</button>)}
          </div></div>;
          })}
        </div>
        </div>
      </div>
    </div>
  );
}
