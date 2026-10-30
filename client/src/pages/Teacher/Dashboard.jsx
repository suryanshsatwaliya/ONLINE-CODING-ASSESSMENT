import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import ReuseAssessmentModal from "../../components/teacher/ReuseAssessmentModal";
import Badge from "../../components/common/Badge";
import { useAssessmentUpdates } from "../../hooks/useAssessmentUpdates";
export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth(),
    toast = useToast();
  const [data, D] = useState({ students: [], assessments: [], results: [] });
  const [reuseId, setReuseId] = useState(null);
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
      <div className="page-title dashboard-heading">
        <div>
          <h1>Welcome back, {user.name.split(" ")[0]}.</h1>
          <p>Your assessments and student progress, in one place.</p>
        </div>
        <div className="row wrap"><Link className="btn secondary" to="/teacher/exam-preview">Preview exam interface</Link>
        <Link className="btn" to="/teacher/assessments/new">
          + Create assessment
        </Link>
        </div>
      </div>
      <div className="stats dashboard-stats">
        {stats.map(([label, value, Icon]) => (
          <div className="stat card dashboard-stat" key={label}>
            <div className="row between">
              <span>{label}</span>
              <Icon size={19} />
            </div>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="row between dashboard-section-heading">
        <div><span className="eyebrow">WORKSPACE</span><h2>Recent assessments</h2></div>
        <Link to="/teacher/assessments">View all →</Link>
      </div>
      <div className="grid three dashboard-assessments">
        {a.slice(0, 6).map((x) => (
          <AssessmentCard assessment={x} key={x._id} onReuse={setReuseId} onDeleted={(id) => D((previous) => ({ ...previous, assessments: previous.assessments.filter((item) => item._id !== id) }))} />
        ))}
      </div>
      {!a.length && (
        <div className="card empty">
          Your next great assessment starts here. Create one above.
        </div>
      )}
      <div className="row between dashboard-section-heading dashboard-overview-heading">
        <div><span className="eyebrow">LATEST ACTIVITY</span><h2>Workspace overview</h2></div>
      </div>
      <div className="grid three dashboard-overview">
        <div className="card dashboard-widget">
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
        <div className="card dashboard-widget">
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
        </div>
        <div className="card dashboard-widget dashboard-active-students">
          <span className="eyebrow">STUDENT ACCOUNTS</span>
          <strong>{data.students.filter((student) => student.status === "ACTIVE").length}</strong>
          <h2>Active students</h2>
          <p>Authorized accounts in your workspace.</p>
          <Link to="/teacher/students">Manage students →</Link>
        </div>
      </div>
      {reuseId && <ReuseAssessmentModal assessmentId={reuseId} onClose={() => setReuseId(null)} onCreated={async (newId) => {
        setReuseId(null);
        try {
          const { data: assessments } = await api.get("/assessments");
          D((previous) => ({ ...previous, assessments }));
        } catch (e) {
          toast(errorMessage(e));
        }
        navigate(`/teacher/assessments/${newId}`);
      }} />}
    </>
  );
}
