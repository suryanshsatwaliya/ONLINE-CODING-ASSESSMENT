import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, KeyRound } from "lucide-react";
import { api, errorMessage } from "../../services/api";
import Navbar from "../../components/layout/Navbar";
import TeacherLoginStory from "./TeacherLoginStory";
import "./teacher-password-reset.css";

export default function TeacherEmailVerification() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState({ busy: true, message: "Verifying your email…", success: false });

  useEffect(() => {
    let active = true;
    if (!token) {
      setState({ busy: false, message: "This verification link is missing or invalid. Ask the administrator to send a new one.", success: false });
      return () => { active = false; };
    }
    api.post("/auth/teacher/verify-email", { token })
      .then(({ data }) => { if (active) setState({ busy: false, message: data.message, success: true }); })
      .catch((error) => { if (active) setState({ busy: false, message: errorMessage(error), success: false }); });
    return () => { active = false; };
  }, [token]);

  return <><Navbar /><main className="teacher-login-page"><div className="teacher-login-layout"><TeacherLoginStory /><section className="teacher-login-card teacher-reset-card card"><div className="teacher-login-card-icon">{state.success ? <CheckCircle2 size={21} /> : <KeyRound size={21} />}</div><p className="eyebrow">TEACHER ACCOUNT</p><h2>{state.busy ? "Verifying email" : state.success ? "Email verified" : "Verification issue"}</h2><p role={state.success ? "status" : "alert"}>{state.message}</p>{state.busy && <div className="teacher-captcha-unavailable" role="status">Please keep this page open.</div>}<Link className="teacher-reset-back" to="/login/teacher">Return to sign in</Link></section></div></main></>;
}
