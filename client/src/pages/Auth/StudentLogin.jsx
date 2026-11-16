import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, KeyRound, ShieldCheck, UserRound, Code2 } from "lucide-react";
import { authService } from "../../services/authService";
import { errorMessage } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import Navbar from "../../components/layout/Navbar";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import { chromeOnlyMessage, isGoogleChrome } from "../../utils/browserPolicy";

const studentCodeLines = [
  [{ text: "def", className: "code-keyword" }, { text: " solve(problem):" }],
  [{ text: "for", className: "code-constant" }, { text: " question " }, { text: "in", className: "code-constant" }, { text: " problem:" }],
  [{ text: "    write_your_solution", className: "code-function" }, { text: "()" }],
  [{ text: "return", className: "code-keyword" }, { text: " your_best" }],
  [{ text: "keep_learning", className: "code-function" }],
];
const studentCodeLength = studentCodeLines.flat().reduce((total, segment) => total + segment.text.length, 0);

export default function StudentLogin() {
  const [uid, setUid] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [visibleCodeLetters, setVisibleCodeLetters] = useState(0);
  const pending = useRef(false);
  const { login } = useAuth(), nav = useNavigate();
  const chromeAllowed = isGoogleChrome();
  useEffect(() => {
    if (!chromeAllowed) return;
    let timer;
    let letter = 0;
    const typeNext = () => {
      letter += 1;
      setVisibleCodeLetters(letter);
      if (letter < studentCodeLength) timer = window.setTimeout(typeNext, 35);
      else timer = window.setTimeout(() => {
        letter = 0;
        setVisibleCodeLetters(0);
        timer = window.setTimeout(typeNext, 350);
      }, 3000);
    };
    timer = window.setTimeout(typeNext, 350);
    return () => window.clearTimeout(timer);
  }, [chromeAllowed]);
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
  if (!chromeAllowed) return <>
    <Navbar />
    <main className="student-device-block">
      <section className="student-device-notice" role="status">
        <ShieldCheck size={24} />
        <h1>Desktop required</h1>
        <p>{chromeOnlyMessage}</p>
        <Link to="/">Return to portals</Link>
      </section>
    </main>
  </>;
  return <>
    <Navbar />
    <main className="student-entry">
      <Link className="entry-back portal-return-link" to="/"><ArrowLeft size={16} /> Back to portals</Link>
      <div className="entry-layout">
        <section className="entry-welcome">
          <h1>Practice. Solve.<br /><span>Level up.</span></h1>
          <p>Step into a focused space for quizzes, coding challenges, and showing what you know.</p>
          <div className="entry-guides">
            <div><span><UserRound size={21} /></span><section><strong>Your student UID</strong><small>The ID your teacher has registered for you.</small></section></div>
            <div><span><KeyRound size={21} /></span><section><strong>One code. You’re in.</strong><small>Enter the 6-character code shared by your teacher.</small></section></div>
          </div>
          <div className="entry-code-stage" aria-hidden="true">
            <span className="entry-code-float entry-code-float-top">&#123; focus: true &#125;</span>
            <div className="entry-code-card">
              <div className="entry-code-header"><span><Code2 size={15} /> challenge.py</span><span>•••</span></div>
              <div className="entry-code-lines">
                {(() => { let offset = 0; return studentCodeLines.map((line, lineIndex) => <div className={lineIndex === 2 ? "is-indented" : ""} key={lineIndex}><span>0{lineIndex + 1}</span><code>{line.map((segment, segmentIndex) => { const start = offset; offset += segment.text.length; return <span className={segment.className || ""} key={segmentIndex}>{[...segment.text].map((character, characterIndex) => <span className={`entry-typing-char ${start + characterIndex < visibleCodeLetters ? "is-visible" : ""}`} key={characterIndex}>{character}</span>)}</span>; })}</code></div>); })()}
              </div>
              <div className="entry-code-footer"><span><ShieldCheck size={14} /> Ready when you are</span><span>Python 3</span></div>
            </div>
            <span className="entry-code-float entry-code-float-bottom">solve();</span>
          </div>
          <div className="entry-footnote"><ShieldCheck size={18} /><span>Only students assigned to an assessment can join it.</span></div>
        </section>
        <form className="entry-form" onSubmit={submit}>
          <div className="entry-form-icon"><KeyRound size={24} /></div>
          <h2>Join your assessment</h2>
          <fieldset disabled={busy}>
            <Input label="Student UID" placeholder="Enter your student UID" autoComplete="username" autoCapitalize="characters" spellCheck={false} maxLength={40} required value={uid} onChange={(e) => setUid(e.target.value.toUpperCase())} />
            <Input label="Assessment code" className="entry-code-input" placeholder="A7K2M9" autoComplete="off" autoCapitalize="characters" spellCheck={false} minLength={6} maxLength={6} pattern="[A-Z0-9]{6}" title="Enter 6 uppercase letters and numbers." aria-describedby="entry-code-hint" required value={accessCode} onChange={(e) => setAccessCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} />
            <p id="entry-code-hint" className="entry-code-hint">6 characters · uppercase letters and numbers</p>
            {error && <p className="notice error" role="alert">{error}</p>}
            <Button type="submit" disabled={busy || !chromeAllowed}>{busy ? "Checking your details…" : "Join assessment"}<ArrowRight size={18} /></Button>
          </fieldset>
          <div className="entry-help"><strong>Before your exam</strong><p>Open the portal in Chrome Incognito. A normal website cannot verify Incognito mode or reliably list installed extensions.</p></div>
        </form>
      </div>
    </main>
  </>;
}
