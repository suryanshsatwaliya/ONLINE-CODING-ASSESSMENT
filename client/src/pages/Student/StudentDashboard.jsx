import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import Navbar from "../../components/layout/Navbar";
import Badge from "../../components/common/Badge";
export default function StudentDashboard() {
  const [rows, R] = useState([]),
    [error, E] = useState("");
  const { user, logout } = useAuth();
  useEffect(() => {
    api
      .get("/assessments")
      .then((r) => R(r.data))
      .catch((e) => E(errorMessage(e)));
  }, []);
  return (
    <>
      <Navbar />
      <main className="student-page">
        <div className="page-title">
          <div>
            <span className="eyebrow">STUDENT WORKSPACE</span>
            <h1>Hello, {user.name}.</h1>
            <p>Your authorized assessment is ready below.</p>
          </div>
          <Link to="/" onClick={logout}>
            Logout
          </Link>
        </div>
        {error && <p className="error">{error}</p>}
        {rows.map((a) => (
          <div className="card assessment-card" key={a._id}>
            <div className="row between">
              <Badge>{a.type}</Badge>
              <Badge>{a.status}</Badge>
            </div>
            <h2>{a.title}</h2>
            <p>{a.description}</p>
            <p>
              {a.duration} minutes · {a.totalMarks} marks
            </p>
            <Link className="btn" to={"/student/lobby/" + a._id}>
              Enter assessment lobby →
            </Link>
          </div>
        ))}
      </main>
    </>
  );
}
