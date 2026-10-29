import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Code2, GraduationCap, ShieldCheck, Sparkles } from "lucide-react";
import { authService } from "../../services/authService";
import { errorMessage } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../context/ThemeContext";
import Navbar from "../../components/layout/Navbar";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import { useTypingReplay } from "../../hooks/useTypingReplay";

let turnstileScriptPromise;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (!turnstileScriptPromise) {
    turnstileScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Could not load human verification."));
      document.head.appendChild(script);
    });
  }
  return turnstileScriptPromise;
}

function TurnstileWidget({ siteKey, theme, onToken, resetRef }) {
  const hostRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    loadTurnstile().then(() => {
      if (!active || !hostRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(hostRef.current, {
        sitekey: siteKey,
        theme,
        appearance: "always",
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => {
          onToken("");
          setLoadError("Verification could not be completed. Reload the challenge and try again.");
        },
      });
      resetRef.current = () => {
        onToken("");
        if (widgetIdRef.current != null) window.turnstile?.reset(widgetIdRef.current);
      };
    }).catch(() => {
      if (active) setLoadError("Human verification could not load. Check your connection and try again.");
    });

    return () => {
      active = false;
      resetRef.current = null;
      if (widgetIdRef.current != null) window.turnstile?.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [onToken, resetRef, siteKey, theme]);

  return <div className="teacher-captcha-widget-wrap">
    <div ref={hostRef} className="teacher-captcha-widget" />
    {loadError && <p className="teacher-captcha-error" role="alert">{loadError}</p>}
  </div>;
}

export default function TeacherLogin() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [captchaConfig, setCaptchaConfig] = useState(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const resetCaptchaRef = useRef(null);
  const { login } = useAuth();
  const nav = useNavigate();
  const { theme } = useTheme();
  const typingReplayKey = useTypingReplay(6650);

  useEffect(() => {
    let active = true;
    authService.teacherCaptchaConfig()
      .then(({ data }) => { if (active) setCaptchaConfig(data); })
      .catch(() => { if (active) setCaptchaConfig({ enabled: false, unavailable: true }); });
    return () => { active = false; };
  }, []);

  const handleCaptchaToken = useCallback((token) => {
    setCaptchaToken(token);
    if (token) setError("");
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (captchaConfig?.enabled && !captchaToken) {
      setError("Complete the human verification before signing in.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const credentials = captchaConfig?.enabled ? { ...form, captchaToken } : form;
      login((await authService.teacherLogin(credentials)).data);
      nav("/teacher/dashboard");
    } catch (e) {
      setError(errorMessage(e));
      if (captchaConfig?.enabled) resetCaptchaRef.current?.();
    } finally {
      setBusy(false);
    }
  }

  return <>
    <Navbar />
    <main className="teacher-login-page">
      <div className="teacher-login-layout">
        <section className="teacher-login-story">
          <span className="teacher-login-kicker"><Sparkles size={15} /> YOUR CLASSROOM, IN FOCUS</span>
          <h1>Turn good questions into <span>great progress.</span></h1>
          <p className="teacher-login-intro">Create thoughtful assessments, bring coding practice into class, and see how every student is doing.</p>
          <div className="teacher-login-points">
            <span><CheckCircle2 size={17} /> Build quiz and coding assessments</span>
            <span><CheckCircle2 size={17} /> Keep student work and progress together</span>
          </div>
          <div className="teacher-code-stage">
            <span className="teacher-floating-snippet teacher-snippet-one" aria-hidden="true">{`{ class: "focused" }`}</span>
            <span className="teacher-floating-snippet teacher-snippet-two" aria-hidden="true">grade(submissions)</span>
            <div className="teacher-code-card" aria-label="Decorative assessment code preview" role="img">
              <div className="teacher-code-header"><span><Code2 size={16} /> classroom.py</span><span>•••</span></div>
              <div key={typingReplayKey} className="teacher-code-lines" aria-hidden="true">
                <div><span>01</span><code style={{ "--type-steps": 24, "--type-delay": ".1s" }}><b>assessment</b> = create_quiz()</code></div>
                <div><span>02</span><code style={{ "--type-steps": 31, "--type-delay": ".75s" }}><b>assessment</b>.add_coding_task()</code></div>
                <div><span>03</span><code style={{ "--type-steps": 34, "--type-delay": "1.4s" }}><em>for</em> student <em>in</em> classroom:</code></div>
                <div className="teacher-code-active-line"><span>04</span><code className="teacher-code-indent" style={{ "--type-steps": 27, "--type-delay": "2.05s" }}>review(student.progress)</code><i className="teacher-code-caret" /></div>
              </div>
              <div className="teacher-code-output"><span><CheckCircle2 size={14} /> Workspace ready</span><span className="teacher-code-pulse" /></div>
            </div>
          </div>
          <div className="teacher-login-note"><ShieldCheck size={17} /><span>Your assessments, students, and class insights in one workspace.</span></div>
        </section>

        <form className="teacher-login-card card" onSubmit={submit}>
          <div className="teacher-login-card-icon"><GraduationCap size={22} /></div>
          <span className="eyebrow">TEACHER WORKSPACE</span>
          <h2>Welcome back.</h2>
          <p>Sign in to manage your assessments.</p>
          <fieldset disabled={busy} className="teacher-login-fields">
            <Input
              label="Email address"
              type="email"
              autoComplete="username"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </fieldset>
          {error && <p className="error teacher-login-error" role="alert">{error}</p>}
          {captchaConfig === null ? <div className="teacher-captcha-unavailable" role="status"><ShieldCheck size={17} /><span>Loading secure sign-in…</span></div> : captchaConfig.enabled ? <section className="teacher-human-verification" aria-label="Human verification">
            <div className="teacher-captcha-heading"><span><ShieldCheck size={17} /> I’m not a robot</span><span className="teacher-captcha-trust">Cloudflare Turnstile</span></div>
            <TurnstileWidget siteKey={captchaConfig.siteKey} theme={theme === "dark" ? "dark" : "light"} onToken={handleCaptchaToken} resetRef={resetCaptchaRef} />
          </section> : <div className="teacher-captcha-unavailable" role="status">
            <ShieldCheck size={17} />
            <span>{captchaConfig?.unavailable ? "Human verification settings could not be loaded. Refresh the page and try again." : "Human verification is not configured for this environment."}</span>
          </div>}
          <Button type="submit" disabled={busy || !captchaConfig || captchaConfig.unavailable || (captchaConfig.enabled && !captchaToken)}>
            {busy ? "Signing in…" : <>Teacher Login <ArrowRight size={17} /></>}
          </Button>
          <Link className="teacher-login-back" to="/"><ArrowLeft size={15} /> Back to portals</Link>
        </form>
      </div>
    </main>
  </>;
}
