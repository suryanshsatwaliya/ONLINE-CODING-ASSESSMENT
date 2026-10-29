import { useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Code2, GraduationCap, KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { authService } from "../../services/authService";
import { errorMessage } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import Navbar from "../../components/layout/Navbar";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import { chromeOnlyMessage, isGoogleChrome } from "../../utils/browserPolicy";
import { useTypingReplay } from "../../hooks/useTypingReplay";

export default function StudentLogin() {
  const [uid, setUid] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const typingReplayKey = useTypingReplay(7250);
  const { login } = useAuth(), nav = useNavigate();
  const chromeAllowed = isGoogleChrome();
  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    if (!chromeAllowed) {
      setError(chromeOnlyMessage);
      return;
    }
    if (!/^[A-Z0-9]{6}$/.test(accessCode)) {
      setError("Enter exactly 6 letters and numbers from your teacher’s code.");
      return;
    }
    pending.current = true; setBusy(true); setError("");
    try {
      const { data } = await authService.studentLogin({ uid: uid.trim(), accessCode });
      login(data);
      nav(`/student/lobby/${data.user.assessmentId}`, { replace: true });
    } catch (e) { setError(errorMessage(e)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <>
    <Navbar />
    <main className="student-entry">
      <Link className="entry-back" to="/"><ArrowLeft size={16} /> Back to portals</Link>
      <div className="entry-layout">
        <section className="entry-welcome">
          <span className="entry-eyebrow"><GraduationCap size={17} /> STUDENT SPACE</span>
          <h1>Practice. Solve.<br /><span>Level up.</span></h1>
          <p>Step into a focused space for quizzes, coding challenges, and showing what you know.</p>
          <div className="entry-how"><span><UserRound size={19} /></span><div><strong>Your student UID</strong><p>The ID your teacher has registered for you.</p></div></div>
          <div className="entry-how"><span><KeyRound size={19} /></span><div><strong>One code. You’re in.</strong><p>Enter the 6-character code shared by your teacher.</p></div></div>
          <div className="entry-code-stage">
            <span className="entry-floating-snippet entry-snippet-one" aria-hidden="true">{`{ focus: true }`}</span>
            <span className="entry-floating-snippet entry-snippet-two" aria-hidden="true">solve();</span>
            <div className="entry-code-card" aria-label="Decorative coding challenge preview" role="img">
              <div className="entry-code-header"><span><Code2 size={15} /> challenge.py</span><span>•••</span></div>
              <div key={typingReplayKey} className="entry-code-lines" aria-hidden="true">
                <div><span>01</span><code style={{ "--type-steps": 21, "--type-delay": ".15s" }}><b>def</b> solve(problem):</code></div>
                <div><span>02</span><code style={{ "--type-steps": 30, "--type-delay": ".8s" }}><em>for</em> question <em>in</em> problem:</code></div>
                <div><span>03</span><code className="entry-code-indent" style={{ "--type-steps": 22, "--type-delay": "1.45s" }}>write_your_solution()</code></div>
                <div><span>04</span><code style={{ "--type-steps": 19, "--type-delay": "2.1s" }}><b>return</b> your_best</code></div>
                <div className="entry-code-active-line"><span>05</span><code style={{ "--type-steps": 13, "--type-delay": "2.65s" }}>keep_learning</code><i className="entry-code-caret" /></div>
              </div>
              <div className="entry-code-footer"><span><CheckCircle2 size={14} /> Ready when you are</span><span>Python 3</span></div>
            </div>
          </div>
          <div className="entry-footnote"><ShieldCheck size={18} /><span>Only students assigned to an assessment can join it.</span></div>
        </section>
        <form className="entry-form" onSubmit={submit}>
          <div className="entry-form-icon"><KeyRound size={24} /></div>
          <span className="entry-eyebrow">LET’S BEGIN</span>
          <h2>Join your assessment</h2>
          <p>Two details, and you’re ready to go.</p>
          <fieldset disabled={busy}>
            <Input label="Student UID" placeholder="Enter your student UID" autoComplete="username" autoCapitalize="characters" spellCheck={false} maxLength={40} required value={uid} onChange={(e) => setUid(e.target.value.toUpperCase())} />
            <Input label="Assessment code" className="entry-code-input" placeholder="A7K2M9" autoComplete="off" autoCapitalize="characters" spellCheck={false} minLength={6} maxLength={6} pattern="[A-Z0-9]{6}" title="Enter 6 uppercase letters and numbers." aria-describedby="entry-code-hint" required value={accessCode} onChange={(e) => setAccessCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} />
            <p id="entry-code-hint" className="entry-code-hint">6 characters · uppercase letters and numbers</p>
            {!chromeAllowed && <p className="notice error" role="alert">{chromeOnlyMessage}</p>}
            {error && <p className="notice error" role="alert">{error}</p>}
            <Button type="submit" disabled={busy || !chromeAllowed}>{busy ? "Checking your details…" : "Join assessment"}<ArrowRight size={18} /></Button>
          </fieldset>
          <div className="entry-help"><strong>Before your exam</strong><p>Open the portal in Chrome Incognito. A normal website cannot verify Incognito mode or reliably list installed extensions.</p></div>
        </form>
      </div>
    </main>
  </>;
}
