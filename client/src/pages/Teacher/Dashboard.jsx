import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Radio,
  Calendar,
  CheckCircle,
  FileCheck,
  BarChart3,
} from "lucide-react";
import { api, errorMessage } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../components/common/Toast";
import AssessmentCard from "../../components/teacher/AssessmentCard";
import Badge from "../../components/common/Badge";
import { useAssessmentUpdates } from "../../hooks/useAssessmentUpdates";
export default function Dashboard() {
  const { user } = useAuth(),
    toast = useToast();
  const [data, D] = useState({ students: [], assessments: [], results: [] });
  useAssessmentUpdates(useCallback(() => {
    api.get("/assessments").then(({ data: assessments }) => D((previous) => ({ ...previous, assessments }))).catch(() => {});
  }, []));
  useEffect(() => {
    Promise.all([api.get("/students"), api.get("/assessments")])
      .then(async ([s, a]) => {
        const r = await Promise.all(
          a.data.map((x) => api.get("/results/" + x._id)),
        );
        D({
          students: s.data,
          assessments: a.data,
          results: r.flatMap((x) => x.data),
        });
      })
      .catch((e) => toast(errorMessage(e)));
  }, []);
  const a = data.assessments,
    r = data.results;
  const stats = [
    ["Total students", data.students.length, Users],
    ["Active assessments", a.filter((x) => x.status === "LIVE").length, Radio],
    ["Scheduled", a.filter((x) => x.status === "SCHEDULED").length, Calendar],
    ["Completed", a.filter((x) => x.status === "ENDED").length, CheckCircle],
    ["Total submissions", r.length, FileCheck],
    [
      "Average score",
      r.length
        ? (r.reduce((s, x) => s + x.percentage, 0) / r.length).toFixed(1) + "%"
        : "—",
      BarChart3,
    ],
  ];
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">YOUR TEACHING, AT A GLANCE</span>
          <h1>Welcome back, {user.name.split(" ")[0]}.</h1>
          <p>Everything you need for a productive assessment day.</p>
        </div>
        <div className="row wrap"><Link className="btn secondary" to="/teacher/exam-preview">Preview exam interface</Link>
        <Link className="btn" to="/teacher/assessments/new">
          + Create assessment
        </Link>
        </div>
      </div>
      <div className="dashboard-banner">
        <div>
          <span className="eyebrow">MAKE EVERY ASSESSMENT COUNT</span>
          <h2>A clearer picture of student progress.</h2>
          <p>
            From the first question to the final submission — all in one place.
          </p>
        </div>
        <div className="banner-art">
          <BarChart3 size={70} />
        </div>
      </div>
      <div className="stats">
        {stats.map(([label, value, Icon]) => (
          <div className="stat card" key={label}>
            <div className="row between">
              <span>{label}</span>
              <Icon size={19} />
            </div>
            <strong>{value}</strong>
            <small>Current workspace</small>
          </div>
        ))}
      </div>
      <div className="row between">
        <h2>Recent assessments</h2>
        <Link to="/teacher/assessments">View all →</Link>
      </div>
      <div className="grid two">
        {a.slice(0, 4).map((x) => (
          <AssessmentCard assessment={x} key={x._id} onDeleted={(id) => D((previous) => ({ ...previous, assessments: previous.assessments.filter((item) => item._id !== id) }))} />
        ))}
      </div>
      {!a.length && (
        <div className="card empty">
          Your next great assessment starts here. Create one above.
        </div>
      )}
      <div className="grid two">
        <div className="card">
          <h2>Recent submissions</h2>
          {r
            .sort((x, y) => new Date(y.gradedAt) - new Date(x.gradedAt))
            .slice(0, 5)
            .map((x) => (
              <div className="list-row" key={x._id}>
                <span>
                  {x.student?.name}
                  <small>{x.student?.uid}</small>
                </span>
                <Badge>{x.status}</Badge>
              </div>
            ))}
          {!r.length && <p>No submissions yet.</p>}
        </div>
        <div className="card">
          <h2>Upcoming assessments</h2>
          {a
            .filter((x) => x.status === "SCHEDULED")
            .slice(0, 5)
            .map((x) => (
              <div className="list-row" key={x._id}>
                <strong>{x.title}</strong>
                <small>
                  {x.startTime
                    ? new Date(x.startTime).toLocaleString()
                    : "Teacher-controlled start"}
                </small>
              </div>
            ))}
          <h3>Active students</h3>
          <p>
            {data.students.filter((s) => s.status === "ACTIVE").length}{" "}
            authorized student accounts
          </p>
        </div>
      </div>
    </>
  );
}
