import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, GraduationCap, ShieldCheck } from "lucide-react";
import { authService } from "../../services/authService";
import { api, errorMessage } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../context/ThemeContext";
import Navbar from "../../components/layout/Navbar";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import TeacherLoginStory from "./TeacherLoginStory";
export { useCodeTyping } from "./teacherLoginCode";

let turnstileScriptPromise;
const configuredTurnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (!turnstileScriptPromise) {
    turnstileScriptPromise = new Promise((resolve, reject) => {
      let script = document.querySelector("script[data-turnstile-script]");
      const onLoad = () => resolve();
      const onError = () => {
        script?.remove();
        turnstileScriptPromise = null;
        reject(new Error("Could not load human verification."));
      };

      if (script?.dataset.turnstileFailed === "true") {
        script.remove();
        script = null;
      }
      if (!script) {
        script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.dataset.turnstileScript = "true";
        document.head.appendChild(script);
      }
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
    });
  }
  return turnstileScriptPromise;
}

export const TurnstileWidget = memo(function TurnstileWidget({ siteKey, theme, onToken, resetRef }) {
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
});

export default function TeacherLogin() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // The public site key is bundled with the client so the widget can render
  // without waiting for a potentially cold API instance to return its config.
  const [captchaConfig, setCaptchaConfig] = useState(() => configuredTurnstileSiteKey
    ? { enabled: true, siteKey: configuredTurnstileSiteKey }
    : null);
  const [captchaToken, setCaptchaToken] = useState("");
  const resetCaptchaRef = useRef(null);
  const { login } = useAuth();
  const nav = useNavigate();
  const { theme } = useTheme();

  useEffect(() => {
    let active = true;
    // Wake an idle hosted API while the teacher fills the form and the
    // Turnstile widget loads, instead of making the sign-in click pay that delay.
    if (configuredTurnstileSiteKey) api.get("/health").catch(() => {});
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
        <TeacherLoginStory />

        <form className="teacher-login-card card" onSubmit={submit}>
          <div className="teacher-login-card-icon"><GraduationCap size={22} /></div>
          <h2>Sign in</h2>
          <fieldset disabled={busy} className="teacher-login-fields">
            <Input
              label="Email address or username"
              type="text"
              autoComplete="username"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <div className="field teacher-login-password-field">
              <label htmlFor="teacher-login-password">Password</label>
              <div className="teacher-login-password-control">
                <input
                  id="teacher-login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button
                  className="teacher-login-password-visibility"
                  type="button"
                  aria-label={`${showPassword ? "Hide" : "Show"} password`}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>
          </fieldset>
          <Link className="teacher-forgot-password" to="/login/teacher/reset">Forgot password?</Link>
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
