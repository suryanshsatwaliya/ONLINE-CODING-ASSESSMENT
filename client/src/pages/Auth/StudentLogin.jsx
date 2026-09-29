import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authService } from "../../services/authService";
import { errorMessage } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import Navbar from "../../components/layout/Navbar";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
export default function StudentLogin() {
  const [form, set] = useState({ uid: "", assessmentId: "", accessCode: "" }),
    [identity, I] = useState(null),
    [error, E] = useState(""),
    [busy, B] = useState(false);
  const { login } = useAuth(),
    nav = useNavigate();
  async function submit(e) {
    e.preventDefault();
    B(true);
    E("");
    try {
      if (!identity) I((await authService.verify({ uid: form.uid })).data);
      else {
        login((await authService.studentLogin(form)).data);
        nav("/student");
      }
    } catch (e) {
      E(errorMessage(e));
    } finally {
      B(false);
    }
  }
  return (
    <>
      <Navbar />
      <form className="auth-card card" onSubmit={submit}>
        <span className="eyebrow">STUDENT PORTAL</span>
        <h1>Ready for your next challenge?</h1>
        <Input
          label="Student UID"
          required
          value={form.uid}
          onChange={(e) => {
            set({ ...form, uid: e.target.value });
            I(null);
          }}
        />
        {identity && (
          <>
            <div className="notice">
              <strong>{identity.name}</strong>
              <p>
                {identity.course} · {identity.section}
              </p>
            </div>
            <Input
              label="Assessment ID from your teacher"
              required
              value={form.assessmentId}
              onChange={(e) => set({ ...form, assessmentId: e.target.value })}
            />
            <Input
              label="Assessment access code"
              required
              type="password"
              value={form.accessCode}
              onChange={(e) => set({ ...form, accessCode: e.target.value })}
            />
            <label className="check">
              <input type="checkbox" required />I confirm this is my student
              identity.
            </label>
          </>
        )}
        {error && <p className="error">{error}</p>}
        <Button disabled={busy}>
          {busy
            ? "Checking…"
            : identity
              ? "Confirm & continue →"
              : "Verify UID →"}
        </Button>
        <Link to="/">← Back to portals</Link>
      </form>
    </>
  );
}
