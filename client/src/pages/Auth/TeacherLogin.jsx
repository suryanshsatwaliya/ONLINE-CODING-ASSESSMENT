import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authService } from "../../services/authService";
import { errorMessage } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import Navbar from "../../components/layout/Navbar";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
export default function TeacherLogin() {
  const [form, set] = useState({ email: "", password: "" }),
    [error, E] = useState(""),
    [busy, B] = useState(false);
  const { login } = useAuth(),
    nav = useNavigate();
  async function submit(e) {
    e.preventDefault();
    B(true);
    E("");
    try {
      login((await authService.teacherLogin(form)).data);
      nav("/teacher/dashboard");
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
        <span className="eyebrow">TEACHER WORKSPACE</span>
        <h1>Welcome back.</h1>
        <p>Sign in to manage your assessments.</p>
        <Input
          label="Email address"
          type="email"
          autoComplete="username"
          required
          value={form.email}
          onChange={(e) => set({ ...form, email: e.target.value })}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={(e) => set({ ...form, password: e.target.value })}
        />
        {error && <p className="error">{error}</p>}
        <Button disabled={busy}>
          {busy ? "Signing in…" : "Teacher Login →"}
        </Button>
        <Link to="/">← Back to portals</Link>
      </form>
    </>
  );
}
