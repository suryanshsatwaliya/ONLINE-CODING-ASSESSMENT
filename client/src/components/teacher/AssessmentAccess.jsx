import { useRef, useState } from "react";
import { Check, Copy, KeyRound, RefreshCw } from "lucide-react";
import { api, errorMessage } from "../../services/api";
import Button from "../common/Button";

export default function AssessmentAccess({ id, status }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false), [copied, setCopied] = useState(false), [error, setError] = useState("");
  const pending = useRef(false);
  const ended = status === "ENDED";
  async function generate() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(""); setCopied(false);
    try { setCode((await api.post(`/assessments/${id}/access-code`)).data.accessCode); }
    catch (e) { setError(errorMessage(e)); }
    finally { pending.current = false; setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(code); setCopied(true); setError(""); }
    catch { setError("Copy isn’t available. Select the code above and copy it manually."); }
  }
  return <section className="assessment-access" aria-label="Student access">
    <div className="access-explainer"><span className="entry-eyebrow"><KeyRound size={16} /> STUDENT ACCESS</span><h2>{ended ? "This assessment has ended." : "One code for your classroom."}</h2><p>{ended ? "Students can no longer join this assessment." : "Share the assessment code with your assigned students. They’ll enter it with their student UID to join."}</p>
      {!ended && <ol><li>Save your student assignments below.</li><li>Generate and copy the 6-character code.</li><li>Share it, then start when everyone is ready.</li></ol>}
    </div>
    {!ended && <div className="access-code-panel"><span className="entry-eyebrow">ASSESSMENT CODE</span><div className={`access-code-display ${code ? "ready" : ""}`} aria-live="polite"><code>{code || "——————"}</code></div><p>{code ? "Copy this code before leaving the page." : "Generate a code to invite your students."}</p><div className="access-code-actions"><Button type="button" onClick={generate} disabled={busy}><RefreshCw size={16} />{busy ? "Generating…" : code ? "Replace code" : "Generate new code"}</Button>{code && <Button type="button" variant="secondary" onClick={copy} disabled={busy}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy code"}</Button>}</div><small>A new code replaces the previous one. Students already signed in can continue.</small>{status === "DRAFT" && <small>Save as Scheduled to open the lobby, or start the assessment to allow students in.</small>}{error && <p className="error" role="alert">{error}</p>}</div>}
  </section>;
}
