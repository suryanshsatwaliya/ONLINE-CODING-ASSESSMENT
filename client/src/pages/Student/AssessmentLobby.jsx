import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, errorMessage } from "../../services/api";
import { useSocket } from "../../hooks/useSocket";
import { useFullscreen } from "../../hooks/useFullscreen";
import Navbar from "../../components/layout/Navbar";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
export default function AssessmentLobby() {
  const { id } = useParams(),
    nav = useNavigate(),
    fs = useFullscreen();
  const [a, A] = useState(null),
    [error, E] = useState(""),
    [ready, R] = useState(false),
    [busy, B] = useState(false);
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
  async function start() {
    B(true);
    try {
      if (a.securitySettings.requireFullscreen) await fs.enter();
      const { data } = await api.post("/attempts/start");
      nav("/student/attempt/" + data.attemptId);
    } catch (e) {
      E(errorMessage(e));
      await fs.exit();
    } finally {
      B(false);
    }
  }
  return (
    <>
      <Navbar />
      <main className="student-page narrow">
        <div className="card">
          <span className="eyebrow">BEFORE YOU BEGIN</span>
          <h1>{a?.title || "Assessment lobby"}</h1>
          {a && (
            <>
              <Badge>{a.status}</Badge>
              <p>
                {a.duration} minutes · {a.totalMarks} marks
              </p>
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
                  onChange={(e) => R(e.target.checked)}
                />
                I have read the instructions and assessment rules.
              </label>
              <Button
                disabled={!ready || a.status !== "LIVE" || busy}
                onClick={start}
              >
                {busy
                  ? "Starting…"
                  : a.status === "LIVE"
                    ? "Start / resume assessment →"
                    : "Waiting for teacher to start"}
              </Button>
            </>
          )}
          {error && <p className="error">{error}</p>}
        </div>
      </main>
    </>
  );
}
