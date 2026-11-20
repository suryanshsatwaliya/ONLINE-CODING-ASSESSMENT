import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import Button from "../../components/common/Button";
import { authService } from "../../services/authService";
import { errorMessage } from "../../services/api";
import "./teacher-settings.css";

function PasswordField({ id, label, name, autoComplete, minLength, maxLength }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field teacher-password-field">
      <label htmlFor={id}>{label}</label>
      <div className="teacher-password-control">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={maxLength}
          required
        />
        <button
          className="teacher-password-visibility"
          type="button"
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [hasError, setHasError] = useState(false);
  const [username, setUsername] = useState(user?.username || "");
  const [usernameBusy, setUsernameBusy] = useState(false);
  const [usernameFeedback, setUsernameFeedback] = useState("");
  const [usernameHasError, setUsernameHasError] = useState(false);

  useEffect(() => {
    if (user?.role !== "TEACHER" || user.username) return;
    authService.me().then(({ data }) => {
      if (data.user) {
        setUsername(data.user.username || "");
        updateUser(data.user);
      }
    }).catch(() => {});
  }, [user?.id, user?.role, user?.username, updateUser]);

  async function changeUsername(event) {
    event.preventDefault();
    if (usernameBusy) return;
    const nextUsername = username.trim().toLowerCase();
    if (nextUsername === user?.username) {
      setUsernameFeedback("This is already your username.");
      setUsernameHasError(false);
      return;
    }
    setUsernameBusy(true);
    setUsernameFeedback("");
    setUsernameHasError(false);
    try {
      const { data } = await authService.teacherChangeUsername({ username: nextUsername });
      setUsername(data.username);
      updateUser({ ...user, username: data.username });
      setUsernameFeedback("Your username has been changed. You can use it the next time you sign in.");
    } catch (error) {
      setUsernameFeedback(errorMessage(error));
      setUsernameHasError(true);
    } finally {
      setUsernameBusy(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const currentPassword = formData.get("currentPassword");
    const newPassword = formData.get("newPassword");
    const confirmation = formData.get("confirmation");
    setBusy(true);
    setFeedback("");
    setHasError(false);
    try {
      await authService.teacherChangePassword({ currentPassword, newPassword, confirmation });
      form.reset();
      setFeedback("Your password has been changed successfully.");
    } catch (error) {
      setFeedback(errorMessage(error));
      setHasError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Settings</h1>
        </div>
      </div>
      <section className="card">
        <h2>Teacher account</h2>
        <p>
          {user.name} · {user.email}
        </p>
        <p>
          Your name and email are managed by the server administrator. You can
          change your username and password below.
        </p>
      </section>
      <section className="card teacher-password-settings">
        <h2>Change username</h2>
        <p>Your username can also be used to sign in. Usernames are not case-sensitive.</p>
        <form className="teacher-password-form" onSubmit={changeUsername}>
          <div className="field">
            <label htmlFor="teacher-username">Username</label>
            <input
              id="teacher-username"
              name="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              minLength={3}
              maxLength={40}
              pattern="[A-Za-z0-9._-]+"
              title="Use 3–40 letters, numbers, dots, underscores, or hyphens."
              required
            />
          </div>
          <small className="teacher-password-hint">Use 3–40 letters, numbers, dots, underscores, or hyphens.</small>
          {usernameFeedback && <p className={usernameHasError ? "teacher-password-error" : "teacher-password-success"} role={usernameHasError ? "alert" : "status"}>{usernameFeedback}</p>}
          <Button type="submit" disabled={usernameBusy}>
            {usernameBusy ? "Saving username…" : "Save username"}
          </Button>
        </form>
      </section>
      <section className="card teacher-password-settings">
        <h2>Change password</h2>
        <p>Enter your current password, then choose a new password for your account.</p>
        <form className="teacher-password-form" onSubmit={changePassword}>
          <PasswordField
            id="teacher-current-password"
            label="Current password"
            name="currentPassword"
            autoComplete="current-password"
          />
          <PasswordField
            id="teacher-new-password"
            label="New password"
            name="newPassword"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
          />
          <PasswordField
            id="teacher-confirm-password"
            label="Confirm new password"
            name="confirmation"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
          />
          <small className="teacher-password-hint">
            Use at least 12 characters with uppercase and lowercase letters, a number, and a special character.
          </small>
          {feedback && <p className={hasError ? "teacher-password-error" : "teacher-password-success"} role={hasError ? "alert" : "status"}>{feedback}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? "Changing password…" : "Change password"}
          </Button>
        </form>
      </section>
      <section className="card">
        <h2>Assessment preferences</h2>
        <p>
          Configure warning policies, language availability, AI rubric and
          result visibility in each assessment. Live assessment settings are
          locked to preserve consistent rules for students.
        </p>
      </section>
      <section className="card">
        <h2>Service configuration</h2>
        <p>
          Database, code runner and AI credentials are configured on the server.
          No secret is available in this browser.
        </p>
        <p>See README.md and docs/DEPLOYMENT.md for setup instructions.</p>
      </section>
    </>
  );
}
