import { Link } from "react-router-dom";
import Badge from "../common/Badge";
export default function AssessmentCard({ assessment: a }) {
  return (
    <Link to={"/teacher/assessments/" + a._id} className="card assessment-card">
      <div className="row between">
        <span className="eyebrow">{a.type}</span>
        <Badge>{a.status}</Badge>
      </div>
      <h2>{a.title}</h2>
      <p>{a.description || "Ready to shape the next learning milestone."}</p>
      <div className="row between muted">
        <span>
          {a.duration} min · {a.totalMarks} marks
        </span>
        <span>Open assessment →</span>
      </div>
    </Link>
  );
}
