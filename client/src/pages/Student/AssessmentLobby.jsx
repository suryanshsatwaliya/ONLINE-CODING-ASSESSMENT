import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, errorMessage } from "../../services/api";
import { useSocket } from "../../hooks/useSocket";
import { useFullscreen } from "../../hooks/useFullscreen";
import Navbar from "../../components/layout/Navbar";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import { useAuth } from "../../hooks/useAuth";
import { useTimer } from "../../hooks/useTimer";
export default function AssessmentLobby() {
  const { logout } = useAuth();
  const { id } = useParams(),
    nav = useNavigate(),
    fs = useFullscreen();
  const [a, A] = useState(null),
    [error, E] = useState(""),
    [ready, R] = useState(false),
    [busy, B] = useState(false);
  const starting = useRef(false), autoTried = useRef(false);
  const seconds = useTimer(a?.status === "LIVE" ? a.closesAt || a.endTime : a?.startTime, a?.serverTime);
  const countdown = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map((n) => String(n).padStart(2, "0")).join(":");
  const load = useCallback(
    () =>
      api
        .get("/assessments/" + id)
        .then((r) => A(r.data))
        .catch((e) => E(errorMessage(e))),
    [id],
  );
  useSocket(useCallback(() => load(), [load]));
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    if (a?.status === "SCHEDULED" && a.startTime && seconds === 0) load();
  }, [a?.status, a?.startTime, seconds, load]);
  useEffect(() => {
    if (a?.status === "LIVE" && ready && !autoTried.current &&
        (!a.securitySettings.requireFullscreen || fs.fullscreen)) {
      autoTried.current = true;
      start(true);
    }
  }, [a?.status, ready, fs.fullscreen]);
  async function prepare(checked) {
    R(false); E(""); autoTried.current = false;
    if (!checked) return;
    try {
      if (a.securitySettings.requireFullscreen && !fs.fullscreen) await fs.enter();
      R(true);
    } catch {
      E("Allow fullscreen to get ready. Click the checkbox again to retry.");
    }
  }
  async function start(automatic = false) {
    if (starting.current) return;
    starting.current = true;
    B(true);
    E("");
    try {
      if (!automatic && a.securitySettings.requireFullscreen && !fs.fullscreen) await fs.enter();
      const { data } = await api.post("/attempts/start");
      nav("/student/attempt/" + data.attemptId);
    } catch (e) {
      E(errorMessage(e));
      await fs.exit();
    } finally {
      starting.current = false;
      B(false);
    }
  }
  return (
    <>
      <Navbar />
      <main className="student-page narrow">
        {a && a.status !== "ENDED" && (a.startTime || a.closesAt) && (
          <div className="card lobby-countdown" role="timer" aria-label={a.status === "LIVE" ? "Assessment time remaining" : "Time until assessment starts"}>
            <div><span className="eyebrow">{a.status === "LIVE" ? "TIME REMAINING" : "ASSESSMENT STARTS IN"}</span><strong>{countdown}</strong></div>
            <p>{a.status === "LIVE" ? "Your assessment is open. The closing time is the same for everyone." : ready ? "You're ready. You will enter automatically when the assessment opens." : "Read the rules and get ready below to join automatically."}</p>
          </div>
        )}
        <div className="card">
          <div className="row end"><Link to="/login/student" onClick={logout}>Logout</Link></div>
          <span className="eyebrow">BEFORE YOU BEGIN</span>
          <h1>{a?.title || "Assessment lobby"}</h1>
          {a && (
            <>
              <Badge>{a.status}</Badge>
              <p>
                {a.duration} minutes · {a.totalMarks} marks
              </p>
              <p>{a.status === "ENDED" ? "This assessment has ended. No new attempts can be started." : a.closesAt ? `Assessment closes at ${new Date(a.closesAt).toLocaleString()}. You receive the remaining time when you join.` : a.startTime ? `Starts automatically at ${new Date(a.startTime).toLocaleString()}. Hard close: ${new Date(a.endTime || +new Date(a.startTime) + a.duration * 60000).toLocaleString()}.` : "Waiting for your teacher to start the assessment."}</p>
              <h3>Instructions</h3>
              <p className="preserve">
                {a.instructions ||
                  "Read each question carefully and save your work."}
              </p>
              <div className="notice">
                <strong>Assessment rules</strong>
                <ul>
                  <li>Maximum warnings: {a.securitySettings.maxWarnings}</li>
                  <li>
                    Warning limit:{" "}
                    {a.securitySettings.warningAction.replace("_", " ")}
                  </li>
                  <li>
                    Fullscreen:{" "}
                    {a.securitySettings.requireFullscreen
                      ? "required"
                      : "optional"}
                  </li>
                  <li>
                    Copy / paste / cut:{" "}
                    {[
                      a.securitySettings.blockCopy,
                      a.securitySettings.blockPaste,
                      a.securitySettings.blockCut,
                    ]
                      .map((x) => (x ? "blocked" : "allowed"))
                      .join(" / ")}
                  </li>
                </ul>
                <p>
                  Browser activity is monitored where observable. Brief
                  connection issues are logged. Rules are enforced by the
                  server.
                </p>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={ready}
                  disabled={busy || a.status === "ENDED"}
                  onChange={(e) => prepare(e.target.checked)}
                />
                I have read the rules and am ready to join automatically.
              </label>
              {ready && a.status !== "ENDED" && a.securitySettings.requireFullscreen && !fs.fullscreen && (
                <p className="notice">Return to fullscreen to join automatically. <Button onClick={() => prepare(true)}>Enter fullscreen</Button></p>
              )}
              <Button
                disabled={!ready || a.status !== "LIVE" || busy}
                onClick={() => start()}
              >
                {busy
                  ? "Starting…"
                  : a.status === "LIVE"
                    ? "Start / resume assessment →"
                    : a.status === "ENDED" ? "Assessment ended" : a.startTime ? "Waiting for scheduled start" : "Waiting for teacher to start"}
              </Button>
            </>
          )}
          {error && <p className="error">{error}</p>}
        </div>
      </main>
    </>
  );
}
