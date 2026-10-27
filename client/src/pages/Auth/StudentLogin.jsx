import { useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, GraduationCap, KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { authService } from "../../services/authService";
import { errorMessage } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import Navbar from "../../components/layout/Navbar";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import { chromeOnlyMessage, isGoogleChrome } from "../../utils/browserPolicy";

export default function StudentLogin() {
  const [uid, setUid] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
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
          <h1>Your next challenge<br /><span>starts here.</span></h1>
          <p>A quiz, a coding challenge, a chance to show what you know. Let’s get you ready.</p>
          <div className="entry-how"><span><UserRound size={19} /></span><div><strong>Your student UID</strong><p>The ID your teacher has registered for you.</p></div></div>
          <div className="entry-how"><span><KeyRound size={19} /></span><div><strong>One code. You’re in.</strong><p>Enter the 6-character code shared by your teacher.</p></div></div>
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
