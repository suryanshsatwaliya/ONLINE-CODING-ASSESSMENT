const switches = {
  requireFullscreen: "Require fullscreen",
  monitorTabSwitching: "Monitor tab switching",
  monitorWindowFocus: "Monitor window focus",
  monitorPageExit: "Monitor page exit",
  blockCopy: "Block copy",
  blockPaste: "Block paste",
  blockCut: "Block cut",
  blockContextMenu: "Block context menu",
};
const events = [
  "FULLSCREEN_EXIT",
  "TAB_HIDDEN",
  "WINDOW_BLUR",
  "WINDOW_FOCUS",
  "COPY_ATTEMPT",
  "PASTE_ATTEMPT",
  "CUT_ATTEMPT",
  "CONTEXT_MENU_ATTEMPT",
  "PAGE_EXIT_ATTEMPT",
  "DISCONNECTED",
  "RECONNECTED",
];
export const defaultSecurity = {
  requireFullscreen: true,
  monitorTabSwitching: true,
  monitorWindowFocus: true,
  monitorPageExit: true,
  blockCopy: true,
  blockPaste: true,
  blockCut: true,
  blockContextMenu: false,
  maxWarnings: 3,
  warningAction: "AUTO_SUBMIT",
  eventRules: {
    FULLSCREEN_EXIT: "WARNING",
    TAB_HIDDEN: "WARNING",
    WINDOW_BLUR: "LOG",
    COPY_ATTEMPT: "WARNING",
    PASTE_ATTEMPT: "WARNING",
    CUT_ATTEMPT: "WARNING",
    DISCONNECTED: "LOG",
    RECONNECTED: "LOG",
  },
};
export default function SecuritySettings({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div>
      <div className="form-grid">
        {Object.entries(switches).map(([k, label]) => (
          <label className="switch" key={k}>
            <span>{label}</span>
            <input
              type="checkbox"
              checked={value[k]}
              onChange={(e) => set(k, e.target.checked)}
            />
          </label>
        ))}
      </div>
      <div className="form-grid">
        <label className="field">
          Maximum warnings
          <input
            type="number"
            min="1"
            max="100"
            value={value.maxWarnings}
            onChange={(e) => set("maxWarnings", +e.target.value)}
          />
        </label>
        <label className="field">
          Warning limit action
          <select
            value={value.warningAction}
            onChange={(e) => set("warningAction", e.target.value)}
          >
            <option>AUTO_SUBMIT</option>
            <option>TERMINATE</option>
          </select>
        </label>
      </div>
      <details>
        <summary>Configure individual event rules</summary>
        <div className="form-grid">
          {events.map((k) => (
            <label className="field" key={k}>
              {k.replaceAll("_", " ")}
              <select
                value={value.eventRules[k] || "LOG"}
                onChange={(e) =>
                  set("eventRules", {
                    ...value.eventRules,
                    [k]: e.target.value,
                  })
                }
              >
                <option>IGNORE</option>
                <option>LOG</option>
                <option>WARNING</option>
              </select>
            </label>
          ))}
        </div>
      </details>
      <p className="muted">
        Browser signals have legitimate causes. These controls cannot prevent OS
        shortcuts, screenshots or privileged extension interference.
      </p>
    </div>
  );
}
