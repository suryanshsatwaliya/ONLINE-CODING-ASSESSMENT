import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { resultService } from "../../services/resultService";
import { errorMessage } from "../../services/api";
import { useFullscreen } from "../../hooks/useFullscreen";
import Navbar from "../../components/layout/Navbar";
import { useAuth } from "../../hooks/useAuth";
export default function Result() {
  const { logout } = useAuth();
  const { id } = useParams(),
    [data, D] = useState(null),
    [error, E] = useState(""),
    fs = useFullscreen();
  useEffect(() => {
    fs.exit().catch(() => {});
    const load = () =>
      resultService
        .mine(id)
        .then((r) => D(r.data))
        .catch((e) => E(errorMessage(e)));
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [id]);
  return (
    <>
      <Navbar />
      <main className="student-page narrow">
        <div className="card result-card">
          <div className="success-symbol">
            {data?.status === "TERMINATED" ? "!" : "✓"}
          </div>
          <h1>
            {data?.status === "TERMINATED"
              ? "Assessment terminated"
              : data?.status === "ACTIVE"
                ? "Assessment in progress"
                : "Assessment Submitted Successfully"}
          </h1>
          <p>
            {data?.status === "TERMINATED"
              ? "Your assessment was terminated because the configured warning limit was reached."
              : data?.status === "EXPIRED"
                ? "Time has ended. Your saved answers were submitted."
                : "Your saved work has been received."}
          </p>
          {data?.published && data.result ? (
            <>
              <div className="result-score">
                {data.result.totalScore.toFixed(2)}
                <small>{data.result.percentage.toFixed(1)}%</small>
              </div>
              <p>
                Quiz {data.result.quizScore} · Coding {data.result.codingScore}{" "}
                · Approved AI {data.result.aiScore}
              </p>
              <p>
                {data.result.status === "PENDING"
                  ? "Code grading is still pending. This score is provisional."
                  : "Grading complete."}
              </p>
            </>
          ) : (
            <p>Your teacher will publish results when they are ready.</p>
          )}
          {error && <p className="error">{error}</p>}
          <Link className="btn" to="/login/student" onClick={logout}>
            Return to student login
          </Link>
        </div>
      </main>
    </>
  );
}
