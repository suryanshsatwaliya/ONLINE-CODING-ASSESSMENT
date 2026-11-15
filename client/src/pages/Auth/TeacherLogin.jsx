import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, GraduationCap, ShieldCheck } from "lucide-react";
import { authService } from "../../services/authService";
import { errorMessage } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../context/ThemeContext";
import Navbar from "../../components/layout/Navbar";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";

let turnstileScriptPromise;
const configuredTurnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (!turnstileScriptPromise) {
    turnstileScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => {
        turnstileScriptPromise = null;
        reject(new Error("Could not load human verification."));
      };
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

const teacherCodeLines = [
  [{ text: "function", className: "code-keyword" }, { text: " solveChallenge", className: "code-function" }, { text: "() {" }],
  [{ text: "const", className: "code-constant" }, { text: " answer = " }, { text: "buildSolution", className: "code-function" }, { text: "();" }],
  [{ text: "return", className: "code-keyword" }, { text: " " }, { text: "validate", className: "code-function" }, { text: "(answer);" }],
  [{ text: "}" }],
];
const teacherCodeLength = teacherCodeLines.flat().reduce((total, segment) => total + segment.text.length, 0);

export default function TeacherLogin() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // The public site key is bundled with the client so the widget can render
  // without waiting for a potentially cold API instance to return its config.
  const [captchaConfig, setCaptchaConfig] = useState(() => configuredTurnstileSiteKey
    ? { enabled: true, siteKey: configuredTurnstileSiteKey }
    : null);
  const [captchaToken, setCaptchaToken] = useState("");
  const [visibleCodeLetters, setVisibleCodeLetters] = useState(0);
  const resetCaptchaRef = useRef(null);
  const { login } = useAuth();
  const nav = useNavigate();
  const { theme } = useTheme();

  useEffect(() => {
    let active = true;
    // Start the Cloudflare download alongside the config request so the two
    // network waits do not block each other.
    loadTurnstile().catch(() => {});
    if (!configuredTurnstileSiteKey) {
      authService.teacherCaptchaConfig()
        .then(({ data }) => { if (active) setCaptchaConfig(data); })
        .catch(() => { if (active) setCaptchaConfig({ enabled: false, unavailable: true }); });
    }
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let timer;
    let letter = 0;
    const typeNextLetter = () => {
      letter += 1;
      setVisibleCodeLetters(letter);
      if (letter < teacherCodeLength) timer = window.setTimeout(typeNextLetter, 35);
      else timer = window.setTimeout(() => {
        letter = 0;
        setVisibleCodeLetters(0);
        timer = window.setTimeout(typeNextLetter, 350);
      }, 3000);
    };
    timer = window.setTimeout(typeNextLetter, 350);
    return () => window.clearTimeout(timer);
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
          <Link className="teacher-login-back portal-return-link" to="/"><ArrowLeft size={16} /> Back to portals</Link>
          <h1>Manage your assessments <span>in one place.</span></h1>
          <div className="teacher-login-code-stage" aria-hidden="true">
            <span className="teacher-login-floating-snippet teacher-login-floating-top">&#123; focus: true &#125;</span>
            <div className="teacher-login-code">
            <div className="teacher-login-code-top"><span className="teacher-login-code-dots"><i /><i /><i /></span><span>challenge.js</span><span className="teacher-login-code-status">● LIVE</span></div>
            <div className="teacher-login-code-body">
              {(() => { let offset = 0; return teacherCodeLines.map((line, lineIndex) => <span className={`code-line ${lineIndex === 1 || lineIndex === 2 ? "indent" : ""}`} key={lineIndex}><i>0{lineIndex + 1}</i>{line.map((segment, segmentIndex) => { const start = offset; offset += segment.text.length; return <span className={segment.className || ""} key={segmentIndex}>{[...segment.text].map((character, characterIndex) => <span className={`typing-char ${start + characterIndex < visibleCodeLetters ? "is-visible" : ""}`} key={characterIndex}>{character}</span>)}</span>; })}</span>); })()}
            </div>
            <div className="teacher-login-code-foot"><span><CheckCircle2 size={14} /> Ready to run</span><span>JavaScript · Assessment</span></div>
            </div>
            <span className="teacher-login-floating-snippet teacher-login-floating-bottom">solve();</span>
          </div>
          <p className="teacher-login-intro"><span className="teacher-login-intro-kicker">YOUR CLASSROOM, IN SYNC</span>From first question to final result, keep every part of the learning journey moving together.</p>
          <div className="teacher-login-points">
            <span><CheckCircle2 size={17} /><strong>Create with confidence</strong><small>Quizzes and coding challenges, one workspace.</small></span>
            <span><CheckCircle2 size={17} /><strong>See every breakthrough</strong><small>Student work and progress, all in sync.</small></span>
          </div>
        </section>

        <form className="teacher-login-card card" onSubmit={submit}>
          <div className="teacher-login-card-icon"><GraduationCap size={22} /></div>
          <h2>Sign in</h2>
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
            {busy ? "Signing in…" : <>Sign in <ArrowRight size={17} /></>}
          </Button>
        </form>
      </div>
    </main>
  </>;
}
